import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdminUser {
  email: string;
  password: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verificar se o usuário atual é superadmin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é superadmin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'superadmin') {
      return new Response(
        JSON.stringify({ error: 'Apenas superadmin pode criar novos administradores' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { users } = await req.json() as { users: AdminUser[] };

    if (!Array.isArray(users) || users.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Lista de usuários inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const adminUser of users) {
      try {
        // Criar usuário no Auth
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: adminUser.email,
          password: adminUser.password,
          email_confirm: true,
          user_metadata: {
            full_name: adminUser.email.split('@')[0]
          }
        });

        if (createError) {
          results.push({
            email: adminUser.email,
            success: false,
            error: createError.message
          });
          continue;
        }

        // Atualizar perfil para admin
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', newUser.user.id);

        if (updateError) {
          results.push({
            email: adminUser.email,
            success: false,
            error: `Usuário criado mas erro ao atualizar perfil: ${updateError.message}`
          });
          continue;
        }

        results.push({
          email: adminUser.email,
          success: true,
          userId: newUser.user.id
        });
      } catch (error) {
        results.push({
          email: adminUser.email,
          success: false,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
