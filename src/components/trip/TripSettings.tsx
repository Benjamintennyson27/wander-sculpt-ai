import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Settings, CheckCircle2, CircleDashed, Circle, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TripSettingsProps {
  tripId: string;
  onVerifyNow?: () => void;
  verifying?: boolean;
}

interface VerificationSummary {
  verified: number;
  partial: number;
  unverified: number;
}

export function TripSettings({ tripId, onVerifyNow, verifying }: TripSettingsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoVerify, setAutoVerify] = useState(true);
  const [verifyMode, setVerifyMode] = useState<'fast' | 'balanced' | 'strict'>('balanced');
  const [summary, setSummary] = useState<VerificationSummary | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [tripId]);

  const fetchSettings = async () => {
    setLoading(true);
    
    // Fetch settings
    const { data: settings } = await supabase
      .from('trip_settings')
      .select('*')
      .eq('trip_id', tripId)
      .single();

    if (settings) {
      setAutoVerify(settings.auto_verify);
      setVerifyMode(settings.verify_mode as 'fast' | 'balanced' | 'strict');
    }

    // Fetch verification summary
    const { data: verifications } = await supabase
      .from('place_verifications')
      .select('status')
      .eq('trip_id', tripId);

    if (verifications) {
      const counts = { verified: 0, partial: 0, unverified: 0 };
      verifications.forEach(v => {
        if (v.status === 'verified') counts.verified++;
        else if (v.status === 'partial') counts.partial++;
        else counts.unverified++;
      });
      setSummary(counts);
    }

    setLoading(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    
    const { error } = await supabase
      .from('trip_settings')
      .upsert({
        trip_id: tripId,
        auto_verify: autoVerify,
        verify_mode: verifyMode,
      }, { onConflict: 'trip_id' });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to save settings',
        description: error.message,
      });
    } else {
      toast({ title: 'Settings saved!' });
    }
    
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-4 rounded-lg bg-card border border-border animate-pulse">
        <div className="h-6 w-32 bg-muted rounded mb-4" />
        <div className="h-8 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg bg-card border border-border space-y-4">
      <div className="flex items-center gap-2">
        <Settings className="w-4 h-4 text-primary" />
        <h4 className="font-medium">Verification Settings</h4>
      </div>

      {/* Summary */}
      {summary && (summary.verified > 0 || summary.partial > 0 || summary.unverified > 0) && (
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            {summary.verified}
          </span>
          <span className="flex items-center gap-1 text-yellow-400">
            <CircleDashed className="w-4 h-4" />
            {summary.partial}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Circle className="w-4 h-4" />
            {summary.unverified}
          </span>
        </div>
      )}

      {/* Auto-verify toggle */}
      <div className="flex items-center justify-between">
        <label htmlFor="auto-verify" className="text-sm">
          Auto-verify after generation
        </label>
        <Switch
          id="auto-verify"
          checked={autoVerify}
          onCheckedChange={(checked) => {
            setAutoVerify(checked);
            saveSettings();
          }}
        />
      </div>

      {/* Verify mode dropdown */}
      <div className="flex items-center justify-between gap-4">
        <label className="text-sm">Verify mode</label>
        <Select 
          value={verifyMode} 
          onValueChange={(v) => {
            setVerifyMode(v as 'fast' | 'balanced' | 'strict');
            setTimeout(saveSettings, 100);
          }}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fast">Fast</SelectItem>
            <SelectItem value="balanced">Balanced</SelectItem>
            <SelectItem value="strict">Strict</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Verify Now button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={onVerifyNow}
        disabled={verifying}
      >
        {verifying ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Verifying...
          </>
        ) : (
          <>
            <PlayCircle className="w-4 h-4 mr-2" />
            Verify Places Now
          </>
        )}
      </Button>
    </div>
  );
}
