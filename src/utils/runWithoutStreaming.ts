import { createThread, addMessage } from '@builderbot-plugins/openai-assistants';
import { OpenAI } from 'openai';
import { BotStateStandAlone } from "@builderbot/bot/dist/types";
import { saveLog } from '~/logs/saveLog';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
console.log('OpenAI API Key:', OPENAI_API_KEY ? 'Loaded' : 'Not Loaded');
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/**
 * Maneja el estado 'requires_action' de un run procesando tool calls,
 * enviando sus salidas y actualizando el estado del run.
 */
const handleRequiresAction = async (threadId: string, run: any): Promise<any> => {
    console.log('Manejando requires_action...');
    saveLog('run_action_logs', run.id, run); 

    if (run.required_action?.submit_tool_outputs?.tool_calls) {
        const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
        const toolOutputs = toolCalls.map(toolCall => {
            // Log específico según la función
            let logMsg = '';
            switch (toolCall.function.name) {
                case 'make_hotel_reservation':
                    logMsg = '🛎️ Acción: Se requiere hacer una reservación de hotel.';
                    break;
                case 'night_check_in':
                    logMsg = '🌙 Acción: Se requiere hacer un check-in nocturno.';
                    break;
                case 'make_reservation':
                    logMsg = '📅 Acción: Se requiere hacer una reservación.';
                    break;
                case 'send_food_images':
                    logMsg = '🍽️ Acción: Se requiere enviar imágenes de comida.';
                    break;
                case 'show_room_video':
                    logMsg = '🎥 Acción: Se requiere mostrar un video de la habitación.';
                    break;
                default:
                    logMsg = `❓ Acción desconocida: ${toolCall.function.name}`;
            }
            console.log(logMsg);
            console.log(`Detalles: Ejecutando ${toolCall.function.name} con argumentos:`, toolCall.function.arguments);
            return {
                tool_call_id: toolCall.id,
                output: JSON.stringify({ status: "success", result: true }),
            };
        });

        if (toolOutputs.length > 0) {
            console.log('Enviando salidas de herramientas...');
            run = await openai.beta.threads.runs.submitToolOutputs(run.id, { thread_id: run.thread_id, tool_outputs: toolOutputs });
            console.log("Salidas enviadas. Nuevo estado:", run.status);
        }

        return handleRunStatus(threadId, run);
    } else {
        throw new Error(`No se encontraron tool calls para el run ${run.id}.`);
    }
};

/**
 * Maneja el estado de un run, incluyendo polling para estados intermedios
 * y procesando estados finales como 'completed' o 'requires_action'.
 */
const handleRunStatus = async (threadId: string, run: any): Promise<any> => {
    console.log('Manejando estado del run:', run.status);

    const pollingInterval = 1500;
    const pollingTimeout = 120 * 1000;
    const startTime = Date.now();
    let currentRun = run;

    while (['queued', 'in_progress', 'cancelling'].includes(currentRun.status) && (Date.now() - startTime < pollingTimeout)) {
        console.log(`Run ${currentRun.id} está ${currentRun.status}. Esperando...`);
        await new Promise(resolve => setTimeout(resolve, pollingInterval));
        currentRun = await openai.beta.threads.runs.retrieve(threadId, currentRun.id);
    }

    if (['queued', 'in_progress', 'cancelling'].includes(currentRun.status)) {
        throw new Error(`Timeout esperando el run ${currentRun.id}. Último estado: ${currentRun.status}`);
    }

    switch (currentRun.status) {
        case "completed": {
            const messages = await openai.beta.threads.messages.list(threadId, { order: 'desc', run_id: currentRun.id });
            return messages.data;
        }

        case "requires_action": {
            return await handleRequiresAction(threadId, currentRun);
        }

        case "failed":
        case "cancelled":
        case "expired": {
            throw new Error(`El run terminó con estado "${currentRun.status}". Error: ${currentRun.last_error?.message}`);
        }

        default: {
            throw new Error(`Estado desconocido: ${currentRun.status} para el run ${currentRun.id}`);
        }
    }
};

/**
 * Crea un nuevo run para el assistant, hace polling de su estado y obtiene
 * la respuesta final si el run termina exitosamente.
 */
export const run = async (threadId: string, assistant: any): Promise<string> => {
    let finalResponseText = '';
    let runId: string | null = null;

    try {
        console.log(`Creando y haciendo polling del run para el assistant ${assistant.id} en el thread ${threadId}`);
        const initialRun = await openai.beta.threads.runs.createAndPoll(threadId, { assistant_id: assistant.id });
        runId = initialRun.id;

        const finalResult = await handleRunStatus(threadId, initialRun);
        if (Array.isArray(finalResult)) {
            const latestAssistantMessage = finalResult.find(msg =>
                msg.run_id === runId && msg.role === 'assistant' &&
                msg.content.some((content: any) => content.type === 'text')
            );

            if (latestAssistantMessage) {
                const textContent = latestAssistantMessage.content.find((content: any) => content.type === 'text');
                finalResponseText = textContent.text.value;
            }
        } else {
            throw new Error('Resultado inesperado del procesamiento del run.');
        }
    } catch (error) {
        console.error('Error durante el proceso del run:', error);
        throw error;
    }

    return finalResponseText;
};

/**
 * Envía un mensaje al assistant, crea un thread si es necesario y obtiene la respuesta.
 */
export const toAsk = async (assistantId: string, message: string, state: BotStateStandAlone) => {
    let thread = state.get('thread') ?? null;
    const assistant = { id: assistantId };

    if (!thread) {
        thread = (await createThread()).id;
        await state.update({ thread });
    }
    await addMessage(thread, message);
    const response = await run(thread, assistant);
    return response;
};
