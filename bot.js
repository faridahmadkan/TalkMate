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

// Parse admin IDs from environment variable
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : ['6939078859', '6336847895'];

// Web server for Render
app.get('/', (req, res) => res.send('🤖 Advanced AI Bot is running!'));
app.get('/health', (req, res) => res.status(200).send('OK'));

app.listen(PORT, '0.0.0.0', () => console.log(`✅ Server on port ${PORT}`));

// In-memory storage
const userConversations = new Map();
const userPreferences = new Map();
const supportRequests = new Map();
const userActivity = new Map();
const userNotes = new Map(); // For note-taking feature
const userReminders = new Map(); // For reminders
const userFavorites = new Map(); // For favorite responses

// Available models
const AVAILABLE_MODELS = [
  { name: 'Llama 3.3 70B', id: 'llama-3.3-70b-versatile', description: 'Most powerful, best for complex tasks' },
  { name: 'Llama 3.1 70B', id: 'llama-3.1-70b-versatile', description: 'Excellent all-rounder' },
  { name: 'Mixtral 8x7B', id: 'mixtral-8x7b-32768', description: 'Fast and efficient' },
  { name: 'Gemma 2 9B', id: 'gemma2-9b-it', description: 'Lightweight and quick' }
];

// Pro tips database
const PRO_TIPS = [
  "💡 **Pro Tip:** Use /model to switch between different AI models for different tasks!",
  "💡 **Pro Tip:** You can use /note to save important information and /mynotes to view them.",
  "💡 **Pro Tip:** The bot remembers our conversation! Use /clear to start fresh anytime.",
  "💡 **Pro Tip:** Use /feedback to suggest new features or report issues.",
  "💡 **Pro Tip:** You can export your conversation with /export command.",
  "💡 **Pro Tip:** Use /stats to see your usage statistics.",
  "💡 **Pro Tip:** Different models excel at different tasks - experiment to find your favorite!",
  "💡 **Pro Tip:** Use /support if you need help from the admin team.",
  "💡 **Pro Tip:** You can use /remind to set reminders for yourself.",
  "💡 **Pro Tip:** Bookmark important responses with /favorite command."
];

async function getAIResponse(userMessage, userId, model = 'llama-3.3-70b-versatile') {
  try {
    if (!userConversations.has(userId)) {
      userConversations.set(userId, []);
    }
    const history = userConversations.get(userId);

    history.push({ role: 'user', content: userMessage });

    const MAX_HISTORY = 20;
    if (history.length > MAX_HISTORY) {
      history.splice(0, history.length - MAX_HISTORY);
    }

    console.log(`🔄 Calling Groq API for user ${userId} with model: ${model}`);
    
    const chatCompletion = await groq.chat.completions.create({
      model: model,
      messages: history,
      temperature: 0.7,
      max_tokens: 2048,
    });

    console.log('✅ Groq API response received');
    
    const aiReply = chatCompletion.choices[0]?.message?.content || 'I received an empty response.';
    history.push({ role: 'assistant', content: aiReply });

    return aiReply;

  } catch (error) {
    console.error('❌ Groq API Error:', error.message);
    
    if (error.status === 401) {
      return '❌ Authentication Error: Invalid API key.';
    } else if (error.status === 403) {
      return '❌ Authorization Error: API key permission issue.';
    } else if (error.status === 429) {
      return '⚡ Rate Limit: Too many requests. Please wait.';
    } else {
      return `⚠️ Error: ${error.message || 'Please try again later.'}`;
    }
  }
}

async function notifyAdmins(message, parseMode = null) {
  for (const adminId of ADMIN_IDS) {
    try {
      const options = parseMode ? { parse_mode: parseMode } : {};
      await bot.telegram.sendMessage(adminId, message, options);
    } catch (error) {
      console.error(`Failed to notify admin ${adminId}:`, error.message);
    }
  }
}

function splitMessage(text, maxLength = 4096) {
  if (text.length <= maxLength) return [text];
  const parts = [];
  const chunks = text.match(new RegExp(`.{1,${maxLength}}`, 'g')) || [];
  return chunks;
}

// Function to show random pro tip
async function showProTip(ctx) {
  const randomTip = PRO_TIPS[Math.floor(Math.random() * PRO_TIPS.length)];
  await ctx.replyWithMarkdown(randomTip);
}

// ================= BOT COMMANDS =================

// Set bot commands for menu (this shows in Telegram's bottom left menu)
bot.telegram.setMyCommands([
  { command: 'start', description: '🚀 Start the bot' },
  { command: 'help', description: '📚 Show all commands' },
  { command: 'model', description: '🤖 Change AI model' },
  { command: 'clear', description: '🗑️ Clear chat history' },
  { command: 'history', description: '📊 View conversation stats' },
  { command: 'export', description: '📤 Export conversation' },
  { command: 'note', description: '📝 Save a note' },
  { command: 'mynotes', description: '📋 View your notes' },
  { command: 'remind', description: '⏰ Set a reminder' },
  { command: 'favorite', description: '⭐ Save favorite response' },
  { command: 'myfavorites', description: '✨ View favorites' },
  { command: 'support', description: '🆘 Contact support' },
  { command: 'feedback', description: '💬 Send feedback' },
  { command: 'stats', description: '📈 Your statistics' },
  { command: 'about', description: 'ℹ️ About this bot' },
  { command: 'tip', description: '💡 Get a pro tip' }
]);

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  userActivity.set(userId, Date.now());
  
  const welcome = `🌟 **Welcome ${ctx.from.first_name}!** 🌟

I'm your **Advanced AI Assistant** powered by Groq's lightning-fast language models.

🔍 **What I can do:**
• Answer questions & have conversations
• Save notes & set reminders
• Multiple AI models to choose from
• Export conversations
• Support ticket system
• And much more!

📱 **Use the menu button (bottom left) to see all commands!**

Let's get started!`;

  await ctx.replyWithMarkdown(welcome, 
    Markup.inlineKeyboard([
      [Markup.button.callback('💬 Start Chatting', 'start_chat')],
      [Markup.button.callback('🆘 Help & Support', 'help_support'), Markup.button.callback('ℹ️ About', 'about_bot')],
      [Markup.button.callback('⚙️ Settings', 'settings'), Markup.button.callback('💡 Pro Tip', 'pro_tip')]
    ])
  );

  // Show random pro tip after welcome
  setTimeout(() => showProTip(ctx), 2000);

  notifyAdmins(
    `🆕 **New User Started Bot**\n` +
    `Name: ${ctx.from.first_name} ${ctx.from.last_name || ''}\n` +
    `Username: @${ctx.from.username || 'N/A'}\n` +
    `ID: \`${ctx.from.id}\``,
    'Markdown'
  );
});

bot.help(async (ctx) => {
  const helpText = `
📚 **Complete Command List**

**🤖 AI & Chat:**
/start - Restart the bot
/help - Show this menu
/model - Change AI model
/clear - Clear chat history
/history - View conversation stats
/export - Export conversation

**📝 Notes & Reminders:**
/note <text> - Save a note
/mynotes - View your notes
/remind <text> - Set a reminder
/favorite - Save last response
/myfavorites - View favorites

**🆘 Support:**
/support - Contact support team
/feedback - Send feedback
/tip - Get a pro tip

**ℹ️ Info:**
/stats - Your usage statistics
/about - About this bot

💡 **Pro Tip:** Click the menu button (☰) at bottom left to see all commands anytime!
`;

  await ctx.replyWithMarkdown(helpText, 
    Markup.inlineKeyboard([
      [Markup.button.callback('🆘 Contact Support', 'help_support')],
      [Markup.button.callback('🤖 Change Model', 'change_model'), Markup.button.callback('🗑️ Clear History', 'confirm_clear')],
      [Markup.button.callback('📝 Notes', 'notes_menu'), Markup.button.callback('💡 Pro Tip', 'pro_tip')]
    ])
  );
});

// Note taking command
bot.command('note', async (ctx) => {
  const note = ctx.message.text.replace('/note', '').trim();
  const userId = ctx.from.id;
  
  if (!note) {
    return ctx.replyWithMarkdown(
      '📝 **Please provide a note:**\nExample: `/note Buy groceries tomorrow`',
      Markup.forceReply()
    );
  }
  
  if (!userNotes.has(userId)) {
    userNotes.set(userId, []);
  }
  
  const notes = userNotes.get(userId);
  const noteObj = {
    id: Date.now(),
    text: note,
    date: new Date().toLocaleString()
  };
  notes.push(noteObj);
  
  await ctx.replyWithMarkdown(`✅ **Note saved!**\nID: \`${noteObj.id}\`\nUse /mynotes to view all notes.`);
});

bot.command('mynotes', async (ctx) => {
  const userId = ctx.from.id;
  const notes = userNotes.get(userId) || [];
  
  if (notes.length === 0) {
    return ctx.replyWithMarkdown('📝 **No notes yet.** Use /note to create one.');
  }
  
  let notesText = '📝 **Your Notes:**\n\n';
  notes.slice(-5).reverse().forEach((note, index) => {
    notesText += `*${index + 1}.* ${note.text}\n📅 ${note.date}\n\n`;
  });
  
  notesText += `_Total notes: ${notes.length}_`;
  
  await ctx.replyWithMarkdown(notesText);
});

// Reminder command
bot.command('remind', async (ctx) => {
  const reminder = ctx.message.text.replace('/remind', '').trim();
  const userId = ctx.from.id;
  
  if (!reminder) {
    return ctx.replyWithMarkdown(
      '⏰ **Please provide a reminder:**\nExample: `/remind Call mom in 1 hour`',
      Markup.forceReply()
    );
  }
  
  if (!userReminders.has(userId)) {
    userReminders.set(userId, []);
  }
  
  const reminders = userReminders.get(userId);
  reminders.push({
    text: reminder,
    date: new Date().toLocaleString(),
    active: true
  });
  
  await ctx.replyWithMarkdown(`✅ **Reminder set!**\n⏰ ${reminder}`);
});

// Favorite command
bot.command('favorite', async (ctx) => {
  const userId = ctx.from.id;
  const history = userConversations.get(userId) || [];
  
  if (history.length === 0) {
    return ctx.reply('No conversation to favorite.');
  }
  
  const lastResponse = history.filter(msg => msg.role === 'assistant').pop();
  
  if (!lastResponse) {
    return ctx.reply('No AI response to favorite.');
  }
  
  if (!userFavorites.has(userId)) {
    userFavorites.set(userId, []);
  }
  
  const favorites = userFavorites.get(userId);
  favorites.push({
    text: lastResponse.content.substring(0, 200) + '...',
    fullText: lastResponse.content,
    date: new Date().toLocaleString()
  });
  
  await ctx.replyWithMarkdown('⭐ **Saved to favorites!** Use /myfavorites to view.');
});

bot.command('myfavorites', async (ctx) => {
  const userId = ctx.from.id;
  const favorites = userFavorites.get(userId) || [];
  
  if (favorites.length === 0) {
    return ctx.reply('No favorites yet. Use /favorite to save responses.');
  }
  
  let favText = '⭐ **Your Favorites:**\n\n';
  favorites.slice(-5).reverse().forEach((fav, index) => {
    favText += `*${index + 1}.* ${fav.text}\n📅 ${fav.date}\n\n`;
  });
  
  await ctx.replyWithMarkdown(favText);
});

bot.command('model', async (ctx) => {
  const buttons = AVAILABLE_MODELS.map(model => 
    [Markup.button.callback(`${model.name} - ${model.description}`, `select_model_${model.id}`)]
  );
  
  await ctx.replyWithMarkdown(
    '🤖 **Select AI Model:**\n\nChoose the model that best suits your needs:',
    Markup.inlineKeyboard(buttons)
  );
});

bot.command('clear', async (ctx) => {
  await ctx.replyWithMarkdown(
    '🗑️ **Clear Chat History**\n\nAre you sure?',
    Markup.inlineKeyboard([
      [Markup.button.callback('✅ Yes, clear it', 'clear_history')],
      [Markup.button.callback('❌ No, keep it', 'cancel')]
    ])
  );
});

bot.command('history', async (ctx) => {
  const userId = ctx.from.id;
  const history = userConversations.get(userId) || [];
  const messageCount = history.length;
  const userMessages = history.filter(msg => msg.role === 'user').length;
  const aiMessages = history.filter(msg => msg.role === 'assistant').length;
  
  await ctx.replyWithMarkdown(
    `📊 **Conversation Statistics**\n\n` +
    `Total messages: ${messageCount}\n` +
    `Your messages: ${userMessages}\n` +
    `AI responses: ${aiMessages}\n` +
    `Memory usage: ${Math.round(JSON.stringify(history).length / 1024)} KB`
  );
});

bot.command('export', async (ctx) => {
  const userId = ctx.from.id;
  const history = userConversations.get(userId) || [];
  
  if (history.length === 0) {
    return ctx.reply('No conversation history to export.');
  }
  
  let exportText = `📤 **Conversation Export**\n`;
  exportText += `User: ${ctx.from.first_name}\n`;
  exportText += `Date: ${new Date().toLocaleString()}\n`;
  exportText += `Total Messages: ${history.length}\n`;
  exportText += `─${'─'.repeat(30)}\n\n`;
  
  history.forEach((msg) => {
    const role = msg.role === 'user' ? '👤 You' : '🤖 AI';
    exportText += `${role}: ${msg.content}\n\n`;
  });
  
  const parts = splitMessage(exportText, 3500);
  for (const part of parts) {
    await ctx.reply(part, { parse_mode: 'Markdown' });
  }
});

bot.command('stats', async (ctx) => {
  const userId = ctx.from.id;
  const history = userConversations.get(userId) || [];
  const preferences = userPreferences.get(userId) || { model: 'llama-3.3-70b-versatile' };
  const notes = userNotes.get(userId) || [];
  const favorites = userFavorites.get(userId) || [];
  
  const activeModel = AVAILABLE_MODELS.find(m => m.id === preferences.model) || AVAILABLE_MODELS[0];
  const lastActive = userActivity.get(userId) ? new Date(userActivity.get(userId)).toLocaleString() : 'Never';
  
  await ctx.replyWithMarkdown(
    `📊 **Your Statistics**\n\n` +
    `**Messages sent:** ${history.filter(m => m.role === 'user').length}\n` +
    `**AI responses:** ${history.filter(m => m.role === 'assistant').length}\n` +
    `**Current model:** ${activeModel.name}\n` +
    `**Notes saved:** ${notes.length}\n` +
    `**Favorites:** ${favorites.length}\n` +
    `**Last active:** ${lastActive}\n` +
    `**User ID:** \`${userId}\``
  );
});

bot.command('support', async (ctx) => {
  const userId = ctx.from.id;
  
  await ctx.replyWithMarkdown(
    `🆘 **Support Request**\n\n` +
    `Please describe your issue in detail:\n\n` +
    `_Type your message or /cancel to abort._`,
    Markup.forceReply()
  );
  
  userPreferences.set(`${userId}_state`, 'awaiting_support');
});

bot.command('feedback', async (ctx) => {
  await ctx.replyWithMarkdown(
    `📝 **Send Feedback**\n\n` +
    `Please tell us your feedback:\n\n` +
    `_Type your feedback or /cancel to abort._`,
    Markup.forceReply()
  );
  
  userPreferences.set(`${ctx.from.id}_state`, 'awaiting_feedback');
});

bot.command('tip', async (ctx) => {
  await showProTip(ctx);
});

bot.command('about', async (ctx) => {
  await ctx.replyWithMarkdown(
    `🤖 **Advanced AI Assistant**\n\n` +
    `**Version:** 3.0.0\n` +
    `**Powered by:** Khan's AI Solutions\n` +
    `**Technology:** Groq AI, Telegram Bot API\n` +
    `**Features:**\n` +
    `• Multiple AI models\n` +
    `• Note taking system\n` +
    `• Reminders\n` +
    `• Favorites\n` +
    `• Support ticket system\n` +
    `• Conversation export\n` +
    `• User statistics\n` +
    `• Pro tips\n\n` +
    `🚀 Built for speed and reliability\n` +
    `📱 Use menu button for all commands`
  );
});

// ================= CALLBACK HANDLERS =================

bot.action('start_chat', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown('💬 **Ready to chat!** Just send me any message and I\'ll respond.\n\n' +
    'Try asking me questions, requesting help with coding, or just having a conversation!');
});

bot.action('help_support', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(
    '🆘 **Support Center**\n\n' +
    '**Available options:**\n' +
    '• /support - Create a support ticket\n' +
    '• /feedback - Send feedback\n' +
    '• /tip - Get pro tips\n\n' +
    'Our team typically responds within 24 hours.',
    Markup.inlineKeyboard([
      [Markup.button.callback('📝 Create Ticket', 'create_ticket')],
      [Markup.button.callback('💬 Send Feedback', 'send_feedback')],
      [Markup.button.callback('🔙 Main Menu', 'main_menu')]
    ])
  );
});

bot.action('create_ticket', async (ctx) => {
  await ctx.answerCbQuery();
  userPreferences.set(`${ctx.from.id}_state`, 'awaiting_support');
  await ctx.replyWithMarkdown(
    '🆘 **Please describe your issue:**\n\n_Type your message:_',
    Markup.forceReply()
  );
});

bot.action('send_feedback', async (ctx) => {
  await ctx.answerCbQuery();
  userPreferences.set(`${ctx.from.id}_state`, 'awaiting_feedback');
  await ctx.replyWithMarkdown(
    '📝 **Please share your feedback:**\n\n_Type your message:_',
    Markup.forceReply()
  );
});

bot.action('about_bot', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(
    `ℹ️ **About This Bot**\n\n` +
    `Advanced AI assistant powered by Groq's lightning-fast inference.\n\n` +
    `**Developer:** Khan's AI Solutions\n` +
    `**Version:** 3.0.0\n` +
    `**Released:** 2024\n\n` +
    `**Key Features:**\n` +
    `• 4 different AI models\n` +
    `• Note taking system\n` +
    `• Reminders\n` +
    `• Favorites\n` +
    `• Support tickets\n` +
    `• Conversation export\n\n` +
    `For support, use /support command.`,
    Markup.inlineKeyboard([
      [Markup.button.callback('🔙 Main Menu', 'main_menu')]
    ])
  );
});

bot.action('settings', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(
    '⚙️ **Settings Menu**\n\nCustomize your experience:',
    Markup.inlineKeyboard([
      [Markup.button.callback('🤖 Change AI Model', 'change_model')],
      [Markup.button.callback('🗑️ Clear History', 'confirm_clear')],
      [Markup.button.callback('📊 View Stats', 'user_stats')],
      [Markup.button.callback('📝 Notes Menu', 'notes_menu')],
      [Markup.button.callback('⭐ Favorites', 'view_favorites')],
      [Markup.button.callback('🔙 Main Menu', 'main_menu')]
    ])
  );
});

bot.action('notes_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(
    '📝 **Notes Menu**\n\nManage your notes:',
    Markup.inlineKeyboard([
      [Markup.button.callback('📋 View Notes', 'view_notes')],
      [Markup.button.callback('➕ New Note', 'new_note')],
      [Markup.button.callback('🗑️ Clear Notes', 'clear_notes')],
      [Markup.button.callback('🔙 Settings', 'settings')]
    ])
  );
});

bot.action('view_notes', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const notes = userNotes.get(userId) || [];
  
  if (notes.length === 0) {
    return ctx.replyWithMarkdown('📝 **No notes yet.** Use /note to create one.');
  }
  
  let notesText = '📝 **Your Notes:**\n\n';
  notes.slice(-10).reverse().forEach((note, index) => {
    notesText += `*${index + 1}.* ${note.text}\n📅 ${note.date}\n\n`;
  });
  
  await ctx.replyWithMarkdown(notesText);
});

bot.action('new_note', async (ctx) => {
  await ctx.answerCbQuery();
  userPreferences.set(`${ctx.from.id}_state`, 'awaiting_note');
  await ctx.replyWithMarkdown(
    '📝 **Enter your note:**\n\n_Type your message:_',
    Markup.forceReply()
  );
});

bot.action('clear_notes', async (ctx) => {
  await ctx.answerCbQuery();
  userNotes.delete(ctx.from.id);
  await ctx.replyWithMarkdown('✅ **All notes cleared!**');
});

bot.action('view_favorites', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const favorites = userFavorites.get(userId) || [];
  
  if (favorites.length === 0) {
    return ctx.replyWithMarkdown('⭐ **No favorites yet.** Use /favorite to save responses.');
  }
  
  let favText = '⭐ **Your Favorites:**\n\n';
  favorites.slice(-5).reverse().forEach((fav, index) => {
    favText += `*${index + 1}.* ${fav.text}\n📅 ${fav.date}\n\n`;
  });
  
  await ctx.replyWithMarkdown(favText);
});

bot.action('pro_tip', async (ctx) => {
  await ctx.answerCbQuery();
  await showProTip(ctx);
});

bot.action('change_model', async (ctx) => {
  await ctx.answerCbQuery();
  
  const buttons = AVAILABLE_MODELS.map(model => 
    [Markup.button.callback(`${model.name}`, `select_model_${model.id}`)]
  );
  buttons.push([Markup.button.callback('🔙 Back to Settings', 'settings')]);
  
  await ctx.editMessageText(
    '🤖 **Select AI Model:**\n\nChoose a model:',
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    }
  );
});

// Handle model selection
AVAILABLE_MODELS.forEach(model => {
  bot.action(`select_model_${model.id}`, async (ctx) => {
    await ctx.answerCbQuery(`Selected: ${model.name}`);
    
    const userId = ctx.from.id;
    if (!userPreferences.has(userId)) {
      userPreferences.set(userId, {});
    }
    const prefs = userPreferences.get(userId);
    prefs.model = model.id;
    
    await ctx.editMessageText(
      `✅ **Model Changed!**\n\nNow using: **${model.name}**\n${model.description}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('🔙 Back to Models', 'change_model')],
            [Markup.button.callback('🏠 Main Menu', 'main_menu')]
          ]
        }
      }
    );
  });
});

bot.action('confirm_clear', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(
    '🗑️ **Clear Conversation History**\n\nAre you sure?',
    Markup.inlineKeyboard([
      [Markup.button.callback('✅ Yes, clear it', 'clear_history')],
      [Markup.button.callback('❌ No, keep it', 'settings')]
    ])
  );
});

bot.action('clear_history', async (ctx) => {
  await ctx.answerCbQuery('History cleared!');
  userConversations.delete(ctx.from.id);
  await ctx.editMessageText('✅ **Conversation history cleared!** Starting fresh.');
});

bot.action('user_stats', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const history = userConversations.get(userId) || [];
  const preferences = userPreferences.get(userId) || { model: 'llama-3.3-70b-versatile' };
  const notes = userNotes.get(userId) || [];
  const favorites = userFavorites.get(userId) || [];
  
  const activeModel = AVAILABLE_MODELS.find(m => m.id === preferences.model) || AVAILABLE_MODELS[0];
  
  await ctx.replyWithMarkdown(
    `📊 **Your Statistics**\n\n` +
    `**Total messages:** ${history.length}\n` +
    `**Your messages:** ${history.filter(m => m.role === 'user').length}\n` +
    `**AI responses:** ${history.filter(m => m.role === 'assistant').length}\n` +
    `**Current model:** ${activeModel.name}\n` +
    `**Notes saved:** ${notes.length}\n` +
    `**Favorites:** ${favorites.length}\n` +
    `**User ID:** \`${userId}\``,
    Markup.inlineKeyboard([
      [Markup.button.callback('🔙 Back to Settings', 'settings')]
    ])
  );
});

bot.action('main_menu', async (ctx) => {
  await ctx.answerCbQuery();
  
  const welcome = `🌟 **Main Menu** 🌟\n\nWhat would you like to do?`;

  await ctx.replyWithMarkdown(welcome,
    Markup.inlineKeyboard([
      [Markup.button.callback('💬 Start Chatting', 'start_chat')],
      [Markup.button.callback('🆘 Help & Support', 'help_support'), Markup.button.callback('ℹ️ About', 'about_bot')],
      [Markup.button.callback('⚙️ Settings', 'settings'), Markup.button.callback('💡 Pro Tip', 'pro_tip')]
    ])
  );
});

bot.action('cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.deleteMessage();
});

// ================= MESSAGE HANDLING =================

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const userMessage = ctx.message.text;
  const state = userPreferences.get(`${userId}_state`);
  
  userActivity.set(userId, Date.now());
  
  // Handle note creation
  if (state === 'awaiting_note' && userMessage !== '/cancel') {
    userPreferences.delete(`${userId}_state`);
    
    if (!userNotes.has(userId)) {
      userNotes.set(userId, []);
    }
    
    const notes = userNotes.get(userId);
    const noteObj = {
      id: Date.now(),
      text: userMessage,
      date: new Date().toLocaleString()
    };
    notes.push(noteObj);
    
    await ctx.replyWithMarkdown(`✅ **Note saved!**\nID: \`${noteObj.id}\``);
    return;
  }
  
  // Handle support ticket creation
  if (state === 'awaiting_support' && userMessage !== '/cancel') {
    userPreferences.delete(`${userId}_state`);
    
    const ticketId = Date.now().toString(36).toUpperCase();
    supportRequests.set(ticketId, {
      userId: userId,
      message: userMessage,
      status: 'open',
      timestamp: Date.now(),
      userName: `${ctx.from.first_name} ${ctx.from.last_name || ''}`.trim(),
      username: ctx.from.username
    });
    
    await ctx.replyWithMarkdown(
      `✅ **Support ticket created!**\n\nTicket ID: \`${ticketId}\`\n\n` +
      `Our team will respond within 24 hours.`
    );
    
    await notifyAdmins(
      `🆘 **New Support Ticket**\n\n` +
      `Ticket ID: \`${ticketId}\`\n` +
      `User: ${ctx.from.first_name} @${ctx.from.username || 'N/A'}\n` +
      `ID: \`${userId}\`\n\n` +
      `**Message:**\n${userMessage}`,
      'Markdown'
    );
    return;
  }
  
  // Handle feedback
  else if (state === 'awaiting_feedback' && userMessage !== '/cancel') {
    userPreferences.delete(`${userId}_state`);
    
    await ctx.replyWithMarkdown('✅ **Thank you for your feedback!** We appreciate your input.');
    
    await notifyAdmins(
      `📝 **New Feedback**\n\n` +
      `User: ${ctx.from.first_name} @${ctx.from.username || 'N/A'}\n` +
      `ID: \`${userId}\`\n\n` +
      `**Feedback:**\n${userMessage}`,
      'Markdown'
    );
    return;
  }
  
  else if (userMessage === '/cancel') {
    userPreferences.delete(`${userId}_state`);
    await ctx.reply('❌ Operation cancelled.');
    return;
  }
  
  // Regular chat message
  console.log(`📨 Message from ${userId}`);
  
  await ctx.sendChatAction('typing');
  
  const prefs = userPreferences.get(userId) || {};
  const model = prefs.model || 'llama-3.3-70b-versatile';
  
  const aiResponse = await getAIResponse(userMessage, userId, model);
  
  const messageParts = splitMessage(aiResponse);
  for (const part of messageParts) {
    await ctx.replyWithMarkdown(part, {
      reply_markup: {
        inline_keyboard: [
          [Markup.button.callback('⭐ Save as Favorite', 'save_favorite'), Markup.button.callback('💡 Tip', 'pro_tip')],
          [Markup.button.callback('⚙️ Settings', 'settings'), Markup.button.callback('🆘 Support', 'help_support')]
        ]
      }
    });
  }
});

// Handle save favorite from message
bot.action('save_favorite', async (ctx) => {
  await ctx.answerCbQuery('Saved to favorites!');
  const userId = ctx.from.id;
  const history = userConversations.get(userId) || [];
  const lastResponse = history.filter(msg => msg.role === 'assistant').pop();
  
  if (lastResponse) {
    if (!userFavorites.has(userId)) {
      userFavorites.set(userId, []);
    }
    
    const favorites = userFavorites.get(userId);
    favorites.push({
      text: lastResponse.content.substring(0, 200) + '...',
      fullText: lastResponse.content,
      date: new Date().toLocaleString()
    });
    
    await ctx.reply('⭐ Response saved to favorites! Use /myfavorites to view.');
  }
});

// Handle errors
bot.catch((err, ctx) => {
  console.error('Bot Error:', err);
  ctx.reply('❌ An error occurred. Please try again.').catch(() => {});
});

// Start bot
bot.launch()
  .then(() => {
    console.log('✅ Bot is running!');
    console.log('📊 Features loaded: Notes, Reminders, Favorites, Multiple Models, Support System');
    notifyAdmins(
      `🤖 **Bot Started - Version 3.0**\n\n` +
      `Time: ${new Date().toLocaleString()}\n` +
      `Features: Notes, Reminders, Favorites, Multi-model`,
      'Markdown'
    );
  })
  .catch(err => {
    console.error('❌ Failed to start bot:', err);
    process.exit(1);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));