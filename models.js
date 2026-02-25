/**
 * ======================================================
 * AI MODELS CONFIGURATION
 * ======================================================
 * All available Groq AI models with detailed specifications
 * ======================================================
 */

const MODELS = [
    {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B',
        emoji: '🦙',
        provider: 'Meta',
        speed: '⚡⚡⚡',
        intelligence: '🌟🌟🌟🌟🌟',
        context: '128K',
        cost: 'Premium',
        bestFor: 'Complex reasoning, coding, analysis',
        description: 'Most powerful model for complex tasks',
        releaseDate: '2024',
        languages: ['English', 'Spanish', 'French', 'German', 'Chinese', 'Arabic', 'Persian'],
        features: ['Code generation', 'Mathematical reasoning', 'Long context']
    },
    {
        id: 'llama-3.1-70b-versatile',
        name: 'Llama 3.1 70B',
        emoji: '🦙',
        provider: 'Meta',
        speed: '⚡⚡⚡⚡',
        intelligence: '🌟🌟🌟🌟',
        context: '128K',
        cost: 'Standard',
        bestFor: 'General conversations, creative writing',
        description: 'Excellent all-rounder with great balance',
        releaseDate: '2024',
        languages: ['English', 'Spanish', 'French', 'German', 'Chinese'],
        features: ['Creative writing', 'Conversation', 'Analysis']
    },
    {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        emoji: '🎯',
        provider: 'Mistral',
        speed: '⚡⚡⚡⚡⚡',
        intelligence: '🌟🌟🌟🌟',
        context: '32K',
        cost: 'Economy',
        bestFor: 'Fast responses, quick queries',
        description: 'Fast and efficient for everyday tasks',
        releaseDate: '2023',
        languages: ['English', 'French', 'German', 'Spanish', 'Italian'],
        features: ['Fast inference', 'Multilingual', 'Efficient']
    },
    {
        id: 'gemma2-9b-it',
        name: 'Gemma 2 9B',
        emoji: '💎',
        provider: 'Google',
        speed: '⚡⚡⚡⚡⚡⚡',
        intelligence: '🌟🌟🌟',
        context: '8K',
        cost: 'Free',
        bestFor: 'Simple queries, translations',
        description: 'Lightweight and incredibly fast',
        releaseDate: '2024',
        languages: ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese'],
        features: ['Ultra-fast', 'Low memory', 'Efficient']
    }
];

module.exports = MODELS;