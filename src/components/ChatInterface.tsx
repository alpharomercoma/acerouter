'use client';

import { useMap } from '@/contexts/MapContext';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import AddressConfirmationDialog from './AddressConfirmationDialog';

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
                                        placeholder="Type a destination..."
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