import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, Download, Check, Loader2 } from 'lucide-react';
import { format, addDays, parse } from 'date-fns';
import { Itinerary, ItineraryDay, ItineraryItem, getTimeBlockOrder } from '@/lib/itinerary-adapter';
import { useToast } from '@/hooks/use-toast';

interface ExportCalendarProps {
  trip: {
    id: string;
    destination: string;
    start_date: string;
    end_date: string;
  };
  itinerary: Itinerary;
}

function getTimeBlockStartHour(timeBlock: string): number {
  switch (timeBlock.toLowerCase()) {
    case 'morning': return 9;
    case 'afternoon': return 13;
    case 'evening': return 18;
    case 'night': return 20;
    default: return 10;
  }
}

function generateICalEvent(
  title: string,
  description: string,
  location: string,
  startDate: Date,
  durationMinutes: number,
  uid: string
): string {
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
  
  const formatICalDate = (date: Date) => {
    return format(date, "yyyyMMdd'T'HHmmss");
  };
  
  const escapeICalText = (text: string) => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };
  
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatICalDate(new Date())}`,
    `DTSTART:${formatICalDate(startDate)}`,
    `DTEND:${formatICalDate(endDate)}`,
    `SUMMARY:${escapeICalText(title)}`,
    description ? `DESCRIPTION:${escapeICalText(description)}` : '',
    location ? `LOCATION:${escapeICalText(location)}` : '',
    'END:VEVENT',
  ].filter(Boolean).join('\r\n');
}

function generateICalFile(trip: ExportCalendarProps['trip'], itinerary: Itinerary): string {
  const events: string[] = [];
  
  itinerary.days.forEach((day) => {
    const dayDate = addDays(new Date(trip.start_date), day.day - 1);
    
    const sortedItems = [...day.items].sort(
      (a, b) => getTimeBlockOrder(a.time_block) - getTimeBlockOrder(b.time_block)
    );
    
    sortedItems.forEach((item, idx) => {
      const startHour = getTimeBlockStartHour(item.time_block) + idx;
      const eventDate = new Date(dayDate);
      eventDate.setHours(startHour, 0, 0, 0);
      
      const duration = item.duration_minutes || 60;
      const location = item.location_area || trip.destination;
      
      let description = item.description || '';
      if (item.cost_min || item.cost_max) {
        description += `\n\nEstimated cost: ₹${item.cost_min || 0} - ₹${item.cost_max || 0}`;
      }
      if (item.transit_tip) {
        description += `\n\nTransit: ${item.transit_tip}`;
      }
      
      const uid = `${trip.id}-day${day.day}-item${idx}@triptailor`;
      
      events.push(generateICalEvent(
        `${item.title} - Day ${day.day}`,
        description.trim(),
        location,
        eventDate,
        duration,
        uid
      ));
    });
  });
  
  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TripTailor//Trip Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${trip.destination} Trip`,
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
  
  return ical;
}

export function ExportCalendar({ trip, itinerary }: ExportCalendarProps) {
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const { toast } = useToast();
  
  const handleExport = async () => {
    setExporting(true);
    
    try {
      const icalContent = generateICalFile(trip, itinerary);
      
      // Create and download the file
      const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${trip.destination.replace(/[^a-zA-Z0-9]/g, '-')}-trip.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setExported(true);
      toast({
        title: 'Calendar exported!',
        description: 'Open the .ics file to add events to your calendar.',
      });
      
      setTimeout(() => setExported(false), 3000);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: 'Could not export calendar. Please try again.',
      });
    } finally {
      setExporting(false);
    }
  };
  
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={exporting}
    >
      {exporting ? (
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
      ) : exported ? (
        <Check className="w-4 h-4 mr-2 text-accent" />
      ) : (
        <Calendar className="w-4 h-4 mr-2" />
      )}
      {exported ? 'Exported!' : 'Export to Calendar'}
    </Button>
  );
}
