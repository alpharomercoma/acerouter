import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { address } = await request.json();

        console.log('Received address:', address);

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_MAPS_API_KEY}`
        );

        const data = await response.json();

        console.log('API response:', data);

        if (data.status !== 'OK') {
            // Log the specific error message from Google
            console.error('Geocoding failed with status:', data.status);
            if (data.error_message) {
                throw new Error(`Geocoding failed: ${data.error_message}`);
            } else {
                throw new Error(`Geocoding failed with status code: ${data.status}`);
            }
        }

        const { lat, lng } = data.results[0].geometry.location;
        const formattedAddress = data.results[0].formatted_address;

        return NextResponse.json({ lat, lng, formattedAddress });
    } catch (error: any) {
        console.error('Error geocoding address:', error.message || String(error));
        return NextResponse.json(
            { error: 'Failed to geocode address' },
            { status: 500 }
        );
    }
}
