import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight } from 'lucide-react';

interface QuotaExceededModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: 'free' | 'pro';
}

export function QuotaExceededModal({ open, onOpenChange, plan }: QuotaExceededModalProps) {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate('/billing');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 border border-primary/20 w-fit">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">
            You've used all generations
          </DialogTitle>
          <DialogDescription className="text-center">
            {plan === 'free' ? (
              <>
                Free accounts include 1 trip generation. Upgrade to Pro for 10 generations per month.
              </>
            ) : (
              <>
                You've used all 10 generations this month. Your quota resets at the start of your next billing period.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 p-4 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-primary">Pro Plan</span>
            <span className="text-lg font-bold">$10/mo</span>
          </div>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>✓ 10 trip generations per month</li>
            <li>✓ AI-powered itineraries</li>
            <li>✓ Place verification</li>
            <li>✓ Trip sharing</li>
          </ul>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          {plan === 'free' && (
            <Button onClick={handleUpgrade} className="w-full gap-2">
              Upgrade to Pro
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            {plan === 'free' ? 'Maybe later' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
