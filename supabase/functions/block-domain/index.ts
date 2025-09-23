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

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { domain, reason, expires_at } = await req.json();

    console.log('🚫 Blocking domain:', { domain, reason, user_id: user.id });

    // Validate required fields
    if (!domain || !reason) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: domain, reason' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      return new Response(
        JSON.stringify({ error: 'Invalid domain format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has permission (operator or above)
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userProfile.is_active) {
      return new Response(
        JSON.stringify({ error: 'User account is not active' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allowedRoles = ['operator', 'approver', 'admin'];
    if (!allowedRoles.includes(userProfile.role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if domain is already blocked and active
    const { data: existingBlock } = await supabaseClient
      .from('blocked_domains')
      .select('id, is_active')
      .eq('domain', domain)
      .eq('is_active', true)
      .single();

    if (existingBlock) {
      return new Response(
        JSON.stringify({ error: 'Domain is already blocked' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the domain block
    const { data: blockedDomain, error: blockError } = await supabaseClient
      .from('blocked_domains')
      .insert({
        domain,
        reason,
        blocked_by: user.id,
        expires_at: expires_at || null,
        is_active: true
      })
      .select('*')
      .single();

    if (blockError) {
      console.error('❌ Error blocking domain:', blockError);
      return new Response(
        JSON.stringify({ error: blockError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Domain blocked successfully:', domain);

    // Update related incidents to blocked status
    try {
      const { error: updateError } = await supabaseClient
        .from('incidents')
        .update({ status: 'blocked' })
        .eq('host', domain)
        .in('status', ['new', 'in-progress']);

      if (updateError) {
        console.warn('⚠️ Failed to update related incidents:', updateError);
      } else {
        console.log('📝 Updated related incidents to blocked status');
      }
    } catch (updateErr) {
      console.warn('⚠️ Error updating incidents:', updateErr);
    }

    // Create audit log
    try {
      await supabaseClient
        .from('audit_logs')
        .insert({
          user_id: user.id,
          action: 'block',
          resource_type: 'blocked_domains',
          resource_id: blockedDomain.id,
          new_values: blockedDomain,
          ip_address: req.headers.get('x-forwarded-for') || 'unknown'
        });
    } catch (auditError) {
      console.warn('⚠️ Failed to create audit log:', auditError);
    }

    // Here you would integrate with your actual network blocking system
    // For example: firewall rules, DNS blocking, proxy configuration
    console.log('🛡️ TODO: Integrate with network blocking system for domain:', domain);

    return new Response(
      JSON.stringify({ 
        success: true, 
        blocked_domain: {
          id: blockedDomain.id,
          domain: blockedDomain.domain,
          reason: blockedDomain.reason,
          blocked_at: blockedDomain.created_at,
          expires_at: blockedDomain.expires_at
        }
      }),
      { 
        status: 201, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Unexpected error in block-domain:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});