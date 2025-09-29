import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { 
      machine_id, 
      tab_id, 
      screenshot_data,
      url,
      domain,
      metadata 
    } = await req.json()

    console.log('Screenshot received from:', machine_id, 'for domain:', domain);

    if (!machine_id || !tab_id || !screenshot_data) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Store screenshot data (in a real implementation, you might want to store this in Supabase Storage)
    // For now, we'll just log the metadata and store basic info in the database
    
    const { error: insertError } = await supabaseClient
      .from('remote_commands')
      .insert({
        command_type: 'screenshot',
        target_machine_id: machine_id,
        target_tab_id: tab_id,
        target_domain: domain,
        status: 'executed',
        response: {
          url,
          domain,
          captured_at: new Date().toISOString(),
          metadata,
          screenshot_size: screenshot_data.length
        },
        executed_by: null, // System executed
        executed_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('Error storing screenshot info:', insertError);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // In a production environment, you would:
    // 1. Upload the screenshot_data to Supabase Storage
    // 2. Store the file URL in the database
    // 3. Implement proper access controls for screenshot viewing

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Screenshot captured successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Screenshot capture error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})