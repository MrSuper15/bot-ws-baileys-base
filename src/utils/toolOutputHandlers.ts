import { sendMediaToFlow } from './functions';
import { join } from 'path';

// Tipos para tool calls y outputs
export type ToolCall = {
  id: string;
  function: { name: string };
  [key: string]: any;
};

export type ToolOutput = {
  tool_call_id: string;
  output: string;
};

// Manejadores de salida para cada tool call
export const toolOutputHandlers: Record<string, (toolCall: ToolCall, flowDynamic?: any) => Promise<ToolOutput> | ToolOutput> = {
  getCurrentTemperature: (toolCall) => ({
    tool_call_id: toolCall.id,
    output: "57",
  }),
  getRainProbability: (toolCall) => ({
    tool_call_id: toolCall.id,
    output: "0.06",
  }),
  // Ejemplo: enviar una imagen de menú
  sendMenuImage: async (toolCall, flowDynamic) => {
    const imagePath = join(process.cwd(), 'assets', 'salad.jpg'); 
    if (flowDynamic) {
      await sendMediaToFlow(flowDynamic, imagePath);
    }
    return {
      tool_call_id: toolCall.id,
      output: JSON.stringify({ status: "success", mediaSent: imagePath }),
    };
  }
};

// Obtiene la salida para un tool call dado
export async function getToolOutput(toolCall: ToolCall, flowDynamic?: any): Promise<ToolOutput> {
  const handler = toolOutputHandlers[toolCall.function.name];
  if (handler) return await handler(toolCall, flowDynamic);
  return {
    tool_call_id: toolCall.id,
    output: JSON.stringify({ status: "success", result: true }),
  };
}
