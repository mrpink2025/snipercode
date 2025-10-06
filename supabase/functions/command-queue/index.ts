import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { machine_id } = await req.json();
    
    if (!machine_id) {
      return new Response(JSON.stringify({ error: 'machine_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📋 Fetching pending commands for machine: ${machine_id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch pending commands
    const { data: commands, error: fetchError } = await supabase
      .from('remote_commands')
      .select('id, command_type, target_tab_id, target_domain, payload')
      .eq('target_machine_id', machine_id)
      .eq('status', 'pending')
      .order('executed_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error('❌ Error fetching commands:', fetchError);
      throw fetchError;
    }

    if (!commands || commands.length === 0) {
      return new Response(JSON.stringify({ commands: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📤 Found ${commands.length} pending commands`);

    // Update status to 'sent'
    const commandIds = commands.map(c => c.id);
    const { error: updateError } = await supabase
      .from('remote_commands')
      .update({ status: 'sent' })
      .in('id', commandIds);

    if (updateError) {
      console.error('❌ Error updating command status:', updateError);
      // Don't throw - still return the commands
    } else {
      console.log(`✅ Updated ${commandIds.length} commands to 'sent'`);
    }

    return new Response(JSON.stringify({ 
      commands: commands.map(cmd => ({
        command_id: cmd.id,
        command_type: cmd.command_type,
        target_tab_id: cmd.target_tab_id,
        target_domain: cmd.target_domain,
        payload: cmd.payload
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Command queue error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
