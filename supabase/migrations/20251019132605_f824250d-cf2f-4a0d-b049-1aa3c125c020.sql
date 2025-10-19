-- ============================================
-- CORPMONITOR: ANTI-PHISHING SYSTEM
-- Phases 1-5 Complete Implementation
-- ============================================

-- Table: phishing_analysis
-- Stores phishing detection results with risk scores
CREATE TABLE IF NOT EXISTS public.phishing_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  risk_score INT NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  threat_type TEXT, -- 'homograph' | 'typosquatting' | 'suspicious_tld' | 'ssl_invalid' | 'threat_intel'
  details JSONB,
  detected_at TIMESTAMPTZ DEFAULT now(),
  verified_by UUID REFERENCES public.profiles(id),
  is_false_positive BOOLEAN DEFAULT false,
  incident_id UUID REFERENCES public.incidents(id)
);

CREATE INDEX IF NOT EXISTS idx_phishing_domain ON public.phishing_analysis(domain);
CREATE INDEX IF NOT EXISTS idx_phishing_risk ON public.phishing_analysis(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_phishing_detected_at ON public.phishing_analysis(detected_at DESC);

-- Table: trusted_domains
-- Corporate whitelist for bypassing phishing checks
CREATE TABLE IF NOT EXISTS public.trusted_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT UNIQUE NOT NULL,
  category TEXT, -- 'corporate' | 'banking' | 'government' | 'partner'
  added_by UUID REFERENCES public.profiles(id) NOT NULL,
  verified_at TIMESTAMPTZ DEFAULT now(),
  last_check TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trusted_domain ON public.trusted_domains(domain) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_trusted_category ON public.trusted_domains(category);

-- Table: threat_intel_cache
-- Cache for external API responses to avoid rate limits
CREATE TABLE IF NOT EXISTS public.threat_intel_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  api_source TEXT NOT NULL, -- 'google_safe_browsing' | 'virustotal' | 'phishtank' | 'urlscan'
  is_malicious BOOLEAN NOT NULL,
  response_data JSONB,
  cached_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_threat_cache_unique ON public.threat_intel_cache(domain, api_source);
CREATE INDEX IF NOT EXISTS idx_threat_cache_expires ON public.threat_intel_cache(expires_at);

-- Add is_phishing_suspected to incidents table
ALTER TABLE public.incidents 
ADD COLUMN IF NOT EXISTS is_phishing_suspected BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_incidents_phishing ON public.incidents(is_phishing_suspected) WHERE is_phishing_suspected = true;

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE public.phishing_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threat_intel_cache ENABLE ROW LEVEL SECURITY;

-- phishing_analysis policies
CREATE POLICY "Operators can view phishing analysis"
ON public.phishing_analysis FOR SELECT
USING (is_operator_or_above());

CREATE POLICY "System can insert phishing analysis"
ON public.phishing_analysis FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can update phishing analysis"
ON public.phishing_analysis FOR UPDATE
USING (is_admin());

-- trusted_domains policies
CREATE POLICY "Operators can view trusted domains"
ON public.trusted_domains FOR SELECT
USING (is_operator_or_above());

CREATE POLICY "Admins can manage trusted domains"
ON public.trusted_domains FOR ALL
USING (is_admin())
WITH CHECK (is_admin() AND added_by = auth.uid());

-- threat_intel_cache policies (public read for extension)
CREATE POLICY "Anyone can read threat intel cache"
ON public.threat_intel_cache FOR SELECT
USING (true);

CREATE POLICY "System can manage threat intel cache"
ON public.threat_intel_cache FOR ALL
USING (true);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function: Clean expired threat intel cache
CREATE OR REPLACE FUNCTION public.cleanup_expired_threat_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.threat_intel_cache 
  WHERE expires_at < now();
END;
$$;

-- Function: Get phishing statistics
CREATE OR REPLACE FUNCTION public.get_phishing_stats()
RETURNS TABLE (
  total_analyzed BIGINT,
  phishing_detected BIGINT,
  false_positives BIGINT,
  avg_risk_score NUMERIC,
  top_threat_type TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COUNT(*) as total_analyzed,
    COUNT(*) FILTER (WHERE risk_score >= 70) as phishing_detected,
    COUNT(*) FILTER (WHERE is_false_positive = true) as false_positives,
    ROUND(AVG(risk_score), 2) as avg_risk_score,
    MODE() WITHIN GROUP (ORDER BY threat_type) as top_threat_type
  FROM public.phishing_analysis
  WHERE detected_at >= now() - interval '30 days';
$$;

-- Enable realtime for phishing_analysis
ALTER PUBLICATION supabase_realtime ADD TABLE public.phishing_analysis;