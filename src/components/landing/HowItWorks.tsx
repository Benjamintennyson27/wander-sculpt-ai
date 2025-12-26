import { MessageSquare, Search, Sparkles, Save } from "lucide-react";

const steps = [
  {
    icon: MessageSquare,
    title: "Tell Us About Your Trip",
    description: "Family size, budget, dates, food preferences, and interests—we capture everything that matters.",
    color: "primary" as const,
  },
  {
    icon: Search,
    title: "AI Searches Real-Time Info",
    description: "We fetch up-to-date details on restaurants, attractions, transport, and local tips.",
    color: "accent" as const,
  },
  {
    icon: Sparkles,
    title: "Get 3 Personalized Options",
    description: "Choose from 3 tailored itineraries with a 'Best for You' recommendation and reasoning.",
    color: "primary" as const,
  },
  {
    icon: Save,
    title: "Save & Regenerate Anytime",
    description: "Keep your plans, tweak preferences, or regenerate until it's perfect.",
    color: "accent" as const,
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            From preferences to perfect plans in minutes—not hours of research.
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="glass-card-hover p-6 relative group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Step number */}
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-muted-foreground border border-border">
                {index + 1}
              </div>

              {/* Icon */}
              <div
                className={`w-14 h-14 rounded-xl mb-4 flex items-center justify-center ${
                  step.color === "primary" ? "bg-primary/20" : "bg-accent/20"
                }`}
              >
                <step.icon
                  className={`w-7 h-7 ${
                    step.color === "primary" ? "text-primary" : "text-accent"
                  }`}
                />
              </div>

              {/* Content */}
              <h3 className="font-semibold text-lg mb-2 text-foreground">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
