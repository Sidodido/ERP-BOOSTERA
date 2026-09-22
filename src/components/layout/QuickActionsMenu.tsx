"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Target,
  Users,
  Receipt,
  Briefcase,
  MapPin,
  UserPlus,
  ChevronDown,
} from "lucide-react";

export function QuickActionsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const actions = [
    {
      label: "Nouveau Prospect",
      href: "/prospection?modal=new",
      icon: Target,
      color: "text-blue-400 bg-blue-500/10",
      description: "Ajouter un lead dans le pipeline",
    },
    {
      label: "Nouveau Client",
      href: "/clients",
      icon: Users,
      color: "text-emerald-400 bg-emerald-500/10",
      description: "Créer un dossier client signé",
    },
    {
      label: "Nouvelle Facture",
      href: "/facturation",
      icon: Receipt,
      color: "text-amber-400 bg-amber-500/10",
      description: "Émettre une facture ou devis",
    },
    {
      label: "Nouveau Projet Tech",
      href: "/projets",
      icon: Briefcase,
      color: "text-purple-400 bg-purple-500/10",
      description: "Lancer un projet Web ou Mobile",
    },
    {
      label: "Acquisition Google Maps",
      href: "/direction/google-maps",
      icon: MapPin,
      color: "text-sky-400 bg-sky-500/10",
      description: "Importer des cibles par Wilaya",
    },
    {
      label: "Créer un Utilisateur",
      href: "/parametres?tab=USERS",
      icon: UserPlus,
      color: "text-violet-400 bg-violet-500/10",
      description: "Ajouter un collaborateur ou accès",
    },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs shadow-blue-600/20 transition-all cursor-pointer"
        title="Créer rapidement un élément"
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Action Rapide</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
          <div className="px-3 py-2 border-b border-neutral-800/80 mb-1">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              Création & Accès Rapide
            </span>
          </div>

          <div className="space-y-1">
            {actions.map((act) => {
              const Icon = act.icon;
              return (
                <Link
                  key={act.label}
                  href={act.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-neutral-800/70 transition-colors group"
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${act.color}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-neutral-200 group-hover:text-white transition-colors">
                      {act.label}
                    </p>
                    <p className="text-[10px] text-neutral-500 truncate">
                      {act.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
