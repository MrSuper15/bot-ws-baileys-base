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
export const toolOutputHandlers: Record<string, (toolCall: ToolCall) => ToolOutput> = {
  getCurrentTemperature: (toolCall) => ({
    tool_call_id: toolCall.id,
    output: "57",
  }),
  getRainProbability: (toolCall) => ({
    tool_call_id: toolCall.id,
    output: "0.06",
  })
};

// Obtiene la salida para un tool call dado
export function getToolOutput(toolCall: ToolCall): ToolOutput {
  const handler = toolOutputHandlers[toolCall.function.name];
  if (handler) return handler(toolCall);
  return {
    tool_call_id: toolCall.id,
    output: JSON.stringify({ status: "success", result: true }),
  };
}
