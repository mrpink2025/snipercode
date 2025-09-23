import { create } from 'zustand';

export interface Incident {
  id: string;
  host: string;
  machineId: string;
  user: string;
  timestamp: string;
  tabUrl?: string;
  severity: 'RED' | 'NORMAL';
  cookieExcerpt: string;
  status: 'new' | 'in-progress' | 'blocked' | 'approved';
  isRedList?: boolean;
}

interface AppState {
  incidents: Incident[];
  searchTerm: string;
  severityFilter: string;
  statusFilter: string;
  darkMode: boolean;
  setSearchTerm: (term: string) => void;
  setSeverityFilter: (filter: string) => void;
  setStatusFilter: (filter: string) => void;
  toggleDarkMode: () => void;
  updateIncidentStatus: (id: string, status: Incident['status']) => void;
}

const mockIncidents: Incident[] = [
  {
    id: "INC-169234",
    host: "facebook.com",
    machineId: "WKS-001-DEV",
    user: "maria.silva",
    timestamp: "2024-03-15 14:32:15",
    tabUrl: "https://facebook.com/login",
    severity: "RED",
    cookieExcerpt: "session_id=abc123...",
    status: "new",
    isRedList: true
  },
  {
    id: "INC-169235",
    host: "instagram.com",
    machineId: "WKS-002-MKT",
    user: "joao.santos",
    timestamp: "2024-03-15 14:28:42",
    tabUrl: "https://instagram.com/explore",
    severity: "RED",
    cookieExcerpt: "auth_token=xyz789...",
    status: "in-progress",
    isRedList: true
  },
  {
    id: "INC-169236",
    host: "x.com",
    machineId: "WKS-003-HR",
    user: "ana.costa",
    timestamp: "2024-03-15 14:25:18",
    tabUrl: "https://x.com/home",
    severity: "RED",
    cookieExcerpt: "twitter_sess=def456...",
    status: "blocked",
    isRedList: true
  },
  {
    id: "INC-169237",
    host: "github.com",
    machineId: "WKS-001-DEV",
    user: "maria.silva",
    timestamp: "2024-03-15 14:20:33",
    severity: "NORMAL",
    cookieExcerpt: "_gh_sess=normal123...",
    status: "approved"
  },
  {
    id: "INC-169238",
    host: "stackoverflow.com",
    machineId: "WKS-004-DEV",
    user: "pedro.oliveira",
    timestamp: "2024-03-15 14:15:27",
    severity: "NORMAL",
    cookieExcerpt: "so_session=work456...",
    status: "new"
  },
  {
    id: "INC-169239",
    host: "docs.google.com",
    machineId: "WKS-002-MKT",
    user: "joao.santos",
    timestamp: "2024-03-15 14:10:12",
    severity: "NORMAL",
    cookieExcerpt: "google_docs=safe789...",
    status: "approved"
  }
];

export const useAppStore = create<AppState>((set) => ({
  incidents: mockIncidents,
  searchTerm: '',
  severityFilter: 'all',
  statusFilter: 'all',
  darkMode: false,
  setSearchTerm: (term) => set({ searchTerm: term }),
  setSeverityFilter: (filter) => set({ severityFilter: filter }),
  setStatusFilter: (filter) => set({ statusFilter: filter }),
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  updateIncidentStatus: (id, status) => set((state) => ({
    incidents: state.incidents.map(incident => 
      incident.id === id ? { ...incident, status } : incident
    )
  })),
}));