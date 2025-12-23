# WhatsApp AI Assistant Template 🤖

Este é um template profissional para bots de WhatsApp humanizados com memória persistente, utilizando a "Doug System" philosophy.

## ✨ Funcionalidades

- **Humanização Extrema**: Delay de resposta natural (5s) e remoção de "digitando..." instantâneo para evitar comportamento robótico.
- **Memória Semântica**: Capaz de extrair e lembrar Nome, Negócio e Localização do usuário usando IA e Regex sensível ao contexto.
- **Persistent Save**: Tag `||SAVE||` para salvar metadados do usuário em tempo real.
- **Multi-Modal**: Suporte para áudio, imagem e texto.
- **Infrastructure Ready**: Docker Compose para MongoDB, Redis e Postgres incluído.
- **Deployment**: Configurado para rodar via PM2 em servidores Linux (Ubuntu).

## 🚀 Como Começar (Local)

1.  **Clone o repositório**:
    ```bash
    git clone https://github.com/saraivabr/aad-bot.git
    cd aad-bot
    ```

2.  **Instale as dependências**:
    ```bash
    npm install
    ```

3.  **Configure o `.env`**:
    Crie um arquivo `.env` na raiz:
    ```env
    OPENAI_API_KEY=sua_chave
    OPENROUTER_API_KEY=sua_chave_opcional
    ```

4.  **Inicie os Bancos de Dados (Opcional)**:
    ```bash
    docker-compose up -d
    ```

5.  **Rode o Bot**:
    ```bash
    node index.js
    ```
    Escaneie o QR Code que aparecerá no terminal.

## 📦 Deployment (Servidor)

Para rodar em um VPS Ubuntu com PM2:

1.  Garanta que o Chrome/Puppeteer tenha as dependências instaladas:
    ```bash
    sudo apt-get update && sudo apt-get install -y google-chrome-stable
    ```

2.  Inicie com PM2:
    ```bash
    pm2 start index.js --name meu-bot
    pm2 save
    ```

## 🧠 Personalização

Para trocar a personalidade do bot, edite o arquivo:
`src/personas.js`

Altere a constante `SOCIAL_MEDIA_MISSION` para mudar o objetivo da IA.

## 🛠️ Tecnologias
- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)
- [LangChain](https://js.langchain.com/)
- [OpenAI / Gemini](https://openai.com/)
- [Docker](https://www.docker.com/)
