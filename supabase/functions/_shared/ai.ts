// 多供应商 AI 调用封装（平替 DeepSeek，支持免费方案）
// 选择优先级（未设 AI_PROVIDER 时）：GEMINI > GROQ > OPENROUTER > DEEPSEEK
// 任意一家 key 设为 Supabase Secret 即可生效，业务函数无需改动。

type Provider = 'deepseek' | 'gemini' | 'groq' | 'openrouter';

function resolveProvider(): Provider | null {
  const forced = Deno.env.get('AI_PROVIDER')?.toLowerCase();
  if (forced && ['deepseek', 'gemini', 'groq', 'openrouter'].includes(forced)) {
    return forced as Provider;
  }
  if (Deno.env.get('GEMINI_API_KEY')) return 'gemini';
  if (Deno.env.get('GROQ_API_KEY')) return 'groq';
  if (Deno.env.get('OPENROUTER_API_KEY')) return 'openrouter';
  if (Deno.env.get('DEEPSEEK_API_KEY')) return 'deepseek';
  return null;
}

// 是否有可用的 AI 供应商（供 jobs 判断是否跳过生成）
export function aiEnabled(): boolean {
  const p = resolveProvider();
  if (!p) return false;
  const keyMap: Record<Provider, string> = {
    deepseek: 'DEEPSEEK_API_KEY',
    gemini: 'GEMINI_API_KEY',
    groq: 'GROQ_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
  };
  return !!Deno.env.get(keyMap[p]);
}

// 兼容旧调用名（业务代码无需改动）
export async function deepseekChat(
  prompt: string,
  system = '你是一个简洁专业的中文助手。'
): Promise<string> {
  const provider = resolveProvider();
  if (!provider) {
    throw new Error('未配置任何 AI 密钥（GEMINI/GROQ/OPENROUTER/DEEPSEEK）');
  }
  switch (provider) {
    case 'deepseek':
      return callOpenAICompat('https://api.deepseek.com/chat/completions', {
        Authorization: `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
      }, 'deepseek-chat', prompt, system, 1200);
    case 'groq':
      return callOpenAICompat('https://api.groq.com/openai/v1/chat/completions', {
        Authorization: `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
      }, Deno.env.get('GROQ_MODEL') || 'llama-3.3-70b-versatile', prompt, system, 1200);
    case 'openrouter':
      return callOpenAICompat('https://openrouter.ai/api/v1/chat/completions', {
        Authorization: `Bearer ${Deno.env.get('OPENROUTER_API_KEY')}`,
        'HTTP-Referer': 'https://susu-life-workbench',
        'X-Title': 'Susu Life Workbench',
      }, Deno.env.get('OPENROUTER_MODEL') || 'google/gemma-4-26b-a4b-it:free', prompt, system, 1200);
    case 'gemini':
      return callGemini(prompt, system);
  }
}

// OpenAI 兼容接口（DeepSeek / Groq / OpenRouter 通用）
async function callOpenAICompat(
  url: string,
  authHeaders: Record<string, string>,
  model: string,
  prompt: string,
  system: string,
  maxTokens: number
): Promise<string> {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      max_tokens: maxTokens,
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`AI(${model}) 调用失败 ${resp.status}: ${txt.slice(0, 200)}`);
  }
  const json = await resp.json();
  return (json.choices?.[0]?.message?.content ?? '').trim();
}

// Google Gemini（Generative Language API，免费档 gemini-2.0-flash）
async function callGemini(prompt: string, system: string): Promise<string> {
  const key = Deno.env.get('GEMINI_API_KEY')!;
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 1200 },
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Gemini(${model}) 调用失败 ${resp.status}: ${txt.slice(0, 200)}`);
  }
  const json = await resp.json();
  return (json.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
}
