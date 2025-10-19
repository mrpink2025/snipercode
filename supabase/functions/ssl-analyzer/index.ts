import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SSLAnalysisRequest {
  domain: string;
}

interface SSLAnalysisResult {
  domain: string;
  has_valid_cert: boolean;
  issued_recently: boolean;
  is_wildcard: boolean;
  issuer: string | null;
  cert_age_days: number | null;
  risk_indicators: string[];
}

async function analyzeCertificate(domain: string): Promise<SSLAnalysisResult> {
  const riskIndicators: string[] = [];
  let hasValidCert = false;
  let issuedRecently = false;
  let isWildcard = false;
  let issuer: string | null = null;
  let certAgeDays: number | null = null;
  
  try {
    // Query crt.sh for certificate transparency logs
    const response = await fetch(`https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`);
    
    if (!response.ok) {
      riskIndicators.push('certificate_lookup_failed');
      return {
        domain,
        has_valid_cert: false,
        issued_recently: false,
        is_wildcard: false,
        issuer: null,
        cert_age_days: null,
        risk_indicators: riskIndicators
      };
    }
    
    const certs = await response.json();
    
    if (!certs || certs.length === 0) {
      riskIndicators.push('no_certificate_found');
      return {
        domain,
        has_valid_cert: false,
        issued_recently: false,
        is_wildcard: false,
        issuer: null,
        cert_age_days: null,
        risk_indicators: riskIndicators
      };
    }
    
    hasValidCert = true;
    
    // Get the most recent certificate
    const recentCert = certs.sort((a: any, b: any) => 
      new Date(b.entry_timestamp).getTime() - new Date(a.entry_timestamp).getTime()
    )[0];
    
    issuer = recentCert.issuer_name;
    const issuedDate = new Date(recentCert.not_before);
    const now = new Date();
    certAgeDays = Math.floor((now.getTime() - issuedDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Check if issued in last 30 days
    if (certAgeDays <= 30) {
      issuedRecently = true;
      riskIndicators.push('certificate_issued_recently');
    }
    
    // Check for wildcard certificate
    if (recentCert.name_value && recentCert.name_value.includes('*.')) {
      isWildcard = true;
      riskIndicators.push('wildcard_certificate');
    }
    
    // Check for self-signed or suspicious issuers
    const suspiciousIssuers = ['self-signed', 'unknown', 'localhost'];
    if (issuer && suspiciousIssuers.some(si => issuer.toLowerCase().includes(si))) {
      riskIndicators.push('suspicious_certificate_issuer');
    }
    
    // Check for Let's Encrypt (common in phishing due to ease of obtaining)
    if (issuer && issuer.toLowerCase().includes("let's encrypt")) {
      // Not necessarily malicious, but combined with other factors can be suspicious
      riskIndicators.push('letsencrypt_cert');
    }
    
  } catch (error) {
    console.error('SSL analysis error:', error);
    riskIndicators.push('analysis_error');
  }
  
  return {
    domain,
    has_valid_cert: hasValidCert,
    issued_recently: issuedRecently,
    is_wildcard: isWildcard,
    issuer,
    cert_age_days: certAgeDays,
    risk_indicators: riskIndicators
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { domain }: SSLAnalysisRequest = await req.json();
    
    if (!domain) {
      return new Response(
        JSON.stringify({ error: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Analyzing SSL for domain: ${domain}`);
    
    const analysis = await analyzeCertificate(domain);
    
    console.log(`SSL analysis complete for ${domain}:`, analysis);
    
    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in ssl-analyzer:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});