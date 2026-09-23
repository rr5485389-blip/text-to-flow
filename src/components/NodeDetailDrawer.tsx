import React, { useState, useEffect } from 'react';
import { WorkflowNode, WorkflowEdge, NodeType, BoxSizeVariation } from '../types/workflow';
import {
  X,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft,
  Layers,
  Sliders,
  Smartphone,
  Database,
  Globe,
  CheckCircle,
  Edit3,
  Trash2,
  Plus,
  Save,
  HelpCircle,
  Sparkles,
  Palette,
  Maximize2,
  AlertTriangle
} from 'lucide-react';
import { copySvgToClipboard } from '../utils/figmaExporter';
import { BOX_SIZE_PRESETS, COLOR_PRESETS } from '../utils/canvasHelpers';

interface NodeDetailDrawerProps {
  node: WorkflowNode | null;
  edges: WorkflowEdge[];
  allNodes: WorkflowNode[];
  onClose: () => void;
  onSelectNode: (node: WorkflowNode) => void;
  onUpdateNode?: (node: WorkflowNode) => void;
  onDeleteNode?: (nodeId: string) => void;
  initialEditMode?: boolean;
}

export const NodeDetailDrawer: React.FC<NodeDetailDrawerProps> = ({
  node,
  edges,
  allNodes,
  onClose,
  onSelectNode,
  onUpdateNode,
  onDeleteNode,
  initialEditMode = false,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(initialEditMode);

  // Form edit fields
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [actor, setActor] = useState<string>('');
  const [type, setType] = useState<NodeType>('action');
  const [details, setDetails] = useState<string[]>([]);
  const [newDetailInput, setNewDetailInput] = useState<string>('');

  // Box size & manual dimensions
  const [sizeVariation, setSizeVariation] = useState<BoxSizeVariation>('standard');
  const [boxWidth, setBoxWidth] = useState<number>(290);
  const [boxHeight, setBoxHeight] = useState<number>(155);

  // Custom Color fields
  const [customColor, setCustomColor] = useState<string>('');
  const [customBg, setCustomBg] = useState<string>('');
  const [customBorder, setCustomBorder] = useState<string>('');

  // Confirm delete dialog state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

  // Sync state whenever selected node changes
  useEffect(() => {
    if (node) {
      setTitle(node.title || '');
      setDescription(node.description || '');
      setActor(node.actor || '');
      setType(node.type || 'action');
      setDetails(node.details ? [...node.details] : []);
      setSizeVariation(node.sizeVariation || 'standard');
      setBoxWidth(node.width || 290);
      setBoxHeight(node.height || 155);
      setCustomColor(node.customColor || '');
      setCustomBg(node.customBg || '');
      setCustomBorder(node.customBorder || '');
      setIsEditing(initialEditMode);
      setShowDeleteConfirm(false);
    }
  }, [node, initialEditMode]);

  if (!node) return null;

  const nodeMap = new Map<string, WorkflowNode>();
  allNodes.forEach((n) => nodeMap.set(n.id, n));

  const incomingEdges = edges.filter((e) => e.target === node.id);
  const outgoingEdges = edges.filter((e) => e.source === node.id);

  // Copy single node SVG for Figma
  const handleCopyNodeSvg = async () => {
    const width = boxWidth || 320;
    const height = boxHeight || (node.type === 'screen_ui' ? 240 : 160);
    const borderColor = customBorder || '#6366F1';
    const bgColor = customBg || '#FFFFFF';

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" rx="14" fill="${bgColor}" stroke="${borderColor}" stroke-width="2" />
  <rect x="20" y="20" width="80" height="22" rx="6" fill="#EEF2FF" />
  <text x="60" y="35" font-family="Inter, sans-serif" font-size="10" font-weight="700" fill="#4338CA" text-anchor="middle">${node.type.toUpperCase()}</text>
  <text x="20" y="70" font-family="Inter, sans-serif" font-size="14" font-weight="700" fill="#0F172A">${node.title.replace(/[<>&'"]/g, '')}</text>
  <text x="20" y="92" font-family="Inter, sans-serif" font-size="11" fill="#475569">${node.description.slice(0, 50).replace(/[<>&'"]/g, '')}</text>
  ${node.actor ? `<text x="20" y="${height - 20}" font-family="Inter, sans-serif" font-size="10" font-weight="600" fill="#6366F1">Actor: ${node.actor.replace(/[<>&'"]/g, '')}</text>` : ''}
</svg>`;

    const success = await copySvgToClipboard(svg);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Handle Box Size Preset Selection
  const handleSelectSizePreset = (presetKey: Exclude<BoxSizeVariation, 'custom'>) => {
    const preset = BOX_SIZE_PRESETS[presetKey];
    setSizeVariation(presetKey);
    setBoxWidth(preset.width);
    setBoxHeight(preset.height);

    if (onUpdateNode) {
      onUpdateNode({
        ...node,
        sizeVariation: presetKey,
        width: preset.width,
        height: preset.height,
      });
    }
  };

  // Handle Color Preset Selection
  const handleSelectColorPreset = (presetId: string) => {
    if (presetId === 'default') {
      setCustomColor('');
      setCustomBg('');
      setCustomBorder('');
      if (onUpdateNode) {
        onUpdateNode({
          ...node,
          customColor: undefined,
          customBg: undefined,
          customBorder: undefined,
        });
      }
    } else {
      const preset = COLOR_PRESETS.find((p) => p.id === presetId);
      if (preset) {
        setCustomColor(preset.color);
        setCustomBg(preset.bg);
        setCustomBorder(preset.border);
        if (onUpdateNode) {
          onUpdateNode({
            ...node,
            customColor: preset.color,
            customBg: preset.bg,
            customBorder: preset.border,
          });
        }
      }
    }
  };

  // Handle Manual Custom Color Pick
  const handleCustomHexPick = (hex: string) => {
    setCustomColor(hex);
    setCustomBorder(hex);
    // Subtle background tint from hex
    setCustomBg(`${hex}15`);
    if (onUpdateNode) {
      onUpdateNode({
        ...node,
        customColor: hex,
        customBorder: hex,
        customBg: `${hex}15`,
      });
    }
  };

  const handleSaveEdit = () => {
    if (!title.trim() || !onUpdateNode) return;

    const updatedNode: WorkflowNode = {
      ...node,
      title: title.trim(),
      description: description.trim(),
      actor: actor.trim(),
      type,
      details: details.filter((d) => d.trim().length > 0),
      sizeVariation,
      width: Math.max(180, boxWidth),
      height: Math.max(100, boxHeight),
      customColor: customColor || undefined,
      customBg: customBg || undefined,
      customBorder: customBorder || undefined,
    };

    onUpdateNode(updatedNode);
    setIsEditing(false);
  };

  const handleAddDetail = () => {
    if (!newDetailInput.trim()) return;
    setDetails([...details, newDetailInput.trim()]);
    setNewDetailInput('');
  };

  const handleRemoveDetail = (index: number) => {
    setDetails(details.filter((_, i) => i !== index));
  };

  const handleConfirmDelete = () => {
    if (onDeleteNode) {
      onDeleteNode(node.id);
      onClose();
    }
  };

  return (
    <div className="fixed right-0 top-16 bottom-0 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div>
          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
            {isEditing ? 'Edit Workflow Stage' : 'Stage Inspection'}
          </span>
          <h3 className="text-sm font-bold text-slate-900 truncate max-w-[240px]">
            {isEditing ? `Editing: ${title || node.title}` : node.title}
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Direct Delete Box button */}
          {onDeleteNode && (
            <button
              id="btn-drawer-delete-node"
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition-all cursor-pointer flex items-center gap-1"
              title="Delete this box from workflow"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold">Delete</span>
            </button>
          )}

          {/* Edit Toggle Button */}
          <button
            id="btn-drawer-edit-toggle"
            onClick={() => setIsEditing(!isEditing)}
            className={`p-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              isEditing
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-200/80 hover:bg-slate-300 text-slate-700'
            }`}
            title={isEditing ? 'Done Editing' : 'Edit this box (text, color, size)'}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span className="text-[11px] font-bold">{isEditing ? 'Done' : 'Edit Box'}</span>
          </button>

          {!isEditing && (
            <button
              onClick={handleCopyNodeSvg}
              className={`p-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                copied
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-200/80 hover:bg-slate-300 text-slate-700'
              }`}
              title="Copy this single stage as an editable Figma SVG"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          )}

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Delete Confirmation Alert Banner */}
      {showDeleteConfirm && (
        <div className="mx-6 mt-4 p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-3 shadow-md animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-rose-900">Delete this box?</h4>
              <p className="text-[11px] text-rose-700 mt-0.5 leading-relaxed">
                "{node.title}" and any arrows connected to it will be permanently removed from the diagram.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-rose-200">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-delete-node"
              type="button"
              onClick={handleConfirmDelete}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Yes, Delete Box</span>
            </button>
          </div>
        </div>
      )}

      {/* Body Area */}
      <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
        {/* ================= EDIT MODE ================= */}
        {isEditing ? (
          <div className="space-y-5 animate-in fade-in">
            {/* SECTION: Box Size & Dimensions */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Box Size Variations</span>
                </label>
                <span className="text-[10px] font-mono text-slate-500 font-semibold">
                  {boxWidth} × {boxHeight} px
                </span>
              </div>

              {/* Variation Presets */}
              <div className="grid grid-cols-2 gap-2">
                {(['compact', 'standard', 'large', 'expanded'] as const).map((presetKey) => {
                  const preset = BOX_SIZE_PRESETS[presetKey];
                  const isActive = sizeVariation === presetKey;
                  return (
                    <button
                      key={presetKey}
                      type="button"
                      onClick={() => handleSelectSizePreset(presetKey)}
                      className={`p-2 rounded-lg text-left border transition-all cursor-pointer ${
                        isActive
                          ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-bold shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span>{preset.label}</span>
                        <span className="font-mono text-[9px] text-slate-400">
                          {preset.width}×{preset.height}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Manual Width & Height Sliders */}
              <div className="space-y-2 pt-1 border-t border-slate-200/80">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-600 font-medium">
                    <span>Manual Width:</span>
                    <span className="font-mono font-bold text-slate-900">{boxWidth} px</span>
                  </div>
                  <input
                    type="range"
                    min={180}
                    max={550}
                    step={10}
                    value={boxWidth}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBoxWidth(val);
                      setSizeVariation('custom');
                      if (onUpdateNode) {
                        onUpdateNode({ ...node, width: val, sizeVariation: 'custom' });
                      }
                    }}
                    className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-600 font-medium">
                    <span>Manual Height:</span>
                    <span className="font-mono font-bold text-slate-900">{boxHeight} px</span>
                  </div>
                  <input
                    type="range"
                    min={90}
                    max={400}
                    step={10}
                    value={boxHeight}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBoxHeight(val);
                      setSizeVariation('custom');
                      if (onUpdateNode) {
                        onUpdateNode({ ...node, height: val, sizeVariation: 'custom' });
                      }
                    }}
                    className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                  />
                </div>
              </div>
            </div>

            {/* SECTION: Box Custom Color */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-pink-600" />
                  <span>Manual Box Color</span>
                </label>
                {customColor && (
                  <button
                    type="button"
                    onClick={() => handleSelectColorPreset('default')}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                  >
                    Reset to Archetype
                  </button>
                )}
              </div>

              {/* Color Presets */}
              <div className="grid grid-cols-3 gap-1.5">
                {COLOR_PRESETS.map((preset) => {
                  const isCurrent =
                    (preset.id === 'default' && !customColor) ||
                    preset.color.toLowerCase() === customColor.toLowerCase();
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectColorPreset(preset.id)}
                      className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[10px] transition-all cursor-pointer ${
                        isCurrent
                          ? 'border-indigo-600 bg-white ring-2 ring-indigo-400 font-bold shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                      }`}
                      title={preset.name}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0 border border-slate-300"
                        style={{ backgroundColor: preset.id === 'default' ? '#CBD5E1' : preset.color }}
                      />
                      <span className="truncate">{preset.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Color Picker input */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-200/80">
                <label className="text-[11px] text-slate-600 font-medium">Custom Hex Color:</label>
                <input
                  type="color"
                  value={customColor || '#6366F1'}
                  onChange={(e) => handleCustomHexPick(e.target.value)}
                  className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0.5 bg-white"
                  title="Pick any manual color for this box"
                />
                <input
                  type="text"
                  value={customColor || ''}
                  placeholder="#6366F1"
                  onChange={(e) => handleCustomHexPick(e.target.value)}
                  className="flex-1 px-2.5 py-1 text-xs font-mono rounded-lg border border-slate-300 bg-white"
                />
              </div>
            </div>

            {/* Field: Stage Title */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Stage / Box Title
              </label>
              <input
                id="input-edit-node-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Step 3: Credential Verification"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-900 bg-white"
              />
            </div>

            {/* Field: Node Type */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Node Archetype / Category
              </label>
              <select
                id="select-edit-node-type"
                value={type}
                onChange={(e) => setType(e.target.value as NodeType)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 bg-white cursor-pointer"
              >
                <option value="trigger">Trigger (Start event / User arrival)</option>
                <option value="action">Action (System process / Computation)</option>
                <option value="decision">Decision (Condition / IF-ELSE branch check)</option>
                <option value="screen_ui">UI Screen (Visual page, modal, or form)</option>
                <option value="database">Database (Storage, query, or record log)</option>
                <option value="api">API / Service (External webhook, gateway)</option>
                <option value="end_state">End State (Success, lockout, or terminal exit)</option>
              </select>
            </div>

            {/* Field: Responsible Actor */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Responsible Actor / System
              </label>
              <input
                id="input-edit-node-actor"
                type="text"
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                placeholder="e.g. Customer, Auth Server, PostgreSQL"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 bg-white"
              />
            </div>

            {/* Field: Description */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Stage Description & Logic
              </label>
              <textarea
                id="textarea-edit-node-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happens in this stage..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 bg-white leading-relaxed resize-none"
              />
            </div>

            {/* Field: Technical Details / Bullet Rules */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700">
                Technical Rules & Specifications
              </label>
              <div className="space-y-1.5">
                {details.map((d, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-400 font-bold">•</span>
                    <input
                      type="text"
                      value={d}
                      onChange={(e) => {
                        const newD = [...details];
                        newD[idx] = e.target.value;
                        setDetails(newD);
                      }}
                      className="flex-1 bg-transparent text-xs text-slate-800 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveDetail(idx)}
                      className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Detail Row */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newDetailInput}
                  onChange={(e) => setNewDetailInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddDetail()}
                  placeholder="Add a new rule or detail..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                />
                <button
                  type="button"
                  onClick={handleAddDetail}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* Save & Delete Action Controls */}
            <div className="pt-4 border-t border-slate-200 flex flex-col gap-2">
              <button
                id="btn-save-node-edits"
                type="button"
                onClick={handleSaveEdit}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Changes to Box</span>
              </button>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  Cancel
                </button>

                {onDeleteNode && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Box</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ================= VIEW MODE ================= */
          <div className="space-y-5">
            {/* Quick Box Styling & Size Bar in View Mode */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Box Size Variation</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {node.width} × {node.height} px
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(['compact', 'standard', 'large', 'expanded'] as const).map((presetKey) => {
                  const preset = BOX_SIZE_PRESETS[presetKey];
                  const isActive = (node.sizeVariation || 'standard') === presetKey;
                  return (
                    <button
                      key={presetKey}
                      type="button"
                      onClick={() => handleSelectSizePreset(presetKey)}
                      className={`px-2 py-1.5 rounded-lg text-center border text-[10px] transition-all cursor-pointer ${
                        isActive
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                      title={preset.description}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Quick Color Chips */}
              <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Palette className="w-3 h-3 text-pink-500" />
                    <span>Color Theme</span>
                  </span>
                  {node.customColor && (
                    <button
                      type="button"
                      onClick={() => handleSelectColorPreset('default')}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {COLOR_PRESETS.map((p) => {
                    const isSelected =
                      (p.id === 'default' && !node.customColor) ||
                      p.color.toLowerCase() === (node.customColor || '').toLowerCase();
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectColorPreset(p.id)}
                        className={`w-6 h-6 rounded-full border transition-all cursor-pointer flex items-center justify-center ${
                          isSelected ? 'ring-2 ring-indigo-500 scale-110' : 'border-slate-300 hover:scale-105'
                        }`}
                        style={{ backgroundColor: p.id === 'default' ? '#F1F5F9' : p.color }}
                        title={p.name}
                      >
                        {isSelected && (
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: p.id === 'default' || p.id === 'white' ? '#0F172A' : '#FFFFFF' }}
                          />
                        )}
                      </button>
                    );
                  })}
                  <input
                    type="color"
                    value={node.customColor || '#6366F1'}
                    onChange={(e) => handleCustomHexPick(e.target.value)}
                    className="w-6 h-6 rounded-full border border-slate-300 cursor-pointer p-0 overflow-hidden bg-transparent"
                    title="Choose custom manual color"
                  />
                </div>
              </div>
            </div>

            {/* Core Attributes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Node Archetype</span>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {node.type.replace('_', ' ')}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Responsible Actor</span>
                <span className="font-semibold text-slate-800">{node.actor || 'System Engine'}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Stage Identifier</span>
                <span className="font-mono text-slate-600">{node.id}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Canvas Position</span>
                <span className="font-mono text-slate-600">
                  X: {Math.round(node.x)}px, Y: {Math.round(node.y)}px
                </span>
              </div>
            </div>

            {/* Quick Edit Banner */}
            <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between">
              <span className="text-[11px] text-indigo-900 font-medium">Want to change this step?</span>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-2.5 py-1 bg-white rounded-lg text-[11px] font-bold text-indigo-700 border border-indigo-200 hover:bg-indigo-50 cursor-pointer shadow-xs flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" />
                <span>Edit Box</span>
              </button>
            </div>

            {/* Description */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Logic Description
              </p>
              <p className="text-xs text-slate-700 leading-relaxed">{node.description}</p>
            </div>

            {/* Technical Specification Details */}
            {node.details && node.details.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Technical Rules & Specs
                </p>
                <ul className="space-y-1.5">
                  {node.details.map((detail, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-slate-600 leading-relaxed">
                      <span className="text-indigo-500 font-bold">•</span>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Screen UI Elements if screen_ui node */}
            {node.type === 'screen_ui' && node.screenData && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">
                  Screen Elements ({node.screenData.elements.length})
                </p>
                <div className="space-y-1.5">
                  {node.screenData.elements.map((el, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                    >
                      <span className="font-semibold text-slate-700">{el.label}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-100 text-purple-800 uppercase">
                        {el.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transitions In / Out */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              {/* Incoming Transitions */}
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5 text-slate-400" /> Incoming Transitions ({incomingEdges.length})
                </p>
                {incomingEdges.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">None (Initiating Trigger Stage)</p>
                ) : (
                  <div className="space-y-1.5">
                    {incomingEdges.map((edge) => {
                      const sourceNode = nodeMap.get(edge.source);
                      return (
                        <div
                          key={edge.id}
                          onClick={() => sourceNode && onSelectNode(sourceNode)}
                          className="p-2 rounded-lg bg-slate-50 hover:bg-indigo-50 border border-slate-200 transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                            {sourceNode?.title || edge.source}
                          </span>
                          <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                            {edge.label || 'Next'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Outgoing Transitions */}
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" /> Outgoing Transitions ({outgoingEdges.length})
                </p>
                {outgoingEdges.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">None (Terminal End State)</p>
                ) : (
                  <div className="space-y-1.5">
                    {outgoingEdges.map((edge) => {
                      const targetNode = nodeMap.get(edge.target);
                      return (
                        <div
                          key={edge.id}
                          onClick={() => targetNode && onSelectNode(targetNode)}
                          className="p-2 rounded-lg bg-slate-50 hover:bg-indigo-50 border border-slate-200 transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                            {targetNode?.title || edge.target}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {edge.label || 'Next'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
