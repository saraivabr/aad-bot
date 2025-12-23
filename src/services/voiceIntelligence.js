/**
 * VOICE INTELLIGENCE SERVICE
 *
 * Sistema revolucionário de conversação por voz:
 * - Detecta emoção/tom na transcrição
 * - Escolhe responder em áudio ou texto baseado no contexto
 * - Adapta a voz (tom, velocidade) baseado na situação
 * - Respostas híbridas (texto + áudio) para máximo impacto
 */

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');

class VoiceIntelligence {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // Vozes disponíveis por contexto emocional
        this.voices = {
            energetic: 'nova',      // Feminina, energética
            confident: 'onyx',      // Masculina, confiante
            friendly: 'shimmer',    // Feminina, amigável
            serious: 'echo',        // Masculina, séria
            warm: 'fable',          // Britânica, calorosa
            neutral: 'alloy'        // Neutra, versátil
        };

        // Contagem de áudios recebidos por chat
        this.audioHistory = new Map();
    }

    /**
     * Transcreve áudio e analisa contexto emocional
     */
    async transcribeWithContext(mediaData) {
        try {
            // Salva arquivo temporário
            const buffer = Buffer.from(mediaData.data, 'base64');
            const tempPath = path.join(__dirname, `../../temp_audio_${Date.now()}.ogg`);
            fs.writeFileSync(tempPath, buffer);

            // Transcrição com Whisper
            const transcription = await this.openai.audio.transcriptions.create({
                file: fs.createReadStream(tempPath),
                model: "whisper-1",
                response_format: "verbose_json", // Retorna mais detalhes
                language: "pt"
            });

            // Cleanup
            fs.unlinkSync(tempPath);

            const text = transcription.text;
            const duration = transcription.duration || 0;

            // Análise de contexto
            const context = this.analyzeVoiceContext(text, duration);

            console.log(`[VOICE] Transcribed (${duration}s): "${text}"`);
            console.log(`[VOICE] Context: ${JSON.stringify(context)}`);

            return {
                text,
                duration,
                ...context
            };
        } catch (error) {
            console.error("[VOICE] Transcription error:", error.message);
            return {
                text: "[Áudio não reconhecido]",
                duration: 0,
                emotion: 'neutral',
                shouldRespondWithAudio: false
            };
        }
    }

    /**
     * Analisa o contexto emocional baseado no texto e duração
     */
    analyzeVoiceContext(text, duration) {
        const textLower = text.toLowerCase();

        // Detecção de emoção por palavras-chave
        let emotion = 'neutral';
        let energy = 'medium';

        // Frustração/Raiva
        if (/pqp|caralho|merda|droga|não consigo|odeio|cansado|difícil|impossível/i.test(textLower)) {
            emotion = 'frustrated';
            energy = 'high';
        }
        // Empolgação
        else if (/incrível|demais|top|show|massa|consegui|fechei|vendi|sucesso/i.test(textLower)) {
            emotion = 'excited';
            energy = 'high';
        }
        // Dúvida/Confusão
        else if (/como assim|não entendi|pode explicar|o que|será que|tipo assim/i.test(textLower)) {
            emotion = 'confused';
            energy = 'low';
        }
        // Tristeza/Desânimo
        else if (/desistir|não sei mais|perdido|sozinho|ninguém|fracasso/i.test(textLower)) {
            emotion = 'sad';
            energy = 'low';
        }
        // Urgência
        else if (/urgente|agora|rápido|preciso|ajuda|socorro/i.test(textLower)) {
            emotion = 'urgent';
            energy = 'high';
        }
        // Gratidão
        else if (/obrigado|valeu|agradeço|gratidão|você é demais/i.test(textLower)) {
            emotion = 'grateful';
            energy = 'medium';
        }

        // Áudio longo (>15s) = pessoa quer conversar, responde com áudio
        // Áudio curto (<5s) = mensagem rápida, responde com texto
        const shouldRespondWithAudio = duration > 10 || emotion === 'frustrated' || emotion === 'sad';

        // Tipo de resposta recomendada
        let responseType = 'text';
        if (shouldRespondWithAudio) {
            responseType = 'audio';
        } else if (emotion === 'excited' || emotion === 'grateful') {
            responseType = 'hybrid'; // Texto curto + áudio de celebração
        }

        return {
            emotion,
            energy,
            shouldRespondWithAudio,
            responseType,
            isLongMessage: duration > 15
        };
    }

    /**
     * Escolhe a voz ideal baseada no contexto
     */
    selectVoice(emotion, persona) {
        // Saraiva (consultor) sempre usa voz confiante/séria
        if (persona === 'saraiva') {
            return emotion === 'frustrated' ? this.voices.serious : this.voices.confident;
        }

        // Social Media adapta baseado na emoção
        switch (emotion) {
            case 'frustrated':
            case 'sad':
                return this.voices.warm; // Voz calorosa para confortar
            case 'excited':
            case 'grateful':
                return this.voices.energetic; // Voz energética para celebrar
            case 'confused':
                return this.voices.friendly; // Voz amigável para explicar
            case 'urgent':
                return this.voices.confident; // Voz confiante para resolver
            default:
                return this.voices.friendly;
        }
    }

    /**
     * Gera resposta em áudio com a voz apropriada
     */
    async generateVoiceResponse(text, emotion, persona) {
        try {
            const voice = this.selectVoice(emotion, persona);
            const speed = emotion === 'urgent' ? 1.1 : (emotion === 'sad' ? 0.9 : 1.0);

            console.log(`[VOICE] Generating audio with voice=${voice}, speed=${speed}`);

            const mp3 = await this.openai.audio.speech.create({
                model: "tts-1-hd", // Qualidade HD
                voice: voice,
                input: text,
                speed: speed
            });

            const buffer = Buffer.from(await mp3.arrayBuffer());
            return new MessageMedia('audio/mp3', buffer.toString('base64'));
        } catch (error) {
            console.error("[VOICE] TTS error:", error.message);
            return null;
        }
    }

    /**
     * Registra que o chat enviou um áudio (para tracking)
     */
    recordAudioReceived(chatId) {
        const count = this.audioHistory.get(chatId) || 0;
        this.audioHistory.set(chatId, count + 1);
        return count + 1;
    }

    /**
     * Verifica se o usuário prefere áudio (baseado no histórico)
     */
    userPrefersAudio(chatId) {
        const count = this.audioHistory.get(chatId) || 0;
        return count >= 3; // Se mandou 3+ áudios, provavelmente prefere áudio
    }

    /**
     * Formata o texto para resposta em áudio (remove tags, emojis excessivos, etc)
     */
    formatTextForAudio(text) {
        return text
            .replace(/<SPLIT>/g, '... ') // Pausas naturais
            .replace(/<REACT:.*?>/g, '') // Remove reações
            .replace(/\|\|.*?\|\|/g, '') // Remove tags especiais
            .replace(/[🔥💪🚀🎉👏✌️👋😤💭🤔]/g, '') // Remove emojis
            .replace(/\*\*/g, '') // Remove markdown
            .replace(/\n+/g, '. ') // Quebras de linha viram pausas
            .trim();
    }
}

module.exports = new VoiceIntelligence();
