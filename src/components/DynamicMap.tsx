"use client";
import dynamic from 'next/dynamic';

// Dynamically import the map component to avoid SSR issues
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false
});

export default function DynamicMap() {
    return <Map />;
 }