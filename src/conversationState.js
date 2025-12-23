/**
 * CONVERSATION STATE MACHINE (FSM)
 *
 * Estados:
 * - GREETING: Primeiro contato, boas-vindas
 * - DISCOVERY: Coletando informações (nome, negócio, nicho, local)
 * - ENGAGEMENT: Conversa ativa, ajudando com conteúdo
 * - PITCH: Momento de oferecer algo (consultoria, serviço)
 * - CLOSE: Fechamento, próximos passos
 */

const STATES = {
    GREETING: 'greeting',
    DISCOVERY: 'discovery',
    ENGAGEMENT: 'engagement',
    PITCH: 'pitch',
    CLOSE: 'close'
};

// Armazena estado de cada conversa
const conversationStates = new Map();

// Armazena timestamps das últimas mensagens do usuário (para timing adaptativo)
const userTimings = new Map();

/**
 * Detecta gatilhos emocionais para reações automáticas
 */
const REACTION_TRIGGERS = {
    // Gatilhos positivos
    excitement: {
        patterns: [
            /top|show|massa|incrível|demais|animal|sensacional/i,
            /consegui|deu certo|funcionou|vendas|resultado/i,
            /obrigad[oa]|valeu|gratidão/i
        ],
        reactions: ['🔥', '💪', '🚀']
    },
    // Gatilhos de dúvida/reflexão
    thinking: {
        patterns: [
            /como assim|não entendi|pode explicar/i,
            /será que|você acha|o que você pensa/i,
            /hmm|interessante|faz sentido/i
        ],
        reactions: ['🤔', '💭']
    },
    // Gatilhos de frustração
    frustration: {
        patterns: [
            /não consigo|difícil|complicado|travado/i,
            /desistir|cansado|esgotado|não sei mais/i,
            /pqp|caramba|putz|droga/i
        ],
        reactions: ['😤', '💪']
    },
    // Gatilhos de conquista
    achievement: {
        patterns: [
            /fechei|vendi|ganhei|conquistei/i,
            /primeiro cliente|primeira venda|bateu meta/i,
            /sucesso|consegui finalmente/i
        ],
        reactions: ['🎉', '🏆', '👏']
    },
    // Gatilhos de saudação
    greeting: {
        patterns: [
            /^(oi|olá|e aí|eai|opa|fala|salve|bom dia|boa tarde|boa noite)/i
        ],
        reactions: ['👋', '✌️']
    }
};

/**
 * Detecta a reação apropriada baseada no texto do usuário
 * @param {string} text - Mensagem do usuário
 * @returns {string|null} - Emoji de reação ou null
 */
function detectReaction(text) {
    for (const [type, config] of Object.entries(REACTION_TRIGGERS)) {
        for (const pattern of config.patterns) {
            if (pattern.test(text)) {
                // Escolhe reação aleatória do grupo
                const reactions = config.reactions;
                return reactions[Math.floor(Math.random() * reactions.length)];
            }
        }
    }
    return null;
}

/**
 * Obtém ou inicializa o estado da conversa
 */
function getState(chatId) {
    if (!conversationStates.has(chatId)) {
        conversationStates.set(chatId, {
            current: STATES.GREETING,
            data: {
                hasName: false,
                hasBusiness: false,
                hasNiche: false,
                hasLocation: false,
                messageCount: 0,
                lastTransition: Date.now()
            }
        });
    }
    return conversationStates.get(chatId);
}

/**
 * Atualiza o estado baseado em dados coletados
 */
function updateState(chatId, clientData) {
    const state = getState(chatId);
    state.data.messageCount++;

    // Atualiza flags de dados coletados
    if (clientData) {
        if (clientData.name) state.data.hasName = true;
        if (clientData.businessName) state.data.hasBusiness = true;
        if (clientData.niche) state.data.hasNiche = true;
        if (clientData.location) state.data.hasLocation = true;
    }

    // Transições automáticas
    const oldState = state.current;

    // GREETING → DISCOVERY (após primeira resposta)
    if (state.current === STATES.GREETING && state.data.messageCount >= 1) {
        state.current = STATES.DISCOVERY;
    }

    // DISCOVERY → ENGAGEMENT (quando tem dados básicos)
    if (state.current === STATES.DISCOVERY) {
        const hasBasicData = state.data.hasName && (state.data.hasBusiness || state.data.hasNiche);
        if (hasBasicData) {
            state.current = STATES.ENGAGEMENT;
        }
    }

    // ENGAGEMENT → PITCH (após 10+ mensagens e engajamento alto)
    if (state.current === STATES.ENGAGEMENT && state.data.messageCount >= 10) {
        // Pode transitar para PITCH baseado em gatilhos específicos
        // Por enquanto, mantém em ENGAGEMENT
    }

    if (oldState !== state.current) {
        state.data.lastTransition = Date.now();
        console.log(`[FSM] ${chatId}: ${oldState} → ${state.current}`);
    }

    conversationStates.set(chatId, state);
    return state;
}

/**
 * Retorna instruções específicas do estado para o prompt
 */
function getStateInstructions(chatId) {
    const state = getState(chatId);

    const instructions = {
        [STATES.GREETING]: `
## ESTADO ATUAL: SAUDAÇÃO
- Seja caloroso e energético
- Pergunte o nome se não souber
- Mostre que você está pronto para ajudar
- Use reação 👋 ou ✌️`,

        [STATES.DISCOVERY]: `
## ESTADO ATUAL: DESCOBERTA
- PRIORIDADE: Coletar nome, negócio, nicho, localização
- Faça perguntas naturais, não interrogatório
- Salve cada info descoberta com ||SAVE||
- Demonstre interesse genuíno pelo negócio`,

        [STATES.ENGAGEMENT]: `
## ESTADO ATUAL: ENGAJAMENTO
- Já conhece o básico do cliente
- Foque em entregar valor e dicas
- Sugira conteúdos e estratégias
- Use ||GENERATE_IMAGE|| quando fizer sentido
- Reaja com 🔥 a conquistas`,

        [STATES.PITCH]: `
## ESTADO ATUAL: PITCH
- Momento de oferecer consultoria/mentoria
- Seja direto mas não agressivo
- Mostre cases e resultados
- Use urgência com moderação`,

        [STATES.CLOSE]: `
## ESTADO ATUAL: FECHAMENTO
- Confirme próximos passos
- Agende chamada ou envie link
- Agradeça e reforce o valor
- Use reação 🎉 no fechamento`
    };

    return instructions[state.current] || '';
}

/**
 * TIMING ADAPTATIVO
 * Rastreia velocidade de resposta do usuário e adapta a do bot
 */

function recordUserTiming(chatId) {
    const now = Date.now();
    const timings = userTimings.get(chatId) || [];

    if (timings.length > 0) {
        const lastTime = timings[timings.length - 1];
        const gap = now - lastTime;
        timings.push(now);

        // Mantém apenas as últimas 5 interações
        if (timings.length > 5) {
            timings.shift();
        }
    } else {
        timings.push(now);
    }

    userTimings.set(chatId, timings);
}

/**
 * Calcula o multiplicador de velocidade baseado no ritmo do usuário
 * Retorna um número entre 0.5 (muito rápido) e 1.5 (muito lento)
 */
function getTimingMultiplier(chatId) {
    const timings = userTimings.get(chatId) || [];

    if (timings.length < 2) {
        return 1.0; // Padrão
    }

    // Calcula média de tempo entre mensagens
    let totalGap = 0;
    for (let i = 1; i < timings.length; i++) {
        totalGap += timings[i] - timings[i - 1];
    }
    const avgGap = totalGap / (timings.length - 1);

    // Adapta baseado na média
    // < 5s = usuário rápido (bot acelera)
    // 5-30s = usuário normal
    // > 30s = usuário lento (bot desacelera um pouco, mais humanizado)

    if (avgGap < 5000) {
        return 0.6; // Acelera 40%
    } else if (avgGap < 15000) {
        return 0.8; // Acelera 20%
    } else if (avgGap < 30000) {
        return 1.0; // Normal
    } else if (avgGap < 60000) {
        return 1.2; // Desacelera 20%
    } else {
        return 1.4; // Desacelera 40%
    }
}

/**
 * Calcula duração de typing baseada no texto e timing adaptativo
 */
function calculateTypingDuration(text, chatId, baseSpeed = 30) {
    const multiplier = getTimingMultiplier(chatId);
    const baseDuration = text.length * baseSpeed;
    const adaptedDuration = baseDuration * multiplier;

    // Min 800ms, Max 5000ms
    return Math.min(Math.max(adaptedDuration, 800), 5000);
}

module.exports = {
    STATES,
    getState,
    updateState,
    getStateInstructions,
    detectReaction,
    recordUserTiming,
    getTimingMultiplier,
    calculateTypingDuration,
    REACTION_TRIGGERS
};
