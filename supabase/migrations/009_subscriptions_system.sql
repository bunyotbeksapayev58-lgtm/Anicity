-- Migration 009: Complete Subscription System & Management
-- 1. Subscription Plans Table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price_uzs BIGINT NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 30,
  benefits TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  is_popular BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. User Subscriptions Table
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  plan_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  grant_type TEXT NOT NULL DEFAULT 'manual_admin' CHECK (grant_type IN ('manual_admin', 'online_payment', 'promo_code', 'system')),
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Subscription Transactions Table (Payment-ready architecture)
CREATE TABLE IF NOT EXISTS public.subscription_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  amount_uzs BIGINT NOT NULL,
  currency TEXT DEFAULT 'UZS',
  provider TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('payme', 'click', 'uzum', 'manual', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  provider_tx_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Subscription Audit Logs Table
CREATE TABLE IF NOT EXISTS public.subscription_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('grant', 'extend', 'revoke', 'modify', 'expire')),
  previous_plan TEXT,
  previous_expires_at TIMESTAMPTZ,
  new_plan TEXT,
  new_expires_at TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_subs_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subs_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subs_expires_at ON public.user_subscriptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sub_tx_user_id ON public.subscription_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_tx_status ON public.subscription_transactions(status);
CREATE INDEX IF NOT EXISTS idx_sub_audit_user_id ON public.subscription_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_audit_created_at ON public.subscription_audit_logs(created_at);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Plans are viewable by everyone" ON public.subscription_plans FOR SELECT USING (is_active = true OR is_admin());
CREATE POLICY "Admins can manage plans" ON public.subscription_plans FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Users can view own subscriptions" ON public.user_subscriptions FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Admins can manage user subscriptions" ON public.user_subscriptions FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Users can view own transactions" ON public.subscription_transactions FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Admins can manage transactions" ON public.subscription_transactions FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admins can view audit logs" ON public.subscription_audit_logs FOR SELECT USING (is_admin());
CREATE POLICY "Admins can insert audit logs" ON public.subscription_audit_logs FOR INSERT WITH CHECK (is_admin());
