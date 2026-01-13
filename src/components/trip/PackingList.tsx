import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Briefcase, Loader2, Sparkles, ChevronDown, ChevronUp,
  Shirt, Umbrella, Camera, Pill, MapPin, Utensils
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface PackingItem {
  id: string;
  name: string;
  category: string;
  essential: boolean;
  packed: boolean;
}

interface PackingCategory {
  name: string;
  icon: React.ElementType;
  items: PackingItem[];
}

interface PackingListProps {
  destination: string;
  startDate: string;
  endDate: string;
  isFamily: boolean;
  activities?: string[];
  tripId: string;
}

// Generate packing list based on trip details
function generatePackingList(
  destination: string,
  startDate: string,
  endDate: string,
  isFamily: boolean,
  activities: string[] = []
): PackingCategory[] {
  const destLower = destination.toLowerCase();
  const startMonth = new Date(startDate).getMonth();
  
  // Determine climate
  const isBeach = destLower.includes('goa') || destLower.includes('kerala') || destLower.includes('andaman');
  const isMountain = destLower.includes('shimla') || destLower.includes('manali') || destLower.includes('ladakh') || destLower.includes('darjeeling');
  const isDesert = destLower.includes('rajasthan') || destLower.includes('jaipur') || destLower.includes('jaisalmer');
  const isMonsoon = startMonth >= 5 && startMonth <= 8;
  const isWinter = startMonth >= 10 || startMonth <= 1;
  
  const categories: PackingCategory[] = [];
  
  // Clothing
  const clothingItems: PackingItem[] = [
    { id: 'c1', name: 'T-shirts (5-7)', category: 'Clothing', essential: true, packed: false },
    { id: 'c2', name: 'Comfortable pants/shorts (3-4)', category: 'Clothing', essential: true, packed: false },
    { id: 'c3', name: 'Underwear & socks', category: 'Clothing', essential: true, packed: false },
    { id: 'c4', name: 'Sleepwear', category: 'Clothing', essential: false, packed: false },
    { id: 'c5', name: 'Comfortable walking shoes', category: 'Clothing', essential: true, packed: false },
  ];
  
  if (isBeach) {
    clothingItems.push(
      { id: 'c6', name: 'Swimsuit', category: 'Clothing', essential: true, packed: false },
      { id: 'c7', name: 'Beach sandals/flip-flops', category: 'Clothing', essential: true, packed: false },
      { id: 'c8', name: 'Beach cover-up', category: 'Clothing', essential: false, packed: false }
    );
  }
  
  if (isMountain || isWinter) {
    clothingItems.push(
      { id: 'c9', name: 'Warm jacket/fleece', category: 'Clothing', essential: true, packed: false },
      { id: 'c10', name: 'Thermal innerwear', category: 'Clothing', essential: isMountain, packed: false },
      { id: 'c11', name: 'Woolen cap & gloves', category: 'Clothing', essential: isMountain, packed: false },
      { id: 'c12', name: 'Warm socks', category: 'Clothing', essential: true, packed: false }
    );
  }
  
  if (isMonsoon) {
    clothingItems.push(
      { id: 'c13', name: 'Rain jacket/poncho', category: 'Clothing', essential: true, packed: false },
      { id: 'c14', name: 'Waterproof shoes/sandals', category: 'Clothing', essential: true, packed: false }
    );
  }
  
  categories.push({ name: 'Clothing', icon: Shirt, items: clothingItems });
  
  // Weather gear
  const weatherItems: PackingItem[] = [
    { id: 'w1', name: 'Sunglasses', category: 'Weather Gear', essential: true, packed: false },
    { id: 'w2', name: 'Sunscreen SPF 50+', category: 'Weather Gear', essential: true, packed: false },
    { id: 'w3', name: 'Hat/cap', category: 'Weather Gear', essential: !isMountain, packed: false },
  ];
  
  if (isMonsoon) {
    weatherItems.push(
      { id: 'w4', name: 'Umbrella', category: 'Weather Gear', essential: true, packed: false }
    );
  }
  
  categories.push({ name: 'Weather Gear', icon: Umbrella, items: weatherItems });
  
  // Electronics
  const electronicsItems: PackingItem[] = [
    { id: 'e1', name: 'Phone charger', category: 'Electronics', essential: true, packed: false },
    { id: 'e2', name: 'Power bank', category: 'Electronics', essential: true, packed: false },
    { id: 'e3', name: 'Camera', category: 'Electronics', essential: false, packed: false },
    { id: 'e4', name: 'Headphones', category: 'Electronics', essential: false, packed: false },
  ];
  
  categories.push({ name: 'Electronics', icon: Camera, items: electronicsItems });
  
  // Health & Safety
  const healthItems: PackingItem[] = [
    { id: 'h1', name: 'Personal medications', category: 'Health', essential: true, packed: false },
    { id: 'h2', name: 'First aid kit', category: 'Health', essential: true, packed: false },
    { id: 'h3', name: 'Hand sanitizer', category: 'Health', essential: true, packed: false },
    { id: 'h4', name: 'Insect repellent', category: 'Health', essential: isBeach || isMountain, packed: false },
    { id: 'h5', name: 'Motion sickness pills', category: 'Health', essential: isMountain, packed: false },
  ];
  
  if (isMountain) {
    healthItems.push(
      { id: 'h6', name: 'Altitude sickness medication', category: 'Health', essential: true, packed: false }
    );
  }
  
  categories.push({ name: 'Health & Safety', icon: Pill, items: healthItems });
  
  // Travel Documents
  const docsItems: PackingItem[] = [
    { id: 'd1', name: 'ID proof (Aadhaar/Passport)', category: 'Documents', essential: true, packed: false },
    { id: 'd2', name: 'Travel tickets/confirmations', category: 'Documents', essential: true, packed: false },
    { id: 'd3', name: 'Hotel booking confirmations', category: 'Documents', essential: true, packed: false },
    { id: 'd4', name: 'Copies of important documents', category: 'Documents', essential: true, packed: false },
    { id: 'd5', name: 'Credit/debit cards', category: 'Documents', essential: true, packed: false },
    { id: 'd6', name: 'Cash (local currency)', category: 'Documents', essential: true, packed: false },
  ];
  
  categories.push({ name: 'Documents', icon: MapPin, items: docsItems });
  
  // Snacks & Comfort (especially for family)
  if (isFamily) {
    const familyItems: PackingItem[] = [
      { id: 'f1', name: 'Snacks for kids', category: 'Family', essential: true, packed: false },
      { id: 'f2', name: 'Entertainment (tablets, games)', category: 'Family', essential: true, packed: false },
      { id: 'f3', name: 'Baby supplies (if applicable)', category: 'Family', essential: false, packed: false },
      { id: 'f4', name: 'Extra clothes for kids', category: 'Family', essential: true, packed: false },
    ];
    categories.push({ name: 'Family Essentials', icon: Utensils, items: familyItems });
  }
  
  return categories;
}

export function PackingList({ destination, startDate, endDate, isFamily, activities, tripId }: PackingListProps) {
  const [categories, setCategories] = useState<PackingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);
  
  useEffect(() => {
    // Generate packing list
    setLoading(true);
    const timer = setTimeout(() => {
      const list = generatePackingList(destination, startDate, endDate, isFamily, activities);
      setCategories(list);
      // Expand first category by default
      if (list.length > 0) {
        setExpandedCategories({ [list[0].name]: true });
      }
      setLoading(false);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [destination, startDate, endDate, isFamily, activities]);
  
  const togglePacked = (categoryName: string, itemId: string) => {
    setCategories(prev =>
      prev.map(cat => {
        if (cat.name === categoryName) {
          return {
            ...cat,
            items: cat.items.map(item =>
              item.id === itemId ? { ...item, packed: !item.packed } : item
            ),
          };
        }
        return cat;
      })
    );
  };
  
  const toggleCategory = (name: string) => {
    setExpandedCategories(prev => ({ ...prev, [name]: !prev[name] }));
  };
  
  const totalItems = categories.reduce((acc, cat) => acc + cat.items.length, 0);
  const packedItems = categories.reduce(
    (acc, cat) => acc + cat.items.filter(i => i.packed).length,
    0
  );
  const progress = totalItems > 0 ? Math.round((packedItems / totalItems) * 100) : 0;
  
  if (loading) {
    return (
      <div className="glass-card p-5">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }
  
  const displayCategories = showAll ? categories : categories.slice(0, 3);
  
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-primary" />
          AI Packing List
        </h3>
        <div className="flex items-center gap-2">
          <Sparkles className="w-3 h-3 text-primary" />
          <span className="text-xs text-muted-foreground">
            {packedItems}/{totalItems} packed
          </span>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="h-2 bg-secondary rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Categories */}
      <div className="space-y-3">
        {displayCategories.map((category) => {
          const Icon = category.icon;
          const isExpanded = expandedCategories[category.name];
          const categoryPacked = category.items.filter(i => i.packed).length;
          
          return (
            <Collapsible
              key={category.name}
              open={isExpanded}
              onOpenChange={() => toggleCategory(category.name)}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">{category.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({categoryPacked}/{category.items.length})
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </CollapsibleTrigger>
              
              <CollapsibleContent className="pt-2 pl-4 space-y-2">
                {category.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 py-1"
                  >
                    <Checkbox
                      id={item.id}
                      checked={item.packed}
                      onCheckedChange={() => togglePacked(category.name, item.id)}
                    />
                    <label
                      htmlFor={item.id}
                      className={cn(
                        'text-sm cursor-pointer flex-1',
                        item.packed && 'line-through text-muted-foreground'
                      )}
                    >
                      {item.name}
                      {item.essential && (
                        <span className="ml-2 text-xs text-primary">Essential</span>
                      )}
                    </label>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
      
      {categories.length > 3 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAll(!showAll)}
          className="w-full mt-4"
        >
          {showAll ? 'Show Less' : `Show All ${categories.length} Categories`}
        </Button>
      )}
    </div>
  );
}
