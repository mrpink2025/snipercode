import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WebSocketConnection {
  machine_id: string;
  socket: WebSocket;
  last_ping: number;
}

const activeConnections = new Map<string, WebSocketConnection>();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    // Handle HTTP requests for sending commands
    if (req.method === 'POST') {
      try {
        const { command_id, command_type, target_machine_id, target_tab_id, payload } = await req.json();
        
        console.log('📡 Dispatching command:', { command_id, command_type, target_machine_id });
        
        // ✅ Primeiro: Checar DB para ver se máquina está online
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
        const { data: dbConnection } = await supabase
          .from('websocket_connections')
          .select('is_active, last_ping_at')
          .eq('machine_id', target_machine_id)
          .maybeSingle();
        
        const isOnlineDB = dbConnection?.is_active && 
                           new Date(dbConnection.last_ping_at).getTime() > Date.now() - 60000; // 1min
        
        console.log(`🔍 Connection status for ${target_machine_id}:`, {
          found_in_db: !!dbConnection,
          is_active: dbConnection?.is_active,
          last_ping_age: dbConnection ? Date.now() - new Date(dbConnection.last_ping_at).getTime() : null,
          online: isOnlineDB,
          local_connection: !!activeConnections.get(target_machine_id)
        });
        
        // ✅ Segundo: Tentar enviar via WebSocket local (se disponível)
        const localConnection = activeConnections.get(target_machine_id);
        
        if (localConnection && localConnection.socket.readyState === WebSocket.OPEN) {
          // WebSocket disponível NESTA instância - enviar direto
          try {
            localConnection.socket.send(JSON.stringify({
              type: 'remote_command',
              command_id,
              command_type,
              target_tab_id,
              payload,
              timestamp: new Date().toISOString()
            }));
            
            console.log(`✅ Command ${command_id} sent via WebSocket (local instance)`);
            return new Response(JSON.stringify({ success: true, status: 'sent' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } catch (sendError) {
            console.error(`❌ WebSocket send failed:`, sendError);
          }
        }
        
        // ✅ Terceiro: Se online no DB mas não no Map local, retornar "queued"
        if (isOnlineDB) {
          console.log(`📥 Machine ${target_machine_id} online in DB - command ${command_id} will be picked up via polling`);
          return new Response(JSON.stringify({ success: true, status: 'queued' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // ✅ Quarto: Realmente offline
        console.log(`❌ Machine ${target_machine_id} offline - command ${command_id} queued for later`);
        return new Response(JSON.stringify({ success: false, status: 'offline' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
      } catch (error) {
        console.error('Command dispatch error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  // Handle WebSocket connections from extensions
  const { socket, response } = Deno.upgradeWebSocket(req);
  let machine_id: string | null = null;

  socket.onopen = () => {
    console.log("Extension WebSocket connected");
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('WebSocket message received:', data);

      if (data.type === 'register') {
        machine_id = data.machine_id;
        if (machine_id) {
          // ✅ Salvar no database
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          
          await supabase
            .from('websocket_connections')
            .upsert({
              machine_id,
              last_ping_at: new Date().toISOString(),
              is_active: true
            });
          
          // Manter no Map também (para performance local)
          activeConnections.set(machine_id, {
            machine_id,
            socket,
            last_ping: Date.now()
          });
          
          console.log(`✅ Extension registered in DB: ${machine_id}`);
          
          socket.send(JSON.stringify({
            type: 'registered',
            machine_id,
            timestamp: new Date().toISOString()
          }));
        }
      } else if (data.type === 'ping') {
        if (machine_id) {
          // ✅ Atualizar timestamp no DB
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          
          await supabase
            .from('websocket_connections')
            .update({ last_ping_at: new Date().toISOString() })
            .eq('machine_id', machine_id);
          
          // Atualizar Map local
          const connection = activeConnections.get(machine_id);
          if (connection) {
            connection.last_ping = Date.now();
          }
        }
        socket.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date().toISOString()
        }));
      } else if (data.type === 'command_response') {
        console.log('Command response received:', data);
        // Could store response in database here
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  };

  socket.onclose = async () => {
    if (machine_id) {
      // ✅ Marcar como inativa no DB
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      await supabase
        .from('websocket_connections')
        .update({ is_active: false })
        .eq('machine_id', machine_id);
      
      activeConnections.delete(machine_id);
      console.log(`WebSocket closed for ${machine_id}`);
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
    if (machine_id) {
      activeConnections.delete(machine_id);
    }
  };

  // Clean up stale connections every 30 seconds
  setInterval(() => {
    const now = Date.now();
    for (const [id, connection] of activeConnections.entries()) {
      if (now - connection.last_ping > 60000) { // 1 minute timeout
        console.log(`Removing stale connection: ${id}`);
        activeConnections.delete(id);
        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.close();
        }
      }
    }
  }, 30000);

  return response;
})