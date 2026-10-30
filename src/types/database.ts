export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string;
          actor: string | null;
          created_at: string;
          entity: string;
          entity_id: string | null;
          id: number;
          mess_id: string;
          payload: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor?: string | null;
          created_at?: string;
          entity: string;
          entity_id?: string | null;
          id?: never;
          mess_id: string;
          payload?: NonNullable<Json>;
        };
        Update: {
          action?: string;
          actor?: string | null;
          created_at?: string;
          entity?: string;
          entity_id?: string | null;
          id?: never;
          mess_id?: string;
          payload?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: 'activity_log_mess_id_fkey';
            columns: ['mess_id'];
            isOneToOne: false;
            referencedRelation: 'messes';
            referencedColumns: ['id'];
          },
        ];
      };
      bills: {
        Row: {
          amount: number;
          created_at: string;
          deleted_at: string | null;
          id: string;
          kind: Database['public']['Enums']['bill_kind'];
          label: string | null;
          mess_id: string;
          period_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          kind: Database['public']['Enums']['bill_kind'];
          label?: string | null;
          mess_id: string;
          period_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          kind?: Database['public']['Enums']['bill_kind'];
          label?: string | null;
          mess_id?: string;
          period_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bills_period_id_mess_id_fkey';
            columns: ['period_id', 'mess_id'];
            isOneToOne: false;
            referencedRelation: 'periods';
            referencedColumns: ['id', 'mess_id'];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          date: string;
          deleted_at: string | null;
          id: string;
          items: NonNullable<Json>;
          kind: Database['public']['Enums']['expense_kind'];
          member_id: string;
          mess_id: string;
          note: string | null;
          period_id: string;
          receipt_path: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          created_at?: string;
          created_by?: string | null;
          date: string;
          deleted_at?: string | null;
          id?: string;
          items?: NonNullable<Json>;
          kind?: Database['public']['Enums']['expense_kind'];
          member_id: string;
          mess_id: string;
          note?: string | null;
          period_id: string;
          receipt_path?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          date?: string;
          deleted_at?: string | null;
          id?: string;
          items?: NonNullable<Json>;
          kind?: Database['public']['Enums']['expense_kind'];
          member_id?: string;
          mess_id?: string;
          note?: string | null;
          period_id?: string;
          receipt_path?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expenses_member_id_mess_id_fkey';
            columns: ['member_id', 'mess_id'];
            isOneToOne: false;
            referencedRelation: 'mess_members';
            referencedColumns: ['id', 'mess_id'];
          },
          {
            foreignKeyName: 'expenses_period_id_mess_id_fkey';
            columns: ['period_id', 'mess_id'];
            isOneToOne: false;
            referencedRelation: 'periods';
            referencedColumns: ['id', 'mess_id'];
          },
        ];
      };
      meal_entries: {
        Row: {
          created_at: string;
          created_by: string | null;
          date: string;
          deleted_at: string | null;
          id: string;
          meals: number;
          member_id: string;
          mess_id: string;
          note: string | null;
          period_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          date: string;
          deleted_at?: string | null;
          id?: string;
          meals: number;
          member_id: string;
          mess_id: string;
          note?: string | null;
          period_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          date?: string;
          deleted_at?: string | null;
          id?: string;
          meals?: number;
          member_id?: string;
          mess_id?: string;
          note?: string | null;
          period_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'meal_entries_member_id_mess_id_fkey';
            columns: ['member_id', 'mess_id'];
            isOneToOne: false;
            referencedRelation: 'mess_members';
            referencedColumns: ['id', 'mess_id'];
          },
          {
            foreignKeyName: 'meal_entries_period_id_mess_id_fkey';
            columns: ['period_id', 'mess_id'];
            isOneToOne: false;
            referencedRelation: 'periods';
            referencedColumns: ['id', 'mess_id'];
          },
        ];
      };
      mess_members: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          joined_on: string;
          left_on: string | null;
          mess_id: string;
          role: Database['public']['Enums']['member_role'];
          status: Database['public']['Enums']['member_status'];
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name: string;
          id?: string;
          joined_on?: string;
          left_on?: string | null;
          mess_id: string;
          role?: Database['public']['Enums']['member_role'];
          status?: Database['public']['Enums']['member_status'];
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          joined_on?: string;
          left_on?: string | null;
          mess_id?: string;
          role?: Database['public']['Enums']['member_role'];
          status?: Database['public']['Enums']['member_status'];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'mess_members_mess_id_fkey';
            columns: ['mess_id'];
            isOneToOne: false;
            referencedRelation: 'messes';
            referencedColumns: ['id'];
          },
        ];
      };
      messes: {
        Row: {
          created_at: string;
          created_by: string | null;
          currency: string;
          deleted_at: string | null;
          id: string;
          invite_code: string;
          meal_cutoff_time: string;
          name: string;
          timezone: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deleted_at?: string | null;
          id?: string;
          invite_code?: string;
          meal_cutoff_time?: string;
          name?: string;
          timezone?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deleted_at?: string | null;
          id?: string;
          invite_code?: string;
          meal_cutoff_time?: string;
          name?: string;
          timezone?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          date: string;
          deleted_at: string | null;
          id: string;
          member_id: string;
          mess_id: string;
          method: Database['public']['Enums']['payment_method'];
          note: string | null;
          period_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          created_at?: string;
          created_by?: string | null;
          date: string;
          deleted_at?: string | null;
          id?: string;
          member_id: string;
          mess_id: string;
          method?: Database['public']['Enums']['payment_method'];
          note?: string | null;
          period_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          date?: string;
          deleted_at?: string | null;
          id?: string;
          member_id?: string;
          mess_id?: string;
          method?: Database['public']['Enums']['payment_method'];
          note?: string | null;
          period_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_member_id_mess_id_fkey';
            columns: ['member_id', 'mess_id'];
            isOneToOne: false;
            referencedRelation: 'mess_members';
            referencedColumns: ['id', 'mess_id'];
          },
          {
            foreignKeyName: 'payments_period_id_mess_id_fkey';
            columns: ['period_id', 'mess_id'];
            isOneToOne: false;
            referencedRelation: 'periods';
            referencedColumns: ['id', 'mess_id'];
          },
        ];
      };
      periods: {
        Row: {
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
          id: string;
          mess_id: string;
          month: string;
          reopen_reason: string | null;
          reopened_at: string | null;
          snapshot: Json | null;
          status: Database['public']['Enums']['period_status'];
        };
        ComputedFields: never;
        Insert: {
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          id?: string;
          mess_id: string;
          month: string;
          reopen_reason?: string | null;
          reopened_at?: string | null;
          snapshot?: Json | null;
          status?: Database['public']['Enums']['period_status'];
        };
        Update: {
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          id?: string;
          mess_id?: string;
          month?: string;
          reopen_reason?: string | null;
          reopened_at?: string | null;
          snapshot?: Json | null;
          status?: Database['public']['Enums']['period_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'periods_mess_id_fkey';
            columns: ['mess_id'];
            isOneToOne: false;
            referencedRelation: 'messes';
            referencedColumns: ['id'];
          },
        ];
      };
      previous_dues: {
        Row: {
          amount: number;
          member_id: string;
          mess_id: string;
          period_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount?: number;
          member_id: string;
          mess_id: string;
          period_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          member_id?: string;
          mess_id?: string;
          period_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'previous_dues_member_id_mess_id_fkey';
            columns: ['member_id', 'mess_id'];
            isOneToOne: false;
            referencedRelation: 'mess_members';
            referencedColumns: ['id', 'mess_id'];
          },
          {
            foreignKeyName: 'previous_dues_period_id_mess_id_fkey';
            columns: ['period_id', 'mess_id'];
            isOneToOne: false;
            referencedRelation: 'periods';
            referencedColumns: ['id', 'mess_id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          created_at: string;
          display_name: string;
          id: string;
          phone: string | null;
        };
        ComputedFields: never;
        Insert: {
          avatar_path?: string | null;
          created_at?: string;
          display_name: string;
          id: string;
          phone?: string | null;
        };
        Update: {
          avatar_path?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          phone?: string | null;
        };
        Relationships: [];
      };
      rent_shares: {
        Row: {
          fixed_amount: number | null;
          member_id: string;
          mess_id: string;
          period_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          fixed_amount?: number | null;
          member_id: string;
          mess_id: string;
          period_id: string;
          updated_at?: string;
        };
        Update: {
          fixed_amount?: number | null;
          member_id?: string;
          mess_id?: string;
          period_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'rent_shares_member_id_mess_id_fkey';
            columns: ['member_id', 'mess_id'];
            isOneToOne: false;
            referencedRelation: 'mess_members';
            referencedColumns: ['id', 'mess_id'];
          },
          {
            foreignKeyName: 'rent_shares_period_id_mess_id_fkey';
            columns: ['period_id', 'mess_id'];
            isOneToOne: false;
            referencedRelation: 'periods';
            referencedColumns: ['id', 'mess_id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      close_period: {
        Args: { p_carry?: Json; p_period: string; p_snapshot: Json };
        Returns: string;
      };
      create_mess: { Args: { p_display_name?: string; p_name?: string }; Returns: Json };
      delete_mess: { Args: { p_confirm_name: string; p_mess: string }; Returns: undefined };
      expense_items_valid: { Args: { items: Json; total: number }; Returns: boolean };
      gen_invite_code: { Args: Record<PropertyKey, never>; Returns: string };
      get_period_bundle: { Args: { p_mess: string; p_period?: string }; Returns: Json };
      health: { Args: Record<PropertyKey, never>; Returns: Json };
      join_mess: {
        Args: { p_claim_member?: string; p_code: string; p_display_name?: string };
        Returns: Json;
      };
      meal_edit_deadline: { Args: { p_date: string; p_mess: string }; Returns: string };
      member_contacts: {
        Args: { p_mess: string };
        Returns: {
          display_name: string;
          email: string;
          member_id: string;
        }[];
      };
      preview_invite: { Args: { p_code: string }; Returns: Json };
      regenerate_invite_code: { Args: { p_mess: string }; Returns: string };
      reopen_period: { Args: { p_period: string; p_reason: string }; Returns: undefined };
      restore_mess: { Args: { p_mess: string }; Returns: undefined };
      set_manager: { Args: { p_member: string }; Returns: undefined };
      set_meal: {
        Args: {
          p_date: string;
          p_meals: number;
          p_member: string;
          p_mess: string;
          p_note?: string;
        };
        Returns: {
          created_at: string;
          created_by: string | null;
          date: string;
          deleted_at: string | null;
          id: string;
          meals: number;
          member_id: string;
          mess_id: string;
          note: string | null;
          period_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'meal_entries';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      bill_kind: 'khala' | 'house_rent' | 'wifi' | 'gas' | 'electricity' | 'extra' | 'other';
      expense_kind: 'bazar' | 'initial';
      member_role: 'manager' | 'member';
      member_status: 'active' | 'left';
      payment_method: 'cash' | 'bkash' | 'nagad' | 'bank';
      period_status: 'open' | 'closed';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      bill_kind: ['khala', 'house_rent', 'wifi', 'gas', 'electricity', 'extra', 'other'],
      expense_kind: ['bazar', 'initial'],
      member_role: ['manager', 'member'],
      member_status: ['active', 'left'],
      payment_method: ['cash', 'bkash', 'nagad', 'bank'],
      period_status: ['open', 'closed'],
    },
  },
} as const;
