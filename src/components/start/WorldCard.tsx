import { Pencil, Trash2, Plus } from 'lucide-react';
import type { WorldDef } from '../../data/worldLoader';
import { resolveWorldIcon } from '../shared/worldIcons';

export function getWorldIcon(world: WorldDef) {
  return resolveWorldIcon(world.icon);
}

interface WorldCardProps {
  world: WorldDef;
  selected: boolean;
  onSelect: () => void;
  onEdit?: (e: React.MouseEvent) => void;
  onDelete?: () => void;
  isCustom?: boolean;
}

/** 世界卡片 — 紧凑横排：色条头部(icon+名称) + 描述 + 标签 */
export default function WorldCard({ world, selected, onSelect, onEdit, onDelete, isCustom }: WorldCardProps) {
  const Icon = getWorldIcon(world);
  return (
    <div
      className={`world-card${selected ? ' selected' : ''}`}
      onClick={onSelect}
      style={{ '--cover-color': world.coverColor ?? 'var(--accent)' } as React.CSSProperties}
    >
      <div className="world-card-header">
        <Icon size={16} strokeWidth={2} />
        <span className="world-card-name">{world.name}</span>
        {isCustom && (onEdit || onDelete) && (
          <div className="world-card-actions">
            {onEdit && (
              <button className="world-card-edit" onClick={e => { e.stopPropagation(); onEdit(e); }} title="编辑">
                <Pencil size={10} />
              </button>
            )}
            {onDelete && (
              <button className="world-card-delete" onClick={e => { e.stopPropagation(); onDelete(); }} title="删除">
                <Trash2 size={10} />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="world-card-body">
        <div className="world-card-desc">{world.description}</div>
        {world.tags && world.tags.length > 0 && (
          <div className="world-card-footer">
            {world.tags.slice(0, 3).map(tag => (
              <span key={tag} className="world-card-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** 新建世界卡片 */
export function CreateWorldCard({ onClick }: { onClick: () => void }) {
  return (
    <div className="world-card create" onClick={onClick}>
      <Plus size={20} strokeWidth={1.5} />
      <span style={{ fontSize: 'var(--font-size-sm)' }}>新建世界</span>
    </div>
  );
}
