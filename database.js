/**
 * ======================================================
 * TALKMATE PROFESSIONAL DATABASE LAYER
 * ======================================================
 * Enterprise-grade data management with atomic operations,
 * automatic backups, and data integrity protection
 * ======================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Database {
    constructor() {
        this.dataDir = path.join(__dirname, 'data');
        this.backupDir = path.join(__dirname, 'backups');
        this.initDirectories();
        this.loadData();
    }

    initDirectories() {
        [this.dataDir, this.backupDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`✅ Created directory: ${dir}`);
            }
        });
    }

    loadData() {
        this.tickets = this.readJSON('tickets.json', {});
        this.users = this.readJSON('users.json', {});
        this.conversations = this.readJSON('conversations.json', {});
        this.notes = this.readJSON('notes.json', {});
        this.favorites = this.readJSON('favorites.json', {});
        this.stats = this.readJSON('stats.json', {
            totalMessages: 0,
            totalApiCalls: 0,
            totalTickets: 0,
            startTime: new Date().toISOString(),
            dailyStats: {}
        });
    }

    readJSON(filename, defaultValue) {
        const filepath = path.join(this.dataDir, filename);
        try {
            if (fs.existsSync(filepath)) {
                const data = fs.readFileSync(filepath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error(`Error reading ${filename}:`, error.message);
        }
        return defaultValue;
    }

    writeJSON(filename, data) {
        const filepath = path.join(this.dataDir, filename);
        const tempPath = `${filepath}.tmp`;
        
        try {
            // Atomic write: write to temp file then rename
            fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
            fs.renameSync(tempPath, filepath);
            return true;
        } catch (error) {
            console.error(`Error writing ${filename}:`, error.message);
            try { fs.unlinkSync(tempPath); } catch (e) {}
            return false;
        }
    }

    // ==================================================
    // TICKET MANAGEMENT
    // ==================================================

    createTicket(data) {
        const ticketId = 'TK' + Date.now().toString(36).toUpperCase() + 
                        crypto.randomBytes(2).toString('hex').toUpperCase();
        
        const ticket = {
            id: ticketId,
            userId: data.userId,
            userName: data.userName || 'Unknown',
            username: data.username || '',
            message: data.message,
            subject: data.subject || 'General Inquiry',
            category: data.category || 'general',
            priority: data.priority || 'medium',
            status: 'open',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            replies: []
        };
        
        this.tickets[ticketId] = ticket;
        this.stats.totalTickets++;
        this.writeJSON('tickets.json', this.tickets);
        this.writeJSON('stats.json', this.stats);
        return ticket;
    }

    getTicket(ticketId) {
        return this.tickets[ticketId];
    }

    getOpenTickets() {
        return Object.values(this.tickets).filter(t => t.status === 'open');
    }

    getUserTickets(userId) {
        return Object.values(this.tickets).filter(t => t.userId === userId);
    }

    addReply(ticketId, replyData) {
        if (this.tickets[ticketId]) {
            const reply = {
                id: 'R' + Date.now().toString(36).toUpperCase(),
                from: replyData.from,
                message: replyData.message,
                timestamp: new Date().toISOString()
            };
            
            if (!this.tickets[ticketId].replies) {
                this.tickets[ticketId].replies = [];
            }
            
            this.tickets[ticketId].replies.push(reply);
            this.tickets[ticketId].updatedAt = new Date().toISOString();
            this.tickets[ticketId].status = 'in-progress';
            this.writeJSON('tickets.json', this.tickets);
            return reply;
        }
        return null;
    }

    closeTicket(ticketId) {
        if (this.tickets[ticketId]) {
            this.tickets[ticketId].status = 'closed';
            this.tickets[ticketId].closedAt = new Date().toISOString();
            this.tickets[ticketId].updatedAt = new Date().toISOString();
            this.writeJSON('tickets.json', this.tickets);
            return true;
        }
        return false;
    }

    // ==================================================
    // USER MANAGEMENT
    // ==================================================

    registerUser(userId, userData) {
        const now = new Date().toISOString();
        
        if (!this.users[userId]) {
            this.users[userId] = {
                id: userId,
                firstName: userData.first_name || '',
                lastName: userData.last_name || '',
                username: userData.username || '',
                language: userData.language_code || 'en',
                firstSeen: now,
                lastSeen: now,
                messageCount: 1,
                sessions: 1,
                isBanned: false,
                isAdmin: false,
                preferences: {
                    model: 'llama-3.3-70b-versatile',
                    notifications: true
                }
            };
        } else {
            this.users[userId].lastSeen = now;
            this.users[userId].messageCount++;
            this.users[userId].username = userData.username || this.users[userId].username;
        }
        
        this.writeJSON('users.json', this.users);
        return this.users[userId];
    }

    getUser(userId) {
        return this.users[userId];
    }

    getAllUsers() {
        return Object.values(this.users);
    }

    searchUsers(query) {
        query = query.toLowerCase();
        return Object.values(this.users).filter(u => 
            u.id.includes(query) ||
            (u.firstName && u.firstName.toLowerCase().includes(query)) ||
            (u.username && u.username.toLowerCase().includes(query))
        );
    }

    getStats() {
        const users = Object.values(this.users);
        const now = new Date();
        const today = now.toDateString();
        
        return {
            users: {
                total: users.length,
                activeToday: users.filter(u => new Date(u.lastSeen).toDateString() === today).length,
                newToday: users.filter(u => new Date(u.firstSeen).toDateString() === today).length
            },
            tickets: {
                total: Object.keys(this.tickets).length,
                open: this.getOpenTickets().length
            },
            messages: this.stats.totalMessages,
            uptime: this.getUptime(),
            startTime: this.stats.startTime
        };
    }

    getUptime() {
        const start = new Date(this.stats.startTime);
        const now = new Date();
        const diff = Math.floor((now - start) / 1000);
        
        const days = Math.floor(diff / 86400);
        const hours = Math.floor((diff % 86400) / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;
        
        return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }

    incrementMessageCount() {
        this.stats.totalMessages++;
        this.writeJSON('stats.json', this.stats);
    }

    // ==================================================
    // NOTES & FAVORITES
    // ==================================================

    addNote(userId, text) {
        if (!this.notes[userId]) {
            this.notes[userId] = [];
        }
        
        const note = {
            id: 'N' + Date.now().toString(36).toUpperCase(),
            text: text,
            createdAt: new Date().toISOString()
        };
        
        this.notes[userId].push(note);
        this.writeJSON('notes.json', this.notes);
        return note;
    }

    getUserNotes(userId) {
        return this.notes[userId] || [];
    }

    addFavorite(userId, text) {
        if (!this.favorites[userId]) {
            this.favorites[userId] = [];
        }
        
        const fav = {
            id: 'F' + Date.now().toString(36).toUpperCase(),
            text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
            fullText: text,
            createdAt: new Date().toISOString()
        };
        
        this.favorites[userId].push(fav);
        this.writeJSON('favorites.json', this.favorites);
        return fav;
    }

    getUserFavorites(userId) {
        return this.favorites[userId] || [];
    }

    // ==================================================
    // BACKUP & RESTORE
    // ==================================================

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
        
        const filename = `backup-${new Date().toISOString().split('T')[0]}.json`;
        const filepath = path.join(this.backupDir, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
        console.log(`✅ Backup created: ${filename}`);
        return filepath;
    }
}

module.exports = new Database();