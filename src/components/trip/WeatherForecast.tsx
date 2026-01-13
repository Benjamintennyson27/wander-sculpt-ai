import { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, Snowflake, Wind, Loader2, ThermometerSun, Droplets, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface WeatherDay {
  date: string;
  temp_high: number;
  temp_low: number;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'windy' | 'partly-cloudy';
  humidity: number;
  description: string;
  icon?: string;
}

interface WeatherForecastProps {
  destination: string;
  startDate: string;
  endDate: string;
  className?: string;
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
  const [error, setError] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  
  useEffect(() => {
    async function fetchWeather() {
      setLoading(true);
      setError(null);
      
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const tripDays = differenceInDays(end, start) + 1;
        const daysToFetch = Math.min(tripDays, 5); // OpenWeather free tier is 5-day forecast
        
        const { data, error: fnError } = await supabase.functions.invoke('get-weather', {
          body: { 
            destination,
            days: daysToFetch 
          }
        });
        
        if (fnError) {
          console.error('Weather fetch error:', fnError);
          setError('Unable to fetch weather data');
          return;
        }
        
        if (data?.error) {
          console.error('Weather API error:', data.error);
          setError(data.error);
          return;
        }
        
        if (data?.weather && data.weather.length > 0) {
          setWeather(data.weather);
          setLocationName(data.location?.name || destination);
        } else {
          setError('No weather data available');
        }
      } catch (err) {
        console.error('Error fetching weather:', err);
        setError('Failed to load weather');
      } finally {
        setLoading(false);
      }
    }
    
    fetchWeather();
  }, [destination, startDate, endDate]);
  
  if (loading) {
    return (
      <div className={cn('glass-card p-5', className)}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Loading weather...</span>
        </div>
      </div>
    );
  }
  
  if (error || weather.length === 0) {
    return (
      <div className={cn('glass-card p-5', className)}>
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <ThermometerSun className="w-4 h-4 text-primary" />
          Weather Forecast
        </h3>
        <div className="flex items-center gap-2 text-muted-foreground py-4">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error || 'Weather data unavailable'}</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn('glass-card p-5', className)}>
      <h3 className="font-medium mb-1 flex items-center gap-2">
        <ThermometerSun className="w-4 h-4 text-primary" />
        Weather Forecast
      </h3>
      {locationName && (
        <p className="text-xs text-muted-foreground mb-4">{locationName}</p>
      )}
      
      <div className="grid grid-cols-5 gap-2">
        {weather.map((day, idx) => {
          const Icon = getWeatherIcon(day.condition);
          const colorClass = getConditionColor(day.condition);
          const dayDate = new Date(day.date);
          
          return (
            <div
              key={day.date}
              className={cn(
                'text-center p-2 rounded-lg transition-colors',
                idx === 0 ? 'bg-primary/10' : 'bg-secondary/50'
              )}
            >
              <div className="text-xs text-muted-foreground mb-1">
                {format(dayDate, 'EEE')}
              </div>
              <div className="text-[10px] text-muted-foreground/70 mb-1">
                {format(dayDate, 'd MMM')}
              </div>
              <Icon className={cn('w-5 h-5 mx-auto mb-1', colorClass)} />
              <div className="text-sm font-medium">{day.temp_high}°</div>
              <div className="text-xs text-muted-foreground">{day.temp_low}°</div>
              <div className="text-[10px] text-muted-foreground/70 mt-1 truncate" title={day.description}>
                {day.description}
              </div>
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
            Powered by OpenWeather
          </span>
        </div>
      </div>
    </div>
  );
}
