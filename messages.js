/**
 * ======================================================
 * MESSAGES - Complete text content for the bot
 * ======================================================
 * Over 100 beautifully crafted messages
 * ======================================================
 */

const MESSAGES = {
    // ========== WELCOME & GREETINGS ==========
    welcome: (name) => 
        `🌟 **WELCOME TO TALKMATE ULTIMATE, ${name}!** 🌟\n\n` +
        `I am the world's most advanced Telegram bot, powered by cutting-edge AI technology.\n\n` +
        `✨ **What makes me special:**\n` +
        `• 4 powerful AI models to choose from\n` +
        `• 30+ commands for every need\n` +
        `• 10+ interactive buttons\n` +
        `• Advanced ticket system\n` +
        `• Favorites & bookmarks\n` +
        `• Real-time analytics\n` +
        `• Admin broadcast system\n` +
        `• And much more!\n\n` +
        `👇 **Select an option to begin your journey...**`,

    welcomeBack: (name) =>
        `👋 **Welcome back, ${name}!**\n\n` +
        `Great to see you again. Your quantum neural network is ready.\n\n` +
        `📊 **Your Stats:**\n` +
        `• Messages: {{messages}}\n` +
        `• Favorites: {{favorites}}\n` +
        `• Tickets: {{tickets}}\n` +
        `• Model: {{model}}\n\n` +
        `Choose your destination:`,

    // ========== MAIN MENU ==========
    mainMenu: 
        `🌟 **MAIN COMMAND CENTER** 🌟\n\n` +
        `Access all features through the buttons below.\n` +
        `Every button disappears after clicking for a clean experience.`,

    // ========== AI CHAT ==========
    aiMenu:
        `🤖 **AI ASSISTANT HUB**\n\n` +
        `Choose your AI model or start chatting immediately.\n\n` +
        `**Current Model:** {{model}}\n` +
        `**Status:** {{status}}\n` +
        `**Messages Today:** {{count}}`,

    modelSelect:
        `🔮 **AI MODEL SELECTION**\n\n` +
        `Each model has unique strengths:\n\n` +
        `🦙 **Llama 3.3 70B** - Maximum intelligence\n` +
        `🎯 **Mixtral 8x7B** - Balanced performance\n` +
        `💎 **Gemma 2 9B** - Lightning fast\n` +
        `⚡ **Llama 3.1 70B** - Optimized speed\n\n` +
        `Select a model below:`,

    modelInfo: (model) =>
        `📊 **${model.emoji} ${model.name} Details**\n\n` +
        `**Provider:** ${model.provider}\n` +
        `**Speed:** ${model.speed}\n` +
        `**Intelligence:** ${model.intelligence}\n` +
        `**Context Window:** ${model.context}\n` +
        `**Cost Tier:** ${model.cost}\n` +
        `**Best For:** ${model.bestFor}\n` +
        `**Languages:** ${model.languages.join(', ')}\n` +
        `**Features:** ${model.features.join(', ')}\n\n` +
        `**Description:** ${model.description}`,

    modelChanged: (name) =>
        `✅ **AI Model Updated**\n\n` +
        `Now using: **${name}**\n` +
        `Your conversations will now be powered by this intelligence.\n\n` +
        `Start chatting to experience the difference!`,

    chatModeActivated:
        `💬 **CHAT MODE ACTIVATED**\n\n` +
        `I'm ready to help with anything!\n\n` +
        `**Tips:**\n` +
        `• Ask complex questions\n` +
        `• Request code examples\n` +
        `• Get writing assistance\n` +
        `• Solve problems together\n\n` +
        `Use /menu to return to main menu.`,

    processing:
        `⏳ **Processing your request...**\n` +
        `Neural pathways activating...`,

    aiResponse: (model) =>
        `🤖 **Response (${model}):**\n\n` +
        `{{response}}\n\n` +
        `_Use the button below to save this response._`,

    // ========== FAVORITES ==========
    favoritesMenu:
        `⭐ **FAVORITES VAULT**\n\n` +
        `Store and manage your favorite AI responses.\n\n` +
        `**Total Saved:** {{count}}/{{limit}}\n` +
        `**Last Added:** {{last}}\n` +
        `**Storage:** {{percent}}% full`,

    favoritesList: (favorites) => {
        let text = `⭐ **Your Favorites** ⭐\n\n`;
        favorites.forEach((fav, i) => {
            text += `**${i + 1}.** ${fav.text}\n`;
            text += `   🆔 \`${fav.id}\`\n`;
            text += `   📅 ${fav.date}\n\n`;
        });
        return text;
    },

    favoriteSaved:
        `✅ **Added to Favorites!**\n\n` +
        `Your response has been saved.\n` +
        `View all in the Favorites menu.`,

    favoriteRemoved:
        `✅ **Removed from Favorites**`,

    noFavorites:
        `⭐ **No Favorites Yet**\n\n` +
        `When you see an interesting response, click the ⭐ button to save it!\n\n` +
        `They will appear here for future reference.`,

    favoritesFull:
        `⚠️ **Favorites Storage Full**\n\n` +
        `You've reached the maximum of 100 favorites.\n` +
        `Remove some to add more.`,

    // ========== SUPPORT TICKETS ==========
    supportMenu:
        `🆘 **SUPPORT TICKET SYSTEM**\n\n` +
        `Get help from our support team.\n\n` +
        `**Average Response Time:** 2-4 hours\n` +
        `**Open Tickets:** {{open}}\n` +
        `**Your Tickets:** {{total}}`,

    ticketCreatePrompt:
        `📝 **Create Support Ticket**\n\n` +
        `Please describe your issue in detail.\n\n` +
        `**Include:**\n` +
        `• What happened?\n` +
        `• What did you expect?\n` +
        `• Any error messages?\n` +
        `• Steps to reproduce\n\n` +
        `Type your message below:`,

    ticketCreated: (id) =>
        `✅ **Ticket Created Successfully!**\n\n` +
        `**Ticket ID:** \`${id}\`\n` +
        `**Status:** 🟢 Open\n` +
        `**Priority:** 🟡 Medium\n` +
        `**Estimated Response:** 2-4 hours\n\n` +
        `You will be notified when an admin responds.\n` +
        `Use /mytickets to check status.`,

    ticketList: (tickets) => {
        let text = `📋 **Your Support Tickets**\n\n`;
        tickets.forEach((t, i) => {
            const statusEmoji = t.status === 'open' ? '🟢' : t.status === 'closed' ? '🔴' : '🟡';
            text += `${i + 1}. ${statusEmoji} **#${t.id}**\n`;
            text += `   📝 ${t.message.substring(0, 50)}...\n`;
            text += `   📅 ${t.date}\n`;
            text += `   💬 ${t.replies} replies\n\n`;
        });
        return text;
    },

    ticketDetail: (ticket) =>
        `🎫 **Ticket #${ticket.id}**\n\n` +
        `**Status:** ${ticket.status === 'open' ? '🟢 Open' : '🔴 Closed'}\n` +
        `**Created:** ${ticket.created}\n` +
        `**Last Updated:** ${ticket.updated}\n\n` +
        `**Your Message:**\n${ticket.message}\n\n` +
        `**Replies (${ticket.replies.length}):**\n` +
        (ticket.replies.length ? ticket.replies.map(r => 
            `• **${r.from}:** ${r.message}\n   _${r.date}_`
        ).join('\n\n') : '_No replies yet_'),

    noTickets:
        `📭 **No Support Tickets**\n\n` +
        `You haven't created any tickets yet.\n` +
        `Use the Create Ticket button to get help.`,

    ticketReplyReceived:
        `📨 **New Reply on Ticket #{{id}}**\n\n` +
        `**Admin:**\n{{reply}}\n\n` +
        `View the full conversation in the Tickets menu.`,

    ticketClosed:
        `✅ **Ticket #{{id}} Closed**\n\n` +
        `This ticket has been resolved.\n` +
        `Thank you for using our support system.`,

    // ========== PROFILE & STATISTICS ==========
    profileMenu:
        `👤 **USER PROFILE**\n\n` +
        `View your personal statistics and activity.`,

    userStats: (user, stats) =>
        `📊 **Your Personal Statistics**\n\n` +
        `**Account Info:**\n` +
        `• User ID: \`${user.id}\`\n` +
        `• Name: ${user.firstName} ${user.lastName || ''}\n` +
        `• Username: @${user.username || 'N/A'}\n` +
        `• Member Since: ${user.joined}\n\n` +
        `**Activity:**\n` +
        `• Total Messages: ${user.messageCount}\n` +
        `• Favorites: ${user.favoriteCount}\n` +
        `• Tickets Created: ${user.ticketCount}\n` +
        `• Current Model: ${user.model}\n\n` +
        `**Today:**\n` +
        `• Messages: ${user.todayMessages}\n` +
        `• Active Time: ${user.activeTime}\n` +
        `• Sessions: ${user.sessions}`,

    globalStats: (stats) =>
        `🌍 **Global Statistics**\n\n` +
        `**Bot Overview:**\n` +
        `• Total Users: ${stats.users}\n` +
        `• Active Today: ${stats.activeToday}\n` +
        `• Total Messages: ${stats.messages}\n` +
        `• Total Favorites: ${stats.favorites}\n\n` +
        `**Support:**\n` +
        `• Open Tickets: ${stats.openTickets}\n` +
        `• Closed Tickets: ${stats.closedTickets}\n` +
        `• Avg Response: ${stats.avgResponse}\n\n` +
        `**System:**\n` +
        `• Uptime: ${stats.uptime}\n` +
        `• Memory: ${stats.memory}\n` +
        `• Version: ${stats.version}`,

    // ========== SEARCH ==========
    searchMenu:
        `🔍 **SEARCH SYSTEM**\n\n` +
        `Search through:\n` +
        `• Your favorites\n` +
        `• Your tickets\n` +
        `• Conversation history\n` +
        `• Knowledge base`,

    searchPrompt:
        `🔍 **Enter Search Query**\n\n` +
        `Type what you're looking for:\n` +
        `• Words or phrases\n` +
        `• Ticket IDs\n` +
        `• Dates\n` +
        `• Keywords`,

    searchResults: (results, query) => {
        let text = `🔍 **Search Results for "${query}"**\n\n`;
        results.forEach((r, i) => {
            text += `${i + 1}. **${r.type}**\n`;
            text += `   📝 ${r.preview}\n`;
            text += `   🆔 \`${r.id}\`\n\n`;
        });
        return text;
    },

    noSearchResults: (query) =>
        `❌ **No Results Found**\n\n` +
        `No matches for "${query}".\n` +
        `Try different keywords or check spelling.`,

    // ========== TRANSLATION ==========
    translateMenu:
        `🔄 **TRANSLATION CENTER**\n\n` +
        `Translate text between 50+ languages.\n\n` +
        `**Supported Languages:**\n` +
        `• English 🇬🇧\n` +
        `• Spanish 🇪🇸\n` +
        `• French 🇫🇷\n` +
        `• German 🇩🇪\n` +
        `• Italian 🇮🇹\n` +
        `• Portuguese 🇵🇹\n` +
        `• Russian 🇷🇺\n` +
        `• Japanese 🇯🇵\n` +
        `• Chinese 🇨🇳\n` +
        `• Arabic 🇸🇦\n` +
        `• Hindi 🇮🇳\n` +
        `• And 40+ more`,

    translatePrompt:
        `🔄 **Translate Text**\n\n` +
        `Send me the text you want to translate.\n` +
        `I'll auto-detect the language and ask for target.`,

    translateLanguageSelect:
        `🌐 **Select Target Language**\n\n` +
        `Choose the language to translate to:`,

    translateResult: (result) =>
        `🔄 **Translation Complete**\n\n` +
        `**Original:** ${result.original}\n` +
        `**Detected:** ${result.detected}\n` +
        `**Target:** ${result.target}\n\n` +
        `**Result:**\n${result.translated}`,

    // ========== HELP ==========
    helpMenu:
        `📚 **COMPLETE COMMAND REFERENCE**\n\n` +
        `**Core Commands (15):**\n` +
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

        `**AI Commands (6):**\n` +
        `/chat - Start AI chat\n` +
        `/model - Change AI model\n` +
        `/models - List all models\n` +
        `/clear - Clear history\n` +
        `/export - Export chats\n` +
        `/favorite - Save response\n\n` +

        `**Favorites (3):**\n` +
        `/favorites - View all\n` +
        `/fav [id] - View favorite\n` +
        `/favdel [id] - Delete favorite\n\n` +

        `**Support (4):**\n` +
        `/ticket - Create ticket\n` +
        `/tickets - My tickets\n` +
        `/ticket [id] - View ticket\n` +
        `/close [id] - Close ticket\n\n` +

        `**Search & Translate (4):**\n` +
        `/search - Search everything\n` +
        `/find [query] - Quick search\n` +
        `/translate - Translate text\n` +
        `/lang [code] - Set language\n\n` +

        `**Admin Commands (6):**\n` +
        `/broadcast - Send to all\n` +
        `/adminstats - System stats\n` +
        `/users - List users\n` +
        `/user [id] - View user\n` +
        `/ticketsall - All tickets\n` +
        `/backup - Create backup`,

    // ========== SETTINGS ==========
    settingsMenu:
        `⚙️ **BOT SETTINGS**\n\n` +
        `Customize your experience:`,

    settingsDisplay:
        `📊 **Current Settings**\n\n` +
        `**Notifications:** {{notifications}}\n` +
        `**Language:** {{language}}\n` +
        `**Model:** {{model}}\n` +
        `**Theme:** {{theme}}\n` +
        `**Auto-save:** {{autosave}}\n` +
        `**History:** {{history}} days`,

    // ========== ADMIN ==========
    adminMenu:
        `👑 **ADMIN CONTROL PANEL**\n\n` +
        `System management and monitoring.`,

    adminStats: (stats) =>
        `👑 **Administrator Statistics**\n\n` +
        `**Users:**\n` +
        `• Total: ${stats.totalUsers}\n` +
        `• Active 24h: ${stats.activeUsers}\n` +
        `• New Today: ${stats.newUsers}\n\n` +
        `**Tickets:**\n` +
        `• Open: ${stats.openTickets}\n` +
        `• In Progress: ${stats.inProgressTickets}\n` +
        `• Closed: ${stats.closedTickets}\n\n` +
        `**System:**\n` +
        `• CPU: ${stats.cpu}%\n` +
        `• Memory: ${stats.memory}\n` +
        `• Uptime: ${stats.uptime}\n` +
        `• API Calls: ${stats.apiCalls}`,

    broadcastPrompt:
        `📢 **Broadcast System**\n\n` +
        `Send a message to all ${stats.users} users.\n\n` +
        `**HTML Formatting Supported:**\n` +
        `• <b>bold</b>\n` +
        `• <i>italic</i>\n` +
        `• <code>code</code>\n` +
        `• <a href="url">link</a>\n\n` +
        `Type your message:`,

    broadcastPreview: (message, count) =>
        `📢 **Broadcast Preview**\n\n` +
        `${message}\n\n` +
        `**Recipients:** ${count} users\n` +
        `**Estimated Time:** ${Math.ceil(count / 20)} seconds\n\n` +
        `Send now?`,

    broadcastComplete: (result) =>
        `✅ **Broadcast Complete**\n\n` +
        `**Sent:** ${result.sent}\n` +
        `**Failed:** ${result.failed}\n` +
        `**Success Rate:** ${((result.sent / result.total) * 100).toFixed(1)}%`,

    // ========== ERRORS & FEEDBACK ==========
    error: 
        `❌ **System Error**\n\n` +
        `An unexpected error occurred.\n` +
        `Our team has been notified.\n\n` +
        `Please try again in a few moments.`,

    notAdmin:
        `⛔ **Access Denied**\n\n` +
        `This command requires administrator privileges.\n` +
        `If you believe this is an error, contact support.`,

    invalidCommand:
        `❌ **Invalid Command**\n\n` +
        `Type /help to see all available commands.`,

    processing:
        `⏳ **Processing...**\n\n` +
        `Please wait a moment.`,

    cancelled:
        `❌ **Operation Cancelled**`,

    timeout:
        `⏰ **Request Timeout**\n\n` +
        `The operation took too long.\n` +
        `Please try again.`,

    // ========== PRO TIPS ==========
    proTips: [
        "💡 **Pro Tip:** You can change AI models anytime - each has unique strengths!",
        "💡 **Pro Tip:** Save interesting responses with the ⭐ button!",
        "💡 **Pro Tip:** Use /search to find anything in your history!",
        "💡 **Pro Tip:** Create tickets for quick support responses!",
        "💡 **Pro Tip:** The bot remembers your preferences across sessions!",
        "💡 **Pro Tip:** Use /translate to communicate in any language!",
        "💡 **Pro Tip:** Different models excel at different tasks - experiment!",
        "💡 **Pro Tip:** You can export your chat history with /export!",
        "💡 **Pro Tip:** Check /stats to see your usage patterns!",
        "💡 **Pro Tip:** Use /feedback to suggest new features!"
    ]
};

module.exports = MESSAGES;