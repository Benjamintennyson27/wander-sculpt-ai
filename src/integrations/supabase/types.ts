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
      itineraries: {
        Row: {
          created_at: string
          days: Json
          disclaimers: Json | null
          general_tips: Json | null
          id: string
          is_best_option: boolean | null
          option_index: number
          summary: string | null
          title: string
          trip_id: string
          why_good_for_you: string | null
        }
        Insert: {
          created_at?: string
          days?: Json
          disclaimers?: Json | null
          general_tips?: Json | null
          id?: string
          is_best_option?: boolean | null
          option_index: number
          summary?: string | null
          title: string
          trip_id: string
          why_good_for_you?: string | null
        }
        Update: {
          created_at?: string
          days?: Json
          disclaimers?: Json | null
          general_tips?: Json | null
          id?: string
          is_best_option?: boolean | null
          option_index?: number
          summary?: string | null
          title?: string
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
          home_city: string | null
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          home_city?: string | null
          id: string
          name?: string | null
        }
        Update: {
          created_at?: string
          home_city?: string | null
          id?: string
          name?: string | null
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
          accepted_at: string
          id: string
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          user_id: string
          version?: string
        }
        Update: {
          accepted_at?: string
          id?: string
          user_id?: string
          version?: string
        }
        Relationships: []
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
      trips: {
        Row: {
          budget_inr: number
          budget_style: string | null
          created_at: string
          destination: string
          diet: string | null
          end_date: string
          food_pref: string | null
          id: string
          interests: Json | null
          is_family: boolean | null
          pace: string | null
          selected_itinerary_id: string | null
          start_date: string
          status: string | null
          stay_preference: string | null
          travelers: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_inr: number
          budget_style?: string | null
          created_at?: string
          destination: string
          diet?: string | null
          end_date: string
          food_pref?: string | null
          id?: string
          interests?: Json | null
          is_family?: boolean | null
          pace?: string | null
          selected_itinerary_id?: string | null
          start_date: string
          status?: string | null
          stay_preference?: string | null
          travelers?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          budget_inr?: number
          budget_style?: string | null
          created_at?: string
          destination?: string
          diet?: string | null
          end_date?: string
          food_pref?: string | null
          id?: string
          interests?: Json | null
          is_family?: boolean | null
          pace?: string | null
          selected_itinerary_id?: string | null
          start_date?: string
          status?: string | null
          stay_preference?: string | null
          travelers?: Json | null
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
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
