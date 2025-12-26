import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plane, Sparkles, MapPin, Calendar } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden px-4 py-20">
      {/* Floating decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-[10%] text-primary/20 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <Plane className="w-12 h-12 rotate-12" />
        </div>
        <div className="absolute top-40 right-[15%] text-accent/20 animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <MapPin className="w-10 h-10" />
        </div>
        <div className="absolute bottom-32 left-[20%] text-primary/15 animate-fade-in" style={{ animationDelay: "0.6s" }}>
          <Calendar className="w-8 h-8" />
        </div>
        <div className="absolute bottom-40 right-[25%] text-accent/15 animate-fade-in" style={{ animationDelay: "0.8s" }}>
          <Sparkles className="w-10 h-10" />
        </div>
      </div>

      <div className="max-w-5xl mx-auto text-center z-10">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 glass-card px-4 py-2 mb-8 animate-fade-in">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="text-sm text-muted-foreground">AI-Powered Travel Planning</span>
        </div>

        {/* Main headline */}
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 animate-slide-up text-balance">
          <span className="text-foreground">Your Perfect Trip,</span>
          <br />
          <span className="gradient-text">Tailored by AI</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in text-balance" style={{ animationDelay: "0.2s" }}>
          Get personalized day-by-day itineraries with 3 options to choose from.
          <br className="hidden sm:block" />
          No bookings, just perfect plans crafted for your preferences.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <Button asChild size="lg" className="glow-primary text-base px-8 py-6">
            <Link to="/auth">
              <Sparkles className="w-5 h-5 mr-2" />
              Start Planning
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="text-base px-8 py-6 border-border/50 hover:border-primary/50">
            <a href="#how-it-works">
              See How It Works
            </a>
          </Button>
        </div>

        {/* Preview card */}
        <div className="mt-16 glass-card-hover p-6 max-w-md mx-auto animate-fade-in" style={{ animationDelay: "0.6s" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Sample: 3-Day Goa Trip</p>
              <p className="text-xs text-muted-foreground">Family of 4 • Mid-budget • Relaxed pace</p>
            </div>
          </div>
          <div className="space-y-2 text-left">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-16 text-accent font-medium">Day 1</span>
              <span className="text-muted-foreground">Beaches & Seafood Paradise</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-16 text-accent font-medium">Day 2</span>
              <span className="text-muted-foreground">Heritage Walk & Spice Markets</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-16 text-accent font-medium">Day 3</span>
              <span className="text-muted-foreground">Adventure Water Sports</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
