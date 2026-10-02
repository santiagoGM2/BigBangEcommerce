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
      contador_pedido: {
        Row: {
          anio: number
          ultimo: number
        }
        Insert: {
          anio: number
          ultimo?: number
        }
        Update: {
          anio?: number
          ultimo?: number
        }
        Relationships: []
      }
      pedido: {
        Row: {
          comprador_documento: string | null
          comprador_email: string
          comprador_nombre: string
          comprador_telefono: string
          costo_envio: number
          created_at: string
          envio_ciudad: string
          envio_departamento: string | null
          envio_direccion: string
          envio_notas: string | null
          estado: string
          id: string
          metodo_pago: string | null
          numero: string
          pagado_at: string | null
          pasarela: string | null
          referencia_pago: string | null
          subtotal: number
          total: number
          transaccion_id: string | null
          updated_at: string
        }
        Insert: {
          comprador_documento?: string | null
          comprador_email: string
          comprador_nombre: string
          comprador_telefono: string
          costo_envio?: number
          created_at?: string
          envio_ciudad: string
          envio_departamento?: string | null
          envio_direccion: string
          envio_notas?: string | null
          estado?: string
          id?: string
          metodo_pago?: string | null
          numero: string
          pagado_at?: string | null
          pasarela?: string | null
          referencia_pago?: string | null
          subtotal: number
          total: number
          transaccion_id?: string | null
          updated_at?: string
        }
        Update: {
          comprador_documento?: string | null
          comprador_email?: string
          comprador_nombre?: string
          comprador_telefono?: string
          costo_envio?: number
          created_at?: string
          envio_ciudad?: string
          envio_departamento?: string | null
          envio_direccion?: string
          envio_notas?: string | null
          estado?: string
          id?: string
          metodo_pago?: string | null
          numero?: string
          pagado_at?: string | null
          pasarela?: string | null
          referencia_pago?: string | null
          subtotal?: number
          total?: number
          transaccion_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pedido_item: {
        Row: {
          cantidad: number
          created_at: string
          descripcion: string
          id: string
          id_item: string
          pedido_id: string
          precio_unitario: number
          subtotal: number
        }
        Insert: {
          cantidad: number
          created_at?: string
          descripcion: string
          id?: string
          id_item: string
          pedido_id: string
          precio_unitario: number
          subtotal: number
        }
        Update: {
          cantidad?: number
          created_at?: string
          descripcion?: string
          id?: string
          id_item?: string
          pedido_id?: string
          precio_unitario?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_item_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedido"
            referencedColumns: ["id"]
          },
        ]
      }
      product_image_import_lock: {
        Row: {
          expires_at: string
          name: string
          owner: string
        }
        Insert: {
          expires_at: string
          name: string
          owner: string
        }
        Update: {
          expires_at?: string
          name?: string
          owner?: string
        }
        Relationships: []
      }
      producto_extra: {
        Row: {
          created_at: string
          foto_url: string | null
          id_item: string
          nota: string | null
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          foto_url?: string | null
          id_item: string
          nota?: string | null
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          foto_url?: string | null
          id_item?: string
          nota?: string | null
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      producto_imagen_importaciones: {
        Row: {
          created_at: string
          id_item: string
          observed_version: string
          orden: number
          published_url: string | null
          published_version: string | null
          source_key: string
          source_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id_item: string
          observed_version: string
          orden: number
          published_url?: string | null
          published_version?: string | null
          source_key: string
          source_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id_item?: string
          observed_version?: string
          orden?: number
          published_url?: string | null
          published_version?: string | null
          source_key?: string
          source_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      producto_imagen_intentos: {
        Row: {
          completed_at: string | null
          created_at: string
          last_error: string | null
          sha256: string
          source_key: string
          source_version: string
          storage_path: string
          updated_at: string
          uploaded_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          last_error?: string | null
          sha256: string
          source_key: string
          source_version: string
          storage_path: string
          updated_at?: string
          uploaded_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          last_error?: string | null
          sha256?: string
          source_key?: string
          source_version?: string
          storage_path?: string
          updated_at?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "producto_imagen_intentos_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "producto_imagen_importaciones"
            referencedColumns: ["source_key"]
          },
        ]
      }
      producto_imagenes: {
        Row: {
          created_at: string
          foto_url: string
          id: string
          id_item: string
          orden: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          foto_url: string
          id?: string
          id_item: string
          orden: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          foto_url?: string
          id?: string
          id_item?: string
          orden?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producto_imagenes_id_item_fkey"
            columns: ["id_item"]
            isOneToOne: false
            referencedRelation: "producto_extra"
            referencedColumns: ["id_item"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_product_image_import_lock: {
        Args: { p_owner: string }
        Returns: boolean
      }
      assert_product_image_import_lock: {
        Args: { p_owner: string }
        Returns: undefined
      }
      complete_drive_product_image: {
        Args: {
          p_foto_url: string
          p_owner: string
          p_sha256: string
          p_source_key: string
          p_version: string
        }
        Returns: {
          created_at: string
          id_item: string
          observed_version: string
          orden: number
          published_url: string | null
          published_version: string | null
          source_key: string
          source_name: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "producto_imagen_importaciones"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_drive_image_upload: {
        Args: {
          p_owner: string
          p_sha256: string
          p_source_key: string
          p_version: string
        }
        Returns: undefined
      }
      generate_numero_pedido: { Args: never; Returns: string }
      prepare_drive_product_image: {
        Args: {
          p_owner: string
          p_sha256: string
          p_source_key: string
          p_storage_path: string
          p_version: string
        }
        Returns: {
          completed_at: string | null
          created_at: string
          last_error: string | null
          sha256: string
          source_key: string
          source_version: string
          storage_path: string
          updated_at: string
          uploaded_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "producto_imagen_intentos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_product_image: {
        Args: { p_foto_url: string; p_id_item: string; p_orden: number }
        Returns: {
          created_at: string
          foto_url: string
          id: string
          id_item: string
          orden: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "producto_imagenes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      release_product_image_import_lock: {
        Args: { p_owner: string }
        Returns: undefined
      }
      reserve_drive_product_images: {
        Args: { p_files: Json; p_owner: string }
        Returns: {
          created_at: string
          id_item: string
          observed_version: string
          orden: number
          published_url: string | null
          published_version: string | null
          source_key: string
          source_name: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "producto_imagen_importaciones"
          isOneToOne: false
          isSetofReturn: true
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
    Enums: {},
  },
} as const
