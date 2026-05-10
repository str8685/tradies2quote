export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      clients: {
        Row: {
          address: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          phone: string | null;
          user_id: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          phone?: string | null;
          user_id: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          phone?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      material_aliases: {
        Row: {
          alias: string;
          confidence: string | null;
          created_at: string;
          id: string;
          material_id: string;
          normalized_alias: string;
          source: string;
        };
        Insert: {
          alias: string;
          confidence?: string | null;
          created_at?: string;
          id?: string;
          material_id: string;
          normalized_alias: string;
          source: string;
        };
        Update: {
          alias?: string;
          confidence?: string | null;
          created_at?: string;
          id?: string;
          material_id?: string;
          normalized_alias?: string;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "material_aliases_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
        ];
      };
      materials: {
        Row: {
          active: boolean;
          attributes: Json;
          brand: string | null;
          category: string | null;
          compliance_notes: string | null;
          country: string;
          created_at: string;
          default_unit_price: number | null;
          gst_included: boolean;
          id: string;
          internal_notes: string | null;
          is_ai_estimated: boolean;
          last_used_at: string | null;
          name: string;
          normalized_name: string | null;
          notes: string | null;
          price_confidence: string | null;
          price_last_checked_at: string | null;
          price_source: string | null;
          sku: string | null;
          supplier: string | null;
          supplier_url: string | null;
          trade_name: string | null;
          unit: string | null;
          updated_at: string;
          usage_count: number;
          user_id: string | null;
        };
        Insert: {
          active?: boolean;
          attributes?: Json;
          brand?: string | null;
          category?: string | null;
          compliance_notes?: string | null;
          country?: string;
          created_at?: string;
          default_unit_price?: number | null;
          gst_included?: boolean;
          id?: string;
          internal_notes?: string | null;
          is_ai_estimated?: boolean;
          last_used_at?: string | null;
          name: string;
          normalized_name?: string | null;
          notes?: string | null;
          price_confidence?: string | null;
          price_last_checked_at?: string | null;
          price_source?: string | null;
          sku?: string | null;
          supplier?: string | null;
          supplier_url?: string | null;
          trade_name?: string | null;
          unit?: string | null;
          updated_at?: string;
          usage_count?: number;
          user_id?: string | null;
        };
        Update: {
          active?: boolean;
          attributes?: Json;
          brand?: string | null;
          category?: string | null;
          compliance_notes?: string | null;
          country?: string;
          created_at?: string;
          default_unit_price?: number | null;
          gst_included?: boolean;
          id?: string;
          internal_notes?: string | null;
          is_ai_estimated?: boolean;
          last_used_at?: string | null;
          name?: string;
          normalized_name?: string | null;
          notes?: string | null;
          price_confidence?: string | null;
          price_last_checked_at?: string | null;
          price_source?: string | null;
          sku?: string | null;
          supplier?: string | null;
          supplier_url?: string | null;
          trade_name?: string | null;
          unit?: string | null;
          updated_at?: string;
          usage_count?: number;
          user_id?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          address: string | null;
          business_name: string | null;
          country: string | null;
          created_at: string;
          currency: string | null;
          default_labour_rate: number | null;
          default_markup_pct: number | null;
          email: string | null;
          gst_number: string | null;
          id: string;
          logo_url: string | null;
          phone: string | null;
          tax_label: string | null;
          tax_rate: number | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          business_name?: string | null;
          country?: string | null;
          created_at?: string;
          currency?: string | null;
          default_labour_rate?: number | null;
          default_markup_pct?: number | null;
          email?: string | null;
          gst_number?: string | null;
          id: string;
          logo_url?: string | null;
          phone?: string | null;
          tax_label?: string | null;
          tax_rate?: number | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          business_name?: string | null;
          country?: string | null;
          created_at?: string;
          currency?: string | null;
          default_labour_rate?: number | null;
          default_markup_pct?: number | null;
          email?: string | null;
          gst_number?: string | null;
          id?: string;
          logo_url?: string | null;
          phone?: string | null;
          tax_label?: string | null;
          tax_rate?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      quote_events: {
        Row: {
          created_at: string;
          id: string;
          metadata: Json | null;
          quote_id: string;
          type: Database["public"]["Enums"]["quote_event_type"];
        };
        Insert: {
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          quote_id: string;
          type: Database["public"]["Enums"]["quote_event_type"];
        };
        Update: {
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          quote_id?: string;
          type?: Database["public"]["Enums"]["quote_event_type"];
        };
        Relationships: [
          {
            foreignKeyName: "quote_events_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_items: {
        Row: {
          description: string;
          id: string;
          line_total: number | null;
          quantity: number | null;
          quote_id: string;
          type: Database["public"]["Enums"]["quote_item_type"];
          unit: string | null;
          unit_price: number | null;
        };
        Insert: {
          description: string;
          id?: string;
          line_total?: number | null;
          quantity?: number | null;
          quote_id: string;
          type: Database["public"]["Enums"]["quote_item_type"];
          unit?: string | null;
          unit_price?: number | null;
        };
        Update: {
          description?: string;
          id?: string;
          line_total?: number | null;
          quantity?: number | null;
          quote_id?: string;
          type?: Database["public"]["Enums"]["quote_item_type"];
          unit?: string | null;
          unit_price?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
        ];
      };
      quotes: {
        Row: {
          accepted_at: string | null;
          accepted_email: string | null;
          accepted_ip: string | null;
          accepted_name: string | null;
          accepted_quote_version: number;
          accepted_total: number | null;
          accepted_user_agent: string | null;
          archived_at: string | null;
          client_id: string | null;
          created_at: string;
          currency: string | null;
          deleted_at: string | null;
          expires_at: string | null;
          id: string;
          pdf_path: string | null;
          public_token: string | null;
          quote_data: Json | null;
          sent_at: string | null;
          signature_path: string | null;
          signed_at: string | null;
          signed_name: string | null;
          status: Database["public"]["Enums"]["quote_status"];
          total_amount: number | null;
          user_id: string;
          viewed_at: string | null;
          voice_transcript: string | null;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_email?: string | null;
          accepted_ip?: string | null;
          accepted_name?: string | null;
          accepted_quote_version?: number;
          accepted_total?: number | null;
          accepted_user_agent?: string | null;
          archived_at?: string | null;
          client_id?: string | null;
          created_at?: string;
          currency?: string | null;
          deleted_at?: string | null;
          expires_at?: string | null;
          id?: string;
          pdf_path?: string | null;
          public_token?: string | null;
          quote_data?: Json | null;
          sent_at?: string | null;
          signature_path?: string | null;
          signed_at?: string | null;
          signed_name?: string | null;
          status?: Database["public"]["Enums"]["quote_status"];
          total_amount?: number | null;
          user_id: string;
          viewed_at?: string | null;
          voice_transcript?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          accepted_email?: string | null;
          accepted_ip?: string | null;
          accepted_name?: string | null;
          accepted_quote_version?: number;
          accepted_total?: number | null;
          accepted_user_agent?: string | null;
          archived_at?: string | null;
          client_id?: string | null;
          created_at?: string;
          currency?: string | null;
          deleted_at?: string | null;
          expires_at?: string | null;
          id?: string;
          pdf_path?: string | null;
          public_token?: string | null;
          quote_data?: Json | null;
          sent_at?: string | null;
          signature_path?: string | null;
          signed_at?: string | null;
          signed_name?: string | null;
          status?: Database["public"]["Enums"]["quote_status"];
          total_amount?: number | null;
          user_id?: string;
          viewed_at?: string | null;
          voice_transcript?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          created_at: string;
          current_period_end: string | null;
          id: string;
          plan: string | null;
          status: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          plan?: string | null;
          status?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          plan?: string | null;
          status?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_quote: {
        Args: {
          p_email: string;
          p_ip: string;
          p_name: string;
          p_signature_path: string;
          p_token: string;
          p_total: number;
          p_user_agent: string;
          p_version: number;
        };
        Returns: Json;
      };
      get_quote_by_token: { Args: { p_token: string }; Returns: Json };
      mark_quote_viewed: { Args: { p_token: string }; Returns: undefined };
      search_materials: {
        Args: {
          p_brand?: string;
          p_category?: string;
          p_country?: string;
          p_limit?: number;
          p_query: string;
          p_supplier?: string;
          p_treatment_class?: string;
        };
        Returns: {
          attributes: Json;
          brand: string;
          category: string;
          id: string;
          match_score: number;
          match_source: string;
          name: string;
          price: number;
          tier_rank: number;
          unit: string;
          user_id: string;
        }[];
      };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
    };
    Enums: {
      quote_event_type: "sent" | "viewed" | "accepted" | "declined" | "expired";
      quote_item_type: "material" | "labour" | "other";
      quote_status:
        | "draft"
        | "sent"
        | "viewed"
        | "accepted"
        | "declined"
        | "expired";
    };
    CompositeTypes: Record<string, never>;
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      quote_event_type: ["sent", "viewed", "accepted", "declined", "expired"],
      quote_item_type: ["material", "labour", "other"],
      quote_status: [
        "draft",
        "sent",
        "viewed",
        "accepted",
        "declined",
        "expired",
      ],
    },
  },
} as const;
