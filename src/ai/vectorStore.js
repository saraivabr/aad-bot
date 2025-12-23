const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const { OpenAIEmbeddings } = require("@langchain/openai");
const {
    METODO_MD,
    PILAR_NARRATIVA,
    PILAR_PRESENCA,
    PILAR_MONETIZACAO,
    LOGICA_MESTRA,
    EXPRESSAO_IMPACTO
} = require("../data/knowledgeBase");

// Dados para cada persona
const SALES_DATA = [
    "Ajudo empreendedores a crescer no Instagram e vender mais.",
    "Estratégias de conteúdo para redes sociais que convertem.",
    "Criação de posts, stories e reels para engajamento.",
    "Análise de métricas e otimização de perfil.",
    "Planejamento de calendário editorial.",
    "Dicas de fotografia e design para feed.",
    PILAR_PRESENCA,
    PILAR_MONETIZACAO
];

const CONSULTANT_DATA = [
    METODO_MD,
    PILAR_NARRATIVA,
    PILAR_PRESENCA,
    PILAR_MONETIZACAO,
    LOGICA_MESTRA,
    EXPRESSAO_IMPACTO
];

// Simple specific implementation to avoid LangChain dependency hell
class SimpleMemoryVectorStore {
    constructor(embeddings) {
        this.embeddings = embeddings;
        this.vectors = []; // { content, vector, metadata }
    }

    static async fromTexts(texts, metadatas, embeddings) {
        const store = new SimpleMemoryVectorStore(embeddings);
        const vectors = await embeddings.embedDocuments(texts);

        texts.forEach((text, i) => {
            store.vectors.push({
                content: text,
                vector: vectors[i],
                metadata: metadatas[i]
            });
        });

        return store;
    }

    async similaritySearch(query, k = 2) {
        const queryVector = await this.embeddings.embedQuery(query);

        // Calculate Cosine Similarity
        const similarities = this.vectors.map(doc => {
            const dot = doc.vector.reduce((acc, val, i) => acc + val * queryVector[i], 0);
            const normA = Math.sqrt(doc.vector.reduce((acc, val) => acc + val * val, 0));
            const normB = Math.sqrt(queryVector.reduce((acc, val) => acc + val * val, 0));
            return {
                pageContent: doc.content,
                score: dot / (normA * normB)
            };
        });

        // Sort descending
        return similarities
            .sort((a, b) => b.score - a.score)
            .slice(0, k);
    }
}

class KnowledgeBase {
    constructor() {
        this.salesStore = null;
        this.consultantStore = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            console.log("[RAG] Initializing Knowledge Base...");

            let embeddings;
            if (process.env.GOOGLE_API_KEY) {
                console.log("[RAG] Using Google Gemini Embeddings");
                embeddings = new GoogleGenerativeAIEmbeddings();
            } else if (process.env.OPENAI_API_KEY) {
                console.log("[RAG] Using OpenAI Embeddings");
                embeddings = new OpenAIEmbeddings();
            } else {
                console.warn("[RAG] ⚠️ NO API KEY FOUND. Using mock embeddings.");
                // Mock Embeddings
                embeddings = {
                    embedQuery: async (text) => new Array(768).fill(0).map(() => Math.random()),
                    embedDocuments: async (docs) => docs.map(() => new Array(768).fill(0).map(() => Math.random()))
                };
            }

            // Index Sales Data
            this.salesStore = await SimpleMemoryVectorStore.fromTexts(
                SALES_DATA,
                SALES_DATA.map((_, i) => ({ id: i, source: 'sales' })),
                embeddings
            );

            // Index Consultant Data
            this.consultantStore = await SimpleMemoryVectorStore.fromTexts(
                CONSULTANT_DATA,
                CONSULTANT_DATA.map((_, i) => ({ id: i, source: 'consultant' })),
                embeddings
            );

            console.log("[RAG] Knowledge Base Initialized!");
            this.initialized = true;
        } catch (error) {
            console.error("[RAG] Failed to initialize:", error.message);
            this.initialized = true; // Marca como inicializado pra não travar
        }
    }

    async search(query, type) {
        if (!this.initialized) await this.initialize();

        // Map persona to store type
        const storeType = type === 'social_media' ? 'sales' : 'consultant';
        const store = storeType === 'sales' ? this.salesStore : this.consultantStore;

        if (!store) {
            console.warn("[RAG] No store available, returning empty context");
            return "";
        }

        try {
            // Retrieve top 2 results
            const results = await store.similaritySearch(query, 2);
            return results.map(r => r.pageContent).join('\n\n');
        } catch (error) {
            console.error("[RAG] Search Error:", error.message);
            return "";
        }
    }
}

module.exports = new KnowledgeBase();
