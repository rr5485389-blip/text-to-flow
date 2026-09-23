import React, { useState, useRef, useEffect, MouseEvent } from 'react';
import {
  WorkflowSpec,
  WorkflowNode,
  WorkflowEdge,
  NodeType,
  BoxSizeVariation,
  ArrowRoutingStyle,
  ArrowStrokeStyle,
  ArrowSettings,
} from '../types/workflow';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Copy,
  Download,
  Figma,
  Layers,
  ArrowRight,
  Database,
  Globe,
  Sliders,
  Sparkles,
  CheckCircle,
  HelpCircle,
  Smartphone,
  Check,
  Filter,
  Eye,
  Plus,
  Edit3,
  GripVertical,
  Move,
  Minimize2,
  FileText,
  Loader2,
  Trash2,
  Palette,
  CornerDownRight,
  Spline,
  MoveRight,
  SlidersHorizontal,
  X,
  Zap,
} from 'lucide-react';
import { generateFigmaSvg, copySvgToClipboard } from '../utils/figmaExporter';
import { generateWorkflowPdfReport } from '../utils/pdfReportGenerator';
import {
  calculateArrowPath,
  getStrokeDashArray,
  BOX_SIZE_PRESETS,
  COLOR_PRESETS,
} from '../utils/canvasHelpers';

interface WorkflowCanvasProps {
  workflow: WorkflowSpec;
  onSelectNode: (node: WorkflowNode | null) => void;
  selectedNode: WorkflowNode | null;
  onOpenFigmaModal: () => void;
  onMoveNode?: (nodeId: string, x: number, y: number) => void;
  onUpdateNode?: (node: WorkflowNode) => void;
  onAddNode?: (newNode: WorkflowNode) => void;
  onDeleteNode?: (nodeId: string) => void;
  onOpenNodeEdit?: (node: WorkflowNode) => void;
  onUpdateArrowSettings?: (settings: ArrowSettings) => void;
  onUpdateEdge?: (edge: WorkflowEdge) => void;
}

const TYPE_CONFIG: Record<
  NodeType,
  { label: string; bg: string; border: string; text: string; badgeBg: string; badgeText: string; icon: any }
> = {
  trigger: {
    label: 'Trigger',
    bg: 'bg-emerald-50/95',
    border: 'border-emerald-300',
    text: 'text-emerald-900',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    icon: Sparkles,
  },
  action: {
    label: 'Action',
    bg: 'bg-blue-50/95',
    border: 'border-blue-300',
    text: 'text-blue-900',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
    icon: Sliders,
  },
  decision: {
    label: 'Decision',
    bg: 'bg-amber-50/95',
    border: 'border-amber-300',
    text: 'text-amber-900',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    icon: HelpCircle,
  },
  screen_ui: {
    label: 'UI Screen',
    bg: 'bg-purple-50/95',
    border: 'border-purple-300',
    text: 'text-purple-900',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
    icon: Smartphone,
  },
  database: {
    label: 'Database',
    bg: 'bg-slate-50/95',
    border: 'border-slate-300',
    text: 'text-slate-900',
    badgeBg: 'bg-slate-200',
    badgeText: 'text-slate-700',
    icon: Database,
  },
  api: {
    label: 'API / Service',
    bg: 'bg-cyan-50/95',
    border: 'border-cyan-300',
    text: 'text-cyan-900',
    badgeBg: 'bg-cyan-100',
    badgeText: 'text-cyan-800',
    icon: Globe,
  },
  end_state: {
    label: 'Terminal State',
    bg: 'bg-rose-50/95',
    border: 'border-rose-300',
    text: 'text-rose-900',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-800',
    icon: CheckCircle,
  },
};

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  workflow,
  onSelectNode,
  selectedNode,
  onOpenFigmaModal,
  onMoveNode,
  onUpdateNode,
  onAddNode,
  onDeleteNode,
  onOpenNodeEdit,
  onUpdateArrowSettings,
  onUpdateEdge,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(0.85);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [copiedFigma, setCopiedFigma] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<NodeType | 'all'>('all');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfDownloaded, setPdfDownloaded] = useState<boolean>(false);

  // Arrow & Connector Customization State
  const [arrowSettings, setArrowSettings] = useState<ArrowSettings>(
    workflow.arrowSettings || {
      routingStyle: 'curved',
      strokeStyle: 'solid',
      strokeWidth: 2.5,
      colorMode: 'condition',
      customColor: '#6366F1',
      animated: false,
    }
  );
  const [showArrowCustomizer, setShowArrowCustomizer] = useState<boolean>(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Box Manual Resize State (Figma-like drag corner)
  const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);
  const resizeStartRef = useRef<{ clientX: number; clientY: number; width: number; height: number }>({
    clientX: 0,
    clientY: 0,
    width: 0,
    height: 0,
  });

  // Inline color picker popover state for node
  const [activeColorNodeId, setActiveColorNodeId] = useState<string | null>(null);

  // Synchronized refs for native event callbacks
  const scaleRef = useRef<number>(scale);
  const positionRef = useRef<{ x: number; y: number }>(position);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // Keep arrow settings in sync if workflow prop updates
  useEffect(() => {
    if (workflow.arrowSettings) {
      setArrowSettings(workflow.arrowSettings);
    }
  }, [workflow.arrowSettings]);

  // Keyboard shortcut: Delete key deletes the selected box!
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeEl = document.activeElement as HTMLElement | null;
        if (
          activeEl &&
          (activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.isContentEditable)
        ) {
          return;
        }
        if (selectedNode && onDeleteNode) {
          onDeleteNode(selectedNode.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, onDeleteNode]);

  // Node Dragging State
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hasMovedThreshold, setHasMovedThreshold] = useState<boolean>(false);
  const dragStartPosRef = useRef<{ clientX: number; clientY: number }>({ clientX: 0, clientY: 0 });

  // Center view on load or when workflow changes
  useEffect(() => {
    handleFitView();
  }, [workflow.id]);

  // Native Non-Passive Wheel Event Listener:
  // 1. Calling preventDefault() inside a non-passive listener completely PREVENTS the entire display/window from scrolling up or down!
  // 2. Scrolling up/down moves and pans the Figma flow vertically!
  // 3. Shift + scroll pans horizontally!
  // 4. Holding Ctrl/Cmd or pinch-zooming zooms into the flow centered at cursor!
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheelNative = (e: globalThis.WheelEvent) => {
      // Crucial: Stop browser window from scrolling up or down
      e.preventDefault();
      e.stopPropagation();

      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom or Ctrl+Wheel: Zoom towards cursor position
        const zoomFactor = 1.08;
        const currentScale = scaleRef.current;
        const newScale = e.deltaY < 0 ? currentScale * zoomFactor : currentScale / zoomFactor;
        const clampedScale = Math.min(Math.max(newScale, 0.25), 2.5);

        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const dx = mouseX - positionRef.current.x;
        const dy = mouseY - positionRef.current.y;
        const scaleRatio = clampedScale / currentScale;

        const newPos = {
          x: Math.round(mouseX - dx * scaleRatio),
          y: Math.round(mouseY - dy * scaleRatio),
        };

        positionRef.current = newPos;
        scaleRef.current = clampedScale;
        setPosition(newPos);
        setScale(clampedScale);
      } else {
        // Natural mouse wheel / trackpad scroll:
        // Scrolling up scrolls the flow up; scrolling down scrolls the flow down.
        const deltaX = e.shiftKey ? e.deltaY : e.deltaX;
        const deltaY = e.shiftKey ? 0 : e.deltaY;

        const newPos = {
          x: Math.round(positionRef.current.x - deltaX),
          y: Math.round(positionRef.current.y - deltaY),
        };

        positionRef.current = newPos;
        setPosition(newPos);
      }
    };

    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheelNative);
    };
  }, []);

  const handleFitView = () => {
    if (!containerRef.current || workflow.nodes.length === 0) return;
    const container = containerRef.current;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    workflow.nodes.forEach((n) => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    });

    const graphWidth = maxX - minX + 160;
    const graphHeight = maxY - minY + 160;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const scaleX = containerWidth / graphWidth;
    const scaleY = containerHeight / graphHeight;
    const optimalScale = Math.min(Math.max(Math.min(scaleX, scaleY) * 0.9, 0.4), 1.1);

    setScale(optimalScale);
    setPosition({
      x: (containerWidth - graphWidth * optimalScale) / 2 - minX * optimalScale + 80 * optimalScale,
      y: (containerHeight - graphHeight * optimalScale) / 2 - minY * optimalScale + 80 * optimalScale,
    });
  };

  // Mousedown on background for canvas panning
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    // If clicking on a node or button, don't initiate canvas pan
    if ((e.target as HTMLElement).closest('.workflow-node-card')) return;
    setIsPanning(true);
    setStartPan({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  // Mousedown on a node card to start moving that box
  const handleNodeMouseDown = (e: MouseEvent, node: WorkflowNode) => {
    // If clicking on an internal action button (like edit or copy), do not drag
    if ((e.target as HTMLElement).closest('button')) return;

    e.stopPropagation();

    // Canvas coordinate space
    const canvasX = (e.clientX - position.x) / scale;
    const canvasY = (e.clientY - position.y) / scale;

    setDraggingNodeId(node.id);
    setDragOffset({
      x: canvasX - node.x,
      y: canvasY - node.y,
    });
    setHasMovedThreshold(false);
    dragStartPosRef.current = { clientX: e.clientX, clientY: e.clientY };
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    // Case 0: Dragging to resize a node box (Figma-like resize corner)
    if (resizingNodeId) {
      const dx = (e.clientX - resizeStartRef.current.clientX) / scale;
      const dy = (e.clientY - resizeStartRef.current.clientY) / scale;
      const newWidth = Math.max(180, Math.min(650, Math.round(resizeStartRef.current.width + dx)));
      const newHeight = Math.max(90, Math.min(480, Math.round(resizeStartRef.current.height + dy)));

      const targetNode = workflow.nodes.find((n) => n.id === resizingNodeId);
      if (targetNode && onUpdateNode) {
        onUpdateNode({
          ...targetNode,
          width: newWidth,
          height: newHeight,
          sizeVariation: 'custom',
        });
      }
      return;
    }

    // Case 1: Dragging a node box
    if (draggingNodeId) {
      const dist = Math.hypot(
        e.clientX - dragStartPosRef.current.clientX,
        e.clientY - dragStartPosRef.current.clientY
      );
      if (dist > 3) {
        setHasMovedThreshold(true);
      }

      const canvasX = (e.clientX - position.x) / scale;
      const canvasY = (e.clientY - position.y) / scale;
      const newX = Math.round(canvasX - dragOffset.x);
      const newY = Math.round(canvasY - dragOffset.y);

      if (onMoveNode) {
        onMoveNode(draggingNodeId, newX, newY);
      }
      return;
    }

    // Case 2: Panning the background canvas
    if (isPanning) {
      setPosition({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y,
      });
    }
  };

  const handleMouseUp = () => {
    if (resizingNodeId) {
      setResizingNodeId(null);
      return;
    }

    if (draggingNodeId) {
      if (!hasMovedThreshold) {
        // Pure click without dragging -> select node
        const clickedNode = workflow.nodes.find((n) => n.id === draggingNodeId);
        if (clickedNode) {
          onSelectNode(clickedNode);
        }
      }
      setDraggingNodeId(null);
      setHasMovedThreshold(false);
      return;
    }
    setIsPanning(false);
  };

  // Helper: Apply Size Variation Preset to a Box
  const handleSelectSizeVariation = (node: WorkflowNode, variation: BoxSizeVariation) => {
    if (variation === 'custom') return;
    const preset = BOX_SIZE_PRESETS[variation];
    if (onUpdateNode) {
      onUpdateNode({
        ...node,
        width: preset.width,
        height: preset.height,
        sizeVariation: variation,
      });
    }
  };

  // Helper: Apply Color Preset or Hex Color to a Box
  const handleSelectNodeColor = (node: WorkflowNode, presetId: string, hexColor?: string) => {
    if (!onUpdateNode) return;
    if (presetId === 'default') {
      onUpdateNode({
        ...node,
        customColor: undefined,
        customBg: undefined,
        customBorder: undefined,
      });
      return;
    }
    const preset = COLOR_PRESETS.find((p) => p.id === presetId);
    const color = hexColor || (preset ? preset.color : '#6366F1');
    const bg = preset ? preset.bg : `${color}15`;
    const border = preset ? preset.border : `${color}50`;
    onUpdateNode({
      ...node,
      customColor: color,
      customBg: bg,
      customBorder: border,
    });
  };

  // Helper: Apply Arrow Customization Settings
  const handleApplyArrowSettings = (newSettings: Partial<ArrowSettings>) => {
    const updated: ArrowSettings = { ...arrowSettings, ...newSettings };
    setArrowSettings(updated);
    if (onUpdateArrowSettings) {
      onUpdateArrowSettings(updated);
    }
  };

  // 1-Click Add New Step Box
  const handleAddNewStep = () => {
    if (!onAddNode) return;
    const container = containerRef.current;
    const width = container ? container.clientWidth : 800;
    const height = container ? container.clientHeight : 600;

    // Place new node near center of current view
    const centerX = Math.round((width / 2 - position.x) / scale - 140);
    const centerY = Math.round((height / 2 - position.y) / scale - 75);

    const stepNumber = workflow.nodes.length + 1;
    const newNode: WorkflowNode = {
      id: `node-${Date.now().toString().slice(-4)}`,
      type: 'action',
      title: `Step ${stepNumber}: Custom Process`,
      description: 'Describe this newly added stage logic and operations.',
      actor: 'System / User',
      x: centerX,
      y: centerY,
      width: 290,
      height: 155,
      details: ['Newly added custom step'],
    };

    onAddNode(newNode);
    onSelectNode(newNode);
    if (onOpenNodeEdit) {
      onOpenNodeEdit(newNode);
    }
  };

  // 1-Click Copy SVG for Figma
  const handleCopyFigmaSvg = async () => {
    const svgCode = generateFigmaSvg(workflow);
    const success = await copySvgToClipboard(svgCode);
    if (success) {
      setCopiedFigma(true);
      setTimeout(() => setCopiedFigma(false), 2500);
    }
  };

  // Download SVG file
  const handleDownloadSvg = () => {
    const svgCode = generateFigmaSvg(workflow);
    const blob = new Blob([svgCode], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${workflow.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-figma-workflow.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download High-Quality PDF Report
  const handleDownloadPdfReport = async () => {
    setIsGeneratingPdf(true);
    setPdfDownloaded(false);
    try {
      await generateWorkflowPdfReport(workflow);
      setPdfDownloaded(true);
      setTimeout(() => setPdfDownloaded(false), 3500);
    } catch (err) {
      console.error('Failed to export PDF report from canvas:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Filter nodes
  const filteredNodes =
    activeFilter === 'all'
      ? workflow.nodes
      : workflow.nodes.filter((n) => n.type === activeFilter);

  const nodeMap = new Map<string, WorkflowNode>();
  workflow.nodes.forEach((n) => nodeMap.set(n.id, n));

  return (
    <div
      className={`${
        isExpanded
          ? 'fixed inset-2 sm:inset-4 z-50 rounded-2xl shadow-2xl border border-slate-700'
          : 'relative w-full h-[760px] rounded-2xl border border-slate-800 shadow-xl'
      } bg-slate-900 overflow-hidden flex flex-col select-none transition-all`}
    >
      {/* Top Floating Control Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Left: Workflow Title & Stats */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-4 py-2.5 rounded-xl shadow-lg pointer-events-auto flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight truncate max-w-xs sm:max-w-md">
                {workflow.title}
              </h3>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {workflow.category}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
              <span>{workflow.nodes.length} stages • {workflow.edges.length} connectors</span>
              <span className="text-indigo-400 font-semibold">• Drag boxes to reposition</span>
            </p>
          </div>
        </div>

        {/* Right: Quick Actions (Add Step, Copy for Figma, Figma Options, Fullscreen, Download) */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-1.5 rounded-xl shadow-lg pointer-events-auto flex items-center gap-2">
          {/* Add Step Button */}
          {onAddNode && (
            <button
              id="btn-canvas-add-step"
              onClick={handleAddNewStep}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-all cursor-pointer"
              title="Add a new step box to the workflow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Step</span>
            </button>
          )}

          {/* Customize Arrows Button */}
          <div className="relative">
            <button
              id="btn-customize-arrows"
              onClick={() => setShowArrowCustomizer(!showArrowCustomizer)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                showArrowCustomizer
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
              title="Customize arrow routing, stroke style, thickness, and colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
              <span>Arrows</span>
              <span className="text-[10px] uppercase font-bold text-indigo-300 bg-indigo-950/80 px-1 rounded">
                {arrowSettings.routingStyle === 'orthogonal'
                  ? 'Step'
                  : arrowSettings.routingStyle === 'straight'
                  ? 'Line'
                  : 'Curve'}
              </span>
            </button>

            {/* Arrow Customizer Floating Panel */}
            {showArrowCustomizer && (
              <div
                id="panel-arrow-customizer"
                className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 z-50 text-slate-200 space-y-3.5 pointer-events-auto backdrop-blur-md"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Customize Arrows</h4>
                  </div>
                  <button
                    onClick={() => setShowArrowCustomizer(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 1. Routing Style */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400">Path Routing</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'curved', label: 'Curved', icon: Spline },
                      { id: 'orthogonal', label: 'Step / Ortho', icon: CornerDownRight },
                      { id: 'straight', label: 'Straight', icon: MoveRight },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleApplyArrowSettings({ routingStyle: item.id as ArrowRoutingStyle })}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                          arrowSettings.routingStyle === item.id
                            ? 'bg-indigo-600/30 border-indigo-500 text-white'
                            : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <item.icon className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Stroke Style */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400">Stroke Style</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'solid', label: 'Solid', preview: '————' },
                      { id: 'dashed', label: 'Dashed', preview: '- - - -' },
                      { id: 'dotted', label: 'Dotted', preview: '• • • •' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleApplyArrowSettings({ strokeStyle: item.id as ArrowStrokeStyle })}
                        className={`p-1.5 rounded-lg text-[11px] font-bold border text-center transition-all cursor-pointer ${
                          arrowSettings.strokeStyle === item.id
                            ? 'bg-indigo-600/30 border-indigo-500 text-white'
                            : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <span className="font-mono block text-[10px] text-indigo-300">{item.preview}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Stroke Width */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-400">Arrow Thickness</span>
                    <span className="font-mono text-indigo-400 font-bold">{arrowSettings.strokeWidth || 2.5}px</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { width: 1.5, label: 'Fine (1.5px)' },
                      { width: 2.5, label: 'Standard (2.5px)' },
                      { width: 4.0, label: 'Bold (4.0px)' },
                    ].map((item) => (
                      <button
                        key={item.width}
                        type="button"
                        onClick={() => handleApplyArrowSettings({ strokeWidth: item.width })}
                        className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border text-center transition-all cursor-pointer ${
                          (arrowSettings.strokeWidth || 2.5) === item.width
                            ? 'bg-indigo-600/30 border-indigo-500 text-white'
                            : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Color Mode */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400">Color Appearance</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleApplyArrowSettings({ colorMode: 'condition' })}
                      className={`p-1.5 rounded-lg text-[10px] font-bold border text-left transition-all cursor-pointer ${
                        arrowSettings.colorMode === 'condition'
                          ? 'bg-indigo-600/30 border-indigo-500 text-white'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="w-2 h-2 rounded-full bg-rose-400" />
                        <span className="w-2 h-2 rounded-full bg-orange-400" />
                      </div>
                      <span>Outcome Colors</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApplyArrowSettings({ colorMode: 'custom' })}
                      className={`p-1.5 rounded-lg text-[10px] font-bold border text-left transition-all cursor-pointer ${
                        arrowSettings.colorMode === 'custom'
                          ? 'bg-indigo-600/30 border-indigo-500 text-white'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className="w-3 h-3 rounded-full border border-white/50"
                          style={{ backgroundColor: arrowSettings.customColor || '#6366F1' }}
                        />
                        <span>Unified</span>
                      </div>
                      <span>Custom Color</span>
                    </button>
                  </div>

                  {arrowSettings.colorMode === 'custom' && (
                    <div className="flex items-center gap-2 pt-1">
                      {['#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#94A3B8'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => handleApplyArrowSettings({ customColor: c })}
                          className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-transform ${
                            arrowSettings.customColor === c ? 'scale-110 border-white shadow-md' : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <input
                        type="color"
                        value={arrowSettings.customColor || '#6366F1'}
                        onChange={(e) => handleApplyArrowSettings({ customColor: e.target.value })}
                        className="w-6 h-6 rounded-full border-0 p-0 cursor-pointer bg-transparent"
                        title="Pick custom hex color"
                      />
                    </div>
                  )}
                </div>

                {/* 5. Animated Flow Toggle */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    Animated Flow
                  </span>
                  <button
                    type="button"
                    onClick={() => handleApplyArrowSettings({ animated: !arrowSettings.animated })}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                      arrowSettings.animated ? 'bg-indigo-600' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        arrowSettings.animated ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Copy for Figma Button */}
          <button
            id="btn-copy-figma-svg"
            onClick={handleCopyFigmaSvg}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              copiedFigma
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="Copies SVG to clipboard. Press Cmd+V in Figma to paste native editable shapes!"
          >
            {copiedFigma ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedFigma ? 'Copied!' : 'Copy SVG'}</span>
          </button>

          {/* Figma Modal Trigger */}
          <button
            id="btn-figma-hub"
            onClick={onOpenFigmaModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            title="Open Figma sync & plugin tools"
          >
            <Figma className="w-3.5 h-3.5 text-pink-400" />
            <span>Figma Options</span>
          </button>

          {/* Quick PDF Report button */}
          <button
            id="btn-canvas-download-pdf"
            onClick={handleDownloadPdfReport}
            disabled={isGeneratingPdf}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              pdfDownloaded
                ? 'bg-emerald-600 text-white'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-xs'
            } disabled:opacity-50`}
            title="Download workflow as a high-quality PDF report"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">PDF...</span>
              </>
            ) : pdfDownloaded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Downloaded!</span>
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5" />
                <span>PDF Report</span>
              </>
            )}
          </button>

          {/* Maximize / Collapse Canvas */}
          <button
            id="btn-toggle-expand-canvas"
            onClick={() => {
              setIsExpanded(!isExpanded);
              setTimeout(() => handleFitView(), 60);
            }}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse to standard view' : 'Maximize full canvas view'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4 text-indigo-400" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Download SVG */}
          <button
            id="btn-download-svg"
            onClick={handleDownloadSvg}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Download SVG vector file"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Bottom Left: Canvas Navigation & Zoom Controls */}
      <div className="absolute bottom-4 left-4 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-1.5 rounded-xl shadow-lg flex items-center gap-1">
        <button
          onClick={() => setScale((s) => Math.min(s * 1.2, 2.5))}
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <span className="text-[11px] font-mono text-slate-400 px-1 min-w-[40px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale((s) => Math.max(s / 1.2, 0.25))}
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-slate-700 mx-1" />
        <button
          onClick={handleFitView}
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="Fit to view"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Scroll Helper Info */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium text-slate-400 border-l border-slate-700 ml-1">
          <span>Scroll: pan flow</span>
          <span className="text-slate-600">•</span>
          <span>Ctrl + scroll: zoom</span>
        </div>
      </div>

      {/* Floating Bottom Right: Node Type Filter Chips */}
      <div className="absolute bottom-4 right-4 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-1.5 rounded-xl shadow-lg hidden md:flex items-center gap-1">
        <span className="text-[10px] uppercase font-bold text-slate-400 px-2 flex items-center gap-1">
          <Filter className="w-3 h-3" /> Filter:
        </span>
        {(['all', 'trigger', 'action', 'decision', 'screen_ui', 'database', 'api', 'end_state'] as const).map(
          (type) => (
            <button
              key={type}
              onClick={() => setActiveFilter(type)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                activeFilter === type
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {type === 'all' ? 'All' : type.replace('_', ' ')}
            </button>
          )
        )}
      </div>

      {/* Interactive Drag & Canvas Viewport (Non-passive native wheel listener handles scroll without moving the outer page) */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`w-full h-full relative overflow-hidden touch-none overscroll-contain ${
          draggingNodeId ? 'cursor-move' : isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          backgroundImage: `radial-gradient(circle, rgba(148, 163, 184, 0.15) 1px, transparent 1px)`,
          backgroundSize: `${32 * scale}px ${32 * scale}px`,
          backgroundPosition: `${position.x}px ${position.y}px`,
          touchAction: 'none',
          overscrollBehavior: 'contain',
        }}
      >
        {/* Transform Layer */}
        <div
          className="absolute origin-top-left"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          }}
        >
          {/* SVG Connector Layer */}
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            style={{
              width: 6000,
              height: 5000,
              overflow: 'visible',
            }}
          >
            <defs>
              <marker id="canvas-arrow-default" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 Z" fill="#64748B" />
              </marker>
              <marker id="canvas-arrow-success" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 Z" fill="#10B981" />
              </marker>
              <marker id="canvas-arrow-failure" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 Z" fill="#EF4444" />
              </marker>
              <marker id="canvas-arrow-branch_yes" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 Z" fill="#10B981" />
              </marker>
              <marker id="canvas-arrow-branch_no" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 Z" fill="#F97316" />
              </marker>
              <marker id="canvas-arrow-custom" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 Z" fill={arrowSettings.customColor || '#6366F1'} />
              </marker>
            </defs>

            {workflow.edges.map((edge) => {
              const src = nodeMap.get(edge.source);
              const tgt = nodeMap.get(edge.target);
              if (!src || !tgt) return null;

              // Customized Arrow Routing & Stroke Attributes
              const routing = edge.routingStyle || arrowSettings.routingStyle;
              const strokeStyle = edge.strokeStyle || arrowSettings.strokeStyle;
              const strokeWidth = edge.strokeWidth || arrowSettings.strokeWidth || 2.5;
              const isAnimated = edge.animated ?? arrowSettings.animated;

              const { path: pathD, midX, midY } = calculateArrowPath(src, tgt, routing);

              const isUnifiedCustom = arrowSettings.colorMode === 'custom' || !!edge.customColor;
              const strokeColor =
                edge.customColor ||
                (arrowSettings.colorMode === 'custom' && arrowSettings.customColor
                  ? arrowSettings.customColor
                  : edge.conditionType === 'failure'
                  ? '#EF4444'
                  : edge.conditionType === 'branch_no'
                  ? '#F97316'
                  : edge.conditionType === 'success' || edge.conditionType === 'branch_yes'
                  ? '#10B981'
                  : '#64748B');

              const markerId = isUnifiedCustom
                ? 'canvas-arrow-custom'
                : `canvas-arrow-${edge.conditionType || 'default'}`;

              const isEdgeSelected = selectedEdgeId === edge.id;

              return (
                <g key={edge.id} className="transition-all">
                  {/* Thicker invisible path for easy clicking & selection */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={16}
                    className="cursor-pointer pointer-events-auto"
                    onClick={() => setSelectedEdgeId(isEdgeSelected ? null : edge.id)}
                  />

                  {/* Visible Styled Arrow Line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isEdgeSelected ? strokeWidth + 2 : strokeWidth}
                    strokeDasharray={getStrokeDashArray(strokeStyle)}
                    markerEnd={`url(#${markerId})`}
                    className={isAnimated ? 'animate-pulse' : ''}
                    style={
                      isAnimated && strokeStyle !== 'solid'
                        ? { strokeDashoffset: 10, transition: 'stroke 0.2s' }
                        : undefined
                    }
                  />

                  {/* Selected Edge Highlight Glow */}
                  {isEdgeSelected && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#818CF8"
                      strokeWidth={strokeWidth + 4}
                      strokeOpacity={0.4}
                      strokeDasharray={getStrokeDashArray(strokeStyle)}
                    />
                  )}

                  {/* Edge Label Badge */}
                  {edge.label && (
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect
                        x="-45"
                        y="-12"
                        width="90"
                        height="24"
                        rx="12"
                        fill="#0F172A"
                        stroke={strokeColor}
                        strokeWidth="1.5"
                      />
                      <text
                        x="0"
                        y="4"
                        fill="#F8FAFC"
                        fontSize="10"
                        fontWeight="600"
                        textAnchor="middle"
                        fontFamily="Inter, sans-serif"
                      >
                        {edge.label.slice(0, 16)}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Nodes Layer */}
          {workflow.nodes.map((node) => {
            const config = TYPE_CONFIG[node.type] || TYPE_CONFIG.action;
            const IconComponent = config.icon;
            const isSelected = selectedNode?.id === node.id;
            const isDragging = draggingNodeId === node.id;
            const isFilteredOut = activeFilter !== 'all' && node.type !== activeFilter;

            // Custom manual styles or type defaults
            const customBoxStyle: React.CSSProperties = {
              left: `${node.x}px`,
              top: `${node.y}px`,
              width: `${node.width}px`,
              minHeight: `${node.height}px`,
              backgroundColor: node.customBg || undefined,
              borderColor: node.customBorder || undefined,
            };

            const currentVariation = node.sizeVariation || 'standard';

            return (
              <div
                key={node.id}
                id={`canvas-node-${node.id}`}
                onMouseDown={(e) => handleNodeMouseDown(e, node)}
                className={`workflow-node-card absolute rounded-xl p-4 transition-shadow select-none ${
                  node.customBg ? '' : config.bg
                } ${node.customBorder ? '' : config.border} border-2 ${
                  isDragging
                    ? 'ring-4 ring-pink-500 ring-offset-2 ring-offset-slate-900 shadow-2xl z-40 cursor-grabbing opacity-95 scale-[1.01]'
                    : isSelected
                    ? 'ring-4 ring-indigo-500 ring-offset-2 ring-offset-slate-900 shadow-xl z-30 cursor-move scale-[1.005]'
                    : 'hover:shadow-lg hover:border-indigo-400 z-10 cursor-move'
                } ${isFilteredOut ? 'opacity-25' : 'opacity-100'}`}
                style={customBoxStyle}
              >
                {/* Floating Contextual Quick-Action Toolbar above Selected Node */}
                {isSelected && (
                  <div
                    onMouseDown={(e) => e.stopPropagation()}
                    className="absolute -top-11 left-0 flex items-center gap-1.5 bg-slate-900/95 border border-slate-700 backdrop-blur-md px-2.5 py-1 rounded-xl shadow-2xl z-50 text-slate-200 pointer-events-auto"
                  >
                    {/* Size Variations Selector */}
                    <div className="flex items-center gap-0.5 pr-1.5 border-r border-slate-700">
                      {(['compact', 'standard', 'large', 'expanded'] as const).map((v) => {
                        const labels: Record<string, string> = {
                          compact: 'XS',
                          standard: 'M',
                          large: 'L',
                          expanded: 'XL',
                        };
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => handleSelectSizeVariation(node, v)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                              currentVariation === v
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                            title={`Resize box to ${BOX_SIZE_PRESETS[v].label} (${BOX_SIZE_PRESETS[v].width}x${BOX_SIZE_PRESETS[v].height})`}
                          >
                            {labels[v]}
                          </button>
                        );
                      })}
                    </div>

                    {/* Quick Color Swatches */}
                    <div className="flex items-center gap-1 pr-1.5 border-r border-slate-700">
                      {COLOR_PRESETS.slice(0, 4).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectNodeColor(node, p.id)}
                          className="w-3.5 h-3.5 rounded-full border border-white/30 hover:scale-125 transition-transform cursor-pointer"
                          style={{ backgroundColor: p.color }}
                          title={`Color: ${p.label}`}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setActiveColorNodeId(activeColorNodeId === node.id ? null : node.id)
                        }
                        className="p-0.5 text-slate-400 hover:text-pink-400 rounded cursor-pointer"
                        title="More colors & custom hex picker"
                      >
                        <Palette className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Edit Drawer Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenNodeEdit) onOpenNodeEdit(node);
                      }}
                      className="p-1 text-slate-300 hover:text-indigo-400 hover:bg-slate-800 rounded cursor-pointer"
                      title="Edit step details in drawer"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>

                    {/* Delete Box Button */}
                    {onDeleteNode && (
                      <button
                        type="button"
                        onClick={() => onDeleteNode(node.id)}
                        className="p-1 text-slate-300 hover:text-rose-400 hover:bg-slate-800 rounded cursor-pointer"
                        title="Delete box (or press Delete key)"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}

                {/* Inline Color Picker Popover for this specific node */}
                {activeColorNodeId === node.id && (
                  <div
                    onMouseDown={(e) => e.stopPropagation()}
                    className="absolute -top-32 left-0 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 z-50 text-slate-200 pointer-events-auto space-y-2.5 backdrop-blur-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white flex items-center gap-1">
                        <Palette className="w-3.5 h-3.5 text-pink-400" />
                        Box Color
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveColorNodeId(null)}
                        className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="grid grid-cols-6 gap-1.5">
                      {COLOR_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            handleSelectNodeColor(node, p.id);
                            setActiveColorNodeId(null);
                          }}
                          className="w-7 h-7 rounded-lg border border-white/20 flex items-center justify-center hover:scale-110 transition-transform cursor-pointer text-[9px] font-bold"
                          style={{ backgroundColor: p.color }}
                          title={p.label}
                        >
                          {p.id === 'default' && '✕'}
                        </button>
                      ))}
                    </div>

                    {/* Custom Hex Input */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                      <input
                        type="color"
                        value={node.customColor || '#6366F1'}
                        onChange={(e) => handleSelectNodeColor(node, 'custom', e.target.value)}
                        className="w-6 h-6 rounded-md border-0 p-0 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={node.customColor || ''}
                        placeholder="#HEX code"
                        onChange={(e) => handleSelectNodeColor(node, 'custom', e.target.value)}
                        className="flex-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}

                {/* Header: Archetype Badge, Actor & Controls */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${config.badgeBg} ${config.badgeText}`}
                    style={node.customColor ? { color: node.customColor } : undefined}
                  >
                    <IconComponent className="w-3 h-3" />
                    {config.label}
                  </span>

                  <div className="flex items-center gap-1">
                    {node.actor && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 truncate max-w-[90px]">
                        {node.actor}
                      </span>
                    )}

                    {/* Quick Color Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveColorNodeId(activeColorNodeId === node.id ? null : node.id);
                      }}
                      className="p-1 text-slate-400 hover:text-pink-600 hover:bg-white/80 rounded-md transition-colors cursor-pointer"
                      title="Change box color"
                    >
                      <Palette className="w-3.5 h-3.5" />
                    </button>

                    {/* Edit Stage Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectNode(node);
                        if (onOpenNodeEdit) {
                          onOpenNodeEdit(node);
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white/80 rounded-md transition-colors cursor-pointer"
                      title="Edit this step (title, text, type)"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Box Button */}
                    {onDeleteNode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteNode(node.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white/80 rounded-md transition-colors cursor-pointer"
                        title="Delete box"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Title */}
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                  {node.title}
                </h4>

                {/* Description */}
                <p className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                  {node.description}
                </p>

                {/* Screen UI Wireframe Preview if screen_ui node */}
                {node.type === 'screen_ui' && node.screenData && (
                  <div className="mt-2.5 pt-2 border-t border-purple-200/80 bg-white/70 rounded-lg p-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold text-purple-900">
                      <span className="truncate">{node.screenData.screenName}</span>
                      <span className="text-[9px] px-1 rounded bg-purple-100 text-purple-700 uppercase font-mono">
                        {node.screenData.screenType}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {node.screenData.elements.slice(0, 3).map((el, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-2 py-1 rounded bg-slate-100/90 border border-slate-200 text-[10px]"
                        >
                          <span className="text-slate-700 truncate">{el.label}</span>
                          <span className="text-[9px] text-slate-400 font-mono capitalize">
                            {el.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Drag & Dimension Indicator Footer */}
                <div className="mt-2 pt-1.5 border-t border-slate-200/50 flex items-center justify-between text-[9px] text-slate-400">
                  <span className="flex items-center gap-1 font-mono">
                    <Move className="w-2.5 h-2.5" />
                    {Math.round(node.x)}, {Math.round(node.y)}
                  </span>
                  <span className="font-mono text-slate-500">
                    {Math.round(node.width)}×{Math.round(node.height)}px
                  </span>
                </div>

                {/* Corner Resize Handle for Figma-like manual drag sizing */}
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setResizingNodeId(node.id);
                    resizeStartRef.current = {
                      clientX: e.clientX,
                      clientY: e.clientY,
                      width: node.width,
                      height: node.height,
                    };
                  }}
                  className="absolute bottom-0.5 right-0.5 w-5 h-5 cursor-nwse-resize flex items-center justify-center text-slate-400 hover:text-indigo-600 group z-30 pointer-events-auto"
                  title="Drag corner to manually resize box width and height"
                >
                  <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-slate-400/80 group-hover:border-indigo-600 rounded-br-xs" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
