const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { MessageMedia } = require('whatsapp-web.js');

class MediaService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    // 1. AUDIO TRANSCRIPTION (Whisper)
    async transcribeAudio(mediaData) {
        try {
            // Save base64 to temp file
            const buffer = Buffer.from(mediaData.data, 'base64');
            const tempPath = path.join(__dirname, `../../temp_audio_${Date.now()}.mp3`);
            fs.writeFileSync(tempPath, buffer);

            const transcription = await this.openai.audio.transcriptions.create({
                file: fs.createReadStream(tempPath),
                model: "whisper-1",
            });

            // Cleanup
            fs.unlinkSync(tempPath);

            console.log(`[MEDIA] Audio Transcribed: "${transcription.text}"`);
            return transcription.text;
        } catch (error) {
            console.error("Error transcribing audio:", error);
            return "[Audio Ininteligível]";
        }
    }

    // 2. VISION (GPT-4o)
    async describeImage(mediaData) {
        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Describe this image in detail so I can use it as context for a social media strategy. Be specific about visual elements, text, and vibe." },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${mediaData.mimetype};base64,${mediaData.data}`
                                }
                            }
                        ],
                    },
                ],
            });
            const description = response.choices[0].message.content;
            console.log(`[MEDIA] Image Described: "${description.substring(0, 50)}..."`);
            return `[ANÁLISE DE IMAGEM ENVIADA]: ${description}`;
        } catch (error) {
            console.error("Error describing image:", error);
            return "[Erro ao analisar imagem]";
        }
    }

    // 3. IMAGE GENERATION (Nano Banana / OpenRouter)
    async generateImage(prompt) {
        try {
            console.log(`[MEDIA] Generating image for: "${prompt}" via OpenRouter (Nano Banana)`);

            // Using standard fetch because OpenAI SDK with custom baseURL can be tricky for mixed usage
            // Mapping "Nano Banana" to Flux-1-Schnell (Fast, High Quality)
            const response = await fetch("https://openrouter.ai/api/v1/images/generations", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://escreve.ai", // Required by OpenRouter
                    "X-Title": "Escreve.AI Bot"
                },
                body: JSON.stringify({
                    model: "google/gemini-2.5-flash-image", // Nano Banana
                    prompt: `Professional instagram photo. ${prompt}`,
                    n: 1,
                    // size: "1024x1024" // Gemini may handle sizing differently or auto-detect
                })
            });

            const data = await response.json();

            if (!data.data || !data.data[0]) {
                console.error("[MEDIA] OpenRouter Error:", data);
                return null;
            }

            const imageUrl = data.data[0].url;
            return await MessageMedia.fromUrl(imageUrl);

        } catch (error) {
            console.error("Error generating image:", error);
            return null;
        }
    }
    // 4. TEXT TO SPEECH (OpenAI TTS)
    async textToSpeech(text) {
        try {
            console.log(`[MEDIA] Generating Audio for: "${text}"`);
            const mp3 = await this.openai.audio.speech.create({
                model: "tts-1",
                voice: "onyx", // Deep, masculine, confident tone
                input: text,
            });

            const buffer = Buffer.from(await mp3.arrayBuffer());
            return new MessageMedia('audio/mp3', buffer.toString('base64'));
        } catch (error) {
            console.error("Error generating speech:", error);
            return null;
        }
    }
}

module.exports = new MediaService();
