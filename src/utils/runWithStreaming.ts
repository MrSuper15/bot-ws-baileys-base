import { createThread, addMessage } from '@builderbot-plugins/openai-assistants';
import { OpenAI } from 'openai';
import { BotStateStandAlone } from "@builderbot/bot/dist/types";
import { getToolOutput } from './toolOutputHandlers';

const debug = false; 

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Ejecuta un run con streaming y maneja eventos de tool calls
export const runWithStreaming = async (threadId: string, assistant: any): Promise<string> => {
    let response = '';
    let runId: string | null = null;

    // Maneja eventos de required_action y envía tool outputs usando el método Stream
    async function handleRequiresAction(data: any, runId: string, threadId: string) {
        return new Promise<void>((resolve, reject) => {
            (async () => {
                try {
                    const toolCalls = data.required_action?.submit_tool_outputs?.tool_calls || [];
                    const toolOutputs = toolCalls.map(getToolOutput);
                    const stream = openai.beta.threads.runs.submitToolOutputsStream(
                        runId,
                        {
                            thread_id: threadId,
                            tool_outputs: toolOutputs,
                            stream: true
                        }
                    );
                    for await (const event of stream) {
                        if (event.event === 'thread.message.delta') {
                            const contentBlocks = event.data?.delta?.content ?? [];
                            for (const block of contentBlocks) {
                                if (block.type === 'text' && block.text?.value) {
                                    if (debug) console.log('[OpenAI][text.value]:', block.text.value);
                                    response += block.text.value;
                                }
                            }
                        }
                        if (event.event === 'thread.run.completed' || event.event === 'thread.run.failed') {
                            if (debug) console.log('[OpenAI][tool_output.completed] Mensaje completo:', response);
                            resolve();
                        }
                    }
                    resolve();
                } catch (error) {
                    reject(error);
                }
            })();
        });
    }

    let pendingRequiresAction: { data: any, runId: string, threadId: string } | null = null;
    let runInProgress = false;

    // Auxiliar para claridad: procesa el tool call solo si ambos flags están listos
    async function processPendingToolCallIfReady() {
        if (runInProgress && pendingRequiresAction) {
            await handleRequiresAction(
                pendingRequiresAction.data,
                pendingRequiresAction.runId,
                pendingRequiresAction.threadId
            );
            pendingRequiresAction = null;
        }
    }

    // Inicia el stream de eventos del assistant
    const stream = await openai.beta.threads.runs.stream(
        threadId,
        { assistant_id: assistant.id }
    );

    for await (const event of stream) {
        if (debug) console.log('[stream event type]:', event.event);
        if (event.event === 'thread.run.requires_action') {
            if (debug) console.log('[stream] Evento requires_action detectado, esperando respuesta de tool_outputs...');
            if (!runId) runId = event.data.id;
            pendingRequiresAction = { data: event.data, runId, threadId };
            await processPendingToolCallIfReady();
        }
        if (event.event === 'thread.run.in_progress') {
            runInProgress = true;
            await processPendingToolCallIfReady();
        }
        if (event.event === 'thread.message.delta') {
            const contentBlocks = event.data?.delta?.content ?? [];
            for (const block of contentBlocks) {
                if (block.type === 'text' && block.text?.value) {
                    response += block.text.value;
                }
            }
        }
        if (event.event === 'thread.message.completed') {
            if (debug) console.log('[stream][thread.message.completed] Mensaje completo:', response);
        }
    }
    return response;
};

// Envía un mensaje al assistant y obtiene la respuesta usando streaming
export const toAskWithStreaming = async (assistantId: string, message: string, state: BotStateStandAlone) => {
    let thread = state.get('thread') ?? null;
    const assistant = { id: assistantId };
    if (!thread) {
        thread = (await createThread()).id;
        await state.update({ thread });
    }
    await addMessage(thread, message);
    const response = await runWithStreaming(thread, assistant);
    return response;
};