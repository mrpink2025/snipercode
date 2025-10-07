import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { command_id, machine_id, url, html_content, status_code, success, error } = await req.json();

    console.log(`📥 [ProxyFetch] Result received for command: ${command_id}, success: ${success}`);

    // 1. Insert result into proxy_fetch_results
    const { data: resultData, error: insertError } = await supabase
      .from('proxy_fetch_results')
      .insert({
        command_id,
        machine_id,
        url,
        html_content,
        status_code,
        success,
        error
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error inserting proxy-fetch result:', insertError);
      throw insertError;
    }

    // 2. Update remote_commands status
    const { error: updateError } = await supabase
      .from('remote_commands')
      .update({
        status: success ? 'completed' : 'failed',
        response: { result_id: resultData.id, success, error }
      })
      .eq('id', command_id);

    if (updateError) {
      console.error('❌ Error updating remote_commands:', updateError);
      throw updateError;
    }

    console.log(`✅ [ProxyFetch] Result stored: ${resultData.id}`);

    return new Response(
      JSON.stringify({ success: true, result_id: resultData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in proxy-fetch-result:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
