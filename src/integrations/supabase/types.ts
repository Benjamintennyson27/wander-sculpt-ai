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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      destination_facts: {
        Row: {
          attractions: Json
          created_at: string
          destination: string
          fetched_at: string
          food_preference: string | null
          food_spots: Json
          id: string
          model_used: string | null
          raw_response: Json | null
          trip_id: string
          trip_type: string | null
        }
        Insert: {
          attractions?: Json
          created_at?: string
          destination: string
          fetched_at?: string
          food_preference?: string | null
          food_spots?: Json
          id?: string
          model_used?: string | null
          raw_response?: Json | null
          trip_id: string
          trip_type?: string | null
        }
        Update: {
          attractions?: Json
          created_at?: string
          destination?: string
          fetched_at?: string
          food_preference?: string | null
          food_spots?: Json
          id?: string
          model_used?: string | null
          raw_response?: Json | null
          trip_id?: string
          trip_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "destination_facts_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_events: {
        Row: {
          action: string
          created_at: string | null
          id: string
          trip_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          trip_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          trip_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      itineraries: {
        Row: {
          cons: string[] | null
          created_at: string
          days: Json
          disclaimers: Json | null
          general_tips: Json | null
          id: string
          is_best_option: boolean | null
          model_used: string | null
          option_index: number
          option_label: string | null
          pace: string | null
          pros: string[] | null
          recommended: boolean | null
          score: number | null
          summary: string | null
          title: string
          total_cost_max: number | null
          total_cost_min: number | null
          trip_id: string
          why_good_for_you: string | null
        }
        Insert: {
          cons?: string[] | null
          created_at?: string
          days?: Json
          disclaimers?: Json | null
          general_tips?: Json | null
          id?: string
          is_best_option?: boolean | null
          model_used?: string | null
          option_index: number
          option_label?: string | null
          pace?: string | null
          pros?: string[] | null
          recommended?: boolean | null
          score?: number | null
          summary?: string | null
          title: string
          total_cost_max?: number | null
          total_cost_min?: number | null
          trip_id: string
          why_good_for_you?: string | null
        }
        Update: {
          cons?: string[] | null
          created_at?: string
          days?: Json
          disclaimers?: Json | null
          general_tips?: Json | null
          id?: string
          is_best_option?: boolean | null
          model_used?: string | null
          option_index?: number
          option_label?: string | null
          pace?: string | null
          pros?: string[] | null
          recommended?: boolean | null
          score?: number | null
          summary?: string | null
          title?: string
          total_cost_max?: number | null
          total_cost_min?: number | null
          trip_id?: string
          why_good_for_you?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "itineraries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_days: {
        Row: {
          created_at: string
          day_number: number
          id: string
          itinerary_id: string
          notes: string | null
          title: string
        }
        Insert: {
          created_at?: string
          day_number: number
          id?: string
          itinerary_id: string
          notes?: string | null
          title: string
        }
        Update: {
          created_at?: string
          day_number?: number
          id?: string
          itinerary_id?: string
          notes?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_days_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_edits_log: {
        Row: {
          action: string
          created_at: string
          id: string
          option_id: string
          payload: Json
          trip_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          option_id: string
          payload?: Json
          trip_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          option_id?: string
          payload?: Json
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_edits_log_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_item_facts: {
        Row: {
          closed_day_text: string | null
          created_at: string
          hours_text: string | null
          id: string
          itinerary_item_id: string
          price_text: string | null
          sources: Json | null
          verified_note: string | null
        }
        Insert: {
          closed_day_text?: string | null
          created_at?: string
          hours_text?: string | null
          id?: string
          itinerary_item_id: string
          price_text?: string | null
          sources?: Json | null
          verified_note?: string | null
        }
        Update: {
          closed_day_text?: string | null
          created_at?: string
          hours_text?: string | null
          id?: string
          itinerary_item_id?: string
          price_text?: string | null
          sources?: Json | null
          verified_note?: string | null
        }
        Relationships: []
      }
      itinerary_items: {
        Row: {
          assumptions: string | null
          cost_max: number | null
          cost_min: number | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          food_related: boolean | null
          id: string
          itinerary_day_id: string
          kid_friendly: boolean | null
          location_area: string | null
          maps_query: string | null
          time_block: string
          title: string
          transit_tip: string | null
        }
        Insert: {
          assumptions?: string | null
          cost_max?: number | null
          cost_min?: number | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          food_related?: boolean | null
          id?: string
          itinerary_day_id: string
          kid_friendly?: boolean | null
          location_area?: string | null
          maps_query?: string | null
          time_block: string
          title: string
          transit_tip?: string | null
        }
        Update: {
          assumptions?: string | null
          cost_max?: number | null
          cost_min?: number | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          food_related?: boolean | null
          id?: string
          itinerary_day_id?: string
          kid_friendly?: boolean | null
          location_area?: string | null
          maps_query?: string | null
          time_block?: string
          title?: string
          transit_tip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_items_itinerary_day_id_fkey"
            columns: ["itinerary_day_id"]
            isOneToOne: false
            referencedRelation: "itinerary_days"
            referencedColumns: ["id"]
          },
        ]
      }
      place_verifications: {
        Row: {
          address: string | null
          best_name: string | null
          created_at: string
          id: string
          itinerary_item_id: string
          lat: number | null
          lng: number | null
          quality_score: number
          query: string
          reasoning: string | null
          sources: Json
          status: string
          trip_id: string
        }
        Insert: {
          address?: string | null
          best_name?: string | null
          created_at?: string
          id?: string
          itinerary_item_id: string
          lat?: number | null
          lng?: number | null
          quality_score?: number
          query: string
          reasoning?: string | null
          sources?: Json
          status?: string
          trip_id: string
        }
        Update: {
          address?: string | null
          best_name?: string | null
          created_at?: string
          id?: string
          itinerary_item_id?: string
          lat?: number | null
          lng?: number | null
          quality_score?: number
          query?: string
          reasoning?: string | null
          sources?: Json
          status?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_verifications_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      preferences: {
        Row: {
          created_at: string
          default_budget: number | null
          diet: string | null
          food_style: string | null
          id: string
          interests: Json | null
          pace: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_budget?: number | null
          diet?: string | null
          food_style?: string | null
          id?: string
          interests?: Json | null
          pace?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_budget?: number | null
          diet?: string | null
          food_style?: string | null
          id?: string
          interests?: Json | null
          pace?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          email: string | null
          home_city: string | null
          id: string
          lifetime_generations_used: number | null
          name: string | null
          period_generations_used: number | null
          plan: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          email?: string | null
          home_city?: string | null
          id: string
          lifetime_generations_used?: number | null
          name?: string | null
          period_generations_used?: number | null
          plan?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          email?: string | null
          home_city?: string | null
          id?: string
          lifetime_generations_used?: number | null
          name?: string | null
          period_generations_used?: number | null
          plan?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          date: string
          generation_count: number | null
          id: string
          user_id: string
        }
        Insert: {
          date?: string
          generation_count?: number | null
          id?: string
          user_id: string
        }
        Update: {
          date?: string
          generation_count?: number | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      terms_acceptance: {
        Row: {
          accepted: boolean | null
          accepted_at: string
          id: string
          user_id: string
          version: string
        }
        Insert: {
          accepted?: boolean | null
          accepted_at?: string
          id?: string
          user_id: string
          version?: string
        }
        Update: {
          accepted?: boolean | null
          accepted_at?: string
          id?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      trip_answers: {
        Row: {
          answer_json: Json
          created_at: string
          id: string
          question_key: string
          trip_id: string
        }
        Insert: {
          answer_json: Json
          created_at?: string
          id?: string
          question_key: string
          trip_id: string
        }
        Update: {
          answer_json?: Json
          created_at?: string
          id?: string
          question_key?: string
          trip_id?: string
        }
        Relationships: []
      }
      trip_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "trip_chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_chat_threads: {
        Row: {
          created_at: string
          id: string
          trip_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          trip_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_chat_threads_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_collaborators: {
        Row: {
          accepted_at: string | null
          email: string
          id: string
          invited_at: string
          invited_by: string
          role: string
          status: string
          trip_id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          email: string
          id?: string
          invited_at?: string
          invited_by: string
          role?: string
          status?: string
          trip_id: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          email?: string
          id?: string
          invited_at?: string
          invited_by?: string
          role?: string
          status?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_collaborators_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          trip_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          trip_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_messages_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_places: {
        Row: {
          created_at: string
          id: string
          lat: number
          lng: number
          metadata: Json
          name: string
          source: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lat: number
          lng: number
          metadata?: Json
          name: string
          source?: string
          trip_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          metadata?: Json
          name?: string
          source?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_places_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_reminders: {
        Row: {
          created_at: string
          days_before: number
          email: string
          id: string
          reminder_type: string
          scheduled_for: string
          sent_at: string | null
          trip_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_before?: number
          email: string
          id?: string
          reminder_type?: string
          scheduled_for: string
          sent_at?: string | null
          trip_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          days_before?: number
          email?: string
          id?: string
          reminder_type?: string
          scheduled_for?: string
          sent_at?: string | null
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_reminders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_settings: {
        Row: {
          auto_verify: boolean
          created_at: string
          trip_id: string
          verify_mode: string
        }
        Insert: {
          auto_verify?: boolean
          created_at?: string
          trip_id: string
          verify_mode?: string
        }
        Update: {
          auto_verify?: boolean
          created_at?: string
          trip_id?: string
          verify_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_settings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_share_tokens: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          token: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          token: string
          trip_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          token?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_share_tokens_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          adults_count: number | null
          budget_inr: number
          budget_style: string | null
          created_at: string
          destination: string
          diet: string | null
          duration_days: number | null
          end_date: string
          food_pref: string | null
          id: string
          interests: Json | null
          is_family: boolean | null
          kids_count: number | null
          notes: string | null
          pace: string | null
          people_count: number | null
          selected_itinerary_id: string | null
          start_date: string
          status: string | null
          stay_preference: string | null
          travel_style: string | null
          travelers: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adults_count?: number | null
          budget_inr: number
          budget_style?: string | null
          created_at?: string
          destination: string
          diet?: string | null
          duration_days?: number | null
          end_date: string
          food_pref?: string | null
          id?: string
          interests?: Json | null
          is_family?: boolean | null
          kids_count?: number | null
          notes?: string | null
          pace?: string | null
          people_count?: number | null
          selected_itinerary_id?: string | null
          start_date: string
          status?: string | null
          stay_preference?: string | null
          travel_style?: string | null
          travelers?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adults_count?: number | null
          budget_inr?: number
          budget_style?: string | null
          created_at?: string
          destination?: string
          diet?: string | null
          duration_days?: number | null
          end_date?: string
          food_pref?: string | null
          id?: string
          interests?: Json | null
          is_family?: boolean | null
          kids_count?: number | null
          notes?: string | null
          pace?: string | null
          people_count?: number | null
          selected_itinerary_id?: string | null
          start_date?: string
          status?: string | null
          stay_preference?: string | null
          travel_style?: string | null
          travelers?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      you_search_cache: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          query: string
          query_hash: string
          results: Json
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          query: string
          query_hash: string
          results?: Json
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          query?: string
          query_hash?: string
          results?: Json
        }
        Relationships: []
      }
      you_search_rate_limits: {
        Row: {
          date: string
          id: string
          search_count: number
          user_id: string
        }
        Insert: {
          date?: string
          id?: string
          search_count?: number
          user_id: string
        }
        Update: {
          date?: string
          id?: string
          search_count?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_shared_itinerary: {
        Args: { share_token: string }
        Returns: {
          cons: string[]
          days: Json
          disclaimers: Json
          general_tips: Json
          id: string
          is_best_option: boolean
          option_index: number
          option_label: string
          pace: string
          pros: string[]
          recommended: boolean
          summary: string
          title: string
          total_cost_max: number
          total_cost_min: number
          trip_id: string
          why_good_for_you: string
        }[]
      }
      get_shared_trip: {
        Args: { share_token: string }
        Returns: {
          budget_inr: number
          destination: string
          end_date: string
          is_family: boolean
          selected_itinerary_id: string
          start_date: string
          trip_id: string
        }[]
      }
      get_user_quota: { Args: { p_user_id?: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_lifetime_generations: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      increment_period_generations: {
        Args: { p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "user" | "admin"
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
      app_role: ["user", "admin"],
    },
  },
} as const
