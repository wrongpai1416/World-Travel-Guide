// 世界书面板 — 展示当前预设的系统提示词条目
import { useState, useMemo } from 'react';
import {
  BookOpen, ChevronDown, ChevronRight, Search,
  Eye, EyeOff, MapPin, Layers, Lock,
} from 'lucide-react';
import { getBuiltinPreset, getEnhancementModules } from '../../../data/builtinPresets';

interface Props {
  worldId: string;
}

export default function WorldBookPanel({ worldId }: Props) {
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showDisabled, setShowDisabled] = useState(true);

  // 从内置预设获取系统提示词条目
  const entries = useMemo(() => {
    const preset = getBuiltinPreset('default');
    const presetEntries = preset.prompts
      .filter((p: any) => p.enabled)
      .sort((a: any, b: any) => a.order - b.order);

    const enhancementModules = getEnhancementModules().filter((m: any) => m.enabled);
    const allEntries = [...presetEntries, ...enhancementModules];

    // 去重（按 identifier）
    const seen = new Set<string>();
    const unique = allEntries.filter((e: any) => {
      if (seen.has(e.identifier)) return false;
      seen.add(e.identifier);
      return true;
    });

    return unique.map((e: any) => ({
      id: e.identifier,
      comment: e.name || e.identifier,
      content: e.content || '',
      constant: e.triggerMode === 'blue',
      enabled: e.enabled,
      keys: e.triggerKeywords || [],
      position: 'after_char' as const,
      order: e.order ?? 0,
      depth: 0,
    }));
  }, [worldId]);

  // 搜索 + 过滤
  const filtered = useMemo(() => {
    let result = entries;
    if (!showDisabled) {
      result = result.filter(e => e.enabled);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.comment.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.keys.some((k: string) => k.toLowerCase().includes(q))
      );
    }
    return result;
  }, [entries, search, showDisabled]);

  // 分组：常驻(constant) / 关键词触发 / 其他
  const grouped = useMemo(() => {
    const constant = filtered.filter(e => e.constant);
    const triggered = filtered.filter(e => !e.constant && e.keys.length > 0);
    const other = filtered.filter(e => !e.constant && e.keys.length === 0);
    return { constant, triggered, other };
  }, [filtered]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const worldName = worldId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 头部 */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <BookOpen size={16} style={{ color: 'var(--accent)' }} />
        <span style={{ fontWeight: '600', fontSize: 'var(--font-size-lg)' }}>世界书</span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          {worldName} · {entries.length} 条
        </span>
      </div>

      {/* 搜索 + 筛选 */}
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', gap: '8px', alignItems: 'center',
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} style={{
            position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
          }} />
          <input
            className="input-field"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索条目..."
            style={{ width: '100%', padding: '6px 10px 6px 28px', fontSize: 'var(--font-size-sm)' }}
          />
        </div>
        <button
          onClick={() => setShowDisabled(v => !v)}
          title={showDisabled ? '隐藏已禁用' : '显示已禁用'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: showDisabled ? 'var(--text-secondary)' : 'var(--text-muted)',
            padding: '4px',
          }}
        >
          {showDisabled ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
      </div>

      {/* 条目列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            {entries.length === 0 ? '当前世界没有世界书条目' : '没有匹配的条目'}
          </div>
        ) : (
          <>
            <EntryGroup
              title="常驻条目"
              icon={<Lock size={13} />}
              entries={grouped.constant}
              expandedIds={expandedIds}
              onToggle={toggleExpand}
            />
            <EntryGroup
              title="关键词触发"
              icon={<MapPin size={13} />}
              entries={grouped.triggered}
              expandedIds={expandedIds}
              onToggle={toggleExpand}
            />
            <EntryGroup
              title="其他"
              icon={<Layers size={13} />}
              entries={grouped.other}
              expandedIds={expandedIds}
              onToggle={toggleExpand}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ─── 条目分组 ───

function EntryGroup({
  title, icon, entries, expandedIds, onToggle,
}: {
  title: string;
  icon: React.ReactNode;
  entries: Array<{
    id: string;
    comment: string;
    content: string;
    constant: boolean;
    enabled: boolean;
    keys: string[];
    position: string;
    order: number;
    depth: number;
  }>;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)',
        fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {icon}
        {title}
        <span style={{ fontWeight: '400' }}>({entries.length})</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {entries.map(entry => (
          <EntryCard
            key={entry.id}
            entry={entry}
            expanded={expandedIds.has(entry.id)}
            onToggle={() => onToggle(entry.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── 单个条目卡片 ───

function EntryCard({
  entry, expanded, onToggle,
}: {
  entry: {
    id: string;
    comment: string;
    content: string;
    constant: boolean;
    enabled: boolean;
    keys: string[];
    position: string;
    order: number;
    depth: number;
  };
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{
      border: `1px solid ${entry.enabled ? 'var(--border)' : 'var(--border-dim, #333)'}`,
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
      opacity: entry.enabled ? 1 : 0.5,
    }}>
      {/* 标题行 */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 10px',
          background: expanded ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
          border: 'none', cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.15s',
        }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span style={{
          flex: 1,
          fontSize: 'var(--font-size-sm)',
          fontWeight: '500',
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {entry.comment}
        </span>
        {/* 标签 */}
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {entry.constant && (
            <span style={{
              fontSize: '9px', padding: '1px 5px', borderRadius: '3px',
              background: 'var(--accent-dim)', color: 'var(--accent)',
            }}>常驻</span>
          )}
          {entry.keys.length > 0 && (
            <span style={{
              fontSize: '9px', padding: '1px 5px', borderRadius: '3px',
              background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
            }}>{entry.keys.length} 词</span>
          )}
        </div>
      </button>

      {/* 展开内容 */}
      {expanded && (
        <div style={{
          padding: '10px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-primary)',
        }}>
          {/* 关键词 */}
          {entry.keys.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>
                触发关键词
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {entry.keys.map((k, i) => (
                  <span key={i} style={{
                    padding: '2px 8px', borderRadius: '4px',
                    fontSize: 'var(--font-size-xs)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)',
                  }}>{k}</span>
                ))}
              </div>
            </div>
          )}

          {/* 元信息 */}
          <div style={{
            display: 'flex', gap: '12px', marginBottom: '8px',
            fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)',
          }}>
            <span>位置: {entry.position === 'before_char' ? '角色定义前' : '角色定义后'}</span>
            <span>排序: {entry.order}</span>
            {entry.depth > 0 && <span>深度: {entry.depth}</span>}
          </div>

          {/* 内容 */}
          <div style={{
            fontSize: 'var(--font-size-sm)',
            lineHeight: '1.6',
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: '300px',
            overflow: 'auto',
            padding: '8px',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
          }}>
            {entry.content || '（空内容）'}
          </div>
        </div>
      )}
    </div>
  );
}
