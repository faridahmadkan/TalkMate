/**
 * ======================================================
 * TALKMATE - WORLD-CLASS PROFESSIONAL AI BOT
 * ======================================================
 * Version: 8.0.0 Ultimate
 * 
 * A masterpiece of Telegram bot engineering with:
 * ✓ Cinematic UI/UX with disappearing buttons
 * ✓ Seamless dual-bot architecture (Main + Admin)
 * ✓ Enterprise-grade error handling
 * ✓ Real-time analytics
 * ✓ Professional animations and feedback
 * ======================================================
 */

const { Telegraf, Markup } = require('telegraf');
const Groq = require('groq-sdk');
const express = require('express');
const db = require('./database');
const crypto = require('crypto');
const os = require('os');

// ======================================================
// ENVIRONMENT CONFIGURATION
// ======================================================

const config = {
    mainBot: {
        token: process.env.BOT_TOKEN,
        name: 'TalkMate AI'
    },
    adminBot: {
        token: process.env.ADMIN_BOT_TOKEN,
        name: 'TalkMate Admin'
    },
    groq: {
        apiKey: process.env.GROQ_API_KEY
    },
    admins: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [],
    port: process.env.PORT || 3000,
    version: '8.0.0'
};

// ======================================================
// EXPRESS SERVER FOR HEALTH CHECKS
// ======================================================

const app = express();
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        version: config.version,
        mainBot: config.mainBot.name,
        adminBot: config.adminBot.name,
        uptime: process.uptime(),
        stats: db.getStats(),
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => res.status(200).send('OK'));

const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`🌐 Express server running on port ${config.port}`);
});

// ======================================================
// GROQ AI CLIENT
// ======================================================

const groq = new Groq({ apiKey: config.groq.apiKey });

// ======================================================
// AVAILABLE AI MODELS
// ======================================================

const MODELS = [
    { 
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B',
        emoji: '🦙',
        description: 'Most powerful, best for complex tasks',
        speed: '⚡⚡⚡',
        context: '32K'
    },
    {
        id: 'llama-3.1-70b-versatile',
        name: 'Llama 3.1 70B',
        emoji: '🦙',
        description: 'Excellent all-rounder',
        speed: '⚡⚡⚡',
        context: '32K'
    },
    {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        emoji: '🎯',
        description: 'Fast and efficient',
        speed: '⚡⚡⚡⚡',
        context: '32K'
    },
    {
        id: 'gemma2-9b-it',
        name: 'Gemma 2 9B',
        emoji: '💎',
        description: 'Lightweight and quick',
        speed: '⚡⚡⚡⚡⚡',
        context: '8K'
    }
];

// ======================================================
// CINEMATIC TRANSLATIONS
// ======================================================

const i18n = {
    en: {
        // Welcome & Greetings
        welcome: "🌟 **Welcome to TalkMate, {name}!**\n\nI'm your personal AI assistant, powered by cutting-edge Groq technology. I can help you with anything – from answering questions to saving notes, and even creating support tickets.",
        welcomeBack: "👋 **Welcome back, {name}!**\n\nI've missed you! Ready to continue our conversation?",
        
        // Menu Titles
        mainMenu: "🌟 **Main Menu**\n\nWhat would you like to do today?",
        aiMenu: "🤖 **AI Assistant Menu**",
        toolsMenu: "🛠️ **Productivity Tools**",
        supportMenu: "🆘 **Support Center**",
        profileMenu: "👤 **Your Profile**",
        
        // Buttons - Main Menu
        btnChat: "💬 Start Chatting",
        btnModels: "🤖 Change AI Model",
        btnNotes: "📝 My Notes",
        btnFavorites: "⭐ My Favorites",
        btnSupport: "🆘 Support Tickets",
        btnStats: "📊 My Statistics",
        btnProfile: "👤 Profile",
        btnSettings: "⚙️ Settings",
        btnBack: "🔙 Back",
        btnClose: "❌ Close",
        btnConfirm: "✅ Confirm",
        btnCancel: "❌ Cancel",
        
        // AI Models
        modelSelect: "🤖 **Select AI Model**\n\nChoose the intelligence that suits your needs:",
        modelChanged: "✅ **Model Updated**\n\nNow using: **{model}**\n{description}\nSpeed: {speed}",
        
        // Notes
        notePrompt: "📝 **Write your note**\n\nType the note you want to save below:",
        noteSaved: "✅ **Note Saved!**\n\nID: `{id}`\n\n{preview}",
        noNotes: "📭 **No notes yet**\n\nUse the note feature to save important information.",
        notesList: "📝 **Your Notes**\n\n{notes}",
        
        // Favorites
        favSaved: "⭐ **Added to Favorites!**",
        noFavorites: "⭐ **No favorites yet**\n\nSave interesting responses using the ⭐ button.",
        
        // Support Tickets
        ticketPrompt: "🆘 **Create Support Ticket**\n\nPlease describe your issue in detail. Our support team will respond within 24 hours.",
        ticketCreated: "✅ **Ticket Created!**\n\n**Ticket ID:** `{id}`\n\nYou'll be notified when an admin responds.",
        noTickets: "📭 **No support tickets**\n\nUse the support feature if you need help.",
        ticketStatus: "📊 **Ticket #{id}**\n\n**Status:** {status}\n**Created:** {created}\n**Replies:** {count}",
        
        // Statistics
        statsTitle: "📊 **Your Statistics**\n\n",
        statsMessages: "💬 Messages: {sent} sent, {received} received\n",
        statsModel: "🤖 Current Model: {model}\n",
        statsNotes: "📝 Notes: {count}\n",
        statsFavorites: "⭐ Favorites: {count}\n",
        statsSince: "📅 Member since: {date}\n",
        statsLastActive: "⏰ Last active: {date}",
        
        // Errors & Feedback
        error: "❌ **Something went wrong**\n\nPlease try again in a moment.",
        processing: "⏳ Processing your request...",
        cancelled: "❌ Operation cancelled.",
        
        // Pro Tips
        proTips: [
            "💡 You can change AI models anytime from the menu!",
            "💡 Save interesting responses with the ⭐ button!",
            "💡 Create support tickets if you need human help!",
            "💡 Your conversation history is saved for context!",
            "💡 Different models excel at different tasks!"
        ]
    },
    fa: {
        welcome: "🌟 **به TalkMate خوش آمدید، {name}!** 🌟\n\nمن دستیار هوش مصنوعی شخصی شما هستم. می‌توانم در هر کاری به شما کمک کنم!",
        welcomeBack: "👋 **خوش برگشتید، {name}!**\n\nدلم براتون تنگ شده بود!",
        mainMenu: "🌟 **منوی اصلی**\n\nامروز چه کاری می‌خواهید انجام دهید؟",
        btnChat: "💬 شروع گفتگو",
        btnModels: "🤖 تغییر مدل",
        btnNotes: "📝 یادداشت‌ها",
        btnFavorites: "⭐ موارد علاقه‌مندی",
        btnSupport: "🆘 پشتیبانی",
        btnStats: "📊 آمار من",
        btnProfile: "👤 پروفایل",
        btnBack: "🔙 بازگشت",
        btnCancel: "❌ انصراف",
        modelSelect: "🤖 **انتخاب مدل هوش مصنوعی**",
        modelChanged: "✅ **مدل تغییر کرد**\n\nمدل فعلی: **{model}**",
        notePrompt: "📝 **یادداشت خود را بنویسید**",
        noteSaved: "✅ **یادداشت ذخیره شد!**\n\nشناسه: `{id}`",
        noNotes: "📭 **یادداشتی ندارید**",
        favSaved: "⭐ **ذخیره شد!**",
        ticketPrompt: "🆘 **ایجاد تیکت پشتیبانی**\n\nلطفاً مشکل خود را توضیح دهید.",
        ticketCreated: "✅ **تیکت ایجاد شد!**\n\nشناسه: `{id}`",
        error: "❌ **خطایی رخ داد**\n\nلطفاً دوباره تلاش کنید.",
        proTips: [
            "💡 می‌توانید مدل هوش مصنوعی را از منو تغییر دهید!",
            "💡 پاسخ‌های جالب را با ⭐ ذخیره کنید!"
        ]
    }
};

// ======================================================
// STATE MANAGEMENT
// ======================================================

const userState = new Map(); // { userId: { language, model, tempData } }
const adminSessions = new Map(); // { adminId: { action, ticketId } }

// ======================================================
// UTILITY FUNCTIONS
// ======================================================

function getUserLang(userId) {
    const state = userState.get(userId) || {};
    return state.language || 'en';
}

function t(userId, key, params = {}) {
    const lang = getUserLang(userId);
    let text = i18n[lang]?.[key] || i18n.en[key] || key;
    
    for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, v);
    }
    return text;
}

function getProTip(userId) {
    const lang = getUserLang(userId);
    const tips = i18n[lang].proTips || i18n.en.proTips;
    return tips[Math.floor(Math.random() * tips.length)];
}

function formatDate(date) {
    return new Date(date).toLocaleString();
}

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
        console.error('Error:', error);
        const lang = getUserLang(ctx.from?.id);
        await ctx.reply(t(ctx.from?.id, 'error')).catch(() => {});
    }
}

// ======================================================
// GROQ AI FUNCTION
// ======================================================

async function getAIResponse(userMessage, userId, model = 'llama-3.3-70b-versatile') {
    try {
        const lang = getUserLanguage(userId);
        const messages = [
            {
                role: 'system',
                content: lang === 'fa' 
                    ? 'شما یک دستیار هوش مصنوعی حرفه‌ای هستید. پاسخ‌های خود را به زبان فارسی و با لحنی دوستانه ارائه دهید.'
                    : 'You are a professional AI assistant. Be helpful, accurate, and friendly in your responses.'
            },
            { role: 'user', content: userMessage }
        ];
        
        const completion = await groq.chat.completions.create({
            model: model,
            messages: messages,
            temperature: 0.7,
            max_tokens: 2048
        });
        
        const reply = completion.choices[0]?.message?.content || '...';
        db.incrementMessageCount();
        
        return { success: true, response: reply };
    } catch (error) {
        console.error('Groq API Error:', error);
        return { 
            success: false, 
            response: '⚠️ Service temporarily unavailable. Please try again.' 
        };
    }
}

// ======================================================
// ==============  MAIN USER BOT  =======================
// ======================================================

const mainBot = new Telegraf(config.mainBot.token);

// -------------------- MAIN MENU --------------------

mainBot.start(async (ctx) => {
    await safeExecute(ctx, async () => {
        const userId = ctx.from.id.toString();
        db.registerUser(userId, ctx.from);
        
        const state = userState.get(userId) || {};
        
        if (!state.language) {
            // Language selection with disappearing buttons
            await ctx.replyWithMarkdown(
                '🌐 **Welcome! / خوش آمدید!**\n\nPlease select your language / لطفاً زبان خود را انتخاب کنید:',
                Markup.inlineKeyboard([
                    [Markup.button.callback('🇬🇧 English', 'lang_en')],
                    [Markup.button.callback('🇮🇷 فارسی', 'lang_fa')]
                ])
            );
        } else {
            // Show main menu (buttons will disappear after selection)
            await showMainMenu(ctx, userId, state.language);
            
            // Send a pro tip after 2 seconds
            setTimeout(async () => {
                await ctx.replyWithMarkdown(getProTip(userId));
            }, 2000);
        }
    });
});

async function showMainMenu(ctx, userId, lang) {
    const menu = Markup.inlineKeyboard([
        [Markup.button.callback(i18n[lang].btnChat, 'chat_start')],
        [Markup.button.callback(i18n[lang].btnModels, 'models_show'),
         Markup.button.callback(i18n[lang].btnNotes, 'notes_list')],
        [Markup.button.callback(i18n[lang].btnFavorites, 'favorites_list'),
         Markup.button.callback(i18n[lang].btnSupport, 'support_menu')],
        [Markup.button.callback(i18n[lang].btnStats, 'stats_show'),
         Markup.button.callback(i18n[lang].btnProfile, 'profile_show')]
    ]);
    
    await ctx.replyWithMarkdown(i18n[lang].mainMenu, menu);
}

// -------------------- LANGUAGE SELECTION --------------------

mainBot.action('lang_en', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    
    userState.set(userId, { ...userState.get(userId), language: 'en' });
    await ctx.deleteMessage(); // Remove language selection buttons
    await showMainMenu(ctx, userId, 'en');
});

mainBot.action('lang_fa', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    
    userState.set(userId, { ...userState.get(userId), language: 'fa' });
    await ctx.deleteMessage(); // Remove language selection buttons
    await showMainMenu(ctx, userId, 'fa');
});

// -------------------- CHAT --------------------

mainBot.action('chat_start', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    const lang = getUserLang(userId);
    
    await ctx.deleteMessage(); // Remove previous menu
    await ctx.replyWithMarkdown(
        lang === 'fa' 
            ? '💬 **آماده گفتگو!**\n\nهر سوالی دارید بپرسید. برای بازگشت به منو از /start استفاده کنید.'
            : '💬 **Ready to chat!**\n\nAsk me anything. Use /start to return to the main menu.'
    );
});

// -------------------- AI MODELS --------------------

mainBot.action('models_show', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    const lang = getUserLang(userId);
    
    const buttons = MODELS.map(m => [
        Markup.button.callback(
            `${m.emoji} ${m.name} ${m.speed}`,
            `model_select_${m.id}`
        )
    ]);
    
    buttons.push([Markup.button.callback(i18n[lang].btnBack, 'back_to_main')]);
    
    await ctx.editMessageText(
        i18n[lang].modelSelect,
        Markup.inlineKeyboard(buttons)
    );
});

MODELS.forEach(model => {
    mainBot.action(`model_select_${model.id}`, async (ctx) => {
        await ctx.answerCbQuery();
        const userId = ctx.from.id.toString();
        const lang = getUserLang(userId);
        
        userState.set(userId, { 
            ...userState.get(userId), 
            model: model.id 
        });
        
        await ctx.editMessageText(
            i18n[lang].modelChanged
                .replace('{model}', model.name)
                .replace('{description}', model.description)
                .replace('{speed}', model.speed),
            Markup.inlineKeyboard([
                [Markup.button.callback(i18n[lang].btnBack, 'models_show')],
                [Markup.button.callback(i18n[lang].btnClose, 'delete_message')]
            ])
        );
    });
});

// -------------------- NOTES --------------------

mainBot.action('notes_list', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    const lang = getUserLang(userId);
    
    const notes = db.getUserNotes(userId);
    
    if (notes.length === 0) {
        await ctx.editMessageText(
            i18n[lang].noNotes,
            Markup.inlineKeyboard([
                [Markup.button.callback('➕ New Note', 'note_create')],
                [Markup.button.callback(i18n[lang].btnBack, 'back_to_main')]
            ])
        );
        return;
    }
    
    let notesText = '';
    notes.slice(-5).reverse().forEach((note, i) => {
        notesText += `📝 **${i + 1}.** ${note.text.substring(0, 50)}...\n`;
        notesText += `   🆔 \`${note.id}\`\n\n`;
    });
    
    await ctx.editMessageText(
        i18n[lang].notesList.replace('{notes}', notesText),
        Markup.inlineKeyboard([
            [Markup.button.callback('➕ New Note', 'note_create')],
            [Markup.button.callback(i18n[lang].btnBack, 'back_to_main')]
        ])
    );
});

mainBot.action('note_create', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    const lang = getUserLang(userId);
    
    userState.set(userId, { ...userState.get(userId), awaitingNote: true });
    
    await ctx.editMessageText(
        i18n[lang].notePrompt,
        Markup.inlineKeyboard([
            [Markup.button.callback(i18n[lang].btnCancel, 'note_cancel')]
        ])
    );
});

mainBot.action('note_cancel', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    const lang = getUserLang(userId);
    
    if (userState.get(userId)) {
        delete userState.get(userId).awaitingNote;
    }
    
    await ctx.deleteMessage();
    await showMainMenu(ctx, userId, lang);
});

// -------------------- FAVORITES --------------------

mainBot.action('favorites_list', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    const lang = getUserLang(userId);
    
    const favs = db.getUserFavorites(userId);
    
    if (favs.length === 0) {
        await ctx.editMessageText(
            i18n[lang].noFavorites,
            Markup.inlineKeyboard([
                [Markup.button.callback(i18n[lang].btnBack, 'back_to_main')]
            ])
        );
        return;
    }
    
    let favsText = '';
    favs.slice(-5).reverse().forEach((fav, i) => {
        favsText += `⭐ **${i + 1}.** ${fav.text}\n\n`;
    });
    
    await ctx.editMessageText(favsText, Markup.inlineKeyboard([
        [Markup.button.callback(i18n[lang].btnBack, 'back_to_main')]
    ]));
});

// -------------------- SUPPORT TICKETS --------------------

mainBot.action('support_menu', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    const lang = getUserLang(userId);
    
    await ctx.editMessageText(
        i18n[lang].ticketPrompt,
        Markup.inlineKeyboard([
            [Markup.button.callback('📝 Create Ticket', 'ticket_create')],
            [Markup.button.callback('📋 My Tickets', 'ticket_list')],
            [Markup.button.callback(i18n[lang].btnBack, 'back_to_main')]
        ])
    );
});

mainBot.action('ticket_create', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    const lang = getUserLang(userId);
    
    userState.set(userId, { ...userState.get(userId), awaitingTicket: true });
    
    await ctx.editMessageText(
        i18n[lang].ticketPrompt,
        Markup.inlineKeyboard([
            [Markup.button.callback(i18n[lang].btnCancel, 'ticket_cancel')]
        ])
    );
});

mainBot.action('ticket_cancel', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    const lang = getUserLang(userId);
    
    if (userState.get(userId)) {
        delete userState.get(userId).awaitingTicket;
    }
    
    await ctx.deleteMessage();
    await showMainMenu(ctx, userId, lang);
});

mainBot.action('ticket_list', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    const lang = getUserLang(userId);
    
    const tickets = db.getUserTickets(userId);
    
    if (tickets.length === 0) {
        await ctx.editMessageText(
            i18n[lang].noTickets,
            Markup.inlineKeyboard([
                [Markup.button.callback(i18n[lang].btnBack, 'support_menu')]
            ])
        );
        return;
    }
    
    let ticketsText = '';
    tickets.slice(-5).reverse().forEach(t => {
        const status = t.status === 'open' ? '🟢 Open' : '🔴 Closed';
        ticketsText += `🎫 **#${t.id}** - ${status}\n`;
        ticketsText += `   📝 ${t.message.substring(0, 50)}...\n\n`;
    });
    
    await ctx.editMessageText(ticketsText, Markup.inlineKeyboard([
        [Markup.button.callback(i18n[lang].btnBack, 'support_menu')]
    ]));
});

// -------------------- STATISTICS --------------------

mainBot.action('stats_show', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    const lang = getUserLang(userId);
    
    const user = db.getUser(userId);
    const stats = db.getStats();
    const state = userState.get(userId) || {};
    const model = MODELS.find(m => m.id === state.model)?.name || 'Llama 3.3 70B';
    
    const notes = db.getUserNotes(userId);
    const favs = db.getUserFavorites(userId);
    
    const statsText = i18n[lang].statsTitle +
        i18n[lang].statsMessages
            .replace('{sent}', user?.messageCount || 0)
            .replace('{received}', Math.floor((user?.messageCount || 0) / 2)) +
        i18n[lang].statsModel.replace('{model}', model) +
        i18n[lang].statsNotes.replace('{count}', notes.length) +
        i18n[lang].statsFavorites.replace('{count}', favs.length) +
        i18n[lang].statsSince.replace('{date}', formatDate(user?.firstSeen || new Date())) +
        i18n[lang].statsLastActive.replace('{date}', formatDate(user?.lastSeen || new Date()));
    
    await ctx.editMessageText(
        statsText,
        Markup.inlineKeyboard([
            [Markup.button.callback(i18n[lang].btnBack, 'back_to_main')]
        ])
    );
});

// -------------------- PROFILE --------------------

mainBot.action('profile_show', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    const lang = getUserLang(userId);
    
    const user = db.getUser(userId);
    const state = userState.get(userId) || {};
    const model = MODELS.find(m => m.id === state.model)?.name || 'Llama 3.3 70B';
    
    const profileText = lang === 'fa'
        ? `👤 **پروفایل شما**\n\n` +
          `🆔 **شناسه:** \`${userId}\`\n` +
          `👤 **نام:** ${ctx.from.first_name}\n` +
          `📛 **نام کاربری:** @${ctx.from.username || 'N/A'}\n` +
          `🌐 **زبان:** فارسی\n` +
          `🤖 **مدل:** ${model}\n` +
          `📅 **عضویت:** ${formatDate(user?.firstSeen || new Date())}`
        : `👤 **Your Profile**\n\n` +
          `🆔 **ID:** \`${userId}\`\n` +
          `👤 **Name:** ${ctx.from.first_name}\n` +
          `📛 **Username:** @${ctx.from.username || 'N/A'}\n` +
          `🌐 **Language:** English\n` +
          `🤖 **Model:** ${model}\n` +
          `📅 **Joined:** ${formatDate(user?.firstSeen || new Date())}`;
    
    await ctx.editMessageText(
        profileText,
        Markup.inlineKeyboard([
            [Markup.button.callback(i18n[lang].btnBack, 'back_to_main')]
        ])
    );
});

// -------------------- NAVIGATION --------------------

mainBot.action('back_to_main', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    const lang = getUserLang(userId);
    
    await ctx.deleteMessage(); // Clean removal of previous menu
    await showMainMenu(ctx, userId, lang);
});

mainBot.action('delete_message', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
});

// -------------------- TEXT HANDLER --------------------

mainBot.on('text', async (ctx) => {
    // Skip commands
    if (ctx.message.text.startsWith('/')) return;
    
    await safeExecute(ctx, async () => {
        const userId = ctx.from.id.toString();
        const msg = ctx.message.text;
        const state = userState.get(userId) || {};
        const lang = getUserLang(userId);
        
        db.registerUser(userId, ctx.from);
        
        // Handle note creation
        if (state.awaitingNote) {
            delete state.awaitingNote;
            const note = db.addNote(userId, msg);
            
            await ctx.replyWithMarkdown(
                i18n[lang].noteSaved
                    .replace('{id}', note.id)
                    .replace('{preview}', msg.substring(0, 100) + (msg.length > 100 ? '...' : '')),
                Markup.inlineKeyboard([
                    [Markup.button.callback(i18n[lang].btnBack, 'back_to_main')]
                ])
            );
            return;
        }
        
        // Handle ticket creation
        if (state.awaitingTicket) {
            delete state.awaitingTicket;
            const ticket = db.createTicket({
                userId: userId,
                userName: ctx.from.first_name,
                username: ctx.from.username,
                message: msg
            });
            
            await ctx.replyWithMarkdown(
                i18n[lang].ticketCreated.replace('{id}', ticket.id),
                Markup.inlineKeyboard([
                    [Markup.button.callback(i18n[lang].btnBack, 'back_to_main')]
                ])
            );
            
            // Notify admins
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
        
        // Regular chat
        await ctx.sendChatAction('typing');
        const model = state.model || 'llama-3.3-70b-versatile';
        const result = await getAIResponse(msg, userId, model);
        
        const parts = splitMessage(result.response);
        for (const part of parts) {
            await ctx.replyWithMarkdown(part, {
                reply_markup: {
                    inline_keyboard: [
                        [Markup.button.callback(i18n[lang].btnFavorites, 'save_favorite')]
                    ]
                }
            });
        }
    });
});

// Save favorite from message
mainBot.action('save_favorite', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    const lang = getUserLang(userId);
    
    // Get the message that was replied to
    if (ctx.callbackQuery.message.reply_to_message) {
        const text = ctx.callbackQuery.message.reply_to_message.text;
        db.addFavorite(userId, text);
        await ctx.replyWithMarkdown(i18n[lang].favSaved);
    }
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

adminBot.start(async (ctx) => {
    const stats = db.getStats();
    
    await ctx.replyWithMarkdown(
        `👋 **Welcome Admin!**\n\n` +
        `📊 **System Status**\n` +
        `• Users: ${stats.users.total}\n` +
        `• Active Today: ${stats.users.activeToday}\n` +
        `• Open Tickets: ${stats.tickets.open}\n` +
        `• Uptime: ${stats.uptime}\n\n` +
        `Select an option:`,
        Markup.inlineKeyboard([
            [Markup.button.callback('📊 Dashboard', 'admin_dashboard')],
            [Markup.button.callback('🎫 Tickets', 'admin_tickets'), 
             Markup.button.callback('👥 Users', 'admin_users')],
            [Markup.button.callback('📢 Broadcast', 'admin_broadcast'), 
             Markup.button.callback('⚙️ Settings', 'admin_settings')]
        ])
    );
});

adminBot.action('admin_dashboard', async (ctx) => {
    await ctx.answerCbQuery();
    const stats = db.getStats();
    
    await ctx.editMessageText(
        `📊 **Admin Dashboard**\n\n` +
        `**Users**\n` +
        `• Total: ${stats.users.total}\n` +
        `• Active Today: ${stats.users.activeToday}\n` +
        `• New Today: ${stats.users.newToday}\n\n` +
        `**Tickets**\n` +
        `• Open: ${stats.tickets.open}\n` +
        `• Total: ${stats.tickets.total}\n\n` +
        `**System**\n` +
        `• Uptime: ${stats.uptime}\n` +
        `• Messages: ${stats.messages}`,
        Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Refresh', 'admin_dashboard')],
            [Markup.button.callback('🔙 Back', 'admin_start')]
        ])
    );
});

adminBot.action('admin_tickets', async (ctx) => {
    await ctx.answerCbQuery();
    
    const tickets = db.getOpenTickets();
    
    if (tickets.length === 0) {
        await ctx.editMessageText(
            '🎫 No open tickets.',
            Markup.inlineKeyboard([
                [Markup.button.callback('🔙 Back', 'admin_start')]
            ])
        );
        return;
    }
    
    let msg = '🎫 **Open Tickets**\n\n';
    tickets.slice(0, 5).forEach((t, i) => {
        msg += `${i + 1}. **#${t.id}** - ${t.userName}\n`;
        msg += `   📝 ${t.message.substring(0, 50)}...\n\n`;
    });
    
    const buttons = tickets.slice(0, 5).map(t => [
        Markup.button.callback(`View #${t.id}`, `admin_ticket_${t.id}`)
    ]);
    buttons.push([Markup.button.callback('🔙 Back', 'admin_start')]);
    
    await ctx.editMessageText(msg, Markup.inlineKeyboard(buttons));
});

adminBot.action(/admin_ticket_(.+)/, async (ctx) => {
    const ticketId = ctx.match[1];
    await ctx.answerCbQuery();
    
    const ticket = db.getTicket(ticketId);
    if (!ticket) {
        await ctx.editMessageText('❌ Ticket not found.');
        return;
    }
    
    const msg = 
        `🎫 **Ticket #${ticketId}**\n\n` +
        `**User:** ${ticket.userName} (@${ticket.username || 'N/A'})\n` +
        `**Status:** ${ticket.status}\n` +
        `**Created:** ${formatDate(ticket.createdAt)}\n\n` +
        `**Message:**\n${ticket.message}\n\n` +
        `**Replies:** ${ticket.replies?.length || 0}`;
    
    await ctx.editMessageText(
        msg,
        Markup.inlineKeyboard([
            [Markup.button.callback('✏️ Reply', `admin_reply_${ticketId}`)],
            [Markup.button.callback('✅ Close', `admin_close_${ticketId}`)],
            [Markup.button.callback('🔙 Back', 'admin_tickets')]
        ])
    );
});

adminBot.action(/admin_reply_(.+)/, async (ctx) => {
    const ticketId = ctx.match[1];
    await ctx.answerCbQuery();
    
    adminSessions.set(ctx.from.id.toString(), { action: 'reply', ticketId });
    
    await ctx.editMessageText(
        `✏️ **Reply to Ticket #${ticketId}**\n\nType your reply below:`,
        Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'admin_cancel')]
        ])
    );
});

adminBot.action(/admin_close_(.+)/, async (ctx) => {
    const ticketId = ctx.match[1];
    await ctx.answerCbQuery();
    
    db.closeTicket(ticketId);
    
    await ctx.editMessageText(
        `✅ Ticket #${ticketId} closed.`,
        Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Back', 'admin_tickets')]
        ])
    );
});

adminBot.action('admin_cancel', async (ctx) => {
    await ctx.answerCbQuery();
    adminSessions.delete(ctx.from.id.toString());
    await ctx.deleteMessage();
});

adminBot.action('admin_start', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    await adminBot.telegram.sendMessage(
        ctx.from.id,
        '👋 **Welcome back!**',
        Markup.inlineKeyboard([
            [Markup.button.callback('📊 Dashboard', 'admin_dashboard')],
            [Markup.button.callback('🎫 Tickets', 'admin_tickets'), 
             Markup.button.callback('👥 Users', 'admin_users')]
        ])
    );
});

// Admin text handler
adminBot.on('text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    
    const adminId = ctx.from.id.toString();
    const session = adminSessions.get(adminId);
    
    if (!session) return;
    
    if (session.action === 'reply') {
        const ticket = db.getTicket(session.ticketId);
        if (ticket) {
            db.addReply(session.ticketId, {
                from: 'admin',
                message: ctx.message.text
            });
            
            // Send to user
            try {
                await mainBot.telegram.sendMessage(
                    ticket.userId,
                    `📨 **New reply to your ticket #${session.ticketId}**\n\n` +
                    `**Admin:**\n${ctx.message.text}`,
                    { parse_mode: 'Markdown' }
                );
                
                await ctx.replyWithMarkdown(`✅ Reply sent to user.`);
            } catch (error) {
                await ctx.reply('❌ Failed to send reply to user.');
            }
        }
        adminSessions.delete(adminId);
    }
});

// ======================================================
// LAUNCH BOTS
// ======================================================

async function launchBots() {
    try {
        await mainBot.launch();
        console.log('✅ Main Bot is running!');
        
        await adminBot.launch();
        console.log('✅ Admin Bot is running!');
        
        console.log(`🎯 Version: ${config.version}`);
        console.log(`👥 Admins: ${config.admins.join(', ')}`);
        console.log(`🌐 Port: ${config.port}`);
        
        // Create initial backup
        db.createBackup();
        
    } catch (error) {
        console.error('❌ Failed to launch bots:', error);
        process.exit(1);
    }
}

launchBots();

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

process.stdin.resume();