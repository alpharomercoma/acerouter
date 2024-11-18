export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours} hr ${minutes} min`;
    }
    return `${minutes} min`;
}

export function formatTrafficDelay(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    return `+${minutes} min`;
}