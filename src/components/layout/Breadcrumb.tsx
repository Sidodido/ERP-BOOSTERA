"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

interface RouteMapItem {
  label: string;
  parent?: { label: string; href: string };
}

const ROUTE_LABELS: Record<string, RouteMapItem> = {
  "/dashboard": { label: "Tableau de Bord" },
  "/chat": { label: "Chat Équipe", parent: { label: "Principal", href: "/dashboard" } },
  "/assistant-ia": { label: "Assistant IA", parent: { label: "Principal", href: "/dashboard" } },
  
  // Commercial & CRM
  "/base-prospects": { label: "Base Prospects", parent: { label: "CRM", href: "/prospection" } },
  "/prospection": { label: "Prospection Directe", parent: { label: "CRM", href: "/base-prospects" } },
  "/appels": { label: "Journal des Appels", parent: { label: "CRM", href: "/prospection" } },
  "/rendez-vous": { label: "Rendez-vous", parent: { label: "CRM", href: "/prospection" } },
  "/relances": { label: "Relances", parent: { label: "CRM", href: "/prospection" } },
  "/clients": { label: "Clients", parent: { label: "Gestion", href: "/dashboard" } },
  "/direction/google-maps": { label: "Import Google Maps", parent: { label: "Acquisition", href: "/prospection" } },

  // Production
  "/projets": { label: "Projets Web & Mobile", parent: { label: "Production", href: "/production" } },
  "/abonnements": { label: "Abonnements", parent: { label: "Production", href: "/projets" } },
  "/production": { label: "Kanban Production", parent: { label: "Production", href: "/projets" } },
  "/calendrier-technicien": { label: "Calendrier Tâches", parent: { label: "Production", href: "/production" } },
  "/documents": { label: "Documents & Fichiers", parent: { label: "Production", href: "/projets" } },

  // Finance
  "/finance": { label: "Trésorerie & Finance", parent: { label: "Finance", href: "/facturation" } },
  "/facturation": { label: "Facturation", parent: { label: "Finance", href: "/finance" } },
  "/rentabilite": { label: "Rentabilité", parent: { label: "Finance", href: "/finance" } },

  // RH & Collaborateurs
  "/collaborateurs": { label: "Collaborateurs & Inscriptions", parent: { label: "Gestion", href: "/dashboard" } },
  "/rh": { label: "Ressources Humaines & Paie", parent: { label: "Gestion", href: "/dashboard" } },
  "/equipes": { label: "Équipes & Départements", parent: { label: "RH", href: "/rh" } },
  "/activites": { label: "Activités Collaborateurs", parent: { label: "RH", href: "/rh" } },

  // Achats
  "/fournisseurs": { label: "Fournisseurs", parent: { label: "Achats", href: "/achats" } },
  "/achats": { label: "Bons de Commande & Achats", parent: { label: "Logistique", href: "/fournisseurs" } },
  "/stocks": { label: "Gestion des Stocks", parent: { label: "Logistique", href: "/achats" } },

  // Système
  "/reporting": { label: "Rapports & Statistiques", parent: { label: "Analytique", href: "/dashboard" } },
  "/parametres": { label: "Paramètres Système", parent: { label: "Système", href: "/dashboard" } },
};

const TAB_LABELS: Record<string, string> = {
  REQUESTS: "Demandes d'inscription",
  COLLABORATORS: "Tous les collaborateurs",
  USERS: "Utilisateurs & Permissions",
  ATTENDANCE: "Pointage & Présences",
  COMMISSIONS: "Règles de Commissions",
  AGENCY: "Configuration Agence",
  AUDIT: "Journal d'Activité / Audit",
  UPDATES: "Mises à jour & Déploiements",
  BACKUP: "Sauvegardes Base de Données",
};

export function Breadcrumb() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams?.get("tab");

  // Route matching
  const route = ROUTE_LABELS[pathname] || {
    label: pathname
      .split("/")
      .filter(Boolean)
      .pop()
      ?.replace(/-/g, " ")
      ?.replace(/\b\w/g, (c) => c.toUpperCase()) || "Page",
  };

  const subLabel = tab && TAB_LABELS[tab] ? TAB_LABELS[tab] : null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="hidden lg:flex items-center gap-1.5 text-xs text-neutral-400 select-none min-w-0 truncate"
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-1 hover:text-neutral-200 transition-colors shrink-0"
        title="Retour au Dashboard"
      >
        <Home className="w-3.5 h-3.5 text-neutral-500" />
      </Link>

      <ChevronRight className="w-3 h-3 text-neutral-600 shrink-0" />

      {route.parent && (
        <>
          <Link
            href={route.parent.href}
            className="hover:text-neutral-200 transition-colors truncate max-w-[120px]"
          >
            {route.parent.label}
          </Link>
          <ChevronRight className="w-3 h-3 text-neutral-600 shrink-0" />
        </>
      )}

      <span className="font-semibold text-neutral-200 truncate max-w-[160px]">
        {route.label}
      </span>

      {subLabel && (
        <>
          <ChevronRight className="w-3 h-3 text-neutral-600 shrink-0" />
          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium text-[11px] border border-blue-500/20 truncate max-w-[180px]">
            {subLabel}
          </span>
        </>
      )}
    </nav>
  );
}
