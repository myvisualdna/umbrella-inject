# ChatGPT Middleware

This middleware processes all articles collected from scraping runs through ChatGPT API.

## Configuration

Add the following environment variables to your `.env` file:

```env
# Enable/disable the middleware (set to "true" to enable)
CHATGPT_MIDDLEWARE_ENABLED=false

# Your OpenAI API key
CHATGPT_API_KEY=your-api-key-here

# Optional: ChatGPT model to use (defaults to "gpt-4o-mini")
CHATGPT_MODEL=gpt-4o-mini
```

## How It Works

1. After articles are collected and saved for each run (run1, run2, etc.), the middleware automatically processes them
2. Each article is sent to ChatGPT with a prompt that includes:
   - Article title
   - Excerpt (if available)
   - Category
   - Source/origin
   - Body text (first 2000 characters)
3. ChatGPT returns an analysis with:
   - Brief summary (2-3 sentences)
   - Key points (3-5 bullet points)
   - Potential impact or significance

## Console Output

The middleware logs:

- 📥 Article data received (full JSON)
- 📤 Prompt being sent to ChatGPT
- 📥 Response received from ChatGPT
- ❌ Errors if any occur

## Features

- **On/Off Switch**: Control via `CHATGPT_MIDDLEWARE_ENABLED` environment variable
- **Rate Limiting**: 1 second delay between requests to avoid API rate limits
- **Error Handling**: Graceful error handling with detailed logging
- **Sequential Processing**: Articles processed one at a time to respect API limits

## Usage

The middleware is automatically called after articles are collected in each run. No manual intervention needed - just enable it via the environment variable.


