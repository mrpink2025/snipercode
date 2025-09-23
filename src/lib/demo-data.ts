import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const createSampleIncidents = async () => {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    const sampleIncidents = [
      {
        host: 'facebook.com',
        machine_id: 'WKS-001-DEV',
        user_id: user.id,
        tab_url: 'https://facebook.com/login',
        severity: 'critical' as const,
        cookie_excerpt: 'session_id=fb_abc123456...',
        full_cookie_data: {
          sessionId: 'fb_abc123456',
          userId: '1234567890',
          expiresAt: '2024-12-31T23:59:59Z'
        },
        is_red_list: true
      },
      {
        host: 'instagram.com',
        machine_id: 'WKS-002-MKT',
        user_id: user.id,
        tab_url: 'https://instagram.com/explore',
        severity: 'high' as const,
        cookie_excerpt: 'auth_token=ig_xyz789...',
        full_cookie_data: {
          authToken: 'ig_xyz789',
          deviceId: 'mobile_123',
          lastLogin: '2024-03-15T14:28:42Z'
        },
        is_red_list: false
      },
      {
        host: 'github.com',
        machine_id: 'WKS-001-DEV',
        user_id: user.id,
        tab_url: 'https://github.com/repos',
        severity: 'medium' as const,
        cookie_excerpt: '_gh_sess=github_normal123...',
        full_cookie_data: {
          sessionToken: 'github_normal123',
          csrfToken: 'csrf_456',
          twoFactorAuth: 'enabled'
        },
        is_red_list: false
      },
      {
        host: 'stackoverflow.com',
        machine_id: 'WKS-004-DEV',
        user_id: user.id,
        tab_url: 'https://stackoverflow.com/questions',
        severity: 'low' as const,
        cookie_excerpt: 'so_session=work456...',
        full_cookie_data: {
          sessionId: 'work456',
          preferences: { theme: 'dark', language: 'pt-BR' }
        },
        is_red_list: false
      }
    ];

    console.log('🎬 Creating sample incidents...');
    
    // Create incidents using the edge function for proper handling
    const results = [];
    for (const incident of sampleIncidents) {
      try {
        const { data, error } = await supabase.functions.invoke('create-incident', {
          body: incident
        });

        if (error) {
          console.error('Error creating incident:', error);
          continue;
        }

        results.push(data.incident);
        console.log('✅ Created incident:', data.incident?.incident_id);
      } catch (err) {
        console.error('Error invoking create-incident:', err);
      }
    }

    console.log('✅ Sample incidents created:', results);
    
    toast.success('Incidentes de exemplo criados com sucesso!', {
      description: `${results.length} incidentes adicionados para demonstração`
    });

    return results;
  } catch (error) {
    console.error('❌ Error creating sample incidents:', error);
    toast.error('Erro ao criar incidentes de exemplo', {
      description: error instanceof Error ? error.message : 'Erro desconhecido'
    });
    throw error;
  }
};

export const createSampleBlockedDomains = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    const sampleDomains = [
      {
        domain: 'malicious-site.com',
        reason: 'Domínio conhecido por phishing e malware',
        blocked_by: user.id,
        is_active: true
      },
      {
        domain: 'suspicious-ads.net',
        reason: 'Rede de publicidade maliciosa',
        blocked_by: user.id,
        is_active: true
      },
      {
        domain: 'fake-bank.org',
        reason: 'Site de phishing imitando banco legítimo',
        blocked_by: user.id,
        is_active: true
      }
    ];

    const { data, error } = await supabase
      .from('blocked_domains')
      .insert(sampleDomains)
      .select('domain');

    if (error) {
      throw error;
    }

    toast.success('Domínios bloqueados de exemplo criados!', {
      description: `${data?.length || 0} domínios adicionados à lista de bloqueio`
    });

    return data;
  } catch (error) {
    console.error('❌ Error creating sample blocked domains:', error);
    toast.error('Erro ao criar domínios bloqueados de exemplo');
    throw error;
  }
};

export const initializeDemoData = async () => {
  try {
    console.log('🚀 Initializing demo data...');
    
    await Promise.all([
      createSampleIncidents(),
      createSampleBlockedDomains()
    ]);

    toast.success('Sistema inicializado com dados de demonstração!', {
      description: 'Dados de exemplo criados para explorar o sistema'
    });
  } catch (error) {
    console.error('❌ Error initializing demo data:', error);
  }
};