import React, { useState } from 'react';
import {
  WorkflowSpec,
  FigmaVerifyResponse,
  FigmaPostResponse
} from '../types/workflow';
import {
  generateFigmaSvg,
  generateFigmaPluginScript,
  copySvgToClipboard
} from '../utils/figmaExporter';
import { generateWorkflowPdfReport } from '../utils/pdfReportGenerator';
import {
  X,
  Copy,
  Check,
  Download,
  Terminal,
  Key,
  Globe,
  ExternalLink,
  Layers,
  Sparkles,
  Send,
  AlertCircle,
  CheckCircle2,
  Code2,
  FileCode,
  Smartphone,
  FileText,
  Loader2
} from 'lucide-react';

interface FigmaIntegrationPanelProps {
  workflow: WorkflowSpec;
  isOpen: boolean;
  onClose: () => void;
  onFigmaConnected: (userHandle: string) => void;
}

export const FigmaIntegrationPanel: React.FC<FigmaIntegrationPanelProps> = ({
  workflow,
  isOpen,
  onClose,
  onFigmaConnected,
}) => {
  const [activeTab, setActiveTab] = useState<'pdf' | 'copy' | 'plugin' | 'rest_api'>('pdf');
  const [copiedSvg, setCopiedSvg] = useState<boolean>(false);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  // PDF Export state
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfSuccess, setPdfSuccess] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // REST API state
  const [token, setToken] = useState<string>(() => localStorage.getItem('figma_pat_token') || '');
  const [fileUrl, setFileUrl] = useState<string>(() => localStorage.getItem('figma_file_url') || '');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyResult, setVerifyResult] = useState<FigmaVerifyResponse | null>(null);
  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [postResult, setPostResult] = useState<FigmaPostResponse | null>(null);
  const [showTokenHelp, setShowTokenHelp] = useState<boolean>(false);

  if (!isOpen) return null;

  const pluginScript = generateFigmaPluginScript(workflow);
  const svgMarkup = generateFigmaSvg(workflow);

  // Download high-quality PDF report
  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    setPdfError(null);
    setPdfSuccess(false);
    try {
      await generateWorkflowPdfReport(workflow);
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 4000);
    } catch (err: any) {
      console.error('PDF report export failed:', err);
      setPdfError(err.message || 'Failed to generate PDF report. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Copy SVG for Figma
  const handleCopySvg = async () => {
    const success = await copySvgToClipboard(svgMarkup);
    if (success) {
      setCopiedSvg(true);
      setTimeout(() => setCopiedSvg(false), 2500);
    }
  };

  // Copy Plugin Script
  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(pluginScript);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  // Download Plugin Script
  const handleDownloadScript = () => {
    const blob = new Blob([pluginScript], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `figma-${workflow.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-workflow.js`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Extract file key from URL or raw key
  const extractFileKey = (input: string) => {
    const trimmed = input.trim();
    const match = trimmed.match(/figma\.com\/(file|design|board)\/([a-zA-Z0-9_-]+)/);
    return match ? match[2] : trimmed;
  };

  // Verify Figma REST API
  const handleVerifyFigma = async () => {
    if (!token.trim()) return;
    setIsVerifying(true);
    setVerifyResult(null);

    const fileKey = extractFileKey(fileUrl);
    try {
      const res = await fetch('/api/figma/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personalAccessToken: token, fileKey }),
      });
      const data: FigmaVerifyResponse = await res.json();
      setVerifyResult(data);
      if (data.valid && data.user) {
        onFigmaConnected(data.user.handle);
      }
    } catch (err: any) {
      setVerifyResult({ valid: false, error: err.message || 'Network error' });
    } finally {
      setIsVerifying(false);
    }
  };

  // Post comment/summary to Figma File
  const handlePostToFigma = async () => {
    const fileKey = extractFileKey(fileUrl);
    if (!token.trim() || !fileKey) return;

    setIsPosting(true);
    setPostResult(null);

    const commentBody = `🤖 [Workflow Specification from Text Agent]
Title: ${workflow.title}
Summary: ${workflow.summary}
Stages (${workflow.nodes.length}):
${workflow.nodes.map((n, i) => `${i + 1}. [${n.type.toUpperCase()}] ${n.title} (${n.actor || 'System'})`).join('\n')}

Key Insights:
• Bottlenecks: ${workflow.insights.potentialBottlenecks.join(', ')}
• Figma Tips: ${workflow.insights.figmaDesignTips.join(', ')}`;

    try {
      const res = await fetch('/api/figma/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalAccessToken: token,
          fileKey,
          commentMessage: commentBody,
        }),
      });
      const data: FigmaPostResponse = await res.json();
      setPostResult(data);
    } catch (err: any) {
      setPostResult({ success: false, error: err.message || 'Post failed' });
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white">
              <svg viewBox="0 0 38 57" fill="none" className="w-4 h-5">
                <path d="M19 28.5C13.7533 28.5 9.5 24.2467 9.5 19C9.5 13.7533 13.7533 9.5 19 9.5C24.2467 9.5 28.5 13.7533 28.5 19C28.5 24.2467 24.2467 28.5 19 28.5Z" fill="#1ABCFE"/>
                <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83"/>
                <path d="M19 0V19H28.5C33.7467 19 38 14.7533 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" fill="#FF7262"/>
                <path d="M0 9.5C0 14.7533 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" fill="#F24E1E"/>
                <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2467 0 28.5Z" fill="#A259FF"/>
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Figma Workflow Integration Hub
              </h3>
              <p className="text-xs text-slate-500">
                Synchronize, export high-quality PDF reports, copy vectors, or run Figma scripts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Download as PDF Button in Header */}
            <button
              id="figma-header-download-pdf-btn"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                pdfSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              } disabled:opacity-50`}
              title="Download interactive workflow as a high-quality PDF report"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : pdfSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>PDF Downloaded!</span>
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5" />
                  <span>Download as PDF</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-white gap-2 overflow-x-auto">
          <button
            id="tab-btn-pdf"
            onClick={() => setActiveTab('pdf')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
              activeTab === 'pdf'
                ? 'border-rose-600 text-rose-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Download as PDF Report</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">
              PDF
            </span>
          </button>

          <button
            onClick={() => setActiveTab('copy')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
              activeTab === 'copy'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>1-Click Copy for Figma (SVG)</span>
          </button>

          <button
            onClick={() => setActiveTab('plugin')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
              activeTab === 'plugin'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Figma Plugin / Console Script</span>
          </button>

          <button
            onClick={() => setActiveTab('rest_api')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
              activeTab === 'rest_api'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Figma REST API Sync</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          {/* TAB 0: DOWNLOAD AS HIGH-QUALITY PDF REPORT */}
          {activeTab === 'pdf' && (
            <div className="space-y-6">
              {/* Primary PDF Action Box */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-rose-100 text-rose-600">
                        <FileText className="w-4 h-4" />
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        Interactive Workflow Architecture PDF Report
                      </h4>
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed max-w-xl">
                      Converts this active workflow diagram into a high-resolution, multi-page Landscape A4 PDF document containing crisp vector diagrams, detailed step-by-step logic matrices, and system insights.
                    </p>
                  </div>

                  <button
                    id="btn-download-pdf-report-tab"
                    onClick={handleDownloadPdf}
                    disabled={isGeneratingPdf}
                    className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer ${
                      pdfSuccess
                        ? 'bg-emerald-600'
                        : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                    } disabled:opacity-50 shrink-0`}
                  >
                    {isGeneratingPdf ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Rendering High-Res PDF...</span>
                      </>
                    ) : pdfSuccess ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>PDF Report Downloaded!</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Download as PDF Report</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Feedback Alerts */}
                {pdfSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-900 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      High-quality PDF report successfully generated and saved to your downloads folder.
                    </span>
                  </div>
                )}

                {pdfError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-900 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{pdfError}</span>
                  </div>
                )}

                {/* Report Specifications Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                    <div className="flex items-center gap-1.5 text-rose-600 mb-1">
                      <Layers className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Page 1 Blueprint</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800">High-DPI Vector Canvas</p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Rasterized at 2.5x high resolution with archetype colors, connector arrows, and branch decision tags.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                    <div className="flex items-center gap-1.5 text-indigo-600 mb-1">
                      <Code2 className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Page 2 Matrix</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800">Step-by-Step Logic Matrix</p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Full breakdown of all {workflow.nodes.length} stages, actors, core actions, and wireframe element summaries.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                    <div className="flex items-center gap-1.5 text-amber-600 mb-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">System Audit</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800">Insights & Figma Tips</p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Security latency analysis, potential transition bottlenecks, and Figma auto-layout suggestions.
                    </p>
                  </div>
                </div>
              </div>

              {/* Report Structure Live Preview Box */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    Included Document Metadata & Structure
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    Format: A4 Landscape (297mm × 210mm)
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] space-y-2 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
                    <span>Document Title: {workflow.title}</span>
                    <span className="text-rose-400">PDF Report</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-slate-300">
                    <div>Category: <span className="text-indigo-300 font-bold">{workflow.category}</span></div>
                    <div>Stages: <span className="text-emerald-300 font-bold">{workflow.nodes.length}</span></div>
                    <div>Connectors: <span className="text-sky-300 font-bold">{workflow.edges.length}</span></div>
                    <div>Actors: <span className="text-amber-300 font-bold">{workflow.actors.length}</span></div>
                  </div>
                  <div className="text-slate-400 pt-2 border-t border-slate-800/80 text-[10px]">
                    Includes full cryptographic/vector coordinates, decision routing tables, and high-fidelity rendering.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: 1-CLICK COPY FOR FIGMA */}
          {activeTab === 'copy' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Copy Native Vectors to Figma or FigJam
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Figma natively converts standard SVG clipboard data into editable vector frames, grouped cards, labels, and connector lines.
                    </p>
                  </div>
                  <button
                    id="modal-btn-copy-svg"
                    onClick={handleCopySvg}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm cursor-pointer ${
                      copiedSvg
                        ? 'bg-emerald-600'
                        : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
                    }`}
                  >
                    {copiedSvg ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedSvg ? 'Copied to Clipboard!' : 'Copy to Figma Clipboard'}</span>
                  </button>
                </div>

                {/* Instructions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-slate-100">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase">Step 1</span>
                    <p className="text-xs font-semibold text-slate-800 mt-0.5">Click Copy Above</p>
                    <p className="text-[11px] text-slate-500 mt-1">Places the full vector layout onto your system clipboard.</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase">Step 2</span>
                    <p className="text-xs font-semibold text-slate-800 mt-0.5">Switch to Figma</p>
                    <p className="text-[11px] text-slate-500 mt-1">Open any Figma Design file or FigJam whiteboard.</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase">Step 3</span>
                    <p className="text-xs font-semibold text-slate-800 mt-0.5">Press Cmd+V / Ctrl+V</p>
                    <p className="text-[11px] text-slate-500 mt-1">The workflow cards, connectors, and badges appear as editable nodes.</p>
                  </div>
                </div>
              </div>

              {/* Preview Box */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Generated SVG Markup Preview ({svgMarkup.length.toLocaleString()} bytes)
                  </p>
                  <button
                    onClick={handleCopySvg}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                  >
                    Copy Raw SVG
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-slate-900 text-slate-300 font-mono text-[11px] h-40 overflow-y-auto leading-relaxed">
                  {svgMarkup.slice(0, 1500)}...
                </pre>
              </div>
            </div>
          )}

          {/* TAB 2: FIGMA PLUGIN / CONSOLE SCRIPT */}
          {activeTab === 'plugin' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Executable Figma Plugin & Console Script
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Directly programmatic: Run this script in Figma's Dev Console or the popular free "Scripter" plugin to generate authentic Auto-Layout frames and native vectors.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadScript}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .js</span>
                    </button>
                    <button
                      onClick={handleCopyScript}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-sm cursor-pointer ${
                        copiedScript ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      {copiedScript ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedScript ? 'Copied Code!' : 'Copy Script'}</span>
                    </button>
                  </div>
                </div>

                {/* Instructions */}
                <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 text-xs text-indigo-950 space-y-2">
                  <p className="font-bold flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-indigo-600" />
                    How to execute in Figma:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-700 pl-1">
                    <li>In Figma Desktop: Right click canvas → <strong>Plugins → Development → Open Console</strong> (or install the free community plugin <em>Scripter</em>).</li>
                    <li>Paste the script below into the console prompt and hit <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px]">Enter</kbd>.</li>
                    <li>Figma automatically scrolls and centers the newly created workflow canvas!</li>
                  </ol>
                </div>

                {/* Code Preview */}
                <pre className="p-4 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] h-64 overflow-y-auto leading-relaxed border border-slate-800">
                  {pluginScript}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: FIGMA REST API SYNC */}
          {activeTab === 'rest_api' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Figma Cloud REST API Connection
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Connect using your Figma Personal Access Token (PAT) to inspect file metadata and post workflow specification summaries directly into your team's Figma canvas.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* PAT Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Figma Personal Access Token (PAT)
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="figd_..."
                        className="w-full pl-9 pr-4 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                      />
                      <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Generate in Figma: Account Settings → Security → Personal Access Tokens.
                    </p>
                  </div>

                  {/* File URL / Key Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Target Figma File URL or File Key
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={fileUrl}
                        onChange={(e) => setFileUrl(e.target.value)}
                        placeholder="https://www.figma.com/design/XXXXX/My-Design-File"
                        className="w-full pl-9 pr-4 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                      />
                      <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      onClick={handleVerifyFigma}
                      disabled={!token.trim() || isVerifying}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {isVerifying ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Verifying Token...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Verify Figma Account</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handlePostToFigma}
                      disabled={!token.trim() || !fileUrl.trim() || isPosting}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {isPosting ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Posting...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Post Workflow Specs to Figma File</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Verification Results */}
                  {verifyResult && (
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-center gap-3 ${
                        verifyResult.valid
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-rose-50 border-rose-200 text-rose-900'
                      }`}
                    >
                      {verifyResult.valid ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                      )}
                      <div>
                        {verifyResult.valid ? (
                          <>
                            <p className="font-bold">
                              Connected to Figma as {verifyResult.user?.handle} ({verifyResult.user?.email || 'Authenticated'})
                            </p>
                            {verifyResult.fileName && (
                              <p className="text-[11px] text-emerald-700 mt-0.5">
                                Target File Verified: "{verifyResult.fileName}"
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="font-medium">{verifyResult.error || 'Verification failed.'}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Post Result */}
                  {postResult && (
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-center gap-3 ${
                        postResult.success
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-rose-50 border-rose-200 text-rose-900'
                      }`}
                    >
                      {postResult.success ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                      )}
                      <div>
                        <p className="font-bold">
                          {postResult.success ? 'Success!' : 'Post Failed'}
                        </p>
                        <p className="text-[11px] mt-0.5">{postResult.message || postResult.error}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Figma format compatible with Figma Design & FigJam
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors cursor-pointer"
          >
            Close Hub
          </button>
        </div>
      </div>
    </div>
  );
};
