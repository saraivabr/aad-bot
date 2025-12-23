/**
 * CONVERSATION ORCHESTRATOR v2.0
 *
 * Orquestra toda a experiência conversacional integrando:
 * - ConversationalEngine (processamento principal)
 * - SemanticMemoryStore (memória de longo prazo)
 * - VoiceIntelligence (processamento de áudio)
 * - MediaService (geração de mídia)
 * - ClientService (persistência de dados)
 *
 * Features:
 * - Processamento unificado de mensagens
 * - Respostas adaptativas (texto/áudio/híbrido)
 * - Fragmentação natural de mensagens
 * - Timing humanizado
 * - Proactive engagement
 * - Smart message buffering
 */

const conversationalEngine = require('./conversationalEngine');
const { SemanticMemoryStore, MEMORY_TYPES, IMPORTANCE_LEVELS } = require('./semanticMemory');
const clientService = require('../services/clientService');

// Lazy load services that require API keys
let voiceIntelligence = null;
let mediaService = null;

function getVoiceIntelligence() {
    if (!voiceIntelligence) {
        voiceIntelligence = require('../services/voiceIntelligence');
    }
    return voiceIntelligence;
}

function getMediaService() {
    if (!mediaService) {
        mediaService = require('../services/mediaService');
    }
    return mediaService;
}

// ============================================
// RESPONSE FORMATTER
// ============================================

class ResponseFormatter {
    constructor() {
        this.fragmentPatterns = {
            // Pontos naturais de quebra
            naturalBreaks: [
                /([.!?])\s+(?=[A-ZÀ-Ú])/g,  // Fim de frase seguido de maiúscula
                /(<SPLIT>)/g,                 // Tag explícita
            ],
            // Padrões que NÃO devem ser quebrados
            keepTogether: [
                /https?:\/\/\S+/g,            // URLs
                /\d+[.,]\d+/g,                // Números decimais
            ]
        };
    }

    /**
     * Fragmenta resposta em mensagens naturais
     */
    fragment(text, maxFragments = 4) {
        // Primeiro, processa <SPLIT> explícitos
        if (text.includes('<SPLIT>')) {
            return text
                .split('<SPLIT>')
                .map(f => f.trim())
                .filter(f => f.length > 0)
                .slice(0, maxFragments);
        }

        // Fragmentação automática baseada em pontuação
        const sentences = text.split(/(?<=[.!?])\s+/);

        if (sentences.length <= 2) {
            return [text]; // Mensagem curta, não fragmentar
        }

        // Agrupar sentenças em fragmentos lógicos
        const fragments = [];
        let currentFragment = '';

        for (const sentence of sentences) {
            // Se adicionar a sentença deixar muito longo, criar novo fragmento
            if (currentFragment.length + sentence.length > 200 && currentFragment.length > 0) {
                fragments.push(currentFragment.trim());
                currentFragment = sentence;
            } else {
                currentFragment += (currentFragment ? ' ' : '') + sentence;
            }

            // Limite de fragmentos
            if (fragments.length >= maxFragments - 1) {
                break;
            }
        }

        if (currentFragment) {
            fragments.push(currentFragment.trim());
        }

        return fragments.slice(0, maxFragments);
    }

    /**
     * Calcula tempo de digitação humanizado
     */
    calculateTypingTime(text, userPace = 'normal') {
        const baseSpeed = {
            fast: 20,     // 20ms por caractere
            normal: 35,   // 35ms por caractere
            slow: 50      // 50ms por caractere
        }[userPace] || 35;

        const baseTime = text.length * baseSpeed;

        // Adicionar variação aleatória (±20%)
        const variation = baseTime * 0.2 * (Math.random() - 0.5);

        // Limites: min 800ms, max 4000ms
        return Math.min(Math.max(baseTime + variation, 800), 4000);
    }

    /**
     * Calcula delay entre mensagens
     */
    calculateInterMessageDelay() {
        // Entre 300ms e 800ms, distribuição natural
        return 300 + Math.random() * 500;
    }

    /**
     * Remove formatação para TTS
     */
    prepareForTTS(text) {
        return text
            .replace(/<SPLIT>/g, '... ')
            .replace(/<REACT:.*?>/g, '')
            .replace(/\|\|.*?\|\|/g, '')
            .replace(/[🔥💪🚀🎉👏✌️👋😤💭🤔💜❤️🙏⚡💡👀✨😊🤗]/g, '')
            .replace(/\*\*/g, '')
            .replace(/\n+/g, '. ')
            .trim();
    }
}

// ============================================
// MESSAGE BUFFER
// ============================================

class MessageBuffer {
    constructor() {
        this.buffers = new Map(); // chatId -> { messages: [], timer: timeout, voiceContext: {} }
        this.bufferTimeout = 3500; // 3.5 segundos
    }

    add(chatId, message, voiceContext = null) {
        if (!this.buffers.has(chatId)) {
            this.buffers.set(chatId, {
                messages: [],
                timer: null,
                voiceContext: null,
                firstMessageTime: Date.now()
            });
        }

        const buffer = this.buffers.get(chatId);

        // Limpar timer anterior
        if (buffer.timer) {
            clearTimeout(buffer.timer);
        }

        // Adicionar mensagem
        buffer.messages.push(message);

        // Atualizar contexto de voz se presente
        if (voiceContext) {
            buffer.voiceContext = voiceContext;
        }

        return buffer;
    }

    setCallback(chatId, callback) {
        const buffer = this.buffers.get(chatId);
        if (!buffer) return;

        buffer.timer = setTimeout(async () => {
            const fullMessage = buffer.messages.join(' ').trim();
            const voiceContext = buffer.voiceContext;

            // Limpar buffer
            this.buffers.delete(chatId);

            // Executar callback
            await callback(fullMessage, voiceContext);
        }, this.bufferTimeout);
    }

    getCombinedMessage(chatId) {
        const buffer = this.buffers.get(chatId);
        if (!buffer) return null;

        return {
            text: buffer.messages.join(' ').trim(),
            voiceContext: buffer.voiceContext,
            messageCount: buffer.messages.length,
            timeSinceFirst: Date.now() - buffer.firstMessageTime
        };
    }

    clear(chatId) {
        const buffer = this.buffers.get(chatId);
        if (buffer?.timer) {
            clearTimeout(buffer.timer);
        }
        this.buffers.delete(chatId);
    }
}

// ============================================
// MAIN ORCHESTRATOR
// ============================================

class ConversationOrchestrator {
    constructor() {
        this.formatter = new ResponseFormatter();
        this.buffer = new MessageBuffer();
        this.processingChats = new Set(); // Evita processamento duplicado
    }

    /**
     * Processa uma mensagem de entrada
     * Retorna um objeto com instruções de resposta
     */
    async processMessage(messageObj, chatId) {
        // Evitar processamento duplicado
        if (this.processingChats.has(chatId)) {
            console.log(`[Orchestrator] Chat ${chatId} already processing, buffering...`);
            return null;
        }

        try {
            this.processingChats.add(chatId);

            // 1. Extrair dados da mensagem
            const messageData = await this.extractMessageData(messageObj);

            // 2. Processar com o engine
            const result = await conversationalEngine.processMessage(
                chatId,
                messageData.text,
                messageData.voiceContext,
                messageData.contactName
            );

            // 3. Armazenar memórias semânticas
            await this.storeMemories(chatId, messageData.text, result.state);

            // 4. Sincronizar dados do cliente
            this.syncClientData(chatId, result.state.userProfile);

            // 5. Preparar resposta formatada
            const response = await this.prepareResponse(result, messageData, chatId);

            return response;

        } finally {
            this.processingChats.delete(chatId);
        }
    }

    /**
     * Extrai dados da mensagem (texto, mídia, contexto)
     */
    async extractMessageData(messageObj) {
        let text = messageObj.body?.trim() || '';
        let voiceContext = null;
        let contactName = null;

        // Obter nome do contato
        try {
            const contact = await messageObj.getContact();
            contactName = contact?.pushname || contact?.name || null;
        } catch (e) {
            console.log("[Orchestrator] Could not get contact name");
        }

        // Processar mídia se presente
        if (messageObj.hasMedia) {
            try {
                const media = await messageObj.downloadMedia();

                if (media.mimetype.startsWith('audio/') || messageObj.type === 'ptt') {
                    // Áudio -> Transcrição + Análise
                    voiceContext = await getVoiceIntelligence().transcribeWithContext(media);
                    text = voiceContext.text;
                    getVoiceIntelligence().recordAudioReceived(messageObj.from);

                } else if (media.mimetype.startsWith('image/')) {
                    // Imagem -> Descrição
                    const description = await getMediaService().describeImage(media);
                    text = `[Imagem recebida]: ${description}`;
                }
            } catch (e) {
                console.error("[Orchestrator] Media processing error:", e.message);
            }
        }

        return { text, voiceContext, contactName };
    }

    /**
     * Armazena memórias relevantes da interação
     */
    async storeMemories(chatId, message, state) {
        try {
            // Extração automática de memórias
            await SemanticMemoryStore.extractAndStore(chatId, message, {
                emotion: state.emotionalState.primary,
                intensity: state.emotionalState.intensity
            });

            // Armazenar se houve conquista
            if (state.currentIntent?.primary?.intent === 'share_achievement') {
                await SemanticMemoryStore.store(
                    chatId,
                    `Conquista compartilhada: ${message.substring(0, 100)}`,
                    {
                        type: MEMORY_TYPES.EPISODIC,
                        importance: IMPORTANCE_LEVELS.HIGH,
                        emotion: 'excited'
                    }
                );
            }

        } catch (e) {
            console.error("[Orchestrator] Memory storage error:", e.message);
        }
    }

    /**
     * Sincroniza dados do userProfile com clientService
     */
    syncClientData(chatId, userProfile) {
        const updates = {};

        if (userProfile.name) updates.name = userProfile.name;
        if (userProfile.business) updates.businessName = userProfile.business;
        if (userProfile.niche) updates.niche = userProfile.niche;
        if (userProfile.location) updates.location = userProfile.location;

        if (Object.keys(updates).length > 0) {
            clientService.updateClient(chatId, updates);
        }
    }

    /**
     * Prepara a resposta formatada para envio
     */
    async prepareResponse(result, messageData, chatId) {
        const { response, actions, reaction, state, metadata } = result;

        // 1. Fragmentar resposta
        const fragments = this.formatter.fragment(response);

        // 2. Calcular timings
        const timings = fragments.map(f => ({
            text: f,
            typingTime: this.formatter.calculateTypingTime(f),
            interDelay: this.formatter.calculateInterMessageDelay()
        }));

        // 3. Determinar se deve responder com áudio
        const shouldUseAudio = this.shouldRespondWithAudio(messageData, state);

        // 4. Preparar áudio se necessário
        let audioResponse = null;
        if (shouldUseAudio) {
            const textForTTS = this.formatter.prepareForTTS(response);
            audioResponse = {
                text: textForTTS,
                emotion: state.emotionalState.primary,
                persona: state.activePersona
            };
        }

        // 5. Processar ações especiais
        const mediaActions = await this.processActions(actions);

        // 6. Construir resposta final
        return {
            type: shouldUseAudio ? 'hybrid' : 'text',
            fragments: timings,
            audio: audioResponse,
            reaction: reaction,
            mediaActions,
            metadata: {
                ...metadata,
                shouldSendTyping: true,
                shouldSendRecording: shouldUseAudio
            }
        };
    }

    /**
     * Determina se deve responder com áudio
     */
    shouldRespondWithAudio(messageData, state) {
        // Se veio de áudio e contexto sugere
        if (messageData.voiceContext?.shouldRespondWithAudio) {
            return true;
        }

        // Se usuário prefere áudio (baseado em histórico)
        if (state.userProfile.responsePreference === 'audio') {
            return true;
        }

        // Não responder com áudio se não tiver API key
        if (!process.env.OPENAI_API_KEY) {
            return false;
        }

        // Se emoção é intensa e negativa (empatia via voz)
        if (['sad', 'frustrated'].includes(state.emotionalState.primary) &&
            state.emotionalState.intensity > 0.6) {
            return true;
        }

        return false;
    }

    /**
     * Processa ações especiais (imagem, áudio, etc)
     */
    async processActions(actions) {
        const mediaActions = [];

        for (const action of actions) {
            switch (action.type) {
                case 'generate_image':
                    mediaActions.push({
                        type: 'image',
                        promise: getMediaService().generateImage(action.prompt),
                        caption: 'tá na mão 🍌'
                    });
                    break;

                case 'send_audio':
                    mediaActions.push({
                        type: 'audio',
                        promise: getMediaService().textToSpeech(action.text)
                    });
                    break;

                case 'save':
                    // Já processado pelo engine
                    break;
            }
        }

        return mediaActions;
    }

    /**
     * Executa o envio da resposta via WhatsApp
     * Esta função é chamada pelo commandDispatcher
     */
    async executeResponse(messageObj, response) {
        const chat = await messageObj.getChat();
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        // 1. Enviar reação se sugerida
        if (response.reaction) {
            try {
                await messageObj.react(response.reaction);
            } catch (e) {
                console.log("[Orchestrator] Reaction failed:", e.message);
            }
        }

        // 2. Enviar fragmentos de texto
        for (const [index, fragment] of response.fragments.entries()) {
            // Mostrar "digitando..."
            if (response.metadata.shouldSendTyping) {
                await chat.sendStateTyping();
            }

            // Aguardar tempo de digitação
            await delay(fragment.typingTime);

            // Enviar mensagem
            if (index === 0) {
                await messageObj.reply(fragment.text);
            } else {
                await chat.sendMessage(fragment.text);
            }

            // Delay entre mensagens
            if (index < response.fragments.length - 1) {
                await delay(fragment.interDelay);
            }
        }

        // 3. Enviar áudio se necessário
        if (response.audio) {
            await delay(800);
            await chat.sendRecordingState();

            const audioMedia = await getVoiceIntelligence().generateVoiceResponse(
                response.audio.text,
                response.audio.emotion,
                response.audio.persona
            );

            if (audioMedia) {
                await delay(1500);
                await chat.sendMessage(audioMedia, { sendAudioAsVoice: true });
            }
        }

        // 4. Enviar mídia gerada
        for (const action of response.mediaActions) {
            await delay(500);

            if (action.type === 'image') {
                await chat.sendStateTyping();
                const media = await action.promise;
                if (media) {
                    await chat.sendMessage(media, { caption: action.caption });
                }
            } else if (action.type === 'audio') {
                await chat.sendRecordingState();
                const media = await action.promise;
                if (media) {
                    await chat.sendMessage(media, { sendAudioAsVoice: true });
                }
            }
        }
    }

    /**
     * Obtém estatísticas do chat
     */
    getStats(chatId) {
        const engineStats = conversationalEngine.getStats(chatId);
        const memoryStats = SemanticMemoryStore.summarize(chatId);

        return {
            ...engineStats,
            memory: memoryStats
        };
    }

    /**
     * Reseta um chat completamente
     */
    resetChat(chatId) {
        conversationalEngine.resetChat(chatId);
        SemanticMemoryStore.forgetAll(chatId);
        this.buffer.clear(chatId);
    }
}

module.exports = new ConversationOrchestrator();
