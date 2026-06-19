// ============================================================
//  模块选择器 — 第一步勾选模块的UI
//  用于世界创建时选择要启用的系统模块
// ============================================================

import {
  BarChart3, TrendingUp, Gem, Dice6,
  type LucideIcon,
} from 'lucide-react';

/** 模块定义（框架层零指向性） */
export interface ModuleOption {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** 是否为必选模块（数值属性永远开启） */
  required?: boolean;
}

/** 可选模块列表 */
export const MODULE_OPTIONS: ModuleOption[] = [
  {
    id: 'stat',
    name: '数值属性',
    description: '底层必选：生命/能量 + 六维属性 + 特色属性',
    icon: BarChart3,
    required: true,
  },
  {
    id: 'progression',
    name: '成长体系',
    description: '段位制或等级制，角色成长进阶机制',
    icon: TrendingUp,
  },
  {
    id: 'resource',
    name: '资源管理',
    description: '可收集、消耗、交易的资源系统',
    icon: Gem,
  },
  {
    id: 'dice',
    name: '骰子检定',
    description: 'd20+修正 vs DC，随机性判定机制',
    icon: Dice6,
  },
];

interface ModuleSelectorProps {
  /** 当前选中的模块ID集合 */
  selected: Set<string>;
  /** 切换模块选中状态 */
  onToggle: (moduleId: string) => void;
  /** 是否紧凑模式（用于嵌入在其他组件中） */
  compact?: boolean;
}

export default function ModuleSelector({ selected, onToggle, compact }: ModuleSelectorProps) {
  return (
    <div style={{ marginTop: compact ? 8 : 12 }}>
      {!compact && (
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 8 }}>
          选择系统模块（数值属性为必选，其他可选）：
        </div>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 8,
      }}>
        {MODULE_OPTIONS.map(mod => {
          const active = selected.has(mod.id);
          const Icon = mod.icon;
          return (
            <label
              key={mod.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '8px 12px', borderRadius: 8,
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'var(--accent-dim)' : 'transparent',
                cursor: mod.required ? 'default' : 'pointer',
                opacity: mod.required ? 0.8 : 1,
                transition: 'all 0.15s',
              }}
            >
              <input
                type="checkbox"
                checked={active}
                disabled={mod.required}
                onChange={() => !mod.required && onToggle(mod.id)}
                style={{ display: 'none' }}
              />
              <Icon
                size={18}
                style={{
                  flexShrink: 0, marginTop: 1,
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                }}
              />
              <div>
                <div style={{
                  fontSize: 'var(--font-size-sm)', fontWeight: 600,
                  color: active ? 'var(--accent)' : 'var(--text-primary)',
                }}>
                  {mod.name}
                  {mod.required && (
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginLeft: 4 }}>
                      （必选）
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                  {mod.description}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** 获取默认选中的模块集合（数值属性必选） */
export function getDefaultSelectedModules(): Set<string> {
  return new Set(['stat']);
}
