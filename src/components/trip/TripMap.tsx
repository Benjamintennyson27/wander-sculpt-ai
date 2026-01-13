import { useState, useEffect, forwardRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ItineraryDay, ItineraryItem } from '@/lib/itinerary-adapter';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, ExternalLink, Loader2 } from 'lucide-react';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

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

// Create custom marker icon
const createMarkerIcon = (color: string, label: string, isSelected: boolean) => {
  const size = isSelected ? 36 : 28;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${color}" stroke="white" stroke-width="2"/>
      <text x="${size/2}" y="${size/2 + 4}" text-anchor="middle" fill="white" font-size="${isSelected ? 14 : 11}" font-weight="bold" font-family="Arial">${label}</text>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: 'custom-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

interface GeocodedLocation {
  lat: number;
  lng: number;
}

interface Activity {
  item: ItineraryItem & { maps_query?: string };
  index: number;
  block: string;
}

// Component to fit bounds when locations change
function FitBounds({ locations }: { locations: Map<number, GeocodedLocation> }) {
  const map = useMap();

  useEffect(() => {
    if (locations.size === 0) return;

    const bounds = L.latLngBounds(
      Array.from(locations.values()).map(loc => [loc.lat, loc.lng] as [number, number])
    );
    
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [map, locations]);

  return null;
}

function LeafletMapContent({
  day,
  selectedActivityIndex,
  onPinClick,
  destination,
}: {
  day: ItineraryDay;
  selectedActivityIndex: number | null;
  onPinClick: (activityIndex: number) => void;
  destination?: string;
}) {
  const [geocodedLocations, setGeocodedLocations] = useState<Map<number, GeocodedLocation>>(new Map());
  const [loading, setLoading] = useState(true);

  // Flatten activities with their indices
  const activities = useMemo(() => {
    const result: Activity[] = [];
    const timeBlocks = ['morning', 'afternoon', 'evening', 'night'];
    let globalIndex = 0;
    
    timeBlocks.forEach(block => {
      day.items
        .filter(item => item.time_block === block)
        .forEach(item => {
          result.push({ item, index: globalIndex, block });
          globalIndex++;
        });
    });
    
    return result;
  }, [day]);

  // Geocode locations using Nominatim (free, no API key)
  useEffect(() => {
    if (activities.length === 0) {
      setLoading(false);
      return;
    }

    const geocodeLocations = async () => {
      const newLocations = new Map<number, GeocodedLocation>();

      for (const activity of activities) {
        // Check if we have verified lat/lng from database
        const verifiedFacts = activity.item.verified_facts;
        if (verifiedFacts?.lat && verifiedFacts?.lng) {
          newLocations.set(activity.index, { lat: verifiedFacts.lat, lng: verifiedFacts.lng });
          continue;
        }

        // Try to geocode using Nominatim
        const query = activity.item.maps_query || 
          `${activity.item.title}, ${activity.item.location_area || ''}, ${destination || ''}`;
        
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
            { headers: { 'User-Agent': 'TripPlanner/1.0' } }
          );
          const data = await response.json();
          
          if (data && data.length > 0) {
            newLocations.set(activity.index, {
              lat: parseFloat(data[0].lat),
              lng: parseFloat(data[0].lon),
            });
          }
        } catch (e) {
          console.error('Geocoding error:', e);
        }

        // Small delay to respect Nominatim rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      setGeocodedLocations(newLocations);
      setLoading(false);
    };

    geocodeLocations();
  }, [activities, destination]);

  // Calculate center from locations or use default
  const center = useMemo(() => {
    if (geocodedLocations.size > 0) {
      const locs = Array.from(geocodedLocations.values());
      const avgLat = locs.reduce((sum, loc) => sum + loc.lat, 0) / locs.length;
      const avgLng = locs.reduce((sum, loc) => sum + loc.lng, 0) / locs.length;
      return [avgLat, avgLng] as [number, number];
    }
    return [20.5937, 78.9629] as [number, number]; // Default to India center
  }, [geocodedLocations]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-card">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading locations...</p>
        </div>
      </div>
    );
  }

  if (geocodedLocations.size === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-card">
        <div className="text-center p-8">
          <MapPin className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No locations found</p>
        </div>
      </div>
    );
  }

  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ width: '100%', height: '100%', minHeight: '300px' }}
      zoomControl={true}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      
      <FitBounds locations={geocodedLocations} />

      {activities.map((activity, idx) => {
        const location = geocodedLocations.get(activity.index);
        if (!location) return null;

        const color = timeBlockPinColors[activity.block as keyof typeof timeBlockPinColors] || timeBlockPinColors.morning;
        const isSelected = selectedActivityIndex === activity.index;

        return (
          <Marker
            key={activity.index}
            position={[location.lat, location.lng]}
            icon={createMarkerIcon(color, String(idx + 1), isSelected)}
            eventHandlers={{
              click: () => onPinClick(activity.index),
            }}
          >
            <Popup>
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
                    Open in Google Maps <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

export const TripMap = forwardRef<HTMLDivElement, TripMapProps>(
  function TripMap({ day, selectedActivityIndex, onPinClick, className, destination }, ref) {
    // No day selected
    if (!day || day.items.length === 0) {
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

    return (
      <div 
        ref={ref}
        className={cn(
          'relative rounded-xl overflow-hidden',
          'bg-card border border-border',
          'min-h-[300px]',
          className
        )}
        style={{ isolation: 'isolate' }}
      >
        <div className="absolute inset-0">
          <LeafletMapContent
            day={day}
            selectedActivityIndex={selectedActivityIndex}
            onPinClick={onPinClick}
            destination={destination}
          />
        </div>

        {/* Day label */}
        <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card/95 backdrop-blur-md border border-border shadow-lg z-[1000]">
          <Navigation className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium">Day {day.day}</span>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap justify-center gap-1.5 z-[1000]">
          {Object.entries(timeBlockPinColors).map(([block, color]) => (
            <div 
              key={block}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-card/95 backdrop-blur-md border border-border shadow-sm"
            >
              <div 
                className="w-2.5 h-2.5 rounded-full shadow-sm"
                style={{ backgroundColor: color }}
              />
              <span className="text-[10px] font-medium text-foreground/80 capitalize">{block}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
);
