// Simple in-memory history storage
// Map<ChatID, Array<{role: 'user'|'model', content: string}>>
const historyStorage = new Map();

const MAX_HISTORY_LENGTH = 10;

class HistoryManager {
    static getHistory(chatId) {
        if (!historyStorage.has(chatId)) {
            historyStorage.set(chatId, []);
        }
        return historyStorage.get(chatId);
    }

    static addMessage(chatId, role, content) {
        const history = this.getHistory(chatId);
        history.push({ role, content });

        // Trim history
        if (history.length > MAX_HISTORY_LENGTH) {
            history.shift(); // Remove oldest
        }
    }

    static getFormattedHistory(chatId) {
        const history = this.getHistory(chatId);
        return history.map(msg => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`).join('\n');
    }

    static clearHistory(chatId) {
        historyStorage.delete(chatId);
    }
}

module.exports = HistoryManager;
