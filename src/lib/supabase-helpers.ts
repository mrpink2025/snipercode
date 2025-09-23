import { supabase } from '@/integrations/supabase/client';
import type { IncidentSeverity, IncidentStatus } from '@/hooks/useIncidents';

export interface KPIData {
  totalIncidents: number;
  activeIncidents: number;
  blockedDomains: number;
  pendingApprovals: number;
  severityBreakdown: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  statusBreakdown: {
    new: number;
    inProgress: number;
    blocked: number;
    approved: number;
    resolved: number;
  };
  recentActivity: {
    date: string;
    incidents: number;
  }[];
}

export const getKPIData = async (): Promise<KPIData> => {
  try {
    // Get incident counts by status
    const { data: incidentCounts, error: incidentError } = await supabase
      .from('incidents')
      .select('status, severity, created_at');

    if (incidentError) {
      throw incidentError;
    }

    // Get blocked domains count
    const { count: blockedDomainsCount, error: domainsError } = await supabase
      .from('blocked_domains')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (domainsError) {
      throw domainsError;
    }

    // Get pending approvals count
    const { count: pendingApprovalsCount, error: approvalsError } = await supabase
      .from('approvals')
      .select('*', { count: 'exact', head: true })
      .eq('approval_status', 'pending');

    if (approvalsError) {
      throw approvalsError;
    }

    const incidents = incidentCounts || [];
    const totalIncidents = incidents.length;
    const activeIncidents = incidents.filter(i => !['resolved', 'approved'].includes(i.status)).length;

    // Calculate severity breakdown
    const severityBreakdown = {
      low: incidents.filter(i => i.severity === 'low').length,
      medium: incidents.filter(i => i.severity === 'medium').length,
      high: incidents.filter(i => i.severity === 'high').length,
      critical: incidents.filter(i => i.severity === 'critical').length,
    };

    // Calculate status breakdown
    const statusBreakdown = {
      new: incidents.filter(i => i.status === 'new').length,
      inProgress: incidents.filter(i => i.status === 'in-progress').length,
      blocked: incidents.filter(i => i.status === 'blocked').length,
      approved: incidents.filter(i => i.status === 'approved').length,
      resolved: incidents.filter(i => i.status === 'resolved').length,
    };

    // Calculate recent activity (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    const recentActivity = last7Days.map(date => {
      const dayIncidents = incidents.filter(incident => 
        incident.created_at.startsWith(date)
      ).length;
      
      return {
        date,
        incidents: dayIncidents
      };
    });

    return {
      totalIncidents,
      activeIncidents,
      blockedDomains: blockedDomainsCount || 0,
      pendingApprovals: pendingApprovalsCount || 0,
      severityBreakdown,
      statusBreakdown,
      recentActivity
    };
  } catch (error) {
    console.error('Error fetching KPI data:', error);
    
    // Return default/mock data if there's an error
    return {
      totalIncidents: 0,
      activeIncidents: 0,
      blockedDomains: 0,
      pendingApprovals: 0,
      severityBreakdown: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      },
      statusBreakdown: {
        new: 0,
        inProgress: 0,
        blocked: 0,
        approved: 0,
        resolved: 0
      },
      recentActivity: []
    };
  }
};

export const blockDomain = async (domain: string, reason: string): Promise<void> => {
  const { error } = await supabase.functions.invoke('block-domain', {
    body: { domain, reason }
  });

  if (error) {
    throw new Error(`Erro ao bloquear domínio: ${error.message}`);
  }
};

export const createRawCookieRequest = async (
  incidentId: string, 
  justification: string
): Promise<void> => {
  const { error } = await supabase
    .from('raw_cookie_requests')
    .insert({
      incident_id: incidentId,
      justification,
      requested_by: (await supabase.auth.getUser()).data.user?.id,
    });

  if (error) {
    throw new Error(`Erro ao criar solicitação: ${error.message}`);
  }
};

export const approveRequest = async (
  requestId: string,
  approved: boolean,
  comments?: string
): Promise<void> => {
  const { error } = await supabase.functions.invoke('approve-request', {
    body: { requestId, approved, comments }
  });

  if (error) {
    throw new Error(`Erro ao processar aprovação: ${error.message}`);
  }
};

export const getAuditTrail = async (resourceId?: string, limit = 50) => {
  let query = supabase
    .from('audit_logs')
    .select(`
      *,
      user:profiles(full_name, email)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (resourceId) {
    query = query.eq('resource_id', resourceId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao buscar logs de auditoria: ${error.message}`);
  }

  return data || [];
};

// Helper to format incident severity for display
export const formatSeverity = (severity: IncidentSeverity): string => {
  const severityMap = {
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta',
    critical: 'Crítica'
  };
  return severityMap[severity] || severity;
};

// Helper to format incident status for display  
export const formatStatus = (status: IncidentStatus): string => {
  const statusMap = {
    new: 'Novo',
    'in-progress': 'Em Andamento',
    blocked: 'Bloqueado',
    approved: 'Aprovado',
    resolved: 'Resolvido'
  };
  return statusMap[status] || status;
};

// Helper to get severity color
export const getSeverityColor = (severity: IncidentSeverity): string => {
  const colorMap = {
    low: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
    medium: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
    high: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
    critical: 'bg-red-500/10 text-red-700 border-red-500/20'
  };
  return colorMap[severity] || colorMap.medium;
};

// Helper to get status color
export const getStatusColor = (status: IncidentStatus): string => {
  const colorMap = {
    new: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
    'in-progress': 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
    blocked: 'bg-red-500/10 text-red-700 border-red-500/20',
    approved: 'bg-green-500/10 text-green-700 border-green-500/20',
    resolved: 'bg-gray-500/10 text-gray-700 border-gray-500/20'
  };
  return colorMap[status] || colorMap.new;
};