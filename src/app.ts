import { join } from 'path'
import "dotenv/config"
import { createBot, createProvider, createFlow, addKeyword, utils, EVENTS } from '@builderbot/bot'
import { JsonFileDB as Database } from '@builderbot/database-json'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import { processUserMessage, processAudioUserMessage } from './utils/functions';
import { audioHandler } from './utils/audioHandler';
import { addQueueFlow, handleGenericQueue } from './utils/flowsHelper';

// Flujos
const aiFlow = addQueueFlow(EVENTS.WELCOME, processUserMessage);
const audioFlow = addQueueFlow(
    EVENTS.VOICE_NOTE,
    processAudioUserMessage,
    audioHandler,
    "¡Recibí tu mensaje de voz! Dame un momento para escuchar y responderte. 🔉🔉"
);

const mediaFlow = addKeyword<Provider, Database>(['schaufele'])
    .addAnswer(`Lecker 😋`, { media: join(process.cwd(), 'assets', 'schaufele.jpg') })

const PORT = process.env.PORT ?? 3010

const main = async () => {
    const adapterFlow = createFlow([aiFlow, audioFlow, mediaFlow])

    const adapterProvider = createProvider(Provider, {
        groupsIgnore: true,
        readStatus: false,
    })

    const adapterDB = new Database({ filename: 'db.json' })

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    adapterProvider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const { number, message, urlMedia } = req.body
            await bot.sendMessage(number, message, { media: urlMedia ?? null })
            return res.end('sended')
        })
    )

    adapterProvider.server.post(
        '/v1/register',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('REGISTER_FLOW', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/samples',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('SAMPLES', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/blacklist',
        handleCtx(async (bot, req, res) => {
            const { number, intent } = req.body
            if (intent === 'remove') bot.blacklist.remove(number)
            if (intent === 'add') bot.blacklist.add(number)

            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ status: 'ok', number, intent }))
        })
    )

    httpServer(+PORT)
}

main()
