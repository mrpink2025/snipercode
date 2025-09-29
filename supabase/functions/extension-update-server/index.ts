import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    // Get extension settings
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .maybeSingle()

    if (error) {
      console.error('Error fetching settings:', error)
      throw error
    }

    const version = settings?.extension_version || '1.0.0';
    const updateUrl = settings?.extension_update_url || 'https://vxvcquifgwtbjghrcjbp.supabase.co/functions/v1/extension-update-server';
    const autoUpdateEnabled = settings?.auto_update_enabled ?? true;
    const forceUpdateVersion = settings?.force_update_version;
    
    // Use force update version if specified, otherwise use current version
    const targetVersion = forceUpdateVersion || version;
    
    // Generate SHA256 hash placeholder (in real implementation, this would be the actual hash of the CRX file)
    const hash = `sha256hash_${targetVersion.replace(/\./g, '_')}`;
    
    console.log(`Serving update manifest for version ${targetVersion}, auto-update: ${autoUpdateEnabled}`);

    // Generate the Google Update XML response
    const xml = `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='corpmonitor-extension'>
    <updatecheck ${autoUpdateEnabled ? `codebase='${updateUrl}/corpmonitor-${targetVersion}.crx' version='${targetVersion}' hash_sha256='${hash}'` : 'status="noupdate"'} />
  </app>
</gupdate>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      status: 200,
    });

  } catch (error) {
    console.error('Extension update server error:', error)
    
    // Fallback XML response
    const fallbackXml = `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='corpmonitor-extension'>
    <updatecheck status="noupdate" />
  </app>
</gupdate>`;
    
    return new Response(fallbackXml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
        'Cache-Control': 'no-cache'
      },
      status: 200, // Still return 200 for XML compatibility
    })
  }
})