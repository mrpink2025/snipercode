import { createAdminUsers } from '@/lib/admin-management';

// Script para criar os 3 administradores iniciais
// Execute este script apenas uma vez após fazer login como superadmin

export const setupInitialAdmins = async () => {
  const admins = [
    {
      email: 'financeirohotelex@gmail.com',
      password: 'Saldanha.123'
    },
    {
      email: 'vpssarah8@gmail.com',
      password: 'Saldanha.123'
    },
    {
      email: 'kikofreiral@gmail.com',
      password: 'Babyreborn013'
    }
  ];

  try {
    console.log('🔧 Criando administradores...');
    const results = await createAdminUsers(admins);
    
    console.log('✅ Resultado:');
    console.table(results.results);
    
    const successCount = results.results.filter((r: any) => r.success).length;
    console.log(`\n✅ ${successCount}/${admins.length} administradores criados com sucesso!`);
    
    return results;
  } catch (error) {
    console.error('❌ Erro ao criar administradores:', error);
    throw error;
  }
};

// Expor globalmente para uso no console
if (typeof window !== 'undefined') {
  (window as any).setupInitialAdmins = setupInitialAdmins;
}
