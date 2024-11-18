import { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';

interface MapContextType {
    destinations: Array<{ lat: number; lng: number; address: string; }>;
    addDestination: (destination: { lat: number; lng: number; address: string; }) => void;
    optimizeRoute: () => void;
    currentLocation: { lat: number; lng: number; } | null;
    setCurrentLocation: (location: { lat: number; lng: number; }) => void;
}

const MapContext = createContext<MapContextType | undefined>(undefined);

export function MapProvider({ children }: { children: React.ReactNode; }) {
    const [destinations, setDestinations] = useState<Array<{ lat: number; lng: number; address: string; }>>([]);
    const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number; } | null>(null);

    const addDestination = (destination: { lat: number; lng: number; address: string; }) => {
        setDestinations(prev => [...prev, destination]);
    };

    const optimizeRoute = async () => {
        // Implement route optimization logic here
        // You might want to use Google Maps Directions Service
        // or a custom algorithm to optimize the route
    };

    return (
        <MapContext.Provider value={{
            destinations,
            addDestination,
            optimizeRoute,
            currentLocation,
            setCurrentLocation,
        }}>
            {children}
        </MapContext.Provider>
    );
}

export const useMap = () => {
    const context = useContext(MapContext);
    if (context === undefined) {
        throw new Error('useMap must be used within a MapProvider');
    }
    return context;
};