import { toAskWithStreaming } from "./runWithStreaming";
import { saveLog } from "../logs/saveLog";
import { textToSpeech } from "../../services/textoToSpeech";

// Estado compartido para colas y locks de usuario
export const userQueues = new Map();
export const userLocks = new Map();

// Presencia: simula que el bot está escribiendo
export const typing = async function (ctx: any, provider: any) {
    if (provider && provider?.vendor && provider.vendor?.sendPresenceUpdate) {
        const id = ctx.key.remoteJid;
        await provider.vendor.sendPresenceUpdate('composing', id);
    }
};
// Presencia: simula que el bot está grabando audio
export const recording = async function (ctx: any, provider: any) {
    if (provider && provider?.vendor && provider.vendor?.sendPresenceUpdate) {
        const id = ctx.key.remoteJid;
        await provider.vendor.sendPresenceUpdate('recording', id);
    }
};

// Procesa mensajes de usuario (texto)
const ASSISTANT_ID = process.env.ASSISTANT_ID ?? '';
export const processUserMessage = async (ctx, { flowDynamic, state, provider }) => {
    await typing(ctx, provider);
    console.log(`[Message received][USER][${ctx.from}] ${ctx.pushName || ctx.name || ctx.from}: ${ctx.body}`);
    const response = await toAskWithStreaming(ASSISTANT_ID, ctx.body, state);
    saveLog(
        'user_message_logs',
        ctx.key?.id || ctx.from || 'unknown',
        {
            date: new Date().toISOString(),
            user: ctx.from,
            message: ctx.body,
            response,
            state: state?.toJSON ? state.toJSON() : state
        }
    );
    const chunks = response.split(/\n\n+/);
    for (const chunk of chunks) {
        const cleanedChunk = chunk.trim().replace(/【.*?】[ ] /g, "");
        if (cleanedChunk) {
            console.log(`[Response sent][BOT][${ctx.from}] ${cleanedChunk}`);
            await flowDynamic([{ body: cleanedChunk }]);
        }
    }
};

// Procesa mensajes de usuario (audio)
// answerWithAudio: controlado por variable de entorno ANSWER_WITH_AUDIO ("true" para audio, cualquier otro valor o vacío para texto)
export const processAudioUserMessage = async (ctx, { flowDynamic, state, provider }) => {
    await recording(ctx, provider);
    console.log(`[Message received][USER][${ctx.from}] ${ctx.pushName || ctx.name || ctx.from}: ${ctx.body}`);
    const response = await toAskWithStreaming(ASSISTANT_ID, ctx.body, state);
    saveLog(
        'user_message_logs',
        ctx.key?.id || ctx.from || 'unknown',
        {
            date: new Date().toISOString(),
            user: ctx.from,
            message: ctx.body,
            response,
            state: state?.toJSON ? state.toJSON() : state
        }
    );
    // Lee la variable de entorno y por defecto es false si está vacía o no es 'true'
    const answerWithAudio = (process.env.ANSWER_WITH_AUDIO || '').toLowerCase() === 'true';
    if (answerWithAudio) {
        const audioPath = await textToSpeech(response);
        console.log(`[Response sent][BOT][${ctx.from}] ${response}`);
        await flowDynamic([{ media: audioPath }]);
    } else {
        // Solo responde con texto transcrito
        const cleanedChunk = response.trim().replace(/【.*?】[ ] /g, "");
        if (cleanedChunk) {
            console.log(`[Response sent][BOT][${ctx.from}] ${cleanedChunk}`);
            await flowDynamic([{ body: cleanedChunk }]);
        }
    }
};

// Envía un archivo multimedia usando flowDynamic
export const sendMediaToFlow = async (flowDynamic, mediaPath) => {
    await flowDynamic([{ media: mediaPath }]);
};

// Cola de mensajes de usuario (texto)
export const handleQueue = async (userId) => {
    const queue = userQueues.get(userId);
    if (userLocks.get(userId)) return;
    while (queue.length > 0) {
        userLocks.set(userId, true);
        const { ctx, flowDynamic, state, provider } = queue.shift();
        try {
            await processUserMessage(ctx, { flowDynamic, state, provider });
        } catch (error) {
            console.error(`Error procesando mensaje para el usuario ${userId}:`, error);
        } finally {
            userLocks.set(userId, false);
        }
    }
    userLocks.delete(userId);
    userQueues.delete(userId);
};

// Cola de mensajes de usuario (audio)
export const handleAudioQueue = async (userId) => {
    const queue = userQueues.get(userId);
    if (userLocks.get(userId)) return;
    while (queue.length > 0) {
        userLocks.set(userId, true);
        const { ctx, flowDynamic, state, provider } = queue.shift();
        try {
            await processAudioUserMessage(ctx, { flowDynamic, state, provider });
        } catch (error) {
            console.error(`Error procesando mensaje de audio para el usuario ${userId}:`, error);
        } finally {
            userLocks.set(userId, false);
        }
    }
    userLocks.delete(userId);
    userQueues.delete(userId);
};
