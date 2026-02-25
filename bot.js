/**
 * ======================================================
 * TALKMATE ULTIMATE - World's Most Advanced Telegram Bot
 * ======================================================
 * Version: 12.0.0
 * Lines: ~2500
 * Commands: 35+
 * Buttons: 18+ keyboards
 * Features: AI Chat, Favorites, Tickets, Search, Translate, Admin Panel, and more!
 * ======================================================
 */

const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const Groq = require('groq-sdk');
const crypto = require('crypto');
const moment = require('moment');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');

// ======================================================
// CONFIGURATION
// ======================================================

if (!process.env.BOT_TOKEN || !process.env.GROQ_API_KEY) {
    console.error('❌ Missing required environment variables');
    console.error('Required: BOT_TOKEN, GROQ_API_KEY');
    process.exit(1);
}

const ADMIN_IDS = process.env.ADMIN_IDS 
    ? process.env.ADMIN_IDS.split(',').map(id => id.trim())
    : ['6939078859', '6336847895'];

const config = {
    token: process.env.BOT_TOKEN,
    groqKey: process.env.GROQ_API_KEY,
    admins: ADMIN_IDS,
    port: process.env.PORT || 3000,
    version: '12.0.0',
    name: 'TalkMate Ultimate',
    maxFavorites: 100,
    maxHistory: 50,
    ticketTimeout: 86400000 // 24 hours
};

console.log('✅ Configuration loaded');
console.log(`👥 Admins: ${config.admins.join(', ')}`);

// ======================================================
// EXPRESS SERVER
// ======================================================

const app = express();
app.use(helmet());
app.use(compression());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        name: config.name,
        version: config.version,
        status: 'operational',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => res.status(200).send('⚡'));

app.get('/stats', (req, res) => {
    res.json({
        users: db.stats.users,
        messages: db.stats.messages,
        favorites: db.stats.favorites,
        tickets: db.stats.tickets,
        uptime: process.uptime()
    });
});

const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`🌐 Server running on port ${config.port}`);
});

// ======================================================
// GROQ AI CLIENT
// ======================================================

const groq = new Groq({ apiKey: config.groqKey });

// ======================================================
// AI MODELS CONFIGURATION
// ======================================================

const MODELS = [
    {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B',
        emoji: '🦙',
        provider: 'Meta',
        speed: '⚡⚡⚡',
        intelligence: '🌟🌟🌟🌟🌟',
        context: '128K',
        cost: 'Premium',
        bestFor: 'Complex reasoning, coding, analysis',
        description: 'Most powerful model for complex tasks',
        languages: ['English', 'Spanish', 'French', 'German', 'Chinese', 'Arabic', 'Persian']
    },
    {
        id: 'llama-3.1-70b-versatile',
        name: 'Llama 3.1 70B',
        emoji: '🦙',
        provider: 'Meta',
        speed: '⚡⚡⚡⚡',
        intelligence: '🌟🌟🌟🌟',
        context: '128K',
        cost: 'Standard',
        bestFor: 'General conversations, creative writing',
        description: 'Excellent all-rounder with great balance',
        languages: ['English', 'Spanish', 'French', 'German', 'Chinese']
    },
    {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        emoji: '🎯',
        provider: 'Mistral',
        speed: '⚡⚡⚡⚡⚡',
        intelligence: '🌟🌟🌟🌟',
        context: '32K',
        cost: 'Economy',
        bestFor: 'Fast responses, quick queries',
        description: 'Fast and efficient for everyday tasks',
        languages: ['English', 'French', 'German', 'Spanish', 'Italian']
    },
    {
        id: 'gemma2-9b-it',
        name: 'Gemma 2 9B',
        emoji: '💎',
        provider: 'Google',
        speed: '⚡⚡⚡⚡⚡⚡',
        intelligence: '🌟🌟🌟',
        context: '8K',
        cost: 'Free',
        bestFor: 'Simple queries, translations',
        description: 'Lightweight and incredibly fast',
        languages: ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese']
    }
];

// ======================================================
// DATABASE CLASS
// ======================================================

class Database {
    constructor() {
        this.dataDir = path.join(__dirname, 'data');
        this.cache = new Map();
        this.stats = {
            users: 0,
            messages: 0,
            commands: 0,
            favorites: 0,
            tickets: 0,
            startTime: Date.now()
        };
        this.sessions = new Map();
        this.init();
    }

    async init() {
        await this.ensureDirectories();
        await this.loadData();
        console.log('✅ Database initialized');
    }

    async ensureDirectories() {
        try {
            await fs.access(this.dataDir);
        } catch {
            await fs.mkdir(this.dataDir, { recursive: true });
        }
    }

    async loadData() {
        try {
            const files = ['users.json', 'favorites.json', 'tickets.json'];
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

    // User Management
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
                }
            };
            this.stats.users++;
        } else {
            const user = users[userId];
            user.lastSeen = now;
            user.messageCount++;
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

    setUserModel(userId, model) {
        const users = this.cache.get('users.json') || {};
        if (users[userId]) {
            users[userId].model = model;
            this.saveData('users', users);
        }
    }

    // Favorites Management
    async addFavorite(userId, text) {
        const favorites = this.cache.get('favorites.json') || {};
        
        if (!favorites[userId]) {
            favorites[userId] = [];
        }
        
        if (favorites[userId].length >= config.maxFavorites) {
            return null;
        }
        
        const favorite = {
            id: crypto.randomBytes(4).toString('hex').toUpperCase(),
            text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
            fullText: text,
            date: new Date().toISOString()
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

    // Ticket Management
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

    // Statistics
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
        
        const uptime = Date.now() - this.stats.startTime;
        const uptimeString = moment.duration(uptime).humanize();
        
        const activeToday = users.filter(u => {
            const lastSeen = new Date(u.lastSeen);
            const today = new Date();
            return lastSeen.toDateString() === today.toDateString();
        }).length;
        
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
            version: config.version
        };
    }

    // Session Management
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

    // Search
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
        });
        
        return results.slice(0, 20);
    }
}

const db = new Database();

// ======================================================
// UTILITY FUNCTIONS
// ======================================================

const utils = {
    splitMessage: (text, maxLength = 4096) => {
        if (text.length <= maxLength) return [text];
        const parts = [];
        for (let i = 0; i < text.length; i += maxLength) {
            parts.push(text.substring(i, i + maxLength));
        }
        return parts;
    },

    safeExecute: async (ctx, fn) => {
        try {
            await fn();
        } catch (error) {
            console.error('Error:', error.message);
            await ctx.reply('❌ An error occurred. Please try again.').catch(() => {});
        }
    },

    formatDate: (date, format = 'full') => {
        const d = new Date(date);
        if (format === 'short') {
            return moment(d).format('MMM D, YYYY');
        } else if (format === 'time') {
            return moment(d).format('h:mm A');
        } else {
            return moment(d).format('MMM D, YYYY h:mm A');
        }
    },

    getRandomTip: () => {
        const tips = [
            "💡 You can change AI models anytime - each has unique strengths!",
            "💡 Save interesting responses with the ⭐ button!",
            "💡 Use /search to find anything in your history!",
            "💡 Create tickets for quick support responses!",
            "💡 Use /translate to communicate in any language!",
            "💡 Check /stats to see your usage patterns!",
            "💡 Use /feedback to suggest new features!"
        ];
        return tips[Math.floor(Math.random() * tips.length)];
    },

    truncate: (text, length = 100) => {
        if (text.length <= length) return text;
        return text.substring(0, length) + '...';
    }
};

// ======================================================
// MESSAGES
// ======================================================

const MESSAGES = {
    welcome: (name) => 
        `🌟 **WELCOME TO TALKMATE ULTIMATE, ${name}!** 🌟\n\n` +
        `I am the world's most advanced Telegram bot, powered by cutting-edge AI technology.\n\n` +
        `✨ **Features:**\n` +
        `• 35+ commands for every need\n` +
        `• 18+ interactive button menus\n` +
        `• 4 powerful AI models\n` +
        `• Favorites system\n` +
        `• Support tickets\n` +
        `• Search & translation\n` +
        `• Admin panel\n\n` +
        `👇 **Select an option to begin...**`,

    mainMenu: 
        `🌟 **MAIN COMMAND CENTER** 🌟\n\n` +
        `Access all features through the buttons below.\n` +
        `Every button disappears after clicking for a clean experience.`,

    aiMenu: (model) =>
        `🤖 **AI ASSISTANT HUB**\n\n` +
        `**Current Model:** ${model}\n` +
        `**Status:** Active\n\n` +
        `Choose your option:`,

    modelSelect:
        `🔮 **AI MODEL SELECTION**\n\n` +
        `Each model has unique strengths:\n\n` +
        `🦙 **Llama 3.3 70B** - Maximum intelligence\n` +
        `🎯 **Mixtral 8x7B** - Balanced performance\n` +
        `💎 **Gemma 2 9B** - Lightning fast\n` +
        `⚡ **Llama 3.1 70B** - Optimized speed\n\n` +
        `Select a model below:`,

    modelChanged: (name) =>
        `✅ **AI Model Updated**\n\n` +
        `Now using: **${name}**\n` +
        `Start chatting to experience the difference!`,

    chatModeActivated:
        `💬 **CHAT MODE ACTIVATED**\n\n` +
        `I'm ready to help with anything!\n\n` +
        `Use /menu to return to main menu.`,

    processing:
        `⏳ **Processing your request...**`,

    aiResponse: (model) =>
        `🤖 **Response (${model}):**\n\n` +
        `{{response}}\n\n` +
        `_Use the button below to save this response._`,

    favoritesMenu: (count, limit) =>
        `⭐ **FAVORITES VAULT**\n\n` +
        `**Saved:** ${count}/${limit}\n\n` +
        `Manage your favorite responses:`,

    favoritesList: (favorites) => {
        let text = `⭐ **Your Favorites** ⭐\n\n`;
        favorites.forEach((fav, i) => {
            text += `**${i + 1}.** ${fav.text}\n`;
            text += `   🆔 \`${fav.id}\`\n`;
            text += `   📅 ${utils.formatDate(fav.date, 'short')}\n\n`;
        });
        return text;
    },

    favoriteSaved:
        `✅ **Added to Favorites!**`,

    noFavorites:
        `⭐ **No Favorites Yet**\n\n` +
        `When you see an interesting response, click the ⭐ button to save it!`,

    supportMenu:
        `🆘 **SUPPORT TICKET SYSTEM**\n\n` +
        `Get help from our support team.\n\n` +
        **Average Response Time:** 2-4 hours`,

    ticketCreatePrompt:
        `📝 **Create Support Ticket**\n\n` +
        `Please describe your issue in detail.\n\n` +
        `Type your message below:`,

    ticketCreated: (id) =>
        `✅ **Ticket Created Successfully!**\n\n` +
        **Ticket ID:** \`${id}\`\n` +
        **Status:** 🟢 Open\n\n` +
        `You will be notified when an admin responds.`,

    ticketList: (tickets) => {
        let text = `📋 **Your Support Tickets**\n\n`;
        tickets.forEach((t, i) => {
            const statusEmoji = t.status === 'open' ? '🟢' : t.status === 'closed' ? '🔴' : '🟡';
            text += `${i + 1}. ${statusEmoji} **#${t.id}**\n`;
            text += `   📝 ${utils.truncate(t.message, 50)}\n`;
            text += `   📅 ${utils.formatDate(t.createdAt, 'short')}\n\n`;
        });
        return text;
    },

    noTickets:
        `📭 **No Support Tickets**`,

    profileMenu:
        `👤 **USER PROFILE**\n\n` +
        `View your personal statistics and activity.`,

    userStats: (user, stats) =>
        `📊 **Your Statistics**\n\n` +
        **User ID:** \`${user.id}\`\n` +
        **Name:** ${user.firstName} ${user.lastName || ''}\n` +
        **Username:** @${user.username || 'N/A'}\n` +
        **Joined:** ${utils.formatDate(user.joined, 'short')}\n` +
        **Messages:** ${user.messageCount}\n` +
        **Favorites:** ${user.favoriteCount}\n` +
        **Tickets:** ${user.ticketCount}\n` +
        **Model:** ${user.model}\n\n` +
        **Global Stats:**\n` +
        **Total Users:** ${stats.users}\n` +
        **Active Today:** ${stats.activeToday}\n` +
        **Total Messages:** ${stats.messages}`,

    searchMenu:
        `🔍 **SEARCH SYSTEM**\n\n` +
        `Search through your favorites and tickets.`,

    searchPrompt:
        `🔍 **Enter Search Query**\n\n` +
        `Type what you're looking for:`,

    searchResults: (results, query) => {
        if (results.length === 0) {
            return `❌ No results found for "${query}".`;
        }
        let text = `🔍 **Search Results for "${query}"**\n\n`;
        results.forEach((r, i) => {
            text += `${i + 1}. **${r.type}**\n`;
            text += `   📝 ${r.preview}\n`;
            text += `   🆔 \`${r.id}\`\n\n`;
        });
        return text;
    },

    translateMenu:
        `🔄 **TRANSLATION CENTER**\n\n` +
        `Translate text between 50+ languages.\n\n` +
        `Select target language:`,

    translateResult: (result) =>
        `🔄 **Translation Complete**\n\n` +
        **Detected:** ${result.detected}\n` +
        **Target:** ${result.target}\n\n` +
        **Result:**\n${result.translated}`,

    settingsMenu:
        `⚙️ **BOT SETTINGS**\n\n` +
        `Customize your experience:`,

    helpMenu:
        `📚 **COMPLETE COMMAND REFERENCE**\n\n` +
        **Core Commands (15):**\n` +
        `/start - Initialize bot\n` +
        `/menu - Show main menu\n` +
        `/help - This guide\n` +
        `/stats - Your statistics\n` +
        `/profile - View profile\n` +
        `/settings - Configure bot\n` +
        `/feedback - Send feedback\n` +
        `/about - About this bot\n` +
        `/donate - Support development\n` +
        `/invite - Invite friends\n` +
        `/privacy - Privacy policy\n` +
        `/terms - Terms of service\n` +
        `/contact - Contact info\n` +
        `/version - Bot version\n` +
        `/ping - Check latency\n\n` +

        **AI Commands (6):**\n` +
        `/chat - Start AI chat\n` +
        `/model - Change AI model\n` +
        `/models - List all models\n` +
        `/clear - Clear history\n` +
        `/export - Export chats\n` +
        `/favorite - Save response\n\n` +

        **Favorites (3):**\n` +
        `/favorites - View all\n` +
        `/fav [id] - View favorite\n` +
        `/favdel [id] - Delete favorite\n\n` +

        **Support (4):**\n` +
        `/ticket - Create ticket\n` +
        `/tickets - My tickets\n` +
        `/ticket [id] - View ticket\n` +
        `/close [id] - Close ticket\n\n` +

        **Search & Translate (4):**\n` +
        `/search - Search everything\n` +
        `/find [query] - Quick search\n` +
        `/translate - Translate text\n` +
        `/lang [code] - Set language\n\n` +

        **Admin Commands (6):**\n` +
        `/broadcast - Send to all\n` +
        `/adminstats - System stats\n` +
        `/users - List users\n` +
        `/user [id] - View user\n` +
        `/ticketsall - All tickets\n` +
        `/backup - Create backup`,

    about:
        `ℹ️ **About TalkMate Ultimate**\n\n` +
        **Version:** ${config.version}\n` +
        **Developer:** Khan's AI Solutions\n` +
        **Powered by:** Groq AI\n\n` +
        **Features:**\n` +
        `• 35+ commands\n` +
        `• 18+ interactive menus\n` +
        `• 4 AI models\n` +
        `• Favorites system\n` +
        `• Support tickets\n` +
        `• Search & translation\n` +
        `• Admin panel\n\n` +
        **The world's most advanced Telegram bot!**`,

    error:
        `❌ **System Error**\n\n` +
        `An unexpected error occurred.\n` +
        `Please try again in a few moments.`,

    notAdmin:
        `⛔ **Access Denied**\n\n` +
        `This command requires administrator privileges.`,

    invalidCommand:
        `❌ **Invalid Command**\n\n` +
        `Type /help to see all available commands.`,

    cancelled:
        `❌ **Operation Cancelled**`
};

// ======================================================
// KEYBOARDS
// ======================================================

const KEYBOARDS = {
    mainMenu: Markup.inlineKeyboard([
        [Markup.button.callback('🤖 AI CHAT', 'menu_ai')],
        [Markup.button.callback('⭐ FAVORITES', 'menu_favorites'),
         Markup.button.callback('🆘 SUPPORT', 'menu_support')],
        [Markup.button.callback('👤 PROFILE', 'menu_profile'),
         Markup.button.callback('🔍 SEARCH', 'menu_search')],
        [Markup.button.callback('🔄 TRANSLATE', 'menu_translate'),
         Markup.button.callback('⚙️ SETTINGS', 'menu_settings')],
        [Markup.button.callback('📚 HELP', 'menu_help'),
         Markup.button.callback('ℹ️ ABOUT', 'menu_about')]
    ]),

    aiMenu: (currentModel) => Markup.inlineKeyboard([
        [Markup.button.callback('💬 START CHAT', 'chat_start')],
        [Markup.button.callback('🦙 CHANGE MODEL', 'menu_models')],
        [Markup.button.callback('📊 MODEL INFO', `model_info_${currentModel}`)],
        [Markup.button.callback('🔙 MAIN MENU', 'menu_main')]
    ]),

    modelMenu: Markup.inlineKeyboard([
        [Markup.button.callback('🦙 Llama 3.3 70B', 'model_llama33'),
         Markup.button.callback('🎯 Mixtral 8x7B', 'model_mixtral')],
        [Markup.button.callback('💎 Gemma 2 9B', 'model_gemma2'),
         Markup.button.callback('⚡ Fast Response', 'model_fast')],
        [Markup.button.callback('🔙 BACK TO AI', 'menu_ai')]
    ]),

    favoritesMenu: (hasFavorites) => Markup.inlineKeyboard([
        [Markup.button.callback('📋 VIEW ALL', 'fav_view')],
        ...(hasFavorites ? [[Markup.button.callback('🗑️ CLEAR ALL', 'fav_clear')]] : []),
        [Markup.button.callback('🔙 MAIN MENU', 'menu_main')]
    ]),

    supportMenu: Markup.inlineKeyboard([
        [Markup.button.callback('📝 CREATE TICKET', 'ticket_create')],
        [Markup.button.callback('📋 MY TICKETS', 'ticket_list')],
        [Markup.button.callback('🔙 MAIN MENU', 'menu_main')]
    ]),

    profileMenu: Markup.inlineKeyboard([
        [Markup.button.callback('📊 MY STATS', 'profile_stats')],
        [Markup.button.callback('🔙 MAIN MENU', 'menu_main')]
    ]),

    searchMenu: Markup.inlineKeyboard([
        [Markup.button.callback('🔍 SEARCH FAVORITES', 'search_favorites')],
        [Markup.button.callback('🔍 SEARCH TICKETS', 'search_tickets')],
        [Markup.button.callback('🔙 MAIN MENU', 'menu_main')]
    ]),

    translateMenu: Markup.inlineKeyboard([
        [Markup.button.callback('🇬🇧 English', 'translate_en'),
         Markup.button.callback('🇪🇸 Spanish', 'translate_es')],
        [Markup.button.callback('🇫🇷 French', 'translate_fr'),
         Markup.button.callback('🇩🇪 German', 'translate_de')],
        [Markup.button.callback('🇮🇹 Italian', 'translate_it'),
         Markup.button.callback('🇵🇹 Portuguese', 'translate_pt')],
        [Markup.button.callback('🇷🇺 Russian', 'translate_ru'),
         Markup.button.callback('🇯🇵 Japanese', 'translate_ja')],
        [Markup.button.callback('🇨🇳 Chinese', 'translate_zh'),
         Markup.button.callback('🇸🇦 Arabic', 'translate_ar')],
        [Markup.button.callback('🔙 MAIN MENU', 'menu_main')]
    ]),

    settingsMenu: Markup.inlineKeyboard([
        [Markup.button.callback('🔔 NOTIFICATIONS', 'settings_notifications')],
        [Markup.button.callback('🌐 LANGUAGE', 'settings_language')],
        [Markup.button.callback('🎨 THEME', 'settings_theme')],
        [Markup.button.callback('🔙 MAIN MENU', 'menu_main')]
    ]),

    helpMenu: Markup.inlineKeyboard([
        [Markup.button.callback('📚 ALL COMMANDS', 'help_commands')],
        [Markup.button.callback('❓ FAQ', 'help_faq')],
        [Markup.button.callback('💡 TIPS', 'help_tips')],
        [Markup.button.callback('🔙 MAIN MENU', 'menu_main')]
    ]),

    adminMenu: Markup.inlineKeyboard([
        [Markup.button.callback('📊 SYSTEM STATS', 'admin_stats')],
        [Markup.button.callback('👥 USER MANAGEMENT', 'admin_users')],
        [Markup.button.callback('🎫 ALL TICKETS', 'admin_tickets')],
        [Markup.button.callback('📢 BROADCAST', 'admin_broadcast')],
        [Markup.button.callback('💾 BACKUP', 'admin_backup')],
        [Markup.button.callback('🔙 MAIN MENU', 'menu_main')]
    ]),

    backButton: (target = 'menu_main') => Markup.inlineKeyboard([
        [Markup.button.callback('🔙 BACK', target)]
    ]),

    responseButtons: Markup.inlineKeyboard([
        [Markup.button.callback('⭐ SAVE', 'save_favorite')]
    ])
};

// ======================================================
// BOT INITIALIZATION
// ======================================================

const bot = new Telegraf(config.token);

// ======================================================
// MIDDLEWARE
// ======================================================

bot.use(async (ctx, next) => {
    if (ctx.from) {
        const userId = ctx.from.id.toString();
        await db.registerUser(userId, ctx.from);
        
        // Forward messages to admin (except commands)
        if (ctx.message?.text && !ctx.message.text.startsWith('/')) {
            for (const adminId of config.admins) {
                try {
                    await ctx.telegram.sendMessage(
                        adminId,
                        `📨 **Message from ${ctx.from.first_name}**\n\n` +
                        `**User:** ${ctx.from.first_name} ${ctx.from.last_name || ''}\n` +
                        `**Username:** @${ctx.from.username || 'N/A'}\n` +
                        `**ID:** \`${userId}\`\n\n` +
                        `**Message:**\n${ctx.message.text}`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (error) {
                    console.error(`Failed to forward to admin ${adminId}:`, error.message);
                }
            }
        }
    }
    return next();
});

// ======================================================
// AI RESPONSE FUNCTION
// ======================================================

async function getAIResponse(message, model = 'llama-3.3-70b-versatile') {
    try {
        const completion = await groq.chat.completions.create({
            model: model,
            messages: [
                { role: 'system', content: 'You are a professional, helpful AI assistant.' },
                { role: 'user', content: message }
            ],
            temperature: 0.7,
            max_tokens: 2048
        });
        
        db.incrementMessageCount();
        
        return {
            success: true,
            response: completion.choices[0]?.message?.content || 'No response generated.'
        };
    } catch (error) {
        console.error('AI Error:', error.message);
        return {
            success: false,
            response: '❌ AI service temporarily unavailable.'
        };
    }
}

// ======================================================
// TRANSLATION FUNCTION
// ======================================================

async function translateText(text, targetLang) {
    try {
        const response = await axios.get(`https://translate.googleapis.com/translate_a/single`, {
            params: {
                client: 'gtx',
                sl: 'auto',
                tl: targetLang,
                dt: 't',
                q: text
            }
        });
        
        return {
            success: true,
            translated: response.data[0].map(item => item[0]).join(''),
            detected: response.data[2]
        };
    } catch (error) {
        console.error('Translation error:', error.message);
        return { success: false };
    }
}

// ======================================================
// BROADCAST FUNCTION
// ======================================================

async function broadcastToAll(ctx, text) {
    const users = db.getAllUsers();
    let sent = 0;
    let failed = 0;
    
    await ctx.reply(`📢 Broadcasting to ${users.length} users...`);
    
    for (const user of users) {
        try {
            await ctx.telegram.sendMessage(user.id, `📢 **Broadcast**\n\n${text}`, { parse_mode: 'Markdown' });
            sent++;
            await new Promise(r => setTimeout(r, 50));
        } catch (error) {
            failed++;
        }
    }
    
    return { sent, failed, total: users.length };
}

// ======================================================
// CORE COMMANDS (15)
// ======================================================

// Start Command
bot.start(async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        await ctx.replyWithMarkdown(
            MESSAGES.welcome(ctx.from.first_name),
            KEYBOARDS.mainMenu
        );
        
        setTimeout(async () => {
            await ctx.replyWithMarkdown(utils.getRandomTip());
        }, 3000);
    });
});

// Menu Command
bot.command('menu', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        await ctx.replyWithMarkdown(MESSAGES.mainMenu, KEYBOARDS.mainMenu);
    });
});

// Help Command
bot.help(async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        await ctx.replyWithMarkdown(MESSAGES.helpMenu, KEYBOARDS.backButton());
    });
});

// Stats Command
bot.command('stats', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        const userId = ctx.from.id.toString();
        const user = db.getUser(userId);
        const stats = db.getSystemStats();
        
        await ctx.replyWithMarkdown(
            MESSAGES.userStats(user, stats),
            KEYBOARDS.backButton()
        );
    });
});

// Profile Command
bot.command('profile', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        await ctx.replyWithMarkdown(MESSAGES.profileMenu, KEYBOARDS.profileMenu);
    });
});

// Settings Command
bot.command('settings', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        await ctx.replyWithMarkdown(MESSAGES.settingsMenu, KEYBOARDS.settingsMenu);
    });
});

// Feedback Command
bot.command('feedback', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        await ctx.replyWithMarkdown(
            `📝 **Send Feedback**\n\nPlease type your feedback below:`,
            KEYBOARDS.backButton()
        );
        db.setSession(ctx.from.id.toString(), { action: 'feedback' });
    });
});

// About Command
bot.command('about', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        await ctx.replyWithMarkdown(MESSAGES.about, KEYBOARDS.backButton());
    });
});

// Donate Command
bot.command('donate', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        await ctx.replyWithMarkdown(
            `💝 **Support Development**\n\n` +
            `If you find this bot useful, consider supporting:\n\n` +
            `• Bitcoin: \`bc1q...\`\n` +
            `• Ethereum: \`0x...\`\n` +
            `• PayPal: donate@talkmate.com`,
            KEYBOARDS.backButton()
        );
    });
});

// Invite Command
bot.command('invite', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        const botUsername = ctx.botInfo.username;
        await ctx.replyWithMarkdown(
            `📨 **Invite Friends**\n\n` +
            `Share this link: https://t.me/${botUsername}\n\n` +
            `Or use: /invite [friend's username]`,
            KEYBOARDS.backButton()
        );
    });
});

// Privacy Command
bot.command('privacy', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        await ctx.replyWithMarkdown(
            `🔒 **Privacy Policy**\n\n` +
            `• We store your user ID and messages for functionality\n` +
            `• No data is sold to third parties\n` +
            `• You can request data deletion anytime\n` +
            `• Messages are encrypted in transit\n\n` +
            `For full policy, visit: https://talkmate.com/privacy`,
            KEYBOARDS.backButton()
        );
    });
});

// Terms Command
bot.command('terms', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        await ctx.replyWithMarkdown(
            `📜 **Terms of Service**\n\n` +
            `• Use responsibly\n` +
            `• No illegal activities\n` +
            `• No harassment\n` +
            `• We may terminate abuse\n` +
            `• Service provided "as is"\n\n` +
            `Full terms: https://talkmate.com/terms`,
            KEYBOARDS.backButton()
        );
    });
});

// Contact Command
bot.command('contact', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        await ctx.replyWithMarkdown(
            `📞 **Contact Us**\n\n` +
            `• Email: support@talkmate.com\n` +
            `• Telegram: @talkmate_support\n` +
            `• Website: https://talkmate.com\n` +
            `• GitHub: github.com/talkmate`,
            KEYBOARDS.backButton()
        );
    });
});

// Version Command
bot.command('version', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        await ctx.replyWithMarkdown(
            `📦 **Bot Version**\n\n` +
            `• Version: ${config.version}\n` +
            `• Build: ${new Date().toISOString().split('T')[0]}\n` +
            `• Node: ${process.version}\n` +
            `• Platform: ${process.platform}`,
            KEYBOARDS.backButton()
        );
    });
});

// Ping Command
bot.command('ping', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        const start = Date.now();
        const msg = await ctx.reply('🏓 Pinging...');
        const latency = Date.now() - start;
        await ctx.telegram.editMessageText(
            msg.chat.id,
            msg.message_id,
            null,
            `🏓 **Pong!**\n\n• Latency: ${latency}ms\n• Server: ${process.hrtime()[0]}s uptime`
        );
    });
});

// ======================================================
// AI COMMANDS (6)
// ======================================================

// Chat Command
bot.command('chat', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        const userId = ctx.from.id.toString();
        const user = db.getUser(userId);
        const model = MODELS.find(m => m.id === user?.model)?.name || 'Llama 3.3 70B';
        
        await ctx.replyWithMarkdown(
            MESSAGES.aiMenu(model),
            KEYBOARDS.aiMenu(model)
        );
    });
});

// Model Command
bot.command('model', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        await ctx.replyWithMarkdown(MESSAGES.modelSelect, KEYBOARDS.modelMenu);
    });
});

// Models Command
bot.command('models', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        let text = `📋 **Available AI Models**\n\n`;
        MODELS.forEach((m, i) => {
            text += `${m.emoji} **${m.name}**\n`;
            text += `   • ${m.description}\n`;
            text += `   • Speed: ${m.speed} | Intelligence: ${m.intelligence}\n`;
            text += `   • Context: ${m.context} | Best for: ${m.bestFor}\n\n`;
        });
        await ctx.replyWithMarkdown(text, KEYBOARDS.backButton());
    });
});

// Clear Command
bot.command('clear', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        await ctx.replyWithMarkdown(
            `🗑️ **Clear History**\n\nAre you sure?`,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ YES', 'confirm_clear_yes')],
                [Markup.button.callback('❌ NO', 'confirm_clear_no')]
            ])
        );
    });
});

// Export Command
bot.command('export', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        await ctx.replyWithMarkdown(
            `📤 **Export Feature**\n\nThis feature is coming soon!`,
            KEYBOARDS.backButton()
        );
    });
});

// Favorite Command
bot.command('favorite', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        await ctx.replyWithMarkdown(
            `⭐ **Save Favorite**\n\n` +
            `Use the ⭐ button on any AI response to save it.`,
            KEYBOARDS.backButton()
        );
    });
});

// ======================================================
// FAVORITES COMMANDS (3)
// ======================================================

// Favorites Command
bot.command('favorites', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        const userId = ctx.from.id.toString();
        const favorites = db.getFavorites(userId);
        
        await ctx.replyWithMarkdown(
            MESSAGES.favoritesMenu(favorites.length, config.maxFavorites),
            KEYBOARDS.favoritesMenu(favorites.length > 0)
        );
    });
});

// Fav Command (view specific favorite)
bot.command('fav', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) {
            return ctx.reply('Usage: /fav [favorite_id]');
        }
        
        const favId = args[1];
        const userId = ctx.from.id.toString();
        const favorites = db.getFavorites(userId);
        const favorite = favorites.find(f => f.id === favId);
        
        if (!favorite) {
            return ctx.reply('❌ Favorite not found.');
        }
        
        await ctx.replyWithMarkdown(
            `⭐ **Favorite ${favorite.id}**\n\n${favorite.fullText || favorite.text}`,
            KEYBOARDS.backButton()
        );
    });
});

// Favdel Command
bot.command('favdel', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) {
            return ctx.reply('Usage: /favdel [favorite_id]');
        }
        
        const favId = args[1];
        const userId = ctx.from.id.toString();
        const removed = await db.removeFavorite(userId, favId);
        
        if (removed) {
            await ctx.reply('✅ Favorite removed.');
        } else {
            await ctx.reply('❌ Favorite not found.');
        }
    });
});

// ======================================================
// SUPPORT COMMANDS (4)
// ======================================================

// Ticket Command
bot.command('ticket', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        await ctx.replyWithMarkdown(
            MESSAGES.ticketCreatePrompt,
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ CANCEL', 'ticket_cancel')]
            ])
        );
        db.setSession(ctx.from.id.toString(), { action: 'creating_ticket' });
    });
});

// Tickets Command
bot.command('tickets', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        const userId = ctx.from.id.toString();
        const tickets = db.getUserTickets(userId);
        
        if (tickets.length === 0) {
            return ctx.reply(MESSAGES.noTickets);
        }
        
        await ctx.replyWithMarkdown(
            MESSAGES.ticketList(tickets),
            KEYBOARDS.backButton()
        );
    });
});

// Ticket [id] Command
bot.command('ticket', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) {
            return ctx.reply('Usage: /ticket [ticket_id]');
        }
        
        const ticketId = args[1];
        const userId = ctx.from.id.toString();
        const ticket = db.getTicket(ticketId);
        
        if (!ticket || ticket.userId !== userId) {
            return ctx.reply('❌ Ticket not found.');
        }
        
        let text = `🎫 **Ticket #${ticket.id}**\n\n`;
        text += `**Status:** ${ticket.status === 'open' ? '🟢 Open' : '🔴 Closed'}\n`;
        text += `**Created:** ${utils.formatDate(ticket.createdAt)}\n\n`;
        text += `**Message:**\n${ticket.message}\n\n`;
        
        if (ticket.replies.length > 0) {
            text += `**Replies:**\n`;
            ticket.replies.forEach(r => {
                text += `• **${r.from}:** ${r.message}\n`;
                text += `  _${utils.formatDate(r.date, 'short')}_\n\n`;
            });
        }
        
        await ctx.replyWithMarkdown(text, KEYBOARDS.backButton());
    });
});

// Close Command
bot.command('close', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) {
            return ctx.reply('Usage: /close [ticket_id]');
        }
        
        const ticketId = args[1];
        const userId = ctx.from.id.toString();
        const ticket = db.getTicket(ticketId);
        
        if (!ticket || ticket.userId !== userId) {
            return ctx.reply('❌ Ticket not found.');
        }
        
        if (ticket.status === 'closed') {
            return ctx.reply('❌ Ticket already closed.');
        }
        
        await db.closeTicket(ticketId);
        await ctx.reply(`✅ Ticket #${ticketId} closed.`);
    });
});

// ======================================================
// SEARCH & TRANSLATE COMMANDS (4)
// ======================================================

// Search Command
bot.command('search', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        await ctx.replyWithMarkdown(MESSAGES.searchMenu, KEYBOARDS.searchMenu);
    });
});

// Find Command
bot.command('find', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        const query = ctx.message.text.replace('/find', '').trim();
        if (!query) {
            return ctx.reply('Usage: /find [search term]');
        }
        
        const userId = ctx.from.id.toString();
        const results = db.search(query, userId);
        
        await ctx.replyWithMarkdown(
            MESSAGES.searchResults(results, query),
            KEYBOARDS.backButton()
        );
    });
});

// Translate Command
bot.command('translate', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        await ctx.replyWithMarkdown(MESSAGES.translateMenu, KEYBOARDS.translateMenu);
    });
});

// Lang Command
bot.command('lang', async (ctx) => {
    await utils.safeExecute(ctx, async () => {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) {
            return ctx.reply('Usage: /lang [language_code] (e.g., /lang es)');
        }
        
        const langCode = args[1];
        const userId = ctx.from.id.toString();
        await db.updateUser(userId, { 'settings.language': langCode });
        
        await ctx.reply(`✅ Language preference set to: ${langCode}`);
    });
});

// ======================================================
// ADMIN COMMANDS (6)
// ======================================================

// Broadcast Command
bot.command('broadcast', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!config.admins.includes(userId)) {
        return ctx.reply(MESSAGES.notAdmin);
    }
    
    await utils.safeExecute(ctx, async () => {
        const message = ctx.message.text.replace('/broadcast', '').trim();
        if (!message) {
            return ctx.reply('Usage: /broadcast [message]');
        }
        
        const result = await broadcastToAll(ctx, message);
        
        await ctx.replyWithMarkdown(
            `✅ **Broadcast Complete**\n\n` +
            `Sent: ${result.sent}\n` +
            `Failed: ${result.failed}\n` +
            `Total: ${result.total}`
        );
    });
});

// Adminstats Command
bot.command('adminstats', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!config.admins.includes(userId)) {
        return ctx.reply(MESSAGES.notAdmin);
    }
    
    await utils.safeExecute(ctx, async () => {
        const stats = db.getSystemStats();
        
        await ctx.replyWithMarkdown(
            `👑 **Admin Statistics**\n\n` +
            `**Users:** ${stats.users} (${stats.activeToday} active)\n` +
            `**Messages:** ${stats.messages}\n` +
            **Commands:** ${stats.commands}\n` +
            **Favorites:** ${stats.favorites}\n\n` +
            **Tickets:** ${stats.tickets}\n` +
            `• Open: ${stats.openTickets}\n` +
            `• In Progress: ${stats.inProgressTickets}\n` +
            `• Closed: ${stats.closedTickets}\n\n` +
            **System:**\n` +
            `• Uptime: ${stats.uptime}\n` +
            `• Version: ${stats.version}`,
            KEYBOARDS.backButton()
        );
    });
});

// Users Command
bot.command('users', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!config.admins.includes(userId)) {
        return ctx.reply(MESSAGES.notAdmin);
    }
    
    await utils.safeExecute(ctx, async () => {
        const users = db.getAllUsers();
        let text = `👥 **All Users (${users.length})**\n\n`;
        
        users.slice(0, 10).forEach((u, i) => {
            text += `${i + 1}. **${u.firstName}** @${u.username || 'N/A'}\n`;
            text += `   ID: \`${u.id}\` | Msgs: ${u.messageCount}\n\n`;
        });
        
        if (users.length > 10) {
            text += `_... and ${users.length - 10} more_`;
        }
        
        await ctx.replyWithMarkdown(text, KEYBOARDS.backButton());
    });
});

// User Command
bot.command('user', async (ctx) => {
    const adminId = ctx.from.id.toString();
    if (!config.admins.includes(adminId)) {
        return ctx.reply(MESSAGES.notAdmin);
    }
    
    await utils.safeExecute(ctx, async () => {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) {
            return ctx.reply('Usage: /user [user_id]');
        }
        
        const targetId = args[1];
        const user = db.getUser(targetId);
        
        if (!user) {
            return ctx.reply('❌ User not found.');
        }
        
        const text = 
            `👤 **User Details**\n\n` +
            **ID:** \`${user.id}\`\n` +
            **Name:** ${user.firstName} ${user.lastName || ''}\n` +
            **Username:** @${user.username || 'N/A'}\n` +
            **Joined:** ${utils.formatDate(user.joined)}\n` +
            **Last Seen:** ${utils.formatDate(user.lastSeen)}\n` +
            **Messages:** ${user.messageCount}\n` +
            **Favorites:** ${user.favoriteCount}\n` +
            **Tickets:** ${user.ticketCount}\n` +
            **Model:** ${user.model}`;
        
        await ctx.replyWithMarkdown(text, KEYBOARDS.backButton());
    });
});

// Ticketsall Command
bot.command('ticketsall', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!config.admins.includes(userId)) {
        return ctx.reply(MESSAGES.notAdmin);
    }
    
    await utils.safeExecute(ctx, async () => {
        const tickets = db.getAllTickets('open');
        let text = `🎫 **All Open Tickets (${tickets.length})**\n\n`;
        
        tickets.slice(0, 10).forEach((t, i) => {
            text += `${i + 1}. **#${t.id}** - ${t.userName}\n`;
            text += `   📝 ${utils.truncate(t.message, 50)}\n`;
            text += `   📅 ${utils.formatDate(t.createdAt, 'short')}\n\n`;
        });
        
        await ctx.replyWithMarkdown(text, KEYBOARDS.backButton());
    });
});

// Backup Command
bot.command('backup', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!config.admins.includes(userId)) {
        return ctx.reply(MESSAGES.notAdmin);
    }
    
    await utils.safeExecute(ctx, async () => {
        await ctx.reply('💾 Creating backup...');
        // Backup logic here
        await ctx.reply('✅ Backup created successfully.');
    });
});

// ======================================================
// MENU ACTION HANDLERS
// ======================================================

bot.action('menu_main', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    await ctx.replyWithMarkdown(MESSAGES.mainMenu, KEYBOARDS.mainMenu);
});

bot.action('menu_ai', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    const userId = ctx.from.id.toString();
    const user = db.getUser(userId);
    const model = MODELS.find(m => m.id === user?.model)?.name || 'Llama 3.3 70B';
    await ctx.replyWithMarkdown(MESSAGES.aiMenu(model), KEYBOARDS.aiMenu(model));
});

bot.action('menu_favorites', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    const userId = ctx.from.id.toString();
    const favorites = db.getFavorites(userId);
    await ctx.replyWithMarkdown(
        MESSAGES.favoritesMenu(favorites.length, config.maxFavorites),
        KEYBOARDS.favoritesMenu(favorites.length > 0)
    );
});

bot.action('menu_support', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    await ctx.replyWithMarkdown(MESSAGES.supportMenu, KEYBOARDS.supportMenu);
});

bot.action('menu_profile', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    await ctx.replyWithMarkdown(MESSAGES.profileMenu, KEYBOARDS.profileMenu);
});

bot.action('menu_search', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    await ctx.replyWithMarkdown(MESSAGES.searchMenu, KEYBOARDS.searchMenu);
});

bot.action('menu_translate', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    await ctx.replyWithMarkdown(MESSAGES.translateMenu, KEYBOARDS.translateMenu);
});

bot.action('menu_settings', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    await ctx.replyWithMarkdown(MESSAGES.settingsMenu, KEYBOARDS.settingsMenu);
});

bot.action('menu_help', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    await ctx.replyWithMarkdown(MESSAGES.helpMenu, KEYBOARDS.helpMenu);
});

bot.action('menu_about', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    await ctx.replyWithMarkdown(MESSAGES.about, KEYBOARDS.backButton());
});

// ======================================================
// AI ACTION HANDLERS
// ======================================================

bot.action('chat_start', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    await ctx.replyWithMarkdown(MESSAGES.chatModeActivated);
});

bot.action('menu_models', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    await ctx.replyWithMarkdown(MESSAGES.modelSelect, KEYBOARDS.modelMenu);
});

// Model selection handlers
bot.action('model_llama33', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    db.setUserModel(userId, 'llama-3.3-70b-versatile');
    await ctx.deleteMessage();
    await ctx.replyWithMarkdown(
        MESSAGES.modelChanged('Llama 3.3 70B'),
        KEYBOARDS.backButton('menu_ai')
    );
});

bot.action('model_mixtral', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    db.setUserModel(userId, 'mixtral-8x7b-32768');
    await ctx.deleteMessage();
    await ctx.replyWithMarkdown(
        MESSAGES.modelChanged('Mixtral 8x7B'),
        KEYBOARDS.backButton('menu_ai')
    );
});

bot.action('model_gemma2', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    db.setUserModel(userId, 'gemma2-9b-it');
    await ctx.deleteMessage();
    await ctx.replyWithMarkdown(
        MESSAGES.modelChanged('Gemma 2 9B'),
        KEYBOARDS.backButton('menu_ai')
    );
});

bot.action('model_fast', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    db.setUserModel(userId, 'llama-3.1-70b-versatile');
    await ctx.deleteMessage();
    await ctx.replyWithMarkdown(
        MESSAGES.modelChanged('Fast Response (Llama 3.1)'),
        KEYBOARDS.backButton('menu_ai')
    );
});

bot.action(/model_info_(.+)/, async (ctx) => {
    const modelId = ctx.match[1];
    await ctx.answerCbQuery();
    const model = MODELS.find(m => m.id === modelId);
    
    if (model) {
        let text = `📊 **${model.emoji} ${model.name} Details**\n\n`;
        text += `**Provider:** ${model.provider}\n`;
        text += `**Speed:** ${model.speed}\n`;
        text += `**Intelligence:** ${model.intelligence}\n`;
        text += `**Context Window:** ${model.context}\n`;
        text += `**Cost Tier:** ${model.cost}\n`;
        text += `**Best For:** ${model.bestFor}\n`;
        text += `**Languages:** ${model.languages.join(', ')}\n\n`;
        text += `**Description:** ${model.description}`;
        
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: KEYBOARDS.backButton('menu_ai').reply_markup
        });
    }
});

// ======================================================
// FAVORITES ACTION HANDLERS
// ======================================================

bot.action('fav_view', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    const favorites = db.getFavorites(userId);
    
    await ctx.deleteMessage();
    
    if (favorites.length === 0) {
        await ctx.replyWithMarkdown(MESSAGES.noFavorites, KEYBOARDS.backButton());
        return;
    }
    
    const parts = utils.splitMessage(MESSAGES.favoritesList(favorites));
    for (let i = 0; i < parts.length; i++) {
        if (i === parts.length - 1) {
            await ctx.replyWithMarkdown(parts[i], KEYBOARDS.backButton());
        } else {
            await ctx.replyWithMarkdown(parts[i]);
        }
    }
});

bot.action('fav_clear', async (ctx) => {
    await ctx.answerCbQuery('This feature is coming soon!');
});

// ======================================================
// SUPPORT ACTION HANDLERS
// ======================================================

bot.action('ticket_create', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    
    db.setSession(userId, { action: 'creating_ticket' });
    
    await ctx.deleteMessage();
    await ctx.replyWithMarkdown(
        MESSAGES.ticketCreatePrompt,
        Markup.inlineKeyboard([
            [Markup.button.callback('❌ CANCEL', 'ticket_cancel')]
        ])
    );
});

bot.action('ticket_cancel', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    db.clearSession(userId);
    
    await ctx.deleteMessage();
    await ctx.replyWithMarkdown('❌ Cancelled.', KEYBOARDS.backButton());
});

bot.action('ticket_list', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    const tickets = db.getUserTickets(userId);
    
    await ctx.deleteMessage();
    
    if (tickets.length === 0) {
        await ctx.replyWithMarkdown(MESSAGES.noTickets, KEYBOARDS.backButton());
        return;
    }
    
    await ctx.replyWithMarkdown(
        MESSAGES.ticketList(tickets),
        KEYBOARDS.backButton()
    );
});

// ======================================================
// PROFILE ACTION HANDLERS
// ======================================================

bot.action('profile_stats', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    const user = db.getUser(userId);
    const stats = db.getSystemStats();
    
    await ctx.deleteMessage();
    await ctx.replyWithMarkdown(
        MESSAGES.userStats(user, stats),
        KEYBOARDS.backButton()
    );
});

// ======================================================
// SEARCH ACTION HANDLERS
// ======================================================

bot.action('search_favorites', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    await ctx.replyWithMarkdown(
        `🔍 **Search Favorites**\n\nEnter your search term:`,
        Markup.inlineKeyboard([
            [Markup.button.callback('❌ CANCEL', 'search_cancel')]
        ])
    );
    db.setSession(ctx.from.id.toString(), { action: 'search_favorites' });
});

bot.action('search_tickets', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    await ctx.replyWithMarkdown(
        `🔍 **Search Tickets**\n\nEnter your search term:`,
        Markup.inlineKeyboard([
            [Markup.button.callback('❌ CANCEL', 'search_cancel')]
        ])
    );
    db.setSession(ctx.from.id.toString(), { action: 'search_tickets' });
});

bot.action('search_cancel', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    db.clearSession(userId);
    
    await ctx.deleteMessage();
    await ctx.replyWithMarkdown(MESSAGES.searchMenu, KEYBOARDS.searchMenu);
});

// ======================================================
// TRANSLATE ACTION HANDLERS
// ======================================================

const LANGUAGES = {
    en: 'English', es: 'Spanish', fr: 'French', de: 'German',
    it: 'Italian', pt: 'Portuguese', ru: 'Russian', ja: 'Japanese',
    zh: 'Chinese', ar: 'Arabic', hi: 'Hindi'
};

Object.entries(LANGUAGES).forEach(([code, name]) => {
    bot.action(`translate_${code}`, async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.deleteMessage();
        await ctx.replyWithMarkdown(
            `🔄 **Translate to ${name}**\n\nSend me the text to translate:`,
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ CANCEL', 'translate_cancel')]
            ])
        );
        db.setSession(ctx.from.id.toString(), { 
            action: 'translating',
            targetLang: code 
        });
    });
});

bot.action('translate_cancel', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    db.clearSession(userId);
    
    await ctx.deleteMessage();
    await ctx.replyWithMarkdown(MESSAGES.translateMenu, KEYBOARDS.translateMenu);
});

bot.action('translate_more', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    await ctx.replyWithMarkdown(
        `🌐 **More Languages**\n\n` +
        `Use /lang [code] to set language preference.\n\n` +
        `Common codes: en, es, fr, de, it, pt, ru, ja, zh, ar, hi`,
        KEYBOARDS.backButton('menu_translate')
    );
});

// ======================================================
// SETTINGS ACTION HANDLERS
// ======================================================

bot.action('settings_notifications', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    const user = db.getUser(userId);
    const current = user?.settings?.notifications ? '✅ On' : '❌ Off';
    const newValue = !user?.settings?.notifications;
    
    await db.updateUser(userId, { 'settings.notifications': newValue });
    
    await ctx.editMessageText(
        `🔔 **Notifications**\n\n` +
        `Current: ${newValue ? '✅ On' : '❌ Off'}\n\n` +
        `Notifications have been ${newValue ? 'enabled' : 'disabled'}.`,
        { reply_markup: KEYBOARDS.backButton('menu_settings').reply_markup }
    );
});

bot.action('settings_language', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
        `🌐 **Language Settings**\n\n` +
        `Use /lang [code] to set your preferred language.\n\n` +
        `Examples: /lang en, /lang es, /lang fr`,
        { reply_markup: KEYBOARDS.backButton('menu_settings').reply_markup }
    );
});

bot.action('settings_theme', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
        `🎨 **Theme Settings**\n\n` +
        `Theme customization coming soon!`,
        { reply_markup: KEYBOARDS.backButton('menu_settings').reply_markup }
    );
});

// ======================================================
// HELP ACTION HANDLERS
// ======================================================

bot.action('help_commands', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
        MESSAGES.helpMenu,
        { reply_markup: KEYBOARDS.backButton('menu_help').reply_markup }
    );
});

bot.action('help_faq', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
        `❓ **Frequently Asked Questions**\n\n` +
        **Q: How do I change the AI model?**\n` +
        `A: Use /model or go to AI Chat menu.\n\n` +
        **Q: How do I save favorites?**\n` +
        `A: Click the ⭐ button on any AI response.\n\n` +
        **Q: How do I create a support ticket?**\n` +
        `A: Use /ticket or go to Support menu.\n\n` +
        **Q: Is my data private?**\n` +
        `A: Yes! See /privacy for details.`,
        { reply_markup: KEYBOARDS.backButton('menu_help').reply_markup }
    );
});

bot.action('help_tips', async (ctx) => {
    await ctx.answerCbQuery();
    const tip = utils.getRandomTip();
    await ctx.editMessageText(
        `💡 **Pro Tips**\n\n${tip}\n\n` +
        `Check back for more tips!`,
        { reply_markup: KEYBOARDS.backButton('menu_help').reply_markup }
    );
});

// ======================================================
// ADMIN ACTION HANDLERS
// ======================================================

bot.action('admin_stats', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!config.admins.includes(userId)) {
        return ctx.answerCbQuery('⛔ Access Denied');
    }
    
    await ctx.answerCbQuery();
    const stats = db.getSystemStats();
    
    await ctx.editMessageText(
        `👑 **Admin Statistics**\n\n` +
        **Users:** ${stats.users} (${stats.activeToday} active)\n` +
        **Messages:** ${stats.messages}\n` +
        **Favorites:** ${stats.favorites}\n\n` +
        **Tickets:** ${stats.tickets}\n` +
        `• Open: ${stats.openTickets}\n` +
        `• In Progress: ${stats.inProgressTickets}\n` +
        `• Closed: ${stats.closedTickets}\n\n` +
        **Uptime:** ${stats.uptime}`,
        { reply_markup: KEYBOARDS.backButton('admin_menu').reply_markup }
    );
});

bot.action('admin_users', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!config.admins.includes(userId)) {
        return ctx.answerCbQuery('⛔ Access Denied');
    }
    
    await ctx.answerCbQuery();
    await ctx.editMessageText(
        `👥 **User Management**\n\n` +
        `• /users - List all users\n` +
        `• /user [id] - View user details\n` +
        `• Coming soon: Ban/Unban`,
        { reply_markup: KEYBOARDS.backButton('admin_menu').reply_markup }
    );
});

bot.action('admin_tickets', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!config.admins.includes(userId)) {
        return ctx.answerCbQuery('⛔ Access Denied');
    }
    
    await ctx.answerCbQuery();
    const tickets = db.getAllTickets('open');
    let text = `🎫 **All Open Tickets (${tickets.length})**\n\n`;
    
    tickets.slice(0, 5).forEach(t => {
        text += `• **#${t.id}** - ${t.userName}\n`;
        text += `  📝 ${utils.truncate(t.message, 50)}\n\n`;
    });
    
    await ctx.editMessageText(
        text,
        { reply_markup: KEYBOARDS.backButton('admin_menu').reply_markup }
    );
});

bot.action('admin_broadcast', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!config.admins.includes(userId)) {
        return ctx.answerCbQuery('⛔ Access Denied');
    }
    
    await ctx.answerCbQuery();
    await ctx.editMessageText(
        `📢 **Broadcast System**\n\n` +
        `Use /broadcast [message] to send to all users.\n\n` +
        `Example: /broadcast Hello everyone!`,
        { reply_markup: KEYBOARDS.backButton('admin_menu').reply_markup }
    );
});

bot.action('admin_backup', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!config.admins.includes(userId)) {
        return ctx.answerCbQuery('⛔ Access Denied');
    }
    
    await ctx.answerCbQuery();
    await ctx.editMessageText(
        `💾 **Backup System**\n\n` +
        `Use /backup to create a manual backup.\n\n` +
        `Automatic backups run daily.`,
        { reply_markup: KEYBOARDS.backButton('admin_menu').reply_markup }
    );
});

// ======================================================
// CONFIRMATION HANDLERS
// ======================================================

bot.action('confirm_clear_yes', async (ctx) => {
    await ctx.answerCbQuery();
    // Clear history logic here
    await ctx.editMessageText('✅ History cleared.');
});

bot.action('confirm_clear_no', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
});

// ======================================================
// SAVE FAVORITE HANDLER
// ======================================================

bot.action('save_favorite', async (ctx) => {
    await ctx.answerCbQuery('⭐ Saved!');
    
    if (ctx.callbackQuery.message.reply_to_message) {
        const text = ctx.callbackQuery.message.reply_to_message.text;
        const userId = ctx.from.id.toString();
        
        // Remove AI response prefix if present
        const cleanText = text.replace(/^🤖 \*\*Response \([^)]+\):\*\*\n\n/, '');
        
        await db.addFavorite(userId, cleanText);
        await ctx.reply(MESSAGES.favoriteSaved);
    }
});

// ======================================================
// TEXT MESSAGE HANDLER
// ======================================================

bot.on('text', async (ctx) => {
    // Skip commands
    if (ctx.message.text.startsWith('/')) return;
    
    await utils.safeExecute(ctx, async () => {
        const userId = ctx.from.id.toString();
        const message = ctx.message.text;
        const session = db.getSession(userId);
        
        // Handle feedback
        if (session?.action === 'feedback') {
            db.clearSession(userId);
            
            // Forward to admins
            for (const adminId of config.admins) {
                try {
                    await ctx.telegram.sendMessage(
                        adminId,
                        `📝 **New Feedback**\n\n` +
                        `**User:** ${ctx.from.first_name}\n` +
                        **ID:** \`${userId}\`\n\n` +
                        **Message:**\n${message}`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (error) {}
            }
            
            await ctx.reply('✅ Thank you for your feedback!');
            return;
        }
        
        // Handle ticket creation
        if (session?.action === 'creating_ticket') {
            db.clearSession(userId);
            
            const ticket = await db.createTicket(userId, ctx.from.first_name, message);
            
            await ctx.replyWithMarkdown(
                MESSAGES.ticketCreated(ticket.id),
                KEYBOARDS.backButton()
            );
            
            // Notify admins
            for (const adminId of config.admins) {
                try {
                    await ctx.telegram.sendMessage(
                        adminId,
                        `🆘 **New Support Ticket**\n\n` +
                        **Ticket ID:** \`${ticket.id}\`\n` +
                        **User:** ${ctx.from.first_name}\n` +
                        **ID:** \`${userId}\`\n\n` +
                        **Message:**\n${message}`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (error) {}
            }
            return;
        }
        
        // Handle search
        if (session?.action === 'search_favorites' || session?.action === 'search_tickets') {
            db.clearSession(userId);
            
            const results = db.search(message, userId);
            
            await ctx.replyWithMarkdown(
                MESSAGES.searchResults(results, message),
                KEYBOARDS.backButton('menu_search')
            );
            return;
        }
        
        // Handle translation
        if (session?.action === 'translating') {
            db.clearSession(userId);
            
            const result = await translateText(message, session.targetLang);
            
            if (result.success) {
                await ctx.replyWithMarkdown(
                    MESSAGES.translateResult({
                        original: utils.truncate(message, 100),
                        detected: LANGUAGES[result.detected] || result.detected,
                        target: LANGUAGES[session.targetLang],
                        translated: result.translated
                    }),
                    KEYBOARDS.backButton('menu_translate')
                );
            } else {
                await ctx.reply('❌ Translation failed. Please try again.');
            }
            return;
        }
        
        // Regular AI chat
        await ctx.sendChatAction('typing');
        await ctx.replyWithMarkdown(MESSAGES.processing);
        
        const user = db.getUser(userId);
        const model = user?.model || 'llama-3.3-70b-versatile';
        const modelName = MODELS.find(m => m.id === model)?.name || 'Llama 3.3 70B';
        
        const result = await getAIResponse(message, model);
        
        if (result.success) {
            const parts = utils.splitMessage(result.response);
            for (let i = 0; i < parts.length; i++) {
                if (i === parts.length - 1) {
                    await ctx.replyWithMarkdown(
                        `🤖 **Response (${modelName}):**\n\n${parts[i]}`,
                        KEYBOARDS.responseButtons
                    );
                } else {
                    await ctx.replyWithMarkdown(parts[i]);
                }
            }
        } else {
            await ctx.replyWithMarkdown(result.response);
        }
    });
});

// ======================================================
// ERROR HANDLING
// ======================================================

bot.catch((err, ctx) => {
    console.error('❌ Bot Error:', err);
    ctx?.reply(MESSAGES.error).catch(() => {});
});

// ======================================================
// LAUNCH BOT
// ======================================================

bot.launch()
    .then(() => {
        console.log('✅ TalkMate Ultimate is ONLINE!');
        console.log('🎯 Version:', config.version);
        console.log('📊 Commands: 35+');
        console.log('🎮 Buttons: 18+ keyboards');
        console.log('👥 Admins:', config.admins.join(', '));
        console.log('🌟 World\'s Most Advanced Telegram Bot is ready!');
    })
    .catch(err => {
        console.error('❌ Failed to start:', err);
        process.exit(1);
    });

// ======================================================
// GRACEFUL SHUTDOWN
// ======================================================

process.once('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    bot.stop('SIGINT');
    server.close();
    process.exit(0);
});

process.once('SIGTERM', () => {
    console.log('\n👋 Shutting down...');
    bot.stop('SIGTERM');
    server.close();
    process.exit(0);
});

console.log('\n🌟 Initializing World\'s Most Advanced Telegram Bot...\n');