'use client';

import { useMap } from '@/contexts/MapContext';
import { formatDuration, formatTrafficDelay } from '@/utils/formatters';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import AddressConfirmationDialog from './AddressConfirmationDialog';

interface Message {
    role: 'user' | 'assistant' | 'route-assistant' | 'traffic-assistant';
    content: string;
}

// Separate the traffic query handler to use destinations from props
const handleTrafficQuery = async (query: string, destinations: Array<{ lat: number; lng: number; address: string; }>) => {
    if (destinations.length < 2) {
        return {
            role: 'traffic-assistant',
            content: 'I need at least two locations in your route to provide traffic information. Please add more destinations first.'
        };
    }

    try {
        const response = await fetch('/api/traffic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locations: destinations }),
        });

        if (!response.ok) throw new Error('Failed to get traffic information');

        const { routes } = await response.json();
        const bestRoute = routes[0];

        // Calculate traffic delay
        const delay = bestRoute.durationInTraffic - bestRoute.duration;

        // Generate appropriate response based on the query
        let res = '';
        if (query.toLowerCase().includes('time')) {
            res = `The current travel time is ${formatDuration(bestRoute.durationInTraffic)}${delay > 180 ? ` (${formatTrafficDelay(delay)} delay due to traffic)` : ''}.`;
        } else if (query.toLowerCase().includes('distance')) {
            res = `The total distance is ${(bestRoute.distance / 1000).toFixed(1)} km.`;
        } else if (query.toLowerCase().includes('route') || query.toLowerCase().includes('direction')) {
            res = `The best route is via ${bestRoute.summary}. Here are the step-by-step directions:\n\n${bestRoute.steps.map((step: any, index: number) => `${index + 1}. ${step.instruction} (${step.distance})`).join('\n')}`;
        } else {
            res = `Current traffic conditions:\n• Travel time: ${formatDuration(bestRoute.durationInTraffic)}\n• Distance: ${(bestRoute.distance / 1000).toFixed(1)} km\n• Route: via ${bestRoute.summary}${delay > 180 ? `\n• Traffic delay: ${formatTrafficDelay(delay)}` : ''}`;
        }

        return {
            role: 'traffic-assistant' as const,
            content: res
        };
    } catch (error) {
        console.error('Error getting traffic info:', error);
        return {
            role: 'traffic-assistant' as const,
            content: 'Sorry, I had trouble getting the traffic information. Please try again.'
        };
    }
};

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLocationEnabled, setIsLocationEnabled] = useState(false);
    const [isChatVisible, setIsChatVisible] = useState(true);
    const [showCamera, setShowCamera] = useState(false);
    const { addDestination, setCurrentLocation, destinations } = useMap();
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [extractedAddress, setExtractedAddress] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showAddressConfirmation, setShowAddressConfirmation] = useState(false);
    const [activeChat, setActiveChat] = useState<'route' | 'traffic'>('route');
    const [trafficContext, setTrafficContext] = useState<{
        lastQuery: string;
        lastUpdate: number;
    }>({
        lastQuery: '',
        lastUpdate: 0,
    });

    // Add file input ref
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Initial message from Gemini
        if (messages.length === 0) {
            setMessages([{
                role: 'assistant',
                content: 'Hi! To help plan your route, I\'ll need access to your location. Would you like to enable location services?'
            }]);
        }
    }, []);

    const handleCapture = async () => {
        const videoElement = document.getElementById('camera-preview') as HTMLVideoElement;
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        canvas.getContext('2d')?.drawImage(videoElement, 0, 0);

        const imageBase64 = canvas.toDataURL('image/jpeg');
        setIsProcessing(true);

        try {
            const response = await fetch('/api/extract-address', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageBase64 }),
            });

            if (!response.ok) throw new Error('Failed to process image');

            const data = await response.json();

            // Add image and AI response to chat
            setMessages(prev => [...prev,
                {
                    role: 'user',
                    content: `<img src="${imageBase64}" alt="Captured image" style="max-width: 200px; border-radius: 8px;" />`
                },
                {
                    role: 'assistant',
                    content: `I found this address: ${data.address}`
                }
            ]);

            setExtractedAddress(data.address);
            setShowAddressConfirmation(true);
            setShowCamera(false); // Close camera after successful capture

            // Stop camera stream
            const videoEl = document.getElementById('camera-preview') as HTMLVideoElement;
            if (videoEl?.srcObject) {
                (videoEl.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            }
        } catch (error) {
            console.error('Error processing image:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I had trouble processing that image. Please try again.'
            }]);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSend = async () => {
        if (!inputMessage.trim()) return;

        setMessages(prev => [...prev, {
            role: 'user',
            content: inputMessage
        }]);

        if (activeChat === 'traffic') {
            const response = await handleTrafficQuery(inputMessage, destinations);
            setMessages(prev => [...prev, response]);
        } else {
        // Existing route planning logic
            try {
                const response = await fetch('/api/geocode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address: inputMessage }),
                });

                if (!response.ok) throw new Error('Failed to geocode address');

                const { lat, lng, formattedAddress } = await response.json();
                addDestination({ lat, lng, address: formattedAddress });

                setMessages(prev => [...prev, {
                    role: 'route-assistant',
                    content: `Added ${formattedAddress} to your route.`
                }]);
            } catch (error) {
                console.error('Error processing address:', error);
                setMessages(prev => [...prev, {
                    role: 'route-assistant',
                    content: 'Sorry, I couldn\'t find that location. Please try again.'
                }]);
            }
        }

        setInputMessage('');
    };

    const requestLocation = async () => {
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    maximumAge: 30000,
                    timeout: 27000
                });
            });

            const { latitude, longitude } = position.coords;
            setIsLocationEnabled(true);
            setCurrentLocation({ lat: latitude, lng: longitude });

            setMessages(prev => [...prev,
                { role: 'user', content: 'Location enabled' },
                { role: 'assistant', content: 'Great! You can now share your destination by typing an address, uploading a photo, or using the camera to scan.' }
            ]);

        } catch (error) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'I couldn\'t access your location. Please enable location services to continue.'
            }]);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setIsProcessing(true);
            try {
                const reader = new FileReader();
                reader.onloadend = async () => {
                    const base64 = reader.result as string;

                    // Add image to chat immediately
                    setMessages(prev => [...prev, {
                        role: 'user',
                        content: `<img src="${base64}" alt="Uploaded image" style="max-width: 200px; border-radius: 8px;" />`
                    }]);

                    const response = await fetch('/api/extract-address', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ image: base64 }),
                    });

                    if (!response.ok) throw new Error('Failed to process image');

                    const data = await response.json();

                    // Add AI response to chat
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `I found this address: ${data.address}`
                    }]);

                    setExtractedAddress(data.address);
                    setShowAddressConfirmation(true);
                };
                reader.readAsDataURL(file);
            } catch (error) {
                console.error('Error processing image:', error);
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: 'Sorry, I had trouble processing that image. Please try again.'
                }]);
            } finally {
                setIsProcessing(false);
                // Clear the file input
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        }
    };

    // Camera handling logic from ScanButton component
    const handleCamera = async () => {
        setShowCamera(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            const videoElement = document.getElementById('camera-preview') as HTMLVideoElement;
            if (videoElement) {
                videoElement.srcObject = stream;
            }
        } catch (error) {
            console.error('Camera error:', error);
        }
    };

    // Add new function to handle clearing chat
    const handleClearChat = () => {
        setMessages([{
            role: 'assistant',
            content: 'Chat cleared. How can I help you with your route?'
        }]);
    };

    // Add function to add current location as destination
    const addCurrentLocationAsDestination = async () => {
        if (!navigator.geolocation) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Geolocation is not supported by your browser.'
            }]);
            return;
        }

        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });

            const { latitude, longitude } = position.coords;

            // Reverse geocode to get address
            const response = await fetch('/api/reverse-geocode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat: latitude, lng: longitude }),
            });

            if (!response.ok) throw new Error('Failed to get address');

            const { address } = await response.json();
            addDestination({ lat: latitude, lng: longitude, address });

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Added your current location: ${address}`
            }]);

        } catch (error) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Unable to access your location. Please ensure location services are enabled.'
            }]);
        }
    };

    return (
        <>
            <div className="absolute left-4 top-4 z-20 flex gap-2">
                <button
                    onClick={() => setIsChatVisible(!isChatVisible)}
                    className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                >
                    {isChatVisible ? '←' : '→'}
                </button>
                {isChatVisible && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveChat('route')}
                            className={`p-2 rounded-full shadow-lg ${activeChat === 'route' ? 'bg-blue-500 text-white' : 'bg-white'
                                }`}
                        >
                            🗺️
                        </button>
                        <button
                            onClick={() => setActiveChat('traffic')}
                            className={`p-2 rounded-full shadow-lg ${activeChat === 'traffic' ? 'bg-blue-500 text-white' : 'bg-white'
                                }`}
                        >
                            🚦
                        </button>
                    </div>
                )}
            </div>

            {isChatVisible && (
                <div className="absolute left-4 md:left-8 top-20 bottom-8 w-[90vw] md:w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg flex flex-col overflow-hidden z-10">
                    {/* Chat header */}
                    <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                        <h2 className="font-semibold">
                            {activeChat === 'route' ? 'Route Planning' : 'Traffic Assistant'}
                        </h2>
                        <div className="flex gap-2">
                            {isLocationEnabled && (
                                <button
                                    onClick={addCurrentLocationAsDestination}
                                    className="p-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                                    title="Add current location"
                                >
                                    📍
                                </button>
                            )}
                            <button
                                onClick={handleClearChat}
                                className="p-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                                title="Clear chat"
                            >
                                🗑️
                            </button>
                        </div>
                    </div>

                    {/* Chat messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((message, index) => (
                            <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {message.role !== 'user' && (
                                    <div className="w-8 h-8 rounded-full overflow-hidden mr-2">
                                        <Image
                                            src={message.role === 'route-assistant' ? "/route-assistant.png" : "/help-assistant.png"}
                                            alt="Assistant"
                                            width={32}
                                            height={32}
                                        />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[80%] p-3 rounded-lg ${message.role === 'user'
                                            ? 'bg-blue-500 text-white ml-2'
                                            : 'bg-gray-100 dark:bg-gray-700'
                                        }`}
                                    dangerouslySetInnerHTML={{ __html: message.content }}
                                />
                                {message.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full overflow-hidden ml-2">
                                        <Image
                                            src="/user-avatar.png"
                                            alt="User"
                                            width={32}
                                            height={32}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Input area */}
                    <div className="border-t dark:border-gray-700 p-4 space-y-3">
                        {!isLocationEnabled ? (
                            <button
                                onClick={requestLocation}
                                className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                            >
                                Enable Location
                            </button>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={inputMessage}
                                        onChange={(e) => setInputMessage(e.target.value)}
                                            placeholder={activeChat === 'traffic'
                                                ? "Ask about traffic, time, or directions..."
                                                : "Type a destination..."}
                                        className="flex-1 p-2 border dark:border-gray-700 rounded-lg dark:bg-gray-700"
                                    />
                                    <button
                                        onClick={handleSend}
                                        className="px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                                    >
                                        Send
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileUpload}
                                        ref={fileInputRef}
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                                    >
                                        📎 Upload Image
                                    </button>
                                    <button
                                        onClick={handleCamera}
                                        className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                                    >
                                        📷 Scan Image
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Add the AddressConfirmationDialog */}
            <AddressConfirmationDialog
                address={extractedAddress}
                isOpen={showAddressConfirmation}
                onClose={() => {
                    setShowAddressConfirmation(false);
                    setExtractedAddress('');
                }}
                onRetake={() => {
                    setShowAddressConfirmation(false);
                    setExtractedAddress('');
                    handleCamera();
                }}
                isProcessing={isProcessing}
            />

            {/* Update the camera modal to show processing state */}
            {showCamera && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-4 rounded-lg">
                        <video
                            id="camera-preview"
                            className="rounded-lg"
                            autoPlay
                            playsInline
                        />
                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={handleCapture}
                                disabled={isProcessing}
                                className={`flex-1 py-2 ${isProcessing ? 'bg-gray-400' : 'bg-blue-500'} text-white rounded-lg`}
                            >
                                {isProcessing ? 'Processing...' : 'Capture'}
                            </button>
                            <button
                                onClick={() => {
                                    setShowCamera(false);
                                    const videoElement = document.getElementById('camera-preview') as HTMLVideoElement;
                                    if (videoElement?.srcObject) {
                                        (videoElement.srcObject as MediaStream).getTracks().forEach(track => track.stop());
                                    }
                                }}
                                disabled={isProcessing}
                                className={`flex-1 py-2 ${isProcessing ? 'bg-gray-400' : 'bg-red-500'} text-white rounded-lg`}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}