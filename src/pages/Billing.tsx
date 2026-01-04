import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserQuota } from '@/hooks/useUserQuota';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Plane, ArrowLeft, Check, Sparkles, Crown,
  Loader2, ExternalLink, Calendar
} from 'lucide-react';
import { format } from 'date-fns';

export default function Billing() {
  const { user } = useAuth();
  const { quota, loading: quotaLoading, refetch } = useUserQuota();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  // Handle success/cancel redirects
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast({
        title: 'Subscription activated!',
        description: 'Welcome to Pro! You now have 10 generations per month.',
      });
      refetch();
    } else if (searchParams.get('canceled') === 'true') {
      toast({
        title: 'Checkout canceled',
        description: 'Your subscription was not activated.',
        variant: 'destructive',
      });
    }
  }, [searchParams, toast, refetch]);

  const handleUpgrade = async () => {
    try {
      setCheckoutLoading(true);
      const { data, error } = await supabase.functions.invoke('stripe-create-checkout');
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to start checkout',
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setPortalLoading(true);
      const { data, error } = await supabase.functions.invoke('stripe-create-portal');
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Portal error:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to open billing portal',
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const isAdmin = quota?.isAdmin;
  const isPro = quota?.plan === 'pro' && quota?.subscriptionStatus === 'active';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Plane className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-display font-semibold">TripTailor</span>
          </Link>
          
          <Button variant="ghost" asChild>
            <Link to="/app" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-semibold mb-2">Billing & Usage</h1>
          <p className="text-muted-foreground">
            Manage your subscription and view usage
          </p>
        </div>

        {quotaLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Plan Card */}
            <div className="glass-card p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-semibold">Current Plan</h2>
                    <Badge variant={isAdmin ? 'default' : isPro ? 'default' : 'secondary'}>
                      {isAdmin ? (
                        <><Crown className="w-3 h-3 mr-1" /> Admin</>
                      ) : isPro ? (
                        <><Sparkles className="w-3 h-3 mr-1" /> Pro</>
                      ) : (
                        'Free'
                      )}
                    </Badge>
                  </div>
                  {quota?.periodEnd && isPro && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Next billing: {format(new Date(quota.periodEnd), 'MMMM d, yyyy')}
                    </p>
                  )}
                </div>
                
                {isPro && (
                  <Button 
                    variant="outline" 
                    onClick={handleManageSubscription}
                    disabled={portalLoading}
                    className="gap-2"
                  >
                    {portalLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ExternalLink className="w-4 h-4" />
                    )}
                    Manage Subscription
                  </Button>
                )}
              </div>

              {/* Usage Stats */}
              <div className="p-4 rounded-lg bg-secondary/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Generations Used</span>
                  <span className="text-sm text-muted-foreground">
                    {isAdmin ? (
                      '∞ unlimited'
                    ) : (
                      `${quota?.used || 0} / ${quota?.limitTotal || 1}`
                    )}
                  </span>
                </div>
                {!isAdmin && (
                  <div className="w-full h-2 bg-background rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-500"
                      style={{ 
                        width: `${Math.min(100, ((quota?.used || 0) / (quota?.limitTotal || 1)) * 100)}%` 
                      }}
                    />
                  </div>
                )}
                {isPro && quota?.periodEnd && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Resets on {format(new Date(quota.periodEnd), 'MMMM d, yyyy')}
                  </p>
                )}
              </div>
            </div>

            {/* Upgrade Card (only for free users) */}
            {!isPro && !isAdmin && (
              <div className="glass-card p-6 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      <h2 className="text-xl font-semibold">Upgrade to Pro</h2>
                    </div>
                    <p className="text-muted-foreground mb-4">
                      Get 10 AI-generated trip itineraries every month
                    </p>
                    <ul className="space-y-2 mb-6">
                      {[
                        '10 trip generations per month',
                        'AI-powered personalized itineraries',
                        'Real place verification',
                        'Share trips with anyone',
                        'Priority support',
                      ].map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-primary" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">$10</div>
                    <div className="text-sm text-muted-foreground">/month</div>
                  </div>
                </div>
                
                <Button 
                  size="lg" 
                  onClick={handleUpgrade}
                  disabled={checkoutLoading}
                  className="w-full gap-2"
                >
                  {checkoutLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Upgrade Now
                </Button>
              </div>
            )}

            {/* FAQ / Info */}
            <div className="glass-card p-6">
              <h3 className="font-semibold mb-4">Frequently Asked Questions</h3>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="font-medium mb-1">What counts as a generation?</p>
                  <p className="text-muted-foreground">
                    Each time you create a new trip, it counts as one generation. This includes the 3 itinerary options we create for you.
                  </p>
                </div>
                <div>
                  <p className="font-medium mb-1">When does my quota reset?</p>
                  <p className="text-muted-foreground">
                    Pro subscribers get 10 generations that reset on each billing cycle. Free users have a lifetime limit of 1 generation.
                  </p>
                </div>
                <div>
                  <p className="font-medium mb-1">Can I cancel anytime?</p>
                  <p className="text-muted-foreground">
                    Yes! You can cancel your subscription at any time through the Manage Subscription button. You'll keep access until the end of your billing period.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
