// 生图设置 Tab
import { useState, useCallback } from 'react';
import { useImageStore } from '@/stores/imageStore';
import { useImageGen } from '@/hooks/useImageGen';
import {
  Section,
  SettingRow,
  SegmentedControl,
  Toggle,
  FieldGrid,
  Field,
  TextArea,
  Select,
  Slider,
  Button,
} from './SettingsUIComponents';
import {
  NAI_MODELS,
  NAI_SAMPLERS,
  NAI_RESOLUTIONS,
  UC_PRESETS,
  OPENAI_COMPATIBLE_IMAGE_PROVIDERS,
  DEFAULT_IMAGE_CONFIG,
  type ImageEngine,
} from '@/api/imageGenTypes';
import { ImageIcon, Key, Cpu, Globe, Wand2, Users, Zap } from 'lucide-react';

export default function ImageGenSettingsTab() {
  const config = useImageStore((s) => s.config);
  const updateConfig = useImageStore((s) => s.updateConfig);
  const setConfig = useImageStore((s) => s.setConfig);
  const { loadComfyUIData, comfyData } = useImageGen();
  const [connectingComfy, setConnectingComfy] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const engineOptions = [
    { label: 'NovelAI', value: 'nai' },
    { label: 'ComfyUI', value: 'comfyui' },
    { label: '其他', value: 'openai_compatible' },
  ];

  const handleComfyConnect = useCallback(async () => {
    setConnectingComfy(true);
    try {
      await loadComfyUIData(config.comfyUrl);
    } catch {
      // error logged in hook
    }
    setConnectingComfy(false);
  }, [config.comfyUrl, loadComfyUIData]);

  const naiModelOptions = Object.entries(NAI_MODELS).map(([value, info]) => ({
    label: info.label + (info.recommended ? ' ★' : ''),
    value,
  }));

  const naiSamplerOptions = NAI_SAMPLERS.map((s) => ({ label: s, value: s }));

  const naiResolutionOptions = Object.entries(NAI_RESOLUTIONS).map(([value, info]) => ({
    label: info.label,
    value,
  }));

  const ucPresetOptions = UC_PRESETS.map((p) => ({ label: p.label, value: String(p.value) }));

  const openaiProviderOptions = Object.entries(OPENAI_COMPATIBLE_IMAGE_PROVIDERS).map(([value, info]) => ({
    label: info.label,
    value,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ─── 正文生图 ─── */}
      <Section icon={<ImageIcon size={16} />} title="正文生图">
        <SettingRow label="启用正文生图" desc="开启后，正文中的 image###提示词### 标签将变为「点击生图」按钮">
          <Toggle value={config.inlineImageEnabled} onChange={(v) => updateConfig('inlineImageEnabled', v)} />
        </SettingRow>
        {config.inlineImageEnabled && (
          <>
            <SettingRow label="自动点击生图" desc="视图内可见的「点击生图」按钮将自动触发生成">
              <Toggle value={config.autoClickImageGen} onChange={(v) => updateConfig('autoClickImageGen', v)} />
            </SettingRow>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <Field label="识别正则" hint="用于匹配正文中生图标签的正则表达式，第一个捕获组为提示词">
                <input
                  className="input-field"
                  style={{ width: '100%', padding: '6px 10px' }}
                  value={config.inlineImageRegex}
                  onChange={(e) => updateConfig('inlineImageRegex', e.target.value)}
                  placeholder="image###([\s\S]+?)###"
                />
              </Field>
            </div>
          </>
        )}
      </Section>

      {/* ─── 角色画像 ─── */}
      <Section icon={<Users size={16} />} title="角色画像生成">
        <SettingRow label="启用自动画像生成" desc="新增 NPC 时自动调用 API 分析角色特征，生成画像">
          <Toggle value={config.characterPortraitEnabled} onChange={(v) => updateConfig('characterPortraitEnabled', v)} />
        </SettingRow>
        {config.characterPortraitEnabled && (
          <>
            <SettingRow label="人物画像自动更新" desc="NPC 外貌变化时自动重新生成画像">
              <Toggle
                value={config.characterPortraitAutoUpdateEnabled}
                onChange={(v) => updateConfig('characterPortraitAutoUpdateEnabled', v)}
              />
            </SettingRow>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <Field label="画像提示词模板" hint="自定义发送给主 API 的提示词模板。支持宏变量：{{characterToon}} 角色完整信息。留空使用默认模板。">
                <TextArea
                  value={config.characterPortraitPromptTemplate}
                  onChange={(v) => updateConfig('characterPortraitPromptTemplate', v)}
                  placeholder="留空使用默认 NovelAI 4.5 标签模板"
                  rows={4}
                />
              </Field>
            </div>
          </>
        )}
      </Section>

      {/* ─── 引擎选择 ─── */}
      <Section icon={<Cpu size={16} />} title="连接设置">
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <SegmentedControl
            options={engineOptions}
            value={config.engine}
            onChange={(v) => updateConfig('engine', v as ImageEngine)}
          />
        </div>

        {/* ─── NovelAI 设置 ─── */}
        {config.engine === 'nai' && (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <Field label="NovelAI API Key" hint="在 NovelAI 账号设置中获取 API Key">
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="input-field"
                    type={showApiKey ? 'text' : 'password'}
                    style={{ flex: 1, padding: '6px 10px' }}
                    value={config.apiKey}
                    onChange={(e) => updateConfig('apiKey', e.target.value)}
                    placeholder="pst-..."
                  />
                  <Button onClick={() => setShowApiKey(!showApiKey)}>{showApiKey ? '隐藏' : '显示'}</Button>
                </div>
              </Field>
            </div>
            <FieldGrid>
              <Field label="模型">
                <Select options={naiModelOptions} value={config.model} onChange={(v) => updateConfig('model', v)} width="100%" />
              </Field>
              <Field label="采样器">
                <Select options={naiSamplerOptions} value={config.sampler} onChange={(v) => updateConfig('sampler', v)} width="100%" />
              </Field>
              <Field label="分辨率">
                <Select options={naiResolutionOptions} value={config.resolution} onChange={(v) => updateConfig('resolution', v)} width="100%" />
              </Field>
              <Field label="UC Preset">
                <Select options={ucPresetOptions} value={String(config.ucPreset)} onChange={(v) => updateConfig('ucPreset', Number(v))} width="100%" />
              </Field>
            </FieldGrid>
            <FieldGrid>
              <Slider label="Steps" value={config.steps} onChange={(v) => updateConfig('steps', v)} min={1} max={50} />
              <Slider label="CFG Scale" value={config.scale} onChange={(v) => updateConfig('scale', v)} min={0} max={30} step={0.5} />
            </FieldGrid>
            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
              <SettingRow label="Quality Toggle" desc="自动添加质量标签 (masterpiece, best quality)">
                <Toggle value={config.qualityToggle} onChange={(v) => updateConfig('qualityToggle', v)} />
              </SettingRow>
            </div>
          </>
        )}

        {/* ─── ComfyUI 设置 ─── */}
        {config.engine === 'comfyui' && (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <Field label="ComfyUI API 地址" hint="如跨域访问，ComfyUI 启动时需加 --cors 参数">
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="input-field"
                    style={{ flex: 1, padding: '6px 10px' }}
                    value={config.comfyUrl}
                    onChange={(e) => updateConfig('comfyUrl', e.target.value)}
                    placeholder="http://localhost:8188"
                  />
                  <Button onClick={handleComfyConnect} disabled={connectingComfy} primary>
                    {connectingComfy ? '连接中...' : '连接并刷新'}
                  </Button>
                </div>
              </Field>
            </div>
            <FieldGrid>
              <Field label="模型文件">
                <Select
                  options={comfyData.models.map((m) => ({ label: m, value: m }))}
                  value={config.comfyModel}
                  onChange={(v) => updateConfig('comfyModel', v)}
                  width="100%"
                />
              </Field>
              <Field label="采样器">
                <Select
                  options={comfyData.samplers.map((s) => ({ label: s, value: s }))}
                  value={config.comfySampler}
                  onChange={(v) => updateConfig('comfySampler', v)}
                  width="100%"
                />
              </Field>
              <Field label="调度器">
                <Select
                  options={comfyData.schedulers.map((s) => ({ label: s, value: s }))}
                  value={config.comfyScheduler}
                  onChange={(v) => updateConfig('comfyScheduler', v)}
                  width="100%"
                />
              </Field>
              <Field label="VAE">
                <Select
                  options={[{ label: '默认 (baked)', value: '' }, ...comfyData.vaes.map((v) => ({ label: v, value: v }))]}
                  value={config.comfyVae}
                  onChange={(v) => updateConfig('comfyVae', v)}
                  width="100%"
                />
              </Field>
            </FieldGrid>
            <FieldGrid>
              <Slider label="Steps" value={config.steps} onChange={(v) => updateConfig('steps', v)} min={1} max={50} />
              <Slider label="CFG Scale" value={config.scale} onChange={(v) => updateConfig('scale', v)} min={0} max={30} step={0.5} />
            </FieldGrid>
            {/* LoRA */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <Field label="LoRA" hint="添加 LoRA 模型（需先连接 ComfyUI 获取列表）">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {config.comfyLoras.map((lora, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select
                        className="input-field"
                        style={{ flex: 1, padding: '6px 10px' }}
                        value={lora.name}
                        onChange={(e) => {
                          const newLoras = [...config.comfyLoras];
                          newLoras[idx] = { ...lora, name: e.target.value };
                          updateConfig('comfyLoras', newLoras);
                        }}
                      >
                        <option value="">选择 LoRA...</option>
                        {comfyData.loras.map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                      <input
                        className="input-field"
                        type="number"
                        style={{ width: '70px', padding: '6px 10px' }}
                        value={lora.strength_model}
                        step={0.1}
                        title="Model Strength"
                        onChange={(e) => {
                          const newLoras = [...config.comfyLoras];
                          newLoras[idx] = { ...lora, strength_model: Number(e.target.value) };
                          updateConfig('comfyLoras', newLoras);
                        }}
                      />
                      <input
                        className="input-field"
                        type="number"
                        style={{ width: '70px', padding: '6px 10px' }}
                        value={lora.strength_clip}
                        step={0.1}
                        title="Clip Strength"
                        onChange={(e) => {
                          const newLoras = [...config.comfyLoras];
                          newLoras[idx] = { ...lora, strength_clip: Number(e.target.value) };
                          updateConfig('comfyLoras', newLoras);
                        }}
                      />
                      <Button
                        onClick={() => {
                          const newLoras = config.comfyLoras.filter((_, i) => i !== idx);
                          updateConfig('comfyLoras', newLoras);
                        }}
                      >
                        删除
                      </Button>
                    </div>
                  ))}
                  <Button
                    onClick={() => {
                      updateConfig('comfyLoras', [
                        ...config.comfyLoras,
                        { name: '', strength_model: 1.0, strength_clip: 1.0 },
                      ]);
                    }}
                    primary
                  >
                    + 添加 LoRA
                  </Button>
                </div>
              </Field>
            </div>
          </>
        )}

        {/* ─── OpenAI 兼容设置 ─── */}
        {config.engine === 'openai_compatible' && (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <Field label="服务商" hint="切换服务商会自动填入默认兼容地址">
                <Select
                  options={openaiProviderOptions}
                  value={config.openaiCompatibleProvider}
                  onChange={(v) => {
                    updateConfig('openaiCompatibleProvider', v);
                    const providerInfo = OPENAI_COMPATIBLE_IMAGE_PROVIDERS[v];
                    if (providerInfo?.defaultApiUrl && !config.openaiCompatibleApiUrl) {
                      updateConfig('openaiCompatibleApiUrl', providerInfo.defaultApiUrl);
                    }
                    if (providerInfo?.modelPlaceholder && !config.openaiCompatibleModel) {
                      updateConfig('openaiCompatibleModel', providerInfo.modelPlaceholder);
                    }
                  }}
                  width="100%"
                />
              </Field>
            </div>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <Field label="兼容 API 地址" hint="填写基础地址即可，发送请求时会自动补到 /images/generations">
                <input
                  className="input-field"
                  style={{ width: '100%', padding: '6px 10px' }}
                  value={config.openaiCompatibleApiUrl}
                  onChange={(e) => updateConfig('openaiCompatibleApiUrl', e.target.value)}
                  placeholder={OPENAI_COMPATIBLE_IMAGE_PROVIDERS[config.openaiCompatibleProvider]?.defaultApiUrl || 'https://api.example.com/v1'}
                />
              </Field>
            </div>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <Field label="兼容 API Key">
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="input-field"
                    type={showApiKey ? 'text' : 'password'}
                    style={{ flex: 1, padding: '6px 10px' }}
                    value={config.openaiCompatibleApiKey}
                    onChange={(e) => updateConfig('openaiCompatibleApiKey', e.target.value)}
                    placeholder="sk-..."
                  />
                  <Button onClick={() => setShowApiKey(!showApiKey)}>{showApiKey ? '隐藏' : '显示'}</Button>
                </div>
              </Field>
            </div>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <Field label="模型">
                <input
                  className="input-field"
                  style={{ width: '100%', padding: '6px 10px' }}
                  value={config.openaiCompatibleModel}
                  onChange={(e) => updateConfig('openaiCompatibleModel', e.target.value)}
                  placeholder={OPENAI_COMPATIBLE_IMAGE_PROVIDERS[config.openaiCompatibleProvider]?.modelPlaceholder || 'your-image-model'}
                />
              </Field>
            </div>
          </>
        )}
      </Section>

      {/* ─── 全局提示词 ─── */}
      <Section icon={<Wand2 size={16} />} title="全局提示词">
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <Field label="正向提示词" hint="会自动与每次请求的提示词合并去重">
            <TextArea
              value={config.positivePrompt}
              onChange={(v) => updateConfig('positivePrompt', v)}
              placeholder="masterpiece, best quality, very aesthetic, absurdres"
              rows={3}
            />
          </Field>
        </div>
        <div style={{ padding: '12px 16px' }}>
          <Field label="负向提示词" hint="会自动与每次请求的负向提示词合并去重">
            <TextArea
              value={config.negativePrompt}
              onChange={(v) => updateConfig('negativePrompt', v)}
              placeholder={DEFAULT_IMAGE_CONFIG.negativePrompt}
              rows={3}
            />
          </Field>
        </div>
      </Section>

      {/* ─── 重置按钮 ─── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 0' }}>
        <Button onClick={() => setConfig({ ...DEFAULT_IMAGE_CONFIG })}>恢复默认设置</Button>
      </div>
    </div>
  );
}
