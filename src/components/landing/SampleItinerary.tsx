import { MapPin, Sun, Coffee, Moon, Utensils, Lightbulb, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const sampleDay = {
  day: 1,
  title: "Old Goa & Beach Vibes",
  morning: {
    activity: "Visit Basilica of Bom Jesus & Se Cathedral",
    time: "9:00 AM - 12:00 PM",
    tip: "Go early to avoid crowds",
  },
  afternoon: {
    activity: "Calangute Beach & Water Sports",
    time: "2:00 PM - 5:30 PM",
    tip: "Bargain for parasailing packages",
  },
  evening: {
    activity: "Sunset at Anjuna Beach + Curlies Shack",
    time: "6:00 PM onwards",
    tip: "Wednesday flea market if visiting mid-week",
  },
  food: "Lunch at Fisherman's Wharf (₹800-1200 for 2)",
  notes: "Total travel time: ~45 mins between locations",
};

const SampleItinerary = () => {
  return (
    <section className="py-24 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Sample <span className="gradient-text">Itinerary Output</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Here's what a day in your personalized itinerary looks like.
          </p>
        </div>

        {/* Sample card */}
        <div className="glass-card p-6 sm:p-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-display text-xl font-semibold text-foreground">Goa Adventure</h3>
                <p className="text-sm text-muted-foreground">Option 1 of 3</p>
              </div>
            </div>
            <Badge className="bg-accent/20 text-accent border-accent/30 w-fit">
              <Star className="w-3 h-3 mr-1" />
              Best for You
            </Badge>
          </div>

          {/* Day header */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-2xl font-display font-bold gradient-text">Day {sampleDay.day}</span>
            <span className="text-muted-foreground">—</span>
            <span className="text-foreground font-medium">{sampleDay.title}</span>
          </div>

          {/* Time blocks */}
          <div className="space-y-4">
            {/* Morning */}
            <div className="glass-card-hover p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-foreground">Morning</span>
                <span className="text-xs text-muted-foreground ml-auto">{sampleDay.morning.time}</span>
              </div>
              <p className="text-foreground mb-1">{sampleDay.morning.activity}</p>
              <p className="text-xs text-accent flex items-center gap-1">
                <Lightbulb className="w-3 h-3" />
                {sampleDay.morning.tip}
              </p>
            </div>

            {/* Afternoon */}
            <div className="glass-card-hover p-4">
              <div className="flex items-center gap-2 mb-2">
                <Coffee className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-medium text-foreground">Afternoon</span>
                <span className="text-xs text-muted-foreground ml-auto">{sampleDay.afternoon.time}</span>
              </div>
              <p className="text-foreground mb-1">{sampleDay.afternoon.activity}</p>
              <p className="text-xs text-accent flex items-center gap-1">
                <Lightbulb className="w-3 h-3" />
                {sampleDay.afternoon.tip}
              </p>
            </div>

            {/* Evening */}
            <div className="glass-card-hover p-4">
              <div className="flex items-center gap-2 mb-2">
                <Moon className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-medium text-foreground">Evening</span>
                <span className="text-xs text-muted-foreground ml-auto">{sampleDay.evening.time}</span>
              </div>
              <p className="text-foreground mb-1">{sampleDay.evening.activity}</p>
              <p className="text-xs text-accent flex items-center gap-1">
                <Lightbulb className="w-3 h-3" />
                {sampleDay.evening.tip}
              </p>
            </div>
          </div>

          {/* Food & Notes */}
          <div className="mt-6 pt-6 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-2">
              <Utensils className="w-4 h-4 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Food Suggestion</p>
                <p className="text-sm text-muted-foreground">{sampleDay.food}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-accent mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Travel Notes</p>
                <p className="text-sm text-muted-foreground">{sampleDay.notes}</p>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-6 p-3 rounded-lg bg-muted/50 border border-border/50">
            <p className="text-xs text-muted-foreground text-center">
              ⚠️ <span className="font-medium">Accuracy Note:</span> Timings and prices may vary. Please verify locally before visiting.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SampleItinerary;
