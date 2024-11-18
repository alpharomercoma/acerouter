import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { locations } = await request.json();

        if (!locations || locations.length < 2) {
            throw new Error('At least two locations are required');
        }

        const origin = locations[0];
        const destination = locations[locations.length - 1];
        const waypoints = locations.slice(1, -1);

        const waypointsParam = waypoints.length > 0
            ? `&waypoints=${waypoints.map((wp: any) => `via:${encodeURIComponent(wp.address)}`).join('|')}`
            : '';

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin.address)}&destination=${encodeURIComponent(destination.address)}${waypointsParam}&departure_time=now&traffic_model=best_guess&alternatives=true&key=${process.env.GOOGLE_MAPS_API_KEY}`
        );

        const data = await response.json();

        if (data.status !== 'OK') {
            throw new Error(`Directions request failed with status: ${data.status}`);
        }

        // Process all alternative routes
        const routes = data.routes.map((route: any) => ({
            duration: route.legs.reduce((total: number, leg: any) => total + leg.duration.value, 0),
            durationInTraffic: route.legs.reduce((total: number, leg: any) => total + (leg.duration_in_traffic?.value || leg.duration.value), 0),
            distance: route.legs.reduce((total: number, leg: any) => total + leg.distance.value, 0),
            summary: route.summary,
            steps: route.legs.flatMap((leg: any) => leg.steps.map((step: any) => ({
                instruction: step.html_instructions,
                distance: step.distance.text,
                duration: step.duration.text,
            }))),
        }));

        return NextResponse.json({ routes });
    } catch (error) {
        console.error('Error getting traffic info:', error);
        return NextResponse.json(
            { error: 'Failed to get traffic information' },
            { status: 500 }
        );
    }
}