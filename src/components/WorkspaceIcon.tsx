'use client';

import {
  Diamond,
  Briefcase,
  User,
  House,
  Rocket,
  Code,
  Star,
  Heart,
  Flag,
  Folder,
  Zap,
  Bug,
  FlaskConical,
  Palette,
  Coffee,
  Globe,
  Layers,
  Terminal,
  Box,
  Compass,
  type LucideIcon,
} from 'lucide-react';

// Curated set of workspace icons. The key is stored in `workspaces.icon`.
const ICON_MAP: Record<string, LucideIcon> = {
  diamond: Diamond,
  briefcase: Briefcase,
  user: User,
  home: House,
  rocket: Rocket,
  code: Code,
  star: Star,
  heart: Heart,
  flag: Flag,
  folder: Folder,
  zap: Zap,
  bug: Bug,
  beaker: FlaskConical,
  palette: Palette,
  coffee: Coffee,
  globe: Globe,
  layers: Layers,
  terminal: Terminal,
  box: Box,
  compass: Compass,
};

export const WS_ICON_KEYS = Object.keys(ICON_MAP);

// Renders a workspace icon by key, falling back to a diamond when unset/unknown.
export default function WorkspaceIcon({
  icon,
  size = 15,
}: {
  icon: string | null | undefined;
  size?: number;
}) {
  const Icon = (icon && ICON_MAP[icon]) || Diamond;
  return <Icon size={size} />;
}
