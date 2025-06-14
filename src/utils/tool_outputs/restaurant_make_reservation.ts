import { ToolCall, ToolOutput } from '../toolOutputHandlers'

// Handler asíncrono para procesar la reservación y enviar alerta por WhatsApp
export async function restaurantMakeReservationHandler(toolCall: ToolCall, provider: any): Promise<ToolOutput> {
  try {
    if (!provider) {
      return {
        tool_call_id: toolCall.id,
        output: JSON.stringify({ status: "error", message: "Provider no definido" }),
      };
    }
    // El número de WhatsApp destino para la alerta
    const ALERT_NUMBER = '584248778622'; // Cambia este número si lo necesitas
    const alertJid = ALERT_NUMBER.endsWith('@s.whatsapp.net') ? ALERT_NUMBER : `${ALERT_NUMBER}@s.whatsapp.net`;

    // Los datos de la reservación vienen en toolCall.arguments o toolCall.args
    let args: any = {};
    if (toolCall.arguments) {
      try {
        args = typeof toolCall.arguments === 'string' ? JSON.parse(toolCall.arguments) : toolCall.arguments;
      } catch (e) {
        // Si ocurre un error al parsear, args se mantiene como objeto vacío
      }
    } else if (toolCall.args) {
      args = toolCall.args;
    }
    const { date, time, name, number_of_people, special_requests } = args;

    const alertMsg = `\uD83C\uDF74 *Nueva reservación de restaurante*\n\n*Nombre:* ${name}\n*Fecha:* ${date}\n*Hora:* ${time}\n*Número de personas:* ${number_of_people}\n*Solicitudes especiales:* ${special_requests || 'Ninguna'}\n`;

    await provider.vendor.sendMessage(alertJid, { text: alertMsg });

    return {
      tool_call_id: toolCall.id,
      output: JSON.stringify({ status: "success", message: "Reservación procesada y alerta enviada por WhatsApp." }),
    };
  } catch (err) {
    return {
      tool_call_id: toolCall.id,
      output: JSON.stringify({ status: "error", message: "Ocurrió un error al procesar la reservación.", error: err?.message || String(err) }),
    };
  }
}
