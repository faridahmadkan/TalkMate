const { Telegraf, Markup } = require('telegraf');
const Groq = require('groq-sdk');
const express = require('express');
const database = require('./database');

// Check environment variables
if (!process.env.BOT_TOKEN || !process.env.GROQ_API_KEY) {
  console.error('❌ Missing BOT_TOKEN or GROQ_API_KEY');
  process.exit(1);
}

console.log('✅ Environment variables loaded');

const bot = new Telegraf(process.env.BOT_TOKEN);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const app = express();
const PORT = process.env.PORT || 3000;

// Admin IDs from environment variable
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : ['6939078859', '6336847895'];

// Simple web server for Render health checks
app.get('/', (req, res) => res.send('🤖 Bot is running!'));
app.get('/health', (req, res) => res.status(200).send('OK'));

// Start the web server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Web server running on port ${PORT}`);
});

// In-memory storage
const userConversations = new Map();
const userPreferences = new Map();
const userActivity = new Map();
const userNotes = new Map();
const userFavorites = new Map();

// Available models
const AVAILABLE_MODELS = [
  { name: 'Llama 3.3 70B', id: 'llama-3.3-70b-versatile', description: 'Most powerful, best for complex tasks', fa: 'قدرتمندترین، بهترین برای کارهای پیچیده' },
  { name: 'Llama 3.1 70B', id: 'llama-3.1-70b-versatile', description: 'Excellent all-rounder', fa: 'عالی برای همه موارد' },
  { name: 'Mixtral 8x7B', id: 'mixtral-8x7b-32768', description: 'Fast and efficient', fa: 'سریع و کارآمد' },
  { name: 'Gemma 2 9B', id: 'gemma2-9b-it', description: 'Lightweight and quick', fa: 'سبک و سریع' }
];

// Language translations
const translations = {
  en: {
    welcome: "🌟 **Welcome {name}!** 🌟\n\nI'm your **Bilingual AI Assistant** powered by Groq.\n\nPlease select your language / لطفاً زبان خود را انتخاب کنید:",
    error: "❌ An error occurred. Please try again.",
    start_chat: "💬 Start Chatting",
    help_support: "🆘 Help & Support",
    about_bot: "ℹ️ About",
    settings: "⚙️ Settings",
    privacy_guide: "🔒 Privacy & Guide",
    main_menu: "🏠 Main Menu",
    back: "🔙 Back",
    yes_clear: "✅ Yes, clear it",
    no_keep: "❌ No, keep it",
    save_favorite: "⭐ Save",
    pro_tip: "💡 Pro Tip",
    
    support_title: "🆘 **Support Request**\n\nPlease describe your issue in detail:\n\n_Type your message or /cancel to abort._",
    ticket_created: "✅ **Support ticket created!**\n\nTicket ID: `{id}`\n\nOur team will respond within 24 hours.",
    
    model_selection: "🤖 **Select AI Model:**\n\nChoose a model:",
    model_changed: "✅ **Model Changed!**\n\nNow using: **{name}**",
    model_error: "⚠️ Model error. Try switching to Llama 3.3 70B.",
    
    clear_confirm: "🗑️ **Clear Conversation History**\n\nAre you sure?",
    cleared: "✅ **Conversation history cleared!**",
    
    note_saved: "✅ **Note saved!**\nID: `{id}`",
    no_notes: "📝 **No notes yet.**",
    enter_note: "📝 **Enter your note:**",
    
    favorite_saved: "⭐ **Saved to favorites!**",
    no_favorites: "⭐ **No favorites yet.**",
    
    feedback_title: "📝 **Send Feedback**",
    feedback_thanks: "✅ **Thank you for your feedback!**",
    
    stats_title: "📊 **Your Statistics**\n\n",
    stats_messages: "**Messages sent:** {user}\n",
    stats_ai: "**AI responses:** {ai}\n",
    stats_model: "**Current model:** {model}\n",
    stats_notes: "**Notes saved:** {notes}\n",
    stats_favorites: "**Favorites:** {fav}\n",
    stats_id: "**User ID:** `{id}`\n",
    
    pro_tips: [
      "💡 **Pro Tip:** Use /language to switch between English and Persian!",
      "💡 **Pro Tip:** Use /model to switch between different AI models!",
      "💡 **Pro Tip:** Save important information with /note command!"
    ]
  },
  fa: {
    welcome: "🌟 **خوش آمدید {name}!** 🌟\n\nمن **دستیار هوش مصنوعی دو زبانه** شما هستم.\n\nلطفاً زبان خود را انتخاب کنید / Please select your language:",
    error: "❌ خطایی رخ داد. لطفاً دوباره تلاش کنید.",
    start_chat: "💬 شروع گفتگو",
    help_support: "🆘 راهنما و پشتیبانی",
    about_bot: "ℹ️ درباره ربات",
    settings: "⚙️ تنظیمات",
    privacy_guide: "🔒 حریم خصوصی و راهنما",
    main_menu: "🏠 منوی اصلی",
    back: "🔙 بازگشت",
    yes_clear: "✅ بله، پاک کن",
    no_keep: "❌ خیر، نگه دار",
    save_favorite: "⭐ ذخیره",
    pro_tip: "💡 نکته",
    
    support_title: "🆘 **درخواست پشتیبانی**\n\nلطفاً مشکل خود را توضیح دهید:\n\n_پیام خود را تایپ کنید یا /cancel را بزنید._",
    ticket_created: "✅ **تیکت پشتیبانی ایجاد شد!**\n\nشناسه تیکت: `{id}`",
    
    model_selection: "🤖 **انتخاب مدل:**\n\nمدل را انتخاب کنید:",
    model_changed: "✅ **مدل تغییر کرد!**\n\nمدل فعلی: **{name}**",
    model_error: "⚠️ خطای مدل. به Llama 3.3 70B تغییر دهید.",
    
    clear_confirm: "🗑️ **پاک کردن تاریخچه**\n\nآیا مطمئن هستید؟",
    cleared: "✅ **تاریخچه پاک شد!**",
    
    note_saved: "✅ **یادداشت ذخیره شد!**\nشناسه: `{id}`",
    no_notes: "📝 **یادداشتی ندارید.**",
    enter_note: "📝 **یادداشت خود را وارد کنید:**",
    
    favorite_saved: "⭐ **ذخیره شد!**",
    no_favorites: "⭐ **مورد علاقه‌ای ندارید.**",
    
    feedback_title: "📝 **ارسال بازخورد**",
    feedback_thanks: "✅ **متشکریم!**",
    
    stats_title: "📊 **آمار شما**\n\n",
    stats_messages: "**پیام‌ها:** {user}\n",
    stats_ai: "**پاسخ‌ها:** {ai}\n",
    stats_model: "**مدل:** {model}\n",
    stats_notes: "**یادداشت‌ها:** {notes}\n",
    stats_favorites: "**علاقه‌مندی‌ها:** {fav}\n",
    stats_id: "**شناسه کاربر:** `{id}`\n",
    
    pro_tips: [
      "💡 **نکته:** با /language زبان را تغییر دهید!",
      "💡 **نکته:** با /model مدل را عوض کنید!",
      "💡 **نکته:** اطلاعات را با /note ذخیره کنید!"
    ]
  }
};

// Helper functions
function getUserLanguage(userId) {
  const prefs = userPreferences.get(userId) || {};
  return prefs.language || 'en';
}

function getProTip(userId) {
  const lang = getUserLanguage(userId);
  const tips = lang === 'fa' ? translations.fa.pro_tips : translations.en.pro_tips;
  return tips[Math.floor(Math.random() * tips.length)];
}

async function setBotCommands(language) {
  const cmds = language === 'fa' ? [
    ['start', translations.fa.start_chat],
    ['help', '📚 Help'],
    ['language', '🌐 Language'],
    ['model', '🤖 Model'],
    ['clear', '🗑️ Clear'],
    ['note', '📝 Note'],
    ['support', '🆘 Support'],
    ['feedback', '💬 Feedback']
  ] : [
    ['start', '🚀 Start'],
    ['help', '📚 Help'],
    ['language', '🌐 Language'],
    ['model', '🤖 Model'],
    ['clear', '🗑️ Clear'],
    ['note', '📝 Note'],
    ['support', '🆘 Support'],
    ['feedback', '💬 Feedback']
  ];
  await bot.telegram.setMyCommands(cmds.map(([c, d]) => ({ command: c, description: d })));
}

async function getAIResponse(userMessage, userId, model = 'llama-3.3-70b-versatile') {
  try {
    if (!userConversations.has(userId)) userConversations.set(userId, []);
    const history = userConversations.get(userId);
    history.push({ role: 'user', content: userMessage });
    if (history.length > 20) history.splice(0, history.length - 20);
    
    const chatCompletion = await groq.chat.completions.create({
      model: model,
      messages: history,
      temperature: 0.7,
      max_tokens: 2048,
    });
    
    const aiReply = chatCompletion.choices[0]?.message?.content || '...';
    history.push({ role: 'assistant', content: aiReply });
    return { success: true, response: aiReply };
  } catch (error) {
    console.error('❌ Groq API Error:', error.message);
    return { success: false, response: '⚠️ Error. Please try again.' };
  }
}

function splitMessage(text, maxLength = 4096) {
  if (text.length <= maxLength) return [text];
  return text.match(new RegExp(`.{1,${maxLength}}`, 'g')) || [];
}

async function safeExecute(ctx, fn) {
  try {
    await fn();
  } catch (error) {
    console.error('Error:', error);
    try { await ctx.reply('❌ Error. Please try again.'); } catch (e) {}
  }
}

// ================= BOT COMMANDS =================

bot.start(async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    userActivity.set(userId, Date.now());
    
    database.registerUser(userId.toString(), {
      id: userId.toString(),
      first_name: ctx.from.first_name,
      last_name: ctx.from.last_name,
      username: ctx.from.username
    });
    
    const prefs = userPreferences.get(userId) || {};
    
    if (!prefs.language) {
      await ctx.replyWithMarkdown(
        '🌐 **Welcome! / خوش آمدید!**\n\nPlease select your language / لطفاً زبان خود را انتخاب کنید:',
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
          [Markup.button.callback(t.start_chat, 'start_chat')],
          [Markup.button.callback(t.help_support, 'help_support'), Markup.button.callback(t.about_bot, 'about_bot')],
          [Markup.button.callback(t.settings, 'settings'), Markup.button.callback(t.privacy_guide, 'privacy_guide')]
        ])
      );
      setTimeout(() => ctx.replyWithMarkdown(getProTip(userId)).catch(() => {}), 2000);
    }
  });
});

bot.command('language', async (ctx) => {
  await safeExecute(ctx, async () => {
    await ctx.replyWithMarkdown(
      '🌐 **Select Language / انتخاب زبان**',
      Markup.inlineKeyboard([
        [Markup.button.callback('🇬🇧 English', 'lang_en')],
        [Markup.button.callback('🇮🇷 فارسی', 'lang_fa')]
      ])
    );
  });
});

bot.command('model', async (ctx) => {
  await safeExecute(ctx, async () => {
    const lang = getUserLanguage(ctx.from.id);
    const t = lang === 'fa' ? translations.fa : translations.en;
    const buttons = AVAILABLE_MODELS.map(m => 
      [Markup.button.callback(lang === 'fa' ? `${m.name} - ${m.fa}` : `${m.name} - ${m.description}`, `model_${m.id}`)]
    );
    await ctx.replyWithMarkdown(t.model_selection, Markup.inlineKeyboard(buttons));
  });
});

AVAILABLE_MODELS.forEach(m => {
  bot.action(`model_${m.id}`, async (ctx) => {
    await safeExecute(ctx, async () => {
      const userId = ctx.from.id;
      const lang = getUserLanguage(userId);
      const t = lang === 'fa' ? translations.fa : translations.en;
      
      if (!userPreferences.has(userId)) userPreferences.set(userId, {});
      userPreferences.get(userId).model = m.id;
      
      await ctx.answerCbQuery(lang === 'fa' ? 'انتخاب شد' : 'Selected');
      await ctx.editMessageText(
        t.model_changed.replace('{name}', m.name),
        { parse_mode: 'Markdown' }
      );
    });
  });
});

bot.command('support', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa : translations.en;
    
    await ctx.replyWithMarkdown(t.support_title, Markup.forceReply());
    userPreferences.set(`${userId}_state`, 'awaiting_support');
  });
});

bot.command('clear', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa : translations.en;
    
    await ctx.replyWithMarkdown(
      t.clear_confirm,
      Markup.inlineKeyboard([
        [Markup.button.callback(t.yes_clear, 'clear_history')],
        [Markup.button.callback(t.no_keep, 'cancel')]
      ])
    );
  });
});

bot.command('note', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa : translations.en;
    const note = ctx.message.text.replace('/note', '').trim();
    
    if (!note) {
      await ctx.replyWithMarkdown(t.enter_note, Markup.forceReply());
      userPreferences.set(`${userId}_state`, 'awaiting_note');
      return;
    }
    
    if (!userNotes.has(userId)) userNotes.set(userId, []);
    const noteObj = { id: Date.now(), text: note, date: new Date().toLocaleString() };
    userNotes.get(userId).push(noteObj);
    await ctx.replyWithMarkdown(t.note_saved.replace('{id}', noteObj.id));
  });
});

bot.command('feedback', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa : translations.en;
    
    await ctx.replyWithMarkdown(t.feedback_title, Markup.forceReply());
    userPreferences.set(`${userId}_state`, 'awaiting_feedback');
  });
});

bot.command('stats', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa : translations.en;
    const history = userConversations.get(userId) || [];
    const prefs = userPreferences.get(userId) || {};
    const notes = userNotes.get(userId) || [];
    const favorites = userFavorites.get(userId) || [];
    const model = AVAILABLE_MODELS.find(m => m.id === prefs.model)?.name || 'Llama 3.3 70B';
    
    await ctx.replyWithMarkdown(
      t.stats_title +
      t.stats_messages.replace('{user}', history.filter(m => m.role === 'user').length) +
      t.stats_ai.replace('{ai}', history.filter(m => m.role === 'assistant').length) +
      t.stats_model.replace('{model}', model) +
      t.stats_notes.replace('{notes}', notes.length) +
      t.stats_favorites.replace('{fav}', favorites.length) +
      t.stats_id.replace('{id}', userId)
    );
  });
});

// ================= CALLBACK HANDLERS =================

bot.action('lang_en', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    if (!userPreferences.has(userId)) userPreferences.set(userId, {});
    userPreferences.get(userId).language = 'en';
    await setBotCommands('en');
    await ctx.answerCbQuery('Language set to English');
    await ctx.editMessageText(
      translations.en.welcome.replace('{name}', ctx.from.first_name),
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
        [Markup.button.callback(translations.en.start_chat, 'start_chat')],
        [Markup.button.callback(translations.en.help_support, 'help_support'), Markup.button.callback(translations.en.about_bot, 'about_bot')],
        [Markup.button.callback(translations.en.settings, 'settings'), Markup.button.callback(translations.en.privacy_guide, 'privacy_guide')]
      ] } }
    );
    setTimeout(() => ctx.replyWithMarkdown(getProTip(userId)).catch(() => {}), 2000);
  });
});

bot.action('lang_fa', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    if (!userPreferences.has(userId)) userPreferences.set(userId, {});
    userPreferences.get(userId).language = 'fa';
    await setBotCommands('fa');
    await ctx.answerCbQuery('زبان به فارسی تنظیم شد');
    await ctx.editMessageText(
      translations.fa.welcome.replace('{name}', ctx.from.first_name),
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
        [Markup.button.callback(translations.fa.start_chat, 'start_chat')],
        [Markup.button.callback(translations.fa.help_support, 'help_support'), Markup.button.callback(translations.fa.about_bot, 'about_bot')],
        [Markup.button.callback(translations.fa.settings, 'settings'), Markup.button.callback(translations.fa.privacy_guide, 'privacy_guide')]
      ] } }
    );
    setTimeout(() => ctx.replyWithMarkdown(getProTip(userId)).catch(() => {}), 2000);
  });
});

bot.action('start_chat', async (ctx) => {
  await safeExecute(ctx, async () => {
    const lang = getUserLanguage(ctx.from.id);
    await ctx.answerCbQuery();
    await ctx.replyWithMarkdown(lang === 'fa' ? '💬 **آماده گفتگو!**' : '💬 **Ready to chat!**');
  });
});

bot.action('clear_history', async (ctx) => {
  await safeExecute(ctx, async () => {
    const lang = getUserLanguage(ctx.from.id);
    const t = lang === 'fa' ? translations.fa : translations.en;
    userConversations.delete(ctx.from.id);
    await ctx.answerCbQuery(lang === 'fa' ? 'پاک شد' : 'Cleared');
    await ctx.editMessageText(t.cleared);
  });
});

bot.action('save_favorite', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa : translations.en;
    const history = userConversations.get(userId) || [];
    const last = history.filter(m => m.role === 'assistant').pop();
    
    if (last) {
      if (!userFavorites.has(userId)) userFavorites.set(userId, []);
      userFavorites.get(userId).push({
        text: last.content.substring(0, 100) + '...',
        date: new Date().toLocaleString()
      });
      await ctx.answerCbQuery(lang === 'fa' ? 'ذخیره شد' : 'Saved');
      await ctx.reply(t.favorite_saved);
    }
  });
});

// ================= MESSAGE HANDLING =================

bot.on('text', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const msg = ctx.message.text;
    const state = userPreferences.get(`${userId}_state`);
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa : translations.en;
    
    userActivity.set(userId, Date.now());
    database.registerUser(userId.toString(), {
      id: userId.toString(),
      first_name: ctx.from.first_name,
      last_name: ctx.from.last_name,
      username: ctx.from.username
    });
    
    // Handle note creation
    if (state === 'awaiting_note' && msg !== '/cancel') {
      userPreferences.delete(`${userId}_state`);
      if (!userNotes.has(userId)) userNotes.set(userId, []);
      const note = { id: Date.now(), text: msg, date: new Date().toLocaleString() };
      userNotes.get(userId).push(note);
      await ctx.replyWithMarkdown(t.note_saved.replace('{id}', note.id));
      return;
    }
    
    // Handle support ticket
    if (state === 'awaiting_support' && msg !== '/cancel') {
      userPreferences.delete(`${userId}_state`);
      const ticket = database.createTicket({
        userId: userId.toString(),
        userName: ctx.from.first_name,
        message: msg,
        status: 'open'
      });
      await ctx.replyWithMarkdown(t.ticket_created.replace('{id}', ticket.id));
      return;
    }
    
    // Handle feedback
    if (state === 'awaiting_feedback' && msg !== '/cancel') {
      userPreferences.delete(`${userId}_state`);
      await ctx.replyWithMarkdown(t.feedback_thanks);
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
    for (const part of parts) {
      await ctx.replyWithMarkdown(part, {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(t.save_favorite, 'save_favorite')]
          ]
        }
      });
    }
  });
});

// Error handler
bot.catch((err, ctx) => {
  console.error('❌ Bot Error:', err);
  ctx?.reply('❌ Error. Try again.').catch(() => {});
});

// ================= START BOT (POLLING MODE) =================

async function startBot() {
  try {
    await setBotCommands('en');
    
    // Simple polling mode - NO WEBHOOKS
    await bot.launch({
      dropPendingUpdates: true
    });
    
    console.log('✅ Bot is running in POLLING mode!');
    console.log('📊 Features: Bilingual (EN/FA), Notes, Favorites, Support Tickets');
    console.log('💬 Database connected');
    console.log('🚀 Bot is ready!');
    
  } catch (err) {
    console.error('❌ Failed to start bot:', err);
    console.log('🔄 Retrying in 5 seconds...');
    setTimeout(startBot, 5000);
  }
}

// Start the bot
startBot();

// Keep process alive
process.stdin.resume();

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('👋 Shutting down...');
  bot.stop('SIGINT');
  process.exit(0);
});

process.once('SIGTERM', () => {
  console.log('👋 Shutting down...');
  bot.stop('SIGTERM');
  process.exit(0);
});

process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);