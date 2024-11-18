import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds

async function generateAddressWithRetry(prompt: string, image: string) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result = await model.generateContent([
                prompt,
                { inlineData: { data: image.split(',')[1], mimeType: 'image/jpeg' } }
            ]);
            console.log(result.response.text().trim());
            return result.response.text().trim();
        } catch (error) {
            console.error(`Attempt ${attempt + 1} failed:`, error);
            if (attempt === MAX_RETRIES - 1) {
                throw new Error('Max retries reached');
            }
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (2 ** attempt)));
        }
    }
}

export async function POST(request: Request) {
    try {
        const { image } = await request.json();

        const prompt = "Extract only the address from this image. If multiple addresses are present, choose the most prominent one. Return only the address, nothing else.";

        const address = await generateAddressWithRetry(prompt, image);

        return NextResponse.json({ address });
    } catch (error) {
        if (error instanceof Error && error.message === 'Max retries reached') {
            return NextResponse.json(
                { error: 'Model temporarily unavailable. Please try again later.' },
                { status: 503 }
            );
        }
        console.error('Error processing image:', error);
        return NextResponse.json(
            { error: 'Failed to process image' },
            { status: 500 }
        );
    }
}
