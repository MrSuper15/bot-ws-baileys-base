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

/**
 * Extrae y parsea los argumentos de un toolCall de OpenAI.
 * Devuelve un objeto con los parámetros o {} si no existen o hay error de parseo.
 */
export function getToolCallArgs(toolCall: ToolCall): any {
  try {
    if (toolCall.function && typeof (toolCall.function as any).arguments === 'string') {
      return JSON.parse((toolCall.function as any).arguments);
    }
  } catch (e) {
    console.error('Error parsing toolCall arguments:', e);
  }
  return {};
}

// Handlers de salida para cada tool call
export const toolOutputHandlers: Record<string, (toolCall: ToolCall, flowDynamic?: any, ctx?: any, provider?: any) => Promise<ToolOutput> | ToolOutput> = {
  // Redirigir lead a ventas y enviar summary

};

/**
 * Obtiene la salida para un tool call dado.
 * Busca el handler adecuado y lo ejecuta, o responde por defecto.
 */
export async function getToolOutput(toolCall: ToolCall, flowDynamic?: any, ctx?: any, provider?: any): Promise<ToolOutput> {
  const handler = toolOutputHandlers[toolCall.function.name];
  if (handler) return await handler(toolCall, flowDynamic, ctx, provider);
  return {
    tool_call_id: toolCall.id,
    output: JSON.stringify({ status: "success", result: true }),
  };
}
