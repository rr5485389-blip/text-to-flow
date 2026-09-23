import React, { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { UploadCloud, FileText, Sparkles, ArrowRight, CheckCircle2, RotateCcw, Sliders, Play, Code2 } from 'lucide-react';
import { SAMPLE_TEXTS, SampleText } from '../data/sampleTexts';

interface TextUploaderProps {
  onAnalyze: (text: string, fileName?: string, direction?: 'horizontal' | 'vertical') => void;
  isAnalyzing: boolean;
  selectedSample?: SampleText | null;
  onClearSample: () => void;
}

export const TextUploader: React.FC<TextUploaderProps> = ({
  onAnalyze,
  isAnalyzing,
  selectedSample,
  onClearSample,
}) => {
  const [textContent, setTextContent] = useState<string>(selectedSample ? selectedSample.content : SAMPLE_TEXTS[0].content);
  const [currentFileName, setCurrentFileName] = useState<string>(selectedSample ? `${selectedSample.id}.txt` : 'auth-mfa-specification.txt');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [direction, setDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync if selected sample changes from outside
  React.useEffect(() => {
    if (selectedSample) {
      setTextContent(selectedSample.content);
      setCurrentFileName(`${selectedSample.id}.txt`);
    }
  }, [selectedSample]);

  // Handle file reading
  const handleFile = (file: File) => {
    if (!file) return;
    setCurrentFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setTextContent(result);
        onClearSample();
      }
    };
    reader.readAsText(file);
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSelectPreset = (sample: SampleText) => {
    setTextContent(sample.content);
    setCurrentFileName(`${sample.id}.txt`);
  };

  const handleStartAnalysis = () => {
    if (!textContent.trim() || isAnalyzing) return;
    onAnalyze(textContent, currentFileName, direction);
  };

  const lineCount = textContent.split('\n').length;
  const charCount = textContent.length;
  const wordCount = textContent.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Intro Hero Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg border border-slate-800">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3 border border-indigo-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Logic & Flow Extraction Engine</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Turn Any Text Specification Into Visual Figma Workflows
          </h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Upload requirements, PRDs, pseudo-code, or architecture docs. The AI analyzes branch logic, system actors, and UI screens, then generates interactive diagrams ready to paste directly into Figma.
          </p>
        </div>

        {/* Preset quick buttons */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
            Or Test With Sample Text Files:
          </p>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_TEXTS.map((sample) => (
              <button
                key={sample.id}
                id={`chip-${sample.id}`}
                onClick={() => handleSelectPreset(sample)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  currentFileName.includes(sample.id)
                    ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-400/40'
                    : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>{sample.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Upload & Text Editor Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Card Header & Controls */}
        <div className="px-5 py-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900 truncate max-w-xs sm:max-w-md">
                {currentFileName || 'Custom Document'}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                <span>{lineCount} lines</span>
                <span>•</span>
                <span>{wordCount} words</span>
                <span>•</span>
                <span>{charCount} characters</span>
              </div>
            </div>
          </div>

          {/* Options: Direction & Actions */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setDirection('horizontal')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  direction === 'horizontal'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Horizontal Layout
              </button>
              <button
                type="button"
                onClick={() => setDirection('vertical')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  direction === 'vertical'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Vertical Flow
              </button>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
              <span>Upload .txt File</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.text,.spec,.json"
              className="hidden"
              onChange={handleFileInputChange}
            />
          </div>
        </div>

        {/* Drag & Drop Overlay or Text Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative transition-all ${
            isDragging ? 'bg-indigo-50/50 ring-2 ring-indigo-500 ring-inset' : 'bg-white'
          }`}
        >
          {isDragging ? (
            <div className="h-80 flex flex-col items-center justify-center text-center p-6">
              <UploadCloud className="w-12 h-12 text-indigo-600 animate-bounce mb-2" />
              <p className="text-base font-bold text-slate-800">Drop your .txt specification file here</p>
              <p className="text-xs text-slate-500 mt-1">We will immediately ingest and parse the logic rules</p>
            </div>
          ) : (
            <div className="relative">
              <textarea
                id="textarea-spec-content"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Paste or write your system logic, user journey, or technical specification text here..."
                rows={14}
                className="w-full p-4 font-mono text-xs sm:text-sm text-slate-800 bg-transparent resize-y focus:outline-hidden focus:ring-0 border-0 leading-relaxed"
                spellCheck={false}
              />
            </div>
          )}
        </div>

        {/* Bottom Action Footer */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Ready to extract actors, decisions, UI screens, and Figma vector shapes</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTextContent('')}
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Clear Text
            </button>
            <button
              id="btn-analyze-text"
              type="button"
              disabled={!textContent.trim() || isAnalyzing}
              onClick={handleStartAnalysis}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Analyzing Logic & Creating Figma Nodes...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Analyze & Generate Figma Workflow</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
