import React from 'react';
import { Layers, FileText, Figma, Sparkles, RefreshCw, UploadCloud, FolderDown } from 'lucide-react';
import { SAMPLE_TEXTS, SampleText } from '../data/sampleTexts';

interface HeaderProps {
  onSelectSample: (sample: SampleText) => void;
  onOpenFigmaModal: () => void;
  onNewWorkflow: () => void;
  hasWorkflow: boolean;
  isAnalyzing: boolean;
  figmaConnected: boolean;
  figmaUser?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onSelectSample,
  onOpenFigmaModal,
  onNewWorkflow,
  hasWorkflow,
  isAnalyzing,
  figmaConnected,
  figmaUser,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-sm ring-2 ring-indigo-100">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                Text to Figma Workflow
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                AI Logic Agent
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Reads txt files, extracts system logic & generates visual Figma workflows
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Sample Presets Dropdown */}
          <div className="relative group">
            <button
              id="btn-sample-templates"
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Sample Specs</span>
            </button>
            <div className="absolute right-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-2 hidden group-hover:block z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                Load Sample Text Files
              </p>
              {SAMPLE_TEXTS.map((sample) => (
                <button
                  key={sample.id}
                  id={`sample-${sample.id}`}
                  onClick={() => onSelectSample(sample)}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-indigo-50 hover:text-indigo-900 text-xs transition-colors flex flex-col gap-0.5 cursor-pointer"
                >
                  <span className="font-semibold text-slate-800">{sample.name}</span>
                  <span className="text-[10px] text-slate-500 truncate">{sample.category}</span>
                </button>
              ))}
            </div>
          </div>

          {/* New / Reset button if workflow exists */}
          {hasWorkflow && (
            <button
              id="btn-reset-workflow"
              onClick={onNewWorkflow}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              title="Upload new text specification"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">New Text File</span>
            </button>
          )}

          {/* Download Complete Project Code ZIP */}
          <a
            id="btn-download-project-zip"
            href="/figma-workflow-agent.zip"
            download="figma-workflow-agent.zip"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-300 hover:border-indigo-300 rounded-lg transition-all cursor-pointer shadow-2xs"
            title="Download full project folder & subfolders as a single ZIP"
          >
            <FolderDown className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Download Code (.ZIP)</span>
            <span className="sm:hidden">ZIP</span>
          </a>

          {/* Figma Integration button */}
          <button
            id="btn-figma-integration-modal"
            onClick={onOpenFigmaModal}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all shadow-xs cursor-pointer ${
              figmaConnected
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                : 'bg-slate-900 text-white hover:bg-slate-800 border border-slate-900'
            }`}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <svg viewBox="0 0 38 57" fill="none" className="w-3.5 h-4">
                <path d="M19 28.5C13.7533 28.5 9.5 24.2467 9.5 19C9.5 13.7533 13.7533 9.5 19 9.5C24.2467 9.5 28.5 13.7533 28.5 19C28.5 24.2467 24.2467 28.5 19 28.5Z" fill="#1ABCFE"/>
                <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83"/>
                <path d="M19 0V19H28.5C33.7467 19 38 14.7533 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" fill="#FF7262"/>
                <path d="M0 9.5C0 14.7533 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" fill="#F24E1E"/>
                <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2467 0 28.5Z" fill="#A259FF"/>
              </svg>
            </div>
            <span>{figmaConnected ? figmaUser || 'Figma Connected' : 'Figma Sync'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
