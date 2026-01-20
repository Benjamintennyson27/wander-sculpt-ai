import { Sparkles } from "lucide-react";

export function TypingIndicator() {
  return (
    <div className="flex gap-3 p-3 rounded-lg bg-muted animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-accent text-accent-foreground">
        <Sparkles className="w-4 h-4" />
      </div>
      <div className="flex-1 flex items-center">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
