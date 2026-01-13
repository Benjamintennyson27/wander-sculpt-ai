import { useState, useEffect, forwardRef, useRef, useMemo, useCallback } from 'react';
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

function LeafletMap({
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
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
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

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      center: [20.5937, 78.9629], // Default to India
      zoom: 5,
      zoomControl: true,
    });

    // Dark theme tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Geocode locations
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

  // Update markers when locations change
  useEffect(() => {
    if (!mapRef.current || geocodedLocations.size === 0) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add new markers
    const bounds = L.latLngBounds([]);

    activities.forEach((activity, idx) => {
      const location = geocodedLocations.get(activity.index);
      if (!location) return;

      const color = timeBlockPinColors[activity.block as keyof typeof timeBlockPinColors] || timeBlockPinColors.morning;
      const isSelected = selectedActivityIndex === activity.index;

      const marker = L.marker([location.lat, location.lng], {
        icon: createMarkerIcon(color, String(idx + 1), isSelected),
      }).addTo(mapRef.current!);

      // Add popup
      const popupContent = `
        <div class="p-2 max-w-[200px]">
          <p class="font-medium text-sm text-gray-900">${activity.item.title}</p>
          ${activity.item.location_area ? `<p class="text-xs text-gray-600 mt-0.5">${activity.item.location_area}</p>` : ''}
          ${activity.item.maps_query ? `
            <a
              href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.item.maps_query)}"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-blue-600 hover:underline mt-1 inline-flex items-center gap-1"
            >
              Open in Google Maps
            </a>
          ` : ''}
        </div>
      `;
      marker.bindPopup(popupContent);

      marker.on('click', () => {
        onPinClick(activity.index);
      });

      markersRef.current.push(marker);
      bounds.extend([location.lat, location.lng]);
    });

    // Fit bounds if we have locations
    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [geocodedLocations, activities, selectedActivityIndex, onPinClick]);

  // Update selected marker styling
  useEffect(() => {
    if (!mapRef.current) return;

    activities.forEach((activity, idx) => {
      const location = geocodedLocations.get(activity.index);
      if (!location) return;

      const marker = markersRef.current[idx];
      if (marker) {
        const color = timeBlockPinColors[activity.block as keyof typeof timeBlockPinColors] || timeBlockPinColors.morning;
        const isSelected = selectedActivityIndex === activity.index;
        marker.setIcon(createMarkerIcon(color, String(idx + 1), isSelected));
      }
    });
  }, [selectedActivityIndex, activities, geocodedLocations]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-card min-h-[300px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading locations...</p>
        </div>
      </div>
    );
  }

  if (geocodedLocations.size === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-card min-h-[300px]">
        <div className="text-center p-8">
          <MapPin className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No locations found</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={mapContainerRef} 
      className="w-full h-full min-h-[300px]"
      style={{ background: '#1a1a2e' }}
    />
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
          <LeafletMap
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
