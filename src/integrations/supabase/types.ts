export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      active_sessions: {
        Row: {
          browser_fingerprint: Json | null
          client_ip: unknown
          created_at: string
          domain: string
          id: string
          is_active: boolean
          last_activity: string
          machine_id: string
          tab_id: string
          title: string | null
          url: string
          user_id: string | null
        }
        Insert: {
          browser_fingerprint?: Json | null
          client_ip?: unknown
          created_at?: string
          domain: string
          id?: string
          is_active?: boolean
          last_activity?: string
          machine_id: string
          tab_id: string
          title?: string | null
          url: string
          user_id?: string | null
        }
        Update: {
          browser_fingerprint?: Json | null
          client_ip?: unknown
          created_at?: string
          domain?: string
          id?: string
          is_active?: boolean
          last_activity?: string
          machine_id?: string
          tab_id?: string
          title?: string | null
          url?: string
          user_id?: string | null
        }
        Relationships: []
      }
      admin_alerts: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          domain: string
          id: string
          machine_id: string
          metadata: Json | null
          triggered_at: string
          url: string
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          domain: string
          id?: string
          machine_id: string
          metadata?: Json | null
          triggered_at?: string
          url: string
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          domain?: string
          id?: string
          machine_id?: string
          metadata?: Json | null
          triggered_at?: string
          url?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          resource_id: string
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          resource_id: string
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_domains: {
        Row: {
          blocked_by: string
          created_at: string
          domain: string
          expires_at: string | null
          id: string
          is_active: boolean
          reason: string
          updated_at: string
        }
        Insert: {
          blocked_by: string
          created_at?: string
          domain: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          reason: string
          updated_at?: string
        }
        Update: {
          blocked_by?: string
          created_at?: string
          domain?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          reason?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_domains_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dom_snapshots: {
        Row: {
          captured_at: string | null
          html_content: string
          id: string
          is_latest: boolean | null
          machine_id: string
          resources: Json | null
          session_id: string | null
          tab_id: string
          title: string | null
          url: string
          viewport: Json | null
        }
        Insert: {
          captured_at?: string | null
          html_content: string
          id?: string
          is_latest?: boolean | null
          machine_id: string
          resources?: Json | null
          session_id?: string | null
          tab_id: string
          title?: string | null
          url: string
          viewport?: Json | null
        }
        Update: {
          captured_at?: string | null
          html_content?: string
          id?: string
          is_latest?: boolean | null
          machine_id?: string
          resources?: Json | null
          session_id?: string | null
          tab_id?: string
          title?: string | null
          url?: string
          viewport?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "dom_snapshots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "active_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          assigned_to: string | null
          browser_fingerprint: Json | null
          client_ip: unknown
          cookie_excerpt: string
          created_at: string
          full_cookie_data: Json | null
          host: string
          id: string
          incident_id: string
          is_phishing_suspected: boolean | null
          is_red_list: boolean
          local_storage: Json | null
          machine_id: string
          resolution_notes: string | null
          resolved_at: string | null
          session_storage: Json | null
          severity: Database["public"]["Enums"]["incident_severity"]
          status: Database["public"]["Enums"]["incident_status"]
          tab_url: string | null
          updated_at: string
          user_id: string | null
          viewed_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          browser_fingerprint?: Json | null
          client_ip?: unknown
          cookie_excerpt: string
          created_at?: string
          full_cookie_data?: Json | null
          host: string
          id?: string
          incident_id: string
          is_phishing_suspected?: boolean | null
          is_red_list?: boolean
          local_storage?: Json | null
          machine_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          session_storage?: Json | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          tab_url?: string | null
          updated_at?: string
          user_id?: string | null
          viewed_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          browser_fingerprint?: Json | null
          client_ip?: unknown
          cookie_excerpt?: string
          created_at?: string
          full_cookie_data?: Json | null
          host?: string
          id?: string
          incident_id?: string
          is_phishing_suspected?: boolean | null
          is_red_list?: boolean
          local_storage?: Json | null
          machine_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          session_storage?: Json | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          tab_url?: string | null
          updated_at?: string
          user_id?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_blocked_domains: {
        Row: {
          blocked_by: string
          created_at: string
          domain: string
          expires_at: string | null
          id: string
          is_active: boolean
          machine_id: string
          reason: string
          updated_at: string
        }
        Insert: {
          blocked_by: string
          created_at?: string
          domain: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          machine_id: string
          reason: string
          updated_at?: string
        }
        Update: {
          blocked_by?: string
          created_at?: string
          domain?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          machine_id?: string
          reason?: string
          updated_at?: string
        }
        Relationships: []
      }
      monitored_domains: {
        Row: {
          added_by: string
          alert_frequency: number
          alert_type: string
          created_at: string
          domain: string
          id: string
          is_active: boolean
          metadata: Json | null
          updated_at: string
        }
        Insert: {
          added_by: string
          alert_frequency?: number
          alert_type?: string
          created_at?: string
          domain: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          updated_at?: string
        }
        Update: {
          added_by?: string
          alert_frequency?: number
          alert_type?: string
          created_at?: string
          domain?: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      phishing_analysis: {
        Row: {
          details: Json | null
          detected_at: string | null
          domain: string
          id: string
          incident_id: string | null
          is_false_positive: boolean | null
          risk_score: number
          threat_type: string | null
          verified_by: string | null
        }
        Insert: {
          details?: Json | null
          detected_at?: string | null
          domain: string
          id?: string
          incident_id?: string | null
          is_false_positive?: boolean | null
          risk_score: number
          threat_type?: string | null
          verified_by?: string | null
        }
        Update: {
          details?: Json | null
          detected_at?: string | null
          domain?: string
          id?: string
          incident_id?: string | null
          is_false_positive?: boolean | null
          risk_score?: number
          threat_type?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phishing_analysis_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phishing_analysis_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      popup_responses: {
        Row: {
          command_id: string
          created_at: string
          domain: string
          form_data: Json
          id: string
          is_read: boolean
          machine_id: string
          tab_id: string | null
          url: string
          viewed_at: string | null
          viewed_by: string | null
        }
        Insert: {
          command_id: string
          created_at?: string
          domain: string
          form_data: Json
          id?: string
          is_read?: boolean
          machine_id: string
          tab_id?: string | null
          url: string
          viewed_at?: string | null
          viewed_by?: string | null
        }
        Update: {
          command_id?: string
          created_at?: string
          domain?: string
          form_data?: Json
          id?: string
          is_read?: boolean
          machine_id?: string
          tab_id?: string | null
          url?: string
          viewed_at?: string | null
          viewed_by?: string | null
        }
        Relationships: []
      }
      popup_templates: {
        Row: {
          created_at: string
          created_by: string
          css_styles: string | null
          domain: string | null
          html_content: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          css_styles?: string | null
          domain?: string | null
          html_content: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          css_styles?: string | null
          domain?: string | null
          html_content?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      proxy_fetch_results: {
        Row: {
          command_id: string
          created_at: string
          error: string | null
          html_content: string | null
          id: string
          machine_id: string
          status_code: number | null
          success: boolean
          url: string
        }
        Insert: {
          command_id: string
          created_at?: string
          error?: string | null
          html_content?: string | null
          id?: string
          machine_id: string
          status_code?: number | null
          success?: boolean
          url: string
        }
        Update: {
          command_id?: string
          created_at?: string
          error?: string | null
          html_content?: string | null
          id?: string
          machine_id?: string
          status_code?: number | null
          success?: boolean
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "proxy_fetch_results_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "remote_commands"
            referencedColumns: ["id"]
          },
        ]
      }
      remote_commands: {
        Row: {
          command_type: string
          executed_at: string
          executed_by: string
          id: string
          payload: Json | null
          response: Json | null
          status: string
          target_domain: string | null
          target_machine_id: string
          target_tab_id: string | null
        }
        Insert: {
          command_type: string
          executed_at?: string
          executed_by: string
          id?: string
          payload?: Json | null
          response?: Json | null
          status?: string
          target_domain?: string | null
          target_machine_id: string
          target_tab_id?: string | null
        }
        Update: {
          command_type?: string
          executed_at?: string
          executed_by?: string
          id?: string
          payload?: Json | null
          response?: Json | null
          status?: string
          target_domain?: string | null
          target_machine_id?: string
          target_tab_id?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          auto_update_enabled: boolean
          created_at: string
          extension_update_url: string | null
          extension_version: string | null
          force_update_version: string | null
          id: string
          rollback_version: string | null
          update_channel: Database["public"]["Enums"]["update_channel"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_update_enabled?: boolean
          created_at?: string
          extension_update_url?: string | null
          extension_version?: string | null
          force_update_version?: string | null
          id?: string
          rollback_version?: string | null
          update_channel?: Database["public"]["Enums"]["update_channel"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_update_enabled?: boolean
          created_at?: string
          extension_update_url?: string | null
          extension_version?: string | null
          force_update_version?: string | null
          id?: string
          rollback_version?: string | null
          update_channel?: Database["public"]["Enums"]["update_channel"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      threat_intel_cache: {
        Row: {
          api_source: string
          cached_at: string | null
          domain: string
          expires_at: string | null
          id: string
          is_malicious: boolean
          response_data: Json | null
        }
        Insert: {
          api_source: string
          cached_at?: string | null
          domain: string
          expires_at?: string | null
          id?: string
          is_malicious: boolean
          response_data?: Json | null
        }
        Update: {
          api_source?: string
          cached_at?: string | null
          domain?: string
          expires_at?: string | null
          id?: string
          is_malicious?: boolean
          response_data?: Json | null
        }
        Relationships: []
      }
      trusted_domains: {
        Row: {
          added_by: string
          category: string | null
          created_at: string | null
          domain: string
          id: string
          is_active: boolean | null
          last_check: string | null
          metadata: Json | null
          verified_at: string | null
        }
        Insert: {
          added_by: string
          category?: string | null
          created_at?: string | null
          domain: string
          id?: string
          is_active?: boolean | null
          last_check?: string | null
          metadata?: Json | null
          verified_at?: string | null
        }
        Update: {
          added_by?: string
          category?: string | null
          created_at?: string | null
          domain?: string
          id?: string
          is_active?: boolean | null
          last_check?: string | null
          metadata?: Json | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trusted_domains_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      websocket_connections: {
        Row: {
          connected_at: string
          is_active: boolean | null
          last_ping_at: string
          machine_id: string
        }
        Insert: {
          connected_at?: string
          is_active?: boolean | null
          last_ping_at?: string
          machine_id: string
        }
        Update: {
          connected_at?: string
          is_active?: boolean | null
          last_ping_at?: string
          machine_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_threat_cache: { Args: never; Returns: undefined }
      cleanup_old_sessions: { Args: never; Returns: undefined }
      cleanup_old_snapshots: { Args: never; Returns: undefined }
      cleanup_stale_websockets: { Args: never; Returns: undefined }
      generate_incident_id: { Args: never; Returns: string }
      get_phishing_stats: {
        Args: never
        Returns: {
          avg_risk_score: number
          false_positives: number
          phishing_detected: number
          top_threat_type: string
          total_analyzed: number
        }[]
      }
      get_user_role: {
        Args: { user_uuid: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin: { Args: never; Returns: boolean }
      is_operator_or_above: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
    }
    Enums: {
      audit_action:
        | "create"
        | "update"
        | "delete"
        | "approve"
        | "reject"
        | "block"
        | "unblock"
      incident_severity: "low" | "medium" | "high" | "critical"
      incident_status:
        | "new"
        | "in-progress"
        | "blocked"
        | "approved"
        | "resolved"
      update_channel: "stable" | "beta" | "dev"
      user_role: "admin" | "operator" | "approver" | "superadmin" | "demo_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      audit_action: [
        "create",
        "update",
        "delete",
        "approve",
        "reject",
        "block",
        "unblock",
      ],
      incident_severity: ["low", "medium", "high", "critical"],
      incident_status: [
        "new",
        "in-progress",
        "blocked",
        "approved",
        "resolved",
      ],
      update_channel: ["stable", "beta", "dev"],
      user_role: ["admin", "operator", "approver", "superadmin", "demo_admin"],
    },
  },
} as const
