import { createThread, addMessage } from '@builderbot-plugins/openai-assistants';
import { OpenAI } from 'openai';
import { BotStateStandAlone } from "@builderbot/bot/dist/types";
import { saveLog } from '~/logs/saveLog';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
console.log('OpenAI API Key:', OPENAI_API_KEY ? 'Loaded' : 'Not Loaded');
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/**
 * Handles the 'requires_action' status of a run by processing tool calls,
 * submitting their outputs, and updating the run status.
 */
const handleRequiresAction = async (threadId: string, run: any): Promise<any> => {
    console.log('Handling requires_action...');
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
            console.log('Submitting tool outputs...');
            run = await openai.beta.threads.runs.submitToolOutputs(run.id, { thread_id: run.thread_id, tool_outputs: toolOutputs });
            console.log("Tool outputs submitted. New status:", run.status);
        }

        return handleRunStatus(threadId, run);
    } else {
        throw new Error(`No tool calls found for run ${run.id}.`);
    }
};

/**
 * Handles the status of a run, including polling for intermediate states
 * and processing final states such as 'completed' or 'requires_action'.
 */
const handleRunStatus = async (threadId: string, run: any): Promise<any> => {
    console.log('Handling run status:', run.status);

    const pollingInterval = 1500;
    const pollingTimeout = 120 * 1000;
    const startTime = Date.now();
    let currentRun = run;

    while (['queued', 'in_progress', 'cancelling'].includes(currentRun.status) && (Date.now() - startTime < pollingTimeout)) {
        console.log(`Run ${currentRun.id} is ${currentRun.status}. Polling...`);
        await new Promise(resolve => setTimeout(resolve, pollingInterval));
        currentRun = await openai.beta.threads.runs.retrieve(threadId, currentRun.id);
    }

    if (['queued', 'in_progress', 'cancelling'].includes(currentRun.status)) {
        throw new Error(`Polling timed out for run ${currentRun.id}. Last status: ${currentRun.status}`);
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
            throw new Error(`Run ended with status "${currentRun.status}". Error: ${currentRun.last_error?.message}`);
        }

        default: {
            throw new Error(`Unknown status: ${currentRun.status} for run ${currentRun.id}`);
        }
    }
};

/**
 * Creates a new run for the assistant, polls its status, and retrieves
 * the final response text if the run completes successfully.
 */
export const run = async (threadId: string, assistant: any): Promise<string> => {
    let finalResponseText = '';
    let runId: string | null = null;

    try {
        console.log(`Creating and polling run for assistant ${assistant.id} in thread ${threadId}`);
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
            throw new Error('Unexpected result from run processing.');
        }
    } catch (error) {
        console.error('Error during run process:', error);
        throw error;
    }

    return finalResponseText;
};

/**
 * Sends a message to the assistant, creates a thread if necessary,
 * and retrieves the assistant's response.
 */
export const toAsk = async (assistantId: string, message: string, state: BotStateStandAlone) => {
    let thread = state.get('thread') ?? null;
    const assistant = { id: assistantId };

    if (!thread) {
        thread = (await createThread()).id;
        await state.update({ thread });
    }

    await addMessage(thread, message);
    return await run(thread, assistant);
};
