import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TermsAcceptanceModalProps {
  open: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

const CURRENT_TERMS_VERSION = '1.0';

export default function TermsAcceptanceModal({ open, onAccept, onCancel }: TermsAcceptanceModalProps) {
  const { user } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    if (!user || !agreed) return;
    
    setLoading(true);
    try {
      await supabase.from('terms_acceptance').insert({
        user_id: user.id,
        version: CURRENT_TERMS_VERSION,
        accepted: true
      });
      onAccept();
    } catch (error) {
      console.error('Error accepting terms:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Terms & Conditions
          </DialogTitle>
          <DialogDescription>
            Please review and accept our terms before generating your itinerary.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="glass-card p-4 max-h-48 overflow-y-auto text-sm text-muted-foreground">
            <p className="mb-2">By using this service, you agree to:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Generated itineraries are AI-powered suggestions only</li>
              <li>Prices, timings, and availability may vary</li>
              <li>Always verify information before making travel decisions</li>
              <li>We are not responsible for booking or travel arrangements</li>
              <li>Your data is stored securely and used only to improve recommendations</li>
            </ul>
            <p className="mt-3">
              <Link to="/terms" className="text-primary hover:underline" target="_blank">
                Read full terms and conditions →
              </Link>
            </p>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="terms"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
            />
            <label htmlFor="terms" className="text-sm cursor-pointer">
              I have read and agree to the terms and conditions (v{CURRENT_TERMS_VERSION})
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleAccept} disabled={!agreed || loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Accept & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
