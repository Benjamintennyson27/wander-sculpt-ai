import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';

interface Reminder {
  id: string;
  reminder_type: 'before_trip' | 'packing' | 'custom';
  days_before: number;
  scheduled_for: string;
  sent_at: string | null;
}

interface TripRemindersProps {
  tripId: string;
  tripStartDate: string;
  tripDestination: string;
}

const reminderOptions = [
  { value: '1', label: '1 day before' },
  { value: '3', label: '3 days before' },
  { value: '7', label: '1 week before' },
  { value: '14', label: '2 weeks before' },
  { value: '30', label: '1 month before' },
];

export function TripReminders({ tripId, tripStartDate, tripDestination }: TripRemindersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [daysBefore, setDaysBefore] = useState('3');
  const [reminderType, setReminderType] = useState<'before_trip' | 'packing'>('before_trip');
  const { user } = useAuth();

  const fetchReminders = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('trip_reminders')
      .select('*')
      .eq('trip_id', tripId)
      .eq('user_id', user.id)
      .order('scheduled_for', { ascending: true });

    if (data) setReminders(data as Reminder[]);
  };

  useEffect(() => {
    if (isOpen) {
      fetchReminders();
    }
  }, [isOpen, tripId, user]);

  const handleAddReminder = async () => {
    if (!user?.email) {
      toast.error('Please set your email in profile settings');
      return;
    }

    setLoading(true);
    try {
      const startDate = new Date(tripStartDate);
      const scheduledFor = subDays(startDate, parseInt(daysBefore));

      // Check if reminder already exists for this day
      const existing = reminders.find(
        r => r.days_before === parseInt(daysBefore) && r.reminder_type === reminderType
      );
      if (existing) {
        toast.error('Reminder already set for this time');
        return;
      }

      const { error } = await supabase
        .from('trip_reminders')
        .insert({
          trip_id: tripId,
          user_id: user.id,
          email: user.email,
          reminder_type: reminderType,
          days_before: parseInt(daysBefore),
          scheduled_for: scheduledFor.toISOString(),
        });

      if (error) throw error;

      toast.success('Reminder scheduled!');
      fetchReminders();
    } catch (error) {
      console.error('Error adding reminder:', error);
      toast.error('Failed to add reminder');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    try {
      const { error } = await supabase
        .from('trip_reminders')
        .delete()
        .eq('id', reminderId);

      if (error) throw error;
      toast.success('Reminder deleted');
      fetchReminders();
    } catch (error) {
      console.error('Error deleting reminder:', error);
      toast.error('Failed to delete reminder');
    }
  };

  const getReminderTypeLabel = (type: string) => {
    switch (type) {
      case 'before_trip':
        return 'Trip Reminder';
      case 'packing':
        return 'Packing Reminder';
      default:
        return 'Reminder';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bell className="h-4 w-4" />
          Reminders
          {reminders.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {reminders.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trip Reminders</DialogTitle>
          <DialogDescription>
            Get email reminders before your trip to {tripDestination}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add new reminder */}
          <div className="flex flex-col gap-3 p-4 border rounded-lg">
            <div className="flex items-center gap-2">
              <Select value={reminderType} onValueChange={(v) => setReminderType(v as any)}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="before_trip">Trip Reminder</SelectItem>
                  <SelectItem value="packing">Packing Reminder</SelectItem>
                </SelectContent>
              </Select>
              <Select value={daysBefore} onValueChange={setDaysBefore}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reminderOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddReminder} disabled={loading} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Reminder
            </Button>
          </div>

          {/* Existing reminders */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Scheduled Reminders
            </h4>
            {reminders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No reminders set. Add one above!
              </p>
            ) : (
              reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {getReminderTypeLabel(reminder.reminder_type)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(reminder.scheduled_for), 'PPP')}
                        {reminder.sent_at && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Sent
                          </Badge>
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDeleteReminder(reminder.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
