import { BoxSizeVariation, ArrowRoutingStyle, ArrowStrokeStyle, NodeType, WorkflowNode } from '../types/workflow';

export interface BoxSizeDimensions {
  width: number;
  height: number;
  label: string;
  description: string;
}

export const BOX_SIZE_PRESETS: Record<Exclude<BoxSizeVariation, 'custom'>, BoxSizeDimensions> = {
  compact: {
    width: 220,
    height: 125,
    label: 'Compact',
    description: 'Dense 220×125px for complex multi-branch maps',
  },
  standard: {
    width: 290,
    height: 155,
    label: 'Standard',
    description: 'Default 290×155px with balanced typography & spacing',
  },
  large: {
    width: 360,
    height: 195,
    label: 'Large',
    description: 'Expanded 360×195px for readable descriptions',
  },
  expanded: {
    width: 440,
    height: 245,
    label: 'Expanded',
    description: 'Generous 440×245px with full technical details',
  },
};

export interface ColorPreset {
  id: string;
  name: string;
  label: string;
  color: string;      // Accent / icon color
  bg: string;         // Card background
  border: string;     // Border color
  text: string;       // Primary text
  badgeBg: string;    // Badge background
  badgeText: string;  // Badge text
}

export const COLOR_PRESETS: ColorPreset[] = [
  {
    id: 'default',
    name: 'Archetype Default',
    label: 'Archetype Default',
    color: '#6366F1',
    bg: '#FFFFFF',
    border: '#CBD5E1',
    text: '#0F172A',
    badgeBg: '#EEF2FF',
    badgeText: '#4338CA',
  },
  {
    id: 'indigo',
    name: 'Figma Indigo',
    label: 'Figma Indigo',
    color: '#6366F1',
    bg: '#EEF2FF',
    border: '#6366F1',
    text: '#1E1B4B',
    badgeBg: '#E0E7FF',
    badgeText: '#4338CA',
  },
  {
    id: 'emerald',
    name: 'Emerald Green',
    label: 'Emerald Green',
    color: '#10B981',
    bg: '#ECFDF5',
    border: '#10B981',
    text: '#064E3B',
    badgeBg: '#D1FAE5',
    badgeText: '#047857',
  },
  {
    id: 'amber',
    name: 'Amber Orange',
    label: 'Amber Orange',
    color: '#F59E0B',
    bg: '#FFFBEB',
    border: '#F59E0B',
    text: '#78350F',
    badgeBg: '#FEF3C7',
    badgeText: '#B45309',
  },
  {
    id: 'rose',
    name: 'Rose Coral',
    label: 'Rose Coral',
    color: '#F43F5E',
    bg: '#FFF1F2',
    border: '#F43F5E',
    text: '#881337',
    badgeBg: '#FFE4E6',
    badgeText: '#BE123C',
  },
  {
    id: 'purple',
    name: 'Purple Royal',
    label: 'Purple Royal',
    color: '#A855F7',
    bg: '#FAF5FF',
    border: '#A855F7',
    text: '#581C87',
    badgeBg: '#F3E8FF',
    badgeText: '#7E22CE',
  },
  {
    id: 'cyan',
    name: 'Cyan Sky',
    label: 'Cyan Sky',
    color: '#06B6D4',
    bg: '#ECFEFF',
    border: '#06B6D4',
    text: '#164E63',
    badgeBg: '#CFFAFE',
    badgeText: '#0E7490',
  },
  {
    id: 'dark',
    name: 'Obsidian Dark',
    label: 'Obsidian Dark',
    color: '#94A3B8',
    bg: '#1E293B',
    border: '#475569',
    text: '#F8FAFC',
    badgeBg: '#334155',
    badgeText: '#E2E8F0',
  },
  {
    id: 'white',
    name: 'Monochrome Clean',
    label: 'Monochrome Clean',
    color: '#0F172A',
    bg: '#FFFFFF',
    border: '#0F172A',
    text: '#0F172A',
    badgeBg: '#F1F5F9',
    badgeText: '#0F172A',
  },
];

/**
 * Calculates SVG path for an arrow based on routing style
 * Can accept either (srcNode, tgtNode, routingStyle) or (startX, startY, endX, endY, routingStyle)
 */
export function calculateArrowPath(
  arg1: number | WorkflowNode,
  arg2: number | WorkflowNode,
  arg3?: number | ArrowRoutingStyle,
  arg4?: number,
  arg5?: ArrowRoutingStyle
): { pathD: string; path: string; midX: number; midY: number } {
  let startX: number;
  let startY: number;
  let endX: number;
  let endY: number;
  let routingStyle: ArrowRoutingStyle = 'curved';

  if (typeof arg1 === 'object' && typeof arg2 === 'object') {
    // Called with (srcNode, tgtNode, routingStyle)
    const src = arg1 as WorkflowNode;
    const tgt = arg2 as WorkflowNode;
    startX = src.x + src.width;
    startY = src.y + src.height / 2;
    endX = tgt.x;
    endY = tgt.y + tgt.height / 2;
    if (typeof arg3 === 'string') {
      routingStyle = arg3 as ArrowRoutingStyle;
    }
  } else {
    // Called with numbers
    startX = arg1 as number;
    startY = arg2 as number;
    endX = (arg3 as number) || 0;
    endY = arg4 || 0;
    if (arg5) {
      routingStyle = arg5;
    }
  }

  if (routingStyle === 'straight') {
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    const d = `M ${startX} ${startY} L ${endX} ${endY}`;
    return {
      pathD: d,
      path: d,
      midX,
      midY,
    };
  }

  if (routingStyle === 'orthogonal') {
    // Stepped elbow routing
    const deltaX = endX - startX;
    const midX = startX + deltaX / 2;
    const midY = (startY + endY) / 2;

    // Smooth rounded elbow if distance allows
    const radius = Math.min(16, Math.abs(deltaX) / 2, Math.abs(endY - startY) / 2);

    if (radius < 4) {
      const d = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
      return {
        pathD: d,
        path: d,
        midX,
        midY,
      };
    }

    const dirY = endY >= startY ? 1 : -1;
    const dirX = deltaX >= 0 ? 1 : -1;

    const d = [
      `M ${startX} ${startY}`,
      `L ${midX - radius * dirX} ${startY}`,
      `Q ${midX} ${startY} ${midX} ${startY + radius * dirY}`,
      `L ${midX} ${endY - radius * dirY}`,
      `Q ${midX} ${endY} ${midX + radius * dirX} ${endY}`,
      `L ${endX} ${endY}`,
    ].join(' ');

    return {
      pathD: d,
      path: d,
      midX,
      midY,
    };
  }

  // Default: Curved Bezier
  const dx = Math.abs(endX - startX) * 0.5;
  const p1x = startX + Math.max(dx, 40);
  const p1y = startY;
  const p2x = endX - Math.max(dx, 40);
  const p2y = endY;

  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const d = `M ${startX} ${startY} C ${p1x} ${p1y}, ${p2x} ${p2y}, ${endX} ${endY}`;

  return {
    pathD: d,
    path: d,
    midX,
    midY,
  };
}

/**
 * Returns stroke dasharray attribute for an arrow stroke style
 */
export function getStrokeDashArray(strokeStyle: ArrowStrokeStyle = 'solid', isFailure = false): string {
  if (strokeStyle === 'dashed') return '8 5';
  if (strokeStyle === 'dotted') return '3 3';
  if (isFailure) return '6 4';
  return 'none';
}
