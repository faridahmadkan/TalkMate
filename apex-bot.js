/**
 * =====================================================================
 * TALKMATE - THE WORLD'S #1 AI BOT
 * =====================================================================
 * Version: 10.0.0
 * 
 * This bot represents the pinnacle of Telegram bot engineering.
 * Every button disappears after clicking for a pristine chat experience.
 * 
 * Features:
 * ✓ AI Chat with multiple Groq models
 * ✓ Message forwarding to admin
 * ✓ Favorites system
 * ✓ Support tickets
 * ✓ User statistics
 * ✓ Broadcast command
 * ✓ Search functionality
 * ✓ Clean UI with disappearing buttons
 * =====================================================================
 */

const { Telegraf, Markup } = require('telegraf');
const Groq = require('groq-sdk');
const express = require('express');
const crypto = require('crypto');

// =====================================================================
// CONFIGURATION
// =====================================================================

if (!process.env.BOT_TOKEN || !process.env.GROQ_API_KEY) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
}

// ADMIN IDs - Always as strings
const ADMIN_IDS = process.env.ADMIN_IDS 
    ? process.env.ADMIN_IDS.split(',').map(id => id.trim())
    : ['6939078859', '6336847895'];

const config = {
    token: process.env.BOT_TOKEN,
    groqKey: process.env.GROQ_API_KEY,
    admins: ADMIN_IDS,
    port: process.env.PORT || 3000,
    version: '10.0.0',
    name: 'TalkMate'
};

console.log('✅ Configuration loaded');
console.log(`👥 Admins: ${config.admins.join(', ')}`);

// =====================================================================
// EXPRESS SERVER (for Render)
// =====================================================================

const app = express();
app.get('/', (req, res) => res.send('🤖 TalkMate - World\'s #1 AI Bot'));
app.get('/health', (req, res) => res.status(200).send('OK'));

const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`🌐 Server running on port ${config.port}`);
});

// =====================================================================
// GROQ AI CLIENT
// =====================================================================

const groq = new Groq({ apiKey: config.groqKey });

// =====================================================================
// AVAILABLE AI MODELS
// =====================================================================

const MODELS = [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', emoji: '🦙', desc: 'Most powerful for complex tasks' },
    { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', emoji: '🦙', desc: 'Excellent all-rounder' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', emoji: '🎯', desc: 'Fast and efficient' },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B', emoji: '💎', desc: 'Lightweight and quick' }
];

// =====================================================================
// DATABASE (Simple JSON)
// =====================================================================

class Database {
    constructor() {
        this.users = new Map();
        this.favorites = new Map();
        this.tickets = new Map();
        this.userSessions = new Map();
    }

    registerUser(userId, userData) {
        if (!this.users.has(userId)) {
            this.users.set(userId, {
                id: userId,
                firstName: userData.first_name || '',
                lastName: userData.last_name || '',
                username: userData.username || '',
                firstSeen: Date.now(),
                lastSeen: Date.now(),
                messageCount: 1,
                model: 'llama-3.3-70b-versatile'
            });
        } else {
            const user = this.users.get(userId);
            user.lastSeen = Date.now();
            user.messageCount++;
            this.users.set(userId, user);
        }
        return this.users.get(userId);
    }

    getUser(userId) {
        return this.users.get(userId);
    }

    getAllUsers() {
        return Array.from(this.users.values());
    }

    setUserModel(userId, model) {
        if (this.users.has(userId)) {
            const user = this.users.get(userId);
            user.model = model;
            this.users.set(userId, user);
        }
    }

    addFavorite(userId, text) {
        if (!this.favorites.has(userId)) {
            this.favorites.set(userId, []);
        }
        const favs = this.favorites.get(userId);
        const fav = {
            id: crypto.randomBytes(4).toString('hex').toUpperCase(),
            text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
            fullText: text,
            timestamp: Date.now()
        };
        favs.push(fav);
        return fav;
    }

    getFavorites(userId) {
        return this.favorites.get(userId) || [];
    }

    removeFavorite(userId, favId) {
        if (this.favorites.has(userId)) {
            const favs = this.favorites.get(userId);
            this.favorites.set(userId, favs.filter(f => f.id !== favId));
        }
    }

    createTicket(userId, userName, message) {
        const ticketId = crypto.randomBytes(4).toString('hex').toUpperCase();
        const ticket = {
            id: ticketId,
            userId,
            userName,
            message,
            status: 'open',
            createdAt: Date.now(),
            replies: []
        };
        this.tickets.set(ticketId, ticket);
        return ticket;
    }

    getUserTickets(userId) {
        return Array.from(this.tickets.values()).filter(t => t.userId === userId);
    }

    getAllTickets() {
        return Array.from(this.tickets.values());
    }

    getOpenTickets() {
        return Array.from(this.tickets.values()).filter(t => t.status === 'open');
    }

    addReply(ticketId, from, message) {
        if (this.tickets.has(ticketId)) {
            const ticket = this.tickets.get(ticketId);
            const reply = {
                id: crypto.randomBytes(3).toString('hex').toUpperCase(),
                from,
                message,
                timestamp: Date.now()
            };
            ticket.replies.push(reply);
            ticket.status = 'in-progress';
            return reply;
        }
        return null;
    }

    closeTicket(ticketId) {
        if (this.tickets.has(ticketId)) {
            const ticket = this.tickets.get(ticketId);
            ticket.status = 'closed';
            ticket.closedAt = Date.now();
            return true;
        }
        return false;
    }

    setSession(userId, data) {
        this.userSessions.set(userId, data);
    }

    getSession(userId) {
        return this.userSessions.get(userId);
    }

    clearSession(userId) {
        this.userSessions.delete(userId);
    }

    getStats() {
        return {
            users: this.users.size,
            tickets: this.tickets.size,
            openTickets: this.getOpenTickets().length,
            favorites: Array.from(this.favorites.values()).reduce((sum, arr) => sum + arr.length, 0),
            uptime: process.uptime()
        };
    }
}

const db = new Database();

// =====================================================================
// UTILITY FUNCTIONS
// =====================================================================

function splitMessage(text, maxLength = 4096) {
    if (text.length <= maxLength) return [text];
    const parts = [];
    for (let i = 0; i < text.length; i += maxLength) {
        parts.push(text.substring(i, i + maxLength));
    }
    return parts;
}

async function safeExecute(ctx, fn) {
    try {
        await fn();
    } catch (error) {
        console.error('Error:', error.message);
        await ctx.reply('❌ An error occurred. Please try again.').catch(() => {});
    }
}

// =====================================================================
// FORWARD TO ADMIN (with string IDs)
// =====================================================================

async function forwardToAdmin(ctx, type = 'message') {
    const user = ctx.from;
    const message = ctx.message;
    
    for (const adminId of config.admins) {
        try {
            let text = `📨 **New ${type}**\n\n`;
            text += `**User:** ${user.first_name} ${user.last_name || ''}\n`;
            text += `**Username:** @${user.username || 'N/A'}\n`;
            text += `**ID:** \`${user.id}\`\n`;
            text += `**Time:** ${new Date().toLocaleString()}\n\n`;
            
            if (type === 'message') {
                text += `**Message:**\n${message.text}`;
            } else {
                text += `**Command:**\n${message.text}`;
            }
            
            await ctx.telegram.sendMessage(adminId, text, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error(`Failed to forward to admin ${adminId}:`, error.message);
        }
    }
}

// =====================================================================
// BROADCAST TO ALL USERS
// =====================================================================

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

// =====================================================================
// AI RESPONSE FUNCTION
// =====================================================================

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
        
        return {
            success: true,
            response: completion.choices[0]?.message?.content || 'No response generated.'
        };
    } catch (error) {
        console.error('AI Error:', error.message);
        return {
            success: false,
            response: '❌ AI service temporarily unavailable. Please try again.'
        };
    }
}

// =====================================================================
// BEAUTIFUL UI MESSAGES
// =====================================================================

const UI = {
    welcome: (name) => 
        `🌟 **Welcome to TalkMate, ${name}!** 🌟\n\n` +
        `I'm the world's most advanced AI bot, powered by Groq technology.\n\n` +
        `✨ **What I Can Do:**\n` +
        `• Chat with multiple AI models\n` +
        `• Save favorite responses\n` +
        `• Create support tickets\n` +
        `• Track your statistics\n` +
        `• And much more!\n\n` +
        `👇 **Select an option below:**`,

    mainMenu: 
        `🌟 **MAIN MENU** 🌟\n\n` +
        `Choose your destination:`,

    aiMenu:
        `🤖 **AI ASSISTANT**\n\n` +
        `Select an AI model or start chatting:`,

    favoritesMenu:
        `⭐ **YOUR FAVORITES**\n\n` +
        `Manage your saved responses:`,

    supportMenu:
        `🆘 **SUPPORT CENTER**\n\n` +
        `Get help from our team:`,

    profileMenu:
        `👤 **YOUR PROFILE**\n\n` +
        `View your statistics and activity:`,

    modelSelect:
        `🤖 **CHOOSE AI MODEL**\n\n` +
        `Each model has unique strengths:`,

    modelChanged: (model) =>
        `✅ **Model Updated**\n\n` +
        `Now using: **${model}**\n` +
        `Your conversations will be powered by this intelligence.`,

    ticketCreated: (id) =>
        `✅ **Ticket Created**\n\n` +
        `Ticket ID: \`${id}\`\n\n` +
        `Our team will respond within 24 hours.`,

    processing:
        `⏳ **Processing...**\n\n` +
        `Please wait a moment.`,

    error:
        `❌ **Error**\n\n` +
        `Something went wrong. Please try again.`,

    noFavorites:
        `⭐ **No Favorites Yet**\n\n` +
        `Save responses using the ⭐ button when they appear.`,

    noTickets:
        `📭 **No Tickets**\n\n` +
        `Create a ticket using the support menu.`,

    proTip: () => {
        const tips = [
            "💡 You can change AI models anytime!",
            "💡 Save interesting responses with the ⭐ button!",
            "💡 Use /broadcast if you're an admin!",
            "💡 Create tickets for quick support!",
            "💡 Different models excel at different tasks!"
        ];
        return tips[Math.floor(Math.random() * tips.length)];
    }
};

// =====================================================================
// BUTTON DEFINITIONS (All disappear after clicking)
// =====================================================================

const Buttons = {
    mainMenu: Markup.inlineKeyboard([
        [Markup.button.callback('🤖 AI CHAT', 'menu_ai')],
        [Markup.button.callback('⭐ FAVORITES', 'menu_favorites'),
         Markup.button.callback('🆘 SUPPORT', 'menu_support')],
        [Markup.button.callback('👤 PROFILE', 'menu_profile'),
         Markup.button.callback('ℹ️ ABOUT', 'menu_about')]
    ]),

    aiMenu: Markup.inlineKeyboard([
        [Markup.button.callback('💬 START CHAT', 'chat_start')],
        [Markup.button.callback('🦙 CHANGE MODEL', 'menu_models')],
        [Markup.button.callback('🔙 BACK', 'menu_main')]
    ]),

    modelMenu: Markup.inlineKeyboard([
        [Markup.button.callback('🦙 Llama 3.3 70B', 'model_llama33'),
         Markup.button.callback('🎯 Mixtral 8x7B', 'model_mixtral')],
        [Markup.button.callback('💎 Gemma 2 9B', 'model_gemma2'),
         Markup.button.callback('⚡ Fast', 'model_fast')],
        [Markup.button.callback('🔙 BACK', 'menu_ai')]
    ]),

    favoritesMenu: Markup.inlineKeyboard([
        [Markup.button.callback('📋 VIEW ALL', 'fav_view')],
        [Markup.button.callback('🔙 BACK', 'menu_main')]
    ]),

    supportMenu: Markup.inlineKeyboard([
        [Markup.button.callback('📝 CREATE TICKET', 'ticket_create')],
        [Markup.button.callback('📋 MY TICKETS', 'ticket_list')],
        [Markup.button.callback('🔙 BACK', 'menu_main')]
    ]),

    profileMenu: Markup.inlineKeyboard([
        [Markup.button.callback('📊 STATISTICS', 'profile_stats')],
        [Markup.button.callback('🔙 BACK', 'menu_main')]
    ]),

    backButton: Markup.inlineKeyboard([
        [Markup.button.callback('🔙 BACK', 'menu_main')]
    ])
};

// =====================================================================
// INITIALIZE BOT
// =====================================================================

const bot = new Telegraf(config.token);

// =====================================================================
// MIDDLEWARE - Register user and forward messages
// =====================================================================

bot.use(async (ctx, next) => {
    if (ctx.from) {
        const userId = ctx.from.id.toString();
        db.registerUser(userId, ctx.from);
        
        // Forward non-command messages to admin
        if (ctx.message?.text && !ctx.message.text.startsWith('/')) {
            await forwardToAdmin(ctx, 'message');
        }
    }
    return next();
});

// =====================================================================
// START COMMAND
// =====================================================================

bot.start(async (ctx) => {
    await safeExecute(ctx, async () => {
        await ctx.replyWithMarkdown(
            UI.welcome(ctx.from.first_name),
            Buttons.mainMenu
        );
        
        // Send pro tip after 3 seconds
        setTimeout(async () => {
            await ctx.replyWithMarkdown(UI.proTip());
        }, 3000);
    });
});

// =====================================================================
// MENU NAVIGATION (Buttons disappear after clicking)
// =====================================================================

bot.action('menu_main', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage(); // Button disappears
    await ctx.replyWithMarkdown(UI.mainMenu, Buttons.mainMenu);
});

bot.action('menu_ai', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage(); // Button disappears
    await ctx.replyWithMarkdown(UI.aiMenu, Buttons.aiMenu);
});

bot.action('menu_favorites', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage(); // Button disappears
    await ctx.replyWithMarkdown(UI.favoritesMenu, Buttons.favoritesMenu);
});

bot.action('menu_support', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage(); // Button disappears
    await ctx.replyWithMarkdown(UI.supportMenu, Buttons.supportMenu);
});

bot.action('menu_profile', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage(); // Button disappears
    await ctx.replyWithMarkdown(UI.profileMenu, Buttons.profileMenu);
});

bot.action('menu_about', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage(); // Button disappears
    
    const about = 
        `ℹ️ **About TalkMate**\n\n` +
        `**Version:** 10.0.0\n` +
        `**Powered by:** Groq AI\n` +
        `**Developer:** Khan's AI Solutions\n\n` +
        `**Features:**\n` +
        `• Multiple AI models\n` +
        `• Favorites system\n` +
        `• Support tickets\n` +
        `• User statistics\n` +
        `• Admin broadcast\n\n` +
        `**The world's most advanced Telegram bot!**`;
    
    await ctx.replyWithMarkdown(about, Buttons.backButton);
});

// =====================================================================
// AI CHAT
// =====================================================================

bot.action('chat_start', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage(); // Button disappears
    await ctx.replyWithMarkdown(
        `💬 **Chat Mode Activated**\n\n` +
        `Send me any message and I'll respond!\n\n` +
        `Use /start to return to the menu.`
    );
});

// =====================================================================
// MODEL SELECTION
// =====================================================================

bot.action('menu_models', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage(); // Button disappears
    await ctx.replyWithMarkdown(UI.modelSelect, Buttons.modelMenu);
});

// Model selection handlers
bot.action('model_llama33', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    db.setUserModel(userId, 'llama-3.3-70b-versatile');
    await ctx.deleteMessage(); // Button disappears
    await ctx.replyWithMarkdown(
        UI.modelChanged('Llama 3.3 70B'),
        Buttons.backButton
    );
});

bot.action('model_mixtral', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    db.setUserModel(userId, 'mixtral-8x7b-32768');
    await ctx.deleteMessage(); // Button disappears
    await ctx.replyWithMarkdown(
        UI.modelChanged('Mixtral 8x7B'),
        Buttons.backButton
    );
});

bot.action('model_gemma2', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    db.setUserModel(userId, 'gemma2-9b-it');
    await ctx.deleteMessage(); // Button disappears
    await ctx.replyWithMarkdown(
        UI.modelChanged('Gemma 2 9B'),
        Buttons.backButton
    );
});

bot.action('model_fast', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    db.setUserModel(userId, 'llama-3.1-70b-versatile');
    await ctx.deleteMessage(); // Button disappears
    await ctx.replyWithMarkdown(
        UI.modelChanged('Fast Response'),
        Buttons.backButton
    );
});

// =====================================================================
// FAVORITES
// =====================================================================

bot.action('fav_view', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    const favorites = db.getFavorites(userId);
    
    await ctx.deleteMessage(); // Button disappears
    
    if (favorites.length === 0) {
        await ctx.replyWithMarkdown(UI.noFavorites, Buttons.backButton);
        return;
    }
    
    let text = '⭐ **Your Favorites**\n\n';
    favorites.slice(-5).reverse().forEach((fav, i) => {
        text += `**${i + 1}.** ${fav.text}\n`;
        text += `   ID: \`${fav.id}\`\n\n`;
    });
    
    await ctx.replyWithMarkdown(text, Buttons.backButton);
});

// Save favorite (called from AI responses)
bot.action('save_favorite', async (ctx) => {
    await ctx.answerCbQuery('⭐ Saved!');
    
    if (ctx.callbackQuery.message.reply_to_message) {
        const text = ctx.callbackQuery.message.reply_to_message.text;
        const userId = ctx.from.id.toString();
        db.addFavorite(userId, text);
        await ctx.reply('⭐ Added to favorites!');
    }
});

// =====================================================================
// SUPPORT TICKETS
// =====================================================================

bot.action('ticket_create', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    
    db.setSession(userId, { action: 'creating_ticket' });
    
    await ctx.deleteMessage(); // Button disappears
    await ctx.replyWithMarkdown(
        `📝 **Create Support Ticket**\n\n` +
        `Please describe your issue in detail:`,
        Markup.inlineKeyboard([
            [Markup.button.callback('❌ CANCEL', 'ticket_cancel')]
        ])
    );
});

bot.action('ticket_cancel', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    db.clearSession(userId);
    
    await ctx.deleteMessage(); // Button disappears
    await ctx.replyWithMarkdown('❌ Cancelled.', Buttons.backButton);
});

bot.action('ticket_list', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    const tickets = db.getUserTickets(userId);
    
    await ctx.deleteMessage(); // Button disappears
    
    if (tickets.length === 0) {
        await ctx.replyWithMarkdown(UI.noTickets, Buttons.backButton);
        return;
    }
    
    let text = '📋 **Your Tickets**\n\n';
    tickets.slice(-5).reverse().forEach((t, i) => {
        const status = t.status === 'open' ? '🟢 Open' : t.status === 'closed' ? '🔴 Closed' : '🟡 In Progress';
        text += `**${i + 1}.** #${t.id} - ${status}\n`;
        text += `   📝 ${t.message.substring(0, 50)}...\n\n`;
    });
    
    await ctx.replyWithMarkdown(text, Buttons.backButton);
});

// =====================================================================
// PROFILE STATISTICS
// =====================================================================

bot.action('profile_stats', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    const user = db.getUser(userId);
    const stats = db.getStats();
    const favorites = db.getFavorites(userId);
    const tickets = db.getUserTickets(userId);
    
    await ctx.deleteMessage(); // Button disappears
    
    const text = 
        `📊 **Your Statistics**\n\n` +
        `**Personal:**\n` +
        `• Messages: ${user?.messageCount || 0}\n` +
        `• Favorites: ${favorites.length}\n` +
        `• Tickets: ${tickets.length}\n\n` +
        `**Global:**\n` +
        `• Total Users: ${stats.users}\n` +
        `• Open Tickets: ${stats.openTickets}\n` +
        `• Total Favorites: ${stats.favorites}\n` +
        `• Uptime: ${Math.floor(stats.uptime / 60)} minutes`;
    
    await ctx.replyWithMarkdown(text, Buttons.backButton);
});

// =====================================================================
// TEXT MESSAGE HANDLER
// =====================================================================

bot.on('text', async (ctx) => {
    // Skip commands
    if (ctx.message.text.startsWith('/')) return;
    
    await safeExecute(ctx, async () => {
        const userId = ctx.from.id.toString();
        const message = ctx.message.text;
        const session = db.getSession(userId);
        
        // Handle ticket creation
        if (session?.action === 'creating_ticket') {
            db.clearSession(userId);
            
            const ticket = db.createTicket(userId, ctx.from.first_name, message);
            
            await ctx.replyWithMarkdown(
                UI.ticketCreated(ticket.id),
                Buttons.backButton
            );
            
            // Notify admins
            for (const adminId of config.admins) {
                try {
                    await ctx.telegram.sendMessage(
                        adminId,
                        `🆘 **New Support Ticket**\n\n` +
                        `Ticket ID: \`${ticket.id}\`\n` +
                        `User: ${ctx.from.first_name}\n` +
                        `ID: \`${userId}\`\n\n` +
                        `**Message:**\n${message}`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (error) {
                    console.error(`Failed to notify admin ${adminId}:`, error.message);
                }
            }
            return;
        }
        
        // Regular AI chat
        await ctx.sendChatAction('typing');
        await ctx.replyWithMarkdown(UI.processing);
        
        const user = db.getUser(userId);
        const model = user?.model || 'llama-3.3-70b-versatile';
        
        const result = await getAIResponse(message, model);
        
        const parts = splitMessage(result.response);
        for (const part of parts) {
            await ctx.replyWithMarkdown(part, {
                reply_markup: {
                    inline_keyboard: [
                        [Markup.button.callback('⭐ Save to Favorites', 'save_favorite')]
                    ]
                }
            });
        }
    });
});

// =====================================================================
// ADMIN COMMANDS
// =====================================================================

// Broadcast command (admin only)
bot.command('broadcast', async (ctx) => {
    const userId = ctx.from.id.toString();
    
    if (!config.admins.includes(userId)) {
        await ctx.reply('⛔ Admin only command.');
        return;
    }
    
    const message = ctx.message.text.replace('/broadcast', '').trim();
    
    if (!message) {
        await ctx.reply('Usage: /broadcast [message]');
        return;
    }
    
    const result = await broadcastToAll(ctx, message);
    
    await ctx.replyWithMarkdown(
        `✅ **Broadcast Complete**\n\n` +
        `Sent: ${result.sent}\n` +
        `Failed: ${result.failed}\n` +
        `Total: ${result.total}`
    );
});

// Stats command (admin only)
bot.command('stats', async (ctx) => {
    const userId = ctx.from.id.toString();
    const isAdmin = config.admins.includes(userId);
    const stats = db.getStats();
    
    let text = 
        `📊 **System Statistics**\n\n` +
        `**Users:** ${stats.users}\n` +
        `**Tickets:** ${stats.tickets} (${stats.openTickets} open)\n` +
        `**Favorites:** ${stats.favorites}\n` +
        `**Uptime:** ${Math.floor(stats.uptime / 60)} minutes`;
    
    if (isAdmin) {
        text += `\n\n_You are an administrator._`;
    }
    
    await ctx.replyWithMarkdown(text);
});

// =====================================================================
// HELP COMMAND
// =====================================================================

bot.help(async (ctx) => {
    const userId = ctx.from.id.toString();
    const isAdmin = config.admins.includes(userId);
    
    let text = 
        `📚 **Available Commands**\n\n` +
        `**General:**\n` +
        `/start - Start the bot\n` +
        `/help - Show this help\n` +
        `/menu - Show main menu\n` +
        `/stats - View statistics\n\n` +
        `**AI:**\n` +
        `Just send any message to chat!\n` +
        `Use the menu to change AI models.\n\n` +
        `**Favorites:**\n` +
        `Save responses with the ⭐ button.\n` +
        `View them in the Favorites menu.\n\n` +
        `**Support:**\n` +
        `Create tickets in the Support menu.`;
    
    if (isAdmin) {
        text += `\n\n**Admin:**\n` +
                `/broadcast - Send to all users`;
    }
    
    await ctx.replyWithMarkdown(text);
});

// Menu command
bot.command('menu', async (ctx) => {
    await ctx.replyWithMarkdown(UI.mainMenu, Buttons.mainMenu);
});

// =====================================================================
// ERROR HANDLING
// =====================================================================

bot.catch((err, ctx) => {
    console.error('❌ Bot Error:', err.message);
    ctx?.reply(UI.error).catch(() => {});
});

// =====================================================================
// LAUNCH BOT
// =====================================================================

bot.launch()
    .then(() => {
        console.log('✅ TalkMate is ONLINE!');
        console.log('🎯 Version: 10.0.0');
        console.log('👥 Admins:', config.admins.join(', '));
        console.log('🌍 World\'s #1 AI Bot is ready!');
    })
    .catch(err => {
        console.error('❌ Failed to start:', err);
        process.exit(1);
    });

// =====================================================================
// GRACEFUL SHUTDOWN
// =====================================================================

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

console.log('\n🌟 Initializing World\'s #1 AI Bot...\n');