import ffmpeg from 'fluent-ffmpeg';

/**
 * Convierte un archivo de audio .ogg o .oga a .mp3
 * @param inputPath Ruta del archivo de entrada (.ogg o .oga)
 * @param outputPath Ruta del archivo de salida (.mp3)
 * @returns Promise<string> - Ruta del archivo convertido
 */
export const OGGtoMP3 = (inputPath: string, outputPath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .toFormat('mp3')
            .on('end', () => {
                console.log(`Archivo convertido con éxito: ${outputPath}`);
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error(`Error al convertir el archivo: ${err.message}`);
                reject(err);
            })
            .save(outputPath);
    });
};