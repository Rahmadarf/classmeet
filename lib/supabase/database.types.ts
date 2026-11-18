// Dibuat dari skema staging (project sjqboaqkhykmzconskvn) lewat Supabase MCP generate_typescript_types.
// Jangan disunting tangan; buat ulang bila migrasi berubah.
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
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_settings: {
        Row: {
          band_bps: number
          fee_bps: number
          house_cash: number
          house_levels: number
          house_refresh_seconds: number
          house_refreshed_at: string | null
          id: boolean
          leaderboard_frozen_at: string | null
          leaderboard_visible: boolean
          max_effect_bps: number
          max_news_assets: number
          min_news_assets: number
          news_delay_max_minutes: number
          news_delay_min_minutes: number
          news_gap_minutes: number
          news_next_allowed_at: string | null
          paused_at: string | null
          price_step: number
          rank_min_lots: number
          rank_window_minutes: number
          sell_fee_bps: number
          started_at: string | null
          state: Database["public"]["Enums"]["game_state"]
          sweep_levels: number
          updated_at: string
        }
        Insert: {
          band_bps?: number
          fee_bps?: number
          house_cash?: number
          house_levels?: number
          house_refresh_seconds?: number
          house_refreshed_at?: string | null
          id?: boolean
          leaderboard_frozen_at?: string | null
          leaderboard_visible?: boolean
          max_effect_bps?: number
          max_news_assets?: number
          min_news_assets?: number
          news_delay_max_minutes?: number
          news_delay_min_minutes?: number
          news_gap_minutes?: number
          news_next_allowed_at?: string | null
          paused_at?: string | null
          price_step?: number
          rank_min_lots?: number
          rank_window_minutes?: number
          sell_fee_bps?: number
          started_at?: string | null
          state?: Database["public"]["Enums"]["game_state"]
          sweep_levels?: number
          updated_at?: string
        }
        Update: {
          band_bps?: number
          fee_bps?: number
          house_cash?: number
          house_levels?: number
          house_refresh_seconds?: number
          house_refreshed_at?: string | null
          id?: boolean
          leaderboard_frozen_at?: string | null
          leaderboard_visible?: boolean
          max_effect_bps?: number
          max_news_assets?: number
          min_news_assets?: number
          news_delay_max_minutes?: number
          news_delay_min_minutes?: number
          news_gap_minutes?: number
          news_next_allowed_at?: string | null
          paused_at?: string | null
          price_step?: number
          rank_min_lots?: number
          rank_window_minutes?: number
          sell_fee_bps?: number
          started_at?: string | null
          state?: Database["public"]["Enums"]["game_state"]
          sweep_levels?: number
          updated_at?: string
        }
        Relationships: []
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
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dividends_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dividends_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      holdings: {
        Row: {
          asset_id: string
          cost_basis: number
          locked_qty: number
          qty: number
          team_id: string
        }
        Insert: {
          asset_id: string
          cost_basis: number
          locked_qty?: number
          qty: number
          team_id: string
        }
        Update: {
          asset_id?: string
          cost_basis?: number
          locked_qty?: number
          qty?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holdings_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holdings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holdings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_team_net_worth"
            referencedColumns: ["team_id"]
          },
        ]
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
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_snapshot_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "v_team_net_worth"
            referencedColumns: ["team_id"]
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
            isOneToOne: false
            referencedRelation: "profiles"
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
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_bankruptcies_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: true
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
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_events_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
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
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_effects_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
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
            isOneToOne: true
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          asset_id: string
          closed_at: string | null
          created_at: string
          id: number
          is_house: boolean
          kind: string
          lock_per_lot: number
          price: number | null
          qty: number
          remaining: number
          request_id: string | null
          side: string
          status: string
          team_id: string | null
        }
        Insert: {
          asset_id: string
          closed_at?: string | null
          created_at?: string
          id?: never
          is_house?: boolean
          kind: string
          lock_per_lot?: number
          price?: number | null
          qty: number
          remaining: number
          request_id?: string | null
          side: string
          status?: string
          team_id?: string | null
        }
        Update: {
          asset_id?: string
          closed_at?: string | null
          created_at?: string
          id?: never
          is_house?: boolean
          kind?: string
          lock_per_lot?: number
          price?: number | null
          qty?: number
          remaining?: number
          request_id?: string | null
          side?: string
          status?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_team_net_worth"
            referencedColumns: ["team_id"]
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
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
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
            isOneToOne: true
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
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
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
      teams: {
        Row: {
          cash: number
          created_at: string
          id: string
          locked_cash: number
          name: string
          qr_token: string
          short_code: string
        }
        Insert: {
          cash?: number
          created_at?: string
          id: string
          locked_cash?: number
          name: string
          qr_token?: string
          short_code: string
        }
        Update: {
          cash?: number
          created_at?: string
          id?: string
          locked_cash?: number
          name?: string
          qr_token?: string
          short_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          asset_id: string
          buy_order_id: number
          buyer_fee: number
          buyer_id: string | null
          created_at: string
          id: number
          price: number
          qty: number
          sell_order_id: number
          seller_fee: number
          seller_id: string | null
          taker_side: string
        }
        Insert: {
          asset_id: string
          buy_order_id: number
          buyer_fee?: number
          buyer_id?: string | null
          created_at?: string
          id?: never
          price: number
          qty: number
          sell_order_id: number
          seller_fee?: number
          seller_id?: string | null
          taker_side: string
        }
        Update: {
          asset_id?: string
          buy_order_id?: number
          buyer_fee?: number
          buyer_id?: string | null
          created_at?: string
          id?: never
          price?: number
          qty?: number
          sell_order_id?: number
          seller_fee?: number
          seller_id?: string | null
          taker_side?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_buy_order_id_fkey"
            columns: ["buy_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "v_team_net_worth"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "trades_sell_order_id_fkey"
            columns: ["sell_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "v_team_net_worth"
            referencedColumns: ["team_id"]
          },
        ]
      }
    }
    Views: {
      v_team_net_worth: {
        Row: {
          avail_cash: number | null
          cash: number | null
          holdings_value: number | null
          locked_cash: number | null
          name: string | null
          net_worth: number | null
          team_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
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
      admin_freeze_leaderboard: { Args: never; Returns: undefined }
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
      admin_set_game_state: {
        Args: { p_state: Database["public"]["Enums"]["game_state"] }
        Returns: Database["public"]["Enums"]["game_state"]
      }
      admin_set_leaderboard_visible: {
        Args: { p_visible: boolean }
        Returns: undefined
      }
      admin_set_news_event: {
        Args: { p_amount: number; p_asset_id: string; p_kind: string; p_news_id: string }
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
      admin_set_news_bankruptcy: {
        Args: { p_asset_id: string; p_liquidation_bps?: number; p_news_id: string }
        Returns: number
      }
      admin_set_post_open: {
        Args: { p_open: boolean; p_post_id: string }
        Returns: boolean
      }
      admin_set_stock: {
        Args: { p_asset_id: string; p_reason: string; p_stock: number }
        Returns: number
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
      admin_set_news_ready: {
        Args: { p_news_id: string; p_ready: boolean }
        Returns: undefined
      }
      admin_unfreeze_leaderboard: { Args: never; Returns: undefined }
      app_role: {
        Args: never
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
      cancel_order: {
        Args: { p_order_id: number }
        Returns: {
          asset_id: string
          closed_at: string | null
          created_at: string
          id: number
          is_house: boolean
          kind: string
          lock_per_lot: number
          price: number | null
          qty: number
          remaining: number
          request_id: string | null
          side: string
          status: string
          team_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ceil_tick: { Args: { p: number }; Returns: number }
      check_news_effects: { Args: { p_news_id: string }; Returns: undefined }
      floor_tick: { Args: { p: number }; Returns: number }
      freeze_leaderboard_internal: { Args: never; Returns: undefined }
      game_is_locked: { Args: never; Returns: boolean }
      get_leaderboard: {
        Args: never
        Returns: Database["public"]["CompositeTypes"]["leaderboard_row"][]
        SetofOptions: {
          from: "*"
          to: "leaderboard_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_market_index: {
        Args: never
        Returns: {
          scope: string
          value: number
        }[]
      }
      get_market_summary: {
        Args: never
        Returns: {
          asset_id: string
          avg_price: number
          freq: number
          high_price: number
          last_price: number
          lot: number
          low_price: number
          open_price: number
          ref_price: number
          symbol: string
          val: number
        }[]
      }
      get_my_summary: {
        Args: never
        Returns: Database["public"]["CompositeTypes"]["my_summary"]
        SetofOptions: {
          from: "*"
          to: "my_summary"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_news_pool_status: {
        Args: never
        Returns: {
          applied_count: number
          draft_count: number
          eligible_count: number
          live_count: number
          ready_count: number
        }[]
      }
      get_order_book: {
        Args: { p_asset_id: string }
        Returns: {
          freq: number
          lots: number
          mine: number
          price: number
          side: string
        }[]
      }
      get_post_list: {
        Args: never
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
      news_would_hit_bounds: { Args: { p_news_id: string }; Returns: boolean }
      ob_cancel: { Args: { p_order: number }; Returns: undefined }
      ob_cancel_all: { Args: never; Returns: undefined }
      ob_fee: {
        Args: { p_bps: number; p_price: number; p_qty: number }
        Returns: number
      }
      ob_lock: { Args: never; Returns: undefined }
      ob_match: { Args: { p_order: number }; Returns: undefined }
      order_band: {
        Args: { p_asset: string }
        Returns: {
          hi: number
          lo: number
        }[]
      }
      place_order: {
        Args: {
          p_asset_id: string
          p_kind: string
          p_price: number
          p_qty: number
          p_request_id: string
          p_side: string
        }
        Returns: {
          asset_id: string
          closed_at: string | null
          created_at: string
          id: number
          is_house: boolean
          kind: string
          lock_per_lot: number
          price: number | null
          qty: number
          remaining: number
          request_id: string | null
          side: string
          status: string
          team_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      process_house_quotes: { Args: { p_asset?: string }; Returns: undefined }
      process_market_cycle: { Args: never; Returns: string }
      process_news_cycle: { Args: never; Returns: string }
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
      round_tick: { Args: { p: number }; Returns: number }
      tick_for: { Args: { p: number }; Returns: number }
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
        locked_cash: number | null
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
  TableName extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]),
> = (DefaultSchema["Tables"] & DefaultSchema["Views"])[TableName] extends {
  Row: infer R
}
  ? R
  : never

export type Enums<EnumName extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][EnumName]

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "guard", "team", "display"],
      game_state: ["setup", "open", "paused", "finished"],
      news_status: ["draft", "ready", "live", "applied", "cancelled"],
    },
  },
} as const
