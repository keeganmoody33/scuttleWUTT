# Adding LLM Models to Consensus Engine

This guide shows you how to add more models to the consensus system. The system automatically includes all models that have API keys configured.

## Quick Start

Just add the API keys to your `.env` file and the system will automatically use those models!

## Available Models by Provider

### 1. Anthropic Claude (ANTHROPIC_API_KEY)

**Required:** `ANTHROPIC_API_KEY=sk-ant-...`

**Models automatically included:**
- `claude-sonnet-4-5` - Latest and best (recommended)
- `claude-opus-4` - Most capable for complex reasoning

**Additional models available (uncomment in code to enable):**
- `claude-3-5-sonnet` - Previous generation
- `claude-3-5-haiku` - Fast and cheap

**Get your key:** https://console.anthropic.com/

---

### 2. OpenAI GPT (OPENAI_API_KEY)

**Required:** `OPENAI_API_KEY=sk-...`

**Models automatically included:**
- `gpt-4o` - Latest flagship (recommended)
- `gpt-4o-mini` - Fast and cheap

**Additional models available (uncomment in code to enable):**
- `gpt-4-turbo` - Previous generation
- `gpt-4` - Original GPT-4
- `gpt-3.5-turbo` - Legacy fast model

**Get your key:** https://platform.openai.com/api-keys

---

### 3. DeepSeek (DEEPSEEK_API_KEY)

**Required:** `DEEPSEEK_API_KEY=...`

**Models automatically included:**
- `deepseek-chat` - Open weights reasoning model

**Additional models available:**
- `deepseek-coder` - Coding focused (uncomment to enable)

**Get your key:** https://platform.deepseek.com/

---

### 4. OpenRouter (OPENROUTER_API_KEY)

**Required:** `OPENROUTER_API_KEY=sk-or-...`

**Models automatically included:**
- `llama-3.3-70b` - Latest Llama model
- `llama-3.1-70b` - Stable Llama model
- `mistral-large` - Mistral flagship
- `mistral-medium` - Balanced Mistral

**Additional models available (uncomment in code to enable):**
- `llama-3.1-405b` - Largest model (expensive!)

**Get your key:** https://openrouter.ai/keys

**Note:** OpenRouter gives you access to many open-source models through one API key!

---

### 5. Perplexity (PERPLEXITY_API_KEY)

**Required:** `PERPLEXITY_API_KEY=pplx-...`

**Models automatically included:**
- `perplexity-sonar-pro` - Best search-augmented model
- `perplexity-sonar` - Fast search-augmented model

**Get your key:** https://www.perplexity.ai/settings/api

**Note:** Perplexity models have web search built-in, great for factual questions!

---

### 6. Google Gemini (Coming Soon)

**Status:** Not yet integrated (requires Google AI SDK)

**Planned models:**
- `gemini-2.0-flash`
- `gemini-1.5-pro`
- `gemini-1.5-flash`

---

## Example .env File

```bash
# Database
DATABASE_URL=postgresql://...

# LLM Providers - Add as many as you want!
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=...
OPENROUTER_API_KEY=sk-or-...
PERPLEXITY_API_KEY=pplx-...

# Other services
RESEND_API_KEY=re_...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```

## How It Works

1. **Automatic Detection**: The consensus route checks which API keys are set
2. **Model Selection**: Only models with valid API keys are included
3. **Parallel Execution**: All models run simultaneously for speed
4. **Consensus Building**: Results are compared to find agreement

## Cost Considerations

**Cheapest setup (2 models):**
- `gpt-4o-mini` (OpenAI) - ~$0.15/$0.6 per 1M tokens
- `claude-3-5-haiku` (Anthropic) - ~$0.8/$4 per 1M tokens

**Balanced setup (4-5 models):**
- `claude-sonnet-4-5` + `gpt-4o` + `deepseek-chat` + `llama-3.3-70b`

**Maximum consensus (10+ models):**
- Add all providers for maximum diversity and trust

## Enabling More Models

To enable additional models from the same provider, edit `src/app/api/consensus/route.ts` and uncomment the models you want:

```typescript
// Anthropic Claude models
if (process.env.ANTHROPIC_API_KEY) {
  consensusModels.push('claude-sonnet-4-5');
  consensusModels.push('claude-opus-4');
  consensusModels.push('claude-3-5-sonnet'); // Uncomment to enable
  consensusModels.push('claude-3-5-haiku');   // Uncomment to enable
}
```

## Model Performance

**Best for factual questions:**
- Perplexity models (web search enabled)
- GPT-4o (strong reasoning)

**Best for tool recommendations:**
- Claude Sonnet 4.5 (excellent at following structured prompts)
- GPT-4o (good balance)
- Llama 3.3 (open-source alternative)

**Best for consensus diversity:**
- Mix of providers (Anthropic + OpenAI + OpenRouter)
- Different model sizes (large + medium + small)

## Troubleshooting

**"No LLM API keys configured"**
- Make sure at least one API key is set in your `.env` file
- Restart your dev server after adding keys

**Model fails to respond**
- Check your API key is valid
- Check your account has credits/balance
- Check rate limits haven't been exceeded

**Too slow**
- Reduce number of models
- Use faster models (gpt-4o-mini, claude-3-5-haiku)
- Check network latency

**Too expensive**
- Use cheaper models (gpt-4o-mini, deepseek-chat)
- Reduce number of models
- Set up usage limits in provider dashboards

