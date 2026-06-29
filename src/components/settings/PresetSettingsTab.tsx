// 预设管理 Tab — 预设列表 + 覆盖层编辑器（条目 + 正则一体化）
import { useState, useRef, useCallback } from 'react';
import {
  FileText, Upload, Download, Trash2, Plus, X,
  ChevronDown, ChevronRight, ToggleLeft, ToggleRight,
  GripVertical, Eye, EyeOff,
} from 'lucide-react';
import { usePresetStore } from '@/stores/presetStore';
import { getBuiltinPresets, getBuiltinPreset } from '@/data/builtinPresets';
import type { PresetPack, PresetPromptEntry } from '@/data/builtinPresets';
import type { RegexScript } from '@/utils/regexScripts';
import { exportPresetJSON, parsePresetJSON, downloadJSON, parseRegexScriptsJSON } from '@/utils/presetIO';
import { v4 as uuid } from 'uuid';
import { Button, Toggle, Field } from './SettingsUIComponents';
import { useDialog } from '../shared/Dialog';

export default function PresetSettingsTab() {
  const { userPresets, activePresetId, builtinOverrides, savePreset, deletePreset, setActivePreset, resetToDefault, saveBuiltinOverride, restoreBuiltinDefaults } = usePresetStore();
  const { DialogUI, confirm: dlgConfirm } = useDialog();
  const [editingPreset, setEditingPreset] = useState<PresetPack | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const builtinPresets = getBuiltinPresets();
  const isActiveDefault = activePresetId === null;

  // ─── 预设导入 ───
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const result = parsePresetJSON(text);
      if (result.ok) {
        savePreset(result.data);
        setActivePreset(result.data.id);
        setEditingPreset(result.data);
        setError('');
      } else {
        setError(result.error);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [savePreset, setActivePreset]);

  const handleExport = useCallback((pack: PresetPack) => {
    const json = exportPresetJSON(pack);
    downloadJSON(json, `preset_${pack.name || 'unnamed'}.json`);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!await dlgConfirm('确定要删除这个预设吗？', { danger: true, confirmText: '删除' })) return;
    deletePreset(id);
    if (editingPreset?.id === id) setEditingPreset(null);
  }, [deletePreset, editingPreset, dlgConfirm]);

  // ─── 主列表视图 ───
  if (!editingPreset) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {DialogUI}
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <FileText size={18} />
          <span style={{ fontWeight: '600', fontSize: 'var(--font-size-lg)' }}>预设管理</span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button onClick={() => fileRef.current?.click()} icon={<Upload size={14} />}>导入预设</Button>
        </div>

        {error && (
          <div style={{ padding: '8px 12px', background: 'var(--danger-dim, #3a1c1c)', border: '1px solid var(--danger)', borderRadius: '6px', fontSize: 'var(--font-size-sm)', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {/* 内置预设 */}
        {builtinPresets.map(bp => (
          <PresetCard
            key={bp.id}
            name={`${bp.name}（内置）`}
            desc={bp.description || ''}
            promptCount={bp.prompts?.length || 0}
            regexCount={bp.regexScripts?.length || 0}
            active={bp.id === 'default' ? isActiveDefault : activePresetId === bp.id}
            builtin
            onSelect={() => {
              if (bp.id === 'default') resetToDefault();
              else setActivePreset(bp.id);
            }}
            onExport={() => handleExport(bp)}
            onEdit={() => setEditingPreset(bp)}
          />
        ))}

        {/* 用户预设 */}
        {userPresets.map(pack => (
          <PresetCard
            key={pack.id}
            name={pack.name}
            desc={pack.description || ''}
            promptCount={pack.prompts?.length || 0}
            regexCount={pack.regexScripts?.length || 0}
            active={activePresetId === pack.id}
            onSelect={() => setActivePreset(pack.id)}
            onExport={() => handleExport(pack)}
            onDelete={() => handleDelete(pack.id)}
            onEdit={() => setEditingPreset(pack)}
          />
        ))}
      </div>
    );
  }

  // ─── 编辑覆盖层 ───
  const isBuiltin = builtinPresets.some(bp => bp.id === editingPreset.id);

  // 对内置预设，应用覆盖层后显示
  const displayPreset = isBuiltin
    ? {
        ...editingPreset,
        prompts: editingPreset.prompts.map(p => {
          const override = builtinOverrides[editingPreset.id]?.[p.identifier];
          return override !== undefined ? { ...p, enabled: override } : p;
        }),
      }
    : editingPreset;

  return (
    <PresetEditorOverlay
      preset={displayPreset}
      builtin={isBuiltin}
      onClose={() => setEditingPreset(null)}
      onSave={(updated) => {
        if (isBuiltin) {
          // 内置预设：只保存变化的条目覆盖
          for (const p of updated.prompts) {
            const original = editingPreset.prompts.find(op => op.identifier === p.identifier);
            if (original && p.enabled !== original.enabled) {
              saveBuiltinOverride(editingPreset.id, p.identifier, p.enabled);
            }
          }
          // 更新显示状态
          const newDisplay = {
            ...editingPreset,
            prompts: editingPreset.prompts.map(p => {
              const override = builtinOverrides[editingPreset.id]?.[p.identifier];
              const newEntry = updated.prompts.find(up => up.identifier === p.identifier);
              if (newEntry) return { ...p, enabled: newEntry.enabled };
              return override !== undefined ? { ...p, enabled: override } : p;
            }),
          };
          setEditingPreset(newDisplay);
          setActivePreset(editingPreset.id);
        } else {
          savePreset(updated);
          setActivePreset(updated.id);
          setEditingPreset(updated);
        }
      }}
      onRestoreDefaults={isBuiltin ? () => {
        restoreBuiltinDefaults(editingPreset.id);
        // 重新加载原始内置预设
        const original = getBuiltinPreset(editingPreset.id);
        setEditingPreset(original);
        setActivePreset(editingPreset.id);
      } : undefined}
    />
  );
}

// ═══════════════════════════════════════════════
// 预设卡片
// ═══════════════════════════════════════════════

function PresetCard({ name, desc, promptCount, regexCount, active, builtin, onSelect, onExport, onDelete, onEdit }: {
  name: string; desc: string; promptCount: number; regexCount: number;
  active: boolean; builtin?: boolean;
  onSelect: () => void; onExport: () => void; onDelete?: () => void; onEdit: () => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '12px 14px', borderRadius: '10px',
      border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
      background: active ? 'var(--accent-dim, rgba(234,179,8,0.08))' : 'var(--bg-secondary)',
      cursor: 'pointer', transition: 'border-color 0.15s',
    }} onClick={onSelect}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: '600', fontSize: 'var(--font-size-md)' }}>
          {active && <span style={{ color: 'var(--accent)', marginRight: '6px' }}>●</span>}
          {name}
        </div>
        {desc && <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</div>}
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '12px' }}>
          <span>📝 {promptCount} 条目</span>
          <span>🔧 {regexCount} 正则</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} style={iconBtnStyle} title="编辑">
          <FileText size={14} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onExport(); }} style={iconBtnStyle} title="导出">
          <Download size={14} />
        </button>
        {onDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ ...iconBtnStyle, color: 'var(--danger)' }} title="删除">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// 预设编辑覆盖层 — 条目 + 正则一体化
// ═══════════════════════════════════════════════

function PresetEditorOverlay({ preset, builtin, onClose, onSave, onRestoreDefaults }: {
  preset: PresetPack; builtin: boolean;
  onClose: () => void; onSave: (p: PresetPack) => void;
  onRestoreDefaults?: () => void;
}) {
  const { DialogUI, confirm: dlgConfirm } = useDialog();
  const [tab, setTab] = useState<'prompts' | 'regex'>('prompts');
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [expandedRegex, setExpandedRegex] = useState<number | null>(null);
  const regexFileRef = useRef<HTMLInputElement>(null);

  // 恢复内置预设默认值
  const handleRestoreDefaults = useCallback(async () => {
    if (!await dlgConfirm('确定要恢复默认设置吗？所有条目将重置为初始状态。', { confirmText: '恢复默认' })) return;
    if (onRestoreDefaults) {
      onRestoreDefaults();
    } else {
      const original = getBuiltinPreset(preset.id);
      onSave({ ...original, builtin: true });
    }
  }, [preset.id, onSave, onRestoreDefaults]);

  // ─── 条目操作 ───
  const togglePrompt = useCallback((identifier: string) => {
    const prompts = preset.prompts.map(p =>
      p.identifier === identifier ? { ...p, enabled: !p.enabled } : p
    );
    onSave({ ...preset, prompts });
  }, [preset, onSave]);

  const updatePrompt = useCallback((identifier: string, patch: Partial<PresetPromptEntry>) => {
    const prompts = preset.prompts.map(p =>
      p.identifier === identifier ? { ...p, ...patch } : p
    );
    onSave({ ...preset, prompts });
  }, [preset, onSave]);

  const addPrompt = useCallback(() => {
    const id = `custom_${uuid().slice(0, 8)}`;
    const maxOrder = preset.prompts.reduce((max, p) => Math.max(max, p.order), 0);
    const newEntry: PresetPromptEntry = {
      identifier: id,
      name: '新条目',
      role: 'system',
      content: '',
      enabled: true,
      triggerMode: 'blue',
      order: maxOrder + 1,
    };
    onSave({ ...preset, prompts: [...preset.prompts, newEntry] });
    setExpandedPrompt(id);
  }, [preset, onSave]);

  const deletePrompt = useCallback((identifier: string) => {
    onSave({ ...preset, prompts: preset.prompts.filter(p => p.identifier !== identifier) });
    if (expandedPrompt === identifier) setExpandedPrompt(null);
  }, [preset, onSave, expandedPrompt]);

  // ─── 正则操作 ───
  const addRegex = useCallback(() => {
    const newScript: RegexScript = {
      id: uuid(), scriptName: '新正则', findRegex: '', replaceString: '',
      placement: [2], disabled: false, markdownOnly: false, promptOnly: false,
    };
    onSave({ ...preset, regexScripts: [...preset.regexScripts, newScript] });
    setExpandedRegex(preset.regexScripts.length);
  }, [preset, onSave]);

  const updateRegex = useCallback((idx: number, patch: Partial<RegexScript>) => {
    const scripts = [...preset.regexScripts];
    scripts[idx] = { ...scripts[idx], ...patch };
    onSave({ ...preset, regexScripts: scripts });
  }, [preset, onSave]);

  const deleteRegex = useCallback((idx: number) => {
    onSave({ ...preset, regexScripts: preset.regexScripts.filter((_, i) => i !== idx) });
    if (expandedRegex === idx) setExpandedRegex(null);
  }, [preset, onSave, expandedRegex]);

  const handleImportRegex = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = parseRegexScriptsJSON(String(reader.result || ''));
      if (result.ok) {
        onSave({ ...preset, regexScripts: [...preset.regexScripts, ...result.data] });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [preset, onSave]);

  const sortedPrompts = [...(preset.prompts || [])].sort((a, b) => a.order - b.order);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      {DialogUI}
      <div style={{
        width: '90vw', maxWidth: '720px', height: '90vh',
        background: 'var(--bg-primary)', borderRadius: '12px',
        border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        marginTop: '5vh',
      }} onClick={e => e.stopPropagation()}>

        {/* ─── 头部 ─── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <FileText size={18} />
          <span style={{ fontWeight: '600', fontSize: 'var(--font-size-lg)', flex: 1 }}>
            {preset.name}{builtin && '（内置）'}
          </span>
          {builtin && (
            <button onClick={handleRestoreDefaults} style={{ ...iconBtnStyle, fontSize: 'var(--font-size-xs)', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }} title="恢复默认">
              🔄 恢复默认
            </button>
          )}
          <button onClick={onClose} style={iconBtnStyle}><X size={18} /></button>
        </div>

        {/* ─── Tab 切换 ─── */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setTab('prompts')}
            style={{
              flex: 1, padding: '10px', background: 'none', border: 'none',
              borderBottom: tab === 'prompts' ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === 'prompts' ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: '600', fontSize: 'var(--font-size-sm)', cursor: 'pointer',
            }}
          >
            📝 提示词条目 ({sortedPrompts.length})
          </button>
          <button
            onClick={() => setTab('regex')}
            style={{
              flex: 1, padding: '10px', background: 'none', border: 'none',
              borderBottom: tab === 'regex' ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === 'regex' ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: '600', fontSize: 'var(--font-size-sm)', cursor: 'pointer',
            }}
          >
            🔧 正则脚本 ({preset.regexScripts?.length || 0})
          </button>
        </div>

        {/* ─── 内容区 ─── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>

          {/* === 条目 Tab === */}
          {tab === 'prompts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {!builtin && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <Button onClick={addPrompt} icon={<Plus size={14} />}>新增条目</Button>
                </div>
              )}
              {sortedPrompts.map(p => (
                <div key={p.identifier} style={{
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: p.enabled ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                  opacity: p.enabled ? 1 : 0.55,
                }}>
                  {/* 条目头部 */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', cursor: 'pointer',
                  }} onClick={() => setExpandedPrompt(expandedPrompt === p.identifier ? null : p.identifier)}>
                    {expandedPrompt === p.identifier ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span style={{ flex: 1, fontWeight: '500', fontSize: 'var(--font-size-sm)' }}>{p.name}</span>

                    {/* 蓝灯/绿灯指示 */}
                    <span style={{
                      fontSize: 'var(--font-size-xs)', padding: '1px 6px', borderRadius: '4px',
                      background: p.triggerMode === 'green' ? 'var(--success-dim, #1a3a1a)' : 'var(--accent-dim, rgba(234,179,8,0.1))',
                      color: p.triggerMode === 'green' ? 'var(--success)' : 'var(--accent)',
                    }}>
                      {p.triggerMode === 'green' ? '🟢 关键词' : '🔵 常驻'}
                    </span>

                    {/* 启用/禁用 */}
                    <button onClick={(e) => { e.stopPropagation(); togglePrompt(p.identifier); }} style={iconBtnStyle}>
                      {p.enabled ? <ToggleRight size={16} color="var(--accent)" /> : <ToggleLeft size={16} />}
                    </button>
                    {!builtin && (
                      <button onClick={(e) => { e.stopPropagation(); deletePrompt(p.identifier); }} style={{ ...iconBtnStyle, color: 'var(--danger)' }} title="删除条目">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* 条目展开 */}
                  {expandedPrompt === p.identifier && (
                    <div style={{ padding: '8px 12px 12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <Field label="标识符">
                        <input className="input-field" style={inputStyle} value={p.identifier} disabled />
                      </Field>
                      <Field label="显示名称">
                        <input className="input-field" style={inputStyle} value={p.name} disabled={builtin} onChange={e => updatePrompt(p.identifier, { name: e.target.value })} />
                      </Field>

                      {/* 角色 */}
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>角色：</span>
                        {(['system', 'user', 'assistant'] as const).map(r => (
                          <button
                            key={r}
                            disabled={builtin}
                            onClick={() => updatePrompt(p.identifier, { role: r })}
                            style={{
                              ...chipStyle,
                              background: p.role === r ? 'var(--accent)' : 'var(--bg-tertiary)',
                              color: p.role === r ? '#fff' : 'var(--text-secondary)',
                            }}
                          >{r}</button>
                        ))}
                      </div>

                      {/* 触发模式 */}
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>触发模式：</span>
                        <button
                          disabled={builtin}
                          onClick={() => updatePrompt(p.identifier, { triggerMode: 'blue' })}
                          style={{
                            ...chipStyle,
                            background: p.triggerMode !== 'green' ? 'var(--accent)' : 'var(--bg-tertiary)',
                            color: p.triggerMode !== 'green' ? '#fff' : 'var(--text-secondary)',
                          }}
                        >🔵 常驻</button>
                        <button
                          disabled={builtin}
                          onClick={() => updatePrompt(p.identifier, { triggerMode: 'green' })}
                          style={{
                            ...chipStyle,
                            background: p.triggerMode === 'green' ? 'var(--success)' : 'var(--bg-tertiary)',
                            color: p.triggerMode === 'green' ? '#fff' : 'var(--text-secondary)',
                          }}
                        >🟢 关键词</button>
                      </div>

                      {/* 排序权重 */}
                      <Field label="排序权重（越小越靠前）">
                        <input className="input-field" style={{ ...inputStyle, width: '100px' }} type="number" value={p.order} disabled={builtin} onChange={e => updatePrompt(p.identifier, { order: Number(e.target.value) })} />
                      </Field>

                      {/* 内容预览/编辑 */}
                      <Field label="内容">
                        <textarea
                          className="input-field"
                          style={{ ...inputStyle, fontFamily: 'monospace', minHeight: '120px', resize: 'vertical', fontSize: 'var(--font-size-xs)' }}
                          value={p.content}
                          disabled={builtin}
                          onChange={e => updatePrompt(p.identifier, { content: e.target.value })}
                        />
                      </Field>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* === 正则 Tab === */}
          {tab === 'regex' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input ref={regexFileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportRegex} />

              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                {!builtin && <Button onClick={addRegex} icon={<Plus size={14} />}>新增正则</Button>}
                {!builtin && <Button onClick={() => regexFileRef.current?.click()} icon={<Upload size={14} />}>导入正则</Button>}
              </div>

              {(preset.regexScripts || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  暂无正则脚本
                </div>
              ) : (
                (preset.regexScripts || []).map((script, idx) => (
                  <div key={script.id} style={{
                    borderRadius: '8px', border: '1px solid var(--border)',
                    background: script.disabled ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                    opacity: script.disabled ? 0.55 : 1,
                  }}>
                    {/* 正则头部 */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 12px', cursor: 'pointer',
                    }} onClick={() => setExpandedRegex(expandedRegex === idx ? null : idx)}>
                      {expandedRegex === idx ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span style={{ flex: 1, fontWeight: '500', fontSize: 'var(--font-size-sm)', fontFamily: 'monospace' }}>
                        {script.scriptName}
                      </span>

                      {/* 通道标记 */}
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {script.markdownOnly ? '显示' : script.promptOnly ? 'API' : '全部'}
                      </span>

                      {!builtin && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); updateRegex(idx, { disabled: !script.disabled }); }} style={iconBtnStyle}>
                            {script.disabled ? <EyeOff size={14} /> : <Eye size={14} color="var(--accent)" />}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteRegex(idx); }} style={{ ...iconBtnStyle, color: 'var(--danger)' }}>
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>

                    {/* 正则展开 */}
                    {expandedRegex === idx && (
                      <div style={{ padding: '8px 12px 12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <Field label="名称">
                          <input className="input-field" style={inputStyle} value={script.scriptName} disabled={builtin} onChange={e => updateRegex(idx, { scriptName: e.target.value })} />
                        </Field>
                        <Field label="匹配正则">
                          <input className="input-field" style={{ ...inputStyle, fontFamily: 'monospace' }} value={script.findRegex} disabled={builtin} onChange={e => updateRegex(idx, { findRegex: e.target.value })} placeholder="/pattern/flags 或裸模式" />
                        </Field>
                        <Field label="替换内容">
                          <textarea className="input-field" style={{ ...inputStyle, fontFamily: 'monospace', minHeight: '60px', resize: 'vertical' }} value={script.replaceString} disabled={builtin} onChange={e => updateRegex(idx, { replaceString: e.target.value })} placeholder="支持 $1..$N" />
                        </Field>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>通道：</span>
                          <button disabled={builtin} onClick={() => updateRegex(idx, { markdownOnly: false, promptOnly: false })} style={{ ...chipStyle, background: (!script.markdownOnly && !script.promptOnly) ? 'var(--accent)' : 'var(--bg-tertiary)', color: (!script.markdownOnly && !script.promptOnly) ? '#fff' : 'var(--text-secondary)' }}>全部</button>
                          <button disabled={builtin} onClick={() => updateRegex(idx, { markdownOnly: true, promptOnly: false })} style={{ ...chipStyle, background: script.markdownOnly ? 'var(--accent)' : 'var(--bg-tertiary)', color: script.markdownOnly ? '#fff' : 'var(--text-secondary)' }}>仅显示</button>
                          <button disabled={builtin} onClick={() => updateRegex(idx, { promptOnly: true, markdownOnly: false })} style={{ ...chipStyle, background: script.promptOnly ? 'var(--accent)' : 'var(--bg-tertiary)', color: script.promptOnly ? '#fff' : 'var(--text-secondary)' }}>仅API</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 样式常量 ───

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
  color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
  borderRadius: '4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px',
  border: '1px solid var(--border)', borderRadius: '6px',
  background: 'var(--bg-primary)', color: 'var(--text-primary)',
  fontSize: 'var(--font-size-sm)',
};

const chipStyle: React.CSSProperties = {
  padding: '3px 10px', borderRadius: '12px', border: 'none',
  fontSize: 'var(--font-size-xs)', fontWeight: '500',
  cursor: 'pointer', transition: 'all 0.15s',
};
