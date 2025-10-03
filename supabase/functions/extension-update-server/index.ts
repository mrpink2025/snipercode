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

    // Parse query parameters to detect requesting version
    const url = new URL(req.url);
    const requestVersion = url.searchParams.get('v') || '1.0.0';
    const extensionId = url.searchParams.get('id') || 'unknown';
    
    console.log(`Update check from extension ${extensionId}, version ${requestVersion}`);

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

    const baseVersion = settings?.extension_version || '2.0.0';
    const updateUrl = 'https://vxvcquifgwtbjghrcjbp.supabase.co/storage/v1/object/public/extensions';
    const autoUpdateEnabled = settings?.auto_update_enabled ?? true;
    const forceUpdateVersion = settings?.force_update_version;
    const enableEnterpriseUpdate = settings?.enable_enterprise_update ?? false;
    
    // Determine target version based on strategy
    let targetVersion = baseVersion;
    let shouldUpdate = false;
    
    // Check if this is Store version (1.x) requesting update to Enterprise (2.x)
    const isStoreVersion = requestVersion.startsWith('1.');
    const isEnterpriseVersion = requestVersion.startsWith('2.');
    
    if (enableEnterpriseUpdate && isStoreVersion) {
      // Upgrade Store to Enterprise
      targetVersion = forceUpdateVersion || '2.0.0';
      shouldUpdate = true;
      console.log(`Triggering Store → Enterprise upgrade: ${requestVersion} → ${targetVersion}`);
    } else if (isEnterpriseVersion && forceUpdateVersion) {
      // Update within Enterprise versions
      const currentMajor = parseInt(requestVersion.split('.')[0]);
      const targetMajor = parseInt(forceUpdateVersion.split('.')[0]);
      
      if (targetMajor >= currentMajor) {
        targetVersion = forceUpdateVersion;
        shouldUpdate = true;
        console.log(`Enterprise version update: ${requestVersion} → ${targetVersion}`);
      }
    }
    
    // Generate SHA256 hash placeholder (in production, use actual CRX hash)
    const hash = `sha256hash_${targetVersion.replace(/\./g, '_')}`;
    
    console.log(`Serving update manifest: auto=${autoUpdateEnabled}, should_update=${shouldUpdate}, target=${targetVersion}`);

    // Generate the Google Update XML response
    let updateCheckTag;
    if (autoUpdateEnabled && shouldUpdate) {
      updateCheckTag = `<updatecheck codebase='${updateUrl}/corpmonitor-enterprise-${targetVersion}.crx' version='${targetVersion}' hash_sha256='${hash}' />`;
    } else {
      updateCheckTag = `<updatecheck status="noupdate" />`;
    }
    
    const xml = `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='corpmonitor-extension'>
    ${updateCheckTag}
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