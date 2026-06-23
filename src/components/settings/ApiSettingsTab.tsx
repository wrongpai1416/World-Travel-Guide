import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { fetchModels, testConnection } from '../../api/client';
import type { ApiConfig, ApiProvider } from '../../api/types';
import { Toggle } from './SettingsUIComponents';
import { type ApiPreset, loadPresets, savePresets } from './apiPresetUtils';
import { CheckCircle, XCircle, Trash2, Bot, HelpCircle, ExternalLink } from 'lucide-react';
import { STORAGE_KEYS } from '@/config/storageKeys';
import ProxyTutorialOverlay from './ProxyTutorialOverlay';

const PROVIDERS: { value: ApiProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI 兼容' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'google', label: 'Google AI' },
  { value: 'custom', label: '自定义' },
];

const REASONING_OPTIONS = ['关闭', 'low', 'medium', 'high'];

export interface ApiSettingsRef {
  getValues: () => { config: ApiConfig };
}

interface Props {
  initialConfig: ApiConfig | null;
  t: (key: string) => string;
  onSave?: () => void;
  onBack?: () => void;
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', padding: '10px 16px',
  borderBottom: '1px solid var(--border)', minHeight: '44px',
  flexWrap: 'wrap', gap: '8px',
};

const ApiSettingsTab = forwardRef<ApiSettingsRef, Props>(({ initialConfig, t, onSave, onBack }, ref) => {
  const [config, setConfig] = useState<ApiConfig>(
    initialConfig || { apiKey: '', baseUrl: '', model: '', provider: 'openai', temperature: 1.2, topP: 0.65, topK: 45, maxTokens: 60000, contextSize: 2000000, stream: true, reasoningEffort: '关闭' }
  );
  const [models, setModels] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [presets, setPresets] = useState<ApiPreset[]>(loadPresets);
  const [presetName, setPresetName] = useState('');
  const [proxyUrl, setProxyUrl] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_KEYS.PROXY_URL) || ''; } catch { return ''; }
  });
  const [showTutorial, setShowTutorial] = useState(false);

  useImperativeHandle(ref, () => ({
    getValues: () => ({ config }),
  }));

  const providerLabel = PROVIDERS.find(p => p.value === config.provider)?.label || config.provider;

  const set = <K extends keyof ApiConfig>(key: K, val: ApiConfig[K]) =>
    setConfig(prev => ({ ...prev, [key]: val }));

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult('');
    setTestSuccess(null);
    const result = await testConnection(config);
    setTestSuccess(result.success);
    setTestResult(result.message);
    setTesting(false);
  }, [config]);

  const handleApplyProxy = useCallback((url: string) => {
    setProxyUrl(url);
    try { localStorage.setItem(STORAGE_KEYS.PROXY_URL, url); } catch {}
  }, []);

  const handleFetchModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const list = await fetchModels(config);
      setModels(list);
      if (list.length > 0 && !config.model) set('model', list[0]);
    } catch (err: unknown) {
      setTestSuccess(false);
      setTestResult(`获取模型失败: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoadingModels(false);
  }, [config]);

  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) return;
    const preset: ApiPreset = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: presetName.trim(),
      config: { ...config },
      createdAt: Date.now(),
      rateLimitMs: config.rateLimitMs,
    };
    const next = [...presets, preset];
    setPresets(next);
    savePresets(next);
    setPresetName('');
  }, [presetName, config, presets]);

  const handleLoadPreset = useCallback((preset: ApiPreset) => {
    setConfig({ ...preset.config });
  }, []);

  const handleDeletePreset = useCallback((id: string) => {
    const next = presets.filter(p => p.id !== id);
    setPresets(next);
    savePresets(next);
  }, [presets]);

  return (
    <div style={{ maxWidth: '560px' }}>
      {/* ===== 参数配置 ===== */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontWeight: '600', fontSize: 'var(--font-size-md)' }}>参数配置</span>
          <select
            value={config.provider}
            onChange={e => set('provider', e.target.value as ApiProvider)}
            style={{
              padding: '4px 10px', border: '1px solid var(--border)', borderRadius: '6px',
              background: 'var(--bg-secondary)', color: 'var(--text-primary)',
              fontSize: 'var(--font-size-base)', cursor: 'pointer', outline: 'none',
            }}
          >
            {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>

          {/* 连接设置 + 预设 */}
          <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
            <div style={{ fontSize: 'var(--font-size-base)', fontWeight: '500', color: 'var(--text-secondary)' }}>
              预设配置
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                className="input-field"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                placeholder="预设名称"
                style={{ flex: 1, fontSize: 'var(--font-size-base)', padding: '5px 10px' }}
              />
              <button
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
                style={{
                  padding: '5px 14px', fontSize: 'var(--font-size-base)', whiteSpace: 'nowrap',
                  border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer',
                  background: presetName.trim() ? 'var(--bg-primary)' : 'var(--bg-tertiary)',
                  color: presetName.trim() ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                保存当前配置
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {presets.length === 0 ? (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', padding: '4px 0' }}>暂无预设</div>
              ) : (
                presets.map((p, i) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', width: '18px', textAlign: 'right' }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 'var(--font-size-base)', fontWeight: '500' }}>{p.name}</span>
                    <button
                      onClick={() => handleLoadPreset(p)}
                      style={{
                        border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 10px',
                        fontSize: 'var(--font-size-sm)', cursor: 'pointer', background: 'var(--bg-primary)', color: 'var(--text-primary)',
                      }}
                    >
                      加载
                    </button>
                    <button
                      onClick={() => handleDeletePreset(p.id)}
                      style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* API 端点 */}
          <div style={rowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--font-size-md)', fontWeight: '500' }}>API 端点</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '1px' }}>留空则使用官方默认地址</div>
            </div>
            <input
              className="input-field"
              value={config.baseUrl}
              onChange={e => set('baseUrl', e.target.value)}
              placeholder={config.provider === 'google' ? 'https://generativelanguage.googleapis.com' : 'https://api.openai.com'}
              style={{ maxWidth: '220px', width: '100%', minWidth: 0, fontSize: 'var(--font-size-base)', padding: '5px 10px' }}
            />
          </div>

          {/* API 密钥 */}
          <div style={rowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--font-size-md)', fontWeight: '500' }}>API 密钥</div>
            </div>
            <input
              className="input-field"
              type="password"
              value={config.apiKey}
              onChange={e => set('apiKey', e.target.value)}
              placeholder="sk-..."
              style={{ maxWidth: '220px', width: '100%', minWidth: 0, fontSize: 'var(--font-size-base)', padding: '5px 10px' }}
            />
          </div>

          {/* 代理设置 */}
          <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-md)', fontWeight: '500' }}>代理地址（可选）</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                  解决网页端 CORS 跨域问题，桌面版无需设置
                </div>
              </div>
              <button
                onClick={() => setShowTutorial(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '6px',
                  color: '#818cf8',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; }}
              >
                <HelpCircle size={14} />
                如何部署？
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                className="input-field"
                value={proxyUrl}
                onChange={e => {
                  setProxyUrl(e.target.value);
                  try { localStorage.setItem(STORAGE_KEYS.PROXY_URL, e.target.value); } catch {}
                }}
                placeholder="https://你的worker名字.workers.dev"
                style={{ flex: 1, fontSize: 'var(--font-size-base)', padding: '5px 10px' }}
              />
            </div>
            {proxyUrl && (
              <div style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--text-muted)',
                padding: '8px 10px',
                background: 'var(--bg-tertiary)',
                borderRadius: '6px',
              }}>
                ✅ 代理已启用：{proxyUrl}
              </div>
            )}
          </div>

          {/* 模型设置 */}
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-tertiary)', fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--text-muted)' }}>
            模型设置
          </div>

          <div style={rowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--font-size-md)', fontWeight: '500' }}>模型名称</div>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                className="input-field"
                value={config.model}
                onChange={e => set('model', e.target.value)}
                placeholder="gpt-4o"
                style={{ maxWidth: '150px', width: '100%', minWidth: 0, fontSize: 'var(--font-size-base)', padding: '5px 10px' }}
              />
              <button
                onClick={handleFetchModels}
                disabled={loadingModels}
                style={{
                  padding: '5px 10px', fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap',
                  border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer',
                  background: 'var(--bg-primary)', color: 'var(--text-primary)',
                }}
              >
                {loadingModels ? '...' : '获取'}
              </button>
            </div>
          </div>

          {models.length > 0 && (
            <div style={{ padding: '8px 16px 12px', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {models.map(m => (
                <button
                  key={m}
                  onClick={() => { set('model', m); setModels([]); }}
                  style={{
                    padding: '4px 12px', fontSize: 'var(--font-size-sm)', borderRadius: '14px', cursor: 'pointer',
                    border: '1px solid var(--border)', background: m === config.model ? 'var(--accent-dim)' : 'var(--bg-primary)',
                    color: m === config.model ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: m === config.model ? '600' : '400',
                    transition: 'all 0.15s',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          {/* 高级参数 */}
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-tertiary)', fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--text-muted)' }}>
            高级参数
          </div>

          {/* 流式响应 */}
          <div style={rowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--font-size-md)', fontWeight: '500' }}>流式响应</div>
            </div>
            <Toggle value={config.stream !== false} onChange={v => set('stream', v)} />
          </div>

          {/* 上下文大小 */}
          <div style={rowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--font-size-md)', fontWeight: '500' }}>上下文大小 (Context Size)</div>
            </div>
            <input
              type="number"
              value={config.contextSize ?? 2000000}
              onChange={e => set('contextSize', parseInt(e.target.value) || 0)}
              style={{ width: '110px', fontSize: 'var(--font-size-base)', padding: '5px 10px', textAlign: 'right', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>

          {/* 最大响应 */}
          <div style={rowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--font-size-md)', fontWeight: '500' }}>最大响应 (Response Tokens)</div>
            </div>
            <input
              type="number"
              value={config.maxTokens ?? 60000}
              onChange={e => set('maxTokens', parseInt(e.target.value) || 0)}
              style={{ width: '110px', fontSize: 'var(--font-size-base)', padding: '5px 10px', textAlign: 'right', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>

          {/* 随机性 */}
          <div style={rowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--font-size-md)', fontWeight: '500' }}>随机性 (Temperature)</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="range" min="0" max="2" step="0.05"
                value={config.temperature ?? 1.2}
                onChange={e => set('temperature', parseFloat(e.target.value))}
                style={{ width: '100px' }}
              />
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', width: '32px', textAlign: 'right' }}>
                {(config.temperature ?? 1.2).toFixed(2)}
              </span>
            </div>
          </div>

          {/* 核采样 */}
          <div style={rowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--font-size-md)', fontWeight: '500' }}>核采样 (Top P)</div>
            </div>
            <input
              type="number"
              step="0.01"
              value={config.topP ?? 0.65}
              onChange={e => set('topP', parseFloat(e.target.value) || 0)}
              style={{ width: '110px', fontSize: 'var(--font-size-base)', padding: '5px 10px', textAlign: 'right', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>

          {/* Top K */}
          <div style={rowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--font-size-md)', fontWeight: '500' }}>Top K</div>
            </div>
            <input
              type="number"
              value={config.topK ?? 45}
              onChange={e => set('topK', parseInt(e.target.value) || 0)}
              style={{ width: '110px', fontSize: 'var(--font-size-base)', padding: '5px 10px', textAlign: 'right', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>

          {/* 推理强度 */}
          <div style={rowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--font-size-md)', fontWeight: '500' }}>推理强度 (Reasoning Effort)</div>
            </div>
            <select
              value={config.reasoningEffort ?? '关闭'}
              onChange={e => set('reasoningEffort', e.target.value)}
              style={{
                padding: '5px 10px', border: '1px solid var(--border)', borderRadius: '6px',
                background: 'var(--bg-primary)', color: 'var(--text-primary)',
                fontSize: 'var(--font-size-base)', cursor: 'pointer', outline: 'none',
              }}
            >
              {REASONING_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          {/* API 限流间隔 */}
          <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-md)', fontWeight: '500' }}>API 限流间隔</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                  每次 API 调用之间的最小间隔，避免触发 429 限流错误
                </div>
              </div>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--accent)', fontWeight: '600' }}>
                {config.rateLimitMs ?? 10000}ms
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="range"
                min="1000"
                max="30000"
                step="1000"
                value={config.rateLimitMs ?? 10000}
                onChange={e => set('rateLimitMs', parseInt(e.target.value))}
                style={{ flex: 1 }}
              />
              <button
                onClick={async () => {
                  // 自动调试
                  const { detectOptimalRateLimit } = await import('../../api/rateLimiter');
                  const { requestCompletion } = await import('../../api/client');

                  const testCall = async () => {
                    await requestCompletion(
                      { ...config, provider: 'openai' },
                      [{ role: 'user', content: 'Hi' }],
                      { maxTokens: 5 }
                    );
                  };

                  const recommended = await detectOptimalRateLimit(testCall);

                  set('rateLimitMs', recommended);
                }}
                style={{
                  padding: '5px 12px', fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap',
                  border: '1px solid var(--accent)', borderRadius: '6px', cursor: 'pointer',
                  background: 'var(--accent-dim)', color: 'var(--accent)',
                }}
              >
                自动调试
              </button>
            </div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {[1000, 2000, 5000, 10000, 15000, 20000].map(ms => (
                <button
                  key={ms}
                  onClick={() => set('rateLimitMs', ms)}
                  style={{
                    padding: '3px 10px', fontSize: 'var(--font-size-xs)',
                    border: `1px solid ${(config.rateLimitMs ?? 10000) === ms ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: '12px', cursor: 'pointer',
                    background: (config.rateLimitMs ?? 10000) === ms ? 'var(--accent-dim)' : 'var(--bg-primary)',
                    color: (config.rateLimitMs ?? 10000) === ms ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  {ms >= 1000 ? `${ms / 1000}s` : `${ms}ms`}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* 代理教程覆盖层 */}
      {showTutorial && (
        <ProxyTutorialOverlay
          onClose={() => setShowTutorial(false)}
          onApplyProxy={handleApplyProxy}
        />
      )}

      {/* 底部按钮 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={handleTest}
          disabled={testing}
          style={{
            padding: '8px 18px', fontSize: 'var(--font-size-md)', fontWeight: '500',
            border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer',
            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
          }}
        >
          {testing ? t('settings.testing') : '测试连接'}
        </button>
        {testResult && (
          <span style={{ fontSize: 'var(--font-size-base)', flex: 1, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {testSuccess === true && <CheckCircle size={14} color="var(--success)" style={{ flexShrink: 0 }} />}
            {testSuccess === false && <XCircle size={14} color="var(--danger)" style={{ flexShrink: 0 }} />}
            {testResult}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {onBack && (
          <button
            onClick={onBack}
            style={{
              padding: '8px 20px', fontSize: 'var(--font-size-md)', fontWeight: '500',
              border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer',
              background: 'var(--bg-secondary)', color: 'var(--text-primary)',
            }}
          >
            返回
          </button>
        )}
        {onSave && (
          <button
            onClick={onSave}
            style={{
              padding: '8px 28px', fontSize: 'var(--font-size-md)', fontWeight: '600',
              border: 'none', borderRadius: '8px', cursor: 'pointer',
              background: 'var(--accent)', color: '#fff',
            }}
          >
            保存配置
          </button>
        )}
      </div>
    </div>
  );
});

export default ApiSettingsTab;
