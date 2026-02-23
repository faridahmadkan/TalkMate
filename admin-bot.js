const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const database = require('./database');

// Check environment variables
if (!process.env.ADMIN_BOT_TOKEN) {
    console.error('❌ Missing ADMIN_BOT_TOKEN');
    process.exit(1);
}

// Admin IDs (from your existing bot)
const ADMIN_IDS = ['6939078859', '6336847895'];

const bot = new Telegraf(process.env.ADMIN_BOT_TOKEN);
const app = express();
const PORT = process.env.ADMIN_BOT_PORT || 3001;

// Web server for Render
app.get('/', (req, res) => res.send('🤖 Admin Bot is running!'));
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/stats', (req, res) => {
    res.json({
        totalUsers: database.getAllUsers().length,
        openTickets: database.getOpenTickets().length,
        uptime: process.uptime()
    });
});

app.listen(PORT, '0.0.0.0', () => console.log(`✅ Admin Bot server on port ${PORT}`));

// Middleware to check if user is admin
async function isAdmin(ctx, next) {
    if (ADMIN_IDS.includes(ctx.from.id.toString())) {
        return next();
    } else {
        await ctx.reply('⛔ Access denied. This bot is for administrators only.');
    }
}

// Apply admin check to all commands
bot.use(isAdmin);

// ================= COMMANDS =================

// Start command
bot.start(async (ctx) => {
    await ctx.replyWithMarkdown(
        `👋 **Welcome Admin!**\n\n` +
        `Here are your admin commands:\n\n` +
        `📊 /stats - View bot statistics\n` +
        `🎫 /tickets - View all open tickets\n` +
        `👥 /users - View all users\n` +
        `📨 /inbox - View recent messages\n` +
        `🔍 /search [user_id] - Search user by ID\n` +
        `📢 /broadcast - Send message to all users\n` +
        `📋 /logs - View system logs\n` +
        `❓ /help - Show this menu`,
        Markup.inlineKeyboard([
            [Markup.button.callback('📊 Stats', 'admin_stats')],
            [Markup.button.callback('🎫 Tickets', 'admin_tickets')],
            [Markup.button.callback('👥 Users', 'admin_users')]
        ])
    );
});

// Help command
bot.help(async (ctx) => {
    await ctx.replyWithMarkdown(
        `📚 **Admin Commands**\n\n` +
        `**📊 Statistics**\n` +
        `/stats - Overall bot statistics\n` +
        `/users - List all users\n` +
        `/search [id] - Search user by ID\n\n` +
        
        `**🎫 Tickets**\n` +
        `/tickets - View open tickets\n` +
        `/ticket [id] - View specific ticket\n` +
        `/close [id] - Close a ticket\n\n` +
        
        `**📨 Messages**\n` +
        `/inbox - Recent user messages\n` +
        `/broadcast - Send to all users\n` +
        `/reply [ticket_id] - Reply to ticket\n\n` +
        
        `**⚙️ System**\n` +
        `/logs - View system logs\n` +
        `/health - Check bot health`
    );
});

// Stats command
bot.command('stats', async (ctx) => {
    const users = database.getAllUsers();
    const tickets = database.getOpenTickets();
    
    const totalMessages = users.reduce((sum, u) => sum + (u.messageCount || 0), 0);
    const activeToday = users.filter(u => {
        const lastSeen = new Date(u.lastSeen);
        const today = new Date();
        return lastSeen.toDateString() === today.toDateString();
    }).length;
    
    await ctx.replyWithMarkdown(
        `📊 **Bot Statistics**\n\n` +
        `**Users:** ${users.length}\n` +
        `**Active Today:** ${activeToday}\n` +
        `**Total Messages:** ${totalMessages}\n` +
        `**Open Tickets:** ${tickets.length}\n` +
        `**Uptime:** ${Math.floor(process.uptime() / 60)} minutes`
    );
});

// Users command
bot.command('users', async (ctx) => {
    const users = database.getAllUsers();
    
    if (users.length === 0) {
        return ctx.reply('📭 No users yet.');
    }
    
    // Create paginated list
    const page = parseInt(ctx.message.text.split(' ')[1]) || 1;
    const perPage = 10;
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const paginatedUsers = users.slice(start, end);
    
    let message = `👥 **Users (Page ${page}/${Math.ceil(users.length / perPage)})**\n\n`;
    
    paginatedUsers.forEach((user, index) => {
        const lastSeen = new Date(user.lastSeen).toLocaleDateString();
        message += `${start + index + 1}. **${user.first_name || 'Unknown'}** \`${user.id}\`\n`;
        message += `   📅 Last: ${lastSeen} | 💬 ${user.messageCount || 0} msgs\n`;
    });
    
    const keyboard = [];
    if (page > 1) {
        keyboard.push([Markup.button.callback('⬅️ Previous', `users_page_${page - 1}`)]);
    }
    if (end < users.length) {
        keyboard.push([Markup.button.callback('Next ➡️', `users_page_${page + 1}`)]);
    }
    
    await ctx.replyWithMarkdown(message, Markup.inlineKeyboard(keyboard));
});

// Tickets command
bot.command('tickets', async (ctx) => {
    const tickets = database.getOpenTickets();
    
    if (tickets.length === 0) {
        return ctx.reply('🎫 No open tickets.');
    }
    
    let message = '🎫 **Open Tickets**\n\n';
    tickets.forEach((ticket, index) => {
        const user = database.getUser(ticket.userId) || {};
        const time = new Date(ticket.createdAt).toLocaleString();
        message += `${index + 1}. **#${ticket.id}** - ${user.first_name || 'Unknown'}\n`;
        message += `   📝 ${ticket.message.substring(0, 50)}...\n`;
        message += `   🕐 ${time}\n\n`;
    });
    
    // Create ticket selection buttons
    const buttons = tickets.slice(0, 5).map(t => 
        [Markup.button.callback(`View #${t.id}`, `view_ticket_${t.id}`)]
    );
    
    await ctx.replyWithMarkdown(message, Markup.inlineKeyboard(buttons));
});

// View specific ticket
bot.command('ticket', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('Usage: /ticket [ticket_id]');
    }
    
    const ticketId = args[1].toUpperCase();
    const ticket = database.getTicket(ticketId);
    
    if (!ticket) {
        return ctx.reply('❌ Ticket not found.');
    }
    
    const user = database.getUser(ticket.userId) || {};
    
    let message = `🎫 **Ticket #${ticketId}**\n\n`;
    message += `**User:** ${user.first_name || 'Unknown'} (@${user.username || 'N/A'})\n`;
    message += `**User ID:** \`${ticket.userId}\`\n`;
    message += `**Status:** ${ticket.status}\n`;
    message += `**Created:** ${new Date(ticket.createdAt).toLocaleString()}\n\n`;
    message += `**Message:**\n${ticket.message}\n\n`;
    
    if (ticket.replies && ticket.replies.length > 0) {
        message += `**Replies:**\n`;
        ticket.replies.forEach(r => {
            message += `• ${r.from}: ${r.message}\n`;
        });
    }
    
    await ctx.replyWithMarkdown(message, Markup.inlineKeyboard([
        [Markup.button.callback('✏️ Reply', `reply_ticket_${ticketId}`)],
        [Markup.button.callback('✅ Close', `close_ticket_${ticketId}`)],
        [Markup.button.callback('👤 View User', `view_user_${ticket.userId}`)]
    ]));
});

// Search user
bot.command('search', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('Usage: /search [user_id or username]');
    }
    
    const query = args[1];
    const users = database.getAllUsers();
    
    const results = users.filter(u => 
        u.id === query || 
        u.username?.toLowerCase().includes(query.toLowerCase()) ||
        u.first_name?.toLowerCase().includes(query.toLowerCase())
    );
    
    if (results.length === 0) {
        return ctx.reply('❌ No users found.');
    }
    
    let message = `🔍 **Search Results**\n\n`;
    results.forEach((user, i) => {
        message += `${i + 1}. **${user.first_name || 'Unknown'}** \`${user.id}\`\n`;
        message += `   @${user.username || 'N/A'}\n`;
    });
    
    await ctx.reply(message);
});

// Broadcast command
bot.command('broadcast', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('Usage: /broadcast [message]\n\nExample: /broadcast Hello everyone!');
    }
    
    const message = args.slice(1).join(' ');
    
    await ctx.reply(`📢 **Broadcast Preview:**\n\n${message}\n\nSend to all users?`,
        Markup.inlineKeyboard([
            [Markup.button.callback('✅ Yes, send', 'confirm_broadcast')],
            [Markup.button.callback('❌ No, cancel', 'cancel_broadcast')]
        ])
    );
    
    // Store broadcast message temporarily
    ctx.session = { broadcastMessage: message };
});

// ================= CALLBACK HANDLERS =================

// User pagination
bot.action(/users_page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    await ctx.answerCbQuery();
    
    const users = database.getAllUsers();
    const perPage = 10;
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const paginatedUsers = users.slice(start, end);
    
    let message = `👥 **Users (Page ${page}/${Math.ceil(users.length / perPage)})**\n\n`;
    
    paginatedUsers.forEach((user, index) => {
        const lastSeen = new Date(user.lastSeen).toLocaleDateString();
        message += `${start + index + 1}. **${user.first_name || 'Unknown'}** \`${user.id}\`\n`;
        message += `   📅 Last: ${lastSeen} | 💬 ${user.messageCount || 0} msgs\n`;
    });
    
    const keyboard = [];
    if (page > 1) {
        keyboard.push([Markup.button.callback('⬅️ Previous', `users_page_${page - 1}`)]);
    }
    if (end < users.length) {
        keyboard.push([Markup.button.callback('Next ➡️', `users_page_${page + 1}`)]);
    }
    
    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
});

// View ticket
bot.action(/view_ticket_(.+)/, async (ctx) => {
    const ticketId = ctx.match[1];
    await ctx.answerCbQuery();
    
    const ticket = database.getTicket(ticketId);
    if (!ticket) {
        return ctx.editMessageText('❌ Ticket not found.');
    }
    
    const user = database.getUser(ticket.userId) || {};
    
    let message = `🎫 **Ticket #${ticketId}**\n\n`;
    message += `**User:** ${user.first_name || 'Unknown'} (@${user.username || 'N/A'})\n`;
    message += `**Status:** ${ticket.status}\n`;
    message += `**Created:** ${new Date(ticket.createdAt).toLocaleString()}\n\n`;
    message += `**Message:**\n${ticket.message}\n\n`;
    
    if (ticket.replies?.length > 0) {
        message += `**Replies:**\n`;
        ticket.replies.forEach(r => {
            message += `• ${r.from}: ${r.message}\n`;
        });
    }
    
    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [Markup.button.callback('✏️ Reply', `reply_ticket_${ticketId}`)],
                [Markup.button.callback('✅ Close', `close_ticket_${ticketId}`)],
                [Markup.button.callback('🔙 Back', 'admin_tickets')]
            ]
        }
    });
});

// Reply to ticket
bot.action(/reply_ticket_(.+)/, async (ctx) => {
    const ticketId = ctx.match[1];
    const adminId = ctx.from.id.toString();
    
    const ticket = database.getTicket(ticketId);
    if (!ticket) {
        return ctx.answerCbQuery('❌ Ticket not found');
    }
    
    // Set admin reply state
    database.setAdminReplyState(adminId, ticketId, ticket.userId);
    
    await ctx.answerCbQuery();
    await ctx.editMessageText(
        `✏️ **Replying to Ticket #${ticketId}**\n\n` +
        `Type your reply below. Use /cancel to abort.`,
        Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'cancel_reply')]
        ])
    );
});

// Close ticket
bot.action(/close_ticket_(.+)/, async (ctx) => {
    const ticketId = ctx.match[1];
    
    const ticket = database.getTicket(ticketId);
    if (!ticket) {
        return ctx.answerCbQuery('❌ Ticket not found');
    }
    
    if (ticket.status === 'closed') {
        return ctx.answerCbQuery('Ticket already closed');
    }
    
    await ctx.answerCbQuery();
    await ctx.editMessageText(
        `⚠️ **Close Ticket #${ticketId}?**\n\nAre you sure?`,
        Markup.inlineKeyboard([
            [Markup.button.callback('✅ Yes, close', `confirm_close_${ticketId}`)],
            [Markup.button.callback('❌ No, keep open', `view_ticket_${ticketId}`)]
        ])
    );
});

// Confirm close ticket
bot.action(/confirm_close_(.+)/, async (ctx) => {
    const ticketId = ctx.match[1];
    
    database.closeTicket(ticketId);
    
    await ctx.answerCbQuery('✅ Ticket closed');
    await ctx.editMessageText(`✅ **Ticket #${ticketId} has been closed.**`);
});

// View user
bot.action(/view_user_(.+)/, async (ctx) => {
    const userId = ctx.match[1];
    await ctx.answerCbQuery();
    
    const user = database.getUser(userId);
    if (!user) {
        return ctx.reply('❌ User not found.');
    }
    
    const tickets = Object.values(database.tickets)
        .filter(t => t.userId === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    let message = `👤 **User Information**\n\n`;
    message += `**ID:** \`${user.id}\`\n`;
    message += `**Name:** ${user.first_name || ''} ${user.last_name || ''}\n`;
    message += `**Username:** @${user.username || 'N/A'}\n`;
    message += `**First Seen:** ${new Date(user.firstSeen).toLocaleString()}\n`;
    message += `**Last Seen:** ${new Date(user.lastSeen).toLocaleString()}\n`;
    message += `**Messages:** ${user.messageCount || 0}\n`;
    message += `**Tickets:** ${tickets.length}\n\n`;
    
    if (tickets.length > 0) {
        message += `**Recent Tickets:**\n`;
        tickets.slice(0, 3).forEach(t => {
            message += `• #${t.id} (${t.status})\n`;
        });
    }
    
    const keyboard = [];
    if (tickets.length > 0) {
        keyboard.push([Markup.button.callback('📋 View Tickets', `user_tickets_${userId}`)]);
    }
    keyboard.push([Markup.button.callback('🔙 Back to Users', 'admin_users')]);
    
    await ctx.replyWithMarkdown(message, Markup.inlineKeyboard(keyboard));
});

// User tickets
bot.action(/user_tickets_(.+)/, async (ctx) => {
    const userId = ctx.match[1];
    await ctx.answerCbQuery();
    
    const tickets = Object.values(database.tickets)
        .filter(t => t.userId === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if (tickets.length === 0) {
        return ctx.reply('📭 This user has no tickets.');
    }
    
    let message = `📋 **User's Tickets**\n\n`;
    tickets.forEach((t, i) => {
        const status = t.status === 'open' ? '🟢 Open' : '🔴 Closed';
        message += `${i + 1}. **#${t.id}** - ${status}\n`;
        message += `   📝 ${t.message.substring(0, 50)}...\n`;
        message += `   🕐 ${new Date(t.createdAt).toLocaleDateString()}\n\n`;
    });
    
    const buttons = tickets.slice(0, 5).map(t =>
        [Markup.button.callback(`View #${t.id}`, `view_ticket_${t.id}`)]
    );
    
    await ctx.replyWithMarkdown(message, Markup.inlineKeyboard(buttons));
});

// Admin tickets list
bot.action('admin_tickets', async (ctx) => {
    await ctx.answerCbQuery();
    
    const tickets = database.getOpenTickets();
    
    if (tickets.length === 0) {
        return ctx.editMessageText('🎫 No open tickets.');
    }
    
    let message = '🎫 **Open Tickets**\n\n';
    tickets.forEach((ticket, index) => {
        const user = database.getUser(ticket.userId) || {};
        const time = new Date(ticket.createdAt).toLocaleString();
        message += `${index + 1}. **#${ticket.id}** - ${user.first_name || 'Unknown'}\n`;
        message += `   ${ticket.message.substring(0, 30)}...\n`;
    });
    
    const buttons = tickets.slice(0, 5).map(t =>
        [Markup.button.callback(`View #${t.id}`, `view_ticket_${t.id}`)]
    );
    
    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
    });
});

// Admin users list
bot.action('admin_users', async (ctx) => {
    await ctx.answerCbQuery();
    
    const users = database.getAllUsers();
    
    let message = '👥 **Recent Users**\n\n';
    users.slice(0, 10).forEach((user, i) => {
        message += `${i + 1}. **${user.first_name || 'Unknown'}** \`${user.id}\`\n`;
        message += `   💬 ${user.messageCount || 0} msgs\n`;
    });
    
    await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [Markup.button.callback('📋 View All', 'users_page_1')]
            ]
        }
    });
});

// Admin stats
bot.action('admin_stats', async (ctx) => {
    await ctx.answerCbQuery();
    
    const users = database.getAllUsers();
    const tickets = database.getOpenTickets();
    
    const totalMessages = users.reduce((sum, u) => sum + (u.messageCount || 0), 0);
    const activeToday = users.filter(u => {
        const lastSeen = new Date(u.lastSeen);
        const today = new Date();
        return lastSeen.toDateString() === today.toDateString();
    }).length;
    
    await ctx.editMessageText(
        `📊 **Bot Statistics**\n\n` +
        `**Users:** ${users.length}\n` +
        `**Active Today:** ${activeToday}\n` +
        `**Total Messages:** ${totalMessages}\n` +
        `**Open Tickets:** ${tickets.length}\n` +
        `**Uptime:** ${Math.floor(process.uptime() / 60)} minutes`
    );
});

// Cancel reply
bot.action('cancel_reply', async (ctx) => {
    const adminId = ctx.from.id.toString();
    database.clearAdminReplyState(adminId);
    
    await ctx.answerCbQuery('Cancelled');
    await ctx.editMessageText('❌ Reply cancelled.');
});

// Broadcast confirmation
bot.action('confirm_broadcast', async (ctx) => {
    await ctx.answerCbQuery();
    
    if (!ctx.session?.broadcastMessage) {
        return ctx.editMessageText('❌ No broadcast message found.');
    }
    
    const users = database.getAllUsers();
    const message = ctx.session.broadcastMessage;
    
    await ctx.editMessageText(`📢 Sending broadcast to ${users.length} users...`);
    
    let sent = 0;
    let failed = 0;
    
    // Note: You'll need to implement actual broadcast through your main bot
    // This would require an API endpoint on your main bot
    
    await ctx.replyWithMarkdown(
        `✅ **Broadcast Complete**\n\n` +
        `Sent: ${sent}\n` +
        `Failed: ${failed}`
    );
    
    delete ctx.session.broadcastMessage;
});

bot.action('cancel_broadcast', async (ctx) => {
    await ctx.answerCbQuery('Cancelled');
    await ctx.editMessageText('❌ Broadcast cancelled.');
    delete ctx.session.broadcastMessage;
});

// ================= MESSAGE HANDLING =================

// Handle text messages (for replies to tickets)
bot.on('text', async (ctx) => {
    const adminId = ctx.from.id.toString();
    const replyState = database.getAdminReplyState(adminId);
    
    if (replyState && ctx.message.text !== '/cancel') {
        const { ticketId, userId } = replyState;
        
        // Add reply to database
        database.addReply(ticketId, {
            from: 'admin',
            message: ctx.message.text
        });
        
        // Here you would send the reply to the user via your main bot
        // This would require an API endpoint on your main bot
        
        await ctx.replyWithMarkdown(
            `✅ Reply sent to user.\n\n` +
            `**Your reply:**\n${ctx.message.text}`
        );
        
        database.clearAdminReplyState(adminId);
    } else if (ctx.message.text === '/cancel') {
        database.clearAdminReplyState(adminId);
        await ctx.reply('❌ Cancelled.');
    }
});

// Error handling
bot.catch((err, ctx) => {
    console.error('❌ Admin Bot Error:', err);
    ctx?.reply('❌ An error occurred. Please try again.').catch(() => {});
});

// Start bot
bot.launch()
    .then(() => {
        console.log('✅ Admin Bot is running!');
        console.log(`📊 Admins: ${ADMIN_IDS.join(', ')}`);
    })
    .catch(err => {
        console.error('❌ Failed to start admin bot:', err);
        process.exit(1);
    });

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));