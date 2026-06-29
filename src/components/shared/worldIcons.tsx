/**
 * 世界图标统一解析
 * icon 字段直接存 Lucide 图标名称（如 "Cpu"、"Swords"），一步解析到位
 */
import {
  Globe, Compass, BookOpen, Flame, Mountain, Ship, Castle, Skull, Crown,
  Rocket, Star, Shield, Zap, Brain, Gem, Ghost, Snowflake, Sun, Moon,
  Wind, Waves, Anchor, Eye, Heart, Target, Wand2, Fish, Bug,
  Flower, TreePine, Cloud, Sunrise, Eclipse, Hexagon, Diamond, Atom,
  Cpu, Swords, GraduationCap, Flower2,
  type LucideIcon,
} from 'lucide-react';

/** Lucide 图标名称 → 组件映射 */
const ICON_NAME_MAP: Record<string, LucideIcon> = {
  Globe, Compass, BookOpen, Flame, Mountain, Ship, Castle, Skull, Crown,
  Rocket, Star, Shield, Zap, Brain, Gem, Ghost, Snowflake, Sun, Moon,
  Wind, Waves, Anchor, Eye, Heart, Target, Wand2, Fish, Bug,
  Flower, TreePine, Cloud, Sunrise, Eclipse, Hexagon, Diamond, Atom,
  Cpu, Swords, GraduationCap, Flower2,
};

/**
 * 根据 icon 名称解析 Lucide 图标组件
 * @param iconName Lucide 图标名称，如 "Cpu"、"Swords"
 * @returns 对应的 LucideIcon 组件，未匹配则返回 Globe
 */
export function resolveWorldIcon(iconName?: string): LucideIcon {
  if (iconName && ICON_NAME_MAP[iconName]) {
    return ICON_NAME_MAP[iconName];
  }
  return Globe;
}
