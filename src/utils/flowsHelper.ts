import { addKeyword } from '@builderbot/bot';
import { userLocks, userQueues } from './functions';

// Función genérica de manejo de colas
export const handleGenericQueue = async (userId, processFn) => {
    const queue = userQueues.get(userId);
    if (userLocks.get(userId)) return;
    while (queue.length > 0) {
        userLocks.set(userId, true);
        const { ctx, flowDynamic, state, provider } = queue.shift();
        try {
            await processFn(ctx, { flowDynamic, state, provider });
        } catch (error) {
            console.error(`Error processing message for user ${userId}:`, error);
        } finally {
            userLocks.set(userId, false);
        }
    }
    userLocks.delete(userId);
    userQueues.delete(userId);
};

// Función auxiliar para crear flujos de encolado
export function addQueueFlow(event, processFn, preProcessFn = null, answer = null) {
    let flow = addKeyword(event);
    if (answer) flow = flow.addAnswer(answer);
    return flow.addAction(async (ctx, { flowDynamic, state, provider }) => {
        if (preProcessFn) {
            const text = await preProcessFn(ctx, provider);
            if (text) {
                ctx.body = text;
                if (process.env.DEBUG) console.log("Texto extraído:", text);
            }
        }
        const userId = ctx.from;
        if (!userQueues.has(userId)) {
            userQueues.set(userId, []);
        }
        const queue = userQueues.get(userId);
        queue.push({ ctx, flowDynamic, state, provider });
        if (!userLocks.get(userId) && queue.length === 1) {
            await handleGenericQueue(userId, processFn);
        }
    });
}
