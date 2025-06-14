export type ToolCall = {
  id: string;
  function: { name: string };
  [key: string]: any;
};

export type ToolOutput = {
  tool_call_id: string;
  output: string;
};

export const toolOutputHandlers: Record<string, (toolCall: ToolCall, provider?: any) => Promise<ToolOutput> | ToolOutput> = {

};

export async function getToolOutput(toolCall: ToolCall, provider?: any): Promise<ToolOutput> {
  const handler = toolOutputHandlers[toolCall.function.name];
  if (handler) return await handler(toolCall, provider);
  return {
    tool_call_id: toolCall.id,
    output: JSON.stringify({ status: "success", result: true }),
  };
}
