-- Create role enum
CREATE TYPE public.app_role AS ENUM ('user', 'admin');

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Extend profiles table with billing fields
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'inactive' 
  CHECK (subscription_status IN ('active', 'trialing', 'past_due', 'canceled', 'inactive')),
ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
ADD COLUMN IF NOT EXISTS lifetime_generations_used integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS period_generations_used integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create generation_events table for audit
CREATE TABLE public.generation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('generate', 'regenerate')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.generation_events ENABLE ROW LEVEL SECURITY;

-- RLS for generation_events
CREATE POLICY "Users can insert own generation events"
  ON public.generation_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own generation events"
  ON public.generation_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create get_user_quota function (RPC)
CREATE OR REPLACE FUNCTION public.get_user_quota(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_is_admin boolean;
  v_limit_total integer;
  v_used integer;
  v_remaining integer;
BEGIN
  -- Get profile
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  
  -- Check admin status using the has_role function
  v_is_admin := has_role(p_user_id, 'admin');
  
  -- If admin, unlimited
  IF v_is_admin THEN
    RETURN jsonb_build_object(
      'plan', COALESCE(v_profile.plan, 'free'),
      'is_admin', true,
      'subscription_status', COALESCE(v_profile.subscription_status, 'inactive'),
      'limit_total', -1,
      'used', 0,
      'remaining', -1,
      'period_start', v_profile.current_period_start,
      'period_end', v_profile.current_period_end
    );
  END IF;
  
  -- Check plan
  IF v_profile.plan = 'pro' AND v_profile.subscription_status IN ('active', 'trialing') THEN
    v_limit_total := 10;
    v_used := COALESCE(v_profile.period_generations_used, 0);
  ELSE
    v_limit_total := 1;
    v_used := COALESCE(v_profile.lifetime_generations_used, 0);
  END IF;
  
  v_remaining := GREATEST(0, v_limit_total - v_used);
  
  RETURN jsonb_build_object(
    'plan', COALESCE(v_profile.plan, 'free'),
    'is_admin', false,
    'subscription_status', COALESCE(v_profile.subscription_status, 'inactive'),
    'limit_total', v_limit_total,
    'used', v_used,
    'remaining', v_remaining,
    'period_start', v_profile.current_period_start,
    'period_end', v_profile.current_period_end
  );
END;
$$;

-- Update the handle_new_user function to also set email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (new.id, new.raw_user_meta_data ->> 'name', new.email);
  
  INSERT INTO public.preferences (user_id)
  VALUES (new.id);
  
  -- Also create a default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');
  
  RETURN new;
END;
$$;