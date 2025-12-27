import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, ArrowRight, Users, Wallet, Utensils, 
  Compass, Gauge, MapPin, Building, Calendar, Loader2,
  Check, Plane
} from 'lucide-react';
import { format } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import TermsAcceptanceModal from '@/components/TermsAcceptanceModal';

const INTERESTS = [
  { id: 'nature', label: 'Nature & Wildlife', icon: '🌿' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️' },
  { id: 'nightlife', label: 'Nightlife', icon: '🎉' },
  { id: 'museums', label: 'Museums & Culture', icon: '🏛️' },
  { id: 'adventure', label: 'Adventure Sports', icon: '🏔️' },
  { id: 'spiritual', label: 'Spiritual & Religious', icon: '🙏' },
  { id: 'beaches', label: 'Beaches', icon: '🏖️' },
  { id: 'food', label: 'Culinary Experiences', icon: '🍜' },
  { id: 'history', label: 'Historical Sites', icon: '🏰' },
  { id: 'photography', label: 'Photography Spots', icon: '📸' },
];

interface TripFormData {
  isFamily: boolean;
  travelers: {
    adults: number;
    hasSpouse: boolean;
    kids: number;
    seniors: number;
  };
  budget: number;
  budgetStyle: 'luxury' | 'mid' | 'budget';
  foodPref: 'restaurant' | 'street_food' | 'mix';
  diet: 'veg' | 'non_veg' | 'both';
  interests: string[];
  pace: 'relaxed' | 'moderate' | 'packed';
  destination: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
  stayPreference: 'central' | 'quiet';
}

const STEPS = [
  { id: 'travelers', title: 'Travelers', icon: Users },
  { id: 'budget', title: 'Budget', icon: Wallet },
  { id: 'food', title: 'Food', icon: Utensils },
  { id: 'interests', title: 'Interests', icon: Compass },
  { id: 'pace', title: 'Pace', icon: Gauge },
  { id: 'destination', title: 'Destination', icon: MapPin },
];

const CURRENT_TERMS_VERSION = '1.0';

export default function NewTrip() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
  
  const [formData, setFormData] = useState<TripFormData>({
    isFamily: false,
    travelers: { adults: 1, hasSpouse: false, kids: 0, seniors: 0 },
    budget: 50000,
    budgetStyle: 'mid',
    foodPref: 'mix',
    diet: 'both',
    interests: [],
    pace: 'moderate',
    destination: '',
    startDate: undefined,
    endDate: undefined,
    stayPreference: 'central',
  });

  const updateForm = (updates: Partial<TripFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const updateTravelers = (updates: Partial<typeof formData.travelers>) => {
    setFormData(prev => ({
      ...prev,
      travelers: { ...prev.travelers, ...updates }
    }));
  };

  const toggleInterest = (interest: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  // Check if user has accepted terms
  useEffect(() => {
    const checkTerms = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('terms_acceptance')
        .select('id')
        .eq('user_id', user.id)
        .eq('version', CURRENT_TERMS_VERSION)
        .maybeSingle();
      setTermsAccepted(!!data);
    };
    checkTerms();
  }, [user]);

  const canProceed = () => {
    switch (currentStep) {
      case 0: return true;
      case 1: return formData.budget > 0;
      case 2: return true;
      case 3: return formData.interests.length > 0;
      case 4: return true;
      case 5: return formData.destination && formData.startDate && formData.endDate;
      default: return true;
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    
    // Check terms first
    if (!termsAccepted) {
      setShowTermsModal(true);
      return;
    }
    
    await createTripAndGenerate();
  };

  const createTripAndGenerate = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      const { data: trip, error } = await supabase
        .from('trips')
        .insert({
          user_id: user.id,
          destination: formData.destination,
          start_date: format(formData.startDate!, 'yyyy-MM-dd'),
          end_date: format(formData.endDate!, 'yyyy-MM-dd'),
          is_family: formData.isFamily,
          budget_inr: formData.budget,
          budget_style: formData.budgetStyle,
          food_pref: formData.foodPref,
          diet: formData.diet,
          pace: formData.pace,
          stay_preference: formData.stayPreference,
          travelers: formData.travelers,
          interests: formData.interests,
          status: 'generating'
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger itinerary generation
      const { data: genData, error: genError } = await supabase.functions.invoke('generate-itinerary', {
        body: { tripId: trip.id }
      });

      // Handle TERMS_REQUIRED error
      if (genError) {
        const errorBody = genData || {};
        if (errorBody.error === 'TERMS_REQUIRED') {
          setShowTermsModal(true);
          return;
        }
        if (errorBody.error === 'RATE_LIMIT_EXCEEDED') {
          toast({
            variant: 'destructive',
            title: 'Rate limit reached',
            description: errorBody.message || 'Please try again later.'
          });
          return;
        }
        console.error('Generation error:', genError);
        toast({
          variant: 'destructive',
          title: 'Generation started with issues',
          description: 'Your trip was created but generation may take longer.'
        });
      }

      navigate(`/app/trip/${trip.id}`);
    } catch (error: unknown) {
      console.error('Error creating trip:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to create trip',
        description: error instanceof Error ? error.message : 'Please try again'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTermsAccepted = () => {
    setTermsAccepted(true);
    setShowTermsModal(false);
    // Continue with trip creation
    createTripAndGenerate();
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base">Is this a family trip?</Label>
              <RadioGroup
                value={formData.isFamily ? 'yes' : 'no'}
                onValueChange={(val) => updateForm({ isFamily: val === 'yes' })}
                className="flex gap-4"
              >
                <label className={`flex-1 glass-card-hover p-4 cursor-pointer flex items-center gap-3 ${!formData.isFamily ? 'border-primary' : ''}`}>
                  <RadioGroupItem value="no" id="solo" />
                  <span>Solo / Friends</span>
                </label>
                <label className={`flex-1 glass-card-hover p-4 cursor-pointer flex items-center gap-3 ${formData.isFamily ? 'border-primary' : ''}`}>
                  <RadioGroupItem value="yes" id="family" />
                  <span>Family Trip</span>
                </label>
              </RadioGroup>
            </div>

            {formData.isFamily && (
              <div className="space-y-4 animate-slide-up">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Adults</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.travelers.adults}
                      onChange={(e) => updateTravelers({ adults: parseInt(e.target.value) || 1 })}
                      className="bg-secondary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Kids</Label>
                    <Input
                      type="number"
                      min={0}
                      value={formData.travelers.kids}
                      onChange={(e) => updateTravelers({ kids: parseInt(e.target.value) || 0 })}
                      className="bg-secondary/50"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Seniors (60+)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.travelers.seniors}
                    onChange={(e) => updateTravelers({ seniors: parseInt(e.target.value) || 0 })}
                    className="bg-secondary/50"
                  />
                </div>
              </div>
            )}

            {!formData.isFamily && (
              <div className="space-y-2 animate-slide-up">
                <Label>How many travelers?</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.travelers.adults}
                  onChange={(e) => updateTravelers({ adults: parseInt(e.target.value) || 1 })}
                  className="bg-secondary/50"
                />
              </div>
            )}
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base">Total budget (in INR)</Label>
              <Input
                type="number"
                min={1000}
                step={1000}
                value={formData.budget}
                onChange={(e) => updateForm({ budget: parseInt(e.target.value) || 0 })}
                className="bg-secondary/50 text-lg"
                placeholder="e.g., 50000"
              />
              <p className="text-sm text-muted-foreground">
                ₹{formData.budget.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="space-y-4">
              <Label className="text-base">Travel style</Label>
              <RadioGroup
                value={formData.budgetStyle}
                onValueChange={(val: 'luxury' | 'mid' | 'budget') => updateForm({ budgetStyle: val })}
                className="grid grid-cols-3 gap-3"
              >
                {[
                  { value: 'luxury', label: 'Luxury', desc: 'Premium experiences' },
                  { value: 'mid', label: 'Comfort', desc: 'Best value' },
                  { value: 'budget', label: 'Budget', desc: 'Cost-conscious' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`glass-card-hover p-4 cursor-pointer text-center ${formData.budgetStyle === option.value ? 'border-primary' : ''}`}
                  >
                    <RadioGroupItem value={option.value} className="sr-only" />
                    <div className="font-medium mb-1">{option.label}</div>
                    <div className="text-xs text-muted-foreground">{option.desc}</div>
                  </label>
                ))}
              </RadioGroup>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base">Food preference</Label>
              <RadioGroup
                value={formData.foodPref}
                onValueChange={(val: 'restaurant' | 'street_food' | 'mix') => updateForm({ foodPref: val })}
                className="grid gap-3"
              >
                {[
                  { value: 'restaurant', label: 'Restaurants', desc: 'Sit-down dining experiences' },
                  { value: 'street_food', label: 'Street Food', desc: 'Local authentic flavors' },
                  { value: 'mix', label: 'Mix of Both', desc: 'Best of both worlds' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`glass-card-hover p-4 cursor-pointer flex items-center gap-4 ${formData.foodPref === option.value ? 'border-primary' : ''}`}
                  >
                    <RadioGroupItem value={option.value} />
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-muted-foreground">{option.desc}</div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-4">
              <Label className="text-base">Dietary preference</Label>
              <RadioGroup
                value={formData.diet}
                onValueChange={(val: 'veg' | 'non_veg' | 'both') => updateForm({ diet: val })}
                className="flex gap-3"
              >
                {[
                  { value: 'veg', label: 'Vegetarian' },
                  { value: 'non_veg', label: 'Non-Veg' },
                  { value: 'both', label: 'Both' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex-1 glass-card-hover p-4 cursor-pointer text-center ${formData.diet === option.value ? 'border-primary' : ''}`}
                  >
                    <RadioGroupItem value={option.value} className="sr-only" />
                    <div className="font-medium">{option.label}</div>
                  </label>
                ))}
              </RadioGroup>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <Label className="text-base">What interests you? (Select multiple)</Label>
            <div className="grid grid-cols-2 gap-3">
              {INTERESTS.map((interest) => (
                <button
                  key={interest.id}
                  type="button"
                  onClick={() => toggleInterest(interest.id)}
                  className={`glass-card-hover p-4 text-left flex items-center gap-3 transition-all ${
                    formData.interests.includes(interest.id) ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <span className="text-xl">{interest.icon}</span>
                  <span className="text-sm font-medium">{interest.label}</span>
                  {formData.interests.includes(interest.id) && (
                    <Check className="w-4 h-4 text-primary ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base">Travel pace</Label>
              <RadioGroup
                value={formData.pace}
                onValueChange={(val: 'relaxed' | 'moderate' | 'packed') => updateForm({ pace: val })}
                className="grid gap-3"
              >
                {[
                  { value: 'relaxed', label: 'Relaxed', desc: 'Plenty of downtime, flexible schedule' },
                  { value: 'moderate', label: 'Moderate', desc: 'Balanced activities with breaks' },
                  { value: 'packed', label: 'Packed', desc: 'See as much as possible' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`glass-card-hover p-4 cursor-pointer flex items-center gap-4 ${formData.pace === option.value ? 'border-primary' : ''}`}
                  >
                    <RadioGroupItem value={option.value} />
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-muted-foreground">{option.desc}</div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-4">
              <Label className="text-base">Stay preference</Label>
              <RadioGroup
                value={formData.stayPreference}
                onValueChange={(val: 'central' | 'quiet') => updateForm({ stayPreference: val })}
                className="flex gap-3"
              >
                <label className={`flex-1 glass-card-hover p-4 cursor-pointer flex items-center gap-3 ${formData.stayPreference === 'central' ? 'border-primary' : ''}`}>
                  <RadioGroupItem value="central" />
                  <div>
                    <div className="font-medium">Central</div>
                    <div className="text-xs text-muted-foreground">Near attractions</div>
                  </div>
                </label>
                <label className={`flex-1 glass-card-hover p-4 cursor-pointer flex items-center gap-3 ${formData.stayPreference === 'quiet' ? 'border-primary' : ''}`}>
                  <RadioGroupItem value="quiet" />
                  <div>
                    <div className="font-medium">Quiet</div>
                    <div className="text-xs text-muted-foreground">Peaceful area</div>
                  </div>
                </label>
              </RadioGroup>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-base">Where are you going?</Label>
              <Input
                value={formData.destination}
                onChange={(e) => updateForm({ destination: e.target.value })}
                placeholder="e.g., Goa, India or Tokyo, Japan"
                className="bg-secondary/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start bg-secondary/50 border-border/50">
                      <Calendar className="w-4 h-4 mr-2" />
                      {formData.startDate ? format(formData.startDate, 'MMM d, yyyy') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formData.startDate}
                      onSelect={(date) => updateForm({ startDate: date })}
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start bg-secondary/50 border-border/50">
                      <Calendar className="w-4 h-4 mr-2" />
                      {formData.endDate ? format(formData.endDate, 'MMM d, yyyy') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formData.endDate}
                      onSelect={(date) => updateForm({ endDate: date })}
                      disabled={(date) => date < (formData.startDate || new Date())}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-display font-semibold">Plan New Trip</h1>
            <p className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {STEPS.length}
            </p>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="border-b border-border/50 bg-card/50">
        <div className="container max-w-2xl mx-auto px-4 py-3">
          <div className="flex gap-2">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.id}
                  className={`flex-1 flex items-center gap-2 p-2 rounded-lg transition-colors ${
                    index === currentStep
                      ? 'bg-primary/10 text-primary'
                      : index < currentStep
                      ? 'text-accent'
                      : 'text-muted-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-medium hidden sm:inline">{step.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <main className="container max-w-2xl mx-auto px-4 py-8">
        <div className="glass-card p-6 mb-6 animate-fade-in">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex gap-4">
          {currentStep > 0 && (
            <Button
              variant="outline"
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="flex-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          
          {currentStep < STEPS.length - 1 ? (
            <Button
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={!canProceed()}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!canProceed() || loading}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Generate Itinerary
                  <Plane className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          )}
        </div>
      </main>

      {/* Terms Acceptance Modal */}
      <TermsAcceptanceModal
        open={showTermsModal}
        onAccept={handleTermsAccepted}
        onCancel={() => setShowTermsModal(false)}
      />
    </div>
  );
}
