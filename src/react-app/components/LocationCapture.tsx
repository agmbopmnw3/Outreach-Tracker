import { MapPin, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

interface LocationCaptureProps {
  onLocationCapture: (location: string, latitude: number, longitude: number) => void;
  currentLocation?: string;
  currentLatitude?: number;
  currentLongitude?: number;
}

export default function LocationCapture({ 
  onLocationCapture, 
  currentLocation,
  currentLatitude,
  currentLongitude 
}: LocationCaptureProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [location, setLocation] = useState(currentLocation || '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    currentLatitude && currentLongitude 
      ? { lat: currentLatitude, lng: currentLongitude }
      : null
  );

  useEffect(() => {
    if (currentLocation && currentLatitude && currentLongitude) {
      setStatus('success');
      setLocation(currentLocation);
      setCoords({ lat: currentLatitude, lng: currentLongitude });
    }
  }, [currentLocation, currentLatitude, currentLongitude]);

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setStatus('error');
      return;
    }

    setStatus('loading');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ lat: latitude, lng: longitude });

        // Reverse geocode to get location name
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          const locationName = data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          
          setLocation(locationName);
          setStatus('success');
          onLocationCapture(locationName, latitude, longitude);
        } catch (error) {
          // Fallback to coordinates if geocoding fails
          const locationName = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          setLocation(locationName);
          setStatus('success');
          onLocationCapture(locationName, latitude, longitude);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setStatus('error');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  if (status === 'success' && location && coords) {
    return (
      <div className="border-2 border-green-200 bg-green-50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-green-100 rounded-full">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-900">Location Captured</p>
            <p className="text-sm text-green-700 mt-1 break-words">{location}</p>
            <p className="text-xs text-green-600 mt-1">
              {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
            </p>
            <button
              type="button"
              onClick={captureLocation}
              className="text-xs text-green-700 hover:text-green-900 underline mt-2"
            >
              Recapture location
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="border-2 border-red-200 bg-red-50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-red-100 rounded-full">
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">Location Access Denied</p>
            <p className="text-sm text-red-700 mt-1">
              Please enable location services in your browser settings
            </p>
            <button
              type="button"
              onClick={captureLocation}
              className="text-xs text-red-700 hover:text-red-900 underline mt-2"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="border-2 border-indigo-200 bg-indigo-50 rounded-lg p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-indigo-100 rounded-full">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
          </div>
          <div>
            <p className="text-slate-700 font-medium">Capturing Location...</p>
            <p className="text-slate-500 text-sm mt-1">Please allow location access</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={captureLocation}
      className="w-full border-2 border-dashed border-slate-300 rounded-xl p-6 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all active:scale-95"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="p-3 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-full">
          <MapPin className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <p className="text-slate-700 font-semibold">Capture GPS Location</p>
          <p className="text-slate-500 text-sm mt-1">Tap to get current location</p>
        </div>
      </div>
    </button>
  );
}
