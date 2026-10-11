"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeCategory = "light" | "dark" | "glass";

export type ThemeName = "light" | "dark" | "glass";

export interface ThemeConfig {
  id: ThemeName;
  name: string;
  subtitle: string;
  description: string;
  category: ThemeCategory;
  mode: "light" | "dark" | "glass";
  dotColor: string;
  gradient: string;
  badgeColor: string;
  previewBg: string;
  primaryHex: string;
  bgHex: string;
}

export const THEMES: Record<ThemeName, ThemeConfig> = {
  // ==================== 1. THÈME CLAIR (PAR DÉFAUT) ====================
  light: {
    id: "light",
    name: "Clair Moderne",
    subtitle: "Thème Clair (Par Défaut)",
    description: "Interface lumineuse, pure et nette — Optimale pour la clarté et le confort de travail au quotidien.",
    category: "light",
    mode: "light",
    dotColor: "bg-blue-600",
    gradient: "from-blue-600 to-indigo-600",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    previewBg: "bg-[#f8fafc]",
    primaryHex: "#2563eb",
    bgHex: "#f8fafc",
  },

  // ==================== 2. THÈME SOMBRE ====================
  dark: {
    id: "dark",
    name: "Sombre Élégant",
    subtitle: "Mode Nuit Profond",
    description: "Nuit profonde, contrastes sombres feutrés et reposants pour soulager la fatigue visuelle.",
    category: "dark",
    mode: "dark",
    dotColor: "bg-blue-500",
    gradient: "from-blue-600 to-indigo-600",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    previewBg: "bg-[#080b11]",
    primaryHex: "#3b82f6",
    bgHex: "#080b11",
  },

  // ==================== 3. STYLE IPHONE GLASS ====================
  glass: {
    id: "glass",
    name: "iPhone Glass",
    subtitle: "Liquid Glassmorphism iOS",
    description: "Inspiré de l'iPhone Apple — Effet verre dépoli translucide, reflets liquides, flou d'arrière-plan et cartes flottantes.",
    category: "glass",
    mode: "glass",
    dotColor: "bg-sky-400",
    gradient: "from-sky-400 via-indigo-500 to-purple-500",
    badgeColor: "bg-sky-500/20 text-sky-200 border-sky-400/40",
    previewBg: "bg-[#0c101d]",
    primaryHex: "#38bdf8",
    bgHex: "#0c101d",
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
  const [theme, setThemeState] = useState<ThemeName>("light");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("boostera-theme") as ThemeName | null;
    if (saved && THEMES[saved]) {
      applyTheme(saved);
    } else {
      applyTheme("light");
    }
  }, []);

  const applyTheme = (newTheme: ThemeName) => {
    const config = THEMES[newTheme] || THEMES.light;
    setThemeState(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("boostera-theme", newTheme);
      document.documentElement.setAttribute("data-theme", newTheme);
      document.documentElement.setAttribute("data-theme-mode", config.mode);

      document.documentElement.classList.remove("light", "dark", "glass");
      document.documentElement.classList.add(config.mode);

      if (config.mode === "light") {
        document.documentElement.classList.remove("dark");
      } else {
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
