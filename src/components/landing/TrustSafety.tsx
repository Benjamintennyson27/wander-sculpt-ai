import { Shield, Lock, AlertTriangle, FileCheck } from "lucide-react";

const trustItems = [
  {
    icon: FileCheck,
    title: "Terms Acceptance",
    description: "Clear terms required before generating itineraries—so you know exactly what to expect.",
  },
  {
    icon: Lock,
    title: "Private by Default",
    description: "Your trips and preferences are private. Row-level security ensures only you see your data.",
  },
  {
    icon: AlertTriangle,
    title: "Accuracy Disclaimer",
    description: "We use real-time search, but info may change. Always verify timings and prices locally.",
  },
  {
    icon: Shield,
    title: "Secure Infrastructure",
    description: "Built on enterprise-grade infrastructure with encrypted connections and secure API handling.",
  },
];

const TrustSafety = () => {
  return (
    <section className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Trust & <span className="gradient-text">Safety</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Your privacy and security are our priority. Here's how we protect you.
          </p>
        </div>

        {/* Trust grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {trustItems.map((item, index) => (
            <div
              key={item.title}
              className="glass-card p-6 flex gap-4"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <item.icon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustSafety;
