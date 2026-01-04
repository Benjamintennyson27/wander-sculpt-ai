import { Link } from 'react-router-dom';
import { useUserQuota } from '@/hooks/useUserQuota';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles, Crown, Loader2 } from 'lucide-react';

interface UsageBadgeProps {
  showPlan?: boolean;
  className?: string;
}

export function UsageBadge({ showPlan = false, className = '' }: UsageBadgeProps) {
  const { quota, loading, getRemainingText } = useUserQuota();

  if (loading) {
    return (
      <Badge variant="outline" className={`gap-1.5 ${className}`}>
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Loading...</span>
      </Badge>
    );
  }

  if (!quota) return null;

  const isAdmin = quota.isAdmin;
  const isPro = quota.plan === 'pro' && quota.subscriptionStatus === 'active';
  const isLow = !isAdmin && quota.remaining <= 2 && quota.remaining > 0;
  const isExhausted = !isAdmin && quota.remaining === 0;

  const badgeVariant = isAdmin 
    ? 'default' 
    : isPro 
      ? 'secondary' 
      : isExhausted 
        ? 'destructive' 
        : isLow 
          ? 'outline' 
          : 'outline';

  const content = (
    <Badge 
      variant={badgeVariant} 
      className={`gap-1.5 cursor-pointer hover:opacity-80 transition-opacity ${className}`}
    >
      {isAdmin ? (
        <>
          <Crown className="w-3 h-3" />
          <span>Admin</span>
        </>
      ) : (
        <>
          <Sparkles className="w-3 h-3" />
          <span>{getRemainingText()}</span>
        </>
      )}
    </Badge>
  );

  const tooltipText = isAdmin 
    ? 'Unlimited generations' 
    : isPro 
      ? 'Resets at the start of your billing period' 
      : quota.remaining === 0 
        ? 'Upgrade to Pro for more generations' 
        : 'Upgrade for more generations';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link to="/billing">
          {showPlan && !isAdmin && (
            <div className="flex items-center gap-2">
              <Badge variant={isPro ? 'default' : 'secondary'} className="text-xs">
                {isPro ? 'Pro' : 'Free'}
              </Badge>
              {content}
            </div>
          )}
          {(!showPlan || isAdmin) && content}
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}
