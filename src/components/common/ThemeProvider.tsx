"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeCategory = "dark" | "light";

export type ThemeName =
  // Thèmes Sombres
  | "blue"
  | "emerald"
  | "purple"
  | "amber"
  | "onyx"
  // Thèmes Clairs & Élégants
  | "clean-light"
  | "pearl-light"
  | "sage-light"
  | "lavender-light";

export interface ThemeConfig {
  id: ThemeName;
  name: string;
  subtitle: string;
  description: string;
  category: ThemeCategory;
  mode: "dark" | "light";
  dotColor: string;
  gradient: string;
  badgeColor: string;
  previewBg: string;
  primaryHex: string;
  bgHex: string;
}

export const THEMES: Record<ThemeName, ThemeConfig> = {
  // ==================== THÈMES SOMBRES ====================
  blue: {
    id: "blue",
    name: "Cyber Blue",
    subtitle: "Bleu Tech (Défaut)",
    description: "Bleu électrique et nuit profonde — Identité officielle HDZ SECURITY",
    category: "dark",
    mode: "dark",
    dotColor: "bg-blue-500",
    gradient: "from-blue-600 to-indigo-600",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    previewBg: "bg-[#080b11]",
    primaryHex: "#3b82f6",
    bgHex: "#080b11",
  },
  emerald: {
    id: "emerald",
    name: "Emerald Mint",
    subtitle: "Vert Émeraude",
    description: "Menthe vivante et forêt sombre — Style Finance, Croissance et Succès",
    category: "dark",
    mode: "dark",
    dotColor: "bg-emerald-500",
    gradient: "from-emerald-500 to-teal-600",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    previewBg: "bg-[#050e0a]",
    primaryHex: "#10b981",
    bgHex: "#050e0a",
  },
  purple: {
    id: "purple",
    name: "Nebula Purple",
    subtitle: "Violet Nébuleuse",
    description: "Améthyste royale et abysse violet — Style Studio Créatif et Luxe",
    category: "dark",
    mode: "dark",
    dotColor: "bg-purple-500",
    gradient: "from-purple-500 to-violet-600",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    previewBg: "bg-[#0b0914]",
    primaryHex: "#8b5cf6",
    bgHex: "#0b0914",
  },
  amber: {
    id: "amber",
    name: "Sunset Amber",
    subtitle: "Ambre Cuivré et Or",
    description: "Or cuivré et titane chaud — Style Énergie Commerciale et Prestige",
    category: "dark",
    mode: "dark",
    dotColor: "bg-amber-500",
    gradient: "from-amber-500 to-orange-600",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    previewBg: "bg-[#110d08]",
    primaryHex: "#f59e0b",
    bgHex: "#110d08",
  },
  onyx: {
    id: "onyx",
    name: "Onyx Midnight",
    subtitle: "Noir Absolu & Cyan",
    description: "Contraste ultra-profond noir carbone et néon cyan laser",
    category: "dark",
    mode: "dark",
    dotColor: "bg-cyan-400",
    gradient: "from-cyan-500 to-blue-600",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    previewBg: "bg-[#030303]",
    primaryHex: "#06b6d4",
    bgHex: "#030303",
  },

  // ==================== THÈMES CLAIRS ÉLÉGANTS ====================
  "clean-light": {
    id: "clean-light",
    name: "Clean Snow",
    subtitle: "Blanc Albâtre & Bleu",
    description: "Interface épurée et lumineuse, fond blanc doux et accents bleu royal",
    category: "light",
    mode: "light",
    dotColor: "bg-blue-600",
    gradient: "from-blue-600 to-sky-500",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    previewBg: "bg-[#f8fafc]",
    primaryHex: "#2563eb",
    bgHex: "#f8fafc",
  },
  "pearl-light": {
    id: "pearl-light",
    name: "Warm Pearl",
    subtitle: "Ivoire & Ambre Chaud",
    description: "Ambiance chaleureuse, tons crèmes ivoire et or solaire élégant",
    category: "light",
    mode: "light",
    dotColor: "bg-amber-600",
    gradient: "from-amber-500 to-yellow-600",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    previewBg: "bg-[#faf8f5]",
    primaryHex: "#d97706",
    bgHex: "#faf8f5",
  },
  "sage-light": {
    id: "sage-light",
    name: "Sage Mint",
    subtitle: "Sauge & Menthe Claire",
    description: "Fraîcheur naturelle zen, gris-vert sauge et vert émeraude doux",
    category: "light",
    mode: "light",
    dotColor: "bg-emerald-600",
    gradient: "from-emerald-600 to-teal-500",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    previewBg: "bg-[#f4f9f6]",
    primaryHex: "#059669",
    bgHex: "#f4f9f6",
  },
  "lavender-light": {
    id: "lavender-light",
    name: "Soft Lavender",
    subtitle: "Brume Lilas & Violet",
    description: "Élégance pastel, nuances de lilas reposantes et touches violettes",
    category: "light",
    mode: "light",
    dotColor: "bg-purple-600",
    gradient: "from-purple-600 to-violet-500",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    previewBg: "bg-[#f7f6fc]",
    primaryHex: "#7c3aed",
    bgHex: "#f7f6fc",
  },
};

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  themes: Record<ThemeName, ThemeConfig>;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>("blue");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("boostera-theme") as ThemeName | null;
    if (saved && THEMES[saved]) {
      applyTheme(saved);
    } else {
      applyTheme("blue");
    }
  }, []);

  const applyTheme = (newTheme: ThemeName) => {
    const config = THEMES[newTheme] || THEMES.blue;
    setThemeState(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("boostera-theme", newTheme);
      document.documentElement.setAttribute("data-theme", newTheme);
      document.documentElement.setAttribute("data-theme-mode", config.mode);
      if (config.mode === "light") {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
      } else {
        document.documentElement.classList.remove("light");
        document.documentElement.classList.add("dark");
      }
      document.cookie = `boostera-theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;
    }
  };

  const setTheme = (newTheme: ThemeName) => {
    applyTheme(newTheme);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        themes: THEMES,
        isModalOpen,
        setIsModalOpen,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

