const { Telegraf, Markup } = require('telegraf');
const Groq = require('groq-sdk');
const express = require('express');

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

// Admin ID to forward all messages
const ADMIN_ID = '6939078859';
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : ['6939078859', '6336847895'];

app.get('/', (req, res) => res.send('🤖 Bilingual AI Bot is running!'));
app.get('/health', (req, res) => res.status(200).send('OK'));

app.listen(PORT, '0.0.0.0', () => console.log(`✅ Server on port ${PORT}`));

// In-memory storage
const userConversations = new Map();
const userPreferences = new Map();
const supportRequests = new Map();
const userActivity = new Map();
const userNotes = new Map();
const userFavorites = new Map();

// Available models
const AVAILABLE_MODELS = [
  { name: 'Llama 3.3 70B', id: 'llama-3.3-70b-versatile', description: 'Most powerful', fa: 'قدرتمندترین' },
  { name: 'Llama 3.1 70B', id: 'llama-3.1-70b-versatile', description: 'Excellent all-rounder', fa: 'عالی برای همه موارد' },
  { name: 'Mixtral 8x7B', id: 'mixtral-8x7b-32768', description: 'Fast and efficient', fa: 'سریع و کارآمد' },
  { name: 'Gemma 2 9B', id: 'gemma2-9b-it', description: 'Lightweight and quick', fa: 'سبک و سریع' }
];

// English translations
const en = {
  welcome: "🌟 **Welcome {name}!** 🌟\n\nI'm your **Bilingual AI Assistant**.\n\nPlease select your language / لطفاً زبان خود را انتخاب کنید:",
  language_selected: "✅ Language set to English.",
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
  
  privacy_title: "🔒 **Privacy Policy & User Guide**\n\n",
  privacy_en: "**English:**\n• Your conversations are private\n• You can clear history with /clear\n• Use /note to save information\n• Use /support for help\n\n",
  privacy_fa: "**فارسی:**\n• مکالمات شما خصوصی است\n• با /clear تاریخچه را پاک کنید\n• با /note یادداشت ذخیره کنید\n• با /support کمک بگیرید\n",
  
  model_selection: "🤖 **Select AI Model:**\n\n⚠️ If you face errors, switch to Llama 3.3 70B.",
  model_changed: "✅ **Model Changed!**\n\nNow using: **{name}**",
  model_error: "⚠️ Please switch to Llama 3.3 70B using /model command.",
  
  clear_confirm: "🗑️ **Clear Conversation History**\n\nAre you sure?",
  cleared: "✅ **Conversation history cleared!**",
  
  note_saved: "✅ **Note saved!**\nID: `{id}`",
  no_notes: "📝 **No notes yet.**",
  enter_note: "📝 **Enter your note:**",
  
  favorite_saved: "⭐ **Saved to favorites!**",
  no_favorites: "⭐ **No favorites yet.**",
  
  support_title: "🆘 **Support Request**\n\nDescribe your issue:",
  ticket_created: "✅ **Support ticket created!**\nID: `{id}`",
  
  feedback_title: "📝 **Send Feedback**",
  feedback_thanks: "✅ **Thank you for your feedback!**",
  
  stats_title: "📊 **Your Statistics**\n\n",
  stats_messages: "**Messages:** {user}\n",
  stats_ai: "**AI responses:** {ai}\n",
  stats_model: "**Model:** {model}\n",
  stats_notes: "**Notes:** {notes}\n",
  stats_favorites: "**Favorites:** {fav}\n",
  stats_id: "**User ID:** `{id}`\n",
  
  pro_tips: [
    "💡 Use /language to switch between English and Persian!",
    "💡 Use /model to change AI models!",
    "💡 Save info with /note command!",
    "💡 Bookmark responses with /favorite!",
    "💡 Clear history with /clear!",
    "💡 Use /privacy for user guide!"
  ]
};

// Persian translations
const fa = {
  welcome: "🌟 **خوش آمدید {name}!** 🌟\n\nمن **دستیار دو زبانه** شما هستم.\n\nلطفاً زبان خود را انتخاب کنید / Please select your language:",
  language_selected: "✅ زبان به فارسی تنظیم شد.",
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
  
  privacy_title: "🔒 **سیاست حریم خصوصی و راهنما**\n\n",
  privacy_fa: "**فارسی:**\n• مکالمات شما خصوصی است\n• با /clear تاریخچه را پاک کنید\n• با /note یادداشت ذخیره کنید\n• با /support کمک بگیرید\n",
  privacy_en: "**English:**\n• Your conversations are private\n• Clear history with /clear\n• Save notes with /note\n• Get help with /support\n",
  
  model_selection: "🤖 **انتخاب مدل:**\n\n⚠️ اگر خطا دیدید، به Llama 3.3 70B تغییر دهید.",
  model_changed: "✅ **مدل تغییر کرد!**\n\nمدل فعلی: **{name}**",
  model_error: "⚠️ لطفاً با /model به Llama 3.3 70B تغییر دهید.",
  
  clear_confirm: "🗑️ **پاک کردن تاریخچه**\n\nآیا مطمئن هستید؟",
  cleared: "✅ **تاریخچه پاک شد!**",
  
  note_saved: "✅ **یادداشت ذخیره شد!**\nشناسه: `{id}`",
  no_notes: "📝 **یادداشتی ندارید.**",
  enter_note: "📝 **یادداشت خود را وارد کنید:**",
  
  favorite_saved: "⭐ **ذخیره شد!**",
  no_favorites: "⭐ **مورد علاقه‌ای ندارید.**",
  
  support_title: "🆘 **درخواست پشتیبانی**\n\nمشکل خود را توضیح دهید:",
  ticket_created: "✅ **تیکت ایجاد شد!**\nشناسه: `{id}`",
  
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
    "💡 با /language زبان را تغییر دهید!",
    "💡 با /model مدل را عوض کنید!",
    "💡 اطلاعات را با /note ذخیره کنید!",
    "💡 پاسخ‌ها را با /favorite نشانه‌گذاری کنید!",
    "💡 تاریخچه را با /clear پاک کنید!",
    "💡 راهنما با /privacy!"
  ]
};

const translations = { en, fa };

// Helper functions
async function safeExecute(ctx, fn) {
  try { await fn(); } catch (error) {
    console.error(error);
    try { await ctx.reply('❌ Error. Please try again.'); } catch (e) {}
  }
}

async function forwardToAdmin(ctx, type = 'message', info = '') {
  try {
    const user = ctx.from;
    const lang = getUserLanguage(user.id);
    const text = `📨 **New Message**\nUser: ${user.first_name} (@${user.username || 'N/A'})\nID: \`${user.id}\`\nLang: ${lang === 'fa' ? 'فارسی' : 'English'}\nTime: ${new Date().toLocaleString()}\n\n${type === 'message' ? ctx.message.text : info}`;
    await bot.telegram.sendMessage(ADMIN_ID, text, { parse_mode: 'Markdown' });
  } catch (error) {}
}

function getUserLanguage(userId) {
  return userPreferences.get(userId)?.language || 'en';
}

function getProTip(userId) {
  const lang = getUserLanguage(userId);
  const tips = lang === 'fa' ? translations.fa.pro_tips : translations.en.pro_tips;
  return tips[Math.floor(Math.random() * tips.length)];
}

async function setBotCommands(lang) {
  const cmds = lang === 'fa' ? [
    ['start', translations.fa.start],
    ['help', translations.fa.help],
    ['language', translations.fa.language],
    ['model', translations.fa.model],
    ['clear', translations.fa.clear],
    ['note', translations.fa.note],
    ['mynotes', translations.fa.mynotes],
    ['favorite', translations.fa.favorite],
    ['myfavorites', translations.fa.myfavorites],
    ['support', translations.fa.support],
    ['feedback', translations.fa.feedback],
    ['stats', translations.fa.stats],
    ['about', translations.fa.about],
    ['privacy', translations.fa.privacy]
  ] : [
    ['start', translations.en.start],
    ['help', translations.en.help],
    ['language', translations.en.language],
    ['model', translations.en.model],
    ['clear', translations.en.clear],
    ['note', translations.en.note],
    ['mynotes', translations.en.mynotes],
    ['favorite', translations.en.favorite],
    ['myfavorites', translations.en.myfavorites],
    ['support', translations.en.support],
    ['feedback', translations.en.feedback],
    ['stats', translations.en.stats],
    ['about', translations.en.about],
    ['privacy', translations.en.privacy]
  ];
  await bot.telegram.setMyCommands(cmds.map(([c, d]) => ({ command: c, description: d })));
}

async function getAIResponse(msg, userId, model = 'llama-3.3-70b-versatile') {
  try {
    if (!userConversations.has(userId)) userConversations.set(userId, []);
    const history = userConversations.get(userId);
    history.push({ role: 'user', content: msg });
    if (history.length > 20) history.splice(0, history.length - 20);
    const res = await groq.chat.completions.create({ model, messages: history, temperature: 0.7, max_tokens: 2048 });
    const reply = res.choices[0]?.message?.content || '...';
    history.push({ role: 'assistant', content: reply });
    return { success: true, response: reply };
  } catch (error) {
    if (error.status === 403 || error.status === 404) return { success: false, error: 'region', response: '⚠️ Model not available. Use /model to switch to Llama 3.3 70B.' };
    return { success: false, error: 'unknown', response: '⚠️ Error. Try /model to change model.' };
  }
}

// Bot commands
bot.start(async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    userActivity.set(userId, Date.now());
    await forwardToAdmin(ctx, 'command', '/start');
    const prefs = userPreferences.get(userId) || {};
    if (!prefs.language) {
      await ctx.replyWithMarkdown('🌐 **Welcome! / خوش آمدید!**\n\nSelect language / زبان را انتخاب کنید:', 
        Markup.inlineKeyboard([[Markup.button.callback('🇬🇧 English', 'lang_en')], [Markup.button.callback('🇮🇷 فارسی', 'lang_fa')]]));
    } else {
      const lang = prefs.language;
      const t = lang === 'fa' ? translations.fa : translations.en;
      await ctx.replyWithMarkdown(t.welcome.replace('{name}', ctx.from.first_name), 
        Markup.inlineKeyboard([
          [Markup.button.callback(t.start_chat, 'start_chat')],
          [Markup.button.callback(t.help_support, 'help_support'), Markup.button.callback(t.about_bot, 'about_bot')],
          [Markup.button.callback(t.settings, 'settings'), Markup.button.callback(t.privacy_guide, 'privacy_guide')]
        ]));
      setTimeout(() => ctx.replyWithMarkdown(getProTip(userId)).catch(() => {}), 2000);
    }
    notifyAdmins(`🆕 New user: ${ctx.from.first_name} (${ctx.from.id})`);
  });
});

bot.command('language', async (ctx) => {
  await safeExecute(ctx, async () => {
    await forwardToAdmin(ctx, 'command', '/language');
    await ctx.replyWithMarkdown('🌐 **Select Language / انتخاب زبان**',
      Markup.inlineKeyboard([[Markup.button.callback('🇬🇧 English', 'lang_en')], [Markup.button.callback('🇮🇷 فارسی', 'lang_fa')]]));
  });
});

bot.command('privacy', async (ctx) => {
  await safeExecute(ctx, async () => {
    const lang = getUserLanguage(ctx.from.id);
    const t = lang === 'fa' ? translations.fa : translations.en;
    await ctx.replyWithMarkdown(t.privacy_title + (lang === 'fa' ? t.privacy_fa + '\n' + t.privacy_en : t.privacy_en + '\n' + t.privacy_fa),
      Markup.inlineKeyboard([[Markup.button.callback(t.back, 'main_menu')]]));
  });
});

bot.command('model', async (ctx) => {
  await safeExecute(ctx, async () => {
    const lang = getUserLanguage(ctx.from.id);
    const t = lang === 'fa' ? translations.fa : translations.en;
    const buttons = AVAILABLE_MODELS.map(m => [Markup.button.callback(lang === 'fa' ? `${m.name} - ${m.fa}` : `${m.name} - ${m.description}`, `model_${m.id}`)]);
    buttons.push([Markup.button.callback(t.main_menu, 'main_menu')]);
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
      await ctx.answerCbQuery(lang === 'fa' ? `انتخاب شد: ${m.name}` : `Selected: ${m.name}`);
      await ctx.editMessageText(t.model_changed.replace('{name}', m.name),
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[Markup.button.callback(t.back, 'settings')]] } });
    });
  });
});

// Language actions
bot.action('lang_en', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    if (!userPreferences.has(userId)) userPreferences.set(userId, {});
    userPreferences.get(userId).language = 'en';
    await setBotCommands('en');
    await ctx.answerCbQuery('Language set to English');
    await ctx.editMessageText(translations.en.welcome.replace('{name}', ctx.from.first_name),
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
        [Markup.button.callback(translations.en.start_chat, 'start_chat')],
        [Markup.button.callback(translations.en.help_support, 'help_support'), Markup.button.callback(translations.en.about_bot, 'about_bot')],
        [Markup.button.callback(translations.en.settings, 'settings'), Markup.button.callback(translations.en.privacy_guide, 'privacy_guide')]
      ] } });
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
    await ctx.editMessageText(translations.fa.welcome.replace('{name}', ctx.from.first_name),
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
        [Markup.button.callback(translations.fa.start_chat, 'start_chat')],
        [Markup.button.callback(translations.fa.help_support, 'help_support'), Markup.button.callback(translations.fa.about_bot, 'about_bot')],
        [Markup.button.callback(translations.fa.settings, 'settings'), Markup.button.callback(translations.fa.privacy_guide, 'privacy_guide')]
      ] } });
    setTimeout(() => ctx.replyWithMarkdown(getProTip(userId)).catch(() => {}), 2000);
  });
});

// Navigation actions
bot.action('start_chat', async (ctx) => {
  await safeExecute(ctx, async () => {
    const lang = getUserLanguage(ctx.from.id);
    await ctx.answerCbQuery();
    await ctx.replyWithMarkdown(lang === 'fa' ? '💬 **آماده گفتگو!** هر پیامی بفرستید.' : '💬 **Ready to chat!** Send any message.');
  });
});

bot.action('help_support', async (ctx) => {
  await safeExecute(ctx, async () => {
    const lang = getUserLanguage(ctx.from.id);
    const t = lang === 'fa' ? translations.fa : translations.en;
    await ctx.answerCbQuery();
    await ctx.replyWithMarkdown(
      lang === 'fa' ? '🆘 **مرکز پشتیبانی**\n• /support - تیکت\n• /feedback - بازخورد\n• /tip - نکته' : '🆘 **Support**\n• /support - Ticket\n• /feedback - Feedback\n• /tip - Tip',
      Markup.inlineKeyboard([[Markup.button.callback(t.back, 'main_menu')]]));
  });
});

bot.action('about_bot', async (ctx) => {
  await safeExecute(ctx, async () => {
    const lang = getUserLanguage(ctx.from.id);
    const t = lang === 'fa' ? translations.fa : translations.en;
    await ctx.answerCbQuery();
    await ctx.replyWithMarkdown(
      lang === 'fa' ? '🤖 **دستیار هوش مصنوعی**\nنسخه ۴.۰\nقدرت گرفته از Groq' : '🤖 **AI Assistant**\nVersion 4.0\nPowered by Groq',
      Markup.inlineKeyboard([[Markup.button.callback(t.back, 'main_menu')]]));
  });
});

bot.action('settings', async (ctx) => {
  await safeExecute(ctx, async () => {
    const lang = getUserLanguage(ctx.from.id);
    const t = lang === 'fa' ? translations.fa : translations.en;
    await ctx.answerCbQuery();
    await ctx.replyWithMarkdown(lang === 'fa' ? '⚙️ **تنظیمات**' : '⚙️ **Settings**',
      Markup.inlineKeyboard([
        [Markup.button.callback(lang === 'fa' ? '🤖 تغییر مدل' : '🤖 Change Model', 'change_model')],
        [Markup.button.callback(lang === 'fa' ? '🗑️ پاک کردن تاریخچه' : '🗑️ Clear History', 'confirm_clear')],
        [Markup.button.callback(lang === 'fa' ? '📊 آمار' : '📊 Stats', 'user_stats')],
        [Markup.button.callback(t.main_menu, 'main_menu')]
      ]));
  });
});

bot.action('change_model', async (ctx) => {
  await safeExecute(ctx, async () => {
    const lang = getUserLanguage(ctx.from.id);
    const t = lang === 'fa' ? translations.fa : translations.en;
    const buttons = AVAILABLE_MODELS.map(m => [Markup.button.callback(lang === 'fa' ? m.fa : m.name, `model_${m.id}`)]);
    buttons.push([Markup.button.callback(t.back, 'settings')]);
    await ctx.editMessageText(t.model_selection, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
  });
});

bot.action('confirm_clear', async (ctx) => {
  await safeExecute(ctx, async () => {
    const lang = getUserLanguage(ctx.from.id);
    const t = lang === 'fa' ? translations.fa : translations.en;
    await ctx.replyWithMarkdown(t.clear_confirm,
      Markup.inlineKeyboard([
        [Markup.button.callback(t.yes_clear, 'clear_history')],
        [Markup.button.callback(t.no_keep, 'settings')]
      ]));
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

bot.action('user_stats', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa : translations.en;
    const history = userConversations.get(userId) || [];
    const prefs = userPreferences.get(userId) || {};
    const model = AVAILABLE_MODELS.find(m => m.id === prefs.model)?.name || 'Llama 3.3 70B';
    await ctx.replyWithMarkdown(
      t.stats_title +
      t.stats_messages.replace('{user}', history.filter(m => m.role === 'user').length) +
      t.stats_ai.replace('{ai}', history.filter(m => m.role === 'assistant').length) +
      t.stats_model.replace('{model}', model) +
      t.stats_id.replace('{id}', userId),
      Markup.inlineKeyboard([[Markup.button.callback(t.back, 'settings')]])
    );
  });
});

bot.action('main_menu', async (ctx) => {
  await safeExecute(ctx, async () => {
    const lang = getUserLanguage(ctx.from.id);
    const t = lang === 'fa' ? translations.fa : translations.en;
    await ctx.answerCbQuery();
    await ctx.replyWithMarkdown(lang === 'fa' ? '🌟 **منوی اصلی**' : '🌟 **Main Menu**',
      Markup.inlineKeyboard([
        [Markup.button.callback(t.start_chat, 'start_chat')],
        [Markup.button.callback(t.help_support, 'help_support'), Markup.button.callback(t.about_bot, 'about_bot')],
        [Markup.button.callback(t.settings, 'settings'), Markup.button.callback(t.privacy_guide, 'privacy_guide')]
      ]));
  });
});

// Message handling
bot.on('text', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const msg = ctx.message.text;
    const state = userPreferences.get(`${userId}_state`);
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa : translations.en;
    
    userActivity.set(userId, Date.now());
    await forwardToAdmin(ctx);
    
    if (state === 'awaiting_note' && msg !== '/cancel') {
      userPreferences.delete(`${userId}_state`);
      if (!userNotes.has(userId)) userNotes.set(userId, []);
      const note = { id: Date.now(), text: msg, date: new Date().toLocaleString() };
      userNotes.get(userId).push(note);
      await ctx.replyWithMarkdown(t.note_saved.replace('{id}', note.id));
      return;
    }
    
    if (state === 'awaiting_support' && msg !== '/cancel') {
      userPreferences.delete(`${userId}_state`);
      const ticketId = Date.now().toString(36).toUpperCase();
      supportRequests.set(ticketId, { userId, message: msg, status: 'open' });
      await ctx.replyWithMarkdown(t.ticket_created.replace('{id}', ticketId));
      await notifyAdmins(`🆘 Ticket ${ticketId}: ${ctx.from.first_name}\n${msg}`);
      return;
    }
    
    if (state === 'awaiting_feedback' && msg !== '/cancel') {
      userPreferences.delete(`${userId}_state`);
      await ctx.replyWithMarkdown(t.feedback_thanks);
      await notifyAdmins(`📝 Feedback from ${ctx.from.first_name}: ${msg}`);
      return;
    }
    
    if (msg === '/cancel') {
      userPreferences.delete(`${userId}_state`);
      await ctx.reply('❌ Cancelled.');
      return;
    }
    
    await ctx.sendChatAction('typing');
    const prefs = userPreferences.get(userId) || {};
    const result = await getAIResponse(msg, userId, prefs.model || 'llama-3.3-70b-versatile');
    
    if (!result.success && result.error === 'region') {
      await ctx.replyWithMarkdown(t.model_error,
        { reply_markup: { inline_keyboard: [[Markup.button.callback(lang === 'fa' ? '🤖 تغییر مدل' : '🤖 Change Model', 'change_model')]] } });
      return;
    }
    
    const parts = result.response.match(/.{1,4096}/g) || [result.response];
    for (const part of parts) {
      await ctx.replyWithMarkdown(part, {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(t.save_favorite, 'save_favorite'), Markup.button.callback(t.pro_tip, 'pro_tip')],
            [Markup.button.callback(t.settings, 'settings'), Markup.button.callback(t.help_support, 'help_support')]
          ]
        }
      });
    }
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
      userFavorites.get(userId).push({ text: last.content.substring(0, 200) + '...', date: new Date().toLocaleString() });
      await ctx.answerCbQuery(lang === 'fa' ? 'ذخیره شد' : 'Saved');
      await ctx.reply(t.favorite_saved);
    }
  });
});

bot.action('pro_tip', async (ctx) => {
  await safeExecute(ctx, async () => {
    await ctx.answerCbQuery();
    await ctx.replyWithMarkdown(getProTip(ctx.from.id));
  });
});

bot.on(['photo', 'video', 'document'], (ctx) => {
  forwardToAdmin(ctx, 'media', 'Media ignored').catch(() => {});
});

async function notifyAdmins(msg) {
  for (const id of ADMIN_IDS) {
    try { await bot.telegram.sendMessage(id, msg, { parse_mode: 'Markdown' }); } catch (e) {}
  }
}

bot.catch((err, ctx) => {
  console.error(err);
  ctx?.reply('❌ Error. Try again.').catch(() => {});
  notifyAdmins(`❌ Bot error: ${err.message}`);
});

async function startBot() {
  try {
    await setBotCommands('en');
    await bot.launch({ dropPendingUpdates: true });
    console.log('✅ Bilingual bot running!');
    notifyAdmins('🤖 Bot started!');
  } catch (err) {
    console.error('Failed:', err);
    setTimeout(startBot, 5000);
  }
}

startBot();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);