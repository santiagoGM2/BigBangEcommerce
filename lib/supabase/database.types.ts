/**
 * ARCHIVO GENERADO — NO EDITAR A MANO
 *
 * Fuente: esquema real del proyecto Supabase bigbang-ecommerce
 * Regenerar: pnpm gen:types
 */

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
      contador_pedido: {
        Row: {
          anio: number;
          ultimo: number;
        };
        Insert: {
          anio: number;
          ultimo?: number;
        };
        Update: {
          anio?: number;
          ultimo?: number;
        };
        Relationships: [];
      };
      pedido: {
        Row: {
          comprador_documento: string | null;
          comprador_email: string;
          comprador_nombre: string;
          comprador_telefono: string;
          costo_envio: number;
          created_at: string;
          envio_ciudad: string;
          envio_departamento: string | null;
          envio_direccion: string;
          envio_notas: string | null;
          estado: string;
          id: string;
          metodo_pago: string | null;
          numero: string;
          pagado_at: string | null;
          pasarela: string | null;
          referencia_pago: string | null;
          subtotal: number;
          total: number;
          transaccion_id: string | null;
          updated_at: string;
        };
        Insert: {
          comprador_documento?: string | null;
          comprador_email: string;
          comprador_nombre: string;
          comprador_telefono: string;
          costo_envio?: number;
          created_at?: string;
          envio_ciudad: string;
          envio_departamento?: string | null;
          envio_direccion: string;
          envio_notas?: string | null;
          estado?: string;
          id?: string;
          metodo_pago?: string | null;
          numero: string;
          pagado_at?: string | null;
          pasarela?: string | null;
          referencia_pago?: string | null;
          subtotal: number;
          total: number;
          transaccion_id?: string | null;
          updated_at?: string;
        };
        Update: {
          comprador_documento?: string | null;
          comprador_email?: string;
          comprador_nombre?: string;
          comprador_telefono?: string;
          costo_envio?: number;
          created_at?: string;
          envio_ciudad?: string;
          envio_departamento?: string | null;
          envio_direccion?: string;
          envio_notas?: string | null;
          estado?: string;
          id?: string;
          metodo_pago?: string | null;
          numero?: string;
          pagado_at?: string | null;
          pasarela?: string | null;
          referencia_pago?: string | null;
          subtotal?: number;
          total?: number;
          transaccion_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      pedido_item: {
        Row: {
          cantidad: number;
          created_at: string;
          descripcion: string;
          id: string;
          id_item: string;
          pedido_id: string;
          precio_unitario: number;
          subtotal: number;
        };
        Insert: {
          cantidad: number;
          created_at?: string;
          descripcion: string;
          id?: string;
          id_item: string;
          pedido_id: string;
          precio_unitario: number;
          subtotal: number;
        };
        Update: {
          cantidad?: number;
          created_at?: string;
          descripcion?: string;
          id?: string;
          id_item?: string;
          pedido_id?: string;
          precio_unitario?: number;
          subtotal?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pedido_item_pedido_id_fkey";
            columns: ["pedido_id"];
            isOneToOne: false;
            referencedRelation: "pedido";
            referencedColumns: ["id"];
          },
        ];
      };
      producto_extra: {
        Row: {
          created_at: string;
          foto_url: string | null;
          id_item: string;
          nota: string | null;
          updated_at: string;
          visible: boolean;
        };
        Insert: {
          created_at?: string;
          foto_url?: string | null;
          id_item: string;
          nota?: string | null;
          updated_at?: string;
          visible?: boolean;
        };
        Update: {
          created_at?: string;
          foto_url?: string | null;
          id_item?: string;
          nota?: string | null;
          updated_at?: string;
          visible?: boolean;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      generate_numero_pedido: { Args: Record<string, never>; Returns: string };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
