"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useTheme, THEMES, ThemeName, ThemeCategory } from "./ThemeProvider";
import { Check, Sparkles, Palette, Moon, Sun, Flame, Layers } from "lucide-react";

export function ThemeSwitcherModal() {
  const { theme, setTheme, isModalOpen, setIsModalOpen } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<"all" | ThemeCategory>("all");

  const categories = [
    { id: "all", label: "Tous les thèmes", count: Object.keys(THEMES).length, icon: Layers },
    { id: "dark", label: "Thèmes Sombres", count: 5, icon: Moon },
    { id: "light", label: "Thèmes Clairs", count: 4, icon: Sun },
  ] as const;

  const filteredThemes = (Object.keys(THEMES) as ThemeName[]).filter((key) => {
    if (selectedCategory === "all") return true;
    return THEMES[key]?.category === selectedCategory;
  });

  return (
    <Modal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      title="Galerie des Thèmes & Ambiance ERP"
      description="Personnalisez votre expérience de travail parmi 9 thèmes modernes : Sombres et Clairs épurés"
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Top Info Banner */}
        <div className="p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-neutral-200">
                Thème actif : <span className="text-amber-400 font-extrabold">{THEMES[theme]?.name}</span>{" "}
                <span className="text-neutral-400 font-normal text-[11px]">({THEMES[theme]?.subtitle})</span>
              </p>
              <p className="text-[11px] text-neutral-400">
                Changement instantané sans rechargement de page. Mémorisé sur tous vos appareils.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-300 font-mono">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: THEMES[theme]?.primaryHex }}
            />
            <span>{THEMES[theme]?.primaryHex}</span>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isTabActive = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id as any)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  isTabActive
                    ? "bg-neutral-800 text-white border border-neutral-700 shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60 border border-transparent"
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-amber-400" />
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isTabActive ? "bg-neutral-700 text-neutral-200" : "bg-neutral-850 text-neutral-500"
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 max-h-[60vh] overflow-y-auto pr-1">
          {filteredThemes.map((key) => {
            const item = THEMES[key];
            const isSelected = theme === key;

            return (
              <div
                key={key}
                onClick={() => setTheme(key)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden group ${
                  isSelected
                    ? "bg-neutral-900/95 border-amber-500/80 ring-2 ring-amber-500/40 shadow-xl"
                    : "bg-neutral-950/70 border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-900/60"
                }`}
              >
                <div className="space-y-2">
                  {/* Category Pill & Selection Status */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                      {item.category === "dark" ? (
                        <>
                          <Moon className="w-2.5 h-2.5 text-blue-400" />
                          <span>Sombre</span>
                        </>
                      ) : (
                        <>
                          <Sun className="w-2.5 h-2.5 text-amber-400" />
                          <span>Clair</span>
                        </>
                      )}
                    </span>

                    {isSelected ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                        <Check className="w-2.5 h-2.5 stroke-[3]" /> Actif
                      </span>
                    ) : (
                      <span className="text-[10px] text-neutral-500 group-hover:text-neutral-300 transition-colors">
                        Appliquer
                      </span>
                    )}
                  </div>

                  {/* Title & Dot */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs ring-1 ring-white/20"
                        style={{ backgroundColor: item.primaryHex }}
                      />
                      <h4 className="text-xs font-bold text-neutral-100 truncate">{item.name}</h4>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-1">{item.subtitle}</p>
                  </div>

                  <p className="text-[11px] text-neutral-400/90 leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                </div>

                {/* Theme Visual Palette Swatch */}
                <div className="mt-3 pt-2.5 border-t border-neutral-800/80 space-y-2">
                  <div className="h-6 rounded-lg p-1 bg-neutral-950 border border-neutral-800 flex items-center gap-1.5 overflow-hidden">
                    <div
                      className="h-full flex-1 rounded"
                      style={{ backgroundColor: item.primaryHex }}
                      title="Accent"
                    />
                    <div
                      className={`h-full flex-1 rounded bg-gradient-to-r ${item.gradient}`}
                      title="Dégradé"
                    />
                    <div
                      className={`h-full flex-1 rounded ${item.previewBg} border border-neutral-700/40`}
                      title="Fond"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTheme(key);
                    }}
                    className={`w-full py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? "bg-neutral-800 text-neutral-200 border border-neutral-700"
                        : `bg-gradient-to-r ${item.gradient} text-white shadow-md hover:opacity-95`
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Thème Actif
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" /> Choisir ce Thème
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-2 border-t border-neutral-800">
          <span className="text-[11px] text-neutral-500">
            {filteredThemes.length} thèmes disponibles dans cette catégorie
          </span>
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-850 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </Modal>
  );
}
