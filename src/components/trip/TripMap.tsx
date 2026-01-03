import { useState, useEffect, forwardRef, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { supabase } from '@/integrations/supabase/client';
import { ItineraryDay, ItineraryItem } from '@/lib/itinerary-adapter';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, ExternalLink, Loader2 } from 'lucide-react';

interface TripMapProps {
  day: ItineraryDay | null;
  selectedActivityIndex: number | null;
  onPinClick: (activityIndex: number) => void;
  className?: string;
  destination?: string;
}

// Premium time block pin colors
const timeBlockPinColors = {
  morning: '#d97706',    // amber-600
  afternoon: '#ea580c',  // orange-600
  evening: '#0891b2',    // primary teal
  night: '#2563eb',      // blue-600 (accent)
};

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8b8b9a' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#3a3a4e' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#242438' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6b6b7a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a3e' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a9a' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3a4e' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#242438' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a5568' }] },
];

export const TripMap = forwardRef<HTMLDivElement, TripMapProps>(
  function TripMap({ day, selectedActivityIndex, onPinClick, className, destination }, ref) {
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [loadingKey, setLoadingKey] = useState(true);
    const [selectedMarker, setSelectedMarker] = useState<number | null>(null);
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [geocodedLocations, setGeocodedLocations] = useState<Map<number, { lat: number; lng: number }>>(new Map());

    // Fetch Google Maps API key
    useEffect(() => {
      const fetchApiKey = async () => {
        try {
          const { data, error } = await supabase.functions.invoke('get-maps-key');
          if (!error && data?.apiKey) {
            setApiKey(data.apiKey);
          }
        } catch (e) {
          console.error('Failed to fetch maps key:', e);
        } finally {
          setLoadingKey(false);
        }
      };
      fetchApiKey();
    }, []);

    const { isLoaded, loadError } = useJsApiLoader({
      googleMapsApiKey: apiKey || '',
      id: 'google-map-script',
    });

    // Flatten activities with their indices
    const activities: { item: ItineraryItem & { maps_query?: string }; index: number; block: string }[] = [];
    if (day) {
      const timeBlocks = ['morning', 'afternoon', 'evening', 'night'];
      let globalIndex = 0;
      
      timeBlocks.forEach(block => {
        day.items
          .filter(item => item.time_block === block)
          .forEach(item => {
            activities.push({ item, index: globalIndex, block });
            globalIndex++;
          });
      });
    }

    // Geocode locations when activities or map changes
    useEffect(() => {
      if (!isLoaded || !map || activities.length === 0) return;

      const geocoder = new google.maps.Geocoder();
      const newLocations = new Map<number, { lat: number; lng: number }>();

      activities.forEach((activity, idx) => {
        // Check if we have verified lat/lng
        const verifiedFacts = activity.item.verified_facts;
        if (verifiedFacts?.lat && verifiedFacts?.lng) {
          newLocations.set(activity.index, { lat: verifiedFacts.lat, lng: verifiedFacts.lng });
          if (idx === activities.length - 1) {
            setGeocodedLocations(new Map(newLocations));
          }
          return;
        }

        // Otherwise geocode
        const query = activity.item.maps_query || 
          `${activity.item.title}, ${activity.item.location_area || ''}, ${destination || ''}`;
        
        geocoder.geocode({ address: query }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            const location = results[0].geometry.location;
            newLocations.set(activity.index, { lat: location.lat(), lng: location.lng() });
          }
          
          // Update state after all geocoding is done
          if (idx === activities.length - 1) {
            setTimeout(() => setGeocodedLocations(new Map(newLocations)), 100);
          }
        });
      });
    }, [isLoaded, map, day, destination]);

    // Fit bounds when locations change
    useEffect(() => {
      if (!map || geocodedLocations.size === 0) return;

      const bounds = new google.maps.LatLngBounds();
      geocodedLocations.forEach((loc) => {
        bounds.extend(new google.maps.LatLng(loc.lat, loc.lng));
      });
      
      map.fitBounds(bounds, { top: 50, bottom: 80, left: 20, right: 20 });
    }, [map, geocodedLocations]);

    const onLoad = useCallback((map: google.maps.Map) => {
      setMap(map);
    }, []);

    const onUnmount = useCallback(() => {
      setMap(null);
    }, []);

    // Create custom marker icon
    const createMarkerIcon = (color: string, label: string, isSelected: boolean) => {
      const size = isSelected ? 36 : 28;
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${color}" stroke="white" stroke-width="2"/>
          <text x="${size/2}" y="${size/2 + 4}" text-anchor="middle" fill="white" font-size="${isSelected ? 14 : 11}" font-weight="bold" font-family="Arial">${label}</text>
        </svg>
      `;
      return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    };

    // Loading state
    if (loadingKey) {
      return (
        <div 
          ref={ref}
          className={cn(
            'relative rounded-xl overflow-hidden',
            'bg-card/60 backdrop-blur-sm border border-border/50',
            'flex items-center justify-center',
            className
          )}
        >
          <div className="text-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      );
    }

    // No API key or error state
    if (!apiKey || loadError) {
      return (
        <div 
          ref={ref}
          className={cn(
            'relative rounded-xl overflow-hidden',
            'bg-card/60 backdrop-blur-sm border border-border/50',
            'flex items-center justify-center',
            className
          )}
        >
          <div className="text-center p-8">
            <MapPin className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Map not available</p>
          </div>
        </div>
      );
    }

    if (!day || activities.length === 0) {
      return (
        <div 
          ref={ref}
          className={cn(
            'relative rounded-xl overflow-hidden',
            'bg-card/60 backdrop-blur-sm border border-border/50',
            'flex items-center justify-center',
            className
          )}
        >
          <div className="text-center p-8">
            <div className="w-14 h-14 rounded-xl bg-secondary/50 flex items-center justify-center mx-auto mb-3">
              <MapPin className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Select a day to view locations</p>
          </div>
        </div>
      );
    }

    const selectedActivity = activities.find(a => a.index === selectedActivityIndex);

    return (
      <div 
        ref={ref}
        className={cn(
          'relative rounded-xl overflow-hidden',
          'bg-card/70 backdrop-blur-sm border border-border/50',
          className
        )}
      >
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={{ lat: 20.5937, lng: 78.9629 }} // Default to India center
            zoom={5}
            onLoad={onLoad}
            onUnmount={onUnmount}
            options={{
              styles: darkMapStyle,
              disableDefaultUI: true,
              zoomControl: true,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
            }}
          >
            {activities.map((activity, idx) => {
              const location = geocodedLocations.get(activity.index);
              if (!location) return null;

              const color = timeBlockPinColors[activity.block as keyof typeof timeBlockPinColors] || timeBlockPinColors.morning;
              const isSelected = selectedActivityIndex === activity.index;

              return (
                <Marker
                  key={activity.index}
                  position={location}
                  icon={{
                    url: createMarkerIcon(color, String(idx + 1), isSelected),
                    scaledSize: new google.maps.Size(isSelected ? 36 : 28, isSelected ? 36 : 28),
                    anchor: new google.maps.Point(isSelected ? 18 : 14, isSelected ? 18 : 14),
                  }}
                  zIndex={isSelected ? 100 : 1}
                  onClick={() => {
                    onPinClick(activity.index);
                    setSelectedMarker(activity.index);
                  }}
                />
              );
            })}

            {selectedMarker !== null && (() => {
              const activity = activities.find(a => a.index === selectedMarker);
              const location = geocodedLocations.get(selectedMarker);
              if (!activity || !location) return null;

              return (
                <InfoWindow
                  position={location}
                  onCloseClick={() => setSelectedMarker(null)}
                >
                  <div className="p-1 max-w-[200px]">
                    <p className="font-medium text-sm text-gray-900">{activity.item.title}</p>
                    {activity.item.location_area && (
                      <p className="text-xs text-gray-600 mt-0.5">{activity.item.location_area}</p>
                    )}
                    {activity.item.maps_query && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.item.maps_query)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline mt-1 inline-flex items-center gap-1"
                      >
                        Open in Maps <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </InfoWindow>
              );
            })()}
          </GoogleMap>
        ) : (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Day label */}
        <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-md bg-card/90 backdrop-blur-sm border border-border/50">
          <Navigation className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium">Day {day.day}</span>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap justify-center gap-2">
          {Object.entries(timeBlockPinColors).map(([block, color]) => (
            <div 
              key={block}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-card/80 backdrop-blur-sm"
            >
              <div 
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-[10px] text-muted-foreground capitalize">{block}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
);
