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
      user_id,
      tab_id, 
      url, 
      domain, 
      title,
      action = 'heartbeat' 
    } = await req.json()

    console.log('Session tracker received:', { machine_id, domain, action });

    if (!machine_id || !tab_id || !domain) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'heartbeat') {
      // Update or insert session
      const { error: upsertError } = await supabaseClient
        .from('active_sessions')
        .upsert({
          machine_id,
          user_id,
          tab_id,
          url,
          domain,
          title,
          last_activity: new Date().toISOString(),
          is_active: true
        }, {
          onConflict: 'machine_id,tab_id'
        })

      if (upsertError) {
        console.error('Error upserting session:', upsertError);
        return new Response(JSON.stringify({ error: 'Database error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Check if domain is monitored
      const { data: monitoredDomain } = await supabaseClient
        .from('monitored_domains')
        .select('*')
        .eq('domain', domain)
        .eq('is_active', true)
        .maybeSingle()

      if (monitoredDomain) {
        // Verificar se há URL específica configurada
        const fullUrlMonitored = monitoredDomain.metadata?.full_url;
        const shouldAlert = !fullUrlMonitored || url.includes(fullUrlMonitored);
        
        if (shouldAlert) {
          console.log('Monitored domain/URL accessed:', domain, url);
          
          // Create admin alert
          const { error: alertError } = await supabaseClient
            .from('admin_alerts')
            .insert({
              alert_type: 'domain_access',
              machine_id,
              domain,
              url,
              metadata: {
                title,
                alert_frequency: monitoredDomain.alert_frequency,
                alert_type: monitoredDomain.alert_type,
                is_critical: monitoredDomain.alert_type === 'critical',
                full_url_match: fullUrlMonitored || null
              }
            })

          if (alertError) {
            console.error('Error creating alert:', alertError);
          }
        }
      }

    } else if (action === 'close') {
      // Mark session as inactive
      const { error: updateError } = await supabaseClient
        .from('active_sessions')
        .update({ is_active: false })
        .eq('machine_id', machine_id)
        .eq('tab_id', tab_id)

      if (updateError) {
        console.error('Error closing session:', updateError);
        return new Response(JSON.stringify({ error: 'Database error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Session tracker error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})