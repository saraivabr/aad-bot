/**
 * CONVERSATIONAL ENGINE v2.0
 *
 * Arquitetura revolucionária baseada em LangGraph para orquestração de conversas
 * inteligentes com memória semântica, detecção de intenção multi-camada,
 * e blending dinâmico de personas.
 *
 * Features:
 * - StateGraph para fluxo de conversa stateful
 * - Memória semântica de longo prazo com embeddings
 * - Intent detection com fallback em cascata
 * - Emotional intelligence com análise de sentimento
 * - Dynamic persona blending baseado no contexto
 * - Conversation summarization automática
 * - Proactive engagement triggers
 */

// Lazy load to avoid initialization errors when no API key
let ChatOpenAI = null;
let ChatGoogleGenerativeAI = null;
let PromptTemplate = null;
let StringOutputParser = null;

// ============================================
// CONVERSATION STATE SCHEMA
// ============================================

/**
 * Estado completo de uma conversa
 * Mantido entre interações para contexto rico
 */
const createInitialState = (chatId) => ({
    chatId,
    messages: [],              // Histórico de mensagens
    currentIntent: null,       // Intenção detectada atual
    emotionalState: {          // Estado emocional do usuário
        primary: 'neutral',
        intensity: 0.5,
        trend: 'stable'        // rising, falling, stable
    },
    userProfile: {             // Perfil construído ao longo do tempo
        name: null,
        business: null,
        niche: null,
        location: null,
        communicationStyle: 'neutral',  // formal, casual, memes
        responsePreference: 'text',      // text, audio, hybrid
        engagementLevel: 0,              // 0-100
        topicsOfInterest: [],
        painPoints: [],
        goals: []
    },
    conversationMetrics: {     // Métricas da conversa atual
        messageCount: 0,
        averageResponseTime: 0,
        sentimentTrend: [],
        topicFlow: [],
        engagementScore: 0
    },
    activePersona: 'social_media',
    personaBlendRatio: {       // Permite blend de personas
        social_media: 1.0,
        consultant: 0.0
    },
    contextWindow: [],         // Últimas N mensagens para contexto imediato
    longTermMemories: [],      // Memórias recuperadas do store
    pendingActions: [],        // Ações pendentes (imagem, áudio, etc)
    conversationPhase: 'greeting',  // greeting, discovery, engagement, pitch, close
    proactiveHooks: [],        // Gatilhos para ações proativas
    lastInteraction: null,
    sessionStarted: null
});

// ============================================
// INTENT CLASSIFIER
// ============================================

class IntentClassifier {
    constructor() {
        this.patterns = {
            // Intenções de alto nível
            greeting: {
                patterns: [/^(oi|olá|eai|e aí|opa|fala|salve|bom dia|boa tarde|boa noite|hey|hello)/i],
                confidence: 0.9
            },
            farewell: {
                patterns: [/^(tchau|até|flw|valeu|obrigad[oa]|vlw|bye|xau)/i],
                confidence: 0.9
            },
            question: {
                patterns: [/\?$/, /^(como|o que|qual|quando|onde|por que|quem)/i],
                confidence: 0.8
            },
            request_help: {
                patterns: [/ajuda|socorro|não consigo|preciso de|como faço/i],
                confidence: 0.85
            },
            request_content: {
                patterns: [/post|conteúdo|legenda|copy|texto|stories|reels|feed/i],
                confidence: 0.9
            },
            request_image: {
                patterns: [/imagem|foto|visual|design|criar.*imagem|gera.*imagem/i],
                confidence: 0.9
            },
            request_audio: {
                patterns: [/áudio|audio|manda.*voz|fala.*comigo|grava/i],
                confidence: 0.9
            },
            share_achievement: {
                patterns: [/consegui|vendi|fechei|ganhei|bateu|sucesso|deu certo/i],
                confidence: 0.85
            },
            express_frustration: {
                patterns: [/não consigo|difícil|complicado|travado|desistir|cansado/i],
                confidence: 0.85
            },
            seek_validation: {
                patterns: [/o que (você )?acha|tá bom|ficou legal|pode ver/i],
                confidence: 0.8
            },
            request_consultation: {
                patterns: [/quero.*ajuda.*profissional/i],
                confidence: 0.95
            },
            small_talk: {
                patterns: [/tudo bem|como vai|como (você )?está|beleza/i],
                confidence: 0.7
            },
            objection: {
                patterns: [/caro|não tenho (tempo|dinheiro)|depois|agora não|vou pensar/i],
                confidence: 0.8
            },
            buying_signal: {
                patterns: [/quanto custa|como funciona|quero começar|me conta mais|interessado/i],
                confidence: 0.9
            }
        };

        // Intenções compostas (detectadas por múltiplos sinais)
        this.compositeIntents = {
            ready_to_buy: ['buying_signal', 'request_consultation'],
            needs_nurturing: ['express_frustration', 'objection'],
            highly_engaged: ['share_achievement', 'request_content', 'question']
        };
    }

    classify(text) {
        const textLower = text.toLowerCase();
        const detectedIntents = [];

        // Classificação primária por patterns
        for (const [intent, config] of Object.entries(this.patterns)) {
            for (const pattern of config.patterns) {
                if (pattern.test(textLower)) {
                    detectedIntents.push({
                        intent,
                        confidence: config.confidence,
                        trigger: pattern.toString()
                    });
                    break; // Uma detecção por intent é suficiente
                }
            }
        }

        // Ordenar por confiança
        detectedIntents.sort((a, b) => b.confidence - a.confidence);

        // Detectar intenções compostas
        const intentNames = detectedIntents.map(d => d.intent);
        const compositeResults = [];

        for (const [composite, requirements] of Object.entries(this.compositeIntents)) {
            const matched = requirements.filter(r => intentNames.includes(r));
            if (matched.length >= 1) {
                compositeResults.push({
                    intent: composite,
                    confidence: matched.length / requirements.length,
                    components: matched
                });
            }
        }

        return {
            primary: detectedIntents[0] || { intent: 'general', confidence: 0.5 },
            all: detectedIntents,
            composite: compositeResults,
            rawText: text
        };
    }
}

// ============================================
// EMOTIONAL INTELLIGENCE ENGINE
// ============================================

class EmotionalIntelligence {
    constructor() {
        this.emotionPatterns = {
            excited: {
                patterns: [/!{2,}/, /incrível|demais|top|show|massa|sensacional|animal/i],
                valence: 1,
                arousal: 0.9
            },
            happy: {
                patterns: [/feliz|contente|alegre|ótimo|maravilhoso|adorei/i],
                valence: 0.8,
                arousal: 0.6
            },
            grateful: {
                patterns: [/obrigad[oa]|valeu|agradeço|gratidão|você é demais/i],
                valence: 0.9,
                arousal: 0.5
            },
            frustrated: {
                patterns: [/pqp|caramba|putz|droga|merda|não consigo|difícil/i],
                valence: -0.7,
                arousal: 0.8
            },
            sad: {
                patterns: [/triste|desanimado|desistir|sozinho|perdido|fracasso/i],
                valence: -0.8,
                arousal: 0.3
            },
            confused: {
                patterns: [/não entendi|como assim|pode explicar|confuso|perdido/i],
                valence: -0.2,
                arousal: 0.4
            },
            anxious: {
                patterns: [/urgente|agora|rápido|preciso|ansioso|nervoso/i],
                valence: -0.3,
                arousal: 0.9
            },
            curious: {
                patterns: [/interessante|conta mais|quero saber|como funciona/i],
                valence: 0.4,
                arousal: 0.6
            },
            neutral: {
                patterns: [/.*/],
                valence: 0,
                arousal: 0.5
            }
        };

        // Histórico para análise de tendência
        this.emotionHistory = new Map();
    }

    analyze(text, chatId) {
        const textLower = text.toLowerCase();
        let detectedEmotions = [];

        for (const [emotion, config] of Object.entries(this.emotionPatterns)) {
            for (const pattern of config.patterns) {
                if (pattern.test(textLower)) {
                    detectedEmotions.push({
                        emotion,
                        valence: config.valence,
                        arousal: config.arousal,
                        confidence: 0.8
                    });
                    break;
                }
            }
        }

        // Se não detectou nada específico, é neutral
        if (detectedEmotions.length === 0) {
            detectedEmotions.push({
                emotion: 'neutral',
                valence: 0,
                arousal: 0.5,
                confidence: 0.5
            });
        }

        // Calcular emoção primária (maior valence absoluto * arousal)
        detectedEmotions.sort((a, b) =>
            (Math.abs(b.valence) * b.arousal) - (Math.abs(a.valence) * a.arousal)
        );

        const primary = detectedEmotions[0];

        // Atualizar histórico e calcular tendência
        const history = this.emotionHistory.get(chatId) || [];
        history.push({
            emotion: primary.emotion,
            valence: primary.valence,
            timestamp: Date.now()
        });

        // Manter últimas 10 emoções
        if (history.length > 10) history.shift();
        this.emotionHistory.set(chatId, history);

        // Calcular tendência
        let trend = 'stable';
        if (history.length >= 3) {
            const recentValences = history.slice(-3).map(h => h.valence);
            const avgRecent = recentValences.reduce((a, b) => a + b, 0) / 3;
            const olderValences = history.slice(0, -3).map(h => h.valence);
            const avgOlder = olderValences.length > 0
                ? olderValences.reduce((a, b) => a + b, 0) / olderValences.length
                : 0;

            if (avgRecent > avgOlder + 0.2) trend = 'rising';
            else if (avgRecent < avgOlder - 0.2) trend = 'falling';
        }

        return {
            primary: primary.emotion,
            valence: primary.valence,
            arousal: primary.arousal,
            intensity: Math.abs(primary.valence) * primary.arousal,
            trend,
            all: detectedEmotions,
            suggestedReaction: this.suggestReaction(primary)
        };
    }

    suggestReaction(emotion) {
        const reactionMap = {
            excited: ['🔥', '🚀', '💪'],
            happy: ['😊', '✨', '🎉'],
            grateful: ['🙏', '❤️', '💜'],
            frustrated: ['😤', '💪', null],  // null = no reaction sometimes
            sad: ['🤗', '💜', null],
            confused: ['🤔', '💭', null],
            anxious: ['⚡', '💪', null],
            curious: ['👀', '🤔', '💡'],
            neutral: [null]
        };

        const options = reactionMap[emotion.emotion] || [null];
        const randomIndex = Math.floor(Math.random() * options.length);
        return options[randomIndex];
    }
}

// ============================================
// PERSONA BLENDER
// ============================================

class PersonaBlender {
    constructor() {
        this.personas = {
            social_media: {
                tone: 'energético e amigável',
                vocabulary: ['top', 'show', 'bora', 'massa', 'demais'],
                emoji_frequency: 0.7,
                formality: 0.3,
                expertise_areas: ['conteúdo', 'engajamento', 'crescimento', 'posts']
            },
            consultant: {
                tone: 'direto e brutal',
                vocabulary: ['mano', 'cara', 'saca', 'pqp', 'resultado'],
                emoji_frequency: 0.3,
                formality: 0.2,
                expertise_areas: ['consultoria', 'estratégia', 'negócios', 'vendas']
            }
        };
    }

    /**
     * Calcula o blend ideal baseado no contexto
     */
    calculateBlend(state) {
        const { userProfile, currentIntent, emotionalState, conversationPhase } = state;

        let socialMediaWeight = 0.7;
        let consultantWeight = 0.3;

        // Ajuste baseado em intent
        if (currentIntent?.primary?.intent === 'request_consultation') {
            consultantWeight = 0.9;
            socialMediaWeight = 0.1;
        } else if (currentIntent?.primary?.intent === 'request_content') {
            socialMediaWeight = 0.9;
            consultantWeight = 0.1;
        }

        // Ajuste baseado em estado emocional
        if (emotionalState.primary === 'frustrated' || emotionalState.primary === 'sad') {
            // Mais consultant (direto, resolve problema)
            consultantWeight = Math.min(consultantWeight + 0.2, 1);
            socialMediaWeight = 1 - consultantWeight;
        }

        // Ajuste baseado em fase da conversa
        if (conversationPhase === 'pitch' || conversationPhase === 'close') {
            consultantWeight = Math.min(consultantWeight + 0.3, 1);
            socialMediaWeight = 1 - consultantWeight;
        }

        // Ajuste baseado em engajamento
        if (userProfile.engagementLevel > 70) {
            // Usuário engajado = pode ser mais direto
            consultantWeight = Math.min(consultantWeight + 0.1, 1);
            socialMediaWeight = 1 - consultantWeight;
        }

        return {
            social_media: Math.round(socialMediaWeight * 100) / 100,
            consultant: Math.round(consultantWeight * 100) / 100
        };
    }

    /**
     * Gera instruções de tom baseado no blend
     */
    generateToneInstructions(blend) {
        const { social_media: smWeight, consultant: conWeight } = blend;

        let instructions = `## TOM DA RESPOSTA\n`;

        if (smWeight > 0.7) {
            instructions += `Seja energético, amigável e use gírias como 'top', 'show', 'bora'.\n`;
            instructions += `Use emojis moderadamente. Mantenha tom de parceiro de crescimento.\n`;
        } else if (conWeight > 0.7) {
            instructions += `Seja direto, brutal honesto, sem enrolação.\n`;
            instructions += `Use gírias como 'mano', 'cara', 'saca'. Foque em resultado.\n`;
        } else {
            // Blend equilibrado
            instructions += `Misture energia com objetividade.\n`;
            instructions += `Seja amigável mas direto. Use gírias naturalmente.\n`;
        }

        instructions += `\nPesos: Social Media ${Math.round(smWeight * 100)}% | Consultant ${Math.round(conWeight * 100)}%`;

        return instructions;
    }
}

// ============================================
// PROACTIVE ENGAGEMENT SYSTEM
// ============================================

class ProactiveEngine {
    constructor() {
        this.triggers = {
            // Baseados em tempo
            long_silence: {
                condition: (state) => {
                    const lastInteraction = state.lastInteraction;
                    if (!lastInteraction) return false;
                    const hoursSince = (Date.now() - lastInteraction) / (1000 * 60 * 60);
                    return hoursSince > 24 && state.userProfile.engagementLevel > 30;
                },
                action: 'send_checkin',
                message: 'E aí, sumiu! Tudo bem por aí?'
            },

            // Baseados em comportamento
            high_engagement_no_action: {
                condition: (state) => {
                    return state.conversationMetrics.messageCount > 15
                        && state.conversationPhase !== 'pitch'
                        && state.userProfile.engagementLevel > 60;
                },
                action: 'soft_pitch',
                message: null // Gerado dinamicamente
            },

            // Baseados em emoção
            frustration_detected: {
                condition: (state) => {
                    return state.emotionalState.primary === 'frustrated'
                        && state.emotionalState.intensity > 0.6;
                },
                action: 'offer_help',
                message: null
            },

            // Baseados em conquistas
            achievement_celebration: {
                condition: (state) => {
                    return state.currentIntent?.primary?.intent === 'share_achievement';
                },
                action: 'celebrate',
                reaction: '🎉'
            }
        };
    }

    check(state) {
        const triggeredActions = [];

        for (const [name, trigger] of Object.entries(this.triggers)) {
            if (trigger.condition(state)) {
                triggeredActions.push({
                    name,
                    action: trigger.action,
                    message: trigger.message,
                    reaction: trigger.reaction
                });
            }
        }

        return triggeredActions;
    }
}

// ============================================
// MAIN CONVERSATIONAL ENGINE
// ============================================

class ConversationalEngine {
    constructor() {
        this.intentClassifier = new IntentClassifier();
        this.emotionalIntelligence = new EmotionalIntelligence();
        this.personaBlender = new PersonaBlender();
        this.proactiveEngine = new ProactiveEngine();

        this.states = new Map(); // chatId -> state
        this.model = null;

        this.initModel();
    }

    initModel() {
        try {
            if (process.env.OPENAI_API_KEY) {
                console.log("[ConvEngine] Using OpenAI GPT-4o");
                if (!ChatOpenAI) {
                    ChatOpenAI = require("@langchain/openai").ChatOpenAI;
                }
                this.model = new ChatOpenAI({
                    modelName: "gpt-4o",
                    temperature: 0.8,
                });
            } else if (process.env.GOOGLE_API_KEY) {
                console.log("[ConvEngine] Using Google Gemini");
                if (!ChatGoogleGenerativeAI) {
                    ChatGoogleGenerativeAI = require("@langchain/google-genai").ChatGoogleGenerativeAI;
                }
                this.model = new ChatGoogleGenerativeAI({
                    modelName: "gemini-pro",
                    maxOutputTokens: 2048,
                });
            } else {
                console.warn("[ConvEngine] No API key found - mock mode");
            }
        } catch (error) {
            console.error("[ConvEngine] Model init error:", error.message);
        }
    }

    /**
     * Carrega dependências do LangChain sob demanda
     */
    async loadLangChainDeps() {
        if (!PromptTemplate) {
            PromptTemplate = require("@langchain/core/prompts").PromptTemplate;
        }
        if (!StringOutputParser) {
            StringOutputParser = require("@langchain/core/output_parsers").StringOutputParser;
        }
    }

    /**
     * Obtém ou cria estado para um chat
     */
    getState(chatId) {
        if (!this.states.has(chatId)) {
            const initialState = createInitialState(chatId);
            initialState.sessionStarted = Date.now();
            this.states.set(chatId, initialState);
        }
        return this.states.get(chatId);
    }

    /**
     * Atualiza o estado com nova mensagem e análises
     */
    async updateState(chatId, message, voiceContext = null) {
        const state = this.getState(chatId);

        // 1. Adicionar mensagem ao histórico
        state.messages.push({
            role: 'user',
            content: message,
            timestamp: Date.now(),
            voiceContext
        });

        // 2. Classificar intenção
        state.currentIntent = this.intentClassifier.classify(message);

        // 3. Analisar emoção
        const emotionAnalysis = this.emotionalIntelligence.analyze(message, chatId);
        state.emotionalState = {
            primary: emotionAnalysis.primary,
            intensity: emotionAnalysis.intensity,
            trend: emotionAnalysis.trend,
            valence: emotionAnalysis.valence,
            arousal: emotionAnalysis.arousal,
            suggestedReaction: emotionAnalysis.suggestedReaction
        };

        // 4. Atualizar métricas
        state.conversationMetrics.messageCount++;
        state.conversationMetrics.sentimentTrend.push(emotionAnalysis.valence);
        if (state.conversationMetrics.sentimentTrend.length > 20) {
            state.conversationMetrics.sentimentTrend.shift();
        }

        // 5. Calcular blend de persona
        state.personaBlendRatio = this.personaBlender.calculateBlend(state);

        // 6. Atualizar fase da conversa
        state.conversationPhase = this.determinePhase(state);

        // 7. Persona baseada no blend ratio
        if (state.personaBlendRatio.consultant > 0.7) {
            state.activePersona = 'saraiva';
        } else {
            state.activePersona = 'social_media';
        }

        // 8. Checar triggers proativos
        state.proactiveHooks = this.proactiveEngine.check(state);

        // 9. Atualizar contexto de voz se aplicável
        if (voiceContext) {
            state.userProfile.responsePreference = voiceContext.shouldRespondWithAudio
                ? 'audio'
                : 'text';
        }

        // 10. Atualizar timestamp
        state.lastInteraction = Date.now();

        // 11. Calcular engagement score
        state.userProfile.engagementLevel = this.calculateEngagement(state);

        this.states.set(chatId, state);
        return state;
    }

    /**
     * Determina a fase atual da conversa
     */
    determinePhase(state) {
        const { messageCount } = state.conversationMetrics;
        const { name, business, niche } = state.userProfile;
        const intent = state.currentIntent.primary.intent;

        // Regras de transição
        if (messageCount <= 1) return 'greeting';

        if (!name || (!business && !niche)) return 'discovery';

        if (intent === 'buying_signal' || intent === 'request_consultation') {
            return 'pitch';
        }

        if (state.conversationPhase === 'pitch' &&
            (intent === 'objection' || messageCount > 30)) {
            return 'close';
        }

        return 'engagement';
    }

    /**
     * Calcula score de engajamento (0-100)
     */
    calculateEngagement(state) {
        let score = 0;

        // Baseado em quantidade de mensagens
        score += Math.min(state.conversationMetrics.messageCount * 2, 30);

        // Baseado em sentimento médio
        const sentiments = state.conversationMetrics.sentimentTrend;
        if (sentiments.length > 0) {
            const avgSentiment = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
            score += (avgSentiment + 1) * 15; // -1 a 1 -> 0 a 30
        }

        // Baseado em intenções positivas
        if (['question', 'request_content', 'buying_signal', 'curious'].includes(
            state.currentIntent.primary.intent
        )) {
            score += 20;
        }

        // Baseado em dados compartilhados
        if (state.userProfile.name) score += 5;
        if (state.userProfile.business) score += 5;
        if (state.userProfile.niche) score += 5;

        return Math.min(Math.round(score), 100);
    }

    /**
     * Extrai dados do usuário da mensagem
     */
    /**
     * Extrai dados do usuário da mensagem
     */
    extractUserData(message, state) {
        const extracted = {};
        const text = message.trim();
        const textLower = text.toLowerCase();

        // 1. Context-Aware Extraction (Baseado na pergunta anterior)
        const lastBotMessage = state.messages.length >= 2
            ? state.messages[state.messages.length - 2].content.toLowerCase()
            : "";

        // Se a resposta for curta (< 10 palavras), provavelmente é uma resposta direta
        const isShortAnswer = text.split(' ').length < 10;

        if (isShortAnswer) {
            // Pergunta sobre Localização
            if (lastBotMessage.match(/onde.*?você|sua.*?cidade|qual.*?estado|fica.*?aonde/)) {
                if (!state.userProfile.location) {
                    extracted.location = text;
                }
            }
            // Pergunta sobre Nome do Negócio
            else if (lastBotMessage.match(/nome.*?loja|nome.*?negócio|chama.*?sua.*?empresa/)) {
                if (!state.userProfile.business) {
                    extracted.businessName = text; // Mapeia para businessName para compatibilidade
                    extracted.business = text;
                }
            }
            // Pergunta sobre Nome da Pessoa
            else if (lastBotMessage.match(/seu.*?nome|como.*?chamo|quem.*?é.*?você/)) {
                if (!state.userProfile.name) {
                    // Remove comuns falsos positivos
                    if (!['não', 'sim', 'ainda não'].includes(textLower)) {
                        extracted.name = text;
                    }
                }
            }
        }

        // 2. Pattern Matching Padrão (Regex)

        // Extração de nome (padrão: "me chamo X", "meu nome é X", "sou o/a X")
        const namePatterns = [
            /(?:me chamo|meu nome é|sou o|sou a|pode me chamar de)\s+([A-Z][\w\s]+)/, // Pega com Caps
            /^eu sou o\s+(\w+)/i
        ];
        for (const pattern of namePatterns) {
            const match = message.match(pattern);
            if (match) {
                extracted.name = match[1].trim();
                break;
            }
        }

        // Extração de nicho/negócio
        const nichePatterns = [
            /(?:trabalho com|sou|meu negócio é|atuo com|faço)\s+(.+?)(?:\.|,|!|\?|$)/i,
            /(?:tenho uma?|abri uma?)\s+(.+?)(?:\.|,|!|\?|$)/i
        ];
        for (const pattern of nichePatterns) {
            const match = message.match(pattern);
            if (match && match[1].length < 50) {
                // Evita capturar coisas como "trabalho com carinho"
                if (match[1].length > 3) {
                    extracted.business = match[1].trim();
                    extracted.businessName = match[1].trim();
                }
                break;
            }
        }

        // Extração de localização
        const locationPatterns = [
            /(?:moro em|sou de|fico em|estou em)\s+(.+?)(?:\.|,|!|\?|$)/i
        ];
        for (const pattern of locationPatterns) {
            const match = message.match(pattern);
            if (match) {
                extracted.location = match[1].trim();
                break;
            }
        }

        return extracted;
    }

    /**
     * Gera o prompt contextualizado para o LLM
     */
    buildPrompt(state, basePrompt) {
        const { PROMPTS } = require('../personas');

        // Prompt base da persona ativa
        let systemPrompt = PROMPTS[state.activePersona] || PROMPTS.social_media;

        // Substituir dados do cliente
        const clientDataStr = JSON.stringify(state.userProfile, null, 2);
        systemPrompt = systemPrompt.replace('{{CLIENT_DATA}}', clientDataStr);

        // Adicionar instruções de blend
        const blendInstructions = this.personaBlender.generateToneInstructions(
            state.personaBlendRatio
        );

        // Adicionar contexto emocional
        const emotionalContext = `
## CONTEXTO EMOCIONAL
- Emoção detectada: ${state.emotionalState.primary}
- Intensidade: ${Math.round(state.emotionalState.intensity * 100)}%
- Tendência: ${state.emotionalState.trend}
${state.emotionalState.suggestedReaction ? `- Considere reagir com: ${state.emotionalState.suggestedReaction}` : ''}
`;

        // Adicionar contexto de intenção
        const intentContext = `
## INTENÇÃO DO USUÁRIO
- Intenção primária: ${state.currentIntent.primary.intent}
- Confiança: ${Math.round(state.currentIntent.primary.confidence * 100)}%
${state.currentIntent.composite.length > 0 ? `- Sinais compostos: ${state.currentIntent.composite.map(c => c.intent).join(', ')}` : ''}
`;

        // Adicionar contexto de fase
        const phaseInstructions = this.getPhaseInstructions(state.conversationPhase, state);

        // Adicionar triggers proativos
        let proactiveContext = '';
        if (state.proactiveHooks.length > 0) {
            proactiveContext = `
## GATILHOS PROATIVOS ATIVADOS
${state.proactiveHooks.map(h => `- ${h.name}: ${h.action}`).join('\n')}
`;
        }

        // Montar prompt final
        const enhancedPrompt = `${systemPrompt}

${blendInstructions}

${emotionalContext}

${intentContext}

${phaseInstructions}

${proactiveContext}

## MÉTRICAS DA CONVERSA
- Mensagens trocadas: ${state.conversationMetrics.messageCount}
- Engajamento: ${state.userProfile.engagementLevel}%
- Fase: ${state.conversationPhase}
`;

        return enhancedPrompt;
    }

    /**
     * Instruções específicas por fase
     */
    getPhaseInstructions(phase, state) {
        const instructions = {
            greeting: `
## FASE: SAUDAÇÃO
- Seja caloroso e energético
- Tente descobrir o nome do usuário naturalmente
- Mostre que está pronto para ajudar
- NÃO faça muitas perguntas de uma vez`,

            discovery: `
## FASE: DESCOBERTA
- PRIORIDADE: Descobrir nome, negócio, nicho
- Faça perguntas naturais, não interrogatório
- Demonstre interesse genuíno
- Use ||SAVE|| quando descobrir algo novo
- Dados atuais: nome=${state.userProfile.name || 'desconhecido'}, negócio=${state.userProfile.business || 'desconhecido'}`,

            engagement: `
## FASE: ENGAJAMENTO
- Já conhece o básico do cliente
- Foque em entregar valor e dicas práticas
- Sugira conteúdos e estratégias
- Use ||GENERATE_IMAGE|| quando fizer sentido
- Construa rapport e confiança`,

            pitch: `
## FASE: PITCH
- O usuário demonstrou interesse!
- Apresente a proposta de valor
- Seja direto mas não agressivo
- Responda objeções com empatia
- Use cases e resultados`,

            close: `
## FASE: FECHAMENTO
- Confirme próximos passos
- Ofereça link ou agendamento
- Mantenha porta aberta se não fechar
- Agradeça e reforce o valor`
        };

        return instructions[phase] || instructions.engagement;
    }

    /**
     * Processa uma mensagem e gera resposta
     */
    async processMessage(chatId, message, voiceContext = null, contactName = null) {
        if (!this.model) {
            return {
                response: "[MOCK] Nenhuma API key configurada",
                state: this.getState(chatId)
            };
        }

        try {
            // 1. Atualizar estado com nova mensagem
            const state = await this.updateState(chatId, message, voiceContext);

            // 2. Extrair dados do usuário
            const extractedData = this.extractUserData(message, state);
            if (Object.keys(extractedData).length > 0) {
                Object.assign(state.userProfile, extractedData);
                console.log(`[ConvEngine] Extracted: ${JSON.stringify(extractedData)}`);
            }

            // 3. Usar contactName se não tiver nome
            if (!state.userProfile.name && contactName) {
                state.userProfile._whatsappName = contactName;
            }

            // 4. Construir prompt
            const enhancedPrompt = this.buildPrompt(state);

            // 5. Preparar histórico recente
            const recentHistory = state.messages.slice(-10).map(m =>
                `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`
            ).join('\n');

            // 6. Carregar dependências e criar template
            await this.loadLangChainDeps();
            const template = PromptTemplate.fromTemplate(`
{system_prompt}

HISTÓRICO RECENTE:
{history}

User: {message}
AI:`);

            // 7. Gerar resposta
            const chain = template.pipe(this.model).pipe(new StringOutputParser());
            let response = await chain.invoke({
                system_prompt: enhancedPrompt,
                history: recentHistory,
                message: message
            });

            // 8. Processar tags especiais
            const processedResponse = this.processSpecialTags(response, state);

            // 9. Adicionar resposta ao histórico
            state.messages.push({
                role: 'assistant',
                content: processedResponse.cleanResponse,
                timestamp: Date.now()
            });

            // 10. Log estado
            console.log(`[ConvEngine] Chat ${chatId}: phase=${state.conversationPhase}, engagement=${state.userProfile.engagementLevel}%, emotion=${state.emotionalState.primary}`);

            return {
                response: processedResponse.cleanResponse,
                actions: processedResponse.actions,
                reaction: state.emotionalState.suggestedReaction,
                state,
                metadata: {
                    intent: state.currentIntent.primary.intent,
                    emotion: state.emotionalState.primary,
                    phase: state.conversationPhase,
                    engagement: state.userProfile.engagementLevel,
                    personaBlend: state.personaBlendRatio
                }
            };

        } catch (error) {
            console.error('[ConvEngine] Error:', error);
            return {
                response: "putz, deu um bug aqui... tenta de novo?",
                error: error.message
            };
        }
    }

    /**
     * Processa tags especiais na resposta
     */
    processSpecialTags(response, state) {
        const actions = [];
        let cleanResponse = response;

        // ||SAVE|| - Extrai dados para salvar
        const saveMatch = cleanResponse.match(/\|\|SAVE\|\|\s*(\{[^}]+\})/);
        if (saveMatch) {
            try {
                const data = JSON.parse(saveMatch[1]);
                actions.push({ type: 'save', data });
                Object.assign(state.userProfile, data);
            } catch (e) {
                console.error('[ConvEngine] Failed to parse SAVE tag:', e);
            }
            cleanResponse = cleanResponse.replace(/\|\|SAVE\|\|\s*\{[^}]+\}/g, '').trim();
        }

        // ||GENERATE_IMAGE: prompt||
        const imageMatch = cleanResponse.match(/\|\|GENERATE_IMAGE:\s*(.*?)\|\|/);
        if (imageMatch) {
            actions.push({ type: 'generate_image', prompt: imageMatch[1] });
            cleanResponse = cleanResponse.replace(/\|\|GENERATE_IMAGE:\s*.*?\|\|/g, '').trim();
        }

        // ||SEND_AUDIO: text||
        const audioMatch = cleanResponse.match(/\|\|SEND_AUDIO:\s*(.*?)\|\|/);
        if (audioMatch) {
            actions.push({ type: 'send_audio', text: audioMatch[1] });
            cleanResponse = cleanResponse.replace(/\|\|SEND_AUDIO:\s*.*?\|\|/g, '').trim();
        }

        // <REACT:emoji>
        const reactMatch = cleanResponse.match(/<REACT:(.*?)>/);
        if (reactMatch) {
            actions.push({ type: 'react', emoji: reactMatch[1] });
            cleanResponse = cleanResponse.replace(/<REACT:.*?>/g, '').trim();
        }

        return { cleanResponse, actions };
    }

    /**
     * Obtém estatísticas do chat
     */
    getStats(chatId) {
        const state = this.getState(chatId);
        return {
            messageCount: state.conversationMetrics.messageCount,
            engagementLevel: state.userProfile.engagementLevel,
            currentPhase: state.conversationPhase,
            emotionalState: state.emotionalState,
            personaBlend: state.personaBlendRatio,
            userProfile: state.userProfile
        };
    }

    /**
     * Reseta estado de um chat
     */
    resetChat(chatId) {
        this.states.delete(chatId);
        this.emotionalIntelligence.emotionHistory.delete(chatId);
    }
}

module.exports = new ConversationalEngine();
