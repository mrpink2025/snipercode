import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔧 Starting demo user creation...')
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const demoEmail = 'chrome.team.demo@corpmonitor.com'
    const demoPassword = 'ChromeDemo2024!'

    console.log('📧 Creating demo user:', demoEmail)

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users.find(u => u.email === demoEmail)

    if (existingUser) {
      console.log('✅ Demo user already exists')
      
      // Update profile to ensure role is correct
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ role: 'demo_admin' })
        .eq('id', existingUser.id)

      if (updateError) {
        console.error('❌ Error updating profile:', updateError)
        throw updateError
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Demo user already exists and was updated',
          user: {
            id: existingUser.id,
            email: existingUser.email
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create new user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: demoEmail,
      password: demoPassword,
      email_confirm: true,
      user_metadata: {
        full_name: 'Chrome Team Demo'
      }
    })

    if (createError) {
      console.error('❌ Error creating user:', createError)
      throw createError
    }

    console.log('✅ User created:', newUser.user.id)

    // Update profile to set role as demo_admin
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        role: 'demo_admin',
        full_name: 'Chrome Team Demo',
        department: 'Demo'
      })
      .eq('id', newUser.user.id)

    if (profileError) {
      console.error('❌ Error updating profile:', profileError)
      throw profileError
    }

    console.log('✅ Profile updated with demo_admin role')

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Demo user created successfully',
        user: {
          id: newUser.user.id,
          email: newUser.user.email
        },
        credentials: {
          email: demoEmail,
          password: demoPassword
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201
      }
    )

  } catch (error) {
    console.error('❌ Error in create-demo-user function:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})