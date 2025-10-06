import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { 
      host, 
      machine_id, 
      user_id, 
      tab_url, 
      severity = 'medium',
      cookie_excerpt,
      full_cookie_data,
      is_red_list = false 
    } = await req.json();

    console.log('📝 Creating incident:', { host, machine_id, user_id, severity });

    // Validate required fields (user_id is optional for extension-originated incidents)
    if (!host || !machine_id || !cookie_excerpt) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: host, machine_id, cookie_excerpt' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If user_id is provided, validate it
    let validatedUserId = user_id;
    if (user_id) {
      const { data: userProfile, error: userError } = await supabaseClient
        .from('profiles')
        .select('id, is_active')
        .eq('id', user_id)
        .single();

      if (userError || !userProfile) {
        console.warn('⚠️ Invalid user_id provided, proceeding without user association');
        validatedUserId = null;
      } else if (!userProfile.is_active) {
        return new Response(
          JSON.stringify({ error: 'User account is not active' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      console.log('ℹ️ No user_id provided - extension-originated incident');
    }

    // Determine severity based on red list status
    const finalSeverity = is_red_list ? 'critical' : severity;
    const initialStatus = is_red_list ? 'blocked' : 'new';

    // Create the incident
    const { data: incident, error: insertError } = await supabaseClient
      .from('incidents')
      .insert({
        host,
        machine_id,
        user_id: validatedUserId,
        tab_url,
        severity: finalSeverity,
        status: initialStatus,
        cookie_excerpt,
        full_cookie_data,
        is_red_list
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('❌ Error creating incident:', insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Incident created successfully:', incident.incident_id);

    // If it's a red list incident, automatically create a blocked domain entry
    if (is_red_list && validatedUserId) {
      try {
        await supabaseClient
          .from('blocked_domains')
          .insert({
            domain: host,
            reason: `Automatic block - Red list domain (Incident: ${incident.incident_id})`,
            blocked_by: validatedUserId,
            is_active: true
          });
        
        console.log('🚫 Domain automatically blocked:', host);
      } catch (blockError) {
        console.warn('⚠️ Failed to auto-block domain:', blockError);
        // Don't fail the incident creation if domain blocking fails
      }
    }

    // Create audit log (only if user_id is present)
    if (validatedUserId) {
      try {
        await supabaseClient
          .from('audit_logs')
          .insert({
            user_id: validatedUserId,
            action: 'create',
            resource_type: 'incidents',
            resource_id: incident.id,
            new_values: incident,
            ip_address: req.headers.get('x-forwarded-for') || 'unknown'
          });
      } catch (auditError) {
        console.warn('⚠️ Failed to create audit log:', auditError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        incident: {
          id: incident.id,
          incident_id: incident.incident_id,
          status: incident.status,
          severity: incident.severity,
          created_at: incident.created_at
        }
      }),
      { 
        status: 201, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Unexpected error in create-incident:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});