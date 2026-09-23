import { WorkflowSpec, WorkflowNode, WorkflowEdge } from '../types/workflow';

// Helper to sanitize text for SVG
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string; badgeBg: string; badgeText: string }> = {
  trigger: { bg: '#F0FDF4', border: '#86EFAC', text: '#166534', badgeBg: '#DCFCE7', badgeText: '#15803D' },
  action: { bg: '#EFF6FF', border: '#93C5FD', text: '#1E40AF', badgeBg: '#DBEAFE', badgeText: '#1D4ED8' },
  decision: { bg: '#FFFBEB', border: '#FCD34D', text: '#92400E', badgeBg: '#FEF3C7', badgeText: '#B45309' },
  screen_ui: { bg: '#FAF5FF', border: '#D8B4FE', text: '#6B21A8', badgeBg: '#F3E8FF', badgeText: '#7E22CE' },
  database: { bg: '#F8FAFC', border: '#CBD5E1', text: '#334155', badgeBg: '#E2E8F0', badgeText: '#475569' },
  api: { bg: '#ECFEFF', border: '#67E8F9', text: '#0E7490', badgeBg: '#CFFAFE', badgeText: '#0891B2' },
  end_state: { bg: '#FFF1F2', border: '#FDA4AF', text: '#9F1239', badgeBg: '#FFE4E6', badgeText: '#BE123C' },
};

/**
 * Generates an SVG document designed for direct copy-pasting into Figma canvas or FigJam.
 * Figma parses SVG into native editable Figma frames, vector paths, and text nodes!
 */
export function generateFigmaSvg(workflow: WorkflowSpec): string {
  // Calculate bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  workflow.nodes.forEach((n) => {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  });

  const padding = 80;
  const canvasWidth = Math.max(1200, maxX - minX + padding * 2);
  const canvasHeight = Math.max(800, maxY - minY + padding * 2 + 120);
  const offsetX = padding - minX;
  const offsetY = padding - minY + 100;

  // Build node map for edge lookup
  const nodeMap = new Map<string, WorkflowNode>();
  workflow.nodes.forEach((n) => nodeMap.set(n.id, n));

  // Render edges
  const edgeSvgElements = workflow.edges.map((edge) => {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) return '';

    const startX = src.x + src.width + offsetX;
    const startY = src.y + src.height / 2 + offsetY;
    const endX = tgt.x + offsetX;
    const endY = tgt.y + tgt.height / 2 + offsetY;

    // Bezier control points
    const dx = Math.abs(endX - startX) * 0.5;
    const p1x = startX + Math.max(dx, 40);
    const p1y = startY;
    const p2x = endX - Math.max(dx, 40);
    const p2y = endY;

    const strokeColor =
      edge.conditionType === 'failure'
        ? '#EF4444'
        : edge.conditionType === 'branch_no'
        ? '#F97316'
        : edge.conditionType === 'success' || edge.conditionType === 'branch_yes'
        ? '#10B981'
        : '#94A3B8';

    const strokeWidth = 2;
    const pathD = `M ${startX} ${startY} C ${p1x} ${p1y}, ${p2x} ${p2y}, ${endX} ${endY}`;

    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    const labelMarkup = edge.label
      ? `
      <g transform="translate(${midX}, ${midY})">
        <rect x="-45" y="-12" width="90" height="24" rx="12" fill="#FFFFFF" stroke="${strokeColor}" stroke-width="1.5"/>
        <text x="0" y="3" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="600" fill="#334155" text-anchor="middle">${escapeXml(
          edge.label
        )}</text>
      </g>`
      : '';

    return `
      <g class="connector" data-edge-id="${edge.id}">
        <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" marker-end="url(#arrowhead-${edge.conditionType || 'default'})" stroke-dasharray="${edge.conditionType === 'failure' ? '4 3' : 'none'}"/>
        ${labelMarkup}
      </g>
    `;
  }).join('\n');

  // Render nodes
  const nodeSvgElements = workflow.nodes.map((node) => {
    const x = node.x + offsetX;
    const y = node.y + offsetY;
    const colors = TYPE_COLORS[node.type] || TYPE_COLORS.action;
    const isScreen = node.type === 'screen_ui' && node.screenData;

    // Optional screen wireframe preview inside SVG
    let wireframeMarkup = '';
    if (isScreen && node.screenData) {
      const items = node.screenData.elements.slice(0, 3).map((el, i) => {
        const itemY = y + 74 + i * 26;
        return `
          <rect x="${x + 16}" y="${itemY}" width="${node.width - 32}" height="20" rx="4" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1"/>
          <text x="${x + 24}" y="${itemY + 14}" font-family="Inter, sans-serif" font-size="9" fill="#64748B">${escapeXml(el.label)}</text>
        `;
      }).join('');
      wireframeMarkup = items;
    }

    return `
      <g class="figma-node" data-node-id="${node.id}" transform="translate(0, 0)">
        <!-- Node Container / Card -->
        <rect x="${x}" y="${y}" width="${node.width}" height="${node.height}" rx="12" fill="${node.customBg || colors.bg}" stroke="${node.customBorder || colors.border}" stroke-width="1.5" />
        
        <!-- Header Type Badge -->
        <rect x="${x + 16}" y="${y + 14}" width="76" height="20" rx="4" fill="${node.customColor || colors.badgeBg}" />
        <text x="${x + 54}" y="${y + 27}" font-family="Inter, sans-serif" font-size="10" font-weight="700" fill="${node.customColor ? '#FFFFFF' : colors.badgeText}" text-anchor="middle">
          ${node.type.toUpperCase().replace('_', ' ')}
        </text>

        <!-- Actor Pill if exists -->
        ${node.actor ? `
        <rect x="${x + 98}" y="${y + 14}" width="${Math.min(150, node.actor.length * 7 + 16)}" height="20" rx="10" fill="#F1F5F9" />
        <text x="${x + 106}" y="${y + 27}" font-family="Inter, sans-serif" font-size="10" fill="#475569">
          ${escapeXml(node.actor.slice(0, 22))}
        </text>` : ''}

        <!-- Title -->
        <text x="${x + 16}" y="${y + 52}" font-family="Inter, sans-serif" font-size="13" font-weight="700" fill="#0F172A">
          ${escapeXml(node.title.slice(0, 36))}
        </text>

        <!-- Description -->
        <text x="${x + 16}" y="${y + 68}" font-family="Inter, sans-serif" font-size="11" fill="#475569">
          ${escapeXml(node.description.slice(0, 48))}
        </text>
        ${node.description.length > 48 ? `
        <text x="${x + 16}" y="${y + 82}" font-family="Inter, sans-serif" font-size="11" fill="#475569">
          ${escapeXml(node.description.slice(48, 96))}
        </text>` : ''}

        ${wireframeMarkup}
      </g>
    `;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasWidth} ${canvasHeight}" width="${canvasWidth}" height="${canvasHeight}">
  <defs>
    <!-- Arrowhead markers for Figma -->
    <marker id="arrowhead-default" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M 0 0 L 8 4 L 0 8 Z" fill="#94A3B8" />
    </marker>
    <marker id="arrowhead-success" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M 0 0 L 8 4 L 0 8 Z" fill="#10B981" />
    </marker>
    <marker id="arrowhead-failure" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M 0 0 L 8 4 L 0 8 Z" fill="#EF4444" />
    </marker>
    <marker id="arrowhead-branch_yes" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M 0 0 L 8 4 L 0 8 Z" fill="#10B981" />
    </marker>
    <marker id="arrowhead-branch_no" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M 0 0 L 8 4 L 0 8 Z" fill="#F97316" />
    </marker>
    <marker id="arrowhead-fallback" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M 0 0 L 8 4 L 0 8 Z" fill="#64748B" />
    </marker>
  </defs>

  <!-- Background Canvas -->
  <rect width="${canvasWidth}" height="${canvasHeight}" fill="#F8FAFC" />

  <!-- Header Section -->
  <g transform="translate(${padding}, 40)">
    <text x="0" y="0" font-family="Inter, system-ui, sans-serif" font-size="24" font-weight="800" fill="#0F172A">
      ${escapeXml(workflow.title || 'Generated Workflow Diagram')}
    </text>
    <text x="0" y="24" font-family="Inter, system-ui, sans-serif" font-size="13" fill="#64748B">
      ${escapeXml(workflow.summary || 'Generated from text specification')}
    </text>
  </g>

  <!-- Connections Layer -->
  <g class="edges-layer">
    ${edgeSvgElements}
  </g>

  <!-- Nodes Layer -->
  <g class="nodes-layer">
    ${nodeSvgElements}
  </g>
</svg>`;
}

/**
 * Generates an executable Figma Plugin / Scripter script.
 * Users can paste this script directly into Figma's Developer Console or Scripter plugin
 * to create authentic, native auto-layout Figma Frames, text nodes, and FigJam connectors!
 */
export function generateFigmaPluginScript(workflow: WorkflowSpec): string {
  const jsonWorkflow = JSON.stringify(workflow, null, 2);

  return `// ========================================================
// FIGMA PLUGIN SCRIPT: ${workflow.title.replace(/[\n\r"]/g, '')}
// Paste this into Figma Console (Plugins > Development > Open Console)
// or use with the "Scripter" plugin in Figma / FigJam.
// ========================================================

(async function createFigmaWorkflow() {
  const workflowData = ${jsonWorkflow};

  // Ensure fonts are loaded
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });

  const parentPage = figma.currentPage;
  const nodesMap = new Map();

  // Create Parent Frame for Organization
  const mainSection = figma.createFrame();
  mainSection.name = "Workflow: " + (workflowData.title || "Logic Map");
  mainSection.layoutMode = "NONE";
  mainSection.fills = [{ type: 'SOLID', color: { r: 0.97, g: 0.98, b: 0.99 } }];
  mainSection.cornerRadius = 16;
  mainSection.resize(2400, 1600);

  // Title in Figma
  const titleText = figma.createText();
  titleText.fontName = { family: "Inter", style: "Bold" };
  titleText.characters = workflowData.title || "Logic Workflow";
  titleText.fontSize = 28;
  titleText.x = 60;
  titleText.y = 50;
  mainSection.appendChild(titleText);

  const summaryText = figma.createText();
  summaryText.fontName = { family: "Inter", style: "Regular" };
  summaryText.characters = workflowData.summary || "";
  summaryText.fontSize = 14;
  summaryText.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.45, b: 0.52 } }];
  summaryText.x = 60;
  summaryText.y = 90;
  mainSection.appendChild(summaryText);

  // Colors per type
  const typeFills = {
    trigger: { r: 0.94, g: 0.99, b: 0.95 },
    action: { r: 0.93, g: 0.96, b: 1.0 },
    decision: { r: 1.0, g: 0.98, b: 0.92 },
    screen_ui: { r: 0.98, g: 0.96, b: 1.0 },
    database: { r: 0.97, g: 0.98, b: 0.99 },
    api: { r: 0.92, g: 0.99, b: 1.0 },
    end_state: { r: 1.0, g: 0.94, b: 0.95 },
  };

  const typeStrokes = {
    trigger: { r: 0.52, g: 0.93, b: 0.67 },
    action: { r: 0.57, g: 0.77, b: 0.99 },
    decision: { r: 0.99, g: 0.82, b: 0.3 },
    screen_ui: { r: 0.84, g: 0.7, b: 0.99 },
    database: { r: 0.79, g: 0.83, b: 0.88 },
    api: { r: 0.4, g: 0.91, b: 0.97 },
    end_state: { r: 0.99, g: 0.64, b: 0.68 },
  };

  // Create Nodes as Figma Frames
  for (const node of workflowData.nodes) {
    const card = figma.createFrame();
    card.name = node.title || node.id;
    card.layoutMode = "VERTICAL";
    card.paddingTop = 14;
    card.paddingBottom = 14;
    card.paddingLeft = 16;
    card.paddingRight = 16;
    card.itemSpacing = 8;
    card.cornerRadius = 10;

    const fillCol = typeFills[node.type] || typeFills.action;
    const strokeCol = typeStrokes[node.type] || typeStrokes.action;
    card.fills = [{ type: 'SOLID', color: fillCol }];
    card.strokes = [{ type: 'SOLID', color: strokeCol }];
    card.strokeWeight = 1.5;

    card.resize(node.width || 280, node.height || 140);
    card.x = (node.x || 100) + 60;
    card.y = (node.y || 100) + 160;

    // Type Badge
    const badge = figma.createText();
    badge.fontName = { family: "Inter", style: "Bold" };
    badge.characters = (node.type || "ACTION").toUpperCase().replace('_', ' ');
    badge.fontSize = 10;
    badge.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.3, b: 0.4 } }];
    card.appendChild(badge);

    // Title
    const title = figma.createText();
    title.fontName = { family: "Inter", style: "Bold" };
    title.characters = node.title;
    title.fontSize = 13;
    title.fills = [{ type: 'SOLID', color: { r: 0.05, g: 0.1, b: 0.2 } }];
    card.appendChild(title);

    // Description
    const desc = figma.createText();
    desc.fontName = { family: "Inter", style: "Regular" };
    desc.characters = node.description || "";
    desc.fontSize = 11;
    desc.fills = [{ type: 'SOLID', color: { r: 0.3, g: 0.35, b: 0.42 } }];
    card.appendChild(desc);

    // Actor Tag
    if (node.actor) {
      const actorTxt = figma.createText();
      actorTxt.fontName = { family: "Inter", style: "Medium" };
      actorTxt.characters = "Actor: " + node.actor;
      actorTxt.fontSize = 10;
      actorTxt.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.45, b: 0.5 } }];
      card.appendChild(actorTxt);
    }

    mainSection.appendChild(card);
    nodesMap.set(node.id, card);
  }

  // Connectors / Lines
  for (const edge of workflowData.edges) {
    const src = nodesMap.get(edge.source);
    const tgt = nodesMap.get(edge.target);
    if (!src || !tgt) continue;

    // Create a vector connector line
    const line = figma.createVector();
    line.name = "Connector: " + (edge.label || "Flow");
    const startX = src.x + src.width;
    const startY = src.y + src.height / 2;
    const endX = tgt.x;
    const endY = tgt.y + tgt.height / 2;

    const dx = Math.max(endX - startX, 40) * 0.5;
    const path = \`M \${startX} \${startY} C \${startX + dx} \${startY} \${endX - dx} \${endY} \${endX} \${endY}\`;

    line.vectorPaths = [{ windingRule: "NONE", data: path }];
    const isError = edge.conditionType === 'failure' || edge.conditionType === 'branch_no';
    line.strokes = [{
      type: 'SOLID',
      color: isError ? { r: 0.9, g: 0.25, b: 0.25 } : { r: 0.5, g: 0.58, b: 0.68 }
    }];
    line.strokeWeight = 2;
    mainSection.appendChild(line);
  }

  parentPage.appendChild(mainSection);
  figma.viewport.scrollAndZoomIntoView([mainSection]);
  figma.notify("✅ Workflow successfully created in Figma!");
})();`;
}

/**
 * Copies clean SVG vector code to clipboard so the user can directly Cmd+V in Figma
 */
export async function copySvgToClipboard(svgString: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(svgString);
      return true;
    }
    // Fallback using textarea
    const textArea = document.createElement('textarea');
    textArea.value = svgString;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Failed to copy SVG to clipboard:', err);
    return false;
  }
}
