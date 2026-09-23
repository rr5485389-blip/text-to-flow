import React, { useState } from 'react';
import { WorkflowSpec, WorkflowNode } from '../types/workflow';
import { Smartphone, Copy, Check, Layers, ExternalLink, Sparkles } from 'lucide-react';
import { copySvgToClipboard } from '../utils/figmaExporter';

interface ScreenWireframeViewerProps {
  workflow: WorkflowSpec;
  onOpenFigmaModal: () => void;
}

export const ScreenWireframeViewer: React.FC<ScreenWireframeViewerProps> = ({
  workflow,
  onOpenFigmaModal,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Extract all nodes that represent screen UI or have screenData
  const screenNodes = workflow.nodes.filter(
    (n) => n.type === 'screen_ui' || (n.screenData && n.screenData.elements.length > 0)
  );

  const handleCopyScreenSvg = async (node: WorkflowNode) => {
    if (!node.screenData) return;
    const width = 360;
    const height = 480;

    const elementsMarkup = node.screenData.elements
      .map((el, idx) => {
        const y = 80 + idx * 56;
        if (el.type === 'input') {
          return `
            <g transform="translate(24, ${y})">
              <text x="0" y="-8" font-family="Inter, sans-serif" font-size="11" font-weight="600" fill="#475569">${el.label}</text>
              <rect x="0" y="0" width="${width - 48}" height="40" rx="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" />
              <text x="12" y="24" font-family="Inter, sans-serif" font-size="12" fill="#94A3B8">${el.value || 'Enter value...'}</text>
            </g>
          `;
        } else if (el.type === 'button') {
          const isPrimary = el.variant === 'primary' || !el.variant;
          const bgCol = isPrimary ? '#4F46E5' : '#F1F5F9';
          const txtCol = isPrimary ? '#FFFFFF' : '#1E293B';
          return `
            <g transform="translate(24, ${y})">
              <rect x="0" y="0" width="${width - 48}" height="42" rx="10" fill="${bgCol}" />
              <text x="${(width - 48) / 2}" y="26" font-family="Inter, sans-serif" font-size="12" font-weight="700" fill="${txtCol}" text-anchor="middle">${el.label}</text>
            </g>
          `;
        } else if (el.type === 'badge') {
          return `
            <g transform="translate(24, ${y})">
              <rect x="0" y="0" width="120" height="24" rx="12" fill="#EEF2FF" stroke="#C7D2FE" stroke-width="1" />
              <text x="60" y="16" font-family="Inter, sans-serif" font-size="10" font-weight="700" fill="#4338CA" text-anchor="middle">${el.label}</text>
            </g>
          `;
        } else {
          return `
            <g transform="translate(24, ${y})">
              <text x="0" y="16" font-family="Inter, sans-serif" font-size="13" font-weight="700" fill="#0F172A">${el.label}</text>
            </g>
          `;
        }
      })
      .join('\n');

    const screenSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <!-- Device Frame -->
  <rect width="${width}" height="${height}" rx="24" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="2" />
  
  <!-- Header Bar -->
  <rect width="${width}" height="64" rx="24" fill="#FFFFFF" />
  <rect y="40" width="${width}" height="24" fill="#FFFFFF" />
  <line x1="0" y1="64" x2="${width}" y2="64" stroke="#E2E8F0" stroke-width="1" />
  
  <!-- Screen Title -->
  <text x="24" y="42" font-family="Inter, sans-serif" font-size="15" font-weight="800" fill="#0F172A">${node.screenData.screenName}</text>
  <text x="${width - 24}" y="42" font-family="Inter, sans-serif" font-size="10" font-weight="600" fill="#6366F1" text-anchor="end">${node.screenData.screenType.toUpperCase()}</text>

  <!-- Screen Content -->
  ${elementsMarkup}
</svg>`;

    const success = await copySvgToClipboard(screenSvg);
    if (success) {
      setCopiedId(node.id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  if (screenNodes.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-xl mx-auto space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
          <Smartphone className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-slate-900">No Dedicated UI Screen Stages Detected</h4>
        <p className="text-xs text-slate-500 leading-relaxed">
          The specification describes backend, data, or system actions. In the workflow canvas tab, you can inspect all {workflow.nodes.length} stages and export them as Figma vector shapes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Extracted UI Wireframe Screens ({screenNodes.length})
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Visual component layouts derived directly from the logic flow. Copy each screen as an editable Figma frame.
          </p>
        </div>

        <button
          onClick={onOpenFigmaModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
        >
          <span>Open Figma Options</span>
        </button>
      </div>

      {/* Grid of Screen Mockups */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {screenNodes.map((node) => {
          const screen = node.screenData!;
          const isCopied = copiedId === node.id;

          return (
            <div
              key={node.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col"
            >
              {/* Screen Top Header */}
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                    {screen.screenType}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 truncate max-w-[200px]">
                    {screen.screenName || node.title}
                  </h4>
                </div>

                <button
                  onClick={() => handleCopyScreenSvg(node)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isCopied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                  }`}
                  title="Copy this screen as native vector frame for Figma"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'Copied Frame!' : 'Copy to Figma'}</span>
                </button>
              </div>

              {/* Wireframe Body Mockup */}
              <div className="p-5 flex-1 space-y-4 bg-slate-50/40">
                <p className="text-xs text-slate-600 leading-relaxed italic">
                  "{node.description}"
                </p>

                <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900">{screen.screenName}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>

                  {screen.elements.map((el, i) => (
                    <div key={i} className="space-y-1">
                      {el.type === 'input' && (
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">
                            {el.label}
                          </label>
                          <div className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] text-slate-400 font-mono">
                            {el.value || 'user_input_placeholder'}
                          </div>
                        </div>
                      )}

                      {el.type === 'button' && (
                        <button
                          type="button"
                          className={`w-full py-2 rounded-lg text-xs font-bold transition-colors cursor-default ${
                            el.variant === 'primary' || !el.variant
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-800 border border-slate-200'
                          }`}
                        >
                          {el.label}
                        </button>
                      )}

                      {el.type === 'badge' && (
                        <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {el.label}
                        </span>
                      )}

                      {el.type === 'header' && (
                        <h5 className="text-xs font-bold text-slate-800">{el.label}</h5>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Actor: {node.actor || 'User'}</span>
                <span>{screen.elements.length} UI components</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
