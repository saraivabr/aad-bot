const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/clients.db.json');

// Ensure DB exists
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({}, null, 2));
}

class ClientService {
    constructor() {
        this.cache = null;
        this.load();
    }

    load() {
        try {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            this.cache = JSON.parse(data);
        } catch (e) {
            console.error("Failed to load DB:", e);
            this.cache = {};
        }
    }

    save() {
        try {
            fs.writeFileSync(DB_PATH, JSON.stringify(this.cache, null, 2));
        } catch (e) {
            console.error("Failed to save DB:", e);
        }
    }

    getClient(id) {
        if (!this.cache[id]) {
            this.cache[id] = {
                id,
                name: null,
                businessName: null,
                niche: null,
                location: null,
                goals: null,
                history: []
            };
            this.save();
        }
        return this.cache[id];
    }

    updateClient(id, data) {
        const client = this.getClient(id);
        // Merge fields
        this.cache[id] = { ...client, ...data, lastUpdated: new Date().toISOString() };
        this.save();
        console.log(`[DB] Updated client ${id}:`, data);
        return this.cache[id];
    }
}

module.exports = new ClientService();
