import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeatherDay {
  date: string;
  temp_high: number;
  temp_low: number;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'windy' | 'partly-cloudy';
  humidity: number;
  description: string;
  icon: string;
}

function mapWeatherCondition(weatherId: number): WeatherDay['condition'] {
  // OpenWeatherMap weather condition codes
  // https://openweathermap.org/weather-conditions
  if (weatherId >= 200 && weatherId < 300) return 'rainy'; // Thunderstorm
  if (weatherId >= 300 && weatherId < 400) return 'rainy'; // Drizzle
  if (weatherId >= 500 && weatherId < 600) return 'rainy'; // Rain
  if (weatherId >= 600 && weatherId < 700) return 'snowy'; // Snow
  if (weatherId >= 700 && weatherId < 800) return 'windy'; // Atmosphere (fog, mist, etc.)
  if (weatherId === 800) return 'sunny'; // Clear
  if (weatherId === 801) return 'partly-cloudy'; // Few clouds
  if (weatherId >= 802 && weatherId < 900) return 'cloudy'; // Clouds
  return 'cloudy';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { destination, lat, lng, days = 7 } = await req.json();
    
    const apiKey = Deno.env.get('OPENWEATHER_API_KEY');
    if (!apiKey) {
      console.error('OPENWEATHER_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Weather API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let latitude = lat;
    let longitude = lng;

    // If no coordinates provided, geocode the destination
    if (!latitude || !longitude) {
      console.log(`Geocoding destination: ${destination}`);
      const geoUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(destination)}&limit=1&appid=${apiKey}`;
      const geoResponse = await fetch(geoUrl);
      const geoData = await geoResponse.json();
      
      // Check if geocoding returned valid results
      if (!geoData || !Array.isArray(geoData) || geoData.length === 0) {
        console.error('Could not geocode destination:', destination);
        // Return 200 with error in body so frontend handles it gracefully
        return new Response(
          JSON.stringify({ 
            error: 'Could not find location', 
            weather: [],
            location: { name: destination }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const firstResult = geoData[0];
      if (!firstResult || typeof firstResult.lat !== 'number' || typeof firstResult.lon !== 'number') {
        console.error('Invalid geocoding result for:', destination);
        return new Response(
          JSON.stringify({ 
            error: 'Invalid location data', 
            weather: [],
            location: { name: destination }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      latitude = firstResult.lat;
      longitude = firstResult.lon;
      console.log(`Geocoded ${destination} to: ${latitude}, ${longitude}`);
    }

    // Get 5-day forecast (3-hour intervals, up to 40 data points)
    // OpenWeatherMap free tier only provides 5-day forecast
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&units=metric&appid=${apiKey}`;
    console.log('Fetching forecast...');
    
    const forecastResponse = await fetch(forecastUrl);
    const forecastData = await forecastResponse.json();
    
    if (forecastData.cod !== '200') {
      console.error('Weather API error:', forecastData);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch weather data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group forecasts by day and calculate daily highs/lows
    const dailyForecasts: Record<string, {
      temps: number[];
      humidity: number[];
      weather: { id: number; description: string; icon: string }[];
    }> = {};

    for (const item of forecastData.list) {
      const date = item.dt_txt.split(' ')[0]; // Get YYYY-MM-DD
      
      if (!dailyForecasts[date]) {
        dailyForecasts[date] = { temps: [], humidity: [], weather: [] };
      }
      
      dailyForecasts[date].temps.push(item.main.temp);
      dailyForecasts[date].humidity.push(item.main.humidity);
      dailyForecasts[date].weather.push({
        id: item.weather[0].id,
        description: item.weather[0].description,
        icon: item.weather[0].icon,
      });
    }

    // Convert to WeatherDay array
    const weatherDays: WeatherDay[] = Object.entries(dailyForecasts)
      .slice(0, Math.min(days, 7))
      .map(([date, data]) => {
        const avgWeatherId = data.weather[Math.floor(data.weather.length / 2)].id;
        const avgDescription = data.weather[Math.floor(data.weather.length / 2)].description;
        const avgIcon = data.weather[Math.floor(data.weather.length / 2)].icon;
        
        return {
          date,
          temp_high: Math.round(Math.max(...data.temps)),
          temp_low: Math.round(Math.min(...data.temps)),
          condition: mapWeatherCondition(avgWeatherId),
          humidity: Math.round(data.humidity.reduce((a, b) => a + b, 0) / data.humidity.length),
          description: avgDescription.charAt(0).toUpperCase() + avgDescription.slice(1),
          icon: avgIcon,
        };
      });

    console.log(`Returning ${weatherDays.length} days of weather data`);

    return new Response(
      JSON.stringify({ 
        weather: weatherDays,
        location: {
          lat: latitude,
          lng: longitude,
          name: forecastData.city?.name || destination,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-weather function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
