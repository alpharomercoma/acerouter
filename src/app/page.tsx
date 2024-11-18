'use client';

import ChatInterface from '@/components/ChatInterface';
import DynamicMap from '@/components/DynamicMap';
import { MapProvider } from '@/contexts/MapContext';

export default function Home() {
  return (
    <MapProvider>
      <div className="relative w-full h-screen">
        <DynamicMap />
        <ChatInterface />
      </div>
    </MapProvider>
  );
}
