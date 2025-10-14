import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { machine_id, tab_id, snapshot } = await req.json();
    
    console.log(`📸 DOM snapshot received from ${machine_id}/${tab_id}`);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Find active session for this machine+tab
    const { data: session } = await supabase
      .from('active_sessions')
      .select('id')
      .eq('machine_id', machine_id)
      .eq('tab_id', tab_id)
      .eq('is_active', true)
      .maybeSingle();
    
    if (!session) {
      console.warn(`⚠️ No active session found for ${machine_id}/${tab_id}`);
    }
    
    // Insert snapshot into database
    const { error } = await supabase
      .from('dom_snapshots')
      .insert({
        machine_id,
        tab_id,
        session_id: session?.id,
        url: snapshot.url,
        title: snapshot.title,
        html_content: snapshot.html,
        resources: snapshot.resources,
        viewport: snapshot.viewport,
        captured_at: new Date(snapshot.timestamp).toISOString()
      });
    
    if (error) throw error;
    
    console.log(`✅ DOM snapshot saved: ${snapshot.url}`);
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ DOM snapshot error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});