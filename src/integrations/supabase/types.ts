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
      analytics_events: {
        Row: {
          created_at: string
          device: string | null
          event: string
          id: string
          item_id: string | null
          meta: Json
          order_id: string | null
          path: string | null
          restaurant_id: string | null
          session_id: string
          user_id: string | null
          value: number | null
        }
        Insert: {
          created_at?: string
          device?: string | null
          event: string
          id?: string
          item_id?: string | null
          meta?: Json
          order_id?: string | null
          path?: string | null
          restaurant_id?: string | null
          session_id: string
          user_id?: string | null
          value?: number | null
        }
        Update: {
          created_at?: string
          device?: string | null
          event?: string
          id?: string
          item_id?: string | null
          meta?: Json
          order_id?: string | null
          path?: string | null
          restaurant_id?: string | null
          session_id?: string
          user_id?: string | null
          value?: number | null
        }
        Relationships: []
      }
      blocked_phones: {
        Row: {
          blocked_by: string | null
          created_at: string
          id: string
          phone: string
          reason: string | null
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string
          id?: string
          phone: string
          reason?: string | null
        }
        Update: {
          blocked_by?: string | null
          created_at?: string
          id?: string
          phone?: string
          reason?: string | null
        }
        Relationships: []
      }
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
      cod_restrictions: {
        Row: {
          created_at: string
          disabled_until: string
          reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          disabled_until: string
          reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          disabled_until?: string
          reason?: string | null
          updated_at?: string
          user_id?: string
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
      delivery_offers: {
        Row: {
          created_at: string
          distance_km: number | null
          expires_at: string | null
          id: string
          offered_at: string | null
          order_id: string
          rank: number
          responded_at: string | null
          rider_id: string
          status: string
        }
        Insert: {
          created_at?: string
          distance_km?: number | null
          expires_at?: string | null
          id?: string
          offered_at?: string | null
          order_id: string
          rank: number
          responded_at?: string | null
          rider_id: string
          status?: string
        }
        Update: {
          created_at?: string
          distance_km?: number | null
          expires_at?: string | null
          id?: string
          offered_at?: string | null
          order_id?: string
          rank?: number
          responded_at?: string | null
          rider_id?: string
          status?: string
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          city: string | null
          created_at: string
          delivery_charge: number | null
          id: string
          is_active: boolean
          name: string
          polygon: Json
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          delivery_charge?: number | null
          id?: string
          is_active?: boolean
          name: string
          polygon?: Json
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          delivery_charge?: number | null
          id?: string
          is_active?: boolean
          name?: string
          polygon?: Json
          updated_at?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          half_offer_price: number | null
          half_price: number | null
          id: string
          image_url: string | null
          is_available: boolean
          is_out_of_stock: boolean
          name: string
          offer_price: number | null
          price: number
          price_250g: number | null
          price_2pound: number | null
          price_500g: number | null
          price_half_pound: number | null
          price_kg: number | null
          price_piece: number | null
          price_pound: number | null
          restaurant_id: string | null
          veg_type: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          half_offer_price?: number | null
          half_price?: number | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_out_of_stock?: boolean
          name: string
          offer_price?: number | null
          price: number
          price_250g?: number | null
          price_2pound?: number | null
          price_500g?: number | null
          price_half_pound?: number | null
          price_kg?: number | null
          price_piece?: number | null
          price_pound?: number | null
          restaurant_id?: string | null
          veg_type?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          half_offer_price?: number | null
          half_price?: number | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_out_of_stock?: boolean
          name?: string
          offer_price?: number | null
          price?: number
          price_250g?: number | null
          price_2pound?: number | null
          price_500g?: number | null
          price_half_pound?: number | null
          price_kg?: number | null
          price_piece?: number | null
          price_pound?: number | null
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
      notification_log: {
        Row: {
          created_at: string
          delivery_error: string | null
          delivery_status: string | null
          delivery_updated_at: string | null
          error: string | null
          error_code: number | null
          error_title: string | null
          event: string
          id: string
          order_id: string | null
          phone: string | null
          provider_sid: string | null
          recipient_type: string
          status: string
          template: string | null
        }
        Insert: {
          created_at?: string
          delivery_error?: string | null
          delivery_status?: string | null
          delivery_updated_at?: string | null
          error?: string | null
          error_code?: number | null
          error_title?: string | null
          event: string
          id?: string
          order_id?: string | null
          phone?: string | null
          provider_sid?: string | null
          recipient_type: string
          status?: string
          template?: string | null
        }
        Update: {
          created_at?: string
          delivery_error?: string | null
          delivery_status?: string | null
          delivery_updated_at?: string | null
          error?: string | null
          error_code?: number | null
          error_title?: string | null
          event?: string
          id?: string
          order_id?: string | null
          phone?: string | null
          provider_sid?: string | null
          recipient_type?: string
          status?: string
          template?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          address: string
          created_at: string
          customer_name: string
          customer_phone: string
          delivery_fee: number
          discount: number
          distance_km: number | null
          flagged_by: string | null
          id: string
          is_fake: boolean
          items: Json
          landmark: string | null
          latitude: number | null
          longitude: number | null
          notes: string | null
          payment_method: string
          platform_fee: number
          rejection_reason: string | null
          released_at: string | null
          restaurant_id: string | null
          rider_id: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string
          zone_id: string | null
        }
        Insert: {
          address: string
          created_at?: string
          customer_name: string
          customer_phone: string
          delivery_fee?: number
          discount?: number
          distance_km?: number | null
          flagged_by?: string | null
          id?: string
          is_fake?: boolean
          items: Json
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          payment_method?: string
          platform_fee?: number
          rejection_reason?: string | null
          released_at?: string | null
          restaurant_id?: string | null
          rider_id?: string | null
          status?: string
          subtotal: number
          total: number
          updated_at?: string
          user_id: string
          zone_id?: string | null
        }
        Update: {
          address?: string
          created_at?: string
          customer_name?: string
          customer_phone?: string
          delivery_fee?: number
          discount?: number
          distance_km?: number | null
          flagged_by?: string | null
          id?: string
          is_fake?: boolean
          items?: Json
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          payment_method?: string
          platform_fee?: number
          rejection_reason?: string | null
          released_at?: string | null
          restaurant_id?: string | null
          rider_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_otps: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          default_delivery_charges: number
          delivery_extra_per_km: number
          delivery_per_km: number
          delivery_slabs: Json
          id: string
          max_delivery_radius_km: number
          platform_fee: number
          privacy: string | null
          support_email: string | null
          support_phone: string | null
          terms: string | null
          updated_at: string
          whatsapp_enabled: boolean
          whatsapp_from: string | null
        }
        Insert: {
          default_delivery_charges?: number
          delivery_extra_per_km?: number
          delivery_per_km?: number
          delivery_slabs?: Json
          id?: string
          max_delivery_radius_km?: number
          platform_fee?: number
          privacy?: string | null
          support_email?: string | null
          support_phone?: string | null
          terms?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_from?: string | null
        }
        Update: {
          default_delivery_charges?: number
          delivery_extra_per_km?: number
          delivery_per_km?: number
          delivery_slabs?: Json
          id?: string
          max_delivery_radius_km?: number
          platform_fee?: number
          privacy?: string | null
          support_email?: string | null
          support_phone?: string | null
          terms?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_from?: string | null
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
      restaurant_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string
          rating: number
          restaurant_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          rating: number
          restaurant_id: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          rating?: number
          restaurant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_ratings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          banner_url: string | null
          closing_time: string | null
          created_at: string
          delivery_charges: number
          delivery_time: string | null
          fssai_image_url: string | null
          fssai_number: string | null
          id: string
          image_url: string | null
          is_open: boolean | null
          latitude: number | null
          longitude: number | null
          min_order_value: number
          name: string
          opening_time: string | null
          owner_id: string | null
          owner_name: string | null
          phone: string | null
          phone_alt: string | null
          rating: number | null
          rating_count: number
          status: string
          tagline: string | null
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          address?: string | null
          banner_url?: string | null
          closing_time?: string | null
          created_at?: string
          delivery_charges?: number
          delivery_time?: string | null
          fssai_image_url?: string | null
          fssai_number?: string | null
          id?: string
          image_url?: string | null
          is_open?: boolean | null
          latitude?: number | null
          longitude?: number | null
          min_order_value?: number
          name: string
          opening_time?: string | null
          owner_id?: string | null
          owner_name?: string | null
          phone?: string | null
          phone_alt?: string | null
          rating?: number | null
          rating_count?: number
          status?: string
          tagline?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          address?: string | null
          banner_url?: string | null
          closing_time?: string | null
          created_at?: string
          delivery_charges?: number
          delivery_time?: string | null
          fssai_image_url?: string | null
          fssai_number?: string | null
          id?: string
          image_url?: string | null
          is_open?: boolean | null
          latitude?: number | null
          longitude?: number | null
          min_order_value?: number
          name?: string
          opening_time?: string | null
          owner_id?: string | null
          owner_name?: string | null
          phone?: string | null
          phone_alt?: string | null
          rating?: number | null
          rating_count?: number
          status?: string
          tagline?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_locations: {
        Row: {
          accuracy: number | null
          created_at: string
          latitude: number
          longitude: number
          rider_id: string
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          latitude: number
          longitude: number
          rider_id: string
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          latitude?: number
          longitude?: number
          rider_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rider_profiles: {
        Row: {
          aadhaar_image_url: string | null
          aadhaar_number: string | null
          base_latitude: number | null
          base_longitude: number | null
          created_at: string
          full_name: string | null
          id: string
          is_online: boolean
          phone: string | null
          status: string
          updated_at: string
          user_id: string
          vehicle: string | null
          zone_id: string | null
        }
        Insert: {
          aadhaar_image_url?: string | null
          aadhaar_number?: string | null
          base_latitude?: number | null
          base_longitude?: number | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_online?: boolean
          phone?: string | null
          status?: string
          updated_at?: string
          user_id: string
          vehicle?: string | null
          zone_id?: string | null
        }
        Update: {
          aadhaar_image_url?: string | null
          aadhaar_number?: string | null
          base_latitude?: number | null
          base_longitude?: number | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_online?: boolean
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vehicle?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rider_profiles_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
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
      verified_phones: {
        Row: {
          id: string
          phone: string
          user_id: string
          verified_at: string
        }
        Insert: {
          id?: string
          phone: string
          user_id: string
          verified_at?: string
        }
        Update: {
          id?: string
          phone?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: []
      }
      zone_managers: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          zone_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zone_managers_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_entities_to_zone: {
        Args: { _zone_id: string }
        Returns: undefined
      }
      become_rider:
        | { Args: never; Returns: undefined }
        | {
            Args: { _full_name?: string; _phone?: string; _vehicle?: string }
            Returns: undefined
          }
        | {
            Args: {
              _aadhaar_image_url: string
              _aadhaar_number: string
              _full_name: string
              _phone: string
              _vehicle: string
            }
            Returns: undefined
          }
      cod_status: {
        Args: { _phone?: string }
        Returns: {
          blocked: boolean
          cod_allowed: boolean
          disabled_until: string
          needs_otp: boolean
          phone_verified: boolean
        }[]
      }
      compute_delivery_fee: {
        Args: { _distance_km: number; _subtotal: number }
        Returns: number
      }
      create_phone_otp: {
        Args: { _code_hash: string; _phone: string; _user_id: string }
        Returns: undefined
      }
      customer_cancel_order: { Args: { _order_id: string }; Returns: undefined }
      expire_stale_delivery_offers: { Args: never; Returns: number }
      first_order_discount_status: {
        Args: never
        Returns: {
          eligible: boolean
          max_amount: number
          percent: number
        }[]
      }
      free_delivery_status: {
        Args: never
        Returns: {
          active: boolean
          remaining: number
          starts_at: string
        }[]
      }
      get_restaurant_contacts: {
        Args: { _restaurant_id: string }
        Returns: {
          phone: string
          phone_alt: string
        }[]
      }
      get_restaurant_phone: {
        Args: { _restaurant_id: string }
        Returns: string
      }
      is_zone_manager_of: { Args: { _zone_id: string }; Returns: boolean }
      my_zone_ids: { Args: never; Returns: string[] }
      order_restaurant_contact: {
        Args: { _order_id: string }
        Returns: {
          phone: string
          restaurant_name: string
        }[]
      }
      order_rider_location: {
        Args: { _order_id: string }
        Returns: {
          latitude: number
          longitude: number
          rider_name: string
          updated_at: string
        }[]
      }
      owner_list_orders: {
        Args: { _limit?: number; _since?: string }
        Returns: {
          created_at: string
          customer_first_name: string
          delivery_fee: number
          distance_km: number
          id: string
          is_fake: boolean
          items: Json
          notes: string
          payment_method: string
          platform_fee: number
          rejection_reason: string
          restaurant_id: string
          rider_id: string
          status: string
          subtotal: number
          total: number
          updated_at: string
        }[]
      }
      owner_order_update_safe: {
        Args: {
          _new: Database["public"]["Tables"]["orders"]["Row"]
          _old: Database["public"]["Tables"]["orders"]["Row"]
        }
        Returns: boolean
      }
      owner_update_order_status: {
        Args: { _order_id: string; _reason?: string; _status: string }
        Returns: undefined
      }
      owns_restaurant_folder: { Args: { _folder: string }; Returns: boolean }
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
      point_in_polygon: {
        Args: { _lat: number; _lng: number; _polygon: Json }
        Returns: boolean
      }
      point_in_zone: { Args: { _lat: number; _lng: number }; Returns: string }
      public_pricing: {
        Args: never
        Returns: {
          delivery_extra_per_km: number
          delivery_per_km: number
          delivery_slabs: Json
          max_delivery_radius_km: number
          platform_fee: number
        }[]
      }
      restaurant_current_status: { Args: { _id: string }; Returns: string }
      restaurant_owner_id: { Args: { _id: string }; Returns: string }
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
      rider_list_offers: {
        Args: never
        Returns: {
          distance_km: number
          drop_area: string
          expires_at: string
          item_count: number
          order_id: string
          restaurant_address: string
          restaurant_name: string
          total: number
        }[]
      }
      rider_mark_delivered: { Args: { _order_id: string }; Returns: undefined }
      rider_set_base_location: {
        Args: { _lat: number; _lng: number }
        Returns: undefined
      }
      rider_set_online: { Args: { _online: boolean }; Returns: undefined }
      rider_update_live_location: {
        Args: { _accuracy?: number; _lat: number; _lng: number }
        Returns: undefined
      }
      set_rider_status: {
        Args: { _status: string; _user_id: string }
        Returns: undefined
      }
      super_assign_rider: {
        Args: { _order_id: string; _rider_id: string }
        Returns: undefined
      }
      super_assign_zone_manager: {
        Args: { _email: string; _zone_id: string }
        Returns: undefined
      }
      super_cancel_order: {
        Args: { _order_id: string; _reason?: string }
        Returns: undefined
      }
      super_flag_fake_order: {
        Args: { _fake: boolean; _order_id: string }
        Returns: undefined
      }
      super_list_restaurant_phones: {
        Args: never
        Returns: {
          id: string
          phone: string
        }[]
      }
      super_list_zone_managers: {
        Args: never
        Returns: {
          email: string
          full_name: string
          user_id: string
          zone_id: string
        }[]
      }
      super_remove_zone_manager: {
        Args: { _user_id: string; _zone_id: string }
        Returns: undefined
      }
      super_set_cod_restriction: {
        Args: { _days: number; _reason?: string; _user_id: string }
        Returns: undefined
      }
      super_zone_stats: {
        Args: { _since?: string; _until?: string }
        Returns: {
          cancelled_count: number
          delivered_count: number
          delivery_fees: number
          food_value: number
          net_profit: number
          orders_count: number
          platform_fees: number
          restaurant_payout: number
          revenue: number
          rider_payout: number
          zone_id: string
          zone_name: string
        }[]
      }
      verify_phone_otp: {
        Args: { _code: string; _phone: string }
        Returns: boolean
      }
      zone_assign_rider: {
        Args: { _order_id: string; _rider_id: string }
        Returns: undefined
      }
      zone_list_customers: {
        Args: { _zone_id: string }
        Returns: {
          full_name: string
          last_order_at: string
          orders_count: number
          phone: string
          total_spent: number
          user_id: string
        }[]
      }
      zone_list_orders: {
        Args: { _limit?: number; _since?: string; _zone_id: string }
        Returns: {
          address: string
          created_at: string
          customer_name: string
          customer_phone: string
          delivery_fee: number
          discount: number
          distance_km: number
          id: string
          is_fake: boolean
          items: Json
          landmark: string
          platform_fee: number
          restaurant_id: string
          restaurant_name: string
          rider_id: string
          rider_name: string
          status: string
          subtotal: number
          total: number
          updated_at: string
        }[]
      }
      zone_list_restaurants: {
        Args: { _zone_id: string }
        Returns: {
          address: string
          id: string
          is_open: boolean
          name: string
          phone: string
          rating: number
          rating_count: number
          status: string
        }[]
      }
      zone_list_riders: {
        Args: { _zone_id: string }
        Returns: {
          full_name: string
          is_online: boolean
          phone: string
          status: string
          user_id: string
        }[]
      }
      zone_my_zones: {
        Args: never
        Returns: {
          city: string
          id: string
          is_active: boolean
          name: string
          polygon: Json
        }[]
      }
      zone_set_restaurant_open: {
        Args: { _is_open: boolean; _restaurant_id: string }
        Returns: undefined
      }
      zone_set_rider_status: {
        Args: { _status: string; _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "customer"
        | "restaurant_admin"
        | "super_admin"
        | "rider"
        | "zone_manager"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "customer",
        "restaurant_admin",
        "super_admin",
        "rider",
        "zone_manager",
      ],
    },
  },
} as const
