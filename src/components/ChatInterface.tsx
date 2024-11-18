'use client';

import { useMap } from '@/contexts/MapContext';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

interface Message {
    role: 'user' | 'assistant' | 'route-assistant' | 'help-assistant';
    content: string;
}

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLocationEnabled, setIsLocationEnabled] = useState(false);
    const [isChatVisible, setIsChatVisible] = useState(true);
    const [showCamera, setShowCamera] = useState(false);
    const { addDestination } = useMap();
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [extractedAddress, setExtractedAddress] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showAddressConfirmation, setShowAddressConfirmation] = useState(false);

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
        setCapturedImage(imageBase64);
        setIsProcessing(true);

        try {
            const response = await fetch('/api/extract-address', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageBase64 }),
            });

            if (!response.ok) throw new Error('Failed to process image');

            const data = await response.json();
            setExtractedAddress(data.address);
            setShowAddressConfirmation(true);
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
                role: 'assistant',
                content: `Added ${formattedAddress} to your route.`
            }]);
        } catch (error) {
            console.error('Error processing address:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I couldn\'t find that location. Please try again.'
            }]);
        }

        setInputMessage('');
    };

    const requestLocation = async () => {
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });

            setIsLocationEnabled(true);
            setMessages(prev => [...prev,
            { role: 'user', content: 'Location enabled' },
            { role: 'assistant', content: 'Great! You can now share your destination by typing an address, uploading a photo, or using the camera to scan.' }
            ]);

            // Here you would typically update the map with the user's location
            const { latitude, longitude } = position.coords;
            // Update map center (implement this)

        } catch (error) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'I couldn\'t access your location. Please enable location services to continue.'
            }]);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // Handle image upload logic
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                // Process image with Gemini
                // processImageWithGemini(base64);
            };
            reader.readAsDataURL(file);
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

    return (
        <>
            <button
                onClick={() => setIsChatVisible(!isChatVisible)}
                className="absolute left-4 top-4 z-20 p-2 bg-white rounded-full shadow-lg"
            >
                {isChatVisible ? '←' : '→'}
            </button>

            {isChatVisible && (
                <div className="absolute left-4 md:left-8 top-20 bottom-8 w-[90vw] md:w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg flex flex-col overflow-hidden z-10">
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
                                <div className={`max-w-[80%] p-3 rounded-lg ${message.role === 'user'
                                    ? 'bg-blue-500 text-white ml-2'
                                    : 'bg-gray-100 dark:bg-gray-700'
                                    }`}>
                                    {message.content}
                                </div>
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
                    <div className="border-t dark:border-gray-700 p-4">
                        {!isLocationEnabled ? (
                            <button
                                onClick={requestLocation}
                                className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                            >
                                Enable Location
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    placeholder="Type a destination..."
                                    className="flex-1 p-2 border dark:border-gray-700 rounded-lg dark:bg-gray-700"
                                />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileUpload}
                                        ref={fileInputRef}
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                                    >
                                        📎
                                    </button>
                                    <button
                                        onClick={handleCamera}
                                        className="p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                                    >
                                        📷
                                    </button>
                                    <button
                                        onClick={handleSend}
                                    className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                                >
                                    Send
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Camera Modal */}
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
                                className="flex-1 py-2 bg-blue-500 text-white rounded-lg"
                            >
                                Capture
                            </button>
                            <button
                                onClick={() => {
                                    setShowCamera(false);
                                    const videoElement = document.getElementById('camera-preview') as HTMLVideoElement;
                                    if (videoElement?.srcObject) {
                                        (videoElement.srcObject as MediaStream).getTracks().forEach(track => track.stop());
                                    }
                                }}
                                className="flex-1 py-2 bg-red-500 text-white rounded-lg"
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