/**
 * ======================================================
 * TALKMATE DATABASE LAYER
 * ======================================================
 * Handles all data persistence for both main and admin bots
 * Uses file-based storage with retry logic for concurrent access
 * ======================================================
 */

const fs = require('fs');
const path = require('path');

// File paths for persistent storage
const DATA_DIR = path.join(__dirname, 'data');
const TICKETS_FILE = path.join(DATA_DIR, 'tickets.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const FAVORITES_FILE = path.join(DATA_DIR, 'favorites.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('✅ Created data directory');
}

// ======================================================
// FILE OPERATIONS WITH RETRY LOGIC
// ======================================================

/**
 * Read JSON file with retry logic for concurrent access
 */
function readJSON(file, defaultValue = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            if (fs.existsSync(file)) {
                const data = fs.readFileSync(file, 'utf8');
                return JSON.parse(data);
            }
            break;
        } catch (error) {
            if (error.code === 'ENOENT') break;
            if (i === retries - 1) {
                console.error(`Error reading ${file} after ${retries} retries:`, error.message);
                return defaultValue;
            }
            // Wait and retry (exponential backoff)
            require('child_process').execSync(`sleep ${Math.pow(2, i) * 0.1}`);
        }
    }
    return defaultValue;
}

/**
 * Write JSON file with retry logic and atomic write
 */
function writeJSON(file, data, retries = 3) {
    // Create temporary file first (atomic write)
    const tempFile = `${file}.tmp`;
    
    for (let i = 0; i < retries; i++) {
        try {
            // Write to temp file
            fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
            // Rename temp file to actual file (atomic operation)
            fs.renameSync(tempFile, file);
            return true;
        } catch (error) {
            if (i === retries - 1) {
                console.error(`Error writing ${file} after ${retries} retries:`, error.message);
                // Clean up temp file if it exists
                try { fs.unlinkSync(tempFile); } catch (e) {}
                return false;
            }
            // Wait and retry
            require('child_process').execSync(`sleep ${Math.pow(2, i) * 0.1}`);
        }
    }
    return false;
}

// ======================================================
// DATABASE OBJECT
// ======================================================

const database = {
    // ==================================================
    // TICKET MANAGEMENT
    // ==================================================
    
    tickets: readJSON(TICKETS_FILE, {}),
    
    saveTickets() {
        return writeJSON(TICKETS_FILE, this.tickets);
    },
    
    /**
     * Create a new support ticket
     */
    createTicket(ticketData) {
        const ticketId = Date.now().toString(36).toUpperCase() + 
                        Math.random().toString(36).substring(2, 6).toUpperCase();
        
        const ticket = {
            id: ticketId,
            userId: ticketData.userId,
            userName: ticketData.userName || 'Unknown',
            username: ticketData.username,
            message: ticketData.message,
            subject: ticketData.subject || 'General Inquiry',
            category: ticketData.category || 'general',
            priority: ticketData.priority || 'medium',
            status: 'open',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            replies: []
        };
        
        this.tickets[ticketId] = ticket;
        this.saveTickets();
        return ticket;
    },
    
    /**
     * Get ticket by ID
     */
    getTicket(ticketId) {
        return this.tickets[ticketId];
    },
    
    /**
     * Get all tickets (optional filter by status)
     */
    getAllTickets(status = null) {
        const tickets = Object.values(this.tickets);
        if (status) {
            return tickets.filter(t => t.status === status);
        }
        return tickets;
    },
    
    /**
     * Get open tickets
     */
    getOpenTickets() {
        return Object.values(this.tickets).filter(t => t.status === 'open');
    },
    
    /**
     * Get tickets by user ID
     */
    getUserTickets(userId) {
        return Object.values(this.tickets).filter(t => t.userId === userId);
    },
    
    /**
     * Add reply to ticket
     */
    addReply(ticketId, replyData) {
        if (this.tickets[ticketId]) {
            if (!this.tickets[ticketId].replies) {
                this.tickets[ticketId].replies = [];
            }
            
            const reply = {
                id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
                from: replyData.from,
                message: replyData.message,
                timestamp: new Date().toISOString()
            };
            
            this.tickets[ticketId].replies.push(reply);
            this.tickets[ticketId].updatedAt = new Date().toISOString();
            this.tickets[ticketId].status = 'in-progress';
            this.saveTickets();
            return reply;
        }
        return null;
    },
    
    /**
     * Close ticket
     */
    closeTicket(ticketId) {
        if (this.tickets[ticketId]) {
            this.tickets[ticketId].status = 'closed';
            this.tickets[ticketId].closedAt = new Date().toISOString();
            this.tickets[ticketId].updatedAt = new Date().toISOString();
            this.saveTickets();
            return true;
        }
        return false;
    },
    
    /**
     * Reopen ticket
     */
    reopenTicket(ticketId) {
        if (this.tickets[ticketId]) {
            this.tickets[ticketId].status = 'open';
            this.tickets[ticketId].updatedAt = new Date().toISOString();
            this.saveTickets();
            return true;
        }
        return false;
    },
    
    /**
     * Delete ticket
     */
    deleteTicket(ticketId) {
        if (this.tickets[ticketId]) {
            delete this.tickets[ticketId];
            this.saveTickets();
            return true;
        }
        return false;
    },
    
    /**
     * Get ticket statistics
     */
    getTicketStats() {
        const tickets = Object.values(this.tickets);
        return {
            total: tickets.length,
            open: tickets.filter(t => t.status === 'open').length,
            inProgress: tickets.filter(t => t.status === 'in-progress').length,
            closed: tickets.filter(t => t.status === 'closed').length,
            byPriority: {
                high: tickets.filter(t => t.priority === 'high').length,
                medium: tickets.filter(t => t.priority === 'medium').length,
                low: tickets.filter(t => t.priority === 'low').length
            },
            byCategory: {
                technical: tickets.filter(t => t.category === 'technical').length,
                billing: tickets.filter(t => t.category === 'billing').length,
                feature: tickets.filter(t => t.category === 'feature').length,
                bug: tickets.filter(t => t.category === 'bug').length,
                general: tickets.filter(t => t.category === 'general').length
            }
        };
    },
    
    // ==================================================
    // USER MANAGEMENT
    // ==================================================
    
    users: readJSON(USERS_FILE, {}),
    
    saveUsers() {
        return writeJSON(USERS_FILE, this.users);
    },
    
    /**
     * Register or update user
     */
    registerUser(userId, userData) {
        const now = new Date().toISOString();
        
        if (!this.users[userId]) {
            // New user
            this.users[userId] = {
                id: userId,
                first_name: userData.first_name || '',
                last_name: userData.last_name || '',
                username: userData.username || '',
                language: userData.language_code || 'en',
                firstSeen: now,
                lastSeen: now,
                messageCount: 1,
                sessions: 1,
                isBanned: false,
                isAdmin: false,
                notes: [],
                favorites: []
            };
        } else {
            // Existing user
            this.users[userId].lastSeen = now;
            this.users[userId].messageCount = (this.users[userId].messageCount || 0) + 1;
            this.users[userId].username = userData.username || this.users[userId].username;
            this.users[userId].first_name = userData.first_name || this.users[userId].first_name;
            this.users[userId].last_name = userData.last_name || this.users[userId].last_name;
        }
        
        this.saveUsers();
        return this.users[userId];
    },
    
    /**
     * Get user by ID
     */
    getUser(userId) {
        return this.users[userId];
    },
    
    /**
     * Get all users
     */
    getAllUsers() {
        return Object.values(this.users);
    },
    
    /**
     * Get active users (last 24 hours)
     */
    getActiveUsers() {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        return Object.values(this.users).filter(u => u.lastSeen > oneDayAgo);
    },
    
    /**
     * Get new users (last 24 hours)
     */
    getNewUsers() {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        return Object.values(this.users).filter(u => u.firstSeen > oneDayAgo);
    },
    
    /**
     * Ban user
     */
    banUser(userId) {
        if (this.users[userId]) {
            this.users[userId].isBanned = true;
            this.saveUsers();
            return true;
        }
        return false;
    },
    
    /**
     * Unban user
     */
    unbanUser(userId) {
        if (this.users[userId]) {
            this.users[userId].isBanned = false;
            this.saveUsers();
            return true;
        }
        return false;
    },
    
    /**
     * Search users
     */
    searchUsers(query) {
        query = query.toLowerCase();
        return Object.values(this.users).filter(u => 
            u.id.toLowerCase().includes(query) ||
            (u.first_name && u.first_name.toLowerCase().includes(query)) ||
            (u.last_name && u.last_name.toLowerCase().includes(query)) ||
            (u.username && u.username.toLowerCase().includes(query))
        );
    },
    
    /**
     * Get user statistics
     */
    getUserStats() {
        const users = Object.values(this.users);
        const now = new Date();
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        
        return {
            total: users.length,
            activeToday: users.filter(u => new Date(u.lastSeen) > oneDayAgo).length,
            activeThisWeek: users.filter(u => new Date(u.lastSeen) > sevenDaysAgo).length,
            newToday: users.filter(u => new Date(u.firstSeen) > oneDayAgo).length,
            newThisWeek: users.filter(u => new Date(u.firstSeen) > sevenDaysAgo).length,
            banned: users.filter(u => u.isBanned).length,
            totalMessages: users.reduce((sum, u) => sum + (u.messageCount || 0), 0)
        };
    },
    
    // ==================================================
    // CONVERSATIONS
    // ==================================================
    
    conversations: readJSON(CONVERSATIONS_FILE, {}),
    
    saveConversations() {
        return writeJSON(CONVERSATIONS_FILE, this.conversations);
    },
    
    /**
     * Save a conversation
     */
    saveConversation(userId, sessionId, messages) {
        const convId = `${userId}_${sessionId}`;
        this.conversations[convId] = {
            userId,
            sessionId,
            messages,
            timestamp: new Date().toISOString()
        };
        this.saveConversations();
    },
    
    /**
     * Get user conversations
     */
    getUserConversations(userId) {
        return Object.values(this.conversations)
            .filter(c => c.userId === userId)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },
    
    // ==================================================
    // NOTES
    // ==================================================
    
    notes: readJSON(NOTES_FILE, {}),
    
    saveNotes() {
        return writeJSON(NOTES_FILE, this.notes);
    },
    
    /**
     * Add a note for user
     */
    addNote(userId, note) {
        if (!this.notes[userId]) {
            this.notes[userId] = [];
        }
        
        const noteObj = {
            id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
            text: note,
            createdAt: new Date().toISOString()
        };
        
        this.notes[userId].push(noteObj);
        this.saveNotes();
        return noteObj;
    },
    
    /**
     * Get user notes
     */
    getUserNotes(userId) {
        return this.notes[userId] || [];
    },
    
    /**
     * Delete a note
     */
    deleteNote(userId, noteId) {
        if (this.notes[userId]) {
            this.notes[userId] = this.notes[userId].filter(n => n.id !== noteId);
            this.saveNotes();
            return true;
        }
        return false;
    },
    
    // ==================================================
    // FAVORITES
    // ==================================================
    
    favorites: readJSON(FAVORITES_FILE, {}),
    
    saveFavorites() {
        return writeJSON(FAVORITES_FILE, this.favorites);
    },
    
    /**
     * Add favorite for user
     */
    addFavorite(userId, text) {
        if (!this.favorites[userId]) {
            this.favorites[userId] = [];
        }
        
        const favObj = {
            id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
            text: text.substring(0, 200) + '...',
            fullText: text,
            createdAt: new Date().toISOString()
        };
        
        this.favorites[userId].push(favObj);
        this.saveFavorites();
        return favObj;
    },
    
    /**
     * Get user favorites
     */
    getUserFavorites(userId) {
        return this.favorites[userId] || [];
    },
    
    // ==================================================
    // STATISTICS
    // ==================================================
    
    stats: readJSON(STATS_FILE, {
        totalMessages: 0,
        totalApiCalls: 0,
        totalTickets: 0,
        dailyStats: {}
    }),
    
    saveStats() {
        return writeJSON(STATS_FILE, this.stats);
    },
    
    /**
     * Increment message count
     */
    incrementMessageCount() {
        this.stats.totalMessages++;
        this.saveStats();
    },
    
    /**
     * Increment API calls
     */
    incrementApiCalls() {
        this.stats.totalApiCalls++;
        this.saveStats();
    },
    
    /**
     * Get system stats
     */
    getSystemStats() {
        return {
            ...this.stats,
            users: Object.keys(this.users).length,
            tickets: Object.keys(this.tickets).length,
            notes: Object.values(this.notes).reduce((sum, arr) => sum + arr.length, 0),
            favorites: Object.values(this.favorites).reduce((sum, arr) => sum + arr.length, 0)
        };
    },
    
    // ==================================================
    // BACKUP & RESTORE
    // ==================================================
    
    /**
     * Create a full backup
     */
    createBackup() {
        const backup = {
            timestamp: new Date().toISOString(),
            tickets: this.tickets,
            users: this.users,
            conversations: this.conversations,
            notes: this.notes,
            favorites: this.favorites,
            stats: this.stats
        };
        
        const backupDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const filename = `backup-${new Date().toISOString().split('T')[0]}.json`;
        const filepath = path.join(backupDir, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
        return filepath;
    },
    
    /**
     * Restore from backup
     */
    restoreFromBackup(filepath) {
        try {
            const backup = JSON.parse(fs.readFileSync(filepath, 'utf8'));
            
            this.tickets = backup.tickets || {};
            this.users = backup.users || {};
            this.conversations = backup.conversations || {};
            this.notes = backup.notes || {};
            this.favorites = backup.favorites || {};
            this.stats = backup.stats || this.stats;
            
            this.saveTickets();
            this.saveUsers();
            this.saveConversations();
            this.saveNotes();
            this.saveFavorites();
            this.saveStats();
            
            return true;
        } catch (error) {
            console.error('Restore failed:', error);
            return false;
        }
    },
    
    // ==================================================
    // ADMIN SESSIONS (for admin bot state)
    // ==================================================
    
    adminSessions: new Map(), // In-memory only, no persistence needed
    
    /**
     * Set admin session
     */
    setAdminSession(adminId, sessionData) {
        this.adminSessions.set(adminId.toString(), sessionData);
    },
    
    /**
     * Get admin session
     */
    getAdminSession(adminId) {
        return this.adminSessions.get(adminId.toString());
    },
    
    /**
     * Clear admin session
     */
    clearAdminSession(adminId) {
        this.adminSessions.delete(adminId.toString());
    },
    
    // ==================================================
    // MAINTENANCE
    // ==================================================
    
    /**
     * Clean up old data
     */
    cleanup(daysOld = 30) {
        const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
        
        // Clean old conversations
        for (const [key, conv] of Object.entries(this.conversations)) {
            if (conv.timestamp < cutoff) {
                delete this.conversations[key];
            }
        }
        
        // Clean old tickets (closed tickets older than cutoff)
        for (const [id, ticket] of Object.entries(this.tickets)) {
            if (ticket.status === 'closed' && ticket.closedAt < cutoff) {
                delete this.tickets[id];
            }
        }
        
        this.saveConversations();
        this.saveTickets();
    }
};

module.exports = database;