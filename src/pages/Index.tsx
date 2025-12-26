import HeroSection from "@/components/landing/HeroSection";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import SampleItinerary from "@/components/landing/SampleItinerary";
import TrustSafety from "@/components/landing/TrustSafety";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <HowItWorks />
      <Features />
      <SampleItinerary />
      <TrustSafety />
      <CTASection />
      <Footer />
    </div>
  );
};

export default Index;
