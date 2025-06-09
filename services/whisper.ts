import OpenAI from "openai";
import { env } from "process";
import fs from "fs";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY ?? "",
});

export const voiceToText = async (path) => {
  if (!fs.existsSync(path)) {
    throw new Error("File not found: " + path);
  }

  try {
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(path),
      model: "whisper-1",
    });
    return response.text;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw new Error("Error transcribing audio: " + error.message);
  }
};