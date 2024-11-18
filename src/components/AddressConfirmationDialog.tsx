'use client';

import { useMap } from '@/contexts/MapContext';
import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';

interface Props {
    address: string;
    isOpen: boolean;
    onClose: () => void;
    onRetake: () => void;
    isProcessing: boolean;
}

export default function AddressConfirmationDialog({
    address,
    isOpen,
    onClose,
    onRetake,
    isProcessing
}: Props) {
    const [editedAddress, setEditedAddress] = useState(address);
    const { addDestination } = useMap();

    const handleConfirm = async () => {
        try {
            const response = await fetch('/api/geocode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: editedAddress }),
            });

            if (!response.ok) throw new Error('Failed to geocode address');

            const { lat, lng, formattedAddress } = await response.json();
            addDestination({ lat, lng, address: formattedAddress });
            onClose();
        } catch (error) {
            console.error('Error confirming address:', error);
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={onClose}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-[90vw] max-w-md">
                    <Dialog.Title className="text-lg font-bold mb-4">
                        {isProcessing ? 'Processing Image...' : 'Confirm Address'}
                    </Dialog.Title>

                    {isProcessing ? (
                        <div className="flex items-center justify-center p-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                        </div>
                    ) : (
                        <>
                                <div className="mb-4">
                                    <textarea
                                        value={editedAddress}
                                        onChange={(e) => setEditedAddress(e.target.value)}
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                        rows={3}
                                    />
                                </div>

                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={onRetake}
                                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded dark:text-gray-300 dark:hover:bg-gray-700"
                                    >
                                        Retake Photo
                                    </button>
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded dark:text-gray-300 dark:hover:bg-gray-700"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleConfirm}
                                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                    >
                                        Confirm
                                    </button>
                                </div>
                        </>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}