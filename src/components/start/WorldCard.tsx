import {
  Pencil, Trash2, Plus, Cpu, Heart, Skull, Flower2, GraduationCap, Swords, Crown, Globe,
  Compass, BookOpen, Flame, Mountain, Ship, Castle, Rocket, Star, Shield, Zap, Brain, Gem,
  Ghost, Snowflake, Sun, Moon, Wind, Waves, Anchor, Eye, Target, Wand2, Fish, Bug,
  Flower, TreePine, Cloud, Sunrise, Eclipse, Hexagon, Diamond, Atom,
} from 'lucide-react';
import type { WorldDef } from '../../data/worldLoader';

/** 世界 ID → Lucide 图标映射（内置世界） */
const WORLD_ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  cyberpunk_city: Cpu,
  desire_metropolis: Heart,
  wasteland_apocalypse: Skull,
  japanese_school: Flower2,
  crystal_world: Gem,
  wuxia_world: Swords,
  palace_intrigue: Crown,
};

/** 图标名称 → Lucide 图标映射（自建世界） */
const ICON_NAME_MAP: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  Globe, Compass, BookOpen, Flame, Mountain, Ship, Castle, Skull, Crown,
  Rocket, Star, Shield, Zap, Brain, Gem, Ghost, Snowflake, Sun, Moon,
  Wind, Waves, Anchor, Eye, Heart, Target, Wand2, Fish, Bug,
  Flower, TreePine, Cloud, Sunrise, Eclipse, Hexagon, Diamond, Atom,
  Cpu, Swords, GraduationCap, Flower2,
};

export function getWorldIcon(world: WorldDef) {
  // 优先使用 world.icon 字段（图标名称）
  if (world.icon && ICON_NAME_MAP[world.icon]) {
    return ICON_NAME_MAP[world.icon];
  }
  // 否则根据 worldId 查找（内置世界）
  return WORLD_ICONS[world.id] ?? Globe;
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
