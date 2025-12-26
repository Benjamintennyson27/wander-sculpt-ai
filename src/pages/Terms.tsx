import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Plane, ArrowLeft, Shield, Loader2 } from 'lucide-react';

export default function Terms() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('terms_acceptance')
        .upsert({
          user_id: user.id,
          version: '1.0',
          accepted_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,version'
        });

      if (error) throw error;

      toast({ title: 'Terms accepted', description: 'You can now use TripTailor AI.' });
      navigate('/app');
    } catch (error) {
      console.error('Error accepting terms:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save your acceptance. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Plane className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-display font-semibold">TripTailor AI</span>
          </div>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-8">
        <div className="glass-card p-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-display font-semibold">Terms of Service</h1>
          </div>

          <div className="prose prose-invert prose-sm max-w-none mb-8 space-y-4 text-muted-foreground">
            <p className="text-foreground font-medium">
              Version 1.0 — Last updated: December 2024
            </p>

            <h2 className="text-foreground text-lg font-semibold mt-6">1. Service Description</h2>
            <p>
              TripTailor AI is an AI-powered travel planning assistant that generates personalized 
              itineraries based on your preferences. We provide recommendations and suggestions 
              for activities, dining, and accommodations, but we do not offer booking services.
            </p>

            <h2 className="text-foreground text-lg font-semibold">2. Accuracy Disclaimer</h2>
            <p>
              <strong className="text-yellow-500">Important:</strong> The information provided by TripTailor AI, 
              including opening hours, prices, availability, and other details, is generated using 
              AI and may not always be accurate or up-to-date. We strongly recommend verifying all 
              information directly with the establishments or official sources before making travel decisions.
            </p>

            <h2 className="text-foreground text-lg font-semibold">3. User Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>You are responsible for verifying all travel information before making arrangements</li>
              <li>You must ensure you have appropriate travel documents, visas, and insurance</li>
              <li>You are responsible for checking travel advisories and safety information</li>
              <li>You must not use the service for any illegal or unauthorized purposes</li>
            </ul>

            <h2 className="text-foreground text-lg font-semibold">4. Limitation of Liability</h2>
            <p>
              TripTailor AI and its operators shall not be held liable for any losses, damages, 
              or inconveniences arising from the use of our recommendations. This includes but 
              is not limited to missed reservations, incorrect information, or travel disruptions.
            </p>

            <h2 className="text-foreground text-lg font-semibold">5. Data Usage</h2>
            <p>
              We collect and process your travel preferences to provide personalized recommendations. 
              Your data is stored securely and is not shared with third parties except as necessary 
              to provide the service. See our Privacy Policy for more details.
            </p>

            <h2 className="text-foreground text-lg font-semibold">6. Fair Usage</h2>
            <p>
              To ensure fair access for all users, we implement usage limits on itinerary generation. 
              Excessive or automated use of the service may result in temporary restrictions.
            </p>

            <h2 className="text-foreground text-lg font-semibold">7. Changes to Terms</h2>
            <p>
              We reserve the right to update these terms at any time. Continued use of the service 
              after changes constitutes acceptance of the new terms.
            </p>
          </div>

          {/* Accept Section */}
          {user && (
            <div className="border-t border-border pt-6">
              <label className="flex items-start gap-3 cursor-pointer mb-6">
                <Checkbox
                  checked={accepted}
                  onCheckedChange={(checked) => setAccepted(checked === true)}
                  className="mt-1"
                />
                <span className="text-sm">
                  I have read and agree to the Terms of Service. I understand that travel information 
                  may not always be accurate and I will verify details before making arrangements.
                </span>
              </label>

              <Button
                onClick={handleAccept}
                disabled={!accepted || loading}
                className="w-full bg-primary hover:bg-primary/90"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Accept and Continue'
                )}
              </Button>
            </div>
          )}

          {!user && (
            <div className="border-t border-border pt-6 text-center">
              <p className="text-muted-foreground mb-4">
                Please sign in to accept the terms and start using TripTailor AI.
              </p>
              <Button asChild>
                <Link to="/auth">Sign In</Link>
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
