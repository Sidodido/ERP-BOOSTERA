"use client";

import React, { useState } from "react";
import { useTheme, THEMES, ThemeName, ThemeCategory } from "./ThemeProvider";
import { Palette, ChevronUp, ChevronDown, Check, Moon, Sun, SlidersHorizontal } from "lucide-react";

export function ThemeFloatingButton() {
  const { theme, setTheme, setIsModalOpen } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<ThemeCategory>("dark");

  const currentTheme = THEMES[theme] || THEMES.blue;

  const currentCategoryThemes = (Object.keys(THEMES) as ThemeName[]).filter(
    (key) => THEMES[key]?.category === activeTab
  );

  return (
    <div className="fixed bottom-20 right-3 sm:bottom-4 sm:right-4 z-40 flex flex-col items-end gap-2 select-none">
      {/* Expanded Palette Dock */}
      {expanded && (
        <div className="p-3 rounded-2xl bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/80 shadow-2xl space-y-2.5 animate-in fade-in slide-in-from-bottom-3 duration-200 w-[calc(100vw-2rem)] sm:w-72 max-w-xs">
          <div className="flex items-center justify-between px-1 pb-1.5 border-b border-neutral-800 text-[11px]">
            <span className="font-bold text-neutral-200 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-amber-400" />
              <span>Ambiance ERP (9 Thèmes)</span>
            </span>
            <button
              onClick={() => {
                setExpanded(false);
                setIsModalOpen(true);
              }}
              className="text-[10px] text-blue-400 hover:text-blue-300 font-bold cursor-pointer"
            >
              Galerie ↗
            </button>
          </div>

          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-2 gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-[10px] font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("dark")}
              className={`py-1 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                activeTab === "dark" ? "bg-neutral-800 text-white shadow-xs" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Moon className="w-2.5 h-2.5 text-blue-400" />
              <span>Sombres (5)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("light")}
              className={`py-1 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                activeTab === "light" ? "bg-neutral-800 text-white shadow-xs" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Sun className="w-2.5 h-2.5 text-amber-400" />
              <span>Clairs (4)</span>
            </button>
          </div>

          {/* Theme Buttons for Selected Category */}
          <div className="flex items-center justify-between gap-1.5 pt-1">
            {currentCategoryThemes.map((key) => {
              const item = THEMES[key];
              const isSelected = theme === key;

              return (
                <button
                  key={key}
                  onClick={() => setTheme(key)}
                  className={`h-8 flex-1 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                    isSelected
                      ? "ring-2 ring-white scale-105 shadow-md"
                      : "hover:scale-105 opacity-70 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: item.primaryHex,
                  }}
                  title={`${item.name} (${item.subtitle})`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                </button>
              );
            })}
          </div>

          <div className="text-[10px] text-center text-neutral-400 pt-1 border-t border-neutral-800 flex items-center justify-between">
            <span className="truncate max-w-[170px] text-neutral-300">
              Actif : <strong className="text-white">{currentTheme.name}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setIsModalOpen(true);
              }}
              className="text-amber-400 hover:underline font-bold cursor-pointer"
            >
              Tous les choix
            </button>
          </div>
        </div>
      )}

      {/* Main Trigger Button */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="h-10 px-3.5 rounded-full bg-neutral-900/90 hover:bg-neutral-850 backdrop-blur-md border border-neutral-700/80 shadow-xl text-xs font-semibold text-neutral-200 hover:text-white flex items-center gap-2 transition-all hover:scale-105 cursor-pointer group"
      >
        <div
          className="w-3.5 h-3.5 rounded-full ring-1 ring-white/30 shadow-sm"
          style={{ backgroundColor: currentTheme.primaryHex }}
        />
        <span className="hidden sm:inline">Thème :</span>
        <span className="font-bold text-amber-400">{currentTheme.name}</span>
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white" />
        )}
      </button>
    </div>
  );
}
