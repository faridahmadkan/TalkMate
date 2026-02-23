const fs = require('fs');
const path = require('path');

// File paths for persistent storage
const DATA_DIR = path.join(__dirname, 'data');
const TICKETS_FILE = path.join(DATA_DIR, 'tickets.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper to read/write JSON files
function readJSON(file, defaultValue = {}) {
    try {
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
    } catch (error) {
        console.error(`Error reading ${file}:`, error.message);
    }
    return defaultValue;
}

function writeJSON(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Error writing ${file}:`, error.message);
    }
}

// Database operations
const database = {
    // Tickets
    tickets: readJSON(TICKETS_FILE, {}),
    
    saveTickets() {
        writeJSON(TICKETS_FILE, this.tickets);
    },
    
    createTicket(ticketData) {
        const ticketId = Date.now().toString(36).toUpperCase();
        this.tickets[ticketId] = {
            ...ticketData,
            id: ticketId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            replies: []
        };
        this.saveTickets();
        return this.tickets[ticketId];
    },
    
    getTicket(ticketId) {
        return this.tickets[ticketId];
    },
    
    getOpenTickets() {
        return Object.values(this.tickets).filter(t => t.status === 'open');
    },
    
    addReply(ticketId, reply) {
        if (this.tickets[ticketId]) {
            if (!this.tickets[ticketId].replies) {
                this.tickets[ticketId].replies = [];
            }
            this.tickets[ticketId].replies.push({
                ...reply,
                timestamp: new Date().toISOString()
            });
            this.tickets[ticketId].updatedAt = new Date().toISOString();
            this.saveTickets();
            return true;
        }
        return false;
    },
    
    closeTicket(ticketId) {
        if (this.tickets[ticketId]) {
            this.tickets[ticketId].status = 'closed';
            this.tickets[ticketId].closedAt = new Date().toISOString();
            this.saveTickets();
            return true;
        }
        return false;
    },
    
    // Users
    users: readJSON(USERS_FILE, {}),
    
    saveUsers() {
        writeJSON(USERS_FILE, this.users);
    },
    
    registerUser(userId, userData) {
        if (!this.users[userId]) {
            this.users[userId] = {
                ...userData,
                firstSeen: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
                messageCount: 0,
                tickets: []
            };
        } else {
            this.users[userId].lastSeen = new Date().toISOString();
            this.users[userId].messageCount = (this.users[userId].messageCount || 0) + 1;
        }
        this.saveUsers();
        return this.users[userId];
    },
    
    getUser(userId) {
        return this.users[userId];
    },
    
    getAllUsers() {
        return Object.values(this.users);
    },
    
    // Conversations (for admin replies)
    conversations: readJSON(CONVERSATIONS_FILE, {}),
    
    saveConversations() {
        writeJSON(CONVERSATIONS_FILE, this.conversations);
    },
    
    setAdminReplyState(adminId, ticketId, userId) {
        if (!this.conversations[adminId]) {
            this.conversations[adminId] = {};
        }
        this.conversations[adminId].currentTicket = {
            ticketId,
            userId,
            startedAt: new Date().toISOString()
        };
        this.saveConversations();
    },
    
    getAdminReplyState(adminId) {
        return this.conversations[adminId]?.currentTicket;
    },
    
    clearAdminReplyState(adminId) {
        if (this.conversations[adminId]) {
            delete this.conversations[adminId].currentTicket;
            this.saveConversations();
        }
    }
};

module.exports = database;