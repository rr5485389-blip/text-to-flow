/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { WorkflowSpec, WorkflowNode, WorkflowEdge, ArrowSettings, AnalyzeResponse } from './types/workflow';
import { SAMPLE_TEXTS, SampleText } from './data/sampleTexts';
import { Header } from './components/Header';
import { TextUploader } from './components/TextUploader';
import { WorkflowCanvas } from './components/WorkflowCanvas';
import { ScreenWireframeViewer } from './components/ScreenWireframeViewer';
import { AnalysisInsights } from './components/AnalysisInsights';
import { NodeDetailDrawer } from './components/NodeDetailDrawer';
import { FigmaIntegrationPanel } from './components/FigmaIntegrationPanel';
import { DirectFigmaSyncViewer } from './components/DirectFigmaSyncViewer';
import {
  Layers,
  Smartphone,
  Sparkles,
  FileText,
  Figma,
  Copy,
  Check,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Sliders,
  ChevronRight,
  Globe
} from 'lucide-react';
import { copySvgToClipboard, generateFigmaSvg } from './utils/figmaExporter';
import { fallbackTextAnalyzer } from './utils/fallbackAnalyzer';

export default function App() {
  const [workflow, setWorkflow] = useState<WorkflowSpec | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analyzingStep, setAnalyzingStep] = useState<string>('Reading document...');
  const [selectedSample, setSelectedSample] = useState<SampleText | null>(null);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [isFigmaModalOpen, setIsFigmaModalOpen] = useState<boolean>(false);
  const [figmaConnected, setFigmaConnected] = useState<boolean>(false);
  const [figmaUser, setFigmaUser] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'canvas' | 'screens' | 'figma_live' | 'insights' | 'source'>('canvas');
  const [error, setError] = useState<string | null>(null);
  const [copiedFigma, setCopiedFigma] = useState<boolean>(false);
  const [drawerInitialEdit, setDrawerInitialEdit] = useState<boolean>(false);

  // Move node coordinates
  const handleMoveNode = (nodeId: string, x: number, y: number) => {
    setWorkflow((prevWf) => {
      if (!prevWf) return null;
      return {
        ...prevWf,
        nodes: prevWf.nodes.map((n) => (n.id === nodeId ? { ...n, x, y } : n)),
      };
    });
  };

  // Update node contents (title, type, description, details, actor)
  const handleUpdateNode = (updatedNode: WorkflowNode) => {
    setWorkflow((prevWf) => {
      if (!prevWf) return null;
      return {
        ...prevWf,
        nodes: prevWf.nodes.map((n) => (n.id === updatedNode.id ? updatedNode : n)),
      };
    });
    setSelectedNode(updatedNode);
  };

  // Add newly created node
  const handleAddNode = (newNode: WorkflowNode) => {
    setWorkflow((prevWf) => {
      if (!prevWf) return null;
      return {
        ...prevWf,
        nodes: [...prevWf.nodes, newNode],
      };
    });
    setSelectedNode(newNode);
    setDrawerInitialEdit(true);
  };

  // Delete node and its connected edges
  const handleDeleteNode = (nodeId: string) => {
    setWorkflow((prevWf) => {
      if (!prevWf) return null;
      return {
        ...prevWf,
        nodes: prevWf.nodes.filter((n) => n.id !== nodeId),
        edges: prevWf.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      };
    });
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  };

  const handleUpdateArrowSettings = (settings: ArrowSettings) => {
    setWorkflow((prevWf) => {
      if (!prevWf) return null;
      return {
        ...prevWf,
        arrowSettings: settings,
        edges: prevWf.edges.map((e) => ({
          ...e,
          routingStyle: settings.routingStyle,
          strokeStyle: settings.strokeStyle,
          strokeWidth: settings.strokeWidth,
          animated: settings.animated,
          customColor: settings.colorMode === 'custom' ? settings.customColor : undefined,
        })),
      };
    });
  };

  const handleUpdateEdge = (updatedEdge: WorkflowEdge) => {
    setWorkflow((prevWf) => {
      if (!prevWf) return null;
      return {
        ...prevWf,
        edges: prevWf.edges.map((e) => (e.id === updatedEdge.id ? updatedEdge : e)),
      };
    });
  };

  const handleOpenNodeEdit = (node: WorkflowNode) => {
    setSelectedNode(node);
    setDrawerInitialEdit(true);
  };

  // Trigger analysis via backend API with instant browser fallback
  const handleAnalyze = async (
    text: string,
    fileName?: string,
    direction: 'horizontal' | 'vertical' = 'horizontal'
  ) => {
    setIsAnalyzing(true);
    setError(null);
    setAnalyzingStep('Reading and parsing specification text...');

    const stepTimer1 = setTimeout(() => {
      setAnalyzingStep('Extracting decision logic, actors & state transitions...');
    }, 500);

    const stepTimer2 = setTimeout(() => {
      setAnalyzingStep('Calculating non-overlapping auto-layout and Figma vectors...');
    }, 1000);

    try {
      let extractedWorkflow: WorkflowSpec | null = null;

      // Try server-side AI analysis if backend is reachable
      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            fileName,
            options: { direction },
          }),
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data: AnalyzeResponse = await response.json();
            if (data.success && data.workflow) {
              extractedWorkflow = data.workflow;
            }
          }
        }
      } catch (networkErr) {
        console.warn('[API Notice]: Backend service not directly reachable, generating instant visual layout in browser:', networkErr);
      }

      // If backend was not reachable or returned an error, use the deterministic browser layout parser!
      if (!extractedWorkflow) {
        extractedWorkflow = fallbackTextAnalyzer(text, fileName, direction);
      }

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      if (extractedWorkflow) {
        setWorkflow(extractedWorkflow);
        setSelectedNode(null);
        setActiveTab('canvas');
      } else {
        setError('Failed to extract workflow from text.');
      }
    } catch (err: any) {
      console.error('[Analyze Error]:', err);
      try {
        const fallback = fallbackTextAnalyzer(text, fileName, direction);
        setWorkflow(fallback);
        setSelectedNode(null);
        setActiveTab('canvas');
      } catch (fallbackErr: any) {
        setError(err.message || 'Network error communicating with analysis agent.');
      }
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setIsAnalyzing(false);
    }
  };

  const handleSelectSample = (sample: SampleText) => {
    setSelectedSample(sample);
    setWorkflow(null);
    setSelectedNode(null);
  };

  const handleNewWorkflow = () => {
    setWorkflow(null);
    setSelectedNode(null);
    setSelectedSample(null);
    setError(null);
  };

  const handleCopyFigmaSvg = async () => {
    if (!workflow) return;
    const svgCode = generateFigmaSvg(workflow);
    const success = await copySvgToClipboard(svgCode);
    if (success) {
      setCopiedFigma(true);
      setTimeout(() => setCopiedFigma(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      {/* Top Application Navigation */}
      <Header
        onSelectSample={handleSelectSample}
        onOpenFigmaModal={() => setIsFigmaModalOpen(true)}
        onNewWorkflow={handleNewWorkflow}
        hasWorkflow={!!workflow}
        isAnalyzing={isAnalyzing}
        figmaConnected={figmaConnected}
        figmaUser={figmaUser}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Error notification if any */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-rose-600 hover:text-rose-800 font-bold ml-4 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* View 1: Text Uploader & Logic Configuration (if no workflow yet) */}
        {!workflow && !isAnalyzing && (
          <TextUploader
            onAnalyze={handleAnalyze}
            isAnalyzing={isAnalyzing}
            selectedSample={selectedSample}
            onClearSample={() => setSelectedSample(null)}
          />
        )}

        {/* View 2: Analyzing Progress Overlay */}
        {isAnalyzing && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center max-w-xl mx-auto space-y-6 my-12">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100 animate-ping opacity-25" />
              <div className="w-16 h-16 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900">
                AI Agent Analyzing Logic Specification
              </h3>
              <p className="text-xs text-slate-500 font-medium font-mono animate-pulse">
                {analyzingStep}
              </p>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full animate-indeterminate" />
            </div>
            <p className="text-[11px] text-slate-400">
              Transforming logic branches into native Figma frames & FigJam connectors
            </p>
          </div>
        )}

        {/* View 3: Workflow Generated View with Subtabs */}
        {workflow && !isAnalyzing && (
          <div className="space-y-6">
            {/* Top Workspace Tab Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs px-6 py-3 flex flex-wrap items-center justify-between gap-4">
              {/* Tab Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  id="tab-canvas"
                  onClick={() => setActiveTab('canvas')}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'canvas'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Interactive Flowchart</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                    {workflow.nodes.length}
                  </span>
                </button>

                <button
                  id="tab-screens"
                  onClick={() => setActiveTab('screens')}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'screens'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>UI Wireframe Screens</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                    {workflow.nodes.filter((n) => n.type === 'screen_ui' || n.screenData).length}
                  </span>
                </button>

                <button
                  id="tab-figma-live"
                  onClick={() => setActiveTab('figma_live')}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'figma_live'
                      ? 'bg-pink-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900 font-bold'
                  }`}
                >
                  <Figma className="w-4 h-4 text-pink-400" />
                  <span>Direct Figma Sync & Results</span>
                  {figmaConnected ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  ) : (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-pink-100 text-pink-700 font-bold">
                      Direct
                    </span>
                  )}
                </button>

                <button
                  id="tab-insights"
                  onClick={() => setActiveTab('insights')}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'insights'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Logic & Figma Insights</span>
                </button>

                <button
                  id="tab-source"
                  onClick={() => setActiveTab('source')}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'source'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Source Specification</span>
                </button>
              </div>

              {/* Primary Figma Actions */}
              <div className="flex items-center gap-2.5">
                <button
                  id="btn-switch-figma-direct"
                  onClick={() => setActiveTab('figma_live')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-pink-600 hover:bg-pink-700 active:bg-pink-800 text-white shadow-xs transition-all cursor-pointer"
                >
                  <Figma className="w-3.5 h-3.5" />
                  <span>Direct Figma Integration</span>
                </button>

                <button
                  id="btn-open-figma-hub"
                  onClick={() => setIsFigmaModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Export Options</span>
                </button>
              </div>
            </div>

            {/* Tab 1: Interactive Workflow Diagram Canvas */}
            {activeTab === 'canvas' && (
              <WorkflowCanvas
                workflow={workflow}
                onSelectNode={(node) => {
                  setSelectedNode(node);
                  setDrawerInitialEdit(false);
                }}
                selectedNode={selectedNode}
                onOpenFigmaModal={() => setIsFigmaModalOpen(true)}
                onMoveNode={handleMoveNode}
                onUpdateNode={handleUpdateNode}
                onAddNode={handleAddNode}
                onDeleteNode={handleDeleteNode}
                onOpenNodeEdit={handleOpenNodeEdit}
                onUpdateArrowSettings={handleUpdateArrowSettings}
                onUpdateEdge={handleUpdateEdge}
              />
            )}

            {/* Tab 2: UI Wireframe Screens */}
            {activeTab === 'screens' && (
              <ScreenWireframeViewer
                workflow={workflow}
                onOpenFigmaModal={() => setIsFigmaModalOpen(true)}
              />
            )}

            {/* Tab 3: Direct Figma Sync & Results Live View */}
            {activeTab === 'figma_live' && (
              <DirectFigmaSyncViewer
                workflow={workflow}
                figmaConnected={figmaConnected}
                figmaUser={figmaUser}
                onFigmaConnected={(user) => {
                  setFigmaConnected(true);
                  setFigmaUser(user);
                }}
              />
            )}

            {/* Tab 4: Insights & Architecture Specs */}
            {activeTab === 'insights' && (
              <AnalysisInsights workflow={workflow} />
            )}

            {/* Tab 5: Source Specification Text */}
            {activeTab === 'source' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900">Original Document Preview</h4>
                  <button
                    onClick={handleNewWorkflow}
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Upload or Edit Text</span>
                  </button>
                </div>
                <pre className="p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
                  {workflow.rawTextPreview || 'Specification text.'}
                </pre>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Node Inspection Drawer */}
      <NodeDetailDrawer
        node={selectedNode}
        edges={workflow?.edges || []}
        allNodes={workflow?.nodes || []}
        onClose={() => {
          setSelectedNode(null);
          setDrawerInitialEdit(false);
        }}
        onSelectNode={(node) => setSelectedNode(node)}
        onUpdateNode={handleUpdateNode}
        onDeleteNode={handleDeleteNode}
        initialEditMode={drawerInitialEdit}
      />

      {/* Figma Integration Modal Hub */}
      {workflow && (
        <FigmaIntegrationPanel
          workflow={workflow}
          isOpen={isFigmaModalOpen}
          onClose={() => setIsFigmaModalOpen(false)}
          onFigmaConnected={(handle) => {
            setFigmaConnected(true);
            setFigmaUser(handle);
          }}
        />
      )}
    </div>
  );
}
