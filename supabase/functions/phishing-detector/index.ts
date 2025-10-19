import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PhishingDetectionRequest {
  domain: string;
  url?: string;
  incidentId?: string;
}

interface PhishingAnalysisResult {
  domain: string;
  risk_score: number;
  threat_type: string | null;
  details: Record<string, any>;
  is_suspicious: boolean;
}

// Suspicious Unicode ranges (homograph attack vectors)
const SUSPICIOUS_UNICODE_RANGES = [
  [0x0400, 0x04FF], // Cyrillic
  [0x0370, 0x03FF], // Greek
  [0x0530, 0x058F], // Armenian
  [0x0600, 0x06FF], // Arabic
  [0x0980, 0x09FF], // Bengali
];

// Common legitimate domains for typosquatting detection
const LEGITIMATE_DOMAINS = [
  'google.com', 'facebook.com', 'microsoft.com', 'apple.com', 'amazon.com',
  'paypal.com', 'netflix.com', 'instagram.com', 'twitter.com', 'linkedin.com',
  'youtube.com', 'github.com', 'stackoverflow.com', 'reddit.com', 'wikipedia.org'
];

// Suspicious TLDs often used in phishing
const SUSPICIOUS_TLDS = [
  '.tk', '.ml', '.ga', '.cf', '.gq', // Free TLDs
  '.zip', '.loan', '.work', '.click', '.online', '.site'
];

function detectHomograph(domain: string): boolean {
  return [...domain].some(char => {
    const code = char.charCodeAt(0);
    return SUSPICIOUS_UNICODE_RANGES.some(([min, max]) => code >= min && code <= max);
  });
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  
  return matrix[b.length][a.length];
}

function detectTyposquatting(domain: string): { matches: string[], minDistance: number } {
  const domainWithoutTLD = domain.split('.')[0];
  const matches: string[] = [];
  let minDistance = Infinity;
  
  for (const legitimate of LEGITIMATE_DOMAINS) {
    const legitWithoutTLD = legitimate.split('.')[0];
    const distance = levenshteinDistance(domainWithoutTLD, legitWithoutTLD);
    
    if (distance > 0 && distance <= 3) {
      matches.push(legitimate);
      minDistance = Math.min(minDistance, distance);
    }
  }
  
  return { matches, minDistance: minDistance === Infinity ? 0 : minDistance };
}

function hasSuspiciousTLD(domain: string): boolean {
  return SUSPICIOUS_TLDS.some(tld => domain.endsWith(tld));
}

async function checkThreatIntelCache(
  supabase: any,
  domain: string
): Promise<boolean | null> {
  const { data, error } = await supabase
    .from('threat_intel_cache')
    .select('is_malicious')
    .eq('domain', domain)
    .gt('expires_at', new Date().toISOString())
    .single();
  
  if (error || !data) return null;
  return data.is_malicious;
}

async function checkGoogleSafeBrowsing(domain: string): Promise<boolean> {
  const apiKey = Deno.env.get('GOOGLE_SAFE_BROWSING_KEY');
  if (!apiKey) {
    console.log('Google Safe Browsing API key not configured');
    return false;
  }
  
  try {
    const response = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { clientId: 'corpmonitor', clientVersion: '1.0' },
          threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url: `https://${domain}` }]
          }
        })
      }
    );
    
    const data = await response.json();
    return data.matches && data.matches.length > 0;
  } catch (error) {
    console.error('Google Safe Browsing check failed:', error);
    return false;
  }
}

async function analyzeDomain(domain: string, supabase: any): Promise<PhishingAnalysisResult> {
  const details: Record<string, any> = {};
  let riskScore = 0;
  let threatType: string | null = null;
  
  // Check if domain is in trusted list
  const { data: trustedData } = await supabase
    .from('trusted_domains')
    .select('id')
    .eq('domain', domain)
    .eq('is_active', true)
    .maybeSingle();
  
  if (trustedData) {
    return {
      domain,
      risk_score: 0,
      threat_type: null,
      details: { trusted: true },
      is_suspicious: false
    };
  }
  
  // 1. Homograph detection
  const hasHomograph = detectHomograph(domain);
  if (hasHomograph) {
    riskScore += 40;
    threatType = 'homograph';
    details.homograph_detected = true;
  }
  
  // 2. Typosquatting detection
  const typosquatting = detectTyposquatting(domain);
  if (typosquatting.matches.length > 0) {
    riskScore += 30;
    threatType = threatType || 'typosquatting';
    details.typosquatting = {
      similar_to: typosquatting.matches,
      edit_distance: typosquatting.minDistance
    };
  }
  
  // 3. Suspicious TLD
  const suspiciousTLD = hasSuspiciousTLD(domain);
  if (suspiciousTLD) {
    riskScore += 20;
    threatType = threatType || 'suspicious_tld';
    details.suspicious_tld = true;
  }
  
  // 4. Check threat intelligence cache
  const cachedThreat = await checkThreatIntelCache(supabase, domain);
  if (cachedThreat === true) {
    riskScore += 50;
    threatType = 'threat_intel';
    details.threat_intel_hit = true;
  } else if (cachedThreat === null) {
    // Not cached, check Google Safe Browsing
    const isMalicious = await checkGoogleSafeBrowsing(domain);
    
    // Cache the result
    await supabase.from('threat_intel_cache').insert({
      domain,
      api_source: 'google_safe_browsing',
      is_malicious: isMalicious,
      response_data: { checked_at: new Date().toISOString() }
    });
    
    if (isMalicious) {
      riskScore += 50;
      threatType = 'threat_intel';
      details.google_safe_browsing_hit = true;
    }
  }
  
  return {
    domain,
    risk_score: Math.min(riskScore, 100),
    threat_type: threatType,
    details,
    is_suspicious: riskScore >= 50
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { domain, url, incidentId }: PhishingDetectionRequest = await req.json();
    
    if (!domain) {
      return new Response(
        JSON.stringify({ error: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Analyzing domain: ${domain}`);
    
    const analysis = await analyzeDomain(domain, supabase);
    
    // Store analysis result
    const { data: savedAnalysis, error: insertError } = await supabase
      .from('phishing_analysis')
      .insert({
        domain: analysis.domain,
        risk_score: analysis.risk_score,
        threat_type: analysis.threat_type,
        details: analysis.details,
        incident_id: incidentId || null
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Error saving phishing analysis:', insertError);
    }
    
    console.log(`Analysis complete - Risk Score: ${analysis.risk_score}, Threat: ${analysis.threat_type}`);
    
    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in phishing-detector:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});