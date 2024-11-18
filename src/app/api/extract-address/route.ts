import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
    try {
        const { image } = await request.json();

        const model = genAI.getGenerativeModel({ model: 'gemini-pro-vision' });

        const prompt = "Extract only the address from this image. If multiple addresses are present, choose the most prominent one. Return only the address, nothing else.";

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: image.split(',')[1], mimeType: 'image/jpeg' } }
        ]);

        const response = await result.response;
        const address = response.text().trim();

        return NextResponse.json({ address });
    } catch (error) {
        console.error('Error processing image:', error);
        return NextResponse.json(
            { error: 'Failed to process image' },
            { status: 500 }
        );
    }
}