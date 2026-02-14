import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Camera, ExternalLink, Loader2, ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Photo {
  id: string;
  url: string;
  thumb: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
  width: number;
  height: number;
}

interface DestinationGalleryProps {
  destination: string;
  className?: string;
}

export function DestinationGallery({ destination, className }: DestinationGalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    const fetchPhotos = async () => {
      setLoading(true);
      setError(false);
      try {
        const { data, error: fnError } = await supabase.functions.invoke('unsplash-photos', {
          body: { destination, perPage: 9 },
        });

        if (fnError) throw fnError;
        setPhotos(data.photos || []);
      } catch (e) {
        console.error('Failed to fetch photos:', e);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (destination) fetchPhotos();
  }, [destination]);

  if (loading) {
    return (
      <div className={cn('rounded-xl border border-border bg-card/60 backdrop-blur-sm p-6', className)}>
        <div className="flex items-center gap-2 mb-4">
          <Camera className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-display font-semibold">Destination Photos</h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || photos.length === 0) {
    return (
      <div className={cn('rounded-xl border border-border bg-card/60 backdrop-blur-sm p-6', className)}>
        <div className="flex items-center gap-2 mb-4">
          <Camera className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-display font-semibold">Destination Photos</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <ImageOff className="w-10 h-10 mb-3 opacity-50" />
          <p className="text-sm">No photos available for {destination}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-border bg-card/60 backdrop-blur-sm', className)}>
      <div className="flex items-center gap-2 p-4 pb-0">
        <Camera className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-display font-semibold">Destination Photos</h3>
        <span className="text-xs text-muted-foreground ml-auto">via Unsplash</span>
      </div>

      {/* Photo Grid */}
      <div className="p-4 grid grid-cols-3 gap-2">
        {photos.map((photo, idx) => (
          <button
            key={photo.id}
            onClick={() => setSelectedPhoto(photo)}
            className={cn(
              'relative overflow-hidden rounded-lg group cursor-pointer transition-all duration-300',
              'hover:ring-2 hover:ring-primary/50 hover:scale-[1.02]',
              idx === 0 && 'col-span-2 row-span-2',
              'aspect-square'
            )}
          >
            <img
              src={photo.thumb}
              alt={photo.alt}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-[10px] text-white/90 truncate">📷 {photo.photographer}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[85vh] w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedPhoto.url}
              alt={selectedPhoto.alt}
              className="w-full h-auto max-h-[80vh] object-contain rounded-xl"
            />
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent rounded-b-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/90">{selectedPhoto.alt}</p>
                  <a
                    href={`${selectedPhoto.photographerUrl}?utm_source=triptailor&utm_medium=referral`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-white/70 hover:text-white inline-flex items-center gap-1 mt-1"
                  >
                    📷 {selectedPhoto.photographer}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="text-white/70 hover:text-white text-sm px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
