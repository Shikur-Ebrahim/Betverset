-- ====================================================
-- Supabase Index Optimization
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/hfkbbojtkdqcgtxlleoe/sql/new
-- ====================================================

-- FIXTURES: most queried table
CREATE INDEX IF NOT EXISTS idx_fixtures_status ON public.fixtures(status);
CREATE INDEX IF NOT EXISTS idx_fixtures_kickoff_at ON public.fixtures(kickoff_at);
CREATE INDEX IF NOT EXISTS idx_fixtures_league_id ON public.fixtures(league_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_status_kickoff ON public.fixtures(status, kickoff_at);
CREATE INDEX IF NOT EXISTS idx_fixtures_home_team ON public.fixtures(home_team_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_away_team ON public.fixtures(away_team_id);

-- ODDS: queried heavily by fixture_id
CREATE INDEX IF NOT EXISTS idx_odds_fixture_id ON public.odds(fixture_id);
CREATE INDEX IF NOT EXISTS idx_odds_market_key ON public.odds(market_key);
CREATE INDEX IF NOT EXISTS idx_odds_fixture_market ON public.odds(fixture_id, market_key);

-- BET_SLIPS: filtered by user, status
CREATE INDEX IF NOT EXISTS idx_bet_slips_user_id ON public.bet_slips(user_id);
CREATE INDEX IF NOT EXISTS idx_bet_slips_status ON public.bet_slips(status);
CREATE INDEX IF NOT EXISTS idx_bet_slips_user_status ON public.bet_slips(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bet_slips_ticket_code ON public.bet_slips(ticket_code);
CREATE INDEX IF NOT EXISTS idx_bet_slips_created_at ON public.bet_slips(created_at DESC);

-- DEPOSIT_REQUESTS: filtered by user, status
CREATE INDEX IF NOT EXISTS idx_deposit_requests_user_id ON public.deposit_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON public.deposit_requests(status);

-- WITHDRAWAL_REQUESTS: filtered by user, status
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON public.withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.withdrawal_requests(status);

-- USERS: lookup by phone (used in admin)
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- LEAGUES: ordered by top_rank
CREATE INDEX IF NOT EXISTS idx_leagues_top_rank ON public.leagues(top_rank);
CREATE INDEX IF NOT EXISTS idx_leagues_is_top ON public.leagues(is_top);

-- APP_SETTINGS: key lookup
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings(key);

-- MANUAL_TICKET_MATCHES: active flag
CREATE INDEX IF NOT EXISTS idx_manual_ticket_matches_active ON public.manual_ticket_matches(is_active);
CREATE INDEX IF NOT EXISTS idx_manual_ticket_matches_date ON public.manual_ticket_matches(match_date);
