// ============================================================
//  模块选择器 — 第一步勾选模块的UI
//  用于世界创建时选择要启用的系统模块
// ============================================================

import {
  BarChart3, TrendingUp, Gem, Dice6, Star,
  type LucideIcon,
} from 'lucide-react';

/** 模块定义（框架层零指向性） — 唯一模块定义源 */
export interface ModuleOption {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** 是否为必选模块 */
  required?: boolean;
  /** 是否禁用（开发中） */
  disabled?: boolean;
  /** AI生成时的指令片段 */
  aiInstruction: string;
}

/** 可选模块列表 */
export const MODULE_OPTIONS: ModuleOption[] = [
  {
    id: 'stat',
    name: '数值属性',
    description: '生命/能量 + 可选六维 + 可选特色属性',
    icon: BarChart3,
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
    disabled: true,
  },
  {
    id: 'dice',
    name: '骰子检定',
    description: 'd20+修正 vs DC，随机性判定机制',
    icon: Dice6,
  },
  {
    id: 'talent',
    name: '天赋体系',
    description: '天赋大类与具体天赋，与成长体系绑定',
    icon: Star,
    disabled: true,
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
          选择要启用的系统模块（均可选）：
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
          const disabled = mod.disabled;
          return (
            <label
              key={mod.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '8px 12px', borderRadius: 8,
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'var(--accent-dim)' : 'transparent',
                cursor: disabled ? 'not-allowed' : mod.required ? 'default' : 'pointer',
                opacity: disabled ? 0.4 : mod.required ? 0.8 : 1,
                transition: 'all 0.15s',
              }}
            >
              <input
                type="checkbox"
                checked={active}
                disabled={mod.required || disabled}
                onChange={() => !mod.required && !disabled && onToggle(mod.id)}
                style={{ display: 'none' }}
              />
              <Icon
                size={18}
                style={{
                  flexShrink: 0, marginTop: 1,
                  color: active ? 'var(--accent)' : disabled ? 'var(--text-muted)' : 'var(--text-muted)',
                }}
              />
              <div>
                <div style={{
                  fontSize: 'var(--font-size-sm)', fontWeight: 600,
                  color: active ? 'var(--accent)' : disabled ? 'var(--text-muted)' : 'var(--text-primary)',
                }}>
                  {mod.name}
                  {disabled && (
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginLeft: 4 }}>
                      开发中
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

/** 获取默认选中的模块集合（默认不选任何模块） */
export function getDefaultSelectedModules(): Set<string> {
  return new Set();
}
