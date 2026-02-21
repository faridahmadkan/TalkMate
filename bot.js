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

// Available models
const AVAILABLE_MODELS = [
  { name: 'Llama 3.3 70B', id: 'llama-3.3-70b-versatile', description: 'Most powerful, best for complex tasks' },
  { name: 'Llama 3.1 70B', id: 'llama-3.1-70b-versatile', description: 'Excellent all-rounder' },
  { name: 'Mixtral 8x7B', id: 'mixtral-8x7b-32768', description: 'Fast and efficient' },
  { name: 'Gemma 2 9B', id: 'gemma2-9b-it', description: 'Lightweight and quick' }
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

// ================= BOT COMMANDS =================

bot.start((ctx) => {
  const userId = ctx.from.id;
  userActivity.set(userId, Date.now());
  
  const welcome = `🌟 Welcome ${ctx.from.first_name}! 🌟

I'm your **Advanced AI Assistant** powered by Groq's lightning-fast language models.

Use the buttons below to get started or type /help for all commands.`;

  ctx.replyWithMarkdown(welcome, 
    Markup.inlineKeyboard([
      [Markup.button.callback('💬 Start Chatting', 'start_chat')],
      [Markup.button.callback('🆘 Help & Support', 'help_support'), Markup.button.callback('ℹ️ About', 'about_bot')],
      [Markup.button.callback('⚙️ Settings', 'settings')]
    ])
  );

  notifyAdmins(
    `🆕 **New User Started Bot**\n` +
    `Name: ${ctx.from.first_name} ${ctx.from.last_name || ''}\n` +
    `Username: @${ctx.from.username || 'N/A'}\n` +
    `ID: \`${ctx.from.id}\``,
    'Markdown'
  );
});

bot.help((ctx) => {
  const helpText = `
📚 **Help Menu**

**🤖 AI Commands:**
/model - Change AI model
/clear - Clear conversation history
/history - View conversation stats

**🆘 Support Commands:**
/support - Contact support team
/feedback - Send feedback

**ℹ️ Info Commands:**
/about - About this bot
/stats - Your usage statistics

Type any command or just send a message to chat!
`;

  ctx.replyWithMarkdown(helpText, 
    Markup.inlineKeyboard([
      [Markup.button.callback('🆘 Contact Support', 'help_support')],
      [Markup.button.callback('🤖 Change Model', 'change_model'), Markup.button.callback('ℹ️ About', 'about_bot')]
    ])
  );
});

bot.command('support', async (ctx) => {
  const userId = ctx.from.id;
  
  ctx.replyWithMarkdown(
    `🆘 **Support Request**\n\n` +
    `Please describe your issue in detail:\n\n` +
    `_Type your message or /cancel to abort._`,
    Markup.forceReply()
  );
  
  userPreferences.set(`${userId}_state`, 'awaiting_support');
});

bot.command('feedback', (ctx) => {
  ctx.replyWithMarkdown(
    `📝 **Send Feedback**\n\n` +
    `Please tell us your feedback:\n\n` +
    `_Type your feedback or /cancel to abort._`,
    Markup.forceReply()
  );
  
  userPreferences.set(`${ctx.from.id}_state`, 'awaiting_feedback');
});

bot.command('model', (ctx) => {
  const buttons = AVAILABLE_MODELS.map(model => 
    [Markup.button.callback(`${model.name}`, `select_model_${model.id}`)]
  );
  
  ctx.replyWithMarkdown(
    '🤖 **Select AI Model:**',
    Markup.inlineKeyboard(buttons)
  );
});

bot.command('clear', (ctx) => {
  userConversations.delete(ctx.from.id);
  ctx.replyWithMarkdown('✅ **Conversation history cleared!**');
});

bot.command('history', (ctx) => {
  const userId = ctx.from.id;
  const history = userConversations.get(userId) || [];
  const messageCount = history.length;
  const userMessages = history.filter(msg => msg.role === 'user').length;
  const aiMessages = history.filter(msg => msg.role === 'assistant').length;
  
  ctx.replyWithMarkdown(
    `📊 **Conversation Statistics**\n\n` +
    `Total messages: ${messageCount}\n` +
    `Your messages: ${userMessages}\n` +
    `AI responses: ${aiMessages}`
  );
});

bot.command('stats', (ctx) => {
  const userId = ctx.from.id;
  const history = userConversations.get(userId) || [];
  const preferences = userPreferences.get(userId) || { model: 'llama-3.3-70b-versatile' };
  
  const activeModel = AVAILABLE_MODELS.find(m => m.id === preferences.model) || AVAILABLE_MODELS[0];
  
  ctx.replyWithMarkdown(
    `📊 **Your Statistics**\n\n` +
    `**Messages sent:** ${history.filter(m => m.role === 'user').length}\n` +
    `**Current model:** ${activeModel.name}\n` +
    `**User ID:** \`${userId}\``
  );
});

bot.command('about', (ctx) => {
  ctx.replyWithMarkdown(
    `🤖 **Advanced AI Assistant**\n\n` +
    `**Version:** 2.0.0\n` +
    `**Powered by:** Khan's AI Solutions\n` +
    `**Technology:** Groq AI, Telegram Bot API\n` +
    `**Features:**\n` +
    `• Multiple AI models\n` +
    `• Support ticket system\n` +
    `• Conversation memory\n` +
    `• User statistics\n\n` +
    `🚀 Built for speed and reliability`
  );
});

// ================= CALLBACK HANDLERS =================

bot.action('start_chat', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown('💬 **Ready to chat!** Just send me any message.');
});

bot.action('help_support', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(
    '🆘 **Support Options**\n\n' +
    '• Use /support to create a support ticket\n' +
    '• Use /feedback to send feedback'
  );
});

bot.action('about_bot', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(
    `ℹ️ **About This Bot**\n\n` +
    `Advanced AI assistant powered by Groq.\n\n` +
    `**Developer:** Khan's AI Solutions\n` +
    `**Version:** 2.0.0`
  );
});

bot.action('settings', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(
    '⚙️ **Settings**',
    Markup.inlineKeyboard([
      [Markup.button.callback('🤖 Change Model', 'change_model')],
      [Markup.button.callback('🗑️ Clear History', 'confirm_clear')],
      [Markup.button.callback('📊 View Stats', 'user_stats')],
      [Markup.button.callback('🔙 Main Menu', 'main_menu')]
    ])
  );
});

bot.action('change_model', async (ctx) => {
  await ctx.answerCbQuery();
  
  const buttons = AVAILABLE_MODELS.map(model => 
    [Markup.button.callback(`${model.name}`, `select_${model.id}`)]
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
  bot.action(`select_${model.id}`, async (ctx) => {
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
  await ctx.editMessageText('✅ Conversation history cleared!');
});

bot.action('user_stats', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const history = userConversations.get(userId) || [];
  const preferences = userPreferences.get(userId) || { model: 'llama-3.3-70b-versatile' };
  const activeModel = AVAILABLE_MODELS.find(m => m.id === preferences.model) || AVAILABLE_MODELS[0];
  
  await ctx.replyWithMarkdown(
    `📊 **Your Statistics**\n\n` +
    `**Total messages:** ${history.length}\n` +
    `**Your messages:** ${history.filter(m => m.role === 'user').length}\n` +
    `**AI responses:** ${history.filter(m => m.role === 'assistant').length}\n` +
    `**Current model:** ${activeModel.name}\n` +
    `**User ID:** \`${userId}\``,
    Markup.inlineKeyboard([
      [Markup.button.callback('🔙 Back to Settings', 'settings')]
    ])
  );
});

bot.action('main_menu', async (ctx) => {
  await ctx.answerCbQuery();
  
  const welcome = `🌟 Welcome back! 🌟

What would you like to do?`;

  await ctx.replyWithMarkdown(welcome,
    Markup.inlineKeyboard([
      [Markup.button.callback('💬 Start Chatting', 'start_chat')],
      [Markup.button.callback('🆘 Help & Support', 'help_support'), Markup.button.callback('ℹ️ About', 'about_bot')],
      [Markup.button.callback('⚙️ Settings', 'settings')]
    ])
  );
});

// Catch all other actions
bot.on('callback_query', async (ctx) => {
  await ctx.answerCbQuery();
  console.log('Unhandled action:', ctx.callbackQuery.data);
});

// ================= MESSAGE HANDLING =================

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const userMessage = ctx.message.text;
  const state = userPreferences.get(`${userId}_state`);
  
  userActivity.set(userId, Date.now());
  
  // Handle support ticket creation
  if (state === 'awaiting_support' && userMessage !== '/cancel') {
    userPreferences.delete(`${userId}_state`);
    
    const ticketId = Date.now().toString(36).toUpperCase();
    supportRequests.set(ticketId, {
      userId: userId,
      message: userMessage,
      status: 'open',
      timestamp: Date.now(),
      userName: `${ctx.from.first_name} ${ctx.from.last_name || ''}`.trim()
    });
    
    await ctx.replyWithMarkdown(
      `✅ **Support ticket created!**\n\nTicket ID: \`${ticketId}\``
    );
    
    await notifyAdmins(
      `🆘 **New Support Ticket**\n\n` +
      `Ticket ID: \`${ticketId}\`\n` +
      `User: ${ctx.from.first_name}\n` +
      `Message: ${userMessage}`,
      'Markdown'
    );
    return;
  }
  
  // Handle feedback
  else if (state === 'awaiting_feedback' && userMessage !== '/cancel') {
    userPreferences.delete(`${userId}_state`);
    
    await ctx.replyWithMarkdown('✅ Thank you for your feedback!');
    
    await notifyAdmins(
      `📝 **New Feedback**\n\n` +
      `User: ${ctx.from.first_name}\n` +
      `Feedback: ${userMessage}`,
      'Markdown'
    );
    return;
  }
  
  else if (userMessage === '/cancel') {
    userPreferences.delete(`${userId}_state`);
    await ctx.reply('Operation cancelled.');
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
    await ctx.replyWithMarkdown(part);
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
    notifyAdmins(
      `🤖 **Bot Started**\n\nTime: ${new Date().toLocaleString()}`,
      'Markdown'
    );
  })
  .catch(err => {
    console.error('❌ Failed to start bot:', err);
    process.exit(1);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));