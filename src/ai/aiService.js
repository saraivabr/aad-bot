// Lazy load to avoid initialization errors
let ChatGoogleGenerativeAI = null;
let ChatOpenAI = null;
let PromptTemplate = null;
let StringOutputParser = null;

const { PROMPTS } = require('../personas');
const VectorStore = require('./vectorStore');
const HistoryManager = require('./history');
const clientService = require('../services/clientService');

class AIService {
    constructor() {
        this.model = null;
        this.initModel();
    }

    initModel() {
        try {
            if (process.env.GOOGLE_API_KEY) {
                console.log("Using Google Gemini Pro");
                if (!ChatGoogleGenerativeAI) {
                    ChatGoogleGenerativeAI = require("@langchain/google-genai").ChatGoogleGenerativeAI;
                }
                this.model = new ChatGoogleGenerativeAI({
                    modelName: "gemini-pro",
                    maxOutputTokens: 2048,
                });
            } else if (process.env.OPENAI_API_KEY) {
                console.log("Using OpenAI GPT-4o Mini");
                if (!ChatOpenAI) {
                    ChatOpenAI = require("@langchain/openai").ChatOpenAI;
                }
                this.model = new ChatOpenAI({
                    modelName: "gpt-4o-mini",
                    temperature: 0.7,
                });
            } else {
                console.warn("⚠️ No API Key found. AI Service will return mock responses.");
            }
        } catch (error) {
            console.error("AI Service init error:", error.message);
        }
    }

    loadPromptDeps() {
        if (!PromptTemplate) {
            PromptTemplate = require("@langchain/core/prompts").PromptTemplate;
        }
        if (!StringOutputParser) {
            StringOutputParser = require("@langchain/core/output_parsers").StringOutputParser;
        }
    }

    async generateResponse(chatId, message, persona, contactName = null, stateInstructions = '') {
        // Fallback if no model
        if (!this.model) {
            return "[MOCK MODE - NO API KEY] Please add GOOGLE_API_KEY or OPENAI_API_KEY to .env file to enable real AI.\n\n" +
                `You said: ${message}`;
        }

        try {
            // 1. Get Context from Vector Store
            const context = await VectorStore.search(message, persona);

            // 2. Get History
            const history = HistoryManager.getFormattedHistory(chatId);

            // 3. Get Client Data
            const clientData = clientService.getClient(chatId);

            // Inject Contact Name if real name is unknown
            if (!clientData.name) {
                clientData._whatsappName = contactName; // Temporary hint
            }

            const clientContext = JSON.stringify(clientData, null, 2);

            // 4. Construct Prompt with FSM State Instructions
            let systemInstruction = PROMPTS[persona].replace('{{CLIENT_DATA}}', clientContext);

            // Inject FSM state instructions if available
            if (stateInstructions) {
                systemInstruction = `${systemInstruction}\n\n${stateInstructions}`;
            }

            this.loadPromptDeps();
            const fullPromptTemplate = PromptTemplate.fromTemplate(`
{system_instruction}

Use the following context to answer the user's question. If the answer is not in the context, you can use your general knowledge, but prioritize the context.

CONTEXT:
{context}

CHAT HISTORY:
{history}

User: {message}
AI:`);

            const chain = fullPromptTemplate.pipe(this.model).pipe(new StringOutputParser());

            // 5. Generate Response
            let response = await chain.invoke({
                system_instruction: systemInstruction,
                context: context,
                history: history,
                message: message
            });

            // 6. Data Extraction (Side Effect)
            if (response.includes('||SAVE||')) {
                try {
                    const parts = response.split('||SAVE||');
                    response = parts[0].trim(); // Real response
                    const jsonStr = parts[1].trim();
                    const extractedData = JSON.parse(jsonStr);

                    // Save to DB
                    clientService.updateClient(chatId, extractedData);
                    console.log(`[AI SERVICE] Extracted Data for ${chatId}:`, extractedData);

                } catch (e) {
                    console.error("Failed to parse AI Data Tag:", e);
                }
            }

            // 7. Image Generation (Side Effect)
            // Format: ||GENERATE_IMAGE: prompt ||
            // We won't generate HERE, we will leave the tag for the CommandDispatcher to handle?
            // actually, better to handle here or return a special flag.
            // Let's keep the tag in the response text, but `commandDispatcher` will scrape it out.
            // Wait, existing `sendFormattedResponse` splits by <SPLIT>.
            // Let's modify `sendFormattedResponse` in `commandDispatcher.js` to handle this tag specially.

            // Just ensure the tag is preserved in `response`.

            // 8. Update History
            HistoryManager.addMessage(chatId, 'user', message);
            HistoryManager.addMessage(chatId, 'model', response);

            return response;

        } catch (error) {
            console.error("AI Generation Error:", error);
            return "Desculpe, estou tendo problemas para pensar agora. Tente novamente mais tarde.";
        }
    }
}

module.exports = new AIService();
