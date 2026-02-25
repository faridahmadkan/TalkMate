/**
 * ======================================================
 * KEYBOARDS - All interactive buttons (15+ keyboards)
 * ======================================================
 * Every button disappears after clicking for clean UI
 * ======================================================
 */

const { Markup } = require('telegraf');

const KEYBOARDS = {
    // ========== MAIN MENU (8 buttons) ==========
    mainMenu: Markup.inlineKeyboard([
        [Markup.button.callback('🤖 AI CHAT', 'menu_ai')],
        [Markup.button.callback('⭐ FAVORITES', 'menu_favorites'),
         Markup.button.callback('🆘 SUPPORT', 'menu_support')],
        [Markup.button.callback('👤 PROFILE', 'menu_profile'),
         Markup.button.callback('🔍 SEARCH', 'menu_search')],
        [Markup.button.callback('🔄 TRANSLATE', 'menu_translate'),
         Markup.button.callback('⚙️ SETTINGS', 'menu_settings')],
        [Markup.button.callback('📚 HELP', 'menu_help'),
         Markup.button.callback('ℹ️ ABOUT', 'menu_about')]
    ]),

    // ========== AI MENU (6 buttons) ==========
    aiMenu: (currentModel) => Markup.inlineKeyboard([
        [Markup.button.callback('💬 START CHAT', 'chat_start')],
        [Markup.button.callback('🦙 CHANGE MODEL', 'menu_models')],
        [Markup.button.callback('📊 MODEL INFO', `model_info_${currentModel}`)],
        [Markup.button.callback('🗑️ CLEAR HISTORY', 'chat_clear')],
        [Markup.button.callback('📤 EXPORT CHATS', 'chat_export')],
        [Markup.button.callback('🔙 MAIN MENU', 'menu_main')]
    ]),

    // ========== MODEL SELECTION (8 buttons) ==========
    modelMenu: Markup.inlineKeyboard([
        [Markup.button.callback('🦙 Llama 3.3 70B', 'model_llama33'),
         Markup.button.callback('🎯 Mixtral 8x7B', 'model_mixtral')],
        [Markup.button.callback('💎 Gemma 2 9B', 'model_gemma2'),
         Markup.button.callback('⚡ Fast Response', 'model_fast')],
        [Markup.button.callback('📊 COMPARE MODELS', 'models_compare')],
        [Markup.button.callback('🔙 BACK TO AI', 'menu_ai')]
    ]),

    // ========== FAVORITES MENU (5 buttons) ==========
    favoritesMenu: (hasFavorites) => Markup.inlineKeyboard([
        [Markup.button.callback('📋 VIEW ALL', 'fav_view')],
        ...(hasFavorites ? [
            [Markup.button.callback('🗑️ CLEAR ALL', 'fav_clear')],
            [Markup.button.callback('📤 EXPORT', 'fav_export')]
        ] : []),
        [Markup.button.callback('🔙 MAIN MENU', 'menu_main')]
    ]),

    // ========== SUPPORT MENU (6 buttons) ==========
    supportMenu: Markup.inlineKeyboard([
        [Markup.button.callback('📝 CREATE TICKET', 'ticket_create')],
        [Markup.button.callback('📋 MY TICKETS', 'ticket_list')],
        [Markup.button.callback('❓ FAQ', 'support_faq')],
        [Markup.button.callback('📞 CONTACT', 'support_contact')],
        [Markup.button.callback('📊 TICKET STATUS', 'ticket_status')],
        [Markup.button.callback('🔙 MAIN MENU', 'menu_main')]
    ]),

    // ========== TICKET DETAIL MENU (5 buttons) ==========
    ticketMenu: (ticketId, isOpen) => Markup.inlineKeyboard([
        ...(isOpen ? [
            [Markup.button.callback('✏️ ADD REPLY', `ticket_reply_${ticketId}`)],
            [Markup.button.callback('✅ CLOSE TICKET', `ticket_close_${ticketId}`)]
        ] : [
            [Markup.button.callback('🔄 REOPEN', `ticket_reopen_${ticketId}`)]
        ]),
        [Markup.button.callback('📋 VIEW ALL', 'ticket_list')],
        [Markup.button.callback('🔙 BACK', 'support_menu')]
    ]),

    // ========== PROFILE MENU (6 buttons) ==========
    profileMenu: Markup.inlineKeyboard([
        [Markup.button.callback('📊 MY STATS', 'profile_stats')],
        [Markup.button.callback('📈 ACTIVITY', 'profile_activity')],
        [Markup.button.callback('🏆 ACHIEVEMENTS', 'profile_achievements')],
        [Markup.button.callback('⚙️ PREFERENCES', 'profile_preferences')],
        [Markup.button.callback('📤 EXPORT DATA', 'profile_export')],
        [Markup.button.callback('🔙 MAIN MENU', 'menu_main')]
    ]),

    // ========== SEARCH MENU (5 buttons) ==========
    searchMenu: Markup.inlineKeyboard([
        [Markup.button.callback('🔍 SEARCH FAVORITES', 'search_favorites')],
        [Markup.button.callback('🔍 SEARCH TICKETS', 'search_tickets')],
        [Markup.button.callback('🔍 SEARCH HISTORY', 'search_history')],
        [Markup.button.callback('🔍 ADVANCED SEARCH', 'search_advanced')],
        [Markup.button.callback('🔙 MAIN MENU', 'menu_main')]
    ]),

    // ========== TRANSLATE MENU (12 buttons) ==========
    translateMenu: Markup.inlineKeyboard([
        [Markup.button.callback('🇬🇧 English', 'translate_en'),
         Markup.button.callback('🇪🇸 Spanish', 'translate_es')],
        [Markup.button.callback('🇫🇷 French', 'translate_fr'),
         Markup.button.callback('🇩🇪 German', 'translate_de')],
        [Markup.button.callback('🇮🇹 Italian', 'translate_it'),
         Markup.button.callback('🇵🇹 Portuguese', 'translate_pt')],
        [Markup.button.callback('🇷🇺 Russian', 'translate_ru'),
         Markup.button.callback('🇯🇵 Japanese', 'translate_ja')],
        [Markup.button.callback('🇨🇳 Chinese', 'translate_zh'),
         Markup.button.callback('🇸🇦 Arabic', 'translate_ar')],
        [Markup.button.callback('🇮🇳 Hindi', 'translate_hi'),
         Markup.button.callback('🌐 MORE', 'translate_more')],
        [Markup.button.callback('🔙 MAIN MENU', 'menu_main')]
    ]),

    // ========== SETTINGS MENU (8 buttons) ==========
    settingsMenu: Markup.inlineKeyboard([
        [Markup.button.callback('🔔 NOTIFICATIONS', 'settings_notifications')],
        [Markup.button.callback('🌐 LANGUAGE', 'settings_language')],
        [Markup.button.callback('🎨 THEME', 'settings_theme')],
        [Markup.button.callback('💾 AUTO-SAVE', 'settings_autosave')],
        [Markup.button.callback('📊 HISTORY', 'settings_history')],
        [Markup.button.callback('🔒 PRIVACY', 'settings_privacy')],
        [Markup.button.callback('🔄 RESET', 'settings_reset')],
        [Markup.button.callback('🔙 MAIN MENU', 'menu_main')]
    ]),

    // ========== HELP MENU (6 buttons) ==========
    helpMenu: Markup.inlineKeyboard([
        [Markup.button.callback('📚 ALL COMMANDS', 'help_commands')],
        [Markup.button.callback('❓ FAQ', 'help_faq')],
        [Markup.button.callback('🎓 TUTORIAL', 'help_tutorial')],
        [Markup.button.callback('💡 TIPS', 'help_tips')],
        [Markup.button.callback('📞 CONTACT', 'help_contact')],
        [Markup.button.callback('🔙 MAIN MENU', 'menu_main')]
    ]),

    // ========== ADMIN MENU (8 buttons) ==========
    adminMenu: Markup.inlineKeyboard([
        [Markup.button.callback('📊 SYSTEM STATS', 'admin_stats')],
        [Markup.button.callback('👥 USER MANAGEMENT', 'admin_users')],
        [Markup.button.callback('🎫 ALL TICKETS', 'admin_tickets')],
        [Markup.button.callback('📢 BROADCAST', 'admin_broadcast')],
        [Markup.button.callback('💾 BACKUP', 'admin_backup')],
        [Markup.button.callback('📋 LOGS', 'admin_logs')],
        [Markup.button.callback('⚙️ CONFIG', 'admin_config')],
        [Markup.button.callback('🔙 MAIN MENU', 'menu_main')]
    ]),

    // ========== USER MANAGEMENT MENU (6 buttons) ==========
    userManagementMenu: Markup.inlineKeyboard([
        [Markup.button.callback('📋 LIST USERS', 'users_list')],
        [Markup.button.callback('🔍 SEARCH USERS', 'users_search')],
        [Markup.button.callback('📊 USER STATS', 'users_stats')],
        [Markup.button.callback('🚫 BAN USER', 'users_ban')],
        [Markup.button.callback('✅ UNBAN', 'users_unban')],
        [Markup.button.callback('🔙 BACK', 'admin_menu')]
    ]),

    // ========== CONFIRMATION MENUS (4 buttons) ==========
    confirmClear: (type) => Markup.inlineKeyboard([
        [Markup.button.callback('✅ YES, CLEAR', `confirm_${type}_yes`)],
        [Markup.button.callback('❌ NO, CANCEL', `confirm_${type}_no`)]
    ]),

    confirmBroadcast: Markup.inlineKeyboard([
        [Markup.button.callback('✅ SEND NOW', 'broadcast_confirm')],
        [Markup.button.callback('✏️ EDIT', 'broadcast_edit')],
        [Markup.button.callback('❌ CANCEL', 'broadcast_cancel')]
    ]),

    // ========== NAVIGATION BUTTONS (4 buttons) ==========
    backButton: (target) => Markup.inlineKeyboard([
        [Markup.button.callback('🔙 BACK', target)]
    ]),

    backAndMain: Markup.inlineKeyboard([
        [Markup.button.callback('🔙 BACK', 'menu_previous')],
        [Markup.button.callback('🏠 MAIN', 'menu_main')]
    ]),

    // ========== PAGINATION BUTTONS (4 buttons) ==========
    pagination: (page, total, prefix) => {
        const buttons = [];
        const row = [];
        
        if (page > 1) {
            row.push(Markup.button.callback('⏪ PREV', `${prefix}_page_${page - 1}`));
        }
        row.push(Markup.button.callback(`📄 ${page}/${total}`, 'pagination_info'));
        if (page < total) {
            row.push(Markup.button.callback('⏩ NEXT', `${prefix}_page_${page + 1}`));
        }
        buttons.push(row);
        return Markup.inlineKeyboard(buttons);
    },

    // ========== RESPONSE BUTTONS (3 buttons) ==========
    responseButtons: Markup.inlineKeyboard([
        [Markup.button.callback('⭐ SAVE', 'save_favorite'),
         Markup.button.callback('🔄 RETRY', 'retry_response'),
         Markup.button.callback('📤 SHARE', 'share_response')]
    ])
};

module.exports = KEYBOARDS;