import { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, Snowflake, Wind, Loader2, ThermometerSun, Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays, differenceInDays } from 'date-fns';

interface WeatherDay {
  date: string;
  temp_high: number;
  temp_low: number;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'windy' | 'partly-cloudy';
  humidity: number;
  description: string;
}

interface WeatherForecastProps {
  destination: string;
  startDate: string;
  endDate: string;
  className?: string;
}

// Mock weather data generator based on destination
function generateMockWeather(destination: string, startDate: string, endDate: string): WeatherDay[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = differenceInDays(end, start) + 1;
  const limitedDays = Math.min(days, 7); // Show max 7 days
  
  // Determine climate based on destination keywords
  const destLower = destination.toLowerCase();
  let baseTemp = 25;
  let tempVariance = 5;
  let rainChance = 0.2;
  
  if (destLower.includes('goa') || destLower.includes('kerala') || destLower.includes('mumbai')) {
    baseTemp = 30;
    rainChance = 0.4;
  } else if (destLower.includes('shimla') || destLower.includes('manali') || destLower.includes('ladakh')) {
    baseTemp = 15;
    rainChance = 0.3;
  } else if (destLower.includes('rajasthan') || destLower.includes('jaipur') || destLower.includes('jodhpur')) {
    baseTemp = 35;
    rainChance = 0.1;
  } else if (destLower.includes('darjeeling') || destLower.includes('sikkim') || destLower.includes('northeast')) {
    baseTemp = 18;
    rainChance = 0.5;
  }
  
  const conditions: WeatherDay['condition'][] = ['sunny', 'cloudy', 'rainy', 'partly-cloudy'];
  
  return Array.from({ length: limitedDays }, (_, i) => {
    const date = addDays(start, i);
    const randomCondition = Math.random() < rainChance ? 'rainy' : 
                           Math.random() < 0.3 ? 'cloudy' : 
                           Math.random() < 0.5 ? 'partly-cloudy' : 'sunny';
    
    const tempOffset = Math.floor(Math.random() * tempVariance * 2) - tempVariance;
    const high = baseTemp + tempOffset + Math.floor(Math.random() * 3);
    const low = high - 8 - Math.floor(Math.random() * 4);
    
    return {
      date: format(date, 'yyyy-MM-dd'),
      temp_high: high,
      temp_low: low,
      condition: randomCondition,
      humidity: 40 + Math.floor(Math.random() * 40),
      description: getDescription(randomCondition, high),
    };
  });
}

function getDescription(condition: WeatherDay['condition'], temp: number): string {
  switch (condition) {
    case 'sunny': return temp > 30 ? 'Hot and sunny' : 'Clear skies';
    case 'cloudy': return 'Overcast';
    case 'rainy': return 'Rain expected';
    case 'partly-cloudy': return 'Partly cloudy';
    case 'snowy': return 'Snow likely';
    case 'windy': return 'Windy conditions';
    default: return 'Mixed conditions';
  }
}

function getWeatherIcon(condition: WeatherDay['condition']) {
  switch (condition) {
    case 'sunny': return Sun;
    case 'cloudy': return Cloud;
    case 'rainy': return CloudRain;
    case 'snowy': return Snowflake;
    case 'windy': return Wind;
    case 'partly-cloudy': return Cloud;
    default: return Cloud;
  }
}

function getConditionColor(condition: WeatherDay['condition']) {
  switch (condition) {
    case 'sunny': return 'text-yellow-500';
    case 'cloudy': return 'text-gray-400';
    case 'rainy': return 'text-blue-400';
    case 'snowy': return 'text-blue-200';
    case 'windy': return 'text-teal-400';
    case 'partly-cloudy': return 'text-gray-300';
    default: return 'text-muted-foreground';
  }
}

export function WeatherForecast({ destination, startDate, endDate, className }: WeatherForecastProps) {
  const [weather, setWeather] = useState<WeatherDay[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Simulate API call with mock data
    setLoading(true);
    const timer = setTimeout(() => {
      const mockData = generateMockWeather(destination, startDate, endDate);
      setWeather(mockData);
      setLoading(false);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [destination, startDate, endDate]);
  
  if (loading) {
    return (
      <div className={cn('glass-card p-5', className)}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn('glass-card p-5', className)}>
      <h3 className="font-medium mb-4 flex items-center gap-2">
        <ThermometerSun className="w-4 h-4 text-primary" />
        Weather Forecast
      </h3>
      
      <div className="grid grid-cols-7 gap-2">
        {weather.map((day, idx) => {
          const Icon = getWeatherIcon(day.condition);
          const colorClass = getConditionColor(day.condition);
          
          return (
            <div
              key={day.date}
              className={cn(
                'text-center p-2 rounded-lg transition-colors',
                idx === 0 ? 'bg-primary/10' : 'bg-secondary/50'
              )}
            >
              <div className="text-xs text-muted-foreground mb-1">
                {idx === 0 ? 'Day 1' : `Day ${idx + 1}`}
              </div>
              <Icon className={cn('w-5 h-5 mx-auto mb-1', colorClass)} />
              <div className="text-sm font-medium">{day.temp_high}°</div>
              <div className="text-xs text-muted-foreground">{day.temp_low}°</div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-4 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Droplets className="w-4 h-4" />
            <span>Avg. Humidity: {Math.round(weather.reduce((acc, d) => acc + d.humidity, 0) / weather.length)}%</span>
          </div>
          <span className="text-xs text-muted-foreground italic">
            *Forecast may vary
          </span>
        </div>
      </div>
    </div>
  );
}
