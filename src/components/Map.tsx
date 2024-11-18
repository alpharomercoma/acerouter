'use client';

import { useMap } from '@/contexts/MapContext';
import { DirectionsRenderer, GoogleMap, Marker, useLoadScript } from '@react-google-maps/api';
import { useEffect, useMemo, useState } from 'react';

const Map = () => {
    const { isLoaded } = useLoadScript({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    });

    const { destinations, currentLocation } = useMap();
    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

    const center = useMemo(() => currentLocation || {
        lat: 14.5995,
        lng: 120.9842
    }, [currentLocation]);

    useEffect(() => {
        if (destinations.length >= 2 && window.google) {
            const directionsService = new google.maps.DirectionsService();

            const origin = destinations[0];
            const destination = destinations[destinations.length - 1];
            const waypoints = destinations.slice(1, -1).map(point => ({
                location: new google.maps.LatLng(point.lat, point.lng),
                stopover: true
            }));

            directionsService.route({
                origin: new google.maps.LatLng(origin.lat, origin.lng),
                destination: new google.maps.LatLng(destination.lat, destination.lng),
                waypoints,
                optimizeWaypoints: true,
                travelMode: google.maps.TravelMode.DRIVING,
                drivingOptions: {
                    departureTime: new Date(), // Current time
                    trafficModel: google.maps.TrafficModel.BEST_GUESS
                },
            }, (result, status) => {
                if (status === 'OK') {
                    setDirections(result);
                }
            });
        }
    }, [destinations]);

    if (!isLoaded) return <div>Loading...</div>;

    return (
        <GoogleMap
            zoom={13}
            center={center}
            mapContainerClassName="w-full h-full"
            options={{
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
            }}
        >
            {currentLocation && (
                <Marker
                    position={currentLocation}
                    icon={{
                        url: '/current-location-marker.png',
                        scaledSize: new google.maps.Size(30, 30)
                    }}
                />
            )}

            {directions && <DirectionsRenderer directions={directions} />}

            {!directions && destinations.map((dest, index) => (
                <Marker
                    key={index}
                    position={{ lat: dest.lat, lng: dest.lng }}
                    label={`${index + 1}`}
                />
            ))}
        </GoogleMap>
    );
};

export default Map;