-- Create function to increment lifetime generations
CREATE OR REPLACE FUNCTION public.increment_lifetime_generations(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles 
  SET lifetime_generations_used = COALESCE(lifetime_generations_used, 0) + 1,
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- Create function to increment period generations
CREATE OR REPLACE FUNCTION public.increment_period_generations(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles 
  SET period_generations_used = COALESCE(period_generations_used, 0) + 1,
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;