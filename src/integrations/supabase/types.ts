export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      appointments: {
        Row: {
          address_id: string | null;
          created_at: string;
          id: string;
          logistics_type: string;
          notes: string | null;
          ops_status: string;
          origin: string | null;
          paid_at: string | null;
          payment_method: string | null;
          payment_status: string;
          pet_id: string | null;
          scheduled_at: string;
          service_id: string | null;
          service_price_cents: number;
          status: string;
          total_cents: number;
          transport_price_cents: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          address_id?: string | null;
          created_at?: string;
          id?: string;
          logistics_type?: string;
          notes?: string | null;
          ops_status?: string;
          origin?: string | null;
          paid_at?: string | null;
          payment_method?: string | null;
          payment_status?: string;
          pet_id?: string | null;
          scheduled_at: string;
          service_id?: string | null;
          service_price_cents?: number;
          status?: string;
          total_cents?: number;
          transport_price_cents?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          address_id?: string | null;
          created_at?: string;
          id?: string;
          logistics_type?: string;
          notes?: string | null;
          ops_status?: string;
          origin?: string | null;
          paid_at?: string | null;
          payment_method?: string | null;
          payment_status?: string;
          pet_id?: string | null;
          scheduled_at?: string;
          service_id?: string | null;
          service_price_cents?: number;
          status?: string;
          total_cents?: number;
          transport_price_cents?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_address_id_fkey";
            columns: ["address_id"];
            isOneToOne: false;
            referencedRelation: "addresses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_pet_id_fkey";
            columns: ["pet_id"];
            isOneToOne: false;
            referencedRelation: "pets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      addresses: {
        Row: {
          cep: string | null;
          city: string;
          complement: string | null;
          created_at: string;
          district: string;
          id: string;
          is_default: boolean;
          label: string;
          number: string | null;
          reference: string | null;
          state: string;
          street: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cep?: string | null;
          city?: string;
          complement?: string | null;
          created_at?: string;
          district: string;
          id?: string;
          is_default?: boolean;
          label?: string;
          number?: string | null;
          reference?: string | null;
          state?: string;
          street: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cep?: string | null;
          city?: string;
          complement?: string | null;
          created_at?: string;
          district?: string;
          id?: string;
          is_default?: boolean;
          label?: string;
          number?: string | null;
          reference?: string | null;
          state?: string;
          street?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      delivery_zones: {
        Row: {
          active: boolean;
          created_at: string;
          districts: string[];
          eta_minutes: number;
          free_above_cents: number | null;
          id: string;
          name: string;
          notes: string | null;
          price_cents: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          districts?: string[];
          eta_minutes?: number;
          free_above_cents?: number | null;
          id?: string;
          name: string;
          notes?: string | null;
          price_cents?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          districts?: string[];
          eta_minutes?: number;
          free_above_cents?: number | null;
          id?: string;
          name?: string;
          notes?: string | null;
          price_cents?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      transport_orders: {
        Row: {
          address_id: string | null;
          appointment_id: string;
          arrived_shop_at: string | null;
          assigned_at: string | null;
          code: number;
          created_at: string;
          delivered_at: string | null;
          driver_id: string | null;
          en_route_pickup_at: string | null;
          en_route_return_at: string | null;
          fee_breakdown: Json | null;
          id: string;
          pickup_condition: string | null;
          pickup_confirmed_by: string | null;
          pickup_lat: number | null;
          pickup_lng: number | null;
          pickup_notes: string | null;
          picked_up_at: string | null;
          pickup_window_end: string | null;
          pickup_window_start: string | null;
          price_cents: number;
          return_condition: string | null;
          return_confirmed_by: string | null;
          return_lat: number | null;
          return_lng: number | null;
          return_notes: string | null;
          return_window_end: string | null;
          return_window_start: string | null;
          tutor_confirmed_at: string | null;
          updated_at: string;
          zone_id: string | null;
        };
        Insert: {
          address_id?: string | null;
          appointment_id: string;
          arrived_shop_at?: string | null;
          assigned_at?: string | null;
          code?: number;
          created_at?: string;
          delivered_at?: string | null;
          driver_id?: string | null;
          en_route_pickup_at?: string | null;
          en_route_return_at?: string | null;
          fee_breakdown?: Json | null;
          id?: string;
          pickup_condition?: string | null;
          pickup_confirmed_by?: string | null;
          pickup_lat?: number | null;
          pickup_lng?: number | null;
          pickup_notes?: string | null;
          picked_up_at?: string | null;
          pickup_window_end?: string | null;
          pickup_window_start?: string | null;
          price_cents?: number;
          return_condition?: string | null;
          return_confirmed_by?: string | null;
          return_lat?: number | null;
          return_lng?: number | null;
          return_notes?: string | null;
          return_window_end?: string | null;
          return_window_start?: string | null;
          tutor_confirmed_at?: string | null;
          updated_at?: string;
          zone_id?: string | null;
        };
        Update: {
          address_id?: string | null;
          appointment_id?: string;
          arrived_shop_at?: string | null;
          assigned_at?: string | null;
          code?: number;
          created_at?: string;
          delivered_at?: string | null;
          driver_id?: string | null;
          en_route_pickup_at?: string | null;
          en_route_return_at?: string | null;
          fee_breakdown?: Json | null;
          id?: string;
          pickup_condition?: string | null;
          pickup_confirmed_by?: string | null;
          pickup_lat?: number | null;
          pickup_lng?: number | null;
          pickup_notes?: string | null;
          picked_up_at?: string | null;
          pickup_window_end?: string | null;
          pickup_window_start?: string | null;
          price_cents?: number;
          return_condition?: string | null;
          return_confirmed_by?: string | null;
          return_lat?: number | null;
          return_lng?: number | null;
          return_notes?: string | null;
          return_window_end?: string | null;
          return_window_start?: string | null;
          tutor_confirmed_at?: string | null;
          updated_at?: string;
          zone_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "transport_orders_address_id_fkey";
            columns: ["address_id"];
            isOneToOne: false;
            referencedRelation: "addresses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transport_orders_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: true;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transport_orders_zone_id_fkey";
            columns: ["zone_id"];
            isOneToOne: false;
            referencedRelation: "delivery_zones";
            referencedColumns: ["id"];
          },
        ];
      };
      pet_status_history: {
        Row: {
          appointment_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          note: string | null;
          status: string;
        };
        Insert: {
          appointment_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          note?: string | null;
          status: string;
        };
        Update: {
          appointment_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          note?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pet_status_history_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          appointment_id: string;
          comment: string | null;
          created_at: string;
          id: string;
          rating_overall: number;
          rating_service: number | null;
          rating_transport: number | null;
          user_id: string;
        };
        Insert: {
          appointment_id: string;
          comment?: string | null;
          created_at?: string;
          id?: string;
          rating_overall: number;
          rating_service?: number | null;
          rating_transport?: number | null;
          user_id: string;
        };
        Update: {
          appointment_id?: string;
          comment?: string | null;
          created_at?: string;
          id?: string;
          rating_overall?: number;
          rating_service?: number | null;
          rating_transport?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: true;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
        ];
      };
      transport_settings: {
        Row: {
          id: boolean;
          returning_client_discount_percent: number | null;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          returning_client_discount_percent?: number | null;
          updated_at?: string;
        };
        Update: {
          id?: boolean;
          returning_client_discount_percent?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      transport_coupons: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          discount_type: string;
          discount_value: number;
          expires_at: string | null;
          id: string;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          discount_type: string;
          discount_value: number;
          expires_at?: string | null;
          id?: string;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          discount_type?: string;
          discount_value?: number;
          expires_at?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      care_reminders: {
        Row: {
          completed: boolean;
          created_at: string;
          due_date: string;
          id: string;
          notes: string | null;
          pet_id: string;
          reminder_type: string;
          source_record_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          completed?: boolean;
          created_at?: string;
          due_date: string;
          id?: string;
          notes?: string | null;
          pet_id: string;
          reminder_type?: string;
          source_record_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          completed?: boolean;
          created_at?: string;
          due_date?: string;
          id?: string;
          notes?: string | null;
          pet_id?: string;
          reminder_type?: string;
          source_record_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "care_reminders_pet_id_fkey";
            columns: ["pet_id"];
            isOneToOne: false;
            referencedRelation: "pets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "care_reminders_source_record_id_fkey";
            columns: ["source_record_id"];
            isOneToOne: false;
            referencedRelation: "medical_records";
            referencedColumns: ["id"];
          },
        ];
      };
      medical_records: {
        Row: {
          attachments: string[];
          created_at: string;
          diagnosis: string | null;
          dosage: string | null;
          duration: string | null;
          id: string;
          medication: string | null;
          next_return_date: string | null;
          notes: string | null;
          pet_id: string;
          prescription: string | null;
          reason: string;
          record_type: string;
          treatment: string | null;
          updated_at: string;
          vet_name: string | null;
          visit_at: string;
          weight_kg: number | null;
        };
        Insert: {
          attachments?: string[];
          created_at?: string;
          diagnosis?: string | null;
          dosage?: string | null;
          duration?: string | null;
          id?: string;
          medication?: string | null;
          next_return_date?: string | null;
          notes?: string | null;
          pet_id: string;
          prescription?: string | null;
          reason: string;
          record_type?: string;
          treatment?: string | null;
          updated_at?: string;
          vet_name?: string | null;
          visit_at?: string;
          weight_kg?: number | null;
        };
        Update: {
          attachments?: string[];
          created_at?: string;
          diagnosis?: string | null;
          dosage?: string | null;
          duration?: string | null;
          id?: string;
          medication?: string | null;
          next_return_date?: string | null;
          notes?: string | null;
          pet_id?: string;
          prescription?: string | null;
          reason?: string;
          record_type?: string;
          treatment?: string | null;
          updated_at?: string;
          vet_name?: string | null;
          visit_at?: string;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "medical_records_pet_id_fkey";
            columns: ["pet_id"];
            isOneToOne: false;
            referencedRelation: "pets";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          unit_price_cents: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          product_name: string;
          quantity?: number;
          unit_price_cents?: number;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string | null;
          product_name?: string;
          quantity?: number;
          unit_price_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          created_at: string;
          customer_name: string | null;
          id: string;
          notes: string | null;
          phone: string | null;
          status: string;
          total_cents: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          customer_name?: string | null;
          id?: string;
          notes?: string | null;
          phone?: string | null;
          status?: string;
          total_cents?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          customer_name?: string | null;
          id?: string;
          notes?: string | null;
          phone?: string | null;
          status?: string;
          total_cents?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      pets: {
        Row: {
          allergies: string | null;
          birth_date: string | null;
          breed: string | null;
          color: string | null;
          created_at: string;
          id: string;
          name: string;
          notes: string | null;
          owner_id: string;
          photo_url: string | null;
          preferred_vet: string | null;
          sex: string | null;
          size: string;
          special_care: string | null;
          species: string;
          temperament: string | null;
          weight_kg: number | null;
        };
        Insert: {
          allergies?: string | null;
          birth_date?: string | null;
          breed?: string | null;
          color?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          notes?: string | null;
          owner_id: string;
          photo_url?: string | null;
          preferred_vet?: string | null;
          sex?: string | null;
          size?: string;
          special_care?: string | null;
          species?: string;
          temperament?: string | null;
          weight_kg?: number | null;
        };
        Update: {
          allergies?: string | null;
          birth_date?: string | null;
          breed?: string | null;
          color?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          owner_id?: string;
          photo_url?: string | null;
          preferred_vet?: string | null;
          sex?: string | null;
          size?: string;
          special_care?: string | null;
          species?: string;
          temperament?: string | null;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      products: {
        Row: {
          active: boolean;
          category: string;
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          name: string;
          price_cents: number;
          stock: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          category?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          name: string;
          price_cents?: number;
          stock?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          category?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          name?: string;
          price_cents?: number;
          stock?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          birth_date: string | null;
          cpf: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          phone: string | null;
          preferred_payment: string | null;
          updated_at: string;
          vehicle_type: string | null;
        };
        Insert: {
          birth_date?: string | null;
          cpf?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          preferred_payment?: string | null;
          updated_at?: string;
          vehicle_type?: string | null;
        };
        Update: {
          birth_date?: string | null;
          cpf?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          preferred_payment?: string | null;
          updated_at?: string;
          vehicle_type?: string | null;
        };
        Relationships: [];
      };
      services: {
        Row: {
          active: boolean;
          category: string;
          created_at: string;
          description: string | null;
          duration_min: number;
          id: string;
          name: string;
          price_cents: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          category?: string;
          created_at?: string;
          description?: string | null;
          duration_min?: number;
          id?: string;
          name: string;
          price_cents?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          category?: string;
          created_at?: string;
          description?: string | null;
          duration_min?: number;
          id?: string;
          name?: string;
          price_cents?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      vaccinations: {
        Row: {
          applied_at: string;
          created_at: string;
          dose: string | null;
          id: string;
          next_due_at: string | null;
          notes: string | null;
          pet_id: string;
          updated_at: string;
          vaccine_name: string;
          vet_name: string | null;
        };
        Insert: {
          applied_at?: string;
          created_at?: string;
          dose?: string | null;
          id?: string;
          next_due_at?: string | null;
          notes?: string | null;
          pet_id: string;
          updated_at?: string;
          vaccine_name: string;
          vet_name?: string | null;
        };
        Update: {
          applied_at?: string;
          created_at?: string;
          dose?: string | null;
          id?: string;
          next_due_at?: string | null;
          notes?: string | null;
          pet_id?: string;
          updated_at?: string;
          vaccine_name?: string;
          vet_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "vaccinations_pet_id_fkey";
            columns: ["pet_id"];
            isOneToOne: false;
            referencedRelation: "pets";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_order_driver: {
        Args: {
          _appointment_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "cliente" | "motorista";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "cliente", "motorista"],
    },
  },
} as const;
