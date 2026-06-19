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

/** 世界卡片 — 紧凑色条：icon + 名称，无描述 */
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
    </div>
  );
}

/** 新建世界卡片 */
export function CreateWorldCard({ onClick }: { onClick: () => void }) {
  return (
    <div className="world-card create" onClick={onClick}>
      <Plus size={16} strokeWidth={1.5} />
      <span>新建世界</span>
    </div>
  );
}
