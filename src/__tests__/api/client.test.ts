import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test';
import {
  buildEndpoint,
  requestCompletion,
  requestCompletionStream,
  requestStreamWithRetry,
  fetchModels,
  testConnection,
} from '../../api/client';
import type { ApiConfig, Message } from '../../api/types';

// ═══ 辅助 ═══

function makeConfig(overrides: Partial<ApiConfig> = {}): ApiConfig {
  return { apiKey: 'test-key', baseUrl: 'https://api.example.com', model: 'test-model', provider: 'openai', ...overrides };
}
function makeMessages(): Message[] { return [{ role: 'user', content: 'Hello' }]; }
function sseData(json: string): string { return `data: ${json}\n\n`; }

function mockSSEResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function mockJSONResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// ═══ buildEndpoint ═══

describe('buildEndpoint', () => {
  it('裸 base URL → 追加 /v1/chat/completions', () => {
    expect(buildEndpoint(makeConfig({ baseUrl: 'https://api.openai.com' }))).toBe('https://api.openai.com/v1/chat/completions');
  });
  it('以 /v1 结尾 → 追加 /chat/completions', () => {
    expect(buildEndpoint(makeConfig({ baseUrl: 'https://api.openai.com/v1' }))).toBe('https://api.openai.com/v1/chat/completions');
  });
  it('以 /openai 结尾 → 追加 /chat/completions', () => {
    expect(buildEndpoint(makeConfig({ baseUrl: 'https://api.example.com/openai' }))).toBe('https://api.example.com/openai/chat/completions');
  });
  it('以 /v1beta 结尾 → 追加 /openai/chat/completions', () => {
    expect(buildEndpoint(makeConfig({ baseUrl: 'https://api.google.com/v1beta' }))).toBe('https://api.google.com/v1beta/openai/chat/completions');
  });
  it('以 /chat/completions 结尾 → 原样返回', () => {
    expect(buildEndpoint(makeConfig({ baseUrl: 'https://api.example.com/v1/chat/completions' }))).toBe('https://api.example.com/v1/chat/completions');
  });
  it('尾部斜杠被去除', () => {
    expect(buildEndpoint(makeConfig({ baseUrl: 'https://api.openai.com//' }))).toBe('https://api.openai.com/v1/chat/completions');
  });
  it('尾部 /v1/ 带斜杠也正确处理', () => {
    expect(buildEndpoint(makeConfig({ baseUrl: 'https://api.openai.com/v1/' }))).toBe('https://api.openai.com/v1/chat/completions');
  });
});

// ═══ extractStreamContent（通过 SSE 流间接测试）═══

describe('extractStreamContent（通过 SSE 流间接测试）', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    try { localStorage.clear(); } catch { /* ignore */ }
  });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('OpenAI 格式: choices[0].delta.content', async () => {
    const chunks = [
      sseData(JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] })),
      sseData(JSON.stringify({ choices: [{ delta: { content: ' World' } }] })),
      'data: [DONE]\n\n',
    ];
    globalThis.fetch = mock(() => Promise.resolve(mockSSEResponse(chunks))) as any;
    const deltas: string[] = [];
    const result = await requestCompletionStream(makeConfig(), makeMessages(), { onDelta: (d) => deltas.push(d) });
    expect(result.text).toBe('Hello World');
    expect(deltas).toEqual(['Hello', ' World']);
  });

  it('Gemini 格式: candidates[0].content.parts', async () => {
    const chunks = [sseData(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Gemini response' }] } }] })), 'data: [DONE]\n\n'];
    globalThis.fetch = mock(() => Promise.resolve(mockSSEResponse(chunks))) as any;
    const result = await requestCompletionStream(makeConfig(), makeMessages(), { onDelta: () => {} });
    expect(result.text).toBe('Gemini response');
  });

  it('Anthropic 格式: delta.text', async () => {
    const chunks = [sseData(JSON.stringify({ delta: { text: 'Anthropic response' } })), 'data: [DONE]\n\n'];
    globalThis.fetch = mock(() => Promise.resolve(mockSSEResponse(chunks))) as any;
    const result = await requestCompletionStream(makeConfig(), makeMessages(), { onDelta: () => {} });
    expect(result.text).toBe('Anthropic response');
  });

  it('通用格式: json.text', async () => {
    const chunks = [sseData(JSON.stringify({ text: 'Generic response' })), 'data: [DONE]\n\n'];
    globalThis.fetch = mock(() => Promise.resolve(mockSSEResponse(chunks))) as any;
    const result = await requestCompletionStream(makeConfig(), makeMessages(), { onDelta: () => {} });
    expect(result.text).toBe('Generic response');
  });

  it('通用格式: json.output_text', async () => {
    const chunks = [sseData(JSON.stringify({ output_text: 'Output text' })), 'data: [DONE]\n\n'];
    globalThis.fetch = mock(() => Promise.resolve(mockSSEResponse(chunks))) as any;
    const result = await requestCompletionStream(makeConfig(), makeMessages(), { onDelta: () => {} });
    expect(result.text).toBe('Output text');
  });

  it('空响应返回空字符串', async () => {
    const chunks = [sseData(JSON.stringify({})), 'data: [DONE]\n\n'];
    globalThis.fetch = mock(() => Promise.resolve(mockSSEResponse(chunks))) as any;
    const result = await requestCompletionStream(makeConfig(), makeMessages(), { onDelta: () => {} });
    expect(result.text).toBe('');
  });

  it('reasoning_content 被提取到 reasoning 字段', async () => {
    const chunks = [
      sseData(JSON.stringify({ choices: [{ delta: { reasoning_content: 'thinking...' } }] })),
      sseData(JSON.stringify({ choices: [{ delta: { content: 'answer' } }] })),
      'data: [DONE]\n\n',
    ];
    globalThis.fetch = mock(() => Promise.resolve(mockSSEResponse(chunks))) as any;
    const reasoning: string[] = [];
    const result = await requestCompletionStream(makeConfig(), makeMessages(), {
      onDelta: () => {},
      onReasoning: (r) => reasoning.push(r),
    });
    expect(result.text).toBe('answer');
    expect(result.reasoning).toBe('thinking...');
    expect(reasoning).toEqual(['thinking...']);
  });
});

// ═══ parseSSEStream — 增量式 vs 累积式 ═══

describe('parseSSEStream（增量式 vs 累积式）', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    try { localStorage.clear(); } catch { /* ignore */ }
  });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('增量式：每个 chunk 是增量内容', async () => {
    const chunks = [
      sseData(JSON.stringify({ choices: [{ delta: { content: 'A' } }] })),
      sseData(JSON.stringify({ choices: [{ delta: { content: 'B' } }] })),
      sseData(JSON.stringify({ choices: [{ delta: { content: 'C' } }] })),
      'data: [DONE]\n\n',
    ];
    globalThis.fetch = mock(() => Promise.resolve(mockSSEResponse(chunks))) as any;
    const deltas: string[] = [];
    const result = await requestCompletionStream(makeConfig(), makeMessages(), { onDelta: (d) => deltas.push(d) });
    expect(result.text).toBe('ABC');
    expect(deltas).toEqual(['A', 'B', 'C']);
  });

  it('累积式：每个 chunk 是全文（前缀包含关系）', async () => {
    const chunks = [
      sseData(JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] })),
      sseData(JSON.stringify({ choices: [{ delta: { content: 'Hello World' } }] })),
      'data: [DONE]\n\n',
    ];
    globalThis.fetch = mock(() => Promise.resolve(mockSSEResponse(chunks))) as any;
    const deltas: string[] = [];
    const result = await requestCompletionStream(makeConfig(), makeMessages(), { onDelta: (d) => deltas.push(d) });
    expect(result.text).toBe('Hello World');
    // 累积式：第二次 delta 应该是 ' World'
    expect(deltas).toEqual(['Hello', ' World']);
  });

  it('多个 data 行在同一个 \\n\\n 分隔块中', async () => {
    // 两个 data 行在同一个 chunk 中发送
    const chunk = sseData(JSON.stringify({ choices: [{ delta: { content: 'X' } }] })) + sseData(JSON.stringify({ choices: [{ delta: { content: 'Y' } }] }));
    globalThis.fetch = mock(() => Promise.resolve(mockSSEResponse([chunk, 'data: [DONE]\n\n']))) as any;
    const result = await requestCompletionStream(makeConfig(), makeMessages(), { onDelta: () => {} });
    expect(result.text).toBe('XY');
  });

  it('flush：最后一段不以 \\n\\n 结尾的内容也能被处理', async () => {
    // 最后一个 chunk 不带 \n\n
    const chunks = [
      sseData(JSON.stringify({ choices: [{ delta: { content: 'start' } }] })),
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'end' } }] })}`, // 没有 \n\n
    ];
    globalThis.fetch = mock(() => Promise.resolve(mockSSEResponse(chunks))) as any;
    const result = await requestCompletionStream(makeConfig(), makeMessages(), { onDelta: () => {} });
    expect(result.text).toBe('startend');
  });

  it('JSON 解析失败的行被跳过', async () => {
    const chunks = [
      sseData('{ invalid json }'),
      sseData(JSON.stringify({ choices: [{ delta: { content: 'valid' } }] })),
      'data: [DONE]\n\n',
    ];
    globalThis.fetch = mock(() => Promise.resolve(mockSSEResponse(chunks))) as any;
    const result = await requestCompletionStream(makeConfig(), makeMessages(), { onDelta: () => {} });
    expect(result.text).toBe('valid');
  });

  it('[DONE] 标记被正确跳过', async () => {
    const chunks = [
      sseData(JSON.stringify({ choices: [{ delta: { content: 'text' } }] })),
      'data: [DONE]\n\n',
      sseData(JSON.stringify({ choices: [{ delta: { content: 'after done' } }] })),
    ];
    globalThis.fetch = mock(() => Promise.resolve(mockSSEResponse(chunks))) as any;
    const result = await requestCompletionStream(makeConfig(), makeMessages(), { onDelta: () => {} });
    // [DONE] 被跳过，但后面的数据仍然处理
    expect(result.text).toBe('textafter done');
  });
});

// ═══ buildRequestBody — 通过 requestCompletion 间接测试 ═══

describe('buildRequestBody（通过 requestCompletion 间接测试）', () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchCalls: Array<{ url: string; init: RequestInit }>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchCalls = [];
    try { localStorage.clear(); } catch { /* ignore */ }
  });
  afterEach(() => { globalThis.fetch = originalFetch; });

  function captureFetch(response: Response) {
    globalThis.fetch = mock((url: string, init?: RequestInit) => {
      fetchCalls.push({ url, init: init || {} });
      return Promise.resolve(response);
    }) as any;
  }

  it('基本请求体包含 model, messages, temperature, stream', async () => {
    captureFetch(mockJSONResponse({ choices: [{ message: { content: 'response' } }] }));
    await requestCompletion(makeConfig({ temperature: 0.5 }), makeMessages());
    const body = JSON.parse(fetchCalls[0].init.body as string);
    expect(body.model).toBe('test-model');
    expect(body.messages).toEqual(makeMessages());
    expect(body.temperature).toBe(0.5);
    expect(body.stream).toBe(false);
  });

  it('options 覆盖 config 的 temperature', async () => {
    captureFetch(mockJSONResponse({ choices: [{ message: { content: 'r' } }] }));
    await requestCompletion(makeConfig({ temperature: 0.9 }), makeMessages(), { temperature: 0.1 });
    const body = JSON.parse(fetchCalls[0].init.body as string);
    expect(body.temperature).toBe(0.1);
  });

  it('maxTokens 被正确设置', async () => {
    captureFetch(mockJSONResponse({ choices: [{ message: { content: 'r' } }] }));
    await requestCompletion(makeConfig({ maxTokens: 1000 }), makeMessages());
    const body = JSON.parse(fetchCalls[0].init.body as string);
    expect(body.max_tokens).toBe(1000);
  });

  it('topP 和 topK 被正确设置', async () => {
    captureFetch(mockJSONResponse({ choices: [{ message: { content: 'r' } }] }));
    await requestCompletion(makeConfig({ topP: 0.8, topK: 40 }), makeMessages());
    const body = JSON.parse(fetchCalls[0].init.body as string);
    expect(body.top_p).toBe(0.8);
    expect(body.top_k).toBe(40);
  });

  it('responseFormat=json 时设置 response_format', async () => {
    captureFetch(mockJSONResponse({ choices: [{ message: { content: 'r' } }] }));
    await requestCompletion(makeConfig(), makeMessages(), { responseFormat: 'json' });
    const body = JSON.parse(fetchCalls[0].init.body as string);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('Authorization header 使用 Bearer token', async () => {
    captureFetch(mockJSONResponse({ choices: [{ message: { content: 'r' } }] }));
    await requestCompletion(makeConfig({ apiKey: 'my-secret-key' }), makeMessages());
    const headers = fetchCalls[0].init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-secret-key');
  });

  it('Content-Type 为 application/json', async () => {
    captureFetch(mockJSONResponse({ choices: [{ message: { content: 'r' } }] }));
    await requestCompletion(makeConfig(), makeMessages());
    const headers = fetchCalls[0].init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });
});

// ═══ requestCompletion — 错误处理 ═══

describe('requestCompletion 错误处理', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    try { localStorage.clear(); } catch { /* ignore */ }
  });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('非 200 响应抛出带状态码的错误', async () => {
    globalThis.fetch = mock(() => Promise.resolve(mockJSONResponse({ error: 'rate limited' }, 429))) as any;
    expect(requestCompletion(makeConfig(), makeMessages())).rejects.toThrow('429');
  });

  it('正确解析 choices[0].message.content', async () => {
    globalThis.fetch = mock(() => Promise.resolve(mockJSONResponse({
      choices: [{ message: { content: 'parsed response' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }))) as any;
    const result = await requestCompletion(makeConfig(), makeMessages());
    expect(result.text).toBe('parsed response');
    expect(result.usage?.totalTokens).toBe(15);
  });

  it('缺失 usage 时不报错', async () => {
    globalThis.fetch = mock(() => Promise.resolve(mockJSONResponse({
      choices: [{ message: { content: 'no usage' } }],
    }))) as any;
    const result = await requestCompletion(makeConfig(), makeMessages());
    expect(result.text).toBe('no usage');
    expect(result.usage).toBeUndefined();
  });
});

// ═══ withRetry — 通过 requestStreamWithRetry 间接测试 ═══

describe('withRetry（通过 requestStreamWithRetry 间接测试）', () => {
  let originalFetch: typeof globalThis.fetch;
  let originalSetTimeout: typeof globalThis.setTimeout;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalSetTimeout = globalThis.setTimeout;
    // 让 setTimeout 立即执行，避免测试中的真实延迟
    globalThis.setTimeout = ((cb: any) => { cb(); return 0 as any; }) as any;
    try { localStorage.clear(); } catch { /* ignore */ }
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  });

  it('可重试状态码 (429) — 第一次失败第二次成功', async () => {
    let callCount = 0;
    globalThis.fetch = mock(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(mockJSONResponse({ error: 'rate limited' }, 429));
      return Promise.resolve(mockSSEResponse([
        sseData(JSON.stringify({ choices: [{ delta: { content: 'success on retry' } }] })),
        'data: [DONE]\n\n',
      ]));
    }) as any;

    const result = await requestStreamWithRetry(makeConfig(), makeMessages(), { onDelta: () => {} });
    expect(result.text).toBe('success on retry');
    expect(callCount).toBe(2);
  });

  it('不可重试状态码 (400) — 直接抛出', async () => {
    let callCount = 0;
    globalThis.fetch = mock(() => {
      callCount++;
      return Promise.resolve(mockJSONResponse({ error: 'bad request' }, 400));
    }) as any;

    expect(requestStreamWithRetry(makeConfig(), makeMessages(), { onDelta: () => {} })).rejects.toThrow('400');
    // 等一下让 promise settle
    await new Promise(r => originalSetTimeout(r, 50));
    expect(callCount).toBe(1);
  });

  it('不可重试状态码 (401) — 直接抛出不重试', async () => {
    let callCount = 0;
    globalThis.fetch = mock(() => {
      callCount++;
      return Promise.resolve(mockJSONResponse({ error: 'unauthorized' }, 401));
    }) as any;

    expect(requestStreamWithRetry(makeConfig(), makeMessages(), { onDelta: () => {} })).rejects.toThrow('401');
    await new Promise(r => originalSetTimeout(r, 50));
    expect(callCount).toBe(1);
  });

  it('达到最大重试次数后抛出', async () => {
    let callCount = 0;
    globalThis.fetch = mock(() => {
      callCount++;
      return Promise.resolve(mockJSONResponse({ error: 'server error' }, 503));
    }) as any;

    expect(requestStreamWithRetry(makeConfig(), makeMessages(), { onDelta: () => {} })).rejects.toThrow('503');
    await new Promise(r => originalSetTimeout(r, 100));
    // 默认 maxRetries=3，所以总共 4 次（0,1,2,3）
    expect(callCount).toBe(4);
  });

  it('AbortError 不重试', async () => {
    const controller = new AbortController();
    controller.abort();
    // abort 后 requestStreamWithRetry 会立即抛出 DOMException('Aborted', 'AbortError')
    // toThrow 匹配 error.message，即 'Aborted'
    expect(requestStreamWithRetry(makeConfig(), makeMessages(), {
      onDelta: () => {},
      signal: controller.signal,
    })).rejects.toThrow('Aborted');
  });
});

// ═══ fetchModels ═══

describe('fetchModels', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    try { localStorage.clear(); } catch { /* ignore */ }
  });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('正确解析 OpenAI 格式的模型列表', async () => {
    globalThis.fetch = mock(() => Promise.resolve(mockJSONResponse({
      data: [{ id: 'gpt-4' }, { id: 'gpt-3.5-turbo' }, { name: 'custom-model' }],
    }))) as any;
    const result = await fetchModels(makeConfig({ baseUrl: 'https://api.openai.com/v1' }));
    expect(result).toEqual(['gpt-4', 'gpt-3.5-turbo', 'custom-model']);
  });

  it('正确解析 Google 格式的模型列表', async () => {
    globalThis.fetch = mock(() => Promise.resolve(mockJSONResponse({
      models: [{ name: 'gemini-pro' }, { name: 'gemini-flash' }],
    }))) as any;
    const result = await fetchModels(makeConfig({ provider: 'google', baseUrl: 'https://api.google.com/v1beta', apiKey: 'google-key' }));
    expect(result).toEqual(['gemini-pro', 'gemini-flash']);
  });

  it('非 200 响应抛出错误', async () => {
    globalThis.fetch = mock(() => Promise.resolve(mockJSONResponse({ error: 'unauthorized' }, 401))) as any;
    expect(fetchModels(makeConfig())).rejects.toThrow();
  });

  it('空模型列表返回空数组', async () => {
    globalThis.fetch = mock(() => Promise.resolve(mockJSONResponse({ data: [] }))) as any;
    const result = await fetchModels(makeConfig());
    expect(result).toEqual([]);
  });
});

// ═══ testConnection ═══

describe('testConnection', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    try { localStorage.clear(); } catch { /* ignore */ }
  });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('成功连接返回 success=true', async () => {
    globalThis.fetch = mock(() => Promise.resolve(mockJSONResponse({ choices: [{ message: { content: 'Hi' } }] }))) as any;
    const result = await testConnection(makeConfig());
    expect(result.success).toBe(true);
    expect(result.elapsed).toBeGreaterThanOrEqual(0);
  });

  it('失败连接返回 success=false 和错误消息', async () => {
    globalThis.fetch = mock(() => Promise.resolve(mockJSONResponse({ error: 'bad request' }, 400))) as any;
    const result = await testConnection(makeConfig());
    expect(result.success).toBe(false);
    expect(result.message).toContain('400');
  });

  it('网络错误返回友好错误消息', async () => {
    globalThis.fetch = mock(() => Promise.reject(new TypeError('Failed to fetch'))) as any;
    const result = await testConnection(makeConfig());
    expect(result.success).toBe(false);
    expect(result.message).toContain('网络请求失败');
  });
});

// ═══ normalizeMessages / mergeConsecutiveSameRole ═══

describe('normalizeMessages（DeepSeek 同角色合并）', () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchCalls: Array<{ init: RequestInit }>;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchCalls = [];
    try { localStorage.clear(); } catch { /* ignore */ }
  });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('DeepSeek provider 合并连续同角色消息', async () => {
    globalThis.fetch = mock((url: string, init?: RequestInit) => {
      fetchCalls.push({ init: init || {} });
      return Promise.resolve(mockJSONResponse({ choices: [{ message: { content: 'r' } }] }));
    }) as any;

    const messages: Message[] = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'system', content: 'Also be concise.' },
      { role: 'user', content: 'Hello' },
    ];
    await requestCompletion(makeConfig({ provider: 'deepseek' }), messages);
    const body = JSON.parse(fetchCalls[0].init.body as string);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].content).toContain('You are helpful.');
    expect(body.messages[0].content).toContain('Also be concise.');
    expect(body.messages[1].content).toBe('Hello');
  });

  it('非 DeepSeek provider 不合并', async () => {
    globalThis.fetch = mock((url: string, init?: RequestInit) => {
      fetchCalls.push({ init: init || {} });
      return Promise.resolve(mockJSONResponse({ choices: [{ message: { content: 'r' } }] }));
    }) as any;

    const messages: Message[] = [
      { role: 'system', content: 'A' },
      { role: 'system', content: 'B' },
    ];
    await requestCompletion(makeConfig({ provider: 'openai' }), messages);
    const body = JSON.parse(fetchCalls[0].init.body as string);
    expect(body.messages).toHaveLength(2);
  });
});
