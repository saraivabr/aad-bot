/**
 * SEMANTIC MEMORY STORE v2.0
 *
 * Sistema de memória semântica de longo prazo para conversas.
 * Utiliza embeddings para armazenar e recuperar memórias relevantes
 * baseado em similaridade semântica.
 *
 * Features:
 * - Memória episódica (eventos/conversas específicas)
 * - Memória semântica (conhecimento geral sobre o usuário)
 * - Memória procedimental (padrões de comportamento)
 * - Auto-consolidação (combina memórias similares)
 * - Decay temporal (memórias antigas perdem relevância)
 * - Importância baseada em emoção
 */

// Lazy load embeddings to avoid initialization errors
let OpenAIEmbeddings = null;
let GoogleGenerativeAIEmbeddings = null;
const fs = require('fs');
const path = require('path');

// ============================================
// MEMORY TYPES
// ============================================

const MEMORY_TYPES = {
    EPISODIC: 'episodic',      // Eventos específicos ("ontem ele disse X")
    SEMANTIC: 'semantic',       // Fatos sobre o usuário ("ele é dentista")
    PROCEDURAL: 'procedural',   // Padrões ("ele sempre responde rápido")
    EMOTIONAL: 'emotional'      // Memórias emocionais ("ficou muito feliz quando...")
};

const IMPORTANCE_LEVELS = {
    LOW: 0.3,
    MEDIUM: 0.5,
    HIGH: 0.8,
    CRITICAL: 1.0
};

// ============================================
// MEMORY ENTRY STRUCTURE
// ============================================

/**
 * @typedef {Object} MemoryEntry
 * @property {string} id - UUID da memória
 * @property {string} chatId - ID do chat associado
 * @property {string} type - Tipo da memória (MEMORY_TYPES)
 * @property {string} content - Conteúdo da memória
 * @property {number[]} embedding - Vetor de embedding
 * @property {number} importance - Score de importância (0-1)
 * @property {string} emotion - Emoção associada
 * @property {number} accessCount - Quantas vezes foi acessada
 * @property {number} createdAt - Timestamp de criação
 * @property {number} lastAccessed - Último acesso
 * @property {Object} metadata - Metadados adicionais
 */

// ============================================
// SEMANTIC MEMORY STORE
// ============================================

class SemanticMemoryStore {
    constructor() {
        this.embeddings = null;
        this.memories = new Map(); // chatId -> MemoryEntry[]
        this.dbPath = path.join(__dirname, '../data/semantic_memory.json');
        this.initialized = false;

        // Configurações
        this.config = {
            maxMemoriesPerChat: 100,
            similarityThreshold: 0.85, // Para consolidação
            decayRate: 0.001,          // Decay por hora
            maxContextMemories: 5,     // Memórias retornadas por query
            consolidationInterval: 3600000 // 1 hora
        };

        this.loadFromDisk();
    }

    async initialize() {
        if (this.initialized) return;

        try {
            if (process.env.OPENAI_API_KEY) {
                console.log("[SemanticMemory] Using OpenAI Embeddings");
                if (!OpenAIEmbeddings) {
                    OpenAIEmbeddings = require("@langchain/openai").OpenAIEmbeddings;
                }
                this.embeddings = new OpenAIEmbeddings({
                    modelName: "text-embedding-3-small"
                });
            } else if (process.env.GOOGLE_API_KEY) {
                console.log("[SemanticMemory] Using Google Embeddings");
                if (!GoogleGenerativeAIEmbeddings) {
                    GoogleGenerativeAIEmbeddings = require("@langchain/google-genai").GoogleGenerativeAIEmbeddings;
                }
                this.embeddings = new GoogleGenerativeAIEmbeddings();
            } else {
                console.warn("[SemanticMemory] No API key - using mock embeddings");
                this.embeddings = this.createMockEmbeddings();
            }

            this.initialized = true;
            console.log("[SemanticMemory] Initialized successfully");
        } catch (error) {
            console.error("[SemanticMemory] Init error:", error.message);
            this.embeddings = this.createMockEmbeddings();
            this.initialized = true;
        }
    }

    createMockEmbeddings() {
        return {
            embedQuery: async (text) => {
                // Gera embedding determinístico baseado no texto
                const hash = this.hashString(text);
                return new Array(256).fill(0).map((_, i) =>
                    Math.sin(hash + i) * 0.5
                );
            },
            embedDocuments: async (docs) => {
                return Promise.all(docs.map(doc => this.embedQuery(doc)));
            }
        };
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash;
    }

    // ============================================
    // CRUD OPERATIONS
    // ============================================

    /**
     * Armazena uma nova memória
     */
    async store(chatId, content, options = {}) {
        await this.initialize();

        const {
            type = MEMORY_TYPES.SEMANTIC,
            importance = IMPORTANCE_LEVELS.MEDIUM,
            emotion = 'neutral',
            metadata = {}
        } = options;

        // Gerar embedding
        const embedding = await this.embeddings.embedQuery(content);

        // Criar entrada
        const entry = {
            id: this.generateId(),
            chatId,
            type,
            content,
            embedding,
            importance,
            emotion,
            accessCount: 0,
            createdAt: Date.now(),
            lastAccessed: Date.now(),
            metadata
        };

        // Verificar se existe memória muito similar
        const existing = await this.findSimilar(chatId, content, 0.9);
        if (existing.length > 0) {
            // Consolidar ao invés de duplicar
            await this.consolidate(chatId, existing[0], entry);
            return existing[0].id;
        }

        // Adicionar memória
        if (!this.memories.has(chatId)) {
            this.memories.set(chatId, []);
        }

        const chatMemories = this.memories.get(chatId);
        chatMemories.push(entry);

        // Limitar quantidade de memórias
        if (chatMemories.length > this.config.maxMemoriesPerChat) {
            this.prune(chatId);
        }

        this.saveToDisk();
        console.log(`[SemanticMemory] Stored: "${content.substring(0, 50)}..." for ${chatId}`);

        return entry.id;
    }

    /**
     * Busca memórias relevantes por similaridade semântica
     */
    async recall(chatId, query, limit = null) {
        await this.initialize();

        limit = limit || this.config.maxContextMemories;

        const chatMemories = this.memories.get(chatId);
        if (!chatMemories || chatMemories.length === 0) {
            return [];
        }

        // Gerar embedding da query
        const queryEmbedding = await this.embeddings.embedQuery(query);

        // Calcular similaridade para cada memória
        const scored = chatMemories.map(memory => {
            const similarity = this.cosineSimilarity(queryEmbedding, memory.embedding);

            // Aplicar decay temporal
            const hoursSinceCreation = (Date.now() - memory.createdAt) / (1000 * 60 * 60);
            const decayFactor = Math.exp(-this.config.decayRate * hoursSinceCreation);

            // Score final considera: similaridade, importância, decay e acessos
            const score = similarity
                * memory.importance
                * decayFactor
                * (1 + Math.log(memory.accessCount + 1) * 0.1);

            return { memory, similarity, score };
        });

        // Ordenar por score e pegar top N
        scored.sort((a, b) => b.score - a.score);
        const results = scored.slice(0, limit);

        // Atualizar access count
        results.forEach(r => {
            r.memory.accessCount++;
            r.memory.lastAccessed = Date.now();
        });

        this.saveToDisk();

        return results.map(r => ({
            ...r.memory,
            relevanceScore: r.score,
            similarity: r.similarity
        }));
    }

    /**
     * Busca memórias similares a um conteúdo
     */
    async findSimilar(chatId, content, threshold = null) {
        threshold = threshold || this.config.similarityThreshold;

        const chatMemories = this.memories.get(chatId);
        if (!chatMemories || chatMemories.length === 0) {
            return [];
        }

        const embedding = await this.embeddings.embedQuery(content);

        const similar = chatMemories.filter(memory => {
            const similarity = this.cosineSimilarity(embedding, memory.embedding);
            return similarity >= threshold;
        });

        return similar;
    }

    /**
     * Remove uma memória específica
     */
    forget(chatId, memoryId) {
        const chatMemories = this.memories.get(chatId);
        if (!chatMemories) return false;

        const index = chatMemories.findIndex(m => m.id === memoryId);
        if (index === -1) return false;

        chatMemories.splice(index, 1);
        this.saveToDisk();

        console.log(`[SemanticMemory] Forgot memory ${memoryId}`);
        return true;
    }

    /**
     * Limpa todas as memórias de um chat
     */
    forgetAll(chatId) {
        this.memories.delete(chatId);
        this.saveToDisk();
        console.log(`[SemanticMemory] Cleared all memories for ${chatId}`);
    }

    // ============================================
    // ADVANCED OPERATIONS
    // ============================================

    /**
     * Consolida duas memórias similares em uma
     */
    async consolidate(chatId, existing, newEntry) {
        // Combinar conteúdos
        const combinedContent = `${existing.content}. Atualização: ${newEntry.content}`;

        // Média ponderada dos embeddings
        const combinedEmbedding = existing.embedding.map((val, i) =>
            (val * existing.accessCount + newEntry.embedding[i]) / (existing.accessCount + 1)
        );

        // Atualizar memória existente
        existing.content = combinedContent;
        existing.embedding = combinedEmbedding;
        existing.importance = Math.max(existing.importance, newEntry.importance);
        existing.accessCount++;
        existing.lastAccessed = Date.now();

        this.saveToDisk();
        console.log(`[SemanticMemory] Consolidated memories for ${chatId}`);
    }

    /**
     * Remove memórias menos relevantes quando limite é atingido
     */
    prune(chatId) {
        const chatMemories = this.memories.get(chatId);
        if (!chatMemories) return;

        // Calcular scores atuais
        const scored = chatMemories.map(memory => {
            const hoursSinceCreation = (Date.now() - memory.createdAt) / (1000 * 60 * 60);
            const decayFactor = Math.exp(-this.config.decayRate * hoursSinceCreation);
            const score = memory.importance * decayFactor * (1 + memory.accessCount * 0.1);
            return { memory, score };
        });

        // Ordenar por score
        scored.sort((a, b) => b.score - a.score);

        // Manter apenas as top N
        const toKeep = scored.slice(0, this.config.maxMemoriesPerChat);
        this.memories.set(chatId, toKeep.map(s => s.memory));

        const removed = chatMemories.length - toKeep.length;
        if (removed > 0) {
            console.log(`[SemanticMemory] Pruned ${removed} memories from ${chatId}`);
        }
    }

    /**
     * Extrai automaticamente memórias importantes de uma mensagem
     */
    async extractAndStore(chatId, message, context = {}) {
        await this.initialize();

        const memories = [];
        const text = message.toLowerCase();

        // Padrões para extração automática
        const extractionPatterns = [
            {
                patterns: [/me chamo (\w+)/i, /meu nome é (\w+)/i, /sou o (\w+)/i],
                type: MEMORY_TYPES.SEMANTIC,
                importance: IMPORTANCE_LEVELS.HIGH,
                template: (match) => `O nome do usuário é ${match[1]}`
            },
            {
                patterns: [/trabalho com (.+?)(?:\.|,|!|$)/i, /sou (.+?)(?:\.|,|!|$)/i],
                type: MEMORY_TYPES.SEMANTIC,
                importance: IMPORTANCE_LEVELS.HIGH,
                template: (match) => `O usuário trabalha com ${match[1]}`
            },
            {
                patterns: [/moro em (.+?)(?:\.|,|!|$)/i, /sou de (.+?)(?:\.|,|!|$)/i],
                type: MEMORY_TYPES.SEMANTIC,
                importance: IMPORTANCE_LEVELS.MEDIUM,
                template: (match) => `O usuário mora em ${match[1]}`
            },
            {
                patterns: [/meu objetivo é (.+?)(?:\.|,|!|$)/i, /quero (.+?)(?:\.|,|!|$)/i],
                type: MEMORY_TYPES.SEMANTIC,
                importance: IMPORTANCE_LEVELS.HIGH,
                template: (match) => `O objetivo do usuário é ${match[1]}`
            },
            {
                patterns: [/consegui (.+?)(?:!|$)/i, /finalmente (.+?)(?:!|$)/i],
                type: MEMORY_TYPES.EPISODIC,
                importance: IMPORTANCE_LEVELS.HIGH,
                emotion: 'excited',
                template: (match) => `O usuário teve uma conquista: ${match[1]}`
            },
            {
                patterns: [/estou com (problema|dificuldade) (.+?)(?:\.|!|$)/i],
                type: MEMORY_TYPES.EMOTIONAL,
                importance: IMPORTANCE_LEVELS.HIGH,
                emotion: 'frustrated',
                template: (match) => `O usuário está com dificuldade: ${match[2]}`
            }
        ];

        // Aplicar padrões
        for (const pattern of extractionPatterns) {
            for (const regex of pattern.patterns) {
                const match = message.match(regex);
                if (match) {
                    const content = pattern.template(match);
                    const id = await this.store(chatId, content, {
                        type: pattern.type,
                        importance: pattern.importance,
                        emotion: pattern.emotion || context.emotion || 'neutral'
                    });
                    memories.push({ id, content });
                    break;
                }
            }
        }

        // Armazenar mensagens emocionalmente significativas
        if (context.emotion && context.intensity > 0.7) {
            const emotionalContent = `Momento emocional (${context.emotion}): "${message.substring(0, 100)}"`;
            await this.store(chatId, emotionalContent, {
                type: MEMORY_TYPES.EMOTIONAL,
                importance: IMPORTANCE_LEVELS.HIGH,
                emotion: context.emotion
            });
        }

        return memories;
    }

    /**
     * Gera um resumo das memórias de um chat
     */
    summarize(chatId) {
        const chatMemories = this.memories.get(chatId);
        if (!chatMemories || chatMemories.length === 0) {
            return { summary: "Nenhuma memória armazenada", details: [] };
        }

        // Agrupar por tipo
        const byType = {};
        for (const memory of chatMemories) {
            if (!byType[memory.type]) byType[memory.type] = [];
            byType[memory.type].push(memory);
        }

        // Criar resumo
        const summary = [];

        if (byType[MEMORY_TYPES.SEMANTIC]) {
            summary.push(`Fatos conhecidos: ${byType[MEMORY_TYPES.SEMANTIC].length}`);
        }
        if (byType[MEMORY_TYPES.EPISODIC]) {
            summary.push(`Eventos registrados: ${byType[MEMORY_TYPES.EPISODIC].length}`);
        }
        if (byType[MEMORY_TYPES.EMOTIONAL]) {
            summary.push(`Momentos emocionais: ${byType[MEMORY_TYPES.EMOTIONAL].length}`);
        }

        // Top memórias por importância
        const topMemories = [...chatMemories]
            .sort((a, b) => b.importance - a.importance)
            .slice(0, 5)
            .map(m => m.content);

        return {
            summary: summary.join(', '),
            totalMemories: chatMemories.length,
            byType,
            topMemories
        };
    }

    /**
     * Formata memórias para inclusão no prompt
     */
    async formatForPrompt(chatId, query) {
        const memories = await this.recall(chatId, query);

        if (memories.length === 0) {
            return "";
        }

        const formatted = memories.map(m => {
            const typeLabel = {
                [MEMORY_TYPES.SEMANTIC]: '📚',
                [MEMORY_TYPES.EPISODIC]: '📅',
                [MEMORY_TYPES.EMOTIONAL]: '💭',
                [MEMORY_TYPES.PROCEDURAL]: '⚙️'
            }[m.type] || '📝';

            return `${typeLabel} ${m.content} (relevância: ${Math.round(m.relevanceScore * 100)}%)`;
        });

        return `## MEMÓRIAS RELEVANTES
${formatted.join('\n')}
`;
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    cosineSimilarity(a, b) {
        let dot = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    generateId() {
        return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    loadFromDisk() {
        try {
            if (fs.existsSync(this.dbPath)) {
                const data = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
                this.memories = new Map(Object.entries(data));
                console.log(`[SemanticMemory] Loaded ${this.memories.size} chats from disk`);
            }
        } catch (error) {
            console.error("[SemanticMemory] Failed to load:", error.message);
            this.memories = new Map();
        }
    }

    saveToDisk() {
        try {
            const data = Object.fromEntries(this.memories);
            fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error("[SemanticMemory] Failed to save:", error.message);
        }
    }

    // ============================================
    // STATISTICS
    // ============================================

    getStats() {
        let totalMemories = 0;
        let byType = {};

        for (const [chatId, memories] of this.memories) {
            totalMemories += memories.length;
            for (const memory of memories) {
                byType[memory.type] = (byType[memory.type] || 0) + 1;
            }
        }

        return {
            totalChats: this.memories.size,
            totalMemories,
            byType,
            initialized: this.initialized
        };
    }
}

module.exports = {
    SemanticMemoryStore: new SemanticMemoryStore(),
    MEMORY_TYPES,
    IMPORTANCE_LEVELS
};
