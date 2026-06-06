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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      feature_settings: {
        Row: {
          auto_followup_enabled: boolean
          auto_review_enabled: boolean
          created_at: string
          google_review_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_followup_enabled?: boolean
          auto_review_enabled?: boolean
          created_at?: string
          google_review_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_followup_enabled?: boolean
          auto_review_enabled?: boolean
          created_at?: string
          google_review_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kits: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          trade: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          trade?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          trade?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kit_items: {
        Row: {
          created_at: string
          description: string
          id: string
          kit_id: string
          position: number
          quantity: number
          type: string
          unit: string | null
          unit_price: number
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          kit_id: string
          position?: number
          quantity?: number
          type?: string
          unit?: string | null
          unit_price?: number
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          kit_id?: string
          position?: number
          quantity?: number
          type?: string
          unit?: string | null
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kit_items_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_accounts: {
        Row: {
          charges_enabled: boolean
          created_at: string
          deposit_pct: number
          details_submitted: boolean
          stripe_account_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          charges_enabled?: boolean
          created_at?: string
          deposit_pct?: number
          details_submitted?: boolean
          stripe_account_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          charges_enabled?: boolean
          created_at?: string
          deposit_pct?: number
          details_submitted?: boolean
          stripe_account_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          quote_id: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency: string
          id?: string
          paid_at?: string | null
          quote_id?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          quote_id?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      review_requests: {
        Row: {
          channel: string
          id: string
          quote_id: string
          sent_at: string
          status: string
          user_id: string
        }
        Insert: {
          channel?: string
          id?: string
          quote_id: string
          sent_at?: string
          status?: string
          user_id: string
        }
        Update: {
          channel?: string
          id?: string
          quote_id?: string
          sent_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_requests_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_followups: {
        Row: {
          channel: string
          id: string
          quote_id: string
          sent_at: string
          step: number
          user_id: string
        }
        Insert: {
          channel?: string
          id?: string
          quote_id: string
          sent_at?: string
          step: number
          user_id: string
        }
        Update: {
          channel?: string
          id?: string
          quote_id?: string
          sent_at?: string
          step?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_followups_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_events: {
        Row: {
          agent_name: string
          created_at: string
          event_type: string
          handoff_from: string | null
          handoff_to: string | null
          id: string
          message: string | null
          metadata: Json | null
          progress_pct: number | null
          quote_id: string | null
          run_id: string | null
          status: string
          step: string | null
          user_id: string | null
        }
        Insert: {
          agent_name: string
          created_at?: string
          event_type: string
          handoff_from?: string | null
          handoff_to?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          progress_pct?: number | null
          quote_id?: string | null
          run_id?: string | null
          status: string
          step?: string | null
          user_id?: string | null
        }
        Update: {
          agent_name?: string
          created_at?: string
          event_type?: string
          handoff_from?: string | null
          handoff_to?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          progress_pct?: number | null
          quote_id?: string | null
          run_id?: string | null
          status?: string
          step?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          agent_name: string
          approval_required: boolean
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          handoff_from: string | null
          handoff_to: string | null
          id: string
          last_message: string | null
          last_step: string | null
          quote_id: string | null
          run_id: string
          started_at: string
          status: string
          user_id: string | null
        }
        Insert: {
          agent_name: string
          approval_required?: boolean
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          handoff_from?: string | null
          handoff_to?: string | null
          id?: string
          last_message?: string | null
          last_step?: string | null
          quote_id?: string | null
          run_id: string
          started_at?: string
          status: string
          user_id?: string | null
        }
        Update: {
          agent_name?: string
          approval_required?: boolean
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          handoff_from?: string | null
          handoff_to?: string | null
          id?: string
          last_message?: string | null
          last_step?: string | null
          quote_id?: string | null
          run_id?: string
          started_at?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      beta_feedback: {
        Row: {
          app_version: string | null
          created_at: string
          id: string
          user_id: string
          what_confusing: string | null
          what_worked: string | null
          would_pay: string | null
          wrong_number: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          id?: string
          user_id: string
          what_confusing?: string | null
          what_worked?: string | null
          would_pay?: string | null
          wrong_number?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          id?: string
          user_id?: string
          what_confusing?: string | null
          what_worked?: string | null
          would_pay?: string | null
          wrong_number?: string | null
        }
        Relationships: []
      }
      calendar_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          note_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          note_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          note_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          created_at: string
          currency: string
          deleted_at: string | null
          due_date: string
          id: string
          invoice_data: Json
          invoice_number: string
          paid_at: string | null
          quote_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          total_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          deleted_at?: string | null
          due_date: string
          id?: string
          invoice_data: Json
          invoice_number: string
          paid_at?: string | null
          quote_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount?: number
          total_amount: number
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          deleted_at?: string | null
          due_date?: string
          id?: string
          invoice_data?: Json
          invoice_number?: string
          paid_at?: string | null
          quote_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      lifecycle_emails: {
        Row: {
          id: string
          kind: string
          provider_message_id: string | null
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: string
          kind: string
          provider_message_id?: string | null
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: string
          kind?: string
          provider_message_id?: string | null
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      material_aliases: {
        Row: {
          alias: string
          confidence: string | null
          created_at: string
          id: string
          material_id: string
          normalized_alias: string
          source: string
        }
        Insert: {
          alias: string
          confidence?: string | null
          created_at?: string
          id?: string
          material_id: string
          normalized_alias: string
          source: string
        }
        Update: {
          alias?: string
          confidence?: string | null
          created_at?: string
          id?: string
          material_id?: string
          normalized_alias?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_aliases_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          active: boolean
          attributes: Json
          brand: string | null
          category: string | null
          compliance_notes: string | null
          country: string
          created_at: string
          default_unit_price: number | null
          gst_included: boolean
          id: string
          internal_notes: string | null
          is_ai_estimated: boolean
          last_used_at: string | null
          name: string
          normalized_name: string | null
          notes: string | null
          price_confidence: string | null
          price_last_checked_at: string | null
          price_source: string | null
          sku: string | null
          supplier: string | null
          supplier_url: string | null
          trade_name: string | null
          unit: string | null
          updated_at: string
          usage_count: number
          user_id: string | null
        }
        Insert: {
          active?: boolean
          attributes?: Json
          brand?: string | null
          category?: string | null
          compliance_notes?: string | null
          country?: string
          created_at?: string
          default_unit_price?: number | null
          gst_included?: boolean
          id?: string
          internal_notes?: string | null
          is_ai_estimated?: boolean
          last_used_at?: string | null
          name: string
          normalized_name?: string | null
          notes?: string | null
          price_confidence?: string | null
          price_last_checked_at?: string | null
          price_source?: string | null
          sku?: string | null
          supplier?: string | null
          supplier_url?: string | null
          trade_name?: string | null
          unit?: string | null
          updated_at?: string
          usage_count?: number
          user_id?: string | null
        }
        Update: {
          active?: boolean
          attributes?: Json
          brand?: string | null
          category?: string | null
          compliance_notes?: string | null
          country?: string
          created_at?: string
          default_unit_price?: number | null
          gst_included?: boolean
          id?: string
          internal_notes?: string | null
          is_ai_estimated?: boolean
          last_used_at?: string | null
          name?: string
          normalized_name?: string | null
          notes?: string | null
          price_confidence?: string | null
          price_last_checked_at?: string | null
          price_source?: string | null
          sku?: string | null
          supplier?: string | null
          supplier_url?: string | null
          trade_name?: string | null
          unit?: string | null
          updated_at?: string
          usage_count?: number
          user_id?: string | null
        }
        Relationships: []
      }
      plan_files: {
        Row: {
          byte_size: number
          id: string
          mime: string
          original_filename: string
          page_count: number
          project_id: string | null
          quote_id: string | null
          status: string
          storage_path: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          byte_size: number
          id?: string
          mime: string
          original_filename: string
          page_count?: number
          project_id?: string | null
          quote_id?: string | null
          status?: string
          storage_path: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          byte_size?: number
          id?: string
          mime?: string
          original_filename?: string
          page_count?: number
          project_id?: string | null
          quote_id?: string | null
          status?: string
          storage_path?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_files_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_sheets: {
        Row: {
          classification_basis: Json
          classification_confidence: number
          created_at: string
          extraction: Json | null
          file_id: string
          id: string
          image_path: string
          review_reasons: Json
          review_required: boolean
          sheet_label: string | null
          sheet_number: number
          sheet_type: string
          status: string
          user_id: string
        }
        Insert: {
          classification_basis?: Json
          classification_confidence?: number
          created_at?: string
          extraction?: Json | null
          file_id: string
          id?: string
          image_path: string
          review_reasons?: Json
          review_required?: boolean
          sheet_label?: string | null
          sheet_number: number
          sheet_type?: string
          status?: string
          user_id: string
        }
        Update: {
          classification_basis?: Json
          classification_confidence?: number
          created_at?: string
          extraction?: Json | null
          file_id?: string
          id?: string
          image_path?: string
          review_reasons?: Json
          review_required?: boolean
          sheet_label?: string | null
          sheet_number?: number
          sheet_type?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_sheets_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "plan_files"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          business_name: string | null
          country: string | null
          created_at: string
          currency: string | null
          default_labour_rate: number | null
          default_markup_pct: number | null
          email: string | null
          gst_number: string | null
          id: string
          logo_url: string | null
          min_margin_percent: number | null
          phone: string | null
          tax_label: string | null
          tax_rate: number | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          business_name?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          default_labour_rate?: number | null
          default_markup_pct?: number | null
          email?: string | null
          gst_number?: string | null
          id: string
          logo_url?: string | null
          min_margin_percent?: number | null
          phone?: string | null
          tax_label?: string | null
          tax_rate?: number | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          business_name?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          default_labour_rate?: number | null
          default_markup_pct?: number | null
          email?: string | null
          gst_number?: string | null
          id?: string
          logo_url?: string | null
          min_margin_percent?: number | null
          phone?: string | null
          tax_label?: string | null
          tax_rate?: number | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quote_edit_events: {
        Row: {
          created_at: string
          diff: Json
          edited_data: Json
          id: string
          quote_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          diff: Json
          edited_data: Json
          id?: string
          quote_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          diff?: Json
          edited_data?: Json
          id?: string
          quote_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_edit_events_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_events: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          quote_id: string
          type: Database["public"]["Enums"]["quote_event_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          quote_id: string
          type: Database["public"]["Enums"]["quote_event_type"]
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          quote_id?: string
          type?: Database["public"]["Enums"]["quote_event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "quote_events_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          description: string
          id: string
          line_total: number | null
          quantity: number | null
          quote_id: string
          type: Database["public"]["Enums"]["quote_item_type"]
          unit: string | null
          unit_price: number | null
        }
        Insert: {
          description: string
          id?: string
          line_total?: number | null
          quantity?: number | null
          quote_id: string
          type: Database["public"]["Enums"]["quote_item_type"]
          unit?: string | null
          unit_price?: number | null
        }
        Update: {
          description?: string
          id?: string
          line_total?: number | null
          quantity?: number | null
          quote_id?: string
          type?: Database["public"]["Enums"]["quote_item_type"]
          unit?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          accepted_email: string | null
          accepted_ip: string | null
          accepted_name: string | null
          accepted_quote_version: number
          accepted_total: number | null
          accepted_user_agent: string | null
          ai_snapshot: Json | null
          archived_at: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          currency: string | null
          declined_at: string | null
          deleted_at: string | null
          expires_at: string | null
          follow_up_sent_at: string | null
          id: string
          pdf_path: string | null
          public_token: string | null
          quote_data: Json | null
          scheduled_for: string | null
          sent_at: string | null
          signature_path: string | null
          signed_at: string | null
          signed_name: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["quote_status"]
          total_amount: number | null
          user_id: string
          viewed_at: string | null
          voice_transcript: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_email?: string | null
          accepted_ip?: string | null
          accepted_name?: string | null
          accepted_quote_version?: number
          accepted_total?: number | null
          accepted_user_agent?: string | null
          ai_snapshot?: Json | null
          archived_at?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string | null
          declined_at?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          follow_up_sent_at?: string | null
          id?: string
          pdf_path?: string | null
          public_token?: string | null
          quote_data?: Json | null
          scheduled_for?: string | null
          sent_at?: string | null
          signature_path?: string | null
          signed_at?: string | null
          signed_name?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          total_amount?: number | null
          user_id: string
          viewed_at?: string | null
          voice_transcript?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_email?: string | null
          accepted_ip?: string | null
          accepted_name?: string | null
          accepted_quote_version?: number
          accepted_total?: number | null
          accepted_user_agent?: string | null
          ai_snapshot?: Json | null
          archived_at?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string | null
          declined_at?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          follow_up_sent_at?: string | null
          id?: string
          pdf_path?: string | null
          public_token?: string | null
          quote_data?: Json | null
          scheduled_for?: string | null
          sent_at?: string | null
          signature_path?: string | null
          signed_at?: string | null
          signed_name?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          total_amount?: number | null
          user_id?: string
          viewed_at?: string | null
          voice_transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          event_id: string
          received_at: string
          type: string | null
        }
        Insert: {
          event_id: string
          received_at?: string
          type?: string | null
        }
        Update: {
          event_id?: string
          received_at?: string
          type?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_quote: {
        Args: {
          p_email: string
          p_ip: string
          p_name: string
          p_signature_path: string
          p_token: string
          p_total: number
          p_user_agent: string
          p_version: number
        }
        Returns: Json
      }
      append_quote_chat_messages: {
        Args: { p_messages: Json; p_quote_id: string }
        Returns: undefined
      }
      create_invoice_from_quote: {
        Args: { p_quote_id: string }
        Returns: string
      }
      get_quote_by_token: { Args: { p_token: string }; Returns: Json }
      mark_quote_viewed: { Args: { p_token: string }; Returns: undefined }
      search_materials: {
        Args: {
          p_brand?: string
          p_category?: string
          p_country?: string
          p_limit?: number
          p_query: string
          p_supplier?: string
          p_treatment_class?: string
        }
        Returns: {
          attributes: Json
          brand: string
          category: string
          id: string
          match_score: number
          match_source: string
          name: string
          price: number
          tier_rank: number
          unit: string
          user_id: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      transition_quote_lifecycle: {
        Args: {
          p_metadata?: Json
          p_quote_id: string
          p_target: Database["public"]["Enums"]["quote_status"]
        }
        Returns: Database["public"]["Enums"]["quote_status"]
      }
    }
    Enums: {
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
      quote_event_type:
        | "sent"
        | "viewed"
        | "accepted"
        | "declined"
        | "expired"
        | "scheduled"
        | "in_progress"
        | "completed"
        | "follow_up_sent"
        | "sms_sent"
      quote_item_type: "material" | "labour" | "other"
      quote_status:
        | "draft"
        | "sent"
        | "viewed"
        | "accepted"
        | "declined"
        | "expired"
        | "scheduled"
        | "in_progress"
        | "completed"
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
      invoice_status: ["draft", "sent", "paid", "overdue", "cancelled"],
      quote_event_type: [
        "sent",
        "viewed",
        "accepted",
        "declined",
        "expired",
        "scheduled",
        "in_progress",
        "completed",
        "follow_up_sent",
        "sms_sent",
      ],
      quote_item_type: ["material", "labour", "other"],
      quote_status: [
        "draft",
        "sent",
        "viewed",
        "accepted",
        "declined",
        "expired",
        "scheduled",
        "in_progress",
        "completed",
      ],
    },
  },
} as const
