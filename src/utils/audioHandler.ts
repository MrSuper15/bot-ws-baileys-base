import { OGGtoMP3 } from "services/OOGtoMP3";
import { voiceToText } from "services/whisper";
import fs from "fs/promises";

// Maneja la conversión y transcripción de archivos de audio
export const audioHandler = async (ctx, provider) => {
    try {
        // Definir la carpeta de destino para las notas de voz
        const voiceNotesFolder = "./tmp/";

        // Guardar el archivo multimedia y obtener su ruta
        const filePath = await provider.saveFile(ctx, { path: voiceNotesFolder });
        console.log("Archivo multimedia guardado en:", filePath);

        // Derivar el nombre del archivo MP3 a partir del archivo OGA
        const mp3Path = `${filePath}.mp3`;

        // Convertir el archivo a MP3
        const convertedPath = await OGGtoMP3(filePath, mp3Path);

        // Transcribir el archivo MP3 a texto
        const text = await voiceToText(convertedPath);
        console.log("Archivo convertido a MP3 en:", convertedPath);

        // Eliminar los archivos temporales
        await fs.unlink(filePath); 
        await fs.unlink(convertedPath); 
        console.log("Archivos temporales eliminados:", filePath, convertedPath);

        return text;
    } catch (error) {
        console.error("Error procesando el archivo multimedia:", error);
    }
};