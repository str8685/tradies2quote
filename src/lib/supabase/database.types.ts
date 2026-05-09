export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
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
      materials: {
        Row: {
          created_at: string;
          default_unit_price: number | null;
          id: string;
          is_ai_estimated: boolean;
          last_used_at: string | null;
          name: string;
          notes: string | null;
          supplier: string | null;
          supplier_url: string | null;
          unit: string | null;
          usage_count: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          default_unit_price?: number | null;
          id?: string;
          is_ai_estimated?: boolean;
          last_used_at?: string | null;
          name: string;
          notes?: string | null;
          supplier?: string | null;
          supplier_url?: string | null;
          unit?: string | null;
          usage_count?: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          default_unit_price?: number | null;
          id?: string;
          is_ai_estimated?: boolean;
          last_used_at?: string | null;
          name?: string;
          notes?: string | null;
          supplier?: string | null;
          supplier_url?: string | null;
          unit?: string | null;
          usage_count?: number;
          user_id?: string;
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
          client_id: string | null;
          created_at: string;
          currency: string | null;
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
          client_id?: string | null;
          created_at?: string;
          currency?: string | null;
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
          client_id?: string | null;
          created_at?: string;
          currency?: string | null;
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
    Views: Record<string, never>;
    Functions: {
      accept_quote: {
        Args: {
          p_email: string;
          p_ip: string | null;
          p_name: string;
          p_signature_path: string;
          p_token: string;
          p_total: number;
          p_user_agent: string | null;
          p_version: number;
        };
        Returns: Json;
      };
      get_quote_by_token: {
        Args: { p_token: string };
        Returns: Json;
      };
      mark_quote_viewed: {
        Args: { p_token: string };
        Returns: undefined;
      };
    };
    Enums: {
      quote_event_type:
        | "sent"
        | "viewed"
        | "accepted"
        | "declined"
        | "expired";
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
