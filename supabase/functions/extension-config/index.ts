import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SystemSettings {
  id: string;
  extension_update_url: string | null;
  extension_version: string | null;
  auto_update_enabled: boolean;
  update_channel: 'stable' | 'beta' | 'dev';
  force_update_version: string | null;
  rollback_version: string | null;
  updated_by: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create anon client for auth verification
    const anonSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    // Create service role client for admin verification (bypass RLS)
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    // Get user from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user }, error: authError } = await anonSupabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      console.error('Auth error:', authError)
      throw new Error('Unauthorized')
    }

    console.log('User authenticated:', user.id, user.email)

    // Check if user is admin using service role to bypass RLS
    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    console.log('Profile query result:', { profile, profileError })

    if (profileError) {
      console.error('Profile error:', profileError)
      throw new Error('Failed to verify user role')
    }

    if (!['admin','superadmin','demo_admin'].includes(profile?.role)) {
      console.error('Access denied for user:', user.email, 'Role:', profile?.role)
      throw new Error('Access denied - admin or superadmin role required')
    }

    console.log('Admin access verified for:', user.email)

    const method = req.method

    if (method === 'GET') {
      // Get current extension settings
      const { data: settings, error } = await serviceSupabase
        .from('system_settings')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle()

      if (error) {
        throw error
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: settings || {
            extension_update_url: null,
            extension_version: '1.0.0',
            auto_update_enabled: true,
            update_channel: 'stable',
            force_update_version: null,
            rollback_version: null
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    if (method === 'POST') {
      // Update extension settings
      const body = await req.json()
      
      // Validate required fields
      const {
        extension_update_url,
        extension_version,
        auto_update_enabled,
        update_channel,
        force_update_version,
        rollback_version
      } = body

      // Validate update channel
      if (update_channel && !['stable', 'beta', 'dev'].includes(update_channel)) {
        throw new Error('Invalid update channel')
      }

      // Validate URL format if provided
      if (extension_update_url) {
        try {
          new URL(extension_update_url)
        } catch {
          throw new Error('Invalid update URL format')
        }
      }

      // Update settings
      const { data, error } = await serviceSupabase
        .from('system_settings')
        .upsert({
          id: '00000000-0000-0000-0000-000000000001',
          extension_update_url,
          extension_version,
          auto_update_enabled: auto_update_enabled ?? true,
          update_channel: update_channel || 'stable',
          force_update_version,
          rollback_version,
          updated_by: user.id
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      console.log(`Extension settings updated by admin ${user.email}:`, {
        extension_update_url,
        extension_version,
        update_channel
      })

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Settings updated successfully',
          data 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      }
    )

  } catch (error) {
    console.error('Extension config error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const isUnauthorized = errorMessage.includes('Unauthorized') || errorMessage.includes('Access denied');
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: isUnauthorized ? 403 : 500,
      }
    )
  }
})