import { ToolCall, ToolOutput, getToolCallArgs } from '../toolOutputHandlers';

/**
 * Lógica para redirigir lead a ventas y enviar summary al agente.
 */
export async function redirectToSales(toolCall: ToolCall, flowDynamic: any, ctx: any, provider: any): Promise<ToolOutput> {
  try {
    if (!ctx || !provider) {
      return {
        tool_call_id: toolCall.id,
        output: JSON.stringify({ status: "error", message: "ctx o provider no definidos", contact: "contacto@ie.com" }),
      };
    }
    const SALES_AGENTS = [
      {
        name: 'Lissy Rojas',
        number: '584124212925',
        wa_link: 'http://wa.link/dun6e3'
      },
      {
        name: 'Claire Palacios',
        number: '584244057189',
        wa_link: 'http://wa.link/xx7res'
      },
      {
        name: 'Orianny Vera',
        number: '584244103482',
        wa_link: 'https://wa.link/1a3j8h'
      }
    ];
    // --- Selección equitativa de agente (round-robin) ---
    if (typeof global.salesAgentIndex !== 'number') global.salesAgentIndex = 0;
    const agent = SALES_AGENTS[global.salesAgentIndex];
    global.salesAgentIndex = (global.salesAgentIndex + 1) % SALES_AGENTS.length;

    // --- Datos del usuario ---
    const userNumber = ctx.from;
    const userName = ctx.pushName || ctx.name || userNumber;
    const userJid = userNumber.endsWith('@s.whatsapp.net') || userNumber.endsWith('@g.us')
      ? userNumber
      : `${userNumber}@s.whatsapp.net`;

    // --- vCard del usuario ---
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${userName}`,
      `TEL;type=CELL;type=VOICE;waid=${userNumber}:+${userNumber}`,
      'END:VCARD'
    ].join('\n');

    // --- JID del agente ---
    const agentJid = agent.number.endsWith('@s.whatsapp.net')
      ? agent.number
      : `${agent.number}@s.whatsapp.net`;

    // --- Enviar contacto y mensajes al agente ---
    await provider.vendor.sendMessage(agentJid, {
      contacts: {
        displayName: userName,
        contacts: [{ vcard }]
      }
    });
    await provider.vendor.sendMessage(agentJid, {
      text: `Nuevo lead asignado: ${userName} (+${userNumber})`
    });
    // --- Enviar el summary recibido desde OpenAI ---
    const args = getToolCallArgs(toolCall);
    const summary = args.summary || '';
    if (summary) {
      await provider.vendor.sendMessage(agentJid, {
        text: `Resumen de interés del cliente: ${summary}`
      });
    }
    return {
      tool_call_id: toolCall.id,
      output: JSON.stringify({ status: "success", message: "Los datos del usuario han sido enviados a un agente humano que lo contactará pronto.", redirected: true }),
    };
  } catch (err) {
    return {
      tool_call_id: toolCall.id,
      output: JSON.stringify({ status: "error", message: "Ocurrió un error. Por favor, indícale al usuario que algo salió mal, pero aún puede contactarnos en info@insigniaeducation.com", error: err?.message || String(err) }),
    };
  }
}
