import {
  BookOpen,
  Box,
  Clapperboard,
  Compass,
  Cuboid,
  FileText,
  Flag,
  Flame,
  Layers,
  Leaf,
  Map,
  PenLine,
  Star,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

const ICONS: Record<string, LucideIcon> = {
  "file-text": FileText,
  "book-open": BookOpen,
  compass: Compass,
  layers: Layers,
  "pen-line": PenLine,
  flag: Flag,
  zap: Zap,
  star: Star,
  box: Box,
  map: Map,
  leaf: Leaf,
  flame: Flame,
  cuboid: Cuboid,
  clapperboard: Clapperboard,
};

export function PageIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? FileText;
  return <Icon className={cn("size-4", className)} strokeWidth={1.75} aria-hidden="true" />;
}
