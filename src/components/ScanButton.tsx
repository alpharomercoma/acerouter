'use client';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { useState } from 'react';

export default function ScanButton() {
    const [isScanning, setIsScanning] = useState(false);
    const [showCamera, setShowCamera] = useState(false);

    const handleScan = async () => {
        setShowCamera(true);
        setIsScanning(true);
        try {
            // Initialize camera
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            // Create video element
            const video = document.createElement('video');
            video.srcObject = stream;
            await video.play();

            // Capture frame
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0);

            // Convert to base64
            const imageBase64 = canvas.toDataURL('image/jpeg');

            // Initialize Gemini
            const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);
            const model = genAI.getGenerativeModel({ model: 'gemini-pro-vision' });

            // Analyze image
            const result = await model.generateContent([imageBase64]);
            const response = await result.response;
            const address = response.text();

            // Trigger address confirmation dialog
            // Implementation will be added

        } catch (error) {
            console.error('Scanning error:', error);
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <>
            <button
                onClick={handleScan}
                disabled={isScanning}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all"
            >
                {isScanning ? (
                    <span className="animate-pulse">Scanning...</span>
                ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                )}
            </button>

            {showCamera && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-4 rounded-lg">
                        <video
                            id="camera-preview"
                            className="rounded-lg"
                            autoPlay
                            playsInline
                        />
                        <button
                            onClick={() => setShowCamera(false)}
                            className="mt-4 w-full py-2 bg-red-500 text-white rounded-lg"
                        >
                            Close Camera
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}