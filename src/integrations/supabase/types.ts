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
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          priority: number
          restaurant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          priority?: number
          restaurant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          priority?: number
          restaurant_id?: string | null
        }
        Relationships: []
      }
      customer_blocks: {
        Row: {
          blocked_by: string | null
          created_at: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          blocked_by?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          is_out_of_stock: boolean
          name: string
          offer_price: number | null
          price: number
          restaurant_id: string | null
          veg_type: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_out_of_stock?: boolean
          name: string
          offer_price?: number | null
          price: number
          restaurant_id?: string | null
          veg_type?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_out_of_stock?: boolean
          name?: string
          offer_price?: number | null
          price?: number
          restaurant_id?: string | null
          veg_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          created_at: string
          customer_name: string
          customer_phone: string
          delivery_fee: number
          id: string
          items: Json
          landmark: string | null
          latitude: number | null
          longitude: number | null
          notes: string | null
          payment_method: string
          rejection_reason: string | null
          restaurant_id: string | null
          rider_id: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          customer_name: string
          customer_phone: string
          delivery_fee?: number
          id?: string
          items: Json
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          payment_method?: string
          rejection_reason?: string | null
          restaurant_id?: string | null
          rider_id?: string | null
          status?: string
          subtotal: number
          total: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          customer_name?: string
          customer_phone?: string
          delivery_fee?: number
          id?: string
          items?: Json
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          payment_method?: string
          rejection_reason?: string | null
          restaurant_id?: string | null
          rider_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          default_delivery_charges: number
          id: string
          platform_fee: number
          privacy: string | null
          support_email: string | null
          support_phone: string | null
          terms: string | null
          updated_at: string
        }
        Insert: {
          default_delivery_charges?: number
          id?: string
          platform_fee?: number
          privacy?: string | null
          support_email?: string | null
          support_phone?: string | null
          terms?: string | null
          updated_at?: string
        }
        Update: {
          default_delivery_charges?: number
          id?: string
          platform_fee?: number
          privacy?: string | null
          support_email?: string | null
          support_phone?: string | null
          terms?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          full_name: string | null
          id: string
          landmark: string | null
          latitude: number | null
          longitude: number | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      qr_settings: {
        Row: {
          id: string
          label: string
          target_url: string
          updated_at: string
        }
        Insert: {
          id?: string
          label?: string
          target_url?: string
          updated_at?: string
        }
        Update: {
          id?: string
          label?: string
          target_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          address: string | null
          banner_url: string | null
          closing_time: string | null
          created_at: string
          delivery_charges: number
          delivery_time: string | null
          id: string
          image_url: string | null
          is_open: boolean | null
          latitude: number | null
          longitude: number | null
          min_order_value: number
          name: string
          opening_time: string | null
          owner_id: string | null
          phone: string | null
          rating: number | null
          status: string
          tagline: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          banner_url?: string | null
          closing_time?: string | null
          created_at?: string
          delivery_charges?: number
          delivery_time?: string | null
          id?: string
          image_url?: string | null
          is_open?: boolean | null
          latitude?: number | null
          longitude?: number | null
          min_order_value?: number
          name: string
          opening_time?: string | null
          owner_id?: string | null
          phone?: string | null
          rating?: number | null
          status?: string
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          banner_url?: string | null
          closing_time?: string | null
          created_at?: string
          delivery_charges?: number
          delivery_time?: string | null
          id?: string
          image_url?: string | null
          is_open?: boolean | null
          latitude?: number | null
          longitude?: number | null
          min_order_value?: number
          name?: string
          opening_time?: string | null
          owner_id?: string | null
          phone?: string | null
          rating?: number | null
          status?: string
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rider_profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          status: string
          updated_at: string
          user_id: string
          vehicle: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id: string
          vehicle?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vehicle?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      become_rider:
        | { Args: never; Returns: undefined }
        | {
            Args: { _full_name?: string; _phone?: string; _vehicle?: string }
            Returns: undefined
          }
      owner_order_update_safe: {
        Args: {
          _new: Database["public"]["Tables"]["orders"]["Row"]
          _old: Database["public"]["Tables"]["orders"]["Row"]
        }
        Returns: boolean
      }
      place_order: {
        Args: {
          _address: string
          _customer_name: string
          _customer_phone: string
          _items: Json
          _landmark?: string
          _latitude?: number
          _longitude?: number
          _notes?: string
        }
        Returns: string
      }
      rider_accept_order: { Args: { _order_id: string }; Returns: undefined }
      rider_list_available_orders: {
        Args: never
        Returns: {
          created_at: string
          drop_area: string
          id: string
          item_count: number
          restaurant_address: string
          restaurant_id: string
          restaurant_name: string
          total: number
        }[]
      }
      rider_mark_delivered: { Args: { _order_id: string }; Returns: undefined }
      set_rider_status: {
        Args: { _status: string; _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "customer" | "restaurant_admin" | "super_admin" | "rider"
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
      app_role: ["customer", "restaurant_admin", "super_admin", "rider"],
    },
  },
} as const
