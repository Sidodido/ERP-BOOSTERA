"use client";

import React, { useState } from "react";
import { useTheme, THEMES, ThemeName } from "./ThemeProvider";
import { Sun, Moon, Smartphone, ChevronUp, ChevronDown, Check } from "lucide-react";

export function ThemeFloatingButton() {
  const { theme, setTheme, setIsModalOpen } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const currentTheme = THEMES[theme] || THEMES.light;

  const themeOptions: {
    key: ThemeName;
    label: string;
    icon: typeof Sun;
  }[] = [
    { key: "light", label: "Clair", icon: Sun },
    { key: "dark", label: "Dark", icon: Moon },
    { key: "glass", label: "Glass iOS", icon: Smartphone },
  ];

  return (
    <div className="fixed bottom-20 right-3 sm:bottom-4 sm:right-4 z-40 flex flex-col items-end gap-2 select-none">
      {/* Expanded Palette Dock */}
      {expanded && (
        <div className="p-2.5 rounded-2xl bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/80 shadow-2xl space-y-2 animate-in fade-in slide-in-from-bottom-3 duration-200 w-[calc(100vw-2rem)] sm:w-64 max-w-xs">
          <div className="flex items-center justify-between px-1 pb-1 border-b border-neutral-800 text-[11px]">
            <span className="font-bold text-neutral-200">
              Style d'affichage
            </span>
            <button
              onClick={() => {
                setExpanded(false);
                setIsModalOpen(true);
              }}
              className="text-[10px] text-blue-400 hover:text-blue-300 font-bold cursor-pointer"
            >
              Détails ↗
            </button>
          </div>

          {/* 3-Button Segmented Selector */}
          <div className="grid grid-cols-3 gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-[11px] font-semibold">
            {themeOptions.map(({ key, label, icon: Icon }) => {
              const isSelected = theme === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTheme(key)}
                  className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-sm font-bold scale-[1.02]"
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Trigger Floating Pill */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="h-10 px-3.5 rounded-full bg-neutral-900/90 hover:bg-neutral-850 backdrop-blur-md border border-neutral-700/80 shadow-xl text-xs font-semibold text-neutral-200 hover:text-white flex items-center gap-2 transition-all hover:scale-105 cursor-pointer group"
      >
        {theme === "light" && <Sun className="w-4 h-4 text-amber-400" />}
        {theme === "dark" && <Moon className="w-4 h-4 text-blue-400" />}
        {theme === "glass" && <Smartphone className="w-4 h-4 text-sky-400" />}

        <span className="hidden sm:inline">Thème :</span>
        <span className="font-bold text-white">{currentTheme.name}</span>

        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white" />
        )}
      </button>
    </div>
  );
}
