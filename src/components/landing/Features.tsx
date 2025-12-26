import { Users, Utensils, Wallet, Compass, Zap, Clock } from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Family-Aware Planning",
    description: "Configure travelers including kids, seniors, and spouse for tailored recommendations.",
    color: "primary" as const,
  },
  {
    icon: Utensils,
    title: "Food Preferences",
    description: "Veg, non-veg, street food, fine dining—we match your taste buds perfectly.",
    color: "accent" as const,
  },
  {
    icon: Wallet,
    title: "Budget Optimization",
    description: "Luxury, mid-range, or budget—all prices in INR with smart cost breakdowns.",
    color: "primary" as const,
  },
  {
    icon: Compass,
    title: "Interest-Based Activities",
    description: "Nature, nightlife, museums, adventure, spiritual sites, beaches, and more.",
    color: "accent" as const,
  },
  {
    icon: Zap,
    title: "Real-Time Web Search",
    description: "Up-to-date info on places, timings, and local tips—not outdated guides.",
    color: "primary" as const,
  },
  {
    icon: Clock,
    title: "Day-by-Day Schedules",
    description: "Morning to evening blocks with travel time estimates and meal suggestions.",
    color: "accent" as const,
  },
];

const Features = () => {
  return (
    <section className="py-24 px-4 relative">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Built for <span className="gradient-text-accent">Real Travelers</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Every feature designed to make your trip planning effortless and personalized.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="glass-card-hover p-6 group"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {/* Icon */}
              <div
                className={`w-12 h-12 rounded-lg mb-4 flex items-center justify-center transition-transform group-hover:scale-110 ${
                  feature.color === "primary" ? "bg-primary/20" : "bg-accent/20"
                }`}
              >
                <feature.icon
                  className={`w-6 h-6 ${
                    feature.color === "primary" ? "text-primary" : "text-accent"
                  }`}
                />
              </div>

              {/* Content */}
              <h3 className="font-semibold text-lg mb-2 text-foreground">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
