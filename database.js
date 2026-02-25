/**
 * ======================================================
 * DATABASE - Advanced data management system
 * ======================================================
 * Handles users, favorites, tickets, statistics
 * ======================================================
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const moment = require('moment');

class Database {
    constructor() {
        this.dataDir = path.join(__dirname, 'data');
        this.backupDir = path.join(__dirname, 'backups');
        this.cache = new Map();
        this.stats = {
            users: 0,
            messages: 0,
            commands: 0,
            favorites: 0,
            tickets: 0,
            startTime: Date.now()
        };
        this.init();
    }

    async init() {
        await this.ensureDirectories();
        await this.loadData();
        this.startAutoBackup();
        console.log('✅ Database initialized');
    }

    async ensureDirectories() {
        const dirs = [this.dataDir, this.backupDir];
        for (const dir of dirs) {
            try {
                await fs.access(dir);
            } catch {
                await fs.mkdir(dir, { recursive: true });
            }
        }
    }

    async loadData() {
        try {
            const files = ['users.json', 'favorites.json', 'tickets.json', 'stats.json'];
            for (const file of files) {
                const filePath = path.join(this.dataDir, file);
                try {
                    const data = await fs.readFile(filePath, 'utf8');
                    this.cache.set(file, JSON.parse(data));
                } catch {
                    this.cache.set(file, {});
                }
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    async saveData(type, data) {
        const filePath = path.join(this.dataDir, `${type}.json`);
        try {
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
            this.cache.set(`${type}.json`, data);
            return true;
        } catch (error) {
            console.error(`Error saving ${type}:`, error);
            return false;
        }
    }

    // ========== USER MANAGEMENT ==========
    async registerUser(userId, userData) {
        const users = this.cache.get('users.json') || {};
        const now = new Date().toISOString();
        
        if (!users[userId]) {
            users[userId] = {
                id: userId,
                firstName: userData.first_name || '',
                lastName: userData.last_name || '',
                username: userData.username || '',
                joined: now,
                lastSeen: now,
                messageCount: 1,
                favoriteCount: 0,
                ticketCount: 0,
                model: 'llama-3.3-70b-versatile',
                settings: {
                    notifications: true,
                    language: 'en',
                    theme: 'dark',
                    autoSave: true
                },
                stats: {
                    todayMessages: 1,
                    lastActiveDate: now.split('T')[0],
                    sessions: 1,
                    totalActiveTime: 0
                }
            };
            this.stats.users++;
        } else {
            const user = users[userId];
            user.lastSeen = now;
            user.messageCount++;
            
            const today = now.split('T')[0];
            if (user.stats.lastActiveDate === today) {
                user.stats.todayMessages++;
            } else {
                user.stats.todayMessages = 1;
                user.stats.lastActiveDate = today;
                user.stats.sessions++;
            }
        }
        
        await this.saveData('users', users);
        return users[userId];
    }

    getUser(userId) {
        const users = this.cache.get('users.json') || {};
        return users[userId];
    }

    getAllUsers() {
        const users = this.cache.get('users.json') || {};
        return Object.values(users);
    }

    async updateUser(userId, updates) {
        const users = this.cache.get('users.json') || {};
        if (users[userId]) {
            Object.assign(users[userId], updates);
            await this.saveData('users', users);
            return users[userId];
        }
        return null;
    }

    // ========== FAVORITES ==========
    async addFavorite(userId, text, context = {}) {
        const favorites = this.cache.get('favorites.json') || {};
        
        if (!favorites[userId]) {
            favorites[userId] = [];
        }
        
        if (favorites[userId].length >= 100) {
            return null;
        }
        
        const favorite = {
            id: crypto.randomBytes(4).toString('hex').toUpperCase(),
            text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
            fullText: text,
            date: new Date().toISOString(),
            context: context
        };
        
        favorites[userId].push(favorite);
        await this.saveData('favorites', favorites);
        
        const users = this.cache.get('users.json') || {};
        if (users[userId]) {
            users[userId].favoriteCount = favorites[userId].length;
            await this.saveData('users', users);
        }
        
        this.stats.favorites++;
        return favorite;
    }

    getFavorites(userId) {
        const favorites = this.cache.get('favorites.json') || {};
        return favorites[userId] || [];
    }

    async removeFavorite(userId, favId) {
        const favorites = this.cache.get('favorites.json') || {};
        if (favorites[userId]) {
            const initialLength = favorites[userId].length;
            favorites[userId] = favorites[userId].filter(f => f.id !== favId);
            
            if (favorites[userId].length < initialLength) {
                await this.saveData('favorites', favorites);
                
                const users = this.cache.get('users.json') || {};
                if (users[userId]) {
                    users[userId].favoriteCount = favorites[userId].length;
                    await this.saveData('users', users);
                }
                
                this.stats.favorites--;
                return true;
            }
        }
        return false;
    }

    // ========== TICKETS ==========
    async createTicket(userId, userName, message) {
        const tickets = this.cache.get('tickets.json') || {};
        
        const ticketId = 'TK' + crypto.randomBytes(3).toString('hex').toUpperCase();
        const now = new Date().toISOString();
        
        const ticket = {
            id: ticketId,
            userId,
            userName,
            message,
            status: 'open',
            priority: 'medium',
            createdAt: now,
            updatedAt: now,
            replies: []
        };
        
        tickets[ticketId] = ticket;
        await this.saveData('tickets', tickets);
        
        const users = this.cache.get('users.json') || {};
        if (users[userId]) {
            users[userId].ticketCount = (users[userId].ticketCount || 0) + 1;
            await this.saveData('users', users);
        }
        
        this.stats.tickets++;
        return ticket;
    }

    getTicket(ticketId) {
        const tickets = this.cache.get('tickets.json') || {};
        return tickets[ticketId];
    }

    getUserTickets(userId) {
        const tickets = this.cache.get('tickets.json') || {};
        return Object.values(tickets)
            .filter(t => t.userId === userId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    getAllTickets(status = null) {
        const tickets = this.cache.get('tickets.json') || {};
        let ticketList = Object.values(tickets);
        if (status) {
            ticketList = ticketList.filter(t => t.status === status);
        }
        return ticketList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    async addReply(ticketId, from, message) {
        const tickets = this.cache.get('tickets.json') || {};
        if (tickets[ticketId]) {
            const ticket = tickets[ticketId];
            const reply = {
                id: crypto.randomBytes(2).toString('hex').toUpperCase(),
                from,
                message,
                date: new Date().toISOString()
            };
            
            if (!ticket.replies) ticket.replies = [];
            ticket.replies.push(reply);
            ticket.updatedAt = new Date().toISOString();
            
            if (ticket.status === 'open') {
                ticket.status = 'in-progress';
            }
            
            await this.saveData('tickets', tickets);
            return reply;
        }
        return null;
    }

    async closeTicket(ticketId) {
        const tickets = this.cache.get('tickets.json') || {};
        if (tickets[ticketId]) {
            tickets[ticketId].status = 'closed';
            tickets[ticketId].closedAt = new Date().toISOString();
            tickets[ticketId].updatedAt = new Date().toISOString();
            await this.saveData('tickets', tickets);
            return true;
        }
        return false;
    }

    async reopenTicket(ticketId) {
        const tickets = this.cache.get('tickets.json') || {};
        if (tickets[ticketId]) {
            tickets[ticketId].status = 'open';
            tickets[ticketId].updatedAt = new Date().toISOString();
            await this.saveData('tickets', tickets);
            return true;
        }
        return false;
    }

    // ========== STATISTICS ==========
    incrementMessageCount() {
        this.stats.messages++;
    }

    incrementCommandCount() {
        this.stats.commands++;
    }

    getSystemStats() {
        const users = this.getAllUsers();
        const tickets = this.getAllTickets();
        const openTickets = tickets.filter(t => t.status === 'open');
        const inProgressTickets = tickets.filter(t => t.status === 'in-progress');
        const closedTickets = tickets.filter(t => t.status === 'closed');
        
        const now = Date.now();
        const uptime = now - this.stats.startTime;
        const uptimeString = moment.duration(uptime).humanize();
        
        const activeToday = users.filter(u => {
            const lastSeen = new Date(u.lastSeen);
            const today = new Date();
            return lastSeen.toDateString() === today.toDateString();
        }).length;
        
        const memoryUsage = process.memoryUsage();
        const memoryString = `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`;
        
        return {
            users: users.length,
            activeToday,
            messages: this.stats.messages,
            commands: this.stats.commands,
            favorites: this.stats.favorites,
            tickets: tickets.length,
            openTickets: openTickets.length,
            inProgressTickets: inProgressTickets.length,
            closedTickets: closedTickets.length,
            uptime: uptimeString,
            uptimeSeconds: Math.floor(uptime / 1000),
            memory: memoryString,
            cpu: process.cpuUsage(),
            version: '12.0.0',
            startTime: this.stats.startTime
        };
    }

    // ========== BACKUP SYSTEM ==========
    async createBackup() {
        const backup = {
            timestamp: new Date().toISOString(),
            stats: this.stats,
            users: this.cache.get('users.json'),
            favorites: this.cache.get('favorites.json'),
            tickets: this.cache.get('tickets.json')
        };
        
        const filename = `backup-${moment().format('YYYY-MM-DD-HHmmss')}.json`;
        const filepath = path.join(this.backupDir, filename);
        
        await fs.writeFile(filepath, JSON.stringify(backup, null, 2));
        console.log(`✅ Backup created: ${filename}`);
        
        // Clean old backups (keep last 7)
        const files = await fs.readdir(this.backupDir);
        const backups = files.filter(f => f.startsWith('backup-')).sort();
        while (backups.length > 7) {
            const oldBackup = backups.shift();
            await fs.unlink(path.join(this.backupDir, oldBackup));
        }
        
        return filename;
    }

    startAutoBackup() {
        setInterval(() => {
            this.createBackup().catch(console.error);
        }, 24 * 60 * 60 * 1000); // Daily
    }

    // ========== SEARCH ==========
    search(query, userId = null) {
        const results = [];
        const lowerQuery = query.toLowerCase();
        
        // Search in favorites
        if (userId) {
            const favorites = this.getFavorites(userId);
            favorites.forEach(fav => {
                if (fav.text.toLowerCase().includes(lowerQuery) || 
                    fav.fullText?.toLowerCase().includes(lowerQuery)) {
                    results.push({
                        type: 'favorite',
                        id: fav.id,
                        preview: fav.text,
                        date: fav.date
                    });
                }
            });
        }
        
        // Search in tickets
        const tickets = userId ? this.getUserTickets(userId) : this.getAllTickets();
        tickets.forEach(ticket => {
            if (ticket.message.toLowerCase().includes(lowerQuery) ||
                ticket.id.toLowerCase().includes(lowerQuery)) {
                results.push({
                    type: 'ticket',
                    id: ticket.id,
                    preview: ticket.message.substring(0, 100),
                    date: ticket.createdAt,
                    status: ticket.status
                });
            }
            
            ticket.replies?.forEach(reply => {
                if (reply.message.toLowerCase().includes(lowerQuery)) {
                    results.push({
                        type: 'reply',
                        ticketId: ticket.id,
                        preview: reply.message.substring(0, 100),
                        date: reply.date
                    });
                }
            });
        });
        
        return results.slice(0, 20);
    }

    // ========== SESSION MANAGEMENT ==========
    sessions = new Map();

    setSession(userId, data) {
        this.sessions.set(userId, {
            ...data,
            timestamp: Date.now()
        });
    }

    getSession(userId) {
        const session = this.sessions.get(userId);
        if (session && Date.now() - session.timestamp < 3600000) {
            return session;
        }
        this.sessions.delete(userId);
        return null;
    }

    clearSession(userId) {
        this.sessions.delete(userId);
    }
}

module.exports = new Database();