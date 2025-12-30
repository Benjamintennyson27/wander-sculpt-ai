import { CheckCircle2, CircleDashed, Circle, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface VerificationData {
  status: 'verified' | 'partial' | 'unverified' | 'failed';
  quality_score: number;
  best_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  sources: { title: string; url: string; snippet: string }[];
  reasoning: string | null;
}

interface VerificationBadgeProps {
  verification: VerificationData | null;
  compact?: boolean;
  showSources?: boolean;
}

const statusConfig = {
  verified: {
    icon: CheckCircle2,
    label: 'Verified',
    className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    iconClassName: 'text-emerald-400',
  },
  partial: {
    icon: CircleDashed,
    label: 'Partial',
    className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    iconClassName: 'text-yellow-400',
  },
  unverified: {
    icon: Circle,
    label: 'Unverified',
    className: 'bg-muted text-muted-foreground border-border',
    iconClassName: 'text-muted-foreground',
  },
  failed: {
    icon: Circle,
    label: 'Failed',
    className: 'bg-destructive/20 text-destructive border-destructive/30',
    iconClassName: 'text-destructive',
  },
};

export function VerificationBadge({ verification, compact = false, showSources = true }: VerificationBadgeProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false);

  if (!verification) {
    return null;
  }

  const config = statusConfig[verification.status] || statusConfig.unverified;
  const Icon = config.icon;

  if (compact) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
        config.className
      )}>
        <Icon className="w-3 h-3" />
        {verification.quality_score}
      </span>
    );
  }

  return (
    <div className="space-y-2">
      {/* Badge */}
      <div className="flex items-center gap-2">
        <span className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
          config.className
        )}>
          <Icon className="w-3.5 h-3.5" />
          {config.label} ({verification.quality_score})
        </span>
        
        {verification.lat && verification.lng && (
          <a
            href={`https://www.google.com/maps?q=${verification.lat},${verification.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Map
          </a>
        )}
      </div>

      {/* Address */}
      {verification.address && (
        <p className="text-xs text-muted-foreground">
          📍 {verification.address}
        </p>
      )}

      {/* Reasoning */}
      {verification.reasoning && (
        <p className="text-xs text-muted-foreground italic">
          {verification.reasoning}
        </p>
      )}

      {/* Sources */}
      {showSources && verification.sources && verification.sources.length > 0 && (
        <Collapsible open={sourcesOpen} onOpenChange={setSourcesOpen}>
          <CollapsibleTrigger 
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {sourcesOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {verification.sources.length} source{verification.sources.length !== 1 ? 's' : ''}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="space-y-1.5">
              {verification.sources.map((source, idx) => (
                <a
                  key={idx}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-start gap-2 p-2 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors text-xs"
                >
                  <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{source.title}</div>
                    <div className="text-muted-foreground line-clamp-2">{source.snippet}</div>
                  </div>
                </a>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
