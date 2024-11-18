import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { origin, destination } = await request.json();

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&departure_time=now&traffic_model=best_guess&key=${process.env.GOOGLE_MAPS_API_KEY}`
        );

        const data = await response.json();

        if (data.status !== 'OK') {
            throw new Error(`Directions request failed with status: ${data.status}`);
        }

        const route = data.routes[0];
        const leg = route.legs[0];

        return NextResponse.json({
            duration: leg.duration.text,
            durationInTraffic: leg.duration_in_traffic.text,
            distance: leg.distance.text,
            steps: leg.steps.map((step: any) => ({
                instruction: step.html_instructions,
                distance: step.distance.text,
                duration: step.duration.text,
            })),
        });
    } catch (error) {
        console.error('Error getting traffic info:', error);
        return NextResponse.json(
            { error: 'Failed to get traffic information' },
            { status: 500 }
        );
    }
}