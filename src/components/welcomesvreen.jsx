import React, { useState } from "react";

export default function WelcomeScreen({ onGetStarted }) {
  const [name, setName] = useState("");

  const handleStart = () => {
    if (!name.trim()) return;
    onGetStarted(name.trim());
  };

  return (
    <div className="min-h-screen bg-[#eef2f7] flex items-center justify-center px-6">
      <div className="w-full max-w-5xl">

        {/* Main Welcome Card */}
        <div className="rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-[#312e81] via-[#172554] to-[#0f172a]">

          <div className="px-8 py-16 md:px-16 md:py-20 text-center">

            {/* Logo / Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full
              bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-sm">
              ✦ Text to Figma Workflow
            </div>

            {/* Heading */}
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white">
              Turn Your Text Into
              <span className="block text-indigo-300">
                Visual Figma Flows
              </span>
            </h1>

            {/* Description */}
            <p className="max-w-2xl mx-auto mt-6 text-lg text-slate-300 leading-relaxed">
              Transform your workflow specifications, requirements and
              technical text into clear visual workflows ready for Figma.
            </p>

            {/* Name Input */}
            <div className="max-w-md mx-auto mt-10 text-left">
              <label className="block mb-2 text-sm font-medium text-slate-300">
                What should we call you?
              </label>

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleStart();
                }}
                placeholder="Enter your name"
                className="w-full px-5 py-4 rounded-xl
                  bg-white/10
                  border border-white/20
                  text-white
                  placeholder:text-slate-400
                  outline-none
                  focus:border-indigo-400
                  focus:ring-2
                  focus:ring-indigo-500/30
                  transition"
              />

              {/* Get Started */}
              <button
                onClick={handleStart}
                disabled={!name.trim()}
                className="w-full mt-4 px-5 py-4 rounded-xl
                  bg-indigo-500
                  hover:bg-indigo-400
                  disabled:opacity-40
                  disabled:cursor-not-allowed
                  text-white font-semibold
                  transition-all"
              >
                Get Started →
              </button>
            </div>

          </div>
        </div>

        {/* Small footer text */}
        <p className="text-center mt-6 text-sm text-slate-500">
          From text specification to visual workflow
        </p>

      </div>
    </div>
  );
}