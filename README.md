# AAD - AI Assistant for WhatsApp

<div align="center">

🤖 **WhatsApp Bot com Inteligência Conversacional Avançada**

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Web.js-25D366.svg)](https://github.com/pedroslopez/whatsapp-web.js)
[![AI Powered](https://img.shields.io/badge/AI-Powered-blue.svg)](https://github.com/langchain-ai/langchainjs)

</div>

## 📋 Índice

- [Sobre](#sobre)
- [Features](#features)
- [Arquitetura](#arquitetura)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Uso](#uso)
- [Testes](#testes)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Documentação Adicional](#documentação-adicional)
- [Tecnologias](#tecnologias)

## 🎯 Sobre

AAD é um bot inteligente para WhatsApp com capacidades avançadas de conversação, memória semântica, detecção de intenções, inteligência emocional e sistema multi-persona. O bot utiliza arquitetura dual-mode (v2.0 + legacy) com processamento de linguagem natural, geração de mídia e respostas humanizadas adaptativas.

### Principais Características

- **🧠 Inteligência Conversacional**: Engine avançado com StateGraph para gerenciamento de contexto
- **💭 Memória Semântica**: Sistema de memória de longo prazo com embeddings e similaridade vetorial
- **😊 Inteligência Emocional**: Detecção e análise de emoções com modelo valence/arousal
- **🎭 Sistema Multi-Persona**: Blend dinâmico entre personas (Social Media e Consultant)
- **🎤 Processamento de Voz**: Transcrição, análise emocional e síntese de voz (TTS)
- **🖼️ Geração de Mídia**: Criação de imagens e áudio com IA
- **📊 RAG (Retrieval-Augmented Generation)**: Base de conhecimento com busca vetorial
- **⏱️ Respostas Humanizadas**: Timing adaptativo e fragmentação natural de mensagens

## ✨ Features

### v2.0 - Motor Conversacional (Padrão)

- **Classificador de Intenções**: Detecção baseada em padrões com scores de confiança para 13+ intenções
- **Intenções Compostas**: Detecção multi-sinal (ready_to_buy, needs_nurturing, highly_engaged)
- **Análise Emocional**: 9 emoções rastreadas (excited, happy, grateful, frustrated, sad, confused, anxious, curious, neutral)
- **Memória Semântica**: 4 tipos de memória (EPISODIC, SEMANTIC, PROCEDURAL, EMOTIONAL)
- **Message Buffer**: Timeout de 3.5s para combinar mensagens rápidas
- **Response Formatter**: Auto-fragmentação com timing humanizado

### Sistema Legacy (Fallback)

- **FSM (Finite State Machine)**: Estados conversacionais (GREETING → DISCOVERY → ENGAGEMENT → PITCH → CLOSE)
- **RAG com Vetores**: Base de conhecimento com embeddings
- **Sistema de Reações**: Detecção automática de contexto para reações do WhatsApp

### Features Compartilhadas

- **Sistema de Tags Especiais**: Controle de ações (||SAVE||, ||GENERATE_IMAGE||, ||SEND_AUDIO||, <REACT:emoji>, <SPLIT>)
- **Voice Intelligence**: Transcrição Whisper + análise emocional + TTS com 6 vozes
- **Client Service**: Persistência de dados de clientes
- **Suporte a Mídia**: Processamento de áudio, imagens e stickers

### 🆕 Enhanced Architecture (NEW!)

Camada adicional de inteligência emocional e memória persistente:

- **🎭 Emotion Handler**: Análise emocional aprimorada usando GPT-4o-mini (9 emoções + intensidade)
- **💾 Hybrid Memory System**: Redis (cache rápido 24h) + Postgres (persistência longa)
- **⏱️ Smart Delays**: Delays adaptativos baseados em comprimento de mensagem e emoção
- **📝 Data Extractors**: Extração automática de dados estruturados (nome, negócio, localização)
- **🔧 Service Layer**: Wrappers centralizados para OpenAI, Redis e Postgres
- **🐳 Docker Ready**: docker-compose.yml completo com health checks
- **⚙️ PM2 Support**: Configuração de produção com logs e auto-restart

**Quick Start:**
```bash
# Inicie os bancos de dados
docker-compose up -d postgres redis

# Teste as novas features
npm run test:enhanced

# Use PM2 em produção
npm run start:pm2
```

📖 **Documentação:**
- [Enhanced Architecture Guide](docs/ENHANCED_ARCHITECTURE.md) - Documentação completa
- [Quick Start Guide](docs/QUICK_START.md) - Guia rápido de início
- [Integration Examples](docs/INTEGRATION_EXAMPLES.js) - Exemplos de integração

## 🏗️ Arquitetura

### Fluxo v2.0 (Padrão)

```
WhatsApp Message
    ↓
commandDispatcher (buffer + routing)
    ↓
conversationOrchestrator (semantic memory retrieval)
    ↓
conversationalEngine (StateGraph: intent + emotion + LLM)
    ↓
conversationOrchestrator (response formatting + execution)
    ↓
WhatsApp Response
```

### Fluxo Legacy (Fallback)

```
WhatsApp Message
    ↓
commandDispatcher (routing + FSM update)
    ↓
aiService (RAG + generation)
    ↓
commandDispatcher (humanized delivery)
    ↓
WhatsApp Response
```

### Estrutura de Camadas

```
┌─────────────────────────────────────────┐
│     WhatsApp Web.js Interface           │
│            (index.js)                    │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│     Command Dispatcher                   │
│  (routing, buffering, humanization)      │
└──────────────┬──────────────────────────┘
               ↓
     ┌─────────┴─────────┐
     ↓                   ↓
┌──────────────┐  ┌──────────────┐
│  v2.0 Engine │  │Legacy System │
│ (orchestrator)│  │  (aiService) │
└──────┬───────┘  └──────┬───────┘
       ↓                  ↓
┌──────────────────────────────────┐
│   Services Layer                  │
│ • Voice Intelligence              │
│ • Media Service                   │
│ • Client Service                  │
│ • Semantic Memory                 │
└───────────────────────────────────┘
```

## 📦 Instalação

### Pré-requisitos

- Node.js 20+ 
- NPM 10+
- Conta Google Cloud (para APIs de IA)
- Conta OpenAI (para GPT e Whisper)

### Passos

1. **Clone o repositório**
```bash
git clone https://github.com/saraivabr/aad-bot.git
cd aad-bot
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente** (veja seção [Configuração](#configuração))

4. **Execute o bot**
```bash
node index.js
```

5. **Escaneie o QR Code** que aparecerá no terminal com seu WhatsApp

## ⚙️ Configuração

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# OpenAI API
OPENAI_API_KEY=your_openai_api_key_here

# Google Gemini API
GOOGLE_API_KEY=your_google_api_key_here

# Sistema (opcional)
USE_NEW_ENGINE=true              # true = v2.0, false = legacy
DEBUG_DISPATCHER=false           # Ativar logs de debug
NODE_ENV=production              # production ou development

# Database Configuration (Enhanced Architecture)
REDIS_URL=redis://localhost:6379
POSTGRES_URL=postgresql://ai_bot:securepass@localhost:5432/aibotdb

# Voice Intelligence (opcional)
# Configurações adicionais para controle de voz
```

### Variáveis Importantes

| Variável | Descrição | Padrão | Obrigatória |
|----------|-----------|--------|-------------|
| `OPENAI_API_KEY` | Chave da API OpenAI (GPT, Whisper, TTS, DALL-E) | - | ✅ Sim |
| `GOOGLE_API_KEY` | Chave da API Google (Gemini) | - | ✅ Sim |
| `USE_NEW_ENGINE` | Usar engine v2.0 (true) ou legacy (false) | `true` | ❌ Não |
| `DEBUG_DISPATCHER` | Ativar logs detalhados | `false` | ❌ Não |
| `REDIS_URL` | URL de conexão Redis | `redis://localhost:6379` | ❌ Não |
| `POSTGRES_URL` | URL de conexão Postgres | `postgresql://ai_bot:...` | ❌ Não |

**Nota:** Se `REDIS_URL` ou `POSTGRES_URL` não estiverem configurados, o sistema faz fallback automático para armazenamento em arquivo JSON.

## 🚀 Uso

### Iniciar o Bot

```bash
# Desenvolvimento
npm start

# Com PM2 (Produção recomendada)
npm run start:pm2

# Monitorar com PM2
pm2 monit

# Ver logs com PM2
npm run logs:pm2

# Iniciar bancos de dados (opcional)
npm run docker:up
```

### Primeira Execução

1. Execute `node index.js`
2. Aguarde o QR Code aparecer no terminal
3. Abra o WhatsApp no seu celular
4. Vá em **Aparelhos conectados** > **Conectar um aparelho**
5. Escaneie o QR Code
6. Aguarde a mensagem "✅ Client is ready!"

### Comandos do Bot

O bot responde naturalmente a conversas. Alguns exemplos de interação:

- **Saudações**: "Oi", "Olá", "E aí"
- **Perguntas**: Faça perguntas sobre marketing digital, redes sociais, consultoria
- **Solicitações de conteúdo**: "Me cria uma imagem de...", "Pode fazer um áudio explicando..."
- **Consultas**: "Quero fazer uma consultoria"
- **Áudio**: Envie mensagens de voz (o bot transcreve e responde adaptivamente)

### Tags Especiais (para desenvolvedores)

O bot processa tags especiais nas respostas da IA:

- `||SAVE|| {json}`: Extrai e salva dados do cliente
- `||GENERATE_IMAGE: prompt||`: Gera uma imagem
- `||SEND_AUDIO: text||`: Gera áudio TTS
- `<REACT:emoji>`: Envia reação do WhatsApp
- `<SPLIT>`: Fragmenta mensagens para entrega natural

## 🧪 Testes

O projeto inclui vários arquivos de teste para validar funcionalidades:

```bash
# Teste básico do bot
npm test

# Teste de humanização
npm run test:humanization

# Teste de onboarding
npm run test:onboarding

# Teste de estratégia
npm run test:strategy

# Teste end-to-end
npm run test:e2e

# 🆕 Teste da arquitetura enhanced (NEW!)
npm run test:enhanced

# Todos os testes
npm run test:all
```

### Teste da Enhanced Architecture

O novo teste `test:enhanced` valida:
- ✅ Conexões com Redis e Postgres
- ✅ Análise de emoções
- ✅ Extração de dados estruturados
- ✅ Sistema de memória híbrida
- ✅ Processamento de mensagens
- ✅ Smart delays
- ✅ Construção de contexto para IA

**Exemplo de saída:**
```
🧪 Testing Enhanced Architecture Integration

═══════════════════════════════════════════════════════
1️⃣  TESTING SERVICE AVAILABILITY
═══════════════════════════════════════════════════════

📡 Testing Redis connection...
   ✅ Redis: Connected

📡 Testing Postgres connection...
   ✅ Postgres: Connected
```

### Estrutura dos Testes
node tests/test_end_to_end.js
```

### Estrutura dos Testes

Os testes usam mocks do WhatsApp Web.js para simular conversas:

```javascript
const { handleMessage } = require('./src/commandDispatcher');

const mockMessage = createMockMessage("Olá!", "5511999999999@c.us");
await handleMessage(mockMessage);
```

## 📁 Estrutura do Projeto

```
aad-bot/
├── src/                                    # Código fonte
│   ├── ai/                                 # Serviços de IA (dual-mode)
│   │   ├── conversationOrchestrator.js     # v2.0: Orquestrador mestre
│   │   ├── conversationalEngine.js         # v2.0: StateGraph + intent + emotion
│   │   ├── semanticMemory.js               # v2.0: Memória de longo prazo
│   │   ├── aiService.js                    # Legacy: RAG + LLM + FSM
│   │   ├── vectorStore.js                  # Legacy: Base de conhecimento
│   │   └── history.js                      # Legacy: Gerenciador de histórico
│   ├── 🆕 handlers/                        # 🆕 Enhanced Architecture: Handlers
│   │   ├── emotionHandler.js               # 🆕 Análise emocional com GPT-4o-mini
│   │   ├── memoryHandler.js                # 🆕 Sistema de memória Redis + Postgres
│   │   └── messageHandler.js               # 🆕 Processamento central de mensagens
│   ├── services/                           # Serviços de domínio
│   │   ├── clientService.js                # Persistência de dados de clientes
│   │   ├── mediaService.js                 # Geração de imagem/áudio + visão
│   │   ├── voiceIntelligence.js            # Transcrição + análise + TTS
│   │   ├── 🆕 openaiService.js             # 🆕 Wrapper centralizado OpenAI
│   │   ├── 🆕 redisService.js              # 🆕 Cliente Redis centralizado
│   │   └── 🆕 pgService.js                 # 🆕 Cliente Postgres centralizado
│   ├── 🆕 utils/                           # 🆕 Enhanced Architecture: Utilitários
│   │   ├── delay.js                        # 🆕 Smart delays com emoção
│   │   └── regexExtractors.js              # 🆕 Extração de dados estruturados
│   ├── 🆕 persona/                         # 🆕 Definições de personas (modular)
│   │   └── personas.js                     # 🆕 Prompts de personas
│   ├── data/                               # Dados e configurações
│   │   └── knowledgeBase.js                # Dados de treinamento RAG
│   ├── doug/                               # Definições de persona Doug
│   │   ├── constitution.js                 # Regras de personalidade
│   │   └── knowledge.js                    # Conhecimento de domínio
│   ├── commandDispatcher.js                # Roteador dual-mode + buffer
│   ├── conversationState.js                # Legacy: FSM
│   └── personas.js                         # Prompts de personas (legacy)
├── docs/                                   # Documentação
│   ├── doug/                               # Documentação do sistema Doug
│   │   ├── CORE_CONSTITUTION_v20250520.md
│   │   ├── DougPlaybook.md
│   │   ├── Doug_Actions_FINAL.md
│   │   ├── Doug_Expression_FINAL.md
│   │   ├── PILAR 1_ NARRATIVA.md
│   │   ├── PILAR 2_ PRESENÇA.md
│   │   └── PILAR 3_ MONETIZAÇÃO.md
│   ├── CLAUDE.md                           # Documentação técnica para Claude
│   ├── 🆕 ENHANCED_ARCHITECTURE.md         # 🆕 Guia completo da arquitetura enhanced
│   ├── 🆕 QUICK_START.md                   # 🆕 Guia rápido de início
│   └── 🆕 INTEGRATION_EXAMPLES.js          # 🆕 Exemplos de integração
├── tests/                                  # Arquivos de teste
│   ├── test_bot.js
│   ├── test_humanization.js
│   ├── test_onboarding.js
│   ├── test_strategy.js
│   ├── test_end_to_end.js
│   └── 🆕 test_enhanced_architecture.js    # 🆕 Testes da enhanced architecture
├── 🆕 logs/                                # 🆕 Logs do PM2
├── index.js                                # Ponto de entrada principal
├── package.json                            # Dependências e scripts
├── 🆕 ecosystem.config.js                  # 🆕 Configuração PM2
├── 🆕 Dockerfile                           # 🆕 Container Docker
├── docker-compose.yml                      # 🆕 Atualizado com Postgres + Redis
├── 🆕 .env.example                         # 🆕 Exemplo de variáveis de ambiente
├── .gitignore                              # Arquivos ignorados pelo Git
└── README.md                               # Este arquivo
```

### Diretórios Principais

- **`src/ai/`**: Núcleo da inteligência conversacional com arquitetura dual-mode
- **🆕 `src/handlers/`**: 🆕 Handlers da enhanced architecture (emotion, memory, message)
- **`src/services/`**: Serviços auxiliares (voz, mídia, clientes, 🆕 Redis, 🆕 Postgres)
- **🆕 `src/utils/`**: 🆕 Utilitários (smart delays, data extraction)
- **`src/doug/`**: Definições da persona "Doug" (personalidade, conhecimento)
- **`docs/`**: Documentação completa do sistema (🆕 + guias enhanced architecture)
- **`tests/`**: Testes funcionais e de integração (🆕 + test_enhanced_architecture.js)

## 📚 Documentação Adicional

Para mais detalhes técnicos, consulte:

- **[docs/CLAUDE.md](docs/CLAUDE.md)**: Documentação técnica completa da arquitetura
- **[docs/doug/](docs/doug/)**: Sistema Doug completo (narrativa, presença, monetização)
  - [DougPlaybook.md](docs/doug/DougPlaybook.md): Guia de uso do Doug
  - [Doug_Actions_FINAL.md](docs/doug/Doug_Actions_FINAL.md): Ações e comandos
  - [Doug_Expression_FINAL.md](docs/doug/Doug_Expression_FINAL.md): Sistema de expressão
  - [PILAR 1_ NARRATIVA.md](docs/doug/PILAR%201_%20NARRATIVA.md): Narrativa do Doug
  - [PILAR 2_ PRESENÇA.md](docs/doug/PILAR%202_%20PRESENÇA.md): Estratégia de presença
  - [PILAR 3_ MONETIZAÇÃO.md](docs/doug/PILAR%203_%20MONETIZAÇÃO.md): Estratégia de monetização

## 🛠️ Tecnologias

### Core

- **[Node.js](https://nodejs.org/)**: Runtime JavaScript
- **[whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)**: Interface WhatsApp Web
- **[Puppeteer](https://pptr.dev/)**: Automação de browser (usado pelo whatsapp-web.js)

### AI & ML

- **[LangChain](https://js.langchain.com/)**: Framework para aplicações com LLM
- **[@langchain/openai](https://www.npmjs.com/package/@langchain/openai)**: Integração OpenAI (GPT, Whisper, DALL-E)
- **[@langchain/google-genai](https://www.npmjs.com/package/@langchain/google-genai)**: Integração Google Gemini
- **[@langchain/community](https://www.npmjs.com/package/@langchain/community)**: Ferramentas da comunidade LangChain

### Utilities

- **[dotenv](https://www.npmjs.com/package/dotenv)**: Gerenciamento de variáveis de ambiente
- **[qrcode-terminal](https://www.npmjs.com/package/qrcode-terminal)**: Geração de QR Code no terminal

### 🆕 Enhanced Architecture Stack

- **[ioredis](https://www.npmjs.com/package/ioredis)**: Cliente Redis de alta performance
- **[pg](https://www.npmjs.com/package/pg)**: Cliente PostgreSQL para Node.js
- **[pm2](https://www.npmjs.com/package/pm2)**: Gerenciador de processos avançado
- **[Docker](https://www.docker.com/)**: Containerização (Postgres 16 + Redis 7)
- **[Redis Commander](https://github.com/joeferner/redis-commander)**: Interface web para Redis

## 🔧 Desenvolvimento

### Convenções de Código

- **Imports**: CommonJS (`require`), não ES6 modules
- **Lazy Loading**: Módulos dependentes de API carregados sob demanda
- **Services**: Padrão Singleton (`module.exports = new ClassName()`)
- **State Management**: Maps em memória para estado e histórico de chat
- **Organização**: Diretórios baseados em features (ai/, services/, data/)

### Padrões Arquiteturais

1. **Dual-Mode System**: Toggle entre v2.0 e legacy via `USE_NEW_ENGINE`
2. **Message Buffering**: 3.5s timeout para combinar mensagens rápidas
3. **Response Formatting**: Fragmentação automática com timing humanizado
4. **Semantic Memory**: Store/retrieve baseado em vetores com consolidação
5. **Intent Detection**: Pattern-based com confidence scores
6. **Emotional Intelligence**: Modelo valence/arousal com 9 emoções

### Alternar Entre Sistemas

```bash
# Usar v2.0 (padrão)
USE_NEW_ENGINE=true node index.js

# Usar sistema legacy
USE_NEW_ENGINE=false node index.js
```

## 📄 Licença

ISC

## 👤 Autor

**Saraiva**

---

<div align="center">

**Feito com ❤️ e muita ☕**

</div>
