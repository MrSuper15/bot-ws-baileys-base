import OpenAI from "openai";
import { env } from "process";
import fs from "fs";

const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY ?? "",
});

export const textToSpeech = async (text) => {
    try {
        const response = await openai.audio.speech.create({
            model: "gpt-4o-mini-tts",
            input: text,
            voice: "alloy"
        });
        // Convertir el ReadableStream a un Buffer
        const reader = response.body.getReader();
        const chunks = [];
        let done = false;
        while (!done) {
            const result = await reader.read();
            done = result.done;
            if (!done) {
                chunks.push(Buffer.from(result.value));
            }
        }
        const audioBuffer = Buffer.concat(chunks);
        const filePath = `tmp/audio_${Date.now()}.mp3`;
        fs.writeFileSync(filePath, audioBuffer);
        return filePath;
    } catch (error) {
        console.error("Error generando audio:", error);
        throw new Error("Error generando audio: " + error.message);
    }
};