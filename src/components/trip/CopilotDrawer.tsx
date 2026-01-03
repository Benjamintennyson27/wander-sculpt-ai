import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  X, Send, Bot, User, Loader2, Sparkles, Utensils, 
  Timer, Baby, MapPin
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface CopilotDrawerProps {
  tripId: string;
  optionId?: string;
  isOpen: boolean;
  onClose: () => void;
  onEditApplied: () => void;
}

const QUICK_PROMPTS = [
  { label: 'Make it relaxed', icon: Timer, message: 'Make the pace more relaxed, reduce activities if needed' },
  { label: 'More local food', icon: Utensils, message: 'Add more local food experiences and street food options' },
  { label: 'Kid-friendly', icon: Baby, message: 'Make activities more kid-friendly and family suitable' },
  { label: 'Less travel', icon: MapPin, message: 'Reduce travel time between activities, group nearby places' },
];

export function CopilotDrawer({ tripId, optionId, isOpen, onClose, onEditApplied }: CopilotDrawerProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history
  useEffect(() => {
    if (isOpen && tripId) {
      loadChatHistory();
    }
  }, [isOpen, tripId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChatHistory = async () => {
    setLoadingHistory(true);
    try {
      // Get thread for this trip
      const { data: threads } = await supabase
        .from('trip_chat_threads')
        .select('id')
        .eq('trip_id', tripId)
        .limit(1);

      if (threads && threads.length > 0) {
        const threadId = threads[0].id;
        const { data: msgs } = await supabase
          .from('trip_chat_messages')
          .select('*')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true });

        if (msgs) {
          setMessages(msgs as Message[]);
        }
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || loading) return;

    setInput('');
    setLoading(true);

    // Optimistically add user message
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const { data, error } = await supabase.functions.invoke('copilot-edit', {
        body: { trip_id: tripId, option_id: optionId, user_message: text }
      });

      if (error) throw error;

      // Replace temp message and add assistant response
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message || 'Changes applied successfully!',
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [
        ...prev.filter(m => m.id !== tempUserMsg.id),
        { ...tempUserMsg, id: `user-${Date.now()}` },
        assistantMsg,
      ]);

      if (data.changes && data.changes.length > 0) {
        toast({
          title: 'Itinerary updated!',
          description: data.changes[0],
        });
        onEditApplied();
      }
    } catch (error) {
      console.error('Copilot error:', error);
      toast({
        variant: 'destructive',
        title: 'Edit failed',
        description: 'Could not apply changes. Please try again.',
      });
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 lg:hidden"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className={cn(
        'fixed z-50 bg-card border-l border-border flex flex-col',
        // Mobile: bottom sheet
        'inset-x-0 bottom-0 top-auto h-[85vh] rounded-t-2xl border-t lg:border-t-0 lg:rounded-none',
        // Desktop: right drawer
        'lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[400px] lg:h-full',
        'animate-slide-up lg:animate-fade-in'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-sm">Trip Copilot</h3>
              <p className="text-xs text-muted-foreground">Edit your itinerary with AI</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Note */}
        <div className="px-4 py-2 bg-muted/30 border-b border-border">
          <p className="text-xs text-muted-foreground">
            ✨ Edits apply to your selected itinerary option only
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loadingHistory ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-12 w-2/3 ml-auto" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Ask me to modify your itinerary!
              </p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.label}
                    onClick={() => handleSend(prompt.message)}
                    disabled={loading}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-lg text-left text-sm',
                      'bg-secondary/50 hover:bg-secondary/70 transition-colors',
                      'border border-border/50'
                    )}
                  >
                    <prompt.icon className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>{prompt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-2',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-accent" />
                  </div>
                )}
              </div>
            ))
          )}
          
          {loading && (
            <div className="flex gap-2 items-start">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
              </div>
              <div className="bg-secondary rounded-lg px-3 py-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompts when there are messages */}
        {messages.length > 0 && !loading && (
          <div className="px-4 pb-2">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {QUICK_PROMPTS.slice(0, 2).map((prompt) => (
                <button
                  key={prompt.label}
                  onClick={() => handleSend(prompt.message)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap',
                    'bg-secondary/50 hover:bg-secondary/70 transition-colors',
                    'border border-border/50'
                  )}
                >
                  <prompt.icon className="w-3 h-3 text-primary" />
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask to edit your itinerary..."
              disabled={loading}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-lg text-sm',
                'bg-secondary border border-border',
                'focus:outline-none focus:ring-2 focus:ring-primary/50',
                'placeholder:text-muted-foreground'
              )}
            />
            <Button
              size="icon"
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
