// Dibuat dari database Docker lokal lewat postgres-meta (`/generators/typescript`, skema public), 23 Nov 2026,
// setelah migrasi analisa pay-to-win (scripts/sql/analysis.sql). `ComputedFields` dan `NonNullable<Json>` dari
// generator yang lebih baru dihapus agar cocok dengan supabase-js terpasang. Jangan disunting tangan; buat ulang bila skema berubah.
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      analysis_purchases: {
        Row: {
          created_at: string
          id: number
          news_id: string
          news_title: string
          paragraphs: string[]
          price: number
          request_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          news_id: string
          news_title: string
          paragraphs: string[]
          price: number
          request_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: never
          news_id?: string
          news_title?: string
          paragraphs?: string[]
          price?: number
          request_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_purchases_news_id_fkey"
            columns: ["news_id"]
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_purchases_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_purchases_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "v_team_net_worth"
            referencedColumns: ["team_id"]
          },
        ]
      }
      assets: {
        Row: {
          bankrupt_at: string | null
          base_price: number | null
          created_at: string
          id: string
          init_stock: number | null
          is_active: boolean
          last_price: number | null
          last_trade_at: string | null
          liquidation_price: number | null
          max_price: number
          min_price: number
          name: string
          price: number
          price_factor_bps: number
          rank_price: number | null
          sector: string
          stock: number
          suspended_until: string | null
          symbol: string
        }
        Insert: {
          bankrupt_at?: string | null
          base_price?: number | null
          created_at?: string
          id?: string
          init_stock?: number | null
          is_active?: boolean
          last_price?: number | null
          last_trade_at?: string | null
          liquidation_price?: number | null
          max_price: number
          min_price: number
          name: string
          price: number
          price_factor_bps?: number
          rank_price?: number | null
          sector: string
          stock: number
          suspended_until?: string | null
          symbol: string
        }
        Update: {
          bankrupt_at?: string | null
          base_price?: number | null
          created_at?: string
          id?: string
          init_stock?: number | null
          is_active?: boolean
          last_price?: number | null
          last_trade_at?: string | null
          liquidation_price?: number | null
          max_price?: number
          min_price?: number
          name?: string
          price?: number
          price_factor_bps?: number
          rank_price?: number | null
          sector?: string
          stock?: number
          suspended_until?: string | null
          symbol?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          payload: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          payload: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dividends: {
        Row: {
          amount: number
          asset_id: string
          id: number
          news_id: string | null
          paid_at: string
          per_unit: number
          qty: number
          team_id: string
        }
        Insert: {
          amount: number
          asset_id: string
          id?: never
          news_id?: string | null
          paid_at?: string
          per_unit: number
          qty: number
          team_id: string
        }
        Update: {
          amount?: number
          asset_id?: string
          id?: never
          news_id?: string | null
          paid_at?: string
          per_unit?: number
          qty?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dividends_asset_id_fkey"
            columns: ["asset_id"]
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dividends_news_id_fkey"
            columns: ["news_id"]
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dividends_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dividends_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "v_team_net_worth"
            referencedColumns: ["team_id"]
          },
        ]
      }
      game_settings: {
        Row: {
          analysis_enabled: boolean
          analysis_price: number
          bankrupt_max_per_day: number
          bankrupt_max_total: number
          event_asset_gap_minutes: number
          event_gap_minutes: number
          event_intensity_pct: number
          event_warmup_minutes: number
          hold_cap_pct: number
          id: boolean
          leaderboard_frozen_at: string | null
          leaderboard_visible: boolean
          market_opened_at: string | null
          max_effect_bps: number
          max_news_assets: number
          min_news_assets: number
          news_delay_max_minutes: number
          news_delay_min_minutes: number
          news_gap_minutes: number
          news_next_allowed_at: string | null
          paused_at: string | null
          pick_temperature_milli: number
          pressure_bps_per_unit: number
          pressure_cap_bps: number
          pressure_decay_minutes: number
          price_step: number
          sell_spread_bps: number
          started_at: string | null
          state: Database["public"]["Enums"]["game_state"]
          stock_low_pct: number
          stock_mid_pct: number
          updated_at: string
        }
        Insert: {
          analysis_enabled?: boolean
          analysis_price?: number
          bankrupt_max_per_day?: number
          bankrupt_max_total?: number
          event_asset_gap_minutes?: number
          event_gap_minutes?: number
          event_intensity_pct?: number
          event_warmup_minutes?: number
          hold_cap_pct?: number
          id?: boolean
          leaderboard_frozen_at?: string | null
          leaderboard_visible?: boolean
          market_opened_at?: string | null
          max_effect_bps?: number
          max_news_assets?: number
          min_news_assets?: number
          news_delay_max_minutes?: number
          news_delay_min_minutes?: number
          news_gap_minutes?: number
          news_next_allowed_at?: string | null
          paused_at?: string | null
          pick_temperature_milli?: number
          pressure_bps_per_unit?: number
          pressure_cap_bps?: number
          pressure_decay_minutes?: number
          price_step?: number
          sell_spread_bps?: number
          started_at?: string | null
          state?: Database["public"]["Enums"]["game_state"]
          stock_low_pct?: number
          stock_mid_pct?: number
          updated_at?: string
        }
        Update: {
          analysis_enabled?: boolean
          analysis_price?: number
          bankrupt_max_per_day?: number
          bankrupt_max_total?: number
          event_asset_gap_minutes?: number
          event_gap_minutes?: number
          event_intensity_pct?: number
          event_warmup_minutes?: number
          hold_cap_pct?: number
          id?: boolean
          leaderboard_frozen_at?: string | null
          leaderboard_visible?: boolean
          market_opened_at?: string | null
          max_effect_bps?: number
          max_news_assets?: number
          min_news_assets?: number
          news_delay_max_minutes?: number
          news_delay_min_minutes?: number
          news_gap_minutes?: number
          news_next_allowed_at?: string | null
          paused_at?: string | null
          pick_temperature_milli?: number
          pressure_bps_per_unit?: number
          pressure_cap_bps?: number
          pressure_decay_minutes?: number
          price_step?: number
          sell_spread_bps?: number
          started_at?: string | null
          state?: Database["public"]["Enums"]["game_state"]
          stock_low_pct?: number
          stock_mid_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      holdings: {
        Row: {
          asset_id: string
          cost_basis: number
          qty: number
          team_id: string
        }
        Insert: {
          asset_id: string
          cost_basis: number
          qty: number
          team_id: string
        }
        Update: {
          asset_id?: string
          cost_basis?: number
          qty?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holdings_asset_id_fkey"
            columns: ["asset_id"]
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holdings_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holdings_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "v_team_net_worth"
            referencedColumns: ["team_id"]
          },
        ]
      }
      index_history: {
        Row: {
          at: string
          id: number
          value: number
        }
        Insert: {
          at?: string
          id?: never
          value: number
        }
        Update: {
          at?: string
          id?: never
          value?: number
        }
        Relationships: []
      }
      leaderboard_snapshot: {
        Row: {
          cash: number
          frozen_at: string
          holdings_value: number
          net_worth: number
          rank: number
          team_id: string
        }
        Insert: {
          cash: number
          frozen_at?: string
          holdings_value: number
          net_worth: number
          rank: number
          team_id: string
        }
        Update: {
          cash?: number
          frozen_at?: string
          holdings_value?: number
          net_worth?: number
          rank?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_snapshot_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_snapshot_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "v_team_net_worth"
            referencedColumns: ["team_id"]
          },
        ]
      }
      market_event_log: {
        Row: {
          asset_id: string
          at: string
          id: number
          kind: string
          news_id: string | null
        }
        Insert: {
          asset_id: string
          at?: string
          id?: never
          kind: string
          news_id?: string | null
        }
        Update: {
          asset_id?: string
          at?: string
          id?: never
          kind?: string
          news_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_event_log_asset_id_fkey"
            columns: ["asset_id"]
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_event_log_news_id_fkey"
            columns: ["news_id"]
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          body: string
          created_at: string
          created_by: string
          effect_applied_at: string | null
          effect_at: string | null
          id: string
          published_at: string | null
          status: Database["public"]["Enums"]["news_status"]
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          effect_applied_at?: string | null
          effect_at?: string | null
          id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["news_status"]
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          effect_applied_at?: string | null
          effect_at?: string | null
          id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["news_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      news_analysis: {
        Row: {
          created_at: string
          news_id: string
          paragraphs: string[]
        }
        Insert: {
          created_at?: string
          news_id: string
          paragraphs: string[]
        }
        Update: {
          created_at?: string
          news_id?: string
          paragraphs?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "news_analysis_news_id_fkey"
            columns: ["news_id"]
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
        ]
      }
      news_bankruptcies: {
        Row: {
          asset_id: string
          liquidation_bps: number
          news_id: string
        }
        Insert: {
          asset_id: string
          liquidation_bps?: number
          news_id: string
        }
        Update: {
          asset_id?: string
          liquidation_bps?: number
          news_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_bankruptcies_asset_id_fkey"
            columns: ["asset_id"]
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_bankruptcies_news_id_fkey"
            columns: ["news_id"]
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
        ]
      }
      news_effects: {
        Row: {
          asset_id: string
          news_id: string
          pct_bps: number
        }
        Insert: {
          asset_id: string
          news_id: string
          pct_bps: number
        }
        Update: {
          asset_id?: string
          news_id?: string
          pct_bps?: number
        }
        Relationships: [
          {
            foreignKeyName: "news_effects_asset_id_fkey"
            columns: ["asset_id"]
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_effects_news_id_fkey"
            columns: ["news_id"]
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
        ]
      }
      news_events: {
        Row: {
          amount: number
          asset_id: string
          kind: string
          news_id: string
        }
        Insert: {
          amount: number
          asset_id: string
          kind: string
          news_id: string
        }
        Update: {
          amount?: number
          asset_id?: string
          kind?: string
          news_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_events_asset_id_fkey"
            columns: ["asset_id"]
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_events_news_id_fkey"
            columns: ["news_id"]
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
        ]
      }
      news_feed: {
        Row: {
          body: string
          news_id: string
          published_at: string
          title: string
        }
        Insert: {
          body: string
          news_id: string
          published_at: string
          title: string
        }
        Update: {
          body?: string
          news_id?: string
          published_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_feed_news_id_fkey"
            columns: ["news_id"]
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          created_at: string
          guard_id: string
          id: number
          note: string | null
          post_id: string
          request_id: string
          team_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          guard_id: string
          id?: never
          note?: string | null
          post_id: string
          request_id: string
          team_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          guard_id?: string
          id?: never
          note?: string | null
          post_id?: string
          request_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_guard_id_fkey"
            columns: ["guard_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_post_id_fkey"
            columns: ["post_id"]
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "v_team_net_worth"
            referencedColumns: ["team_id"]
          },
        ]
      }
      posts: {
        Row: {
          created_at: string
          guard_id: string
          id: string
          is_open: boolean
          location: string
          name: string
        }
        Insert: {
          created_at?: string
          guard_id: string
          id?: string
          is_open?: boolean
          location: string
          name: string
        }
        Update: {
          created_at?: string
          guard_id?: string
          id?: string
          is_open?: boolean
          location?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_guard_id_fkey"
            columns: ["guard_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          asset_id: string
          changed_by: string | null
          created_at: string
          id: number
          news_id: string | null
          price: number
          reason: string | null
        }
        Insert: {
          asset_id: string
          changed_by?: string | null
          created_at?: string
          id?: never
          news_id?: string | null
          price: number
          reason?: string | null
        }
        Update: {
          asset_id?: string
          changed_by?: string | null
          created_at?: string
          id?: never
          news_id?: string | null
          price?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_history_asset_id_fkey"
            columns: ["asset_id"]
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_changed_by_fkey"
            columns: ["changed_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_news_id_fkey"
            columns: ["news_id"]
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          username: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          username: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          username?: string
        }
        Relationships: []
      }
      shop_clock: {
        Row: {
          id: boolean
          pressure_at: string
        }
        Insert: {
          id?: boolean
          pressure_at?: string
        }
        Update: {
          id?: boolean
          pressure_at?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          cash: number
          created_at: string
          id: string
          name: string
          qr_token: string
          short_code: string
        }
        Insert: {
          cash?: number
          created_at?: string
          id: string
          name: string
          qr_token?: string
          short_code: string
        }
        Update: {
          cash?: number
          created_at?: string
          id?: string
          name?: string
          qr_token?: string
          short_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_id_fkey"
            columns: ["id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          asset_id: string
          created_at: string
          id: number
          list_price: number
          qty: number
          request_id: string
          side: string
          team_id: string
          total: number
          unit_price: number
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: never
          list_price: number
          qty: number
          request_id: string
          side: string
          team_id: string
          total: number
          unit_price: number
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: never
          list_price?: number
          qty?: number
          request_id?: string
          side?: string
          team_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_asset_id_fkey"
            columns: ["asset_id"]
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "v_team_net_worth"
            referencedColumns: ["team_id"]
          },
        ]
      }
    }
    Views: {
      v_team_net_worth: {
        Row: {
          cash: number | null
          holdings_value: number | null
          name: string | null
          net_worth: number | null
          team_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_id_fkey"
            columns: ["team_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_adjust_cash: {
        Args: { p_delta: number; p_reason: string; p_team_id: string }
        Returns: number
      }
      admin_analysis_log: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          id: number
          news_title: string
          price: number
          team_id: string
          team_name: string
        }[]
      }
      admin_analysis_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          buyers: number
          purchases: number
          revenue: number
        }[]
      }
      admin_applied_news: {
        Args: { p_limit?: number }
        Returns: {
          applied_at: string
          event_kind: string
          event_symbol: string
          n_assets: number
          news_id: string
          published_at: string
          title: string
        }[]
      }
      admin_current_news_effects: {
        Args: Record<PropertyKey, never>
        Returns: {
          kind: string
          name: string
          news_id: string
          status: string
          symbol: string
          value: number
        }[]
      }
      admin_delete_post: {
        Args: { p_post_id: string }
        Returns: undefined
      }
      admin_delete_team: {
        Args: { p_team_id: string }
        Returns: undefined
      }
      admin_freeze_leaderboard: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      admin_news_effects: {
        Args: { p_news_id: string }
        Returns: {
          kind: string
          name: string
          news_id: string
          status: string
          symbol: string
          value: number
        }[]
      }
      admin_reset_game: { Args: Record<PropertyKey, never>; Returns: Json }
      admin_restart_news: { Args: Record<PropertyKey, never>; Returns: number }
      admin_rotate_team_qr: { Args: { p_team_id: string }; Returns: string }
      admin_save_news: {
        Args: {
          p_body: string
          p_effects: Json
          p_news_id: string
          p_title: string
        }
        Returns: string
      }
      admin_set_analysis_settings: {
        Args: { p_enabled: boolean; p_price: number }
        Returns: undefined
      }
      admin_set_game_state: {
        Args: { p_state: Database["public"]["Enums"]["game_state"] }
        Returns: Database["public"]["Enums"]["game_state"]
      }
      admin_set_leaderboard_visible: {
        Args: { p_visible: boolean }
        Returns: undefined
      }
      admin_set_news_bankruptcy: {
        Args: {
          p_asset_id: string
          p_liquidation_bps?: number
          p_news_id: string
        }
        Returns: number
      }
      admin_set_news_event: {
        Args: {
          p_amount: number
          p_asset_id: string
          p_kind: string
          p_news_id: string
        }
        Returns: undefined
      }
      admin_set_news_ready: {
        Args: { p_news_id: string; p_ready: boolean }
        Returns: undefined
      }
      admin_set_news_settings: {
        Args: {
          p_delay_max: number
          p_delay_min: number
          p_gap: number
          p_max_assets: number
          p_max_effect_bps: number
          p_min_assets: number
        }
        Returns: undefined
      }
      admin_set_post_open: {
        Args: { p_open: boolean; p_post_id: string }
        Returns: boolean
      }
      admin_set_stock: {
        Args: { p_asset_id: string; p_reason: string; p_stock: number }
        Returns: number
      }
      admin_set_trade_settings: {
        Args: {
          p_hold_cap_pct: number
          p_pressure_bps_per_unit: number
          p_pressure_cap_bps: number
          p_pressure_decay_minutes: number
          p_sell_spread_bps: number
        }
        Returns: undefined
      }
      admin_transaction_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          asset_id: string
          bought: number
          n: number
          sold: number
          volume: number
        }[]
      }
      admin_unfreeze_leaderboard: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      admin_upsert_asset: {
        Args: {
          p_asset_id: string
          p_is_active: boolean
          p_max_price: number
          p_min_price: number
          p_name: string
          p_price: number
          p_sector: string
          p_stock: number
          p_symbol: string
        }
        Returns: string
      }
      admin_upsert_post: {
        Args: {
          p_guard_id: string
          p_location: string
          p_name: string
          p_post_id: string
        }
        Returns: string
      }
      app_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"]
      }
      award_payout: {
        Args: {
          p_amount: number
          p_note?: string
          p_request_id: string
          p_team_id: string
        }
        Returns: {
          amount: number
          created_at: string
          guard_id: string
          id: number
          note: string | null
          post_id: string
          request_id: string
          team_id: string
        }
        SetofOptions: {
          from: "*"
          to: "payouts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bankrupt_asset: {
        Args: { p_asset_id: string; p_bps: number; p_news_id: string }
        Returns: undefined
      }
      buy_analysis: {
        Args: { p_request_id: string }
        Returns: {
          created_at: string
          id: number
          news_id: string
          news_title: string
          paragraphs: string[]
          price: number
          request_id: string
          team_id: string
        }
        SetofOptions: {
          from: "*"
          to: "analysis_purchases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      buy_asset: {
        Args: { p_asset_id: string; p_qty: number; p_request_id: string }
        Returns: {
          asset_id: string
          created_at: string
          id: number
          list_price: number
          qty: number
          request_id: string
          side: string
          team_id: string
          total: number
          unit_price: number
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_news_effects: { Args: { p_news_id: string }; Returns: undefined }
      cm_now: { Args: Record<PropertyKey, never>; Returns: string }
      event_chances: {
        Args: Record<PropertyKey, never>
        Returns: {
          asset_id: string
          kind: string
          p: number
        }[]
      }
      freeze_leaderboard_internal: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      game_is_locked: { Args: Record<PropertyKey, never>; Returns: boolean }
      get_analysis_offer: {
        Args: Record<PropertyKey, never>
        Returns: {
          can_buy: boolean
          news_title: string
          owned: boolean
          price: number
          reason: string
        }[]
      }
      get_bankrupt_notices: {
        Args: Record<PropertyKey, never>
        Returns: {
          asset_id: string
          bankrupt_at: string
          liquidation_price: number
          name: string
          symbol: string
        }[]
      }
      get_day_open_prices: {
        Args: Record<PropertyKey, never>
        Returns: {
          asset_id: string
          open_price: number
        }[]
      }
      get_index_history: {
        Args: { p_max?: number }
        Returns: {
          at: string
          value: number
        }[]
      }
      get_last_transactions: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          qty: number
          side: string
          symbol: string
          unit_price: number
        }[]
      }
      get_leaderboard: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["CompositeTypes"]["leaderboard_row"][]
        SetofOptions: {
          from: "*"
          to: "leaderboard_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_market_index: {
        Args: Record<PropertyKey, never>
        Returns: {
          scope: string
          value: number
        }[]
      }
      get_market_snapshot: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_market_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          asset_id: string
          avg_price: number
          freq: number
          high_price: number
          init_stock: number
          last_price: number
          lot: number
          low_price: number
          open_price: number
          price_factor_bps: number
          ref_price: number
          sell_price: number
          stock: number
          symbol: string
          val: number
        }[]
      }
      get_my_analyses: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          id: number
          news_id: string
          news_title: string
          paragraphs: string[]
          price: number
          request_id: string
          team_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "analysis_purchases"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_my_summary: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["CompositeTypes"]["my_summary"]
        SetofOptions: {
          from: "*"
          to: "my_summary"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_news_pool_kinds: {
        Args: Record<PropertyKey, never>
        Returns: {
          kind: string
          ready_count: number
        }[]
      }
      get_news_pool_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          applied_count: number
          draft_count: number
          eligible_count: number
          live_count: number
          ready_count: number
        }[]
      }
      get_post_list: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          is_open: boolean
          location: string
          name: string
        }[]
      }
      get_post_payouts: {
        Args: { p_limit?: number }
        Returns: Database["public"]["CompositeTypes"]["post_payout_row"][]
        SetofOptions: {
          from: "*"
          to: "post_payout_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      guard_set_post_open: { Args: { p_open: boolean }; Returns: boolean }
      log_kiosk_event: {
        Args: { p_device?: string; p_event: string }
        Returns: undefined
      }
      market_state: {
        Args: Record<PropertyKey, never>
        Returns: {
          asset_id: string
          base_price: number
          cum: number
          last_dividend_at: string
          last_event_at: string
          price: number
          sector: string
          suspended: boolean
          symbol: string
          trades_10m: number
          up_streak: number
          vol: number
        }[]
      }
      news_pool: {
        Args: Record<PropertyKey, never>
        Returns: {
          amount: number
          asset_id: string
          kind: string
          n_active: number
          n_effects: number
          news_id: string
          status: Database["public"]["Enums"]["news_status"]
          usable: boolean
        }[]
      }
      news_pool_coverage: {
        Args: Record<PropertyKey, never>
        Returns: {
          asset_id: string
          bankrupt: number
          dividend: number
          suspend: number
          symbol: string
        }[]
      }
      news_would_hit_bounds: { Args: { p_news_id: string }; Returns: boolean }
      ob_lock: { Args: Record<PropertyKey, never>; Returns: undefined }
      pay_dividend: {
        Args: { p_asset_id: string; p_bps: number; p_news_id: string }
        Returns: undefined
      }
      pick_next_news: { Args: Record<PropertyKey, never>; Returns: string }
      process_market_cycle: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      process_news_cycle: { Args: Record<PropertyKey, never>; Returns: string }
      process_suspensions: { Args: Record<PropertyKey, never>; Returns: number }
      record_index_sample: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      resolve_team_code: {
        Args: { p_code: string }
        Returns: Database["public"]["CompositeTypes"]["team_ref"]
        SetofOptions: {
          from: "*"
          to: "team_ref"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_team_qr: {
        Args: { p_qr: string }
        Returns: Database["public"]["CompositeTypes"]["team_ref"]
        SetofOptions: {
          from: "*"
          to: "team_ref"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sell_asset: {
        Args: { p_asset_id: string; p_qty: number; p_request_id: string }
        Returns: {
          asset_id: string
          created_at: string
          id: number
          list_price: number
          qty: number
          request_id: string
          side: string
          team_id: string
          total: number
          unit_price: number
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      shop_init_assets: { Args: Record<PropertyKey, never>; Returns: undefined }
      shop_price: {
        Args: { p_factor: number; p_max: number; p_min: number; p_ref: number }
        Returns: number
      }
      shop_sell_price: { Args: { p_price: number }; Returns: number }
      suspend_asset: {
        Args: { p_asset_id: string; p_minutes: number; p_news_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "guard" | "team" | "display"
      game_state: "setup" | "open" | "paused" | "finished"
      news_status: "draft" | "ready" | "live" | "applied" | "cancelled"
    }
    CompositeTypes: {
      leaderboard_row: {
        rank: number | null
        team_id: string | null
        team_name: string | null
        cash: number | null
        holdings_value: number | null
        net_worth: number | null
      }
      my_summary: {
        cash: number | null
        holdings_value: number | null
        net_worth: number | null
      }
      post_payout_row: {
        id: number | null
        team_name: string | null
        amount: number | null
        created_at: string | null
      }
      team_ref: {
        team_id: string | null
        team_name: string | null
        cash: number | null
      }
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
      app_role: ["admin", "guard", "team", "display"],
      game_state: ["setup", "open", "paused", "finished"],
      news_status: ["draft", "ready", "live", "applied", "cancelled"],
    },
  },
} as const
