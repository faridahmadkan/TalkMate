/**
 * ======================================================
 * UTILITIES - Helper functions for the bot
 * ======================================================
 */

const crypto = require('crypto');
const moment = require('moment');

module.exports = {
    // Generate unique ID
    generateId: (prefix = '') => {
        return prefix + crypto.randomBytes(4).toString('hex').toUpperCase();
    },

    // Split long messages
    splitMessage: (text, maxLength = 4096) => {
        if (text.length <= maxLength) return [text];
        const parts = [];
        for (let i = 0; i < text.length; i += maxLength) {
            parts.push(text.substring(i, i + maxLength));
        }
        return parts;
    },

    // Safe execution wrapper
    safeExecute: async (ctx, fn) => {
        try {
            await fn();
        } catch (error) {
            console.error('Error:', error.message);
            await ctx.reply('❌ An error occurred. Please try again.').catch(() => {});
        }
    },

    // Format date
    formatDate: (date, format = 'full') => {
        const d = new Date(date);
        if (format === 'short') {
            return moment(d).format('MMM D, YYYY');
        } else if (format === 'time') {
            return moment(d).format('h:mm A');
        } else {
            return moment(d).format('MMM D, YYYY h:mm A');
        }
    },

    // Format number with commas
    formatNumber: (num) => {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    // Get random tip
    getRandomTip: (tips) => {
        return tips[Math.floor(Math.random() * tips.length)];
    },

    // Escape markdown
    escapeMarkdown: (text) => {
        return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
    },

    // Validate user input
    validateInput: (text, maxLength = 1000) => {
        if (!text || text.length === 0) return false;
        if (text.length > maxLength) return false;
        return true;
    },

    // Parse command arguments
    parseArgs: (text) => {
        const args = text.split(' ');
        const command = args.shift().toLowerCase();
        return { command, args };
    },

    // Create progress bar
    createProgressBar: (current, total, length = 10) => {
        const percentage = current / total;
        const filled = Math.round(length * percentage);
        const empty = length - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    },

    // Format time duration
    formatDuration: (seconds) => {
        return moment.duration(seconds, 'seconds').humanize();
    },

    // Check if string is valid JSON
    isValidJSON: (str) => {
        try {
            JSON.parse(str);
            return true;
        } catch {
            return false;
        }
    },

    // Deep clone object
    deepClone: (obj) => {
        return JSON.parse(JSON.stringify(obj));
    },

    // Wait for specified milliseconds
    sleep: (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    // Get file size in readable format
    formatFileSize: (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // Truncate text
    truncate: (text, length = 100) => {
        if (text.length <= length) return text;
        return text.substring(0, length) + '...';
    },

    // Extract hashtags from text
    extractHashtags: (text) => {
        const regex = /#(\w+)/g;
        const matches = text.match(regex);
        return matches ? matches.map(tag => tag.substring(1)) : [];
    },

    // Validate email
    isValidEmail: (email) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    },

    // Get current timestamp
    timestamp: () => {
        return Date.now();
    },

    // Format timestamp
    formatTimestamp: (timestamp) => {
        return moment(timestamp).fromNow();
    }
};