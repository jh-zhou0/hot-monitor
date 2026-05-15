import { aiLimiter } from '@/lib/utils/rate-limiter';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  model?: string;
}

export async function chatCompletion(messages: ChatMessage[], options?: {
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  await aiLimiter.waitForSlot();

  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4-6';

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-OpenRouter-Title': 'AI Hot Monitor',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options?.maxTokens || 1000,
      temperature: options?.temperature ?? 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${errText}`);
  }

  const data: ChatCompletionResponse = await res.json();
  return data.choices[0]?.message?.content || '';
}
