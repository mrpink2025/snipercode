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
        const { command_type, target_machine_id, target_tab_id, payload } = await req.json();
        
        console.log('Dispatching command:', { command_type, target_machine_id });
        
        const connection = activeConnections.get(target_machine_id);
        if (connection && connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.send(JSON.stringify({
            type: 'remote_command',
            command_type,
            target_tab_id,
            payload,
            timestamp: new Date().toISOString()
          }));
          
          return new Response(JSON.stringify({ success: true, status: 'sent' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          return new Response(JSON.stringify({ success: false, status: 'offline' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
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

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('WebSocket message received:', data);

      if (data.type === 'register') {
        machine_id = data.machine_id;
        if (machine_id) {
          activeConnections.set(machine_id, {
            machine_id,
            socket,
            last_ping: Date.now()
          });
          console.log(`Extension registered: ${machine_id}`);
          
          socket.send(JSON.stringify({
            type: 'registered',
            machine_id,
            timestamp: new Date().toISOString()
          }));
        }
      } else if (data.type === 'ping') {
        if (machine_id) {
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

  socket.onclose = () => {
    if (machine_id) {
      activeConnections.delete(machine_id);
      console.log(`Extension disconnected: ${machine_id}`);
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