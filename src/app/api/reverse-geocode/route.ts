import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { lat, lng } = await request.json();

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.GOOGLE_MAPS_API_KEY}`
        );

        const data = await response.json();

        if (data.status !== 'OK') {
            throw new Error(`Geocoding failed with status: ${data.status}`);
        }

        const address = data.results[0].formatted_address;

        return NextResponse.json({ address });
    } catch (error) {
        console.error('Error reverse geocoding:', error);
        return NextResponse.json(
            { error: 'Failed to get address' },
            { status: 500 }
        );
    }
}