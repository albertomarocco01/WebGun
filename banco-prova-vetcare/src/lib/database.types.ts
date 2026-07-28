export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      animals: {
        Row: {
          birth_date: string | null
          breed: string | null
          created_at: string
          deceased_at: string | null
          id: string
          microchip: string | null
          name: string
          owner_id: string
          sex: string
          species_id: string
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          breed?: string | null
          created_at?: string
          deceased_at?: string | null
          id?: string
          microchip?: string | null
          name: string
          owner_id: string
          sex: string
          species_id: string
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          breed?: string | null
          created_at?: string
          deceased_at?: string | null
          id?: string
          microchip?: string | null
          name?: string
          owner_id?: string
          sex?: string
          species_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "animals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      diagnoses: {
        Row: {
          code: string | null
          created_at: string
          description: string
          id: string
          medical_record_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description: string
          id?: string
          medical_record_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string
          id?: string
          medical_record_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnoses_medical_record_id_fkey"
            columns: ["medical_record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnoses_medical_record_id_fkey"
            columns: ["medical_record_id"]
            isOneToOne: false
            referencedRelation: "v_cartella_animale"
            referencedColumns: ["medical_record_id"]
          },
        ]
      }
      internal_notes: {
        Row: {
          author_staff_id: string
          body: string
          created_at: string
          id: string
          medical_record_id: string
          updated_at: string
        }
        Insert: {
          author_staff_id: string
          body: string
          created_at?: string
          id?: string
          medical_record_id: string
          updated_at?: string
        }
        Update: {
          author_staff_id?: string
          body?: string
          created_at?: string
          id?: string
          medical_record_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_notes_author_staff_id_fkey"
            columns: ["author_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_notes_medical_record_id_fkey"
            columns: ["medical_record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_notes_medical_record_id_fkey"
            columns: ["medical_record_id"]
            isOneToOne: false
            referencedRelation: "v_cartella_animale"
            referencedColumns: ["medical_record_id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          quantity: number
          service_name: string
          unit_price_cents: number
          updated_at: string
          visit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          quantity?: number
          service_name: string
          unit_price_cents: number
          updated_at?: string
          visit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          quantity?: number
          service_name?: string
          unit_price_cents?: number
          updated_at?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: true
            referencedRelation: "v_cartella_animale"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "invoice_lines_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: true
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          due_on: string
          id: string
          issued_on: string
          number: string
          owner_id: string
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_on: string
          id?: string
          issued_on: string
          number: string
          owner_id: string
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_on?: string
          id?: string
          issued_on?: string
          number?: string
          owner_id?: string
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_record_revisions: {
        Row: {
          clinical_summary: string
          created_at: string
          id: string
          medical_record_id: string
          owner_note: string | null
          replaced_at: string
          updated_at: string
        }
        Insert: {
          clinical_summary: string
          created_at?: string
          id?: string
          medical_record_id: string
          owner_note?: string | null
          replaced_at?: string
          updated_at?: string
        }
        Update: {
          clinical_summary?: string
          created_at?: string
          id?: string
          medical_record_id?: string
          owner_note?: string | null
          replaced_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_record_revisions_medical_record_id_fkey"
            columns: ["medical_record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_record_revisions_medical_record_id_fkey"
            columns: ["medical_record_id"]
            isOneToOne: false
            referencedRelation: "v_cartella_animale"
            referencedColumns: ["medical_record_id"]
          },
        ]
      }
      medical_records: {
        Row: {
          clinical_summary: string
          created_at: string
          created_by: string
          id: string
          owner_note: string | null
          updated_at: string
          visit_id: string
        }
        Insert: {
          clinical_summary: string
          created_at?: string
          created_by: string
          id?: string
          owner_note?: string | null
          updated_at?: string
          visit_id: string
        }
        Update: {
          clinical_summary?: string
          created_at?: string
          created_by?: string
          id?: string
          owner_note?: string | null
          updated_at?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: true
            referencedRelation: "v_cartella_animale"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "medical_records_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: true
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          anonymized_at: string | null
          auth_user_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          owner_type: string
          phone: string | null
          tax_code: string | null
          updated_at: string
        }
        Insert: {
          anonymized_at?: string | null
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          owner_type: string
          phone?: string | null
          tax_code?: string | null
          updated_at?: string
        }
        Update: {
          anonymized_at?: string | null
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          owner_type?: string
          phone?: string | null
          tax_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prescriptions: {
        Row: {
          created_at: string
          dosage: string
          drug_name: string
          duration_days: number | null
          id: string
          medical_record_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dosage: string
          drug_name: string
          duration_days?: number | null
          id?: string
          medical_record_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dosage?: string
          drug_name?: string
          duration_days?: number | null
          id?: string
          medical_record_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_medical_record_id_fkey"
            columns: ["medical_record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_medical_record_id_fkey"
            columns: ["medical_record_id"]
            isOneToOne: false
            referencedRelation: "v_cartella_animale"
            referencedColumns: ["medical_record_id"]
          },
        ]
      }
      price_list_items: {
        Row: {
          created_at: string
          id: string
          price_cents: number
          price_list_id: string
          service_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          price_cents: number
          price_list_id: string
          service_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          price_cents?: number
          price_list_id?: string
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_items_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string | null
          updated_at: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id?: string | null
          updated_at?: string
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string | null
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_lists_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          base_price_cents: number
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          base_price_cents: number
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          base_price_cents?: number
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      species: {
        Row: {
          code: string
          created_at: string
          id: string
          label: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          label: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          auth_user_id: string
          clinic_id: string
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          job_title: string
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          clinic_id: string
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          job_title: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          clinic_id?: string
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          job_title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      treatments: {
        Row: {
          administered_at: string
          created_at: string
          description: string
          id: string
          medical_record_id: string
          updated_at: string
        }
        Insert: {
          administered_at?: string
          created_at?: string
          description: string
          id?: string
          medical_record_id: string
          updated_at?: string
        }
        Update: {
          administered_at?: string
          created_at?: string
          description?: string
          id?: string
          medical_record_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatments_medical_record_id_fkey"
            columns: ["medical_record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_medical_record_id_fkey"
            columns: ["medical_record_id"]
            isOneToOne: false
            referencedRelation: "v_cartella_animale"
            referencedColumns: ["medical_record_id"]
          },
        ]
      }
      vaccinations: {
        Row: {
          administered_on: string
          animal_id: string
          created_at: string
          id: string
          next_due_on: string | null
          updated_at: string
          vaccine_name: string
          visit_id: string | null
        }
        Insert: {
          administered_on: string
          animal_id: string
          created_at?: string
          id?: string
          next_due_on?: string | null
          updated_at?: string
          vaccine_name: string
          visit_id?: string | null
        }
        Update: {
          administered_on?: string
          animal_id?: string
          created_at?: string
          id?: string
          next_due_on?: string | null
          updated_at?: string
          vaccine_name?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vaccinations_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccinations_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "v_cartella_animale"
            referencedColumns: ["animal_id"]
          },
          {
            foreignKeyName: "vaccinations_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "v_cartella_animale"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "vaccinations_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          animal_id: string
          cancelled_at: string | null
          clinic_id: string
          created_at: string
          ends_at: string
          id: string
          scheduled_at: string
          service_id: string
          staff_id: string
          status: string
          updated_at: string
        }
        Insert: {
          animal_id: string
          cancelled_at?: string | null
          clinic_id: string
          created_at?: string
          ends_at: string
          id?: string
          scheduled_at: string
          service_id: string
          staff_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          animal_id?: string
          cancelled_at?: string | null
          clinic_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          scheduled_at?: string
          service_id?: string
          staff_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "v_cartella_animale"
            referencedColumns: ["animal_id"]
          },
          {
            foreignKeyName: "visits_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_staff_id_clinic_id_fkey"
            columns: ["staff_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
    }
    Views: {
      v_cartella_animale: {
        Row: {
          animal_id: string | null
          animal_name: string | null
          clinic_name: string | null
          clinical_summary: string | null
          medical_record_id: string | null
          owner_note: string | null
          record_created_at: string | null
          scheduled_at: string | null
          status: string | null
          visit_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      e_mio_listino: { Args: { listino: string }; Returns: boolean }
      e_staff: { Args: never; Returns: boolean }
      mia_cartella: { Args: { cartella: string }; Returns: boolean }
      mia_fattura: { Args: { fattura: string }; Returns: boolean }
      mia_visita: { Args: { visita: string }; Returns: boolean }
      mio_animale: { Args: { animale: string }; Returns: boolean }
      mio_owner_id: { Args: never; Returns: string }
      puo_vedere_cartella: { Args: { cartella: string }; Returns: boolean }
      puo_vedere_clinica: { Args: { clinica: string }; Returns: boolean }
      puo_vedere_visita: { Args: { visita: string }; Returns: boolean }
      sposta_visita: {
        Args: { nuova_fine: string; nuovo_inizio: string; visita: string }
        Returns: {
          animal_id: string
          cancelled_at: string | null
          clinic_id: string
          created_at: string
          ends_at: string
          id: string
          scheduled_at: string
          service_id: string
          staff_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "visits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

