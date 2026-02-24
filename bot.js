/**
 * ======================================================
 * TALKMATE COMBINED PROFESSIONAL BOT
 * ======================================================
 * Version: 7.0.0 Ultimate
 * Features: 
 *   - User-facing AI Assistant (Groq-powered)
 *   - Admin Management Panel (Separate bot instance)
 *   - Both bots run in the same process
 *   - No 409 conflicts, no file locking issues
 * ======================================================
 */

const { Telegraf, Markup } = require('telegraf');
const Groq = require('groq-sdk');
const express = require('express');
const database = require('./database');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ======================================================
// CONFIGURATION
// ======================================================

// Check required environment variables
if (!process.env.BOT_TOKEN || !process.env.GROQ_API_KEY || !process.env.ADMIN_BOT_TOKEN) {
    console.error('❌ Missing required environment variables');
    console.error('Required: BOT_TOKEN, GROQ_API_KEY, ADMIN_BOT_TOKEN');
    process.exit(1);
}

const config = {
    mainBot: {
        token: process.env.BOT_TOKEN,
        name: 'TalkMate AI',
        version: '7.0.0'
    },
    adminBot: {
        token: process.env.ADMIN_BOT_TOKEN,
        name: 'TalkMate Admin',
        version: '1.0.0'
    },
    api: {
        groq: process.env.GROQ_API_KEY,
        port: process.env.PORT || 3000
    },
    admins: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : ['6939078859', '6336847895']
};

// ======================================================
// EXPRESS SERVER
// ======================================================

const app = express();
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        version: config.mainBot.version,
        mainBot: config.mainBot.name,
        adminBot: config.adminBot.name,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => res.status(200).send('OK'));

const server = app.listen(config.api.port, '0.0.0.0', () => {
    console.log(`✅ Express server running on port ${config.api.port}`);
});

// ======================================================
// SHARED DATA STORAGE
// ======================================================

const userConversations = new Map();
const userPreferences = new Map();
const userActivity = new Map();
const userNotes = new Map();
const userFavorites = new Map();
const adminSessions = new Map(); // For admin bot state

// ======================================================
// AVAILABLE AI MODELS
// ======================================================

const AVAILABLE_MODELS = [
    { 
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B',
        provider: 'Meta',
        description: 'Most powerful, best for complex tasks',
        fa: 'قدرتمندترین، بهترین برای کارهای پیچیده'
    },
    {
        id: 'llama-3.1-70b-versatile',
        name: 'Llama 3.1 70B',
        provider: 'Meta',
        description: 'Excellent all-rounder',
        fa: 'عالی برای همه موارد'
    },
    {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        provider: 'Mistral',
        description: 'Fast and efficient',
        fa: 'سریع و کارآمد'
    },
    {
        id: 'gemma2-9b-it',
        name: 'Gemma 2 9B',
        provider: 'Google',
        description: 'Lightweight and quick',
        fa: 'سبک و سریع'
    }
];

// ======================================================
// TRANSLATIONS
// ======================================================

const translations = {
    en: {
        welcome: "🌟 **Welcome {name}!** 🌟\n\nI'm your AI Assistant powered by Groq.",
        error: "❌ An error occurred. Please try again.",
        startChat: "💬 Start Chatting",
        helpSupport: "🆘 Help & Support",
        about: "ℹ️ About",
        settings: "⚙️ Settings",
        privacyGuide: "🔒 Privacy Guide",
        back: "🔙 Back",
        mainMenu: "🏠 Main Menu",
        yesClear: "✅ Yes, clear it",
        noKeep: "❌ No, keep it",
        saveFavorite: "⭐ Save",
        proTip: "💡 Pro Tip",
        
        supportTitle: "🆘 **Support Request**\n\nPlease describe your issue:",
        ticketCreated: "✅ **Support ticket created!**\n\nTicket ID: `{id}`",
        
        modelSelection: "🤖 **Select AI Model:**",
        modelChanged: "✅ Model changed to **{model}**",
        modelError: "⚠️ Model error. Try switching to Llama 3.3 70B.",
        
        clearConfirm: "🗑️ **Clear Conversation History**\n\nAre you sure?",
        cleared: "✅ **Conversation history cleared!**",
        
        noteSaved: "✅ **Note saved!**\nID: `{id}`",
        noNotes: "📝 **No notes yet.**",
        enterNote: "📝 **Enter your note:**",
        
        favoriteSaved: "⭐ **Saved to favorites!**",
        noFavorites: "⭐ **No favorites yet.**",
        
        feedbackThanks: "✅ **Thank you for your feedback!**",
        
        statsTitle: "📊 **Your Statistics**\n\n",
        statsMessages: "**Messages sent:** {user}\n",
        statsAI: "**AI responses:** {ai}\n",
        statsModel: "**Current model:** {model}\n",
        statsNotes: "**Notes saved:** {notes}\n",
        statsFavorites: "**Favorites:** {fav}\n",
        statsID: "**User ID:** `{id}`\n",
        
        proTips: [
            "💡 Use /language to switch between English and Persian!",
            "💡 Use /model to change AI models!",
            "💡 Save info with /note command!",
            "💡 Bookmark responses with /favorite!"
        ]
    },
    fa: {
        welcome: "🌟 **خوش آمدید {name}!** 🌟\n\nمن دستیار هوش مصنوعی شما هستم.",
        error: "❌ خطایی رخ داد. لطفاً دوباره تلاش کنید.",
        startChat: "💬 شروع گفتگو",
        helpSupport: "🆘 راهنما و پشتیبانی",
        about: "ℹ️ درباره",
        settings: "⚙️ تنظیمات",
        privacyGuide: "🔒 حریم خصوصی",
        back: "🔙 بازگشت",
        mainMenu: "🏠 منوی اصلی",
        yesClear: "✅ بله، پاک کن",
        noKeep: "❌ خیر، نگه دار",
        saveFavorite: "⭐ ذخیره",
        proTip: "💡 نکته",
        
        supportTitle: "🆘 **درخواست پشتیبانی**\n\nلطفاً مشکل خود را توضیح دهید:",
        ticketCreated: "✅ **تیکت ایجاد شد!**\n\nشناسه: `{id}`",
        
        modelSelection: "🤖 **انتخاب مدل:**",
        modelChanged: "✅ مدل به **{model}** تغییر یافت",
        modelError: "⚠️ خطای مدل. به Llama 3.3 70B تغییر دهید.",
        
        clearConfirm: "🗑️ **پاک کردن تاریخچه**\n\nآیا مطمئن هستید؟",
        cleared: "✅ **تاریخچه پاک شد!**",
        
        noteSaved: "✅ **یادداشت ذخیره شد!**\nشناسه: `{id}`",
        noNotes: "📝 **یادداشتی ندارید.**",
        enterNote: "📝 **یادداشت خود را وارد کنید:**",
        
        favoriteSaved: "⭐ **ذخیره شد!**",
        noFavorites: "⭐ **مورد علاقه‌ای ندارید.**",
        
        feedbackThanks: "✅ **متشکریم!**",
        
        statsTitle: "📊 **آمار شما**\n\n",
        statsMessages: "**پیام‌ها:** {user}\n",
        statsAI: "**پاسخ‌ها:** {ai}\n",
        statsModel: "**مدل:** {model}\n",
        statsNotes: "**یادداشت‌ها:** {notes}\n",
        statsFavorites: "**علاقه‌مندی‌ها:** {fav}\n",
        statsID: "**شناسه:** `{id}`\n",
        
        proTips: [
            "💡 با /language زبان را تغییر دهید!",
            "💡 با /model مدل را عوض کنید!",
            "💡 اطلاعات را با /note ذخیره کنید!",
            "💡 پاسخ‌ها را با /favorite نشانه‌گذاری کنید!"
        ]
    }
};

// ======================================================
// UTILITY FUNCTIONS
// ======================================================

function getUserLanguage(userId) {
    const prefs = userPreferences.get(userId) || {};
    return prefs.language || 'en';
}

function getProTip(userId) {
    const lang = getUserLanguage(userId);
    const tips = lang === 'fa' ? translations.fa.proTips : translations.en.proTips;
    return tips[Math.floor(Math.random() * tips.length)];
}

function formatDate(date) {
    return new Date(date).toLocaleString();
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(' ');
}

function generateId(prefix = '') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function splitMessage(text, maxLength = 4096) {
    if (text.length <= maxLength) return [text];
    return text.match(new RegExp(`.{1,${maxLength}}`, 'g')) || [];
}

// Safe execution wrapper
async function safeExecute(ctx, fn) {
    try {
        await fn();
    } catch (error) {
        console.error('Error:', error);
        try {
            await ctx.reply('❌ An error occurred. Please try again.');
        } catch (e) {}
    }
}

// ======================================================
// GROQ AI FUNCTION
// ======================================================

const groq = new Groq({ apiKey: config.api.groq });

async function getAIResponse(userMessage, userId, model = 'llama-3.3-70b-versatile') {
    try {
        if (!userConversations.has(userId)) {
            userConversations.set(userId, []);
        }
        const history = userConversations.get(userId);
        
        history.push({ role: 'user', content: userMessage });
        
        if (history.length > 20) {
            history.splice(0, history.length - 20);
        }
        
        const messages = history.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
        
        const lang = getUserLanguage(userId);
        if (lang === 'fa') {
            messages.unshift({
                role: 'system',
                content: 'شما یک دستیار هوش مصنوعی حرفه‌ای هستید. به زبان فارسی پاسخ دهید.'
            });
        } else {
            messages.unshift({
                role: 'system',
                content: 'You are a professional AI assistant. Be helpful and friendly.'
            });
        }
        
        const completion = await groq.chat.completions.create({
            model: model,
            messages: messages,
            temperature: 0.7,
            max_tokens: 2048
        });
        
        const reply = completion.choices[0]?.message?.content || 'No response.';
        history.push({ role: 'assistant', content: reply });
        
        return { success: true, response: reply };
        
    } catch (error) {
        console.error('Groq API Error:', error);
        return { 
            success: false, 
            response: '⚠️ Error. Please try again.' 
        };
    }
}

// ======================================================
// ==============  MAIN USER BOT  =======================
// ======================================================

const mainBot = new Telegraf(config.mainBot.token);

// Main Bot Commands
mainBot.start(async (ctx) => {
    await safeExecute(ctx, async () => {
        const userId = ctx.from.id;
        database.registerUser(userId.toString(), {
            id: userId.toString(),
            first_name: ctx.from.first_name,
            last_name: ctx.from.last_name,
            username: ctx.from.username
        });
        
        const prefs = userPreferences.get(userId) || {};
        
        if (!prefs.language) {
            await ctx.replyWithMarkdown(
                '🌐 **Welcome! / خوش آمدید!**\n\nSelect language / زبان را انتخاب کنید:',
                Markup.inlineKeyboard([
                    [Markup.button.callback('🇬🇧 English', 'lang_en')],
                    [Markup.button.callback('🇮🇷 فارسی', 'lang_fa')]
                ])
            );
        } else {
            const lang = prefs.language;
            const t = lang === 'fa' ? translations.fa : translations.en;
            
            await ctx.replyWithMarkdown(
                t.welcome.replace('{name}', ctx.from.first_name),
                Markup.inlineKeyboard([
                    [Markup.button.callback(t.startChat, 'start_chat')],
                    [Markup.button.callback(t.helpSupport, 'help_support'), 
                     Markup.button.callback(t.about, 'about_bot')],
                    [Markup.button.callback(t.settings, 'settings'), 
                     Markup.button.callback(t.privacyGuide, 'privacy_guide')]
                ])
            );
            
            setTimeout(() => ctx.replyWithMarkdown(getProTip(userId)), 2000);
        }
    });
});

mainBot.command('language', async (ctx) => {
    await ctx.replyWithMarkdown(
        '🌐 **Select Language / انتخاب زبان**',
        Markup.inlineKeyboard([
            [Markup.button.callback('🇬🇧 English', 'lang_en')],
            [Markup.button.callback('🇮🇷 فارسی', 'lang_fa')]
        ])
    );
});

mainBot.command('model', async (ctx) => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    
    const buttons = AVAILABLE_MODELS.map(m => 
        [Markup.button.callback(lang === 'fa' ? `${m.name} - ${m.fa}` : m.name, `model_${m.id}`)]
    );
    
    await ctx.replyWithMarkdown(
        lang === 'fa' ? translations.fa.modelSelection : translations.en.modelSelection,
        Markup.inlineKeyboard(buttons)
    );
});

AVAILABLE_MODELS.forEach(m => {
    mainBot.action(`model_${m.id}`, async (ctx) => {
        const userId = ctx.from.id;
        const lang = getUserLanguage(userId);
        
        if (!userPreferences.has(userId)) userPreferences.set(userId, {});
        userPreferences.get(userId).model = m.id;
        
        await ctx.answerCbQuery(lang === 'fa' ? 'انتخاب شد' : 'Selected');
        await ctx.editMessageText(
            (lang === 'fa' ? translations.fa.modelChanged : translations.en.modelChanged)
                .replace('{model}', m.name)
        );
    });
});

mainBot.command('support', async (ctx) => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    
    await ctx.replyWithMarkdown(
        lang === 'fa' ? translations.fa.supportTitle : translations.en.supportTitle,
        Markup.forceReply()
    );
    userPreferences.set(`${userId}_state`, 'awaiting_support');
});

mainBot.command('clear', async (ctx) => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa : translations.en;
    
    await ctx.replyWithMarkdown(
        t.clearConfirm,
        Markup.inlineKeyboard([
            [Markup.button.callback(t.yesClear, 'clear_history')],
            [Markup.button.callback(t.noKeep, 'cancel')]
        ])
    );
});

mainBot.command('stats', async (ctx) => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa : translations.en;
    
    const history = userConversations.get(userId) || [];
    const notes = userNotes.get(userId) || [];
    const favs = userFavorites.get(userId) || [];
    const prefs = userPreferences.get(userId) || {};
    
    const statsText = t.statsTitle +
        t.statsMessages.replace('{user}', history.filter(m => m.role === 'user').length) +
        t.statsAI.replace('{ai}', history.filter(m => m.role === 'assistant').length) +
        t.statsModel.replace('{model}', prefs.model || 'Llama 3.3 70B') +
        t.statsNotes.replace('{notes}', notes.length) +
        t.statsFavorites.replace('{fav}', favs.length) +
        t.statsID.replace('{id}', userId);
    
    await ctx.replyWithMarkdown(statsText);
});

// Main Bot Callbacks
mainBot.action('lang_en', async (ctx) => {
    const userId = ctx.from.id;
    if (!userPreferences.has(userId)) userPreferences.set(userId, {});
    userPreferences.get(userId).language = 'en';
    
    await ctx.answerCbQuery('Language set to English');
    await ctx.editMessageText(
        translations.en.welcome.replace('{name}', ctx.from.first_name),
        {
            reply_markup: {
                inline_keyboard: [
                    [Markup.button.callback(translations.en.startChat, 'start_chat')],
                    [Markup.button.callback(translations.en.helpSupport, 'help_support'), 
                     Markup.button.callback(translations.en.about, 'about_bot')],
                    [Markup.button.callback(translations.en.settings, 'settings'), 
                     Markup.button.callback(translations.en.privacyGuide, 'privacy_guide')]
                ]
            }
        }
    );
});

mainBot.action('lang_fa', async (ctx) => {
    const userId = ctx.from.id;
    if (!userPreferences.has(userId)) userPreferences.set(userId, {});
    userPreferences.get(userId).language = 'fa';
    
    await ctx.answerCbQuery('زبان به فارسی تنظیم شد');
    await ctx.editMessageText(
        translations.fa.welcome.replace('{name}', ctx.from.first_name),
        {
            reply_markup: {
                inline_keyboard: [
                    [Markup.button.callback(translations.fa.startChat, 'start_chat')],
                    [Markup.button.callback(translations.fa.helpSupport, 'help_support'), 
                     Markup.button.callback(translations.fa.about, 'about_bot')],
                    [Markup.button.callback(translations.fa.settings, 'settings'), 
                     Markup.button.callback(translations.fa.privacyGuide, 'privacy_guide')]
                ]
            }
        }
    );
});

mainBot.action('clear_history', async (ctx) => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    
    userConversations.delete(userId);
    await ctx.answerCbQuery(lang === 'fa' ? 'پاک شد' : 'Cleared');
    await ctx.editMessageText(lang === 'fa' ? translations.fa.cleared : translations.en.cleared);
});

mainBot.action('save_favorite', async (ctx) => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa : translations.en;
    
    const history = userConversations.get(userId) || [];
    const last = history.filter(m => m.role === 'assistant').pop();
    
    if (last) {
        if (!userFavorites.has(userId)) userFavorites.set(userId, []);
        userFavorites.get(userId).push({
            text: last.content.substring(0, 100) + '...',
            date: new Date().toISOString()
        });
        await ctx.answerCbQuery(lang === 'fa' ? 'ذخیره شد' : 'Saved');
        await ctx.reply(t.favoriteSaved);
    }
});

mainBot.action('start_chat', async (ctx) => {
    const lang = getUserLanguage(ctx.from.id);
    await ctx.answerCbQuery();
    await ctx.replyWithMarkdown(
        lang === 'fa' ? '💬 **آماده گفتگو!**' : '💬 **Ready to chat!**'
    );
});

// Main Bot Message Handler
mainBot.on('text', async (ctx) => {
    await safeExecute(ctx, async () => {
        const userId = ctx.from.id;
        const msg = ctx.message.text;
        const state = userPreferences.get(`${userId}_state`);
        const lang = getUserLanguage(userId);
        
        database.registerUser(userId.toString(), {
            id: userId.toString(),
            first_name: ctx.from.first_name,
            last_name: ctx.from.last_name,
            username: ctx.from.username
        });
        
        // Handle support ticket
        if (state === 'awaiting_support' && msg !== '/cancel') {
            userPreferences.delete(`${userId}_state`);
            
            const ticket = database.createTicket({
                userId: userId.toString(),
                userName: ctx.from.first_name,
                message: msg,
                status: 'open'
            });
            
            const t = lang === 'fa' ? translations.fa : translations.en;
            await ctx.replyWithMarkdown(t.ticketCreated.replace('{id}', ticket.id));
            
            // Notify admins via admin bot
            for (const adminId of config.admins) {
                try {
                    await adminBot.telegram.sendMessage(
                        adminId,
                        `🆘 **New Support Ticket**\n\n` +
                        `Ticket ID: \`${ticket.id}\`\n` +
                        `User: ${ctx.from.first_name} (@${ctx.from.username || 'N/A'})\n` +
                        `ID: \`${userId}\`\n\n` +
                        `**Message:**\n${msg}`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (e) {}
            }
            return;
        }
        
        if (msg === '/cancel') {
            userPreferences.delete(`${userId}_state`);
            await ctx.reply('❌ Cancelled.');
            return;
        }
        
        // Regular chat
        await ctx.sendChatAction('typing');
        
        const prefs = userPreferences.get(userId) || {};
        const result = await getAIResponse(msg, userId, prefs.model || 'llama-3.3-70b-versatile');
        
        const parts = splitMessage(result.response);
        const t = lang === 'fa' ? translations.fa : translations.en;
        
        for (const part of parts) {
            await ctx.replyWithMarkdown(part, {
                reply_markup: {
                    inline_keyboard: [
                        [Markup.button.callback(t.saveFavorite, 'save_favorite')]
                    ]
                }
            });
        }
    });
});

// ======================================================
// ==============  ADMIN BOT  ===========================
// ======================================================

const adminBot = new Telegraf(config.adminBot.token);

// Admin middleware
adminBot.use(async (ctx, next) => {
    const userId = ctx.from.id.toString();
    if (config.admins.includes(userId)) {
        return next();
    } else {
        await ctx.reply('⛔ **Access Denied**\n\nThis bot is for administrators only.', {
            parse_mode: 'Markdown'
        });
    }
});

// Admin Bot Commands
adminBot.start(async (ctx) => {
    const stats = {
        users: database.getAllUsers().length,
        tickets: database.getOpenTickets().length,
        uptime: formatUptime(process.uptime())
    };
    
    await ctx.replyWithMarkdown(
        `👋 **Welcome Admin!**\n\n` +
        `📊 **Dashboard**\n` +
        `• Users: ${stats.users}\n` +
        `• Open Tickets: ${stats.tickets}\n` +
        `• Uptime: ${stats.uptime}\n\n` +
        `Select an option:`,
        Markup.inlineKeyboard([
            [Markup.button.callback('📊 Dashboard', 'admin_dashboard')],
            [Markup.button.callback('🎫 Tickets', 'admin_tickets_list'), 
             Markup.button.callback('👥 Users', 'admin_users_list')],
            [Markup.button.callback('📢 Broadcast', 'admin_broadcast'), 
             Markup.button.callback('⚙️ Settings', 'admin_settings')]
        ])
    );
});

// Admin Dashboard
adminBot.action('admin_dashboard', async (ctx) => {
    await ctx.answerCbQuery();
    
    const users = database.getAllUsers();
    const tickets = database.getAllTickets ? database.getAllTickets() : [];
    const openTickets = tickets.filter(t => t.status === 'open');
    
    const activeToday = users.filter(u => {
        const lastSeen = new Date(u.lastSeen);
        const today = new Date();
        return lastSeen.toDateString() === today.toDateString();
    }).length;
    
    const totalMessages = users.reduce((sum, u) => sum + (u.messageCount || 0), 0);
    
    const message = 
        `📊 **Admin Dashboard**\n\n` +
        `**Users**\n` +
        `• Total: ${users.length}\n` +
        `• Active Today: ${activeToday}\n` +
        `• Messages: ${totalMessages}\n\n` +
        `**Tickets**\n` +
        `• Open: ${openTickets.length}\n` +
        `• Total: ${tickets.length}\n\n` +
        `**System**\n` +
        `• Uptime: ${formatUptime(process.uptime())}`;
    
    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [Markup.button.callback('🔄 Refresh', 'admin_dashboard')],
                [Markup.button.callback('🔙 Main Menu', 'admin_start')]
            ]
        }
    });
});

// Admin Tickets List
adminBot.action('admin_tickets_list', async (ctx) => {
    await ctx.answerCbQuery();
    
    const tickets = database.getOpenTickets();
    
    if (tickets.length === 0) {
        return ctx.editMessageText('🎫 No open tickets.', {
            reply_markup: {
                inline_keyboard: [
                    [Markup.button.callback('🔙 Back', 'admin_start')]
                ]
            }
        });
    }
    
    let message = '🎫 **Open Tickets**\n\n';
    tickets.slice(0, 10).forEach((t, i) => {
        const user = database.getUser(t.userId) || {};
        message += `${i + 1}. **#${t.id}** - ${user.first_name || 'Unknown'}\n`;
        message += `   📝 ${(t.message || '').substring(0, 50)}...\n`;
    });
    
    if (tickets.length > 10) {
        message += `\n... and ${tickets.length - 10} more.`;
    }
    
    const keyboard = tickets.slice(0, 5).map(t => 
        [Markup.button.callback(`View #${t.id}`, `admin_ticket_${t.id}`)]
    );
    keyboard.push([Markup.button.callback('🔙 Back', 'admin_start')]);
    
    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
});

// View Single Ticket
adminBot.action(/admin_ticket_(.+)/, async (ctx) => {
    const ticketId = ctx.match[1];
    await ctx.answerCbQuery();
    
    const ticket = database.getTicket(ticketId);
    if (!ticket) {
        return ctx.editMessageText('❌ Ticket not found.', {
            reply_markup: {
                inline_keyboard: [
                    [Markup.button.callback('🔙 Back', 'admin_tickets_list')]
                ]
            }
        });
    }
    
    const user = database.getUser(ticket.userId) || {};
    
    let message = `🎫 **Ticket #${ticketId}**\n\n`;
    message += `**User:** ${user.first_name || 'Unknown'} (@${user.username || 'N/A'})\n`;
    message += `**User ID:** \`${ticket.userId}\`\n`;
    message += `**Status:** ${ticket.status}\n`;
    message += `**Created:** ${formatDate(ticket.createdAt || ticket.timestamp)}\n\n`;
    message += `**Message:**\n${ticket.message || ticket.message}\n\n`;
    
    if (ticket.replies && ticket.replies.length > 0) {
        message += `**Replies:**\n`;
        ticket.replies.slice(-3).forEach(r => {
            message += `• ${r.from}: ${r.message}\n`;
        });
    }
    
    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [Markup.button.callback('✏️ Reply', `admin_reply_${ticketId}`)],
                [Markup.button.callback('✅ Close', `admin_close_${ticketId}`)],
                [Markup.button.callback('👤 View User', `admin_user_${ticket.userId}`)],
                [Markup.button.callback('🔙 Back', 'admin_tickets_list')]
            ]
        }
    });
});

// Reply to Ticket
adminBot.action(/admin_reply_(.+)/, async (ctx) => {
    const ticketId = ctx.match[1];
    await ctx.answerCbQuery();
    
    adminSessions.set(ctx.from.id, { type: 'reply', ticketId });
    
    await ctx.editMessageText(
        `✏️ **Replying to Ticket #${ticketId}**\n\n` +
        `Type your reply below. Use /cancel to abort.`,
        {
            reply_markup: {
                inline_keyboard: [
                    [Markup.button.callback('❌ Cancel', 'admin_cancel')]
                ]
            }
        }
    );
});

// Close Ticket
adminBot.action(/admin_close_(.+)/, async (ctx) => {
    const ticketId = ctx.match[1];
    await ctx.answerCbQuery();
    
    database.closeTicket(ticketId);
    
    await ctx.editMessageText(
        `✅ **Ticket #${ticketId} has been closed.**`,
        {
            reply_markup: {
                inline_keyboard: [
                    [Markup.button.callback('🔙 Back to Tickets', 'admin_tickets_list')]
                ]
            }
        }
    );
});

// View User
adminBot.action(/admin_user_(.+)/, async (ctx) => {
    const userId = ctx.match[1];
    await ctx.answerCbQuery();
    
    const user = database.getUser(userId);
    if (!user) {
        return ctx.reply('❌ User not found.');
    }
    
    const tickets = Object.values(database.tickets)
        .filter(t => t.userId === userId);
    
    let message = `👤 **User Information**\n\n`;
    message += `**ID:** \`${user.id}\`\n`;
    message += `**Name:** ${user.first_name || ''} ${user.last_name || ''}\n`;
    message += `**Username:** @${user.username || 'N/A'}\n`;
    message += `**First Seen:** ${formatDate(user.firstSeen)}\n`;
    message += `**Last Seen:** ${formatDate(user.lastSeen)}\n`;
    message += `**Messages:** ${user.messageCount || 0}\n`;
    message += `**Tickets:** ${tickets.length}\n`;
    
    await ctx.replyWithMarkdown(message, {
        reply_markup: {
            inline_keyboard: [
                [Markup.button.callback('📋 View Tickets', `admin_user_tickets_${userId}`)],
                [Markup.button.callback('🔙 Back', 'admin_tickets_list')]
            ]
        }
    });
});

// User Tickets
adminBot.action(/admin_user_tickets_(.+)/, async (ctx) => {
    const userId = ctx.match[1];
    await ctx.answerCbQuery();
    
    const tickets = Object.values(database.tickets)
        .filter(t => t.userId === userId)
        .sort((a, b) => new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp));
    
    if (tickets.length === 0) {
        return ctx.reply('📭 No tickets for this user.');
    }
    
    let message = `📋 **User's Tickets**\n\n`;
    tickets.slice(0, 5).forEach((t, i) => {
        message += `${i + 1}. **#${t.id}** - ${t.status}\n`;
        message += `   📝 ${(t.message || '').substring(0, 50)}...\n`;
    });
    
    await ctx.replyWithMarkdown(message);
});

// Admin Users List
adminBot.action('admin_users_list', async (ctx) => {
    await ctx.answerCbQuery();
    
    const users = database.getAllUsers();
    
    if (users.length === 0) {
        return ctx.editMessageText('👥 No users found.', {
            reply_markup: {
                inline_keyboard: [
                    [Markup.button.callback('🔙 Back', 'admin_start')]
                ]
            }
        });
    }
    
    let message = '👥 **Recent Users**\n\n';
    users.slice(0, 10).forEach((u, i) => {
        const lastSeen = u.lastSeen ? formatDate(u.lastSeen).split(',')[0] : 'Never';
        message += `${i + 1}. **${u.first_name || 'Unknown'}** \`${u.id}\`\n`;
        message += `   📅 ${lastSeen} | 💬 ${u.messageCount || 0}\n`;
    });
    
    if (users.length > 10) {
        message += `\n... and ${users.length - 10} more.`;
    }
    
    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [Markup.button.callback('🔍 Search', 'admin_search')],
                [Markup.button.callback('🔙 Back', 'admin_start')]
            ]
        }
    });
});

// Admin Broadcast
adminBot.action('admin_broadcast', async (ctx) => {
    await ctx.answerCbQuery();
    
    adminSessions.set(ctx.from.id, { type: 'broadcast' });
    
    await ctx.editMessageText(
        `📢 **Broadcast System**\n\n` +
        `Type your message below. You can use HTML formatting.\n` +
        `Use /preview to see a preview.\n` +
        `Use /cancel to abort.`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [Markup.button.callback('❌ Cancel', 'admin_cancel')]
                ]
            }
        }
    );
});

// Admin Settings
adminBot.action('admin_settings', async (ctx) => {
    await ctx.answerCbQuery();
    
    const message = 
        `⚙️ **Settings**\n\n` +
        `**System Info**\n` +
        `• Uptime: ${formatUptime(process.uptime())}\n` +
        `• Memory: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB\n` +
        `• Node: ${process.version}\n\n` +
        `**Configuration**\n` +
        `• Main Bot: ${config.mainBot.name}\n` +
        `• Admin Bot: ${config.adminBot.name}\n` +
        `• Version: ${config.mainBot.version}`;
    
    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [Markup.button.callback('🔄 Restart Bot', 'admin_restart')],
                [Markup.button.callback('🔙 Back', 'admin_start')]
            ]
        }
    });
});

// Admin Search
adminBot.action('admin_search', async (ctx) => {
    await ctx.answerCbQuery();
    
    adminSessions.set(ctx.from.id, { type: 'search' });
    
    await ctx.editMessageText(
        `🔍 **Search Users**\n\n` +
        `Enter a user ID, username, or name to search.\n` +
        `Use /cancel to abort.`,
        {
            reply_markup: {
                inline_keyboard: [
                    [Markup.button.callback('❌ Cancel', 'admin_cancel')]
                ]
            }
        }
    );
});

// Admin Cancel
adminBot.action('admin_cancel', async (ctx) => {
    await ctx.answerCbQuery();
    adminSessions.delete(ctx.from.id);
    
    await ctx.editMessageText('❌ Operation cancelled.', {
        reply_markup: {
            inline_keyboard: [
                [Markup.button.callback('🔙 Main Menu', 'admin_start')]
            ]
        }
    });
});

// Admin Start (Back to Main Menu)
adminBot.action('admin_start', async (ctx) => {
    await ctx.answerCbQuery();
    
    const stats = {
        users: database.getAllUsers().length,
        tickets: database.getOpenTickets().length
    };
    
    await ctx.editMessageText(
        `👋 **Welcome back Admin!**\n\n` +
        `📊 Users: ${stats.users}\n` +
        `🎫 Open Tickets: ${stats.tickets}\n\n` +
        `Select an option:`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [Markup.button.callback('📊 Dashboard', 'admin_dashboard')],
                    [Markup.button.callback('🎫 Tickets', 'admin_tickets_list'), 
                     Markup.button.callback('👥 Users', 'admin_users_list')],
                    [Markup.button.callback('📢 Broadcast', 'admin_broadcast'), 
                     Markup.button.callback('⚙️ Settings', 'admin_settings')]
                ]
            }
        }
    );
});

// Admin Bot Message Handler
adminBot.on('text', async (ctx) => {
    const adminId = ctx.from.id.toString();
    const session = adminSessions.get(adminId);
    const msg = ctx.message.text;
    
    if (!session) return;
    
    if (msg === '/cancel') {
        adminSessions.delete(adminId);
        await ctx.reply('❌ Cancelled.');
        return;
    }
    
    // Handle ticket replies
    if (session.type === 'reply') {
        const ticketId = session.ticketId;
        const ticket = database.getTicket(ticketId);
        
        if (ticket) {
            database.addReply(ticketId, {
                from: 'admin',
                message: msg
            });
            
            // Send to user
            try {
                await mainBot.telegram.sendMessage(
                    ticket.userId,
                    `📨 **New reply to your ticket #${ticketId}**\n\n` +
                    `**Admin:**\n${msg}`,
                    { parse_mode: 'Markdown' }
                );
                
                await ctx.replyWithMarkdown(`✅ Reply sent to user.`);
            } catch (error) {
                await ctx.reply('❌ Failed to send reply to user.');
            }
        }
        
        adminSessions.delete(adminId);
    }
    
    // Handle broadcast
    else if (session.type === 'broadcast') {
        const users = database.getAllUsers();
        await ctx.reply(`📢 Sending broadcast to ${users.length} users...`);
        
        let sent = 0, failed = 0;
        
        for (const user of users) {
            try {
                await mainBot.telegram.sendMessage(user.id, msg, { parse_mode: 'HTML' });
                sent++;
                await new Promise(r => setTimeout(r, 50));
            } catch (error) {
                failed++;
            }
        }
        
        await ctx.replyWithMarkdown(
            `✅ **Broadcast Complete**\n\n` +
            `Sent: ${sent}\n` +
            `Failed: ${failed}`
        );
        
        adminSessions.delete(adminId);
    }
    
    // Handle search
    else if (session.type === 'search') {
        const query = msg.toLowerCase();
        const users = database.getAllUsers();
        
        const results = users.filter(u => 
            u.id.includes(query) || 
            u.first_name?.toLowerCase().includes(query) ||
            u.username?.toLowerCase().includes(query)
        );
        
        if (results.length === 0) {
            await ctx.reply('❌ No users found.');
        } else {
            let resultMsg = `🔍 **Search Results (${results.length})**\n\n`;
            results.slice(0, 10).forEach((u, i) => {
                resultMsg += `${i + 1}. **${u.first_name || 'Unknown'}** \`${u.id}\`\n`;
            });
            await ctx.replyWithMarkdown(resultMsg);
        }
        
        adminSessions.delete(adminId);
    }
});

// ======================================================
// BOT LAUNCH
// ======================================================

async function startBots() {
    try {
        // Launch main bot
        await mainBot.launch();
        console.log('✅ Main Bot is running!');
        
        // Launch admin bot
        await adminBot.launch();
        console.log('✅ Admin Bot is running!');
        
        console.log(`📊 Combined Bot Version: ${config.mainBot.version}`);
        console.log(`👥 Admins: ${config.admins.join(', ')}`);
        console.log(`🌐 Port: ${config.api.port}`);
        
    } catch (error) {
        console.error('❌ Failed to start bots:', error);
        process.exit(1);
    }
}

startBots();

// ======================================================
// GRACEFUL SHUTDOWN
// ======================================================

process.once('SIGINT', () => {
    console.log('👋 Shutting down...');
    mainBot.stop('SIGINT');
    adminBot.stop('SIGINT');
    server.close();
    process.exit(0);
});

process.once('SIGTERM', () => {
    console.log('👋 Shutting down...');
    mainBot.stop('SIGTERM');
    adminBot.stop('SIGTERM');
    server.close();
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err);
});

// Keep process alive
process.stdin.resume();

module.exports = { mainBot, adminBot, app };