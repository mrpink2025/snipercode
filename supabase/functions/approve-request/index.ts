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

    const { requestId, approved, comments } = await req.json();

    console.log('⚖️ Processing approval:', { requestId, approved, approver: user.id });

    // Validate required fields
    if (!requestId || approved === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: requestId, approved' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has approver permissions
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role, is_active, full_name')
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

    const allowedRoles = ['approver', 'admin'];
    if (!allowedRoles.includes(userProfile.role)) {
      return new Response(
        JSON.stringify({ error: 'Only approvers and admins can process requests' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the cookie request
    const { data: cookieRequest, error: requestError } = await supabaseClient
      .from('raw_cookie_requests')
      .select(`
        *,
        incident:incidents(id, incident_id, host),
        requester:profiles!raw_cookie_requests_requested_by_fkey(full_name, email)
      `)
      .eq('id', requestId)
      .single();

    if (requestError || !cookieRequest) {
      return new Response(
        JSON.stringify({ error: 'Cookie request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if request is still pending
    if (cookieRequest.approval_status !== 'pending') {
      return new Response(
        JSON.stringify({ 
          error: `Request has already been ${cookieRequest.approval_status}` 
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if request has expired
    if (cookieRequest.expires_at && new Date(cookieRequest.expires_at) < new Date()) {
      await supabaseClient
        .from('raw_cookie_requests')
        .update({ approval_status: 'expired' })
        .eq('id', requestId);

      return new Response(
        JSON.stringify({ error: 'Request has expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the cookie request
    const newStatus = approved ? 'approved' : 'rejected';
    const { data: updatedRequest, error: updateError } = await supabaseClient
      .from('raw_cookie_requests')
      .update({
        approval_status: newStatus,
        approved_by: user.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select('*')
      .single();

    if (updateError) {
      console.error('❌ Error updating request:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create or update approval record
    const { error: approvalError } = await supabaseClient
      .from('approvals')
      .upsert({
        resource_type: 'cookie_request',
        resource_id: requestId,
        requested_by: cookieRequest.requested_by,
        approver_id: user.id,
        approval_status: newStatus,
        comments: comments || null,
        approved_at: approved ? new Date().toISOString() : null
      });

    if (approvalError) {
      console.warn('⚠️ Failed to create approval record:', approvalError);
    }

    // If approved, update the related incident status
    if (approved && cookieRequest.incident) {
      try {
        await supabaseClient
          .from('incidents')
          .update({ status: 'approved' })
          .eq('id', cookieRequest.incident.id);
        
        console.log('📝 Updated incident status to approved');
      } catch (incidentUpdateError) {
        console.warn('⚠️ Failed to update incident status:', incidentUpdateError);
      }
    }

    console.log(`✅ Request ${approved ? 'approved' : 'rejected'} successfully`);

    // Create audit log
    try {
      await supabaseClient
        .from('audit_logs')
        .insert({
          user_id: user.id,
          action: approved ? 'approve' : 'reject',
          resource_type: 'raw_cookie_requests',
          resource_id: requestId,
          old_values: cookieRequest,
          new_values: updatedRequest,
          ip_address: req.headers.get('x-forwarded-for') || 'unknown'
        });
    } catch (auditError) {
      console.warn('⚠️ Failed to create audit log:', auditError);
    }

    // TODO: Send notification email to requester
    // You could integrate with Resend here to send an email notification

    return new Response(
      JSON.stringify({ 
        success: true, 
        approval: {
          request_id: requestId,
          status: newStatus,
          approved_by: userProfile.full_name,
          approved_at: updatedRequest.approved_at,
          comments: comments,
          incident_id: cookieRequest.incident?.incident_id
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Unexpected error in approve-request:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});