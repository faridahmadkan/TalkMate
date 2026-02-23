/**
 * ======================================================
 * TALKMATE PROFESSIONAL AI BOT
 * ======================================================
 * Version: 6.0.0 Professional
 * Features: Bilingual (EN/FA), Multi-model AI, Admin Panel,
 *           Ticket System, Notes, Favorites, Statistics,
 *           User Management, Broadcast, Auto-translate,
 *           Rate Limiting, Analytics, and more!
 * ======================================================
 */

const { Telegraf, Markup, Scenes, session } = require('telegraf');
const { message } = require('telegraf/filters');
const Groq = require('groq-sdk');
const express = require('express');
const mongoose = require('mongoose');
const redis = require('redis');
const axios = require('axios');
const rateLimit = require('telegraf-ratelimit');
const winston = require('winston');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const database = require('./database');

// ======================================================
// CONFIGURATION & ENVIRONMENT
// ======================================================

// Load environment variables
if (!process.env.BOT_TOKEN || !process.env.GROQ_API_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Required: BOT_TOKEN, GROQ_API_KEY');
  process.exit(1);
}

// Configuration object
const config = {
  bot: {
    token: process.env.BOT_TOKEN,
    adminIds: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : ['6939078859', '6336847895'],
    version: '6.0.0',
    name: 'TalkMate Pro',
    supportEmail: 'support@talkmate.com',
    website: 'https://talkmate.com'
  },
  
  api: {
    groq: process.env.GROQ_API_KEY,
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development'
  },
  
  database: {
    mongodb: process.env.MONGODB_URI || null,
    redis: process.env.REDIS_URL || null
  },
  
  features: {
    rateLimit: true,
    autoTranslate: true,
    broadcastEnabled: true,
    analyticsEnabled: true,
    backupEnabled: true
  }
};

// ======================================================
// LOGGING SYSTEM
// ======================================================

// Create logs directory
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logsDir, 'combined.log') }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// ======================================================
// INITIALIZE SERVICES
// ======================================================

// Initialize Express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Telegram bot
const bot = new Telegraf(config.bot.token);

// Initialize Groq client
const groq = new Groq({ apiKey: config.api.groq });

// Initialize Redis client if available
let redisClient = null;
if (config.database.redis) {
  redisClient = redis.createClient({ url: config.database.redis });
  redisClient.on('error', (err) => logger.error('Redis Client Error', err));
  redisClient.connect().then(() => logger.info('✅ Redis connected'));
}

// Initialize MongoDB if available
if (config.database.mongodb) {
  mongoose.connect(config.database.mongodb)
    .then(() => logger.info('✅ MongoDB connected'))
    .catch(err => logger.error('MongoDB connection error:', err));
}

// ======================================================
// DATA MODELS (MongoDB Schemas)
// ======================================================

// User Schema
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  firstName: String,
  lastName: String,
  username: String,
  language: { type: String, default: 'en' },
  preferences: {
    model: { type: String, default: 'llama-3.3-70b-versatile' },
    notifications: { type: Boolean, default: true },
    theme: { type: String, default: 'light' }
  },
  stats: {
    messagesSent: { type: Number, default: 0 },
    messagesReceived: { type: Number, default: 0 },
    sessions: { type: Number, default: 0 },
    lastActive: Date,
    registeredAt: { type: Date, default: Date.now }
  },
  tokens: {
    usage: { type: Number, default: 0 },
    limit: { type: Number, default: 100000 },
    resetAt: Date
  },
  flags: {
    isBanned: { type: Boolean, default: false },
    isPremium: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false }
  },
  metadata: {
    deviceInfo: String,
    location: String,
    timezone: String,
    referrer: String
  }
}, { timestamps: true });

// Conversation Schema
const conversationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  sessionId: { type: String, required: true },
  messages: [{
    role: { type: String, enum: ['user', 'assistant', 'system'] },
    content: String,
    timestamp: { type: Date, default: Date.now },
    tokens: Number,
    model: String
  }],
  metadata: {
    startTime: Date,
    endTime: Date,
    messageCount: Number,
    tokenCount: Number
  }
}, { timestamps: true });

// Ticket Schema
const ticketSchema = new mongoose.Schema({
  ticketId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  userName: String,
  userContact: String,
  subject: String,
  message: String,
  category: { 
    type: String, 
    enum: ['technical', 'billing', 'feature', 'bug', 'other'],
    default: 'other'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'waiting', 'resolved', 'closed'],
    default: 'open'
  },
  assignedTo: String,
  replies: [{
    from: String,
    message: String,
    timestamp: { type: Date, default: Date.now },
    attachments: [String]
  }],
  metadata: {
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    resolvedAt: Date,
    closedAt: Date,
    responseTime: Number
  }
}, { timestamps: true });

// Analytics Schema
const analyticsSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  metrics: {
    activeUsers: Number,
    newUsers: Number,
    messagesTotal: Number,
    averageResponseTime: Number,
    topModels: [{
      model: String,
      count: Number
    }],
    errorRate: Number,
    apiCalls: Number
  },
  languages: Map,
  commands: Map
}, { timestamps: true });

// Create models if MongoDB is connected
let User, Conversation, Ticket, Analytics;
if (config.database.mongodb) {
  User = mongoose.model('User', userSchema);
  Conversation = mongoose.model('Conversation', conversationSchema);
  Ticket = mongoose.model('Ticket', ticketSchema);
  Analytics = mongoose.model('Analytics', analyticsSchema);
}

// ======================================================
// AVAILABLE AI MODELS
// ======================================================

const AVAILABLE_MODELS = [
  { 
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    provider: 'Meta',
    capabilities: ['chat', 'code', 'analysis'],
    contextWindow: 32768,
    maxTokens: 4096,
    costPer1k: 0.0005,
    speed: 'fast',
    languages: ['en', 'fa', 'ar', 'tr', 'ur'],
    description: 'Most powerful, best for complex tasks',
    fa: 'قدرتمندترین، بهترین برای کارهای پیچیده'
  },
  {
    id: 'llama-3.1-70b-versatile',
    name: 'Llama 3.1 70B',
    provider: 'Meta',
    capabilities: ['chat', 'code', 'analysis'],
    contextWindow: 32768,
    maxTokens: 4096,
    costPer1k: 0.0004,
    speed: 'fast',
    languages: ['en', 'fa', 'ar', 'tr', 'ur'],
    description: 'Excellent all-rounder',
    fa: 'عالی برای همه موارد'
  },
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B',
    provider: 'Mistral',
    capabilities: ['chat', 'code', 'multilingual'],
    contextWindow: 32768,
    maxTokens: 4096,
    costPer1k: 0.0003,
    speed: 'very_fast',
    languages: ['en', 'fr', 'de', 'es', 'it'],
    description: 'Fast and efficient',
    fa: 'سریع و کارآمد'
  },
  {
    id: 'gemma2-9b-it',
    name: 'Gemma 2 9B',
    provider: 'Google',
    capabilities: ['chat', 'reasoning'],
    contextWindow: 8192,
    maxTokens: 2048,
    costPer1k: 0.0002,
    speed: 'very_fast',
    languages: ['en', 'fa'],
    description: 'Lightweight and quick',
    fa: 'سبک و سریع'
  },
  {
    id: 'llama-3.2-11b-vision-preview',
    name: 'Llama 3.2 11B Vision',
    provider: 'Meta',
    capabilities: ['chat', 'vision', 'analysis'],
    contextWindow: 32768,
    maxTokens: 4096,
    costPer1k: 0.00045,
    speed: 'fast',
    languages: ['en', 'fa'],
    description: 'Vision-capable model',
    fa: 'مدل با قابلیت دید'
  }
];

// ======================================================
// COMPREHENSIVE TRANSLATIONS
// ======================================================

const translations = {
  en: {
    // System Messages
    system: {
      welcome: "🌟 **Welcome {name}!** 🌟\n\nI'm your **Professional AI Assistant** powered by Groq. I can help you with anything!",
      error: "❌ An error occurred. Please try again.",
      maintenance: "🔧 Bot is under maintenance. Please try again later.",
      rateLimit: "⏳ You're sending messages too quickly. Please wait.",
      banned: "🚫 You have been banned from using this bot.",
      premium: "✨ This feature is only available for premium users.",
      invalidCommand: "❌ Invalid command. Use /help to see available commands."
    },
    
    // Commections
    connections: {
      connecting: "🔄 Connecting to server...",
      connected: "✅ Connected successfully!",
      disconnected: "📡 Connection lost. Reconnecting...",
      reconnected: "🔄 Reconnected to server."
    },
    
    // Commands
    commands: {
      start: "🚀 Start",
      help: "📚 Help",
      language: "🌐 Language",
      model: "🤖 AI Model",
      clear: "🗑️ Clear History",
      history: "📊 History",
      export: "📤 Export",
      note: "📝 Note",
      notes: "📋 My Notes",
      favorite: "⭐ Favorite",
      favorites: "✨ My Favorites",
      support: "🆘 Support",
      ticket: "🎫 My Tickets",
      feedback: "💬 Feedback",
      stats: "📈 My Stats",
      about: "ℹ️ About",
      tip: "💡 Pro Tip",
      privacy: "🔒 Privacy",
      terms: "📜 Terms",
      donate: "💝 Donate",
      invite: "📨 Invite",
      broadcast: "📢 Broadcast",
      analytics: "📊 Analytics",
      settings: "⚙️ Settings",
      profile: "👤 Profile",
      search: "🔍 Search",
      translate: "🔄 Translate",
      summarize: "📝 Summarize"
    },
    
    // Buttons
    buttons: {
      startChat: "💬 Start Chatting",
      helpSupport: "🆘 Help & Support",
      about: "ℹ️ About",
      settings: "⚙️ Settings",
      proTip: "💡 Pro Tip",
      privacyGuide: "🔒 Privacy Guide",
      back: "🔙 Back",
      mainMenu: "🏠 Main Menu",
      confirm: "✅ Confirm",
      cancel: "❌ Cancel",
      yesClear: "✅ Yes, clear it",
      noKeep: "❌ No, keep it",
      saveFavorite: "⭐ Save",
      share: "📤 Share",
      copy: "📋 Copy",
      delete: "🗑️ Delete",
      edit: "✏️ Edit",
      viewMore: "🔍 View More",
      loadMore: "📚 Load More",
      refresh: "🔄 Refresh",
      close: "❌ Close",
      next: "⏩ Next",
      previous: "⏪ Previous",
      first: "⏮️ First",
      last: "⏭️ Last",
      page: "📄 Page {page}",
      select: "✅ Select",
      deselect: "❌ Deselect",
      apply: "✅ Apply",
      reset: "🔄 Reset",
      download: "📥 Download",
      upload: "📤 Upload",
      preview: "👁️ Preview"
    },
    
    // Models
    models: {
      title: "🤖 **Available AI Models**",
      select: "Please select a model:",
      current: "**Current Model:** {model}",
      changed: "✅ Model changed to **{model}**",
      error: "⚠️ Error changing model. Please try again.",
      info: "**Model Information**\n\nName: {name}\nProvider: {provider}\nContext: {context} tokens\nSpeed: {speed}\nLanguages: {languages}",
      warning: "⚠️ Note: Some models may not be available in your region. If you encounter errors, switch to Llama 3.3 70B."
    },
    
    // Privacy
    privacy: {
      title: "🔒 **Privacy Policy & Terms of Service**",
      en: "**English Version**\n\n"
        + "1. **Data Collection**\n"
        + "   • We collect message history for conversation context\n"
        + "   • We store user IDs for functionality\n"
        + "   • No personal data is sold or shared\n\n"
        + "2. **Data Usage**\n"
        + "   • Messages are processed by Groq AI\n"
        + "   • Data is encrypted in transit and at rest\n"
        + "   • You can delete your data anytime\n\n"
        + "3. **Your Rights**\n"
        + "   • Right to access your data\n"
        + "   • Right to delete your data\n"
        + "   • Right to opt-out\n\n"
        + "4. **Contact**\n"
        + "   • For privacy concerns: privacy@talkmate.com\n"
        + "   • For support: support@talkmate.com\n",
      
      fa: "**نسخه فارسی**\n\n"
        + "۱. **جمع‌آوری اطلاعات**\n"
        + "   • تاریخچه پیام‌ها برای حفظ متن گفتگو ذخیره می‌شود\n"
        + "   • شناسه کاربران برای عملکرد ربات ذخیره می‌شود\n"
        + "   • اطلاعات شخصی فروخته یا به اشتراک گذاشته نمی‌شود\n\n"
        + "۲. **استفاده از اطلاعات**\n"
        + "   • پیام‌ها توسط Groq AI پردازش می‌شوند\n"
        + "   • اطلاعات رمزنگاری شده و امن است\n"
        + "   • می‌توانید اطلاعات خود را هر زمان پاک کنید\n\n"
        + "۳. **حقوق شما**\n"
        + "   • حق دسترسی به اطلاعات خود\n"
        + "   • حق پاک کردن اطلاعات خود\n"
        + "   • حق انصراف\n\n"
        + "۴. **تماس**\n"
        + "   • نگرانی‌های حریم خصوصی: privacy@talkmate.com\n"
        + "   • پشتیبانی: support@talkmate.com\n",
      
      terms: "📜 **Terms of Service**\n\n"
        + "By using this bot, you agree to:\n"
        + "• Not use for illegal purposes\n"
        + "• Not attempt to abuse the system\n"
        + "• Not harass other users\n"
        + "• Accept that service may change\n"
        + "• Indemnify the developers\n"
        + "• Use at your own risk\n",
      
      consent: "By continuing to use this bot, you consent to our privacy policy and terms of service."
    },
    
    // Support
    support: {
      title: "🆘 **Support Center**",
      options: "Please select an option:",
      createTicket: "📝 Create Ticket",
      myTickets: "🎫 My Tickets",
      faq: "❓ FAQ",
      contact: "📞 Contact Support",
      
      ticket: {
        title: "**Create Support Ticket**",
        subject: "Please enter a subject:",
        category: "Please select a category:",
        priority: "Please select priority:",
        description: "Please describe your issue in detail:",
        created: "✅ **Ticket Created!**\n\nTicket ID: `{id}`\nSubject: {subject}\nPriority: {priority}\nStatus: {status}\n\nOur team will respond within 24 hours.",
        status: "**Ticket #{id}**\n\nStatus: {status}\nPriority: {priority}\nCategory: {category}\nCreated: {created}\nLast Updated: {updated}\n\n**Messages:**\n{messages}",
        reply: "✏️ Reply to Ticket",
        close: "✅ Close Ticket",
        reopen: "🔄 Reopen Ticket",
        assign: "👤 Assign to me",
        
        categories: {
          technical: "🛠️ Technical Issue",
          billing: "💰 Billing Question",
          feature: "✨ Feature Request",
          bug: "🐛 Bug Report",
          other: "❓ Other"
        },
        
        priorities: {
          low: "🟢 Low",
          medium: "🟡 Medium",
          high: "🟠 High",
          urgent: "🔴 Urgent"
        }
      },
      
      faq: {
        title: "❓ **Frequently Asked Questions**",
        q1: "**Q: How do I change the language?**\nA: Use the /language command or click the language button.",
        q2: "**Q: Can I use different AI models?**\nA: Yes! Use /model to switch between available models.",
        q3: "**Q: How do I save important information?**\nA: Use /note command to save notes, and /mynotes to view them.",
        q4: "**Q: Is my data private?**\nA: Yes! Check /privacy for details.",
        q5: "**Q: How do I contact support?**\nA: Use /support to create a ticket."
      }
    },
    
    // Notes
    notes: {
      title: "📝 **Notes System**",
      menu: "Manage your notes:",
      create: "➕ New Note",
      view: "📋 View Notes",
      edit: "✏️ Edit Note",
      delete: "🗑️ Delete Note",
      search: "🔍 Search Notes",
      export: "📤 Export Notes",
      
      saved: "✅ **Note saved!**\nID: `{id}`\n\n{note}",
      noNotes: "📝 No notes yet. Use /note to create one.",
      list: "📝 **Your Notes** (Page {page}/{total})\n\n{notes}",
      deleted: "✅ Note deleted.",
      cleared: "✅ All notes cleared.",
      searchResults: "🔍 **Search Results**\n\n{results}",
      exportFile: "📤 Here's your notes export:",
      
      format: "*{index}.* {text}\n📅 {date}\nID: `{id}`\n"
    },
    
    // Favorites
    favorites: {
      title: "⭐ **Favorites System**",
      saved: "⭐ **Saved to favorites!**",
      noFavorites: "⭐ No favorites yet. Use /favorite to save responses.",
      list: "⭐ **Your Favorites**\n\n{favorites}",
      removed: "✅ Removed from favorites.",
      cleared: "✅ All favorites cleared.",
      
      format: "*{index}.* {text}\n📅 {date}\n"
    },
    
    // Statistics
    statistics: {
      title: "📊 **Your Statistics**",
      user: "👤 **User:** {name}",
      id: "🆔 **ID:** `{id}`",
      joined: "📅 **Joined:** {date}",
      lastActive: "⏰ **Last Active:** {date}",
      messages: "💬 **Messages:** {sent} sent, {received} received",
      totalMessages: "📊 **Total Messages:** {total}",
      sessions: "🔄 **Sessions:** {count}",
      model: "🤖 **Current Model:** {model}",
      notes: "📝 **Notes:** {count}",
      favorites: "⭐ **Favorites:** {count}",
      tokens: "🔢 **Tokens Used:** {used}/{limit}",
      language: "🌐 **Language:** {lang}",
      uptime: "⏱️ **Bot Uptime:** {uptime}",
      apiCalls: "📡 **API Calls:** {count}"
    },
    
    // Pro Tips
    proTips: [
      "💡 **Pro Tip:** Use /language to switch between English and Persian!",
      "💡 **Pro Tip:** Use /model to switch between different AI models!",
      "💡 **Pro Tip:** Save important information with /note command!",
      "💡 **Pro Tip:** Bookmark useful responses with /favorite!",
      "💡 **Pro Tip:** Clear chat history anytime with /clear!",
      "💡 **Pro Tip:** Use /export to download your conversation!",
      "💡 **Pro Tip:** Check /privacy for user guide and privacy policy!",
      "💡 **Pro Tip:** You can use /translate to translate messages!",
      "💡 **Pro Tip:** Use /summarize to get summaries of long texts!",
      "💡 **Pro Tip:** Create support tickets with /support for help!",
      "💡 **Pro Tip:** Check your stats with /stats command!",
      "💡 **Pro Tip:** You can search your notes with /search command!",
      "💡 **Pro Tip:** Use /broadcast (admin only) to send announcements!",
      "💡 **Pro Tip:** Different models excel at different tasks!",
      "💡 **Pro Tip:** You can view your conversation history with /history!"
    ],
    
    // Persian translations
    fa: {
      system: {
        welcome: "🌟 **خوش آمدید {name}!** 🌟\n\nمن **دستیار حرفه‌ای هوش مصنوعی** شما هستم. می‌توانم در هر کاری به شما کمک کنم!",
        error: "❌ خطایی رخ داد. لطفاً دوباره تلاش کنید.",
        maintenance: "🔧 ربات در حال تعمیر و نگهداری است. لطفاً بعداً تلاش کنید.",
        rateLimit: "⏳ شما خیلی سریع پیام می‌فرستید. لطفاً صبر کنید.",
        banned: "🚫 شما از استفاده از این ربات محروم شده‌اید.",
        premium: "✨ این قابلیت فقط برای کاربران ویژه در دسترس است.",
        invalidCommand: "❌ دستور نامعتبر. برای دیدن دستورات از /help استفاده کنید."
      },
      
      connections: {
        connecting: "🔄 در حال اتصال به سرور...",
        connected: "✅ اتصال با موفقیت برقرار شد!",
        disconnected: "📡 اتصال قطع شد. در حال اتصال مجدد...",
        reconnected: "🔄 اتصال مجدد برقرار شد."
      },
      
      commands: {
        start: "🚀 شروع",
        help: "📚 راهنما",
        language: "🌐 زبان",
        model: "🤖 مدل هوش مصنوعی",
        clear: "🗑️ پاک کردن تاریخچه",
        history: "📊 تاریخچه",
        export: "📤 خروجی",
        note: "📝 یادداشت",
        notes: "📋 یادداشت‌های من",
        favorite: "⭐ مورد علاقه",
        favorites: "✨ موارد علاقه‌مندی",
        support: "🆘 پشتیبانی",
        ticket: "🎫 تیکت‌های من",
        feedback: "💬 بازخورد",
        stats: "📈 آمار من",
        about: "ℹ️ درباره",
        tip: "💡 نکته حرفه‌ای",
        privacy: "🔒 حریم خصوصی",
        terms: "📜 شرایط استفاده",
        donate: "💝 حمایت مالی",
        invite: "📨 دعوت",
        broadcast: "📢 پیام همگانی",
        analytics: "📊 تحلیل",
        settings: "⚙️ تنظیمات",
        profile: "👤 پروفایل",
        search: "🔍 جستجو",
        translate: "🔄 ترجمه",
        summarize: "📝 خلاصه‌سازی"
      },
      
      buttons: {
        startChat: "💬 شروع گفتگو",
        helpSupport: "🆘 راهنما و پشتیبانی",
        about: "ℹ️ درباره",
        settings: "⚙️ تنظیمات",
        proTip: "💡 نکته حرفه‌ای",
        privacyGuide: "🔒 حریم خصوصی",
        back: "🔙 بازگشت",
        mainMenu: "🏠 منوی اصلی",
        confirm: "✅ تایید",
        cancel: "❌ انصراف",
        yesClear: "✅ بله، پاک کن",
        noKeep: "❌ خیر، نگه دار",
        saveFavorite: "⭐ ذخیره",
        share: "📤 اشتراک‌گذاری",
        copy: "📋 کپی",
        delete: "🗑️ حذف",
        edit: "✏️ ویرایش",
        viewMore: "🔍 مشاهده بیشتر",
        loadMore: "📚 بارگذاری بیشتر",
        refresh: "🔄 تازه‌سازی",
        close: "❌ بستن",
        next: "⏩ بعدی",
        previous: "⏪ قبلی",
        first: "⏮️ اولین",
        last: "⏭️ آخرین",
        page: "📄 صفحه {page}",
        select: "✅ انتخاب",
        deselect: "❌ لغو انتخاب",
        apply: "✅ اعمال",
        reset: "🔄 بازنشانی",
        download: "📥 دانلود",
        upload: "📤 آپلود",
        preview: "👁️ پیش‌نمایش"
      },
      
      models: {
        title: "🤖 **مدل‌های هوش مصنوعی موجود**",
        select: "لطفاً یک مدل انتخاب کنید:",
        current: "**مدل فعلی:** {model}",
        changed: "✅ مدل به **{model}** تغییر یافت",
        error: "⚠️ خطا در تغییر مدل. لطفاً دوباره تلاش کنید.",
        info: "**اطلاعات مدل**\n\nنام: {name}\nارائه‌دهنده: {provider}\nحافظه: {context} توکن\nسرعت: {speed}\nزبان‌ها: {languages}",
        warning: "⚠️ نکته: برخی مدل‌ها ممکن است در منطقه شما در دسترس نباشند. اگر خطا دیدید، به Llama 3.3 70B تغییر دهید."
      },
      
      privacy: {
        title: "🔒 **سیاست حریم خصوصی و شرایط استفاده**",
        en: "**نسخه انگلیسی**\n\n...",
        fa: "**نسخه فارسی**\n\n۱. **جمع‌آوری اطلاعات**\n   • تاریخچه پیام‌ها برای حفظ متن گفتگو ذخیره می‌شود\n   • شناسه کاربران برای عملکرد ربات ذخیره می‌شود\n   • اطلاعات شخصی فروخته یا به اشتراک گذاشته نمی‌شود\n\n۲. **استفاده از اطلاعات**\n   • پیام‌ها توسط Groq AI پردازش می‌شوند\n   • اطلاعات رمزنگاری شده و امن است\n   • می‌توانید اطلاعات خود را هر زمان پاک کنید\n\n۳. **حقوق شما**\n   • حق دسترسی به اطلاعات خود\n   • حق پاک کردن اطلاعات خود\n   • حق انصراف\n\n۴. **تماس**\n   • نگرانی‌های حریم خصوصی: privacy@talkmate.com\n   • پشتیبانی: support@talkmate.com\n",
        terms: "📜 **شرایط استفاده**\n\nبا استفاده از این ربات، شما موافقت می‌کنید:\n• برای اهداف غیرقانونی استفاده نکنید\n• سعی در سوءاستفاده از سیستم نکنید\n• با سایر کاربران برخورد ناشایست نداشته باشید\n• بپذیرید که خدمات ممکن است تغییر کند\n• توسعه‌دهندگان را غرامت دهید\n• با مسئولیت خود استفاده کنید\n",
        consent: "با ادامه استفاده از این ربات، با سیاست حریم خصوصی و شرایط استفاده موافقت می‌کنید."
      },
      
      support: {
        title: "🆘 **مرکز پشتیبانی**",
        options: "لطفاً یک گزینه انتخاب کنید:",
        createTicket: "📝 ایجاد تیکت",
        myTickets: "🎫 تیکت‌های من",
        faq: "❓ سوالات متداول",
        contact: "📞 تماس با پشتیبانی",
        
        ticket: {
          title: "**ایجاد تیکت پشتیبانی**",
          subject: "لطفاً موضوع را وارد کنید:",
          category: "لطفاً دسته‌بندی را انتخاب کنید:",
          priority: "لطفاً اولویت را انتخاب کنید:",
          description: "لطفاً مشکل خود را با جزئیات توضیح دهید:",
          created: "✅ **تیکت ایجاد شد!**\n\nشناسه تیکت: `{id}`\nموضوع: {subject}\nاولویت: {priority}\nوضعیت: {status}\n\nتیم ما ظرف ۲۴ ساعت پاسخ خواهد داد.",
          status: "**تیکت #{id}**\n\nوضعیت: {status}\nاولویت: {priority}\nدسته‌بندی: {category}\nایجاد: {created}\nآخرین به‌روزرسانی: {updated}\n\n**پیام‌ها:**\n{messages}",
          reply: "✏️ پاسخ به تیکت",
          close: "✅ بستن تیکت",
          reopen: "🔄 بازگشایی تیکت",
          assign: "👤 واگذاری به من",
          
          categories: {
            technical: "🛠️ مشکل فنی",
            billing: "💰 سوال مالی",
            feature: "✨ درخواست ویژگی",
            bug: "🐛 گزارش مشکل",
            other: "❓ سایر"
          },
          
          priorities: {
            low: "🟢 کم",
            medium: "🟡 متوسط",
            high: "🟠 زیاد",
            urgent: "🔴 فوری"
          }
        },
        
        faq: {
          title: "❓ **سوالات متداول**",
          q1: "**س: چگونه زبان را تغییر دهم؟**\nج: از دستور /language استفاده کنید یا روی دکمه زبان کلیک کنید.",
          q2: "**س: می‌توانم از مدل‌های مختلف هوش مصنوعی استفاده کنم؟**\nج: بله! با /model می‌توانید بین مدل‌ها تغییر دهید.",
          q3: "**س: چگونه اطلاعات مهم را ذخیره کنم؟**\nج: از /note برای ذخیره و /mynotes برای مشاهده استفاده کنید.",
          q4: "**س: آیا اطلاعات من خصوصی است؟**\nج: بله! برای جزئیات /privacy را ببینید.",
          q5: "**س: چگونه با پشتیبانی تماس بگیرم؟**\nج: از /support برای ایجاد تیکت استفاده کنید."
        }
      },
      
      notes: {
        title: "📝 **سیستم یادداشت‌ها**",
        menu: "یادداشت‌های خود را مدیریت کنید:",
        create: "➕ یادداشت جدید",
        view: "📋 مشاهده یادداشت‌ها",
        edit: "✏️ ویرایش یادداشت",
        delete: "🗑️ حذف یادداشت",
        search: "🔍 جستجو در یادداشت‌ها",
        export: "📤 خروجی یادداشت‌ها",
        
        saved: "✅ **یادداشت ذخیره شد!**\nشناسه: `{id}`\n\n{note}",
        noNotes: "📝 هنوز یادداشتی ندارید. با /note یادداشت ایجاد کنید.",
        list: "📝 **یادداشت‌های شما** (صفحه {page}/{total})\n\n{notes}",
        deleted: "✅ یادداشت حذف شد.",
        cleared: "✅ همه یادداشت‌ها پاک شدند.",
        searchResults: "🔍 **نتایج جستجو**\n\n{results}",
        exportFile: "📤 فایل خروجی یادداشت‌های شما:",
        
        format: "*{index}.* {text}\n📅 {date}\nشناسه: `{id}`\n"
      },
      
      favorites: {
        title: "⭐ **سیستم موارد علاقه‌مندی**",
        saved: "⭐ **به موارد علاقه‌مندی اضافه شد!**",
        noFavorites: "⭐ هنوز مورد علاقه‌ای ندارید. با /favorite پاسخ‌ها را ذخیره کنید.",
        list: "⭐ **موارد علاقه‌مندی شما**\n\n{favorites}",
        removed: "✅ از موارد علاقه‌مندی حذف شد.",
        cleared: "✅ همه موارد علاقه‌مندی پاک شدند.",
        
        format: "*{index}.* {text}\n📅 {date}\n"
      },
      
      statistics: {
        title: "📊 **آمار شما**",
        user: "👤 **کاربر:** {name}",
        id: "🆔 **شناسه:** `{id}`",
        joined: "📅 **تاریخ عضویت:** {date}",
        lastActive: "⏰ **آخرین فعالیت:** {date}",
        messages: "💬 **پیام‌ها:** {sent} ارسال، {received} دریافت",
        totalMessages: "📊 **کل پیام‌ها:** {total}",
        sessions: "🔄 **نشست‌ها:** {count}",
        model: "🤖 **مدل فعلی:** {model}",
        notes: "📝 **یادداشت‌ها:** {count}",
        favorites: "⭐ **علاقه‌مندی‌ها:** {count}",
        tokens: "🔢 **توکن‌های مصرفی:** {used}/{limit}",
        language: "🌐 **زبان:** {lang}",
        uptime: "⏱️ **مدت فعالیت ربات:** {uptime}",
        apiCalls: "📡 **تماس‌های API:** {count}"
      },
      
      proTips: [
        "💡 **نکته حرفه‌ای:** با /language می‌توانید بین انگلیسی و فارسی تغییر دهید!",
        "💡 **نکته حرفه‌ای:** با /model مدل هوش مصنوعی را تغییر دهید!",
        "💡 **نکته حرفه‌ای:** اطلاعات مهم را با /note ذخیره کنید!",
        "💡 **نکته حرفه‌ای:** پاسخ‌های مفید را با /favorite نشانه‌گذاری کنید!",
        "💡 **نکته حرفه‌ای:** هر زمان خواستید با /clear تاریخچه را پاک کنید!",
        "💡 **نکته حرفه‌ای:** با /export از گفتگو خروجی بگیرید!",
        "💡 **نکته حرفه‌ای:** برای راهنما از /privacy استفاده کنید!",
        "💡 **نکته حرفه‌ای:** با /translate می‌توانید پیام‌ها را ترجمه کنید!",
        "💡 **نکته حرفه‌ای:** با /summarize خلاصه متون طولانی را بگیرید!",
        "💡 **نکته حرفه‌ای:** با /support تیکت پشتیبانی ایجاد کنید!",
        "💡 **نکته حرفه‌ای:** آمار خود را با /stats ببینید!",
        "💡 **نکته حرفه‌ای:** با /search در یادداشت‌ها جستجو کنید!"
      ]
    }
  }
};

// ======================================================
// UTILITY FUNCTIONS
// ======================================================

// Error handling wrapper
async function safeExecute(ctx, fn) {
  try {
    await fn();
  } catch (error) {
    logger.error('Safe execution error:', error);
    const lang = getUserLanguage(ctx.from?.id);
    try {
      await ctx.reply(lang === 'fa' ? translations.fa.system.error : translations.en.system.error);
    } catch (e) {
      // Ignore
    }
  }
}

// Get user language
function getUserLanguage(userId) {
  const prefs = userPreferences.get(userId) || {};
  return prefs.language || 'en';
}

// Get translation
function getText(userId, category, key, params = {}) {
  const lang = getUserLanguage(userId);
  const translation = lang === 'fa' ? translations.fa : translations.en;
  
  let text = translation[category]?.[key] || translations.en[category]?.[key] || key;
  
  // Replace parameters
  for (const [param, value] of Object.entries(params)) {
    text = text.replace(`{${param}}`, value);
  }
  
  return text;
}

// Get pro tip
function getProTip(userId) {
  const lang = getUserLanguage(userId);
  const tips = lang === 'fa' ? translations.fa.proTips : translations.en.proTips;
  return tips[Math.floor(Math.random() * tips.length)];
}

// Set bot commands
async function setBotCommands(language = 'en') {
  const t = language === 'fa' ? translations.fa.commands : translations.en.commands;
  
  await bot.telegram.setMyCommands([
    { command: 'start', description: t.start },
    { command: 'help', description: t.help },
    { command: 'language', description: t.language },
    { command: 'model', description: t.model },
    { command: 'clear', description: t.clear },
    { command: 'history', description: t.history },
    { command: 'export', description: t.export },
    { command: 'note', description: t.note },
    { command: 'notes', description: t.notes },
    { command: 'favorite', description: t.favorite },
    { command: 'favorites', description: t.favorites },
    { command: 'support', description: t.support },
    { command: 'ticket', description: t.ticket },
    { command: 'feedback', description: t.feedback },
    { command: 'stats', description: t.stats },
    { command: 'about', description: t.about },
    { command: 'tip', description: t.tip },
    { command: 'privacy', description: t.privacy },
    { command: 'terms', description: t.terms },
    { command: 'settings', description: t.settings },
    { command: 'profile', description: t.profile },
    { command: 'search', description: t.search },
    { command: 'translate', description: t.translate },
    { command: 'summarize', description: t.summarize }
  ]);
}

// Generate unique ID
function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}${timestamp}${random}`.toUpperCase();
}

// Format date
function formatDate(date, userId) {
  const lang = getUserLanguage(userId);
  return date.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US');
}

// Split long messages
function splitMessage(text, maxLength = 4096) {
  if (text.length <= maxLength) return [text];
  
  const parts = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let currentPart = '';
  
  for (const sentence of sentences) {
    if (currentPart.length + sentence.length <= maxLength) {
      currentPart += sentence;
    } else {
      if (currentPart) parts.push(currentPart.trim());
      currentPart = sentence;
    }
  }
  
  if (currentPart) parts.push(currentPart.trim());
  
  // If still too long, split by character
  if (parts.length === 0 || parts[0].length > maxLength) {
    return text.match(new RegExp(`.{1,${maxLength}}`, 'g')) || [];
  }
  
  return parts;
}

// Rate limiting
const rateLimitConfig = {
  window: 3000,
  limit: 3,
  onLimitExceeded: async (ctx) => {
    const lang = getUserLanguage(ctx.from.id);
    await ctx.reply(lang === 'fa' ? translations.fa.system.rateLimit : translations.en.system.rateLimit);
  }
};

bot.use(rateLimit(rateLimitConfig));

// ======================================================
// EXPRESS SERVER SETUP
// ======================================================

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    version: config.bot.version,
    name: config.bot.name,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    stats: {
      users: userStats.totalUsers,
      conversations: userStats.totalConversations,
      messages: userStats.totalMessages
    }
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Webhook endpoint for external services
app.post('/webhook/:type', async (req, res) => {
  const { type } = req.params;
  const { data } = req.body;
  
  logger.info(`Webhook received: ${type}`);
  
  // Process different webhook types
  switch (type) {
    case 'payment':
      await handlePaymentWebhook(data);
      break;
    case 'analytics':
      await handleAnalyticsWebhook(data);
      break;
    default:
      logger.warn(`Unknown webhook type: ${type}`);
  }
  
  res.json({ received: true });
});

// Admin API endpoints
app.get('/api/stats', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  res.json({
    users: userStats,
    tickets: ticketStats,
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    }
  });
});

app.post('/api/broadcast', async (req, res) => {
  const { message, parseMode = 'HTML', preview = false } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message required' });
  }
  
  if (preview) {
    return res.json({ preview: message });
  }
  
  // Send broadcast
  const result = await sendBroadcast(message, parseMode);
  
  res.json(result);
});

// Start server
const server = app.listen(config.api.port, '0.0.0.0', () => {
  logger.info(`✅ Server running on port ${config.api.port}`);
});

// ======================================================
// DATABASE FUNCTIONS
// ======================================================

// User management
async function registerUser(ctx) {
  const userId = ctx.from.id.toString();
  
  try {
    if (User && config.database.mongodb) {
      // MongoDB
      let user = await User.findOne({ userId });
      
      if (!user) {
        user = new User({
          userId,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name,
          username: ctx.from.username,
          metadata: {
            deviceInfo: ctx.message?.via_bot ? 'bot' : 'user',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        });
        await user.save();
        userStats.newUsers++;
        logger.info(`New user registered: ${userId}`);
      } else {
        user.lastName = ctx.from.last_name || user.lastName;
        user.username = ctx.from.username || user.username;
        user.stats.lastActive = new Date();
        user.stats.sessions++;
        await user.save();
      }
      
      return user;
    } else {
      // File-based
      const userData = database.registerUser(userId, {
        id: userId,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name,
        username: ctx.from.username,
        language_code: ctx.from.language_code
      });
      
      userStats.totalUsers = database.getAllUsers().length;
      return userData;
    }
  } catch (error) {
    logger.error('Error registering user:', error);
    return null;
  }
}

// Save conversation
async function saveConversation(userId, sessionId, messages, tokenCount) {
  try {
    if (Conversation && config.database.mongodb) {
      const conversation = new Conversation({
        userId,
        sessionId,
        messages,
        metadata: {
          startTime: new Date(),
          messageCount: messages.length,
          tokenCount
        }
      });
      await conversation.save();
      
      userStats.totalMessages += messages.length;
      userStats.totalConversations++;
      
      return conversation;
    }
  } catch (error) {
    logger.error('Error saving conversation:', error);
  }
}

// Create ticket
async function createTicket(userId, userName, subject, category, priority, message) {
  const ticketId = generateId('TK');
  
  try {
    if (Ticket && config.database.mongodb) {
      const ticket = new Ticket({
        ticketId,
        userId,
        userName,
        subject,
        category,
        priority,
        message,
        status: 'open',
        metadata: {
          createdAt: new Date()
        }
      });
      await ticket.save();
      
      ticketStats.open++;
      ticketStats.total++;
      
      return ticket;
    } else {
      const ticket = database.createTicket({
        userId,
        userName,
        message,
        subject,
        category,
        priority,
        status: 'open'
      });
      ticket.ticketId = ticket.id;
      return ticket;
    }
  } catch (error) {
    logger.error('Error creating ticket:', error);
    return null;
  }
}

// Update analytics
async function updateAnalytics(date, metrics) {
  try {
    if (Analytics && config.database.mongodb) {
      let analytics = await Analytics.findOne({ date });
      
      if (!analytics) {
        analytics = new Analytics({ date, metrics });
      } else {
        Object.assign(analytics.metrics, metrics);
      }
      
      await analytics.save();
    }
  } catch (error) {
    logger.error('Error updating analytics:', error);
  }
}

// ======================================================
// BOT COMMANDS
// ======================================================

// Start command
bot.command('start', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    
    // Register user
    await registerUser(ctx);
    
    // Check language preference
    const prefs = userPreferences.get(userId) || {};
    
    if (!prefs.language) {
      // Ask for language
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
      
      // Welcome message
      await ctx.replyWithMarkdown(
        t.system.welcome.replace('{name}', ctx.from.first_name),
        Markup.inlineKeyboard([
          [Markup.button.callback(t.buttons.startChat, 'start_chat')],
          [Markup.button.callback(t.buttons.helpSupport, 'help_support'), 
           Markup.button.callback(t.buttons.about, 'about_bot')],
          [Markup.button.callback(t.buttons.settings, 'settings'), 
           Markup.button.callback(t.buttons.privacyGuide, 'privacy_guide')]
        ])
      );
      
      // Show pro tip
      setTimeout(async () => {
        const tip = getProTip(userId);
        await ctx.replyWithMarkdown(tip);
      }, 2000);
    }
    
    // Update analytics
    userStats.activeUsers++;
  });
});

// Help command
bot.command('help', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa : translations.en;
    
    // Check if admin
    const isAdmin = config.bot.adminIds.includes(userId.toString());
    
    // Build help text
    let helpText = isAdmin ? 
      `📚 **${t.commands.help}**\n\n` +
      `**🤖 ${t.commands.model}**\n` +
      `• /model - ${t.models.select}\n` +
      `• /models - View all models\n` +
      `• /settings - ${t.buttons.settings}\n\n` +
      
      `**📝 ${t.notes.title}**\n` +
      `• /note - ${t.notes.create}\n` +
      `• /notes - ${t.notes.view}\n` +
      `• /search - ${t.notes.search}\n\n` +
      
      `**🆘 ${t.support.title}**\n` +
      `• /support - ${t.support.createTicket}\n` +
      `• /ticket - ${t.support.myTickets}\n` +
      `• /feedback - ${t.commands.feedback}\n\n` +
      
      `**ℹ️ ${t.commands.about}**\n` +
      `• /stats - ${t.commands.stats}\n` +
      `• /profile - ${t.commands.profile}\n` +
      `• /about - ${t.commands.about}\n` +
      `• /privacy - ${t.commands.privacy}\n` +
      `• /terms - ${t.commands.terms}\n` +
      `• /tip - ${t.commands.tip}\n\n` +
      
      `**👑 Admin Commands**\n` +
      `• /broadcast - ${t.commands.broadcast}\n` +
      `• /analytics - ${t.commands.analytics}\n` +
      `• /tickets - View all tickets\n` +
      `• /users - User management\n` +
      `• /backup - Backup system\n` +
      `• /logs - View logs\n` +
      `• /config - System config`
      :
      `📚 **${t.commands.help}**\n\n` +
      `**🤖 AI Commands**\n` +
      `• /model - ${t.models.select}\n` +
      `• /clear - ${t.commands.clear}\n` +
      `• /history - ${t.commands.history}\n` +
      `• /export - ${t.commands.export}\n\n` +
      
      `**📝 Notes & Favorites**\n` +
      `• /note - ${t.notes.create}\n` +
      `• /notes - ${t.notes.view}\n` +
      `• /favorite - ${t.favorites.saved}\n` +
      `• /favorites - ${t.favorites.list}\n\n` +
      
      `**🆘 Support**\n` +
      `• /support - ${t.support.createTicket}\n` +
      `• /ticket - ${t.support.myTickets}\n` +
      `• /feedback - ${t.commands.feedback}\n` +
      `• /tip - ${t.commands.tip}\n\n` +
      
      `**ℹ️ Info**\n` +
      `• /stats - ${t.commands.stats}\n` +
      `• /about - ${t.commands.about}\n` +
      `• /privacy - ${t.commands.privacy}\n` +
      `• /language - ${t.commands.language}\n` +
      `• /translate - ${t.commands.translate}\n` +
      `• /summarize - ${t.commands.summarize}\n\n` +
      
      `💡 **${t.buttons.proTip}:** ${translations.en.proTips[0]}`;
    
    await ctx.replyWithMarkdown(helpText, Markup.inlineKeyboard([
      [Markup.button.callback(t.buttons.helpSupport, 'help_support')],
      [Markup.button.callback(t.buttons.proTip, 'pro_tip')],
      [Markup.button.callback(t.buttons.mainMenu, 'main_menu')]
    ]));
  });
});

// Language command
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

// Model command
bot.command('model', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    
    const buttons = AVAILABLE_MODELS.map(model => {
      const displayName = lang === 'fa' ? 
        `${model.name} - ${model.fa}` : 
        `${model.name} - ${model.description}`;
      return [Markup.button.callback(displayName, `model_select_${model.id}`)];
    });
    
    buttons.push([Markup.button.callback(
      lang === 'fa' ? translations.fa.buttons.mainMenu : translations.en.buttons.mainMenu,
      'main_menu'
    )]);
    
    await ctx.replyWithMarkdown(
      lang === 'fa' ? translations.fa.models.select : translations.en.models.select,
      Markup.inlineKeyboard(buttons)
    );
  });
});

// Models command - list all models with details
bot.command('models', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    
    let modelsText = lang === 'fa' ? translations.fa.models.title : translations.en.models.title;
    modelsText += '\n\n';
    
    AVAILABLE_MODELS.forEach((model, index) => {
      modelsText += `${index + 1}. **${model.name}**\n`;
      modelsText += `   📝 ${lang === 'fa' ? model.fa : model.description}\n`;
      modelsText += `   ⚡ ${model.speed}\n`;
      modelsText += `   🔢 ${model.contextWindow.toLocaleString()} tokens\n`;
      modelsText += `   🌐 ${model.languages.join(', ')}\n\n`;
    });
    
    modelsText += lang === 'fa' ? translations.fa.models.warning : translations.en.models.warning;
    
    await ctx.replyWithMarkdown(modelsText);
  });
});

// Note command
bot.command('note', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.notes : translations.en.notes;
    const note = ctx.message.text.replace('/note', '').trim();
    
    if (!note) {
      await ctx.replyWithMarkdown(t.enter_note, Markup.forceReply());
      userPreferences.set(`${userId}_state`, 'awaiting_note');
      return;
    }
    
    if (!userNotes.has(userId)) userNotes.set(userId, []);
    
    const noteObj = {
      id: generateId('NT'),
      text: note,
      date: new Date(),
      formattedDate: formatDate(new Date(), userId)
    };
    
    userNotes.get(userId).push(noteObj);
    
    await ctx.replyWithMarkdown(
      t.saved.replace('{id}', noteObj.id).replace('{note}', noteObj.text)
    );
    
    // Save to database if available
    if (config.database.mongodb) {
      // Save note to MongoDB
    }
  });
});

// Notes command - list notes
bot.command('notes', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.notes : translations.en.notes;
    const notes = userNotes.get(userId) || [];
    
    if (notes.length === 0) {
      await ctx.replyWithMarkdown(t.noNotes);
      return;
    }
    
    // Pagination
    const page = parseInt(ctx.message.text.split(' ')[1]) || 1;
    const perPage = 5;
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const paginatedNotes = notes.slice(start, end);
    const totalPages = Math.ceil(notes.length / perPage);
    
    let notesText = t.list
      .replace('{page}', page)
      .replace('{total}', totalPages);
    
    paginatedNotes.forEach((note, index) => {
      notesText += t.format
        .replace('{index}', start + index + 1)
        .replace('{text}', note.text)
        .replace('{date}', note.formattedDate)
        .replace('{id}', note.id);
    });
    
    const keyboard = [];
    if (page > 1) {
      keyboard.push([Markup.button.callback('⏪ Previous', `notes_page_${page - 1}`)]);
    }
    if (end < notes.length) {
      keyboard.push([Markup.button.callback('⏩ Next', `notes_page_${page + 1}`)]);
    }
    keyboard.push([Markup.button.callback(
      lang === 'fa' ? translations.fa.buttons.back : translations.en.buttons.back,
      'main_menu'
    )]);
    
    await ctx.replyWithMarkdown(notesText, Markup.inlineKeyboard(keyboard));
  });
});

// Favorite command
bot.command('favorite', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.favorites : translations.en.favorites;
    const history = userConversations.get(userId) || [];
    
    if (history.length === 0) {
      await ctx.reply(lang === 'fa' ? 'گفتگویی برای ذخیره وجود ندارد.' : 'No conversation to favorite.');
      return;
    }
    
    const lastResponse = history.filter(msg => msg.role === 'assistant').pop();
    
    if (!lastResponse) {
      await ctx.reply(lang === 'fa' ? 'پاسخی برای ذخیره وجود ندارد.' : 'No AI response to favorite.');
      return;
    }
    
    if (!userFavorites.has(userId)) userFavorites.set(userId, []);
    
    const favorites = userFavorites.get(userId);
    favorites.push({
      id: generateId('FV'),
      text: lastResponse.content.substring(0, 200) + '...',
      fullText: lastResponse.content,
      date: new Date(),
      formattedDate: formatDate(new Date(), userId)
    });
    
    await ctx.replyWithMarkdown(t.saved);
  });
});

// Favorites command
bot.command('favorites', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.favorites : translations.en.favorites;
    const favorites = userFavorites.get(userId) || [];
    
    if (favorites.length === 0) {
      await ctx.replyWithMarkdown(t.noFavorites);
      return;
    }
    
    let favText = t.list;
    let favList = '';
    
    favorites.slice(-5).reverse().forEach((fav, index) => {
      favList += t.format
        .replace('{index}', index + 1)
        .replace('{text}', fav.text)
        .replace('{date}', fav.formattedDate);
    });
    
    favText = favText.replace('{favorites}', favList);
    
    await ctx.replyWithMarkdown(favText, Markup.inlineKeyboard([
      [Markup.button.callback(
        lang === 'fa' ? translations.fa.buttons.back : translations.en.buttons.back,
        'main_menu'
      )]
    ]));
  });
});

// Support command
bot.command('support', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.support : translations.en.support;
    
    await ctx.replyWithMarkdown(
      t.ticket.title,
      Markup.inlineKeyboard([
        [Markup.button.callback(t.createTicket, 'create_ticket')],
        [Markup.button.callback(t.myTickets, 'my_tickets')],
        [Markup.button.callback(t.faq, 'show_faq')],
        [Markup.button.callback(
          lang === 'fa' ? translations.fa.buttons.back : translations.en.buttons.back,
          'main_menu'
        )]
      ])
    );
  });
});

// Create ticket
bot.action('create_ticket', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.support.ticket : translations.en.support.ticket;
    
    await ctx.answerCbQuery();
    
    // Ask for subject
    await ctx.replyWithMarkdown(t.subject, Markup.forceReply());
    userPreferences.set(`${userId}_ticket_state`, 'awaiting_subject');
  });
});

// My tickets
bot.action('my_tickets', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.support : translations.en.support;
    
    await ctx.answerCbQuery();
    
    // Get user tickets
    let tickets = [];
    if (config.database.mongodb && Ticket) {
      tickets = await Ticket.find({ userId: userId.toString() }).sort({ 'metadata.createdAt': -1 }).limit(5);
    } else {
      tickets = Object.values(database.tickets)
        .filter(t => t.userId === userId.toString())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5);
    }
    
    if (tickets.length === 0) {
      await ctx.reply(lang === 'fa' ? 'تیکتی یافت نشد.' : 'No tickets found.');
      return;
    }
    
    let ticketsText = t.myTickets + '\n\n';
    tickets.forEach((ticket, i) => {
      const status = ticket.status === 'open' ? '🟢' : ticket.status === 'resolved' ? '✅' : '🔴';
      ticketsText += `${i + 1}. ${status} **#${ticket.ticketId || ticket.id}**\n`;
      ticketsText += `   📝 ${ticket.subject || ticket.message.substring(0, 50)}...\n`;
      ticketsText += `   📅 ${formatDate(new Date(ticket.metadata?.createdAt || ticket.createdAt), userId)}\n\n`;
    });
    
    await ctx.replyWithMarkdown(ticketsText);
  });
});

// Show FAQ
bot.action('show_faq', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.support.faq : translations.en.support.faq;
    
    await ctx.answerCbQuery();
    
    await ctx.replyWithMarkdown(
      t.title + '\n\n' +
      t.q1 + '\n\n' +
      t.q2 + '\n\n' +
      t.q3 + '\n\n' +
      t.q4 + '\n\n' +
      t.q5
    );
  });
});

// Stats command
bot.command('stats', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.statistics : translations.en.statistics;
    
    const history = userConversations.get(userId) || [];
    const notes = userNotes.get(userId) || [];
    const favorites = userFavorites.get(userId) || [];
    const prefs = userPreferences.get(userId) || {};
    
    const model = AVAILABLE_MODELS.find(m => m.id === prefs.model)?.name || 'Llama 3.3 70B';
    const lastActive = userActivity.get(userId) ? formatDate(new Date(userActivity.get(userId)), userId) : 'Never';
    
    let statsText = t.title + '\n\n';
    statsText += t.user.replace('{name}', ctx.from.first_name) + '\n';
    statsText += t.id.replace('{id}', userId) + '\n';
    statsText += t.joined.replace('{date}', 'Feb 22, 2026') + '\n';
    statsText += t.lastActive.replace('{date}', lastActive) + '\n\n';
    statsText += t.messages
      .replace('{sent}', history.filter(m => m.role === 'user').length)
      .replace('{received}', history.filter(m => m.role === 'assistant').length) + '\n';
    statsText += t.totalMessages.replace('{total}', history.length) + '\n';
    statsText += t.sessions.replace('{count}', prefs.sessions || 1) + '\n\n';
    statsText += t.model.replace('{model}', model) + '\n';
    statsText += t.notes.replace('{count}', notes.length) + '\n';
    statsText += t.favorites.replace('{count}', favorites.length) + '\n';
    statsText += t.language.replace('{lang}', lang === 'fa' ? 'فارسی' : 'English') + '\n';
    statsText += t.uptime.replace('{uptime}', formatUptime(process.uptime())) + '\n';
    
    await ctx.replyWithMarkdown(statsText);
  });
});

// Clear command
bot.command('clear', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    
    await ctx.replyWithMarkdown(
      lang === 'fa' ? translations.fa.buttons.clear : translations.en.clear_confirm,
      Markup.inlineKeyboard([
        [Markup.button.callback(
          lang === 'fa' ? translations.fa.buttons.yesClear : translations.en.yes_clear,
          'confirm_clear'
        )],
        [Markup.button.callback(
          lang === 'fa' ? translations.fa.buttons.noKeep : translations.en.no_keep,
          'cancel'
        )]
      ])
    );
  });
});

// Export command
bot.command('export', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const history = userConversations.get(userId) || [];
    
    if (history.length === 0) {
      await ctx.reply(lang === 'fa' ? 'تاریخچه خالی است.' : 'History is empty.');
      return;
    }
    
    let exportText = `📤 **Conversation Export**\n`;
    exportText += `User: ${ctx.from.first_name}\n`;
    exportText += `Date: ${formatDate(new Date(), userId)}\n`;
    exportText += `Messages: ${history.length}\n`;
    exportText += `─${'─'.repeat(30)}\n\n`;
    
    history.forEach(msg => {
      const role = msg.role === 'user' ? '👤 You' : '🤖 AI';
      exportText += `${role}: ${msg.content}\n\n`;
    });
    
    const parts = splitMessage(exportText, 3500);
    for (const part of parts) {
      await ctx.reply(part, { parse_mode: 'Markdown' });
    }
  });
});

// About command
bot.command('about', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    
    let aboutText = lang === 'fa' 
      ? `🤖 **دستیار هوش مصنوعی پیشرفته**\n\n`
      : `🤖 **Advanced AI Assistant**\n\n`;
    
    if (lang === 'fa') {
      aboutText += `**نسخه:** ${config.bot.version}\n`
        + `**قدرت گرفته از:** Khan's AI Solutions\n`
        + `**فناوری:** Groq AI\n`
        + `**امکانات:**\n`
        + `• دو زبانه (انگلیسی و فارسی)\n`
        + `• ۵ مدل مختلف هوش مصنوعی\n`
        + `• سیستم یادداشت‌برداری\n`
        + `• موارد علاقه‌مندی\n`
        + `• سیستم پشتیبانی تیکت\n`
        + `• خروجی گفتگو\n`
        + `• آمار کاربری\n`
        + `• نکات حرفه‌ای\n`
        + `• ترجمه خودکار\n`
        + `• خلاصه‌سازی متن\n\n`
        + `🚀 ساخته شده برای سرعت و قابلیت اطمینان\n`
        + `📱 ${translations.fa.buttons.mainMenu}`;
    } else {
      aboutText += `**Version:** ${config.bot.version}\n`
        + `**Powered by:** Khan's AI Solutions\n`
        + `**Technology:** Groq AI\n`
        + `**Features:**\n`
        + `• Bilingual (English & Persian)\n`
        + `• 5 different AI models\n`
        + `• Note taking system\n`
        + `• Favorites\n`
        + `• Support ticket system\n`
        + `• Conversation export\n`
        + `• User statistics\n`
        + `• Pro tips\n`
        + `• Auto-translate\n`
        + `• Text summarization\n\n`
        + `🚀 Built for speed and reliability\n`
        + `📱 ${translations.en.buttons.mainMenu}`;
    }
    
    await ctx.replyWithMarkdown(aboutText, Markup.inlineKeyboard([
      [Markup.button.callback(
        lang === 'fa' ? translations.fa.buttons.privacyGuide : translations.en.buttons.privacyGuide,
        'privacy_guide'
      )],
      [Markup.button.url(
        lang === 'fa' ? '📨 دعوت دوستان' : '📨 Invite Friends',
        `https://t.me/share/url?url=https://t.me/${ctx.botInfo.username}`
      )],
      [Markup.button.callback(
        lang === 'fa' ? translations.fa.buttons.back : translations.en.buttons.back,
        'main_menu'
      )]
    ]));
  });
});

// Privacy command
bot.command('privacy', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.privacy : translations.en.privacy;
    
    await ctx.replyWithMarkdown(
      t.title + '\n\n' +
      (lang === 'fa' ? t.fa : t.en) + '\n' +
      t.terms + '\n\n' +
      t.consent,
      Markup.inlineKeyboard([
        [Markup.button.callback(
          lang === 'fa' ? translations.fa.buttons.back : translations.en.buttons.back,
          'main_menu'
        )]
      ])
    );
  });
});

// Tip command
bot.command('tip', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const tip = getProTip(userId);
    await ctx.replyWithMarkdown(tip);
  });
});

// Profile command
bot.command('profile', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const prefs = userPreferences.get(userId) || {};
    
    let profileText = lang === 'fa' ? '👤 **پروفایل شما**\n\n' : '👤 **Your Profile**\n\n';
    profileText += `🆔 **ID:** \`${userId}\`\n`;
    profileText += `👤 **Name:** ${ctx.from.first_name} ${ctx.from.last_name || ''}\n`;
    profileText += `📛 **Username:** @${ctx.from.username || 'N/A'}\n`;
    profileText += `🌐 **Language:** ${lang === 'fa' ? 'فارسی' : 'English'}\n`;
    profileText += `🤖 **Model:** ${prefs.model || 'llama-3.3-70b-versatile'}\n`;
    profileText += `📅 **Joined:** ${formatDate(new Date(ctx.from.created_at || Date.now()), userId)}\n`;
    
    await ctx.replyWithMarkdown(profileText);
  });
});

// ======================================================
// ADMIN COMMANDS
// ======================================================

// Broadcast command (admin only)
bot.command('broadcast', async (ctx) => {
  const userId = ctx.from.id.toString();
  
  // Check if admin
  if (!config.bot.adminIds.includes(userId)) {
    return ctx.reply('⛔ This command is for admins only.');
  }
  
  await safeExecute(ctx, async () => {
    const message = ctx.message.text.replace('/broadcast', '').trim();
    
    if (!message) {
      return ctx.reply('Usage: /broadcast [message]');
    }
    
    await ctx.reply(`📢 **Broadcast Preview:**\n\n${message}\n\nSend to all users?`,
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Yes', 'confirm_broadcast')],
        [Markup.button.callback('❌ No', 'cancel_broadcast')]
      ])
    );
    
    // Store message temporarily
    ctx.session = { broadcastMessage: message };
  });
});

// Analytics command (admin only)
bot.command('analytics', async (ctx) => {
  const userId = ctx.from.id.toString();
  
  if (!config.bot.adminIds.includes(userId)) {
    return ctx.reply('⛔ This command is for admins only.');
  }
  
  await safeExecute(ctx, async () => {
    const analytics = `📊 **System Analytics**\n\n` +
      `**Users:**\n` +
      `• Total: ${userStats.totalUsers}\n` +
      `• Active Today: ${userStats.activeUsers}\n` +
      `• New Today: ${userStats.newUsers}\n\n` +
      `**Messages:**\n` +
      `• Total: ${userStats.totalMessages}\n` +
      `• Avg per User: ${(userStats.totalMessages / (userStats.totalUsers || 1)).toFixed(1)}\n\n` +
      `**Tickets:**\n` +
      `• Open: ${ticketStats.open}\n` +
      `• Resolved: ${ticketStats.resolved}\n` +
      `• Total: ${ticketStats.total}\n\n` +
      `**System:**\n` +
      `• Uptime: ${formatUptime(process.uptime())}\n` +
      `• Memory: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB\n` +
      `• CPU: ${(process.cpuUsage().user / 1000000).toFixed(2)}s`;
    
    await ctx.reply(analytics);
  });
});

// Tickets list (admin only)
bot.command('tickets', async (ctx) => {
  const userId = ctx.from.id.toString();
  
  if (!config.bot.adminIds.includes(userId)) {
    return ctx.reply('⛔ This command is for admins only.');
  }
  
  await safeExecute(ctx, async () => {
    let tickets = [];
    if (config.database.mongodb && Ticket) {
      tickets = await Ticket.find({ status: 'open' }).sort({ 'metadata.createdAt': -1 }).limit(10);
    } else {
      tickets = Object.values(database.tickets).filter(t => t.status === 'open').slice(0, 10);
    }
    
    if (tickets.length === 0) {
      return ctx.reply('📭 No open tickets.');
    }
    
    let ticketsText = '🎫 **Open Tickets**\n\n';
    tickets.forEach((ticket, i) => {
      ticketsText += `${i + 1}. **#${ticket.ticketId || ticket.id}**\n`;
      ticketsText += `   👤 ${ticket.userName || ticket.userId}\n`;
      ticketsText += `   📝 ${(ticket.message || ticket.message).substring(0, 50)}...\n`;
      ticketsText += `   🕐 ${formatDate(new Date(ticket.metadata?.createdAt || ticket.createdAt || ticket.timestamp), userId)}\n\n`;
    });
    
    await ctx.reply(ticketsText);
  });
});

// ======================================================
// CALLBACK HANDLERS
// ======================================================

// Language selection
bot.action('lang_en', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    
    if (!userPreferences.has(userId)) userPreferences.set(userId, {});
    userPreferences.get(userId).language = 'en';
    
    await setBotCommands('en');
    await ctx.answerCbQuery('Language set to English');
    
    await ctx.editMessageText(
      translations.en.system.welcome.replace('{name}', ctx.from.first_name),
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(translations.en.buttons.startChat, 'start_chat')],
            [Markup.button.callback(translations.en.buttons.helpSupport, 'help_support'), 
             Markup.button.callback(translations.en.buttons.about, 'about_bot')],
            [Markup.button.callback(translations.en.buttons.settings, 'settings'), 
             Markup.button.callback(translations.en.buttons.privacyGuide, 'privacy_guide')]
          ]
        }
      }
    );
    
    setTimeout(() => ctx.replyWithMarkdown(getProTip(userId)), 2000);
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
      translations.fa.system.welcome.replace('{name}', ctx.from.first_name),
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(translations.fa.buttons.startChat, 'start_chat')],
            [Markup.button.callback(translations.fa.buttons.helpSupport, 'help_support'), 
             Markup.button.callback(translations.fa.buttons.about, 'about_bot')],
            [Markup.button.callback(translations.fa.buttons.settings, 'settings'), 
             Markup.button.callback(translations.fa.buttons.privacyGuide, 'privacy_guide')]
          ]
        }
      }
    );
    
    setTimeout(() => ctx.replyWithMarkdown(getProTip(userId)), 2000);
  });
});

// Model selection
AVAILABLE_MODELS.forEach(model => {
  bot.action(`model_select_${model.id}`, async (ctx) => {
    await safeExecute(ctx, async () => {
      const userId = ctx.from.id;
      const lang = getUserLanguage(userId);
      const t = lang === 'fa' ? translations.fa.models : translations.en.models;
      
      await ctx.answerCbQuery(lang === 'fa' ? `انتخاب شد: ${model.name}` : `Selected: ${model.name}`);
      
      if (!userPreferences.has(userId)) userPreferences.set(userId, {});
      userPreferences.get(userId).model = model.id;
      
      await ctx.editMessageText(
        t.changed.replace('{model}', model.name),
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback(
                lang === 'fa' ? translations.fa.buttons.back : translations.en.buttons.back,
                'model'
              )],
              [Markup.button.callback(
                lang === 'fa' ? translations.fa.buttons.mainMenu : translations.en.buttons.mainMenu,
                'main_menu'
              )]
            ]
          }
        }
      );
    });
  });
});

// Start chat
bot.action('start_chat', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    
    await ctx.answerCbQuery();
    await ctx.replyWithMarkdown(
      lang === 'fa' 
        ? '💬 **آماده گفتگو!** هر پیامی بفرستید.\n\nمی‌توانید سوال بپرسید، کمک بخواهید یا هر موضوع دیگری!'
        : '💬 **Ready to chat!** Send any message.\n\nAsk questions, get help, or discuss any topic!'
    );
  });
});

// Help & support
bot.action('help_support', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.support : translations.en.support;
    
    await ctx.answerCbQuery();
    await ctx.replyWithMarkdown(
      t.title + '\n\n' + t.options,
      Markup.inlineKeyboard([
        [Markup.button.callback(t.createTicket, 'create_ticket')],
        [Markup.button.callback(t.myTickets, 'my_tickets')],
        [Markup.button.callback(t.faq, 'show_faq')],
        [Markup.button.callback(
          lang === 'fa' ? translations.fa.buttons.back : translations.en.buttons.back,
          'main_menu'
        )]
      ])
    );
  });
});

// About bot
bot.action('about_bot', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    
    let aboutText = lang === 'fa' 
      ? `🤖 **دستیار هوش مصنوعی**\n\n`
      : `🤖 **AI Assistant**\n\n`;
    
    if (lang === 'fa') {
      aboutText += `**نسخه:** ${config.bot.version}\n`
        + `**توسعه‌دهنده:** Khan's AI Solutions\n`
        + `**فناوری:** Groq AI\n\n`
        + `**ویژگی‌ها:**\n`
        + `• دو زبانه (انگلیسی و فارسی)\n`
        + `• ۵ مدل هوش مصنوعی\n`
        + `• یادداشت‌برداری\n`
        + `• موارد علاقه‌مندی\n`
        + `• پشتیبانی تیکت\n`
        + `• خروجی گفتگو\n`
        + `• آمار کاربری\n\n`
        + `برای پشتیبانی از /support استفاده کنید.`;
    } else {
      aboutText += `**Version:** ${config.bot.version}\n`
        + `**Developer:** Khan's AI Solutions\n`
        + `**Technology:** Groq AI\n\n`
        + `**Features:**\n`
        + `• Bilingual (EN/FA)\n`
        + `• 5 AI models\n`
        + `• Notes system\n`
        + `• Favorites\n`
        + `• Support tickets\n`
        + `• Conversation export\n`
        + `• User statistics\n\n`
        + `For support, use /support command.`;
    }
    
    await ctx.replyWithMarkdown(aboutText, {
      reply_markup: {
        inline_keyboard: [
          [Markup.button.callback(
            lang === 'fa' ? translations.fa.buttons.back : translations.en.buttons.back,
            'main_menu'
          )]
        }
      }
    });
  });
});

// Settings menu
bot.action('settings', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.buttons : translations.en.buttons;
    
    await ctx.answerCbQuery();
    await ctx.replyWithMarkdown(
      lang === 'fa' ? '⚙️ **تنظیمات**\n\nگزینه مورد نظر را انتخاب کنید:' : '⚙️ **Settings**\n\nSelect an option:',
      Markup.inlineKeyboard([
        [Markup.button.callback(t.proTip, 'pro_tip')],
        [Markup.button.callback('🤖 ' + (lang === 'fa' ? 'تغییر مدل' : 'Change Model'), 'change_model')],
        [Markup.button.callback('🗑️ ' + (lang === 'fa' ? 'پاک کردن تاریخچه' : 'Clear History'), 'confirm_clear')],
        [Markup.button.callback('📊 ' + (lang === 'fa' ? 'آمار' : 'Statistics'), 'user_stats')],
        [Markup.button.callback('📝 ' + (lang === 'fa' ? 'یادداشت‌ها' : 'Notes'), 'notes_menu')],
        [Markup.button.callback('⭐ ' + (lang === 'fa' ? 'علاقه‌مندی‌ها' : 'Favorites'), 'favorites_menu')],
        [Markup.button.callback(t.back, 'main_menu')]
      ])
    );
  });
});

// Privacy guide
bot.action('privacy_guide', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.privacy : translations.en.privacy;
    
    await ctx.answerCbQuery();
    
    await ctx.replyWithMarkdown(
      t.title + '\n\n' +
      (lang === 'fa' ? t.fa : t.en) + '\n' +
      t.terms + '\n\n' +
      t.consent,
      {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(
              lang === 'fa' ? translations.fa.buttons.back : translations.en.buttons.back,
              'main_menu'
            )]
          ]
        }
      }
    );
  });
});

// Pro tip
bot.action('pro_tip', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    await ctx.answerCbQuery();
    const tip = getProTip(userId);
    await ctx.replyWithMarkdown(tip);
  });
});

// Change model
bot.action('change_model', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    
    const buttons = AVAILABLE_MODELS.map(model => {
      const displayName = lang === 'fa' ? 
        `${model.name} - ${model.fa}` : 
        `${model.name} - ${model.description}`;
      return [Markup.button.callback(displayName, `model_select_${model.id}`)];
    });
    
    buttons.push([Markup.button.callback(
      lang === 'fa' ? translations.fa.buttons.back : translations.en.buttons.back,
      'settings'
    )]);
    
    await ctx.editMessageText(
      lang === 'fa' ? translations.fa.models.select : translations.en.models.select,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
      }
    );
  });
});

// Confirm clear
bot.action('confirm_clear', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.buttons : translations.en;
    
    await ctx.answerCbQuery();
    await ctx.replyWithMarkdown(
      lang === 'fa' ? translations.fa.clear_confirm : translations.en.clear_confirm,
      Markup.inlineKeyboard([
        [Markup.button.callback(t.yesClear, 'clear_history')],
        [Markup.button.callback(t.noKeep, 'settings')]
      ])
    );
  });
});

// Clear history
bot.action('clear_history', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    
    userConversations.delete(userId);
    await ctx.answerCbQuery(lang === 'fa' ? 'پاک شد' : 'Cleared');
    await ctx.editMessageText(
      lang === 'fa' ? translations.fa.cleared : translations.en.cleared
    );
  });
});

// User stats
bot.action('user_stats', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.statistics : translations.en.statistics;
    
    const history = userConversations.get(userId) || [];
    const notes = userNotes.get(userId) || [];
    const favorites = userFavorites.get(userId) || [];
    const prefs = userPreferences.get(userId) || {};
    
    const model = AVAILABLE_MODELS.find(m => m.id === prefs.model)?.name || 'Llama 3.3 70B';
    const lastActive = userActivity.get(userId) ? formatDate(new Date(userActivity.get(userId)), userId) : 'Never';
    
    let statsText = t.title + '\n\n';
    statsText += t.messages
      .replace('{sent}', history.filter(m => m.role === 'user').length)
      .replace('{received}', history.filter(m => m.role === 'assistant').length) + '\n';
    statsText += t.totalMessages.replace('{total}', history.length) + '\n';
    statsText += t.sessions.replace('{count}', prefs.sessions || 1) + '\n\n';
    statsText += t.model.replace('{model}', model) + '\n';
    statsText += t.notes.replace('{count}', notes.length) + '\n';
    statsText += t.favorites.replace('{count}', favorites.length) + '\n';
    statsText += t.lastActive.replace('{date}', lastActive) + '\n';
    statsText += t.id.replace('{id}', userId) + '\n';
    
    await ctx.replyWithMarkdown(statsText, {
      reply_markup: {
        inline_keyboard: [
          [Markup.button.callback(
            lang === 'fa' ? translations.fa.buttons.back : translations.en.buttons.back,
            'settings'
          )]
        ]
      }
    });
  });
});

// Notes menu
bot.action('notes_menu', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.notes : translations.en.notes;
    
    await ctx.answerCbQuery();
    await ctx.replyWithMarkdown(
      t.menu,
      Markup.inlineKeyboard([
        [Markup.button.callback(t.create, 'create_note')],
        [Markup.button.callback(t.view, 'view_notes')],
        [Markup.button.callback(t.search, 'search_notes')],
        [Markup.button.callback(t.export, 'export_notes')],
        [Markup.button.callback(
          lang === 'fa' ? translations.fa.buttons.back : translations.en.buttons.back,
          'settings'
        )]
      ])
    );
  });
});

// Create note
bot.action('create_note', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.notes : translations.en.notes;
    
    await ctx.answerCbQuery();
    userPreferences.set(`${userId}_state`, 'awaiting_note');
    await ctx.replyWithMarkdown(t.enter_note, Markup.forceReply());
  });
});

// View notes
bot.action('view_notes', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.notes : translations.en.notes;
    const notes = userNotes.get(userId) || [];
    
    if (notes.length === 0) {
      await ctx.replyWithMarkdown(t.noNotes);
      return;
    }
    
    let notesText = t.list
      .replace('{page}', 1)
      .replace('{total}', Math.ceil(notes.length / 5));
    
    notes.slice(-5).reverse().forEach((note, index) => {
      notesText += t.format
        .replace('{index}', index + 1)
        .replace('{text}', note.text)
        .replace('{date}', note.formattedDate)
        .replace('{id}', note.id);
    });
    
    await ctx.replyWithMarkdown(notesText);
  });
});

// Favorites menu
bot.action('favorites_menu', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.favorites : translations.en.favorites;
    
    await ctx.answerCbQuery();
    await ctx.replyWithMarkdown(
      t.title,
      Markup.inlineKeyboard([
        [Markup.button.callback(t.list, 'view_favorites')],
        [Markup.button.callback(
          lang === 'fa' ? '🗑️ پاک کردن همه' : '🗑️ Clear All',
          'clear_favorites'
        )],
        [Markup.button.callback(
          lang === 'fa' ? translations.fa.buttons.back : translations.en.buttons.back,
          'settings'
        )]
      ])
    );
  });
});

// View favorites
bot.action('view_favorites', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.favorites : translations.en.favorites;
    const favorites = userFavorites.get(userId) || [];
    
    if (favorites.length === 0) {
      await ctx.replyWithMarkdown(t.noFavorites);
      return;
    }
    
    let favText = t.list;
    let favList = '';
    
    favorites.slice(-5).reverse().forEach((fav, index) => {
      favList += t.format
        .replace('{index}', index + 1)
        .replace('{text}', fav.text)
        .replace('{date}', fav.formattedDate);
    });
    
    favText = favText.replace('{favorites}', favList);
    
    await ctx.replyWithMarkdown(favText);
  });
});

// Clear favorites
bot.action('clear_favorites', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.favorites : translations.en.favorites;
    
    userFavorites.delete(userId);
    await ctx.answerCbQuery(lang === 'fa' ? 'پاک شد' : 'Cleared');
    await ctx.replyWithMarkdown(t.cleared);
  });
});

// Main menu
bot.action('main_menu', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.buttons : translations.en.buttons;
    
    await ctx.answerCbQuery();
    
    await ctx.replyWithMarkdown(
      lang === 'fa' 
        ? '🌟 **منوی اصلی**\n\nچه کاری می‌خواهید انجام دهید؟'
        : '🌟 **Main Menu**\n\nWhat would you like to do?',
      Markup.inlineKeyboard([
        [Markup.button.callback(t.startChat, 'start_chat')],
        [Markup.button.callback(t.helpSupport, 'help_support'), 
         Markup.button.callback(t.about, 'about_bot')],
        [Markup.button.callback(t.settings, 'settings'), 
         Markup.button.callback(t.privacyGuide, 'privacy_guide')]
      ])
    );
  });
});

// Cancel
bot.action('cancel', async (ctx) => {
  await safeExecute(ctx, async () => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage().catch(() => {});
  });
});

// Cancel broadcast
bot.action('cancel_broadcast', async (ctx) => {
  await safeExecute(ctx, async () => {
    await ctx.answerCbQuery('Cancelled');
    await ctx.editMessageText('❌ Broadcast cancelled.');
    delete ctx.session?.broadcastMessage;
  });
});

// Confirm broadcast
bot.action('confirm_broadcast', async (ctx) => {
  await safeExecute(ctx, async () => {
    await ctx.answerCbQuery();
    
    if (!ctx.session?.broadcastMessage) {
      return ctx.editMessageText('❌ No broadcast message found.');
    }
    
    const message = ctx.session.broadcastMessage;
    await ctx.editMessageText(`📢 Sending broadcast...`);
    
    // Get all users
    const users = database.getAllUsers();
    let sent = 0;
    let failed = 0;
    
    for (const user of users) {
      try {
        await bot.telegram.sendMessage(user.id, `📢 **Broadcast**\n\n${message}`, { parse_mode: 'Markdown' });
        sent++;
        await new Promise(resolve => setTimeout(resolve, 50)); // Rate limiting
      } catch (error) {
        failed++;
      }
    }
    
    await ctx.replyWithMarkdown(
      `✅ **Broadcast Complete**\n\n` +
      `Sent: ${sent}\n` +
      `Failed: ${failed}`
    );
    
    delete ctx.session.broadcastMessage;
  });
});

// ======================================================
// MESSAGE HANDLING
// ======================================================

// Text messages
bot.on('text', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const userMessage = ctx.message.text;
    const state = userPreferences.get(`${userId}_state`);
    const ticketState = userPreferences.get(`${userId}_ticket_state`);
    const lang = getUserLanguage(userId);
    
    userActivity.set(userId, Date.now());
    
    // Register/update user
    await registerUser(ctx);
    
    // Handle note creation
    if (state === 'awaiting_note' && userMessage !== '/cancel') {
      userPreferences.delete(`${userId}_state`);
      
      if (!userNotes.has(userId)) userNotes.set(userId, []);
      
      const noteObj = {
        id: generateId('NT'),
        text: userMessage,
        date: new Date(),
        formattedDate: formatDate(new Date(), userId)
      };
      
      userNotes.get(userId).push(noteObj);
      
      const t = lang === 'fa' ? translations.fa.notes : translations.en.notes;
      await ctx.replyWithMarkdown(t.saved.replace('{id}', noteObj.id).replace('{note}', noteObj.text));
      return;
    }
    
    // Handle ticket creation
    if (ticketState) {
      const t = lang === 'fa' ? translations.fa.support.ticket : translations.en.support.ticket;
      
      // Subject
      if (ticketState === 'awaiting_subject' && userMessage !== '/cancel') {
        userPreferences.set(`${userId}_ticket_subject`, userMessage);
        userPreferences.set(`${userId}_ticket_state`, 'awaiting_category');
        
        // Show category selection
        const categories = [
          [Markup.button.callback(t.categories.technical, 'ticket_cat_technical')],
          [Markup.button.callback(t.categories.billing, 'ticket_cat_billing')],
          [Markup.button.callback(t.categories.feature, 'ticket_cat_feature')],
          [Markup.button.callback(t.categories.bug, 'ticket_cat_bug')],
          [Markup.button.callback(t.categories.other, 'ticket_cat_other')]
        ];
        
        await ctx.replyWithMarkdown(t.category, Markup.inlineKeyboard(categories));
        return;
      }
      
      // Cancel
      if (userMessage === '/cancel') {
        userPreferences.delete(`${userId}_ticket_state`);
        userPreferences.delete(`${userId}_ticket_subject`);
        userPreferences.delete(`${userId}_ticket_category`);
        userPreferences.delete(`${userId}_ticket_priority`);
        await ctx.reply(lang === 'fa' ? '❌ عملیات لغو شد.' : '❌ Cancelled.');
        return;
      }
    }
    
    // Handle feedback
    if (state === 'awaiting_feedback' && userMessage !== '/cancel') {
      userPreferences.delete(`${userId}_state`);
      
      const t = lang === 'fa' ? translations.fa.feedback_thanks : translations.en.feedback_thanks;
      await ctx.replyWithMarkdown(t);
      
      // Notify admins
      for (const adminId of config.bot.adminIds) {
        await bot.telegram.sendMessage(
          adminId,
          `📝 **New Feedback**\n\nUser: ${ctx.from.first_name} (@${ctx.from.username || 'N/A'})\nID: \`${userId}\`\n\nMessage:\n${userMessage}`,
          { parse_mode: 'Markdown' }
        ).catch(() => {});
      }
      return;
    }
    
    // Cancel
    if (userMessage === '/cancel') {
      userPreferences.delete(`${userId}_state`);
      userPreferences.delete(`${userId}_ticket_state`);
      userPreferences.delete(`${userId}_ticket_subject`);
      userPreferences.delete(`${userId}_ticket_category`);
      userPreferences.delete(`${userId}_ticket_priority`);
      await ctx.reply(lang === 'fa' ? '❌ عملیات لغو شد.' : '❌ Cancelled.');
      return;
    }
    
    // Regular chat message
    logger.info(`📨 Message from ${userId}: ${userMessage.substring(0, 50)}...`);
    
    await ctx.sendChatAction('typing');
    
    // Get user preferences
    const prefs = userPreferences.get(userId) || {};
    const model = prefs.model || 'llama-3.3-70b-versatile';
    
    // Get AI response
    const startTime = Date.now();
    const result = await getAIResponse(userMessage, userId, model);
    const responseTime = Date.now() - startTime;
    
    // Update stats
    userStats.totalApiCalls++;
    userStats.averageResponseTime = (userStats.averageResponseTime + responseTime) / 2;
    
    if (!result.success) {
      const t = lang === 'fa' ? translations.fa.models : translations.en.models;
      await ctx.replyWithMarkdown(
        t.error,
        {
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback(
                lang === 'fa' ? '🤖 تغییر مدل' : '🤖 Change Model',
                'change_model'
              )]
            ]
          }
        }
      );
      return;
    }
    
    // Split and send response
    const messageParts = splitMessage(result.response);
    const t = lang === 'fa' ? translations.fa.buttons : translations.en.buttons;
    
    for (let i = 0; i < messageParts.length; i++) {
      const part = messageParts[i];
      const keyboard = i === messageParts.length - 1 ? {
        inline_keyboard: [
          [Markup.button.callback(t.saveFavorite, 'save_favorite'), 
           Markup.button.callback(t.proTip, 'pro_tip')],
          [Markup.button.callback(t.settings, 'settings'), 
           Markup.button.callback(t.helpSupport, 'help_support')]
        ]
      } : undefined;
      
      await ctx.replyWithMarkdown(part, { reply_markup: keyboard });
    }
  });
});

// Handle media messages (ignored)
bot.on(['photo', 'video', 'document', 'voice', 'audio', 'sticker', 'animation'], (ctx) => {
  logger.info(`📨 Media ignored from ${ctx.from.id}: ${ctx.updateSubTypes[0]}`);
});

// Save favorite
bot.action('save_favorite', async (ctx) => {
  await safeExecute(ctx, async () => {
    const userId = ctx.from.id;
    const lang = getUserLanguage(userId);
    const t = lang === 'fa' ? translations.fa.favorites : translations.en.favorites;
    
    await ctx.answerCbQuery(lang === 'fa' ? 'ذخیره شد' : 'Saved!');
    
    const history = userConversations.get(userId) || [];
    const lastResponse = history.filter(msg => msg.role === 'assistant').pop();
    
    if (lastResponse) {
      if (!userFavorites.has(userId)) userFavorites.set(userId, []);
      
      userFavorites.get(userId).push({
        id: generateId('FV'),
        text: lastResponse.content.substring(0, 200) + '...',
        fullText: lastResponse.content,
        date: new Date(),
        formattedDate: formatDate(new Date(), userId)
      });
      
      await ctx.reply(t.saved);
    }
  });
});

// Ticket category selection
['technical', 'billing', 'feature', 'bug', 'other'].forEach(cat => {
  bot.action(`ticket_cat_${cat}`, async (ctx) => {
    await safeExecute(ctx, async () => {
      const userId = ctx.from.id;
      const lang = getUserLanguage(userId);
      const t = lang === 'fa' ? translations.fa.support.ticket : translations.en.support.ticket;
      
      await ctx.answerCbQuery();
      
      // Save category
      userPreferences.set(`${userId}_ticket_category`, cat);
      userPreferences.set(`${userId}_ticket_state`, 'awaiting_priority');
      
      // Show priority selection
      const priorities = [
        [Markup.button.callback(t.priorities.low, 'ticket_pri_low')],
        [Markup.button.callback(t.priorities.medium, 'ticket_pri_medium')],
        [Markup.button.callback(t.priorities.high, 'ticket_pri_high')],
        [Markup.button.callback(t.priorities.urgent, 'ticket_pri_urgent')]
      ];
      
      await ctx.replyWithMarkdown(t.priority, Markup.inlineKeyboard(priorities));
    });
  });
});

// Ticket priority selection
['low', 'medium', 'high', 'urgent'].forEach(pri => {
  bot.action(`ticket_pri_${pri}`, async (ctx) => {
    await safeExecute(ctx, async () => {
      const userId = ctx.from.id;
      const lang = getUserLanguage(userId);
      const t = lang === 'fa' ? translations.fa.support.ticket : translations.en.support.ticket;
      
      await ctx.answerCbQuery();
      
      // Save priority
      userPreferences.set(`${userId}_ticket_priority`, pri);
      userPreferences.set(`${userId}_ticket_state`, 'awaiting_description');
      
      // Ask for description
      await ctx.replyWithMarkdown(t.description, Markup.forceReply());
    });
  });
});

// ======================================================
// AI RESPONSE FUNCTION
// ======================================================

async function getAIResponse(userMessage, userId, model = 'llama-3.3-70b-versatile') {
  try {
    // Get or create conversation history
    if (!userConversations.has(userId)) {
      userConversations.set(userId, []);
    }
    const history = userConversations.get(userId);
    
    // Add user message
    history.push({ role: 'user', content: userMessage });
    
    // Keep history manageable
    const MAX_HISTORY = 20;
    if (history.length > MAX_HISTORY) {
      const toRemove = history.length - MAX_HISTORY;
      history.splice(0, toRemove);
    }
    
    logger.info(`🔄 Calling Groq API for user ${userId} with model: ${model}`);
    
    // Prepare messages for API
    const messages = history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Add system message based on language
    const lang = getUserLanguage(userId);
    if (lang === 'fa') {
      messages.unshift({
        role: 'system',
        content: 'شما یک دستیار هوش مصنوعی حرفه‌ای هستید. به زبان فارسی پاسخ دهید و مفید، دقیق و دوستانه باشید.'
      });
    } else {
      messages.unshift({
        role: 'system',
        content: 'You are a professional AI assistant. Be helpful, accurate, and friendly in your responses.'
      });
    }
    
    // Call Groq API
    const chatCompletion = await groq.chat.completions.create({
      model: model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 2048,
      top_p: 0.95,
      stream: false
    });
    
    logger.info('✅ Groq API response received');
    
    const aiReply = chatCompletion.choices[0]?.message?.content || 
      (lang === 'fa' ? 'پاسخی دریافت نشد.' : 'No response received.');
    
    // Add AI response to history
    history.push({ role: 'assistant', content: aiReply });
    
    // Update token usage
    if (chatCompletion.usage) {
      userStats.totalTokens += chatCompletion.usage.total_tokens;
    }
    
    return { success: true, response: aiReply };
    
  } catch (error) {
    logger.error('❌ Groq API Error:', error);
    
    // Handle specific errors
    if (error.status === 403 || error.status === 404 || error.message?.includes('region')) {
      return {
        success: false,
        error: 'region',
        response: '⚠️ This model may not be available in your region. Please use /model to switch to Llama 3.3 70B.'
      };
    } else if (error.status === 401) {
      return { success: false, error: 'auth', response: '❌ Authentication Error. Please contact admin.' };
    } else if (error.status === 429) {
      return { success: false, error: 'rate', response: '⚡ Rate limit exceeded. Please wait a moment.' };
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return { success: false, error: 'network', response: '🌐 Network error. Please try again.' };
    } else {
      return { 
        success: false, 
        error: 'unknown', 
        response: '⚠️ An error occurred. Please try again or use /model to change model.' 
      };
    }
  }
}

// ======================================================
// HELPER FUNCTIONS
// ======================================================

// Format uptime
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

// Send broadcast
async function sendBroadcast(message, parseMode = 'Markdown') {
  const users = database.getAllUsers();
  let sent = 0;
  let failed = 0;
  
  for (const user of users) {
    try {
      await bot.telegram.sendMessage(user.id, message, { parse_mode: parseMode });
      sent++;
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      failed++;
    }
  }
  
  return { sent, failed, total: users.length };
}

// ======================================================
// STATISTICS TRACKING
// ======================================================

const userStats = {
  totalUsers: 0,
  activeUsers: 0,
  newUsers: 0,
  totalMessages: 0,
  totalConversations: 0,
  totalApiCalls: 0,
  totalTokens: 0,
  averageResponseTime: 0
};

const ticketStats = {
  open: 0,
  resolved: 0,
  total: 0
};

// Update stats periodically
setInterval(() => {
  userStats.activeUsers = 0;
  userStats.newUsers = 0;
}, 3600000); // Reset hourly

// ======================================================
// SCHEDULED TASKS
// ======================================================

// Daily backup
if (config.features.backupEnabled) {
  cron.schedule('0 0 * * *', () => {
    logger.info('📦 Running daily backup...');
    
    const backup = {
      timestamp: new Date().toISOString(),
      users: database.getAllUsers(),
      tickets: database.tickets,
      stats: userStats
    };
    
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const filename = `backup-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(
      path.join(backupDir, filename),
      JSON.stringify(backup, null, 2)
    );
    
    logger.info(`✅ Backup saved: ${filename}`);
  });
}

// Cleanup old data
cron.schedule('0 0 * * 0', () => {
  logger.info('🧹 Running weekly cleanup...');
  
  // Cleanup old conversations (older than 30 days)
  // Cleanup old logs
  // etc.
});

// ======================================================
// ERROR HANDLING
// ======================================================

// Global error handler
bot.catch((err, ctx) => {
  logger.error('❌ Bot Error:', err);
  
  const userId = ctx?.from?.id;
  const lang = userId ? getUserLanguage(userId) : 'en';
  
  ctx?.reply(
    lang === 'fa' 
      ? '❌ خطایی رخ داد. لطفاً دوباره تلاش کنید.'
      : '❌ An error occurred. Please try again.'
  ).catch(() => {});
  
  // Notify admins
  for (const adminId of config.bot.adminIds) {
    bot.telegram.sendMessage(
      adminId,
      `❌ **Bot Error**\n\nError: ${err.message}\nUser: ${userId || 'Unknown'}\nTime: ${new Date().toLocaleString()}`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }
});

// Uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  logger.error('❌ Unhandled Rejection:', err);
});

// ======================================================
// START BOT
// ======================================================

async function startBot() {
  try {
    // Set default commands
    await setBotCommands('en');
    
    // Initialize database
    userStats.totalUsers = database.getAllUsers().length;
    ticketStats.total = Object.keys(database.tickets).length;
    ticketStats.open = Object.values(database.tickets).filter(t => t.status === 'open').length;
    
    // Start bot in polling mode
    await bot.launch({
      dropPendingUpdates: true
    });
    
    logger.info('✅ Bot is running in POLLING mode!');
    logger.info(`📊 Version: ${config.bot.version}`);
    logger.info(`📊 Users: ${userStats.totalUsers}`);
    logger.info(`📊 Features: Bilingual, Multi-model, Notes, Favorites, Tickets`);
    logger.info(`📊 Database: ${config.database.mongodb ? 'MongoDB' : 'File-based'}`);
    logger.info(`📊 Redis: ${redisClient ? 'Connected' : 'Not connected'}`);
    
    // Notify admins
    for (const adminId of config.bot.adminIds) {
      bot.telegram.sendMessage(
        adminId,
        `🤖 **Bot Started - Version ${config.bot.version}**\n\n` +
        `Time: ${new Date().toLocaleString()}\n` +
        `Users: ${userStats.totalUsers}\n` +
        `Features: Bilingual, Multi-model, Notes, Favorites, Tickets\n` +
        `Mode: Polling\n` +
        `Database: ${config.database.mongodb ? 'MongoDB' : 'File-based'}`,
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }
    
  } catch (err) {
    logger.error('❌ Failed to start bot:', err);
    
    // Retry after 5 seconds
    logger.info('🔄 Retrying in 5 seconds...');
    setTimeout(startBot, 5000);
  }
}

// Start the bot
startBot();

// Keep process alive
process.stdin.resume();

// Graceful shutdown
process.once('SIGINT', () => {
  logger.info('👋 Shutting down...');
  bot.stop('SIGINT');
  
  // Close database connections
  if (redisClient) redisClient.quit();
  if (mongoose.connection) mongoose.connection.close();
  
  server.close(() => {
    process.exit(0);
  });
});

process.once('SIGTERM', () => {
  logger.info('👋 Shutting down...');
  bot.stop('SIGTERM');
  
  // Close database connections
  if (redisClient) redisClient.quit();
  if (mongoose.connection) mongoose.connection.close();
  
  server.close(() => {
    process.exit(0);
  });
});

// Export for testing
module.exports = { bot, app, database };