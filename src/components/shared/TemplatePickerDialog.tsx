/**
 * 模板选择弹窗 — 用于向导阶段选择/导入人物模板
 * 两种模式：
 *   - 'npc': NPC模板选择（空白新建 / 从模板导入 / 导入JSON）
 *   - 'player': 主角预设选择（从预设导入 / 导入JSON）
 */
import { useState, useRef, useCallback } from 'react';
import { Plus, Download, Upload, FileJson, Trash2, User, Users, Clock, BookOpen } from 'lucide-react';
import { useDialog } from './Dialog';
import type { CustomNpc } from '../../storage/db';
import type { PlayerProfile } from '../../storage/db';
import {
  getNpcTemplates, importNpcFromTemplate, parseNpcTemplateJSON,
  getPlayerPresets, parsePlayerPresetJSON, applyPresetToProfile,
  deleteNpcTemplate, deletePlayerPreset,
  getHistoryPresets, parseHistoryPresetJSON, deleteHistoryPreset,
  type NpcTemplate, type PlayerPreset, type HistoryPreset,
} from '../../storage/templateStore';

// ─── NPC 模板选择模式 ─────────────────────────────────

interface NpcPickerProps {
  mode: 'npc';
  onClose: () => void;
  onBlank: () => void;                    // 空白新建
  onImportTemplate: (npc: CustomNpc) => void;  // 从模板导入
}

// ─── 主角预设选择模式 ─────────────────────────────────

interface PlayerPickerProps {
  mode: 'player';
  onClose: () => void;
  currentProfile: PlayerProfile;
  onApplyPreset: (profile: PlayerProfile) => void;
}

interface HistoryPickerProps {
  mode: 'history';
  onClose: () => void;
  onApplyPreset: (preset: HistoryPreset) => void;
}

type Props = NpcPickerProps | PlayerPickerProps | HistoryPickerProps;

export default function TemplatePickerDialog(props: Props) {
  const { mode, onClose } = props;
  const [view, setView] = useState<'main' | 'list'>('main');
  const [templates, setTemplates] = useState(() =>
    mode === 'npc' ? getNpcTemplates() : mode === 'history' ? getHistoryPresets() : getPlayerPresets()
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { DialogUI, confirm: dlgConfirm, alert: dlgAlert } = useDialog();

  const refresh = useCallback(() => {
    setTemplates(mode === 'npc' ? getNpcTemplates() : mode === 'history' ? getHistoryPresets() : getPlayerPresets());
  }, [mode]);

  // ─── 导入 JSON 文件 ───
  const handleFileImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (mode === 'npc') {
        const result = parseNpcTemplateJSON(text);
        if (!result.ok) { await dlgAlert(`导入失败：${result.error}`, { title: '导入错误' }); return; }
        const npc = importNpcFromTemplate(result.data);
        props.onImportTemplate(npc);
      } else if (mode === 'history') {
        const result = parseHistoryPresetJSON(text);
        if (!result.ok) { await dlgAlert(`导入失败：${result.error}`, { title: '导入错误' }); return; }
        props.onApplyPreset(result.data);
      } else {
        const result = parsePlayerPresetJSON(text);
        if (!result.ok) { await dlgAlert(`导入失败：${result.error}`, { title: '导入错误' }); return; }
        const profile = applyPresetToProfile(result.data, props.currentProfile);
        props.onApplyPreset(profile);
      }
      onClose();
    } catch (err) {
      await dlgAlert(`文件读取失败：${err instanceof Error ? err.message : String(err)}`, { title: '导入错误' });
    } finally {
      e.target.value = '';
    }
  }, [mode, props, onClose, dlgAlert]);

  // ─── 选择模板 ───
  const handleSelectTemplate = useCallback((tpl: NpcTemplate | PlayerPreset | HistoryPreset) => {
    if (mode === 'npc') {
      const npc = importNpcFromTemplate(tpl as NpcTemplate);
      props.onImportTemplate(npc);
    } else if (mode === 'history') {
      props.onApplyPreset(tpl as HistoryPreset);
    } else {
      const profile = applyPresetToProfile(tpl as PlayerPreset, props.currentProfile);
      props.onApplyPreset(profile);
    }
    onClose();
  }, [mode, props, onClose]);

  // ─── 删除模板 ───
  const handleDelete = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!await dlgConfirm('确定删除这个模板吗？', { title: '删除模板', danger: true, confirmText: '删除' })) return;
    if (mode === 'npc') deleteNpcTemplate(id);
    else if (mode === 'history') deleteHistoryPreset(id);
    else deletePlayerPreset(id);
    refresh();
  }, [mode, refresh, dlgConfirm]);

  const title = mode === 'npc' ? '创建NPC' : mode === 'history' ? '导入人生经历预设' : '导入主角预设';
  const hasTemplates = templates.length > 0;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1600,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '92%', maxWidth: 480, borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-primary)', border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
          maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            {view === 'main' ? title : (mode === 'npc' ? 'NPC 模板库' : mode === 'history' ? '人生经历预设库' : '主角预设库')}
          </h3>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: '6px', margin: '6px 0 0' }}>
            {view === 'main'
              ? (mode === 'npc' ? '选择创建方式' : '选择导入来源')
              : '点击选择，右侧删除'
            }
          </p>

        </div>

        {/* 主体 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {view === 'main' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* NPC模式：空白新建 */}
              {mode === 'npc' && (
                <OptionCard
                  icon={<Plus size={18} />}
                  title="空白新建"
                  desc="从零开始创建一个新的NPC"
                  onClick={() => { props.onBlank(); onClose(); }}
                />
              )}

              {/* 从模板/预设列表选择 */}
              {hasTemplates && (
                <OptionCard
                  icon={mode === 'npc' ? <Users size={18} /> : mode === 'history' ? <BookOpen size={18} /> : <User size={18} />}
                  title={mode === 'npc' ? '从模板导入' : mode === 'history' ? '从预设导入' : '从预设导入'}
                  desc={`已保存 ${templates.length} 个${mode === 'npc' ? 'NPC模板' : mode === 'history' ? '经历预设' : '预设'}`}
                  onClick={() => setView('list')}
                />
              )}

              {/* 导入JSON */}
              <OptionCard
                icon={<FileJson size={18} />}
                title="导入 JSON 文件"
                desc="从本地文件导入（支持多种格式自动识别）"
                onClick={() => fileInputRef.current?.click()}
              />
            </div>
          ) : (
            /* 模板列表视图 */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => setView('main')}
                style={{
                  alignSelf: 'flex-start', border: 'none', background: 'none',
                  color: 'var(--accent)', cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                  padding: '2px 0', marginBottom: '4px',
                }}
              >
                ← 返回
              </button>
              {templates.map(tpl => {
                const label = mode === 'npc'
                  ? (tpl as NpcTemplate).npc.name || '未命名NPC'
                  : mode === 'history'
                  ? (tpl as HistoryPreset).name
                  : (tpl as PlayerPreset).name;
                const sub = mode === 'npc'
                  ? [
                      (tpl as NpcTemplate).npc.gender,
                      (tpl as NpcTemplate).npc.age && `${(tpl as NpcTemplate).npc.age}岁`,
                      (tpl as NpcTemplate).npc.relationshipType,
                    ].filter(Boolean).join(' · ')
                  : mode === 'history'
                  ? (() => {
                      const hp = tpl as HistoryPreset;
                      const count = Object.values(hp.segments).filter(v => v.trim()).length;
                      return `${count} 个阶段已填写`;
                    })()
                  : [
                      (tpl as PlayerPreset).gender,
                      (tpl as PlayerPreset).age && `${(tpl as PlayerPreset).age}岁`,
                      (tpl as PlayerPreset).career,
                    ].filter(Boolean).join(' · ');
                const timeStr = new Date(tpl.createdAt).toLocaleDateString();

                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 14px', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                      background: 'var(--accent-dim)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--accent)', flexShrink: 0,
                    }}>
                      {mode === 'npc' ? <Users size={16} /> : mode === 'history' ? <BookOpen size={16} /> : <User size={16} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '600', fontSize: 'var(--font-size-md)' }}>{tpl.name}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'flex', gap: '8px', marginTop: '2px' }}>
                        <span>{label}</span>
                        {sub && <span>· {sub}</span>}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px', opacity: 0.7 }}>
                        <Clock size={10} /> {timeStr}
                      </div>
                    </div>
                    <button
                      onClick={e => handleDelete(e, tpl.id)}
                      style={{
                        border: 'none', background: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: '6px', borderRadius: 'var(--radius-sm)',
                        flexShrink: 0, transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                      title="删除模板"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-secondary)' }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)', fontSize: 'var(--font-size-base)', cursor: 'pointer',
            }}
          >
            取消
          </button>
        </div>

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileImport}
        />

        {DialogUI}
      </div>
    </div>
  );
}

// ─── 选项卡片 ─────────────────────────────────────────

function OptionCard({ icon, title, desc, onClick }: {
  icon: React.ReactNode; title: string; desc: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '14px 16px', borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
        textAlign: 'left', color: 'var(--text-primary)',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-dim)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 'var(--radius-md)',
        background: 'var(--accent-dim)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--accent)', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 'var(--font-size-md)', fontWeight: '600' }}>{title}</div>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: '2px' }}>{desc}</div>
      </div>
    </button>
  );
}
