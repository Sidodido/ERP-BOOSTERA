"use client";

import React from "react";
import { Modal } from "@/components/ui/Modal";
import { useTheme, THEMES, ThemeName } from "./ThemeProvider";
import { Check, Sparkles, Palette, Moon, Sun, Smartphone } from "lucide-react";

export function ThemeSwitcherModal() {
  const { theme, setTheme, isModalOpen, setIsModalOpen } = useTheme();

  const themeList: {
    key: ThemeName;
    icon: typeof Sun;
    tag: string;
    isDefault?: boolean;
  }[] = [
    {
      key: "light",
      icon: Sun,
      tag: "PAR DÉFAUT",
      isDefault: true,
    },
    {
      key: "dark",
      icon: Moon,
      tag: "MODE NUIT",
    },
    {
      key: "glass",
      icon: Smartphone,
      tag: "APPLE iOS",
    },
  ];

  return (
    <Modal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      title="Ambiance & Thèmes BOOSTERA"
      description="Choisissez votre style d'affichage : Clair (Par Défaut), Sombre ou le style verre dépoli iPhone Glass."
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {/* Top Info Banner */}
        <div className="p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-2xl flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-neutral-200">
                Style actif : <span className="text-blue-400 font-extrabold">{THEMES[theme]?.name}</span>{" "}
                <span className="text-neutral-400 font-normal text-[11px]">({THEMES[theme]?.subtitle})</span>
              </p>
              <p className="text-[11px] text-neutral-400">
                Changement instantané sans rechargement de page. Mémorisé sur votre appareil.
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

        {/* 3 Themes Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {themeList.map(({ key, icon: Icon, tag, isDefault }) => {
            const item = THEMES[key];
            const isSelected = theme === key;

            return (
              <div
                key={key}
                onClick={() => setTheme(key)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden group ${
                  isSelected
                    ? "bg-neutral-900/95 border-blue-500/80 ring-2 ring-blue-500/40 shadow-xl"
                    : "bg-neutral-950/70 border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-900/60"
                }`}
              >
                <div className="space-y-3">
                  {/* Header Badge */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-800/80 text-[10px] font-bold text-neutral-300 border border-neutral-700">
                      <Icon className="w-3 h-3 text-blue-400" />
                      <span>{tag}</span>
                    </span>

                    {isSelected ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                        <Check className="w-2.5 h-2.5 stroke-[3]" /> Actif
                      </span>
                    ) : (
                      <span className="text-[10px] text-neutral-500 group-hover:text-neutral-300 transition-colors">
                        Sélectionner
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs ring-1 ring-white/20"
                        style={{ backgroundColor: item.primaryHex }}
                      />
                      <h4 className="text-sm font-bold text-neutral-100">{item.name}</h4>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5">{item.subtitle}</p>
                  </div>

                  <p className="text-[11px] text-neutral-400/90 leading-relaxed min-h-[44px]">
                    {item.description}
                  </p>
                </div>

                {/* Visual Preview Swatch & Button */}
                <div className="mt-4 pt-3 border-t border-neutral-800/80 space-y-2.5">
                  <div className="h-7 rounded-xl p-1 bg-neutral-950 border border-neutral-800 flex items-center gap-1.5 overflow-hidden">
                    <div
                      className="h-full flex-1 rounded-lg"
                      style={{ backgroundColor: item.primaryHex }}
                      title="Couleur d'accent"
                    />
                    <div
                      className={`h-full flex-1 rounded-lg bg-gradient-to-r ${item.gradient}`}
                      title="Dégradé"
                    />
                    <div
                      className={`h-full flex-1 rounded-lg ${item.previewBg} border border-neutral-700/40`}
                      title="Arrière-plan"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTheme(key);
                    }}
                    className={`w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
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
            3 styles : Clair, Sombre et iPhone Glass
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
