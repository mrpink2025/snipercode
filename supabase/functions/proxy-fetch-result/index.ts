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
    console.log(`📊 [ProxyFetch] HTML size: ${html_content?.length || 0} bytes, URL: ${url}`);

    // ✅ CORREÇÃO #9: Validação e truncamento se necessário
    let finalHtmlContent = html_content;
    let wasTruncated = false;

    if (html_content && html_content.length > 5000000) {
      // Limitar a 5MB
      console.warn(`⚠️ [ProxyFetch] HTML muito grande (${html_content.length} bytes), truncando para 5MB`);
      finalHtmlContent = html_content.substring(0, 5000000) + '\n\n<!-- TRUNCADO POR TAMANHO -->';
      wasTruncated = true;
    } else if (html_content && html_content.length > 100000) {
      console.warn(`⚠️ [ProxyFetch] Large HTML detected: ${html_content.length} bytes`);
    }

    // 1. Insert result into proxy_fetch_results
    const { data: resultData, error: insertError } = await supabase
      .from('proxy_fetch_results')
      .insert({
        command_id,
        machine_id,
        url,
        html_content: finalHtmlContent,
        status_code,
        success,
        error
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error inserting proxy-fetch result:', insertError);
      console.error('❌ Insert error details:', JSON.stringify(insertError, null, 2));
      throw insertError;
    }
    
    console.log(`✅ [ProxyFetch] Inserted result with ID: ${resultData.id}`);

    // 2. Update remote_commands status
    // Check if it's a protected domain (stealth mode)
    const isProtectedDomain = url.includes('google.com') || 
                              url.includes('microsoft.com') ||
                              url.includes('facebook.com');
    
    const { error: updateError } = await supabase
      .from('remote_commands')
      .update({
        status: success ? 'completed' : 'failed',
        response: { 
          result_id: resultData.id, 
          success, 
          error,
          protected_domain: isProtectedDomain,
          stealth_mode: isProtectedDomain
        }
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
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', JSON.stringify({
      message: error.message,
      name: error.name,
      cause: error.cause
    }, null, 2));
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
