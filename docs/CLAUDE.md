# AAD - AI Assistant for WhatsApp

<!-- AUTO-MANAGED: project-description -->
WhatsApp bot with AI-powered conversational intelligence. Features dual-mode architecture (v2.0 + legacy), semantic memory with embeddings, intent detection, emotional intelligence, multi-persona system, and adaptive human-like responses.
<!-- END AUTO-MANAGED -->

<!-- AUTO-MANAGED: build-commands -->
## Build Commands

- Start bot: `node index.js`
- Test files: `node test_*.js`
<!-- END AUTO-MANAGED -->

<!-- AUTO-MANAGED: architecture -->
## Architecture

```
src/
├── ai/                                 # AI services (dual-mode: v2.0 + legacy)
│   ├── conversationOrchestrator.js    # v2.0: Master orchestrator (default)
│   ├── conversationalEngine.js        # v2.0: StateGraph + intent + emotion
│   ├── semanticMemory.js              # v2.0: Long-term memory with embeddings
│   ├── aiService.js                   # Legacy: RAG + LLM + FSM (fallback)
│   ├── vectorStore.js                 # Legacy: Knowledge base with embeddings
│   └── history.js                     # Legacy: Conversation history manager
├── services/                           # Domain services
│   ├── clientService.js               # Client data persistence
│   ├── mediaService.js                # Image/audio generation + vision
│   └── voiceIntelligence.js           # Voice transcription + emotion analysis + TTS
├── data/
│   ├── knowledgeBase.js               # RAG training data
│   ├── clients.db.json                # Client database
│   └── semantic_memory.json           # v2.0: Semantic memory store
├── doug/                               # Persona definitions
│   ├── constitution.js                # Core personality rules
│   └── knowledge.js                   # Domain knowledge
├── personas.js                         # Persona prompts (SOCIAL_MEDIA, CONSULTANT)
├── conversationState.js                # Legacy: FSM (GREETING → DISCOVERY → ENGAGEMENT → PITCH → CLOSE)
└── commandDispatcher.js                # Dual-mode router + message buffer + humanization
```

**Flow (v2.0 - default)**: WhatsApp message → commandDispatcher (buffer + routing) → conversationOrchestrator (semantic memory retrieval) → conversationalEngine (StateGraph: intent detection + emotion analysis + LLM generation) → conversationOrchestrator (response formatting + execution)

**Flow (legacy - fallback)**: WhatsApp message → commandDispatcher (routing + FSM update) → aiService (RAG + generation) → commandDispatcher (humanized delivery)

**Toggle**: Set `USE_NEW_ENGINE=false` to use legacy system
<!-- END AUTO-MANAGED -->

<!-- AUTO-MANAGED: conventions -->
## Conventions

- **Imports**: CommonJS (`require`), no ES6 modules
- **Lazy loading**: API-dependent modules loaded on-demand to prevent initialization errors (LangChain, embeddings, voice services)
- **Services**: Singleton pattern (`module.exports = new ClassName()`)
- **State management**: In-memory Maps for chat state and history
- **File organization**: Feature-based directories (ai/, services/, data/)
- **Architecture mode**: Toggle via `USE_NEW_ENGINE` env var (default: true for v2.0)
<!-- END AUTO-MANAGED -->

<!-- AUTO-MANAGED: patterns -->
## Patterns

### v2.0 Conversational Engine (Default)

**StateGraph Architecture**:
- **State schema**: `createInitialState()` maintains rich context (messages, intent, emotionalState, userProfile, conversationMetrics, personaBlendRatio, contextWindow, longTermMemories, pendingActions, conversationPhase, proactiveHooks)
- **Intent classifier**: Pattern-based detection with confidence scores for 13+ intents (greeting, farewell, question, request_help, request_content, request_image, request_audio, share_achievement, express_frustration, seek_validation, request_consultation, small_talk, objection, buying_signal)
- **Composite intents**: Multi-signal detection (ready_to_buy, needs_nurturing, highly_engaged)
- **Emotional intelligence**: Valence/arousal model with 9 emotions (excited, happy, grateful, frustrated, sad, confused, anxious, curious, neutral) with intensity tracking and trend analysis (rising/falling/stable)
- **Semantic memory**: 4 memory types (EPISODIC, SEMANTIC, PROCEDURAL, EMOTIONAL) with embeddings, importance scoring, access count tracking, and temporal decay

**Three-layer orchestration**:
1. **conversationOrchestrator.js**: MessageBuffer (3.5s timeout), ResponseFormatter (fragmentation + timing), media generation, response execution
2. **conversationalEngine.js**: IntentClassifier, EmotionalIntelligence, PersonaBlender, state management, LLM generation with memory context
3. **semanticMemory.js**: Vector-based memory store/retrieve with similarity consolidation (0.85 threshold), auto-pruning (max 100 per chat), disk persistence

**ResponseFormatter features**:
- Auto-fragmentation by sentence boundaries (max 200 chars per fragment, max 4 fragments)
- Humanized typing time: fast (20ms/char), normal (35ms/char), slow (50ms/char) with ±20% variation
- Inter-message delay: 300-800ms random
- TTS preparation: strips <SPLIT>, <REACT>, ||tags||, emojis, markdown

**PersonaBlender dynamics**:
- Calculates social_media vs consultant weight ratios (0.0-1.0 each)
- Adjusts based on: intent (request_consultation → 0.9 consultant), emotion (frustrated/sad → +0.2 consultant), conversation phase (pitch/close → +0.3 consultant), engagement level (>70 → more direct)
- Default: 0.7 social_media, 0.3 consultant

### Legacy System (Fallback)

**FSM Integration** (used when `USE_NEW_ENGINE=false`):
1. **conversationState.js**: Pure FSM logic, state transitions, reaction detection
2. **commandDispatcher.js**: Orchestration - updates FSM, retrieves state instructions
3. **aiService.js**: Generation - receives `stateInstructions` parameter, injects into prompt

### Shared Patterns

**Special Tag Protocol**:
AI responses contain control tags parsed by commandDispatcher:
- `||SAVE|| {json}` - Extract and save client data
- `||GENERATE_IMAGE: prompt||` - Trigger image generation
- `||SEND_AUDIO: text||` - Trigger TTS
- `<REACT:emoji>` - Send WhatsApp reaction
- `<SPLIT>` - Fragment messages for natural delivery

**Persona System**:
Two personas with dynamic blending:
- **SOCIAL_MEDIA**: Energetic, friendly tone (vocabulary: top, show, bora, massa; emoji freq: 0.7; formality: 0.3; areas: content, engagement, growth, posts)
- **CONSULTANT**: Direct, brutal tone (vocabulary: mano, cara, saca, pqp, resultado; emoji freq: 0.3; formality: 0.2; areas: consultoria, strategy, business, sales)
- PersonaBlender calculates dynamic weight ratios based on emotion, phase, and engagement

**Message Buffering** (MessageBuffer class in orchestrator):
- 3.5s timeout to combine rapid messages into single text
- Tracks firstMessageTime, messages array, voiceContext
- Single processing callback after timeout expires

**Voice Intelligence System** (`voiceIntelligence.js`):
Hybrid text/audio response with emotional awareness:

**Transcription**:
- Whisper API with verbose_json format for duration metadata
- Returns: `{ text, duration, emotion, energy, shouldRespondWithAudio, responseType, isLongMessage }`

**Emotion detection** (keyword patterns):
- frustrated: pqp, caralho, merda, não consigo, difícil
- excited: incrível, demais, top, consegui, vendi
- confused: como assim, não entendi, pode explicar
- sad: desistir, não sei mais, perdido, fracasso
- urgent: urgente, agora, rápido, socorro
- grateful: obrigado, valeu, gratidão

**Response strategy**:
- `shouldRespondWithAudio = true` if: duration >10s OR emotion in [frustrated, sad]
- responseType: 'audio' (long/emotional), 'text' (short), 'hybrid' (excited/grateful)
- Audio preference tracking via `audioHistory` Map (chatId → count)

**Voice selection** (6 voices: nova, onyx, shimmer, echo, fable, alloy):
- CONSULTANT persona: onyx (confident) or echo (serious) for frustrated
- SOCIAL_MEDIA persona: emotion-adaptive (warm/fable for sad, energetic/nova for excited, friendly/shimmer for confused, confident/onyx for urgent)
- Speed modulation: urgent (1.1x), sad (0.9x), normal (1.0x)

**Integration** (legacy dispatcher):
```javascript
// 1. index.js detects: message.hasMedia && message.type === 'ptt'
// 2. voiceIntelligence.transcribeWithContext(media)
// 3. commandDispatcher injects voiceContext into extraInstructions
// 4. Auto-generates audio if shouldSendVoiceResponse || userPrefersAudio(chatId)
```
<!-- END AUTO-MANAGED -->

<!-- MANUAL -->
## Manual Notes

Add project-specific notes here.
<!-- END MANUAL -->
