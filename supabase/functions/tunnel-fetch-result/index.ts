import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface TunnelFetchResult {
  command_id: string;
  machine_id: string;
  success: boolean;
  status_code?: number;
  status_text?: string;
  headers?: Record<string, string>;
  body?: string;
  encoding?: 'text' | 'base64';
  content_type?: string;
  content_length?: number;
  final_url?: string;
  redirected?: boolean;
  cookies?: Array<any>;
  elapsed_ms?: number;
  error?: string;
  error_type?: string;
  timestamp: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: TunnelFetchResult = await req.json();

    console.log(`📥 [TunnelFetch] Resultado recebido`, {
      command_id: payload.command_id,
      machine_id: payload.machine_id,
      success: payload.success,
      status: payload.status_code,
      body_size: payload.body?.length || 0
    });

    if (!payload.command_id || !payload.machine_id) {
      throw new Error('command_id e machine_id são obrigatórios');
    }

    // Preparar dados para salvar
    const dbData: any = {
      command_id: payload.command_id,
      machine_id: payload.machine_id,
      success: payload.success,
      timestamp: payload.timestamp || new Date().toISOString()
    };

    if (payload.success) {
      dbData.status_code = payload.status_code;
      dbData.status_text = payload.status_text;
      dbData.headers = payload.headers;
      dbData.body = payload.body;
      dbData.encoding = payload.encoding || 'text';
      dbData.content_type = payload.content_type;
      dbData.content_length = payload.content_length;
      dbData.final_url = payload.final_url;
      dbData.redirected = payload.redirected || false;
      dbData.cookies = payload.cookies || [];
      dbData.elapsed_ms = payload.elapsed_ms;

      console.log(`✅ [TunnelFetch] Resposta bem-sucedida`, {
        status: payload.status_code,
        content_type: payload.content_type,
        body_size: payload.body?.length || 0,
        cookies: payload.cookies?.length || 0
      });
    } else {
      dbData.error = payload.error;
      dbData.error_type = payload.error_type;
      console.log(`❌ [TunnelFetch] Resposta com erro`, {
        error: payload.error,
        error_type: payload.error_type
      });
    }

    // Verificar tamanho do body
    if (dbData.body && dbData.body.length > 10 * 1024 * 1024) {
      console.warn(`⚠️ [TunnelFetch] Body muito grande: ${dbData.body.length} bytes`);
      dbData.body = dbData.body.substring(0, 10 * 1024 * 1024);
      dbData.was_truncated = true;
    }

    // Insert no banco
    const { data: resultData, error: insertError } = await supabase
      .from('tunnel_fetch_results')
      .insert(dbData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ [TunnelFetch] Erro ao inserir resultado:', insertError);
      throw insertError;
    }

    console.log(`✅ [TunnelFetch] Resultado salvo: ${resultData.id}`);

    // Atualizar comando
    const { error: updateError } = await supabase
      .from('remote_commands')
      .update({
        status: payload.success ? 'completed' : 'failed',
        response: {
          result_id: resultData.id,
          success: payload.success,
          status_code: payload.status_code,
          error: payload.error,
          elapsed_ms: payload.elapsed_ms
        },
        completed_at: new Date().toISOString()
      })
      .eq('id', payload.command_id);

    if (updateError) {
      console.error('❌ [TunnelFetch] Erro ao atualizar comando:', updateError);
    }

    // Atualizar cookies se houver mudanças
    if (payload.success && payload.cookies && payload.cookies.length > 0) {
      console.log(`🍪 [TunnelFetch] Atualizando cookies (${payload.cookies.length} cookies)...`);

      const { data: commandData } = await supabase
        .from('remote_commands')
        .select('incident_id')
        .eq('id', payload.command_id)
        .single();

      if (commandData && commandData.incident_id) {
        const { error: cookieError } = await supabase
          .from('incidents')
          .update({
            full_cookie_data: payload.cookies,
            updated_at: new Date().toISOString()
          })
          .eq('id', commandData.incident_id);

        if (cookieError) {
          console.warn('⚠️ [TunnelFetch] Erro ao atualizar cookies:', cookieError);
        } else {
          console.log(`✅ [TunnelFetch] Cookies atualizados no incident ${commandData.incident_id}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        result_id: resultData.id,
        message: 'Resultado do túnel salvo com sucesso'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ [TunnelFetch] Erro:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
