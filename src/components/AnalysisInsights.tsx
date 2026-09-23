import React from 'react';
import { WorkflowSpec } from '../types/workflow';
import { AlertTriangle, ShieldCheck, Figma, Users, Download, Sparkles, CheckCircle2 } from 'lucide-react';

interface AnalysisInsightsProps {
  workflow: WorkflowSpec;
}

export const AnalysisInsights: React.FC<AnalysisInsightsProps> = ({ workflow }) => {
  const handleDownloadJson = () => {
    const jsonStr = JSON.stringify(workflow, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflow.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-workflow-spec.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            System Logic & Architecture Insights
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Deep analysis of system actors, bottlenecks, security vulnerabilities, and Figma design tokens.
          </p>
        </div>

        <button
          onClick={handleDownloadJson}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Specification (.json)</span>
        </button>
      </div>

      {/* 4-Bento Grid of Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Identified Actors & System Components */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 text-slate-900">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold">Identified Actors & Boundaries ({workflow.actors.length})</h4>
              <p className="text-[11px] text-slate-500">Entities responsible for workflow stages</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {workflow.actors.map((actor, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                {actor}
              </span>
            ))}
          </div>
        </div>

        {/* Figma Design System Tokens */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 text-slate-900">
            <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center text-pink-600">
              <Figma className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold">Figma Design System Tips</h4>
              <p className="text-[11px] text-slate-500">Auto Layout & visual component suggestions</p>
            </div>
          </div>

          <ul className="space-y-2 pt-2 text-xs text-slate-700">
            {workflow.insights.figmaDesignTips.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-2 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Potential Bottlenecks */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 text-slate-900">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold">Potential System Bottlenecks</h4>
              <p className="text-[11px] text-slate-500">Latency & concurrency friction areas</p>
            </div>
          </div>

          <ul className="space-y-2 pt-2 text-xs text-slate-700">
            {workflow.insights.potentialBottlenecks.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 leading-relaxed">
                <span className="text-amber-500 font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Security & Edge Cases */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 text-slate-900">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold">Security Protections & Edge Cases</h4>
              <p className="text-[11px] text-slate-500">Defensive logic and validation checkpoints</p>
            </div>
          </div>

          <ul className="space-y-2 pt-2 text-xs text-slate-700">
            {workflow.insights.securityOrEdgeCases.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 leading-relaxed">
                <span className="text-emerald-500 font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
