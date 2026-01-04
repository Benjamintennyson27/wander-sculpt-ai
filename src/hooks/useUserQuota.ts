import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserQuota {
  plan: 'free' | 'pro';
  isAdmin: boolean;
  subscriptionStatus: string;
  limitTotal: number;
  used: number;
  remaining: number;
  periodStart: string | null;
  periodEnd: string | null;
}

export function useUserQuota() {
  const { user } = useAuth();
  const [quota, setQuota] = useState<UserQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuota = useCallback(async () => {
    if (!user) {
      setQuota(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: rpcError } = await supabase.rpc('get_user_quota', {
        p_user_id: user.id
      });

      if (rpcError) {
        console.error('[useUserQuota] RPC error:', rpcError);
        setError(rpcError.message);
        return;
      }

      if (data) {
        const quotaData = data as Record<string, unknown>;
        setQuota({
          plan: (quotaData.plan as string) === 'pro' ? 'pro' : 'free',
          isAdmin: quotaData.is_admin as boolean,
          subscriptionStatus: quotaData.subscription_status as string || 'inactive',
          limitTotal: quotaData.limit_total as number,
          used: quotaData.used as number,
          remaining: quotaData.remaining as number,
          periodStart: quotaData.period_start as string | null,
          periodEnd: quotaData.period_end as string | null,
        });
        setError(null);
      }
    } catch (err) {
      console.error('[useUserQuota] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch quota');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  const refetch = useCallback(() => {
    return fetchQuota();
  }, [fetchQuota]);

  // Helper to check if user can generate
  const canGenerate = quota ? (quota.isAdmin || quota.remaining > 0) : false;

  // Format remaining text
  const getRemainingText = (): string => {
    if (!quota) return '';
    if (quota.isAdmin) return '∞ unlimited';
    if (quota.plan === 'pro' && quota.subscriptionStatus === 'active') {
      return `${quota.remaining}/${quota.limitTotal} left this month`;
    }
    return `${quota.remaining}/${quota.limitTotal} left`;
  };

  return {
    quota,
    loading,
    error,
    refetch,
    canGenerate,
    getRemainingText,
  };
}
