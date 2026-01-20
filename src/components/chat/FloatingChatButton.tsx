import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TravelAssistant } from "./TravelAssistant";
import { cn } from "@/lib/utils";

export function FloatingChatButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Chat Panel */}
      <div
        className={cn(
          "fixed z-50 transition-all duration-300 ease-in-out",
          // Mobile: full width bottom sheet
          "bottom-0 left-0 right-0 h-[85vh]",
          // Desktop: side panel
          "sm:bottom-4 sm:right-4 sm:left-auto sm:w-96 sm:h-[600px] sm:rounded-lg",
          isOpen
            ? "translate-y-0 opacity-100 pointer-events-auto"
            : "translate-y-full sm:translate-y-8 opacity-0 pointer-events-none"
        )}
      >
        <TravelAssistant onClose={() => setIsOpen(false)} />
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="icon"
        className={cn(
          "fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full shadow-lg transition-all duration-300",
          "bg-primary hover:bg-primary/90 text-primary-foreground",
          "hover:scale-105 active:scale-95",
          isOpen && "sm:opacity-0 sm:pointer-events-none"
        )}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </Button>
    </>
  );
}
