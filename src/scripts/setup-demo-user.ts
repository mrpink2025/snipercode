import { supabase } from '@/integrations/supabase/client';

// Script para criar o usuário demo admin
// Execute no console do navegador após fazer login como superadmin

export const setupDemoUser = async () => {
  try {
    console.log('🔧 Criando usuário demo admin...');
    
    const { data, error } = await supabase.functions.invoke('create-demo-user', {
      body: {}
    });

    if (error) {
      console.error('❌ Erro ao criar usuário demo:', error);
      throw error;
    }

    console.log('✅ Resultado:', data);
    
    if (data.success) {
      console.log('\n📧 Credenciais de acesso:');
      console.log('Email:', data.credentials?.email || 'chrome.team.demo@corpmonitor.com');
      console.log('Senha:', data.credentials?.password || 'ChromeDemo2024!');
      console.log('\n🎯 Funcionalidades disponíveis:');
      console.log('- ✅ Dashboard completo');
      console.log('- ✅ Incidentes (visualização, bloqueio, isolamento)');
      console.log('- ✅ Hosts Monitorados');
      console.log('- ✅ Auditoria');
      console.log('- ✅ Logs do Sistema');
      console.log('- ✅ Histórico');
      console.log('- ✅ Configurações');
      console.log('\n🚫 Funcionalidades ocultas:');
      console.log('- ❌ Remote Control (link não aparece)');
      console.log('- ❌ Ver Site (botão não aparece nos incidentes)');
    }
    
    return data;
  } catch (error) {
    console.error('❌ Erro ao criar usuário demo:', error);
    throw error;
  }
};

// Expor globalmente para uso no console
if (typeof window !== 'undefined') {
  (window as any).setupDemoUser = setupDemoUser;
}

console.log('📝 Para criar o usuário demo, execute no console: setupDemoUser()');
