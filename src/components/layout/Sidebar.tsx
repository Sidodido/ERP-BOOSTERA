"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Target,
  PhoneCall,
  Calendar,
  Clock,
  Briefcase,
  Layers,
  Kanban,
  CreditCard,
  Receipt,
  UserCheck,
  Truck,
  ShoppingCart,
  TrendingUp,
  FileText,
  BarChart3,
  Bot,
  Settings,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Database,
  Activity,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";

let globalSidebarScrollTop = 0;

interface SidebarProps {
  userRole?: string;
  rawRole?: string;
  userName?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  phase?: number;
  badge?: string;
}

const NAV_GROUPS: { groupTitle: string; items: NavItem[] }[] = [
  {
    groupTitle: "PRINCIPAL",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Assistant IA", href: "/assistant-ia", icon: Bot, badge: "IA" },
    ],
  },
  {
    groupTitle: "COMMERCIAL & CRM",
    items: [
      { label: "Base Prospects", href: "/base-prospects", icon: Database },
      { label: "Prospection", href: "/prospection", icon: Target, badge: "Vierges" },
      { label: "Appels", href: "/appels", icon: PhoneCall },
      { label: "Rendez-vous", href: "/rendez-vous", icon: Calendar },
      { label: "Relances", href: "/relances", icon: Clock },
      { label: "Clients", href: "/clients", icon: Users },
    ],
  },
  {
    groupTitle: "PRODUCTION & GESTION",
    items: [
      { label: "Projets Web & Mobile", href: "/projets", icon: Briefcase, badge: "Tech" },
      { label: "Abonnements", href: "/abonnements", icon: Repeat, badge: "Packs" },
      { label: "Production", href: "/production", icon: Kanban },
      { label: "Calendrier Tâches", href: "/calendrier-technicien", icon: CalendarDays, badge: "Mois" },
      { label: "Documents", href: "/documents", icon: FileText },
    ],
  },
  {
    groupTitle: "FINANCE & FACTURATION",
    items: [
      { label: "Finance", href: "/finance", icon: CreditCard },
      { label: "Facturation", href: "/facturation", icon: Receipt },
      { label: "Rentabilité", href: "/rentabilite", icon: TrendingUp },
    ],
  },
  {
    groupTitle: "RESSOURCES HUMAINES",
    items: [
      { label: "RH & Paie", href: "/rh", icon: UserCheck },
      { label: "Équipes", href: "/equipes", icon: Layers },
      { label: "Activités", href: "/activites", icon: Activity },
    ],
  },
  {
    groupTitle: "LOGISTIQUE & ACHATS",
    items: [
      { label: "Fournisseurs", href: "/fournisseurs", icon: Truck },
      { label: "Achats", href: "/achats", icon: ShoppingCart },
    ],
  },
  {
    groupTitle: "SYSTÈME",
    items: [
      { label: "Reporting", href: "/reporting", icon: BarChart3 },
      { label: "Paramètres", href: "/parametres", icon: Settings },
    ],
  },
];

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export function Sidebar({ userRole, rawRole, userName }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const isRestoringRef = useRef(true);

  // Détection du rôle Commercial (SALES_REP, COMMERCIAL ou libellé Commercial / Commerciale)
  const isCommercial =
    rawRole === "SALES_REP" ||
    rawRole === "COMMERCIAL" ||
    rawRole === "SALES_DIRECTOR" ||
    userRole === "Commercial" ||
    userRole === "Commerciale" ||
    userRole === "Directeur Commercial" ||
    userRole?.trim().toLowerCase() === "commercial" ||
    userRole?.trim().toLowerCase() === "commerciale" ||
    userRole?.trim().toLowerCase().includes("commercial");

  // Détection du rôle Technicien (TECH_LEAD, DEVELOPER, DESIGNER, VIDEO_EDITOR ou libellé Technicien / Chef Technique)
  const isTechnician =
    !isCommercial &&
    (rawRole === "TECH_LEAD" ||
      rawRole === "DEVELOPER" ||
      rawRole === "DESIGNER" ||
      rawRole === "VIDEO_EDITOR" ||
      rawRole === "TECHNICIEN" ||
      rawRole === "TECHNICIAN" ||
      userRole?.toLowerCase().includes("technic") ||
      userRole?.toLowerCase().includes("tech") ||
      userRole?.toLowerCase().includes("développeur") ||
      userRole?.toLowerCase().includes("developpeur") ||
      userRole?.toLowerCase().includes("designer") ||
      userRole?.toLowerCase().includes("monteur"));

  // Filtrage selon le rôle
  let visibleGroups = NAV_GROUPS;

  if (isCommercial) {
    // Rôle Commercial : uniquement PRINCIPAL et COMMERCIAL & CRM complet
    visibleGroups = NAV_GROUPS.filter(
      (group) =>
        group.groupTitle === "PRINCIPAL" ||
        group.groupTitle === "COMMERCIAL & CRM"
    );
  } else if (isTechnician) {
    // Rôle Technicien : Dashboard, Assistant IA, Clients, Projets, Abonnements, Production
    visibleGroups = NAV_GROUPS.map((group) => {
      if (group.groupTitle === "PRINCIPAL") {
        return group; // Dashboard, Assistant IA
      }
      if (group.groupTitle === "COMMERCIAL & CRM") {
        return {
          ...group,
          items: group.items.filter((item) => item.href === "/clients"),
        };
      }
      if (group.groupTitle === "PRODUCTION & GESTION") {
        return {
          ...group,
          items: group.items.filter(
            (item) =>
              item.href === "/projets" ||
              item.href === "/abonnements" ||
              item.href === "/production" ||
              item.href === "/calendrier-technicien"
          ),
        };
      }
      return null;
    }).filter(Boolean) as typeof NAV_GROUPS;
  }

  // Restore scroll position so clicking items does not jump to top
  useIsomorphicLayoutEffect(() => {
    isRestoringRef.current = true;

    const applyScroll = () => {
      if (!navRef.current) return;
      const saved =
        globalSidebarScrollTop ||
        Number(sessionStorage.getItem("sidebar_nav_scroll") || 0);

      if (saved > 0) {
        navRef.current.scrollTop = saved;
      }

      // Ensure the active menu item stays in view within the sidebar without scrolling the window
      const activeEl = navRef.current.querySelector<HTMLElement>("[data-active='true']");
      if (activeEl && navRef.current) {
        const navRect = navRef.current.getBoundingClientRect();
        const elRect = activeEl.getBoundingClientRect();
        if (elRect.top < navRect.top) {
          navRef.current.scrollTop -= (navRect.top - elRect.top) + 12;
        } else if (elRect.bottom > navRect.bottom) {
          navRef.current.scrollTop += (elRect.bottom - navRect.bottom) + 12;
        }
      }
    };

    applyScroll();

    const frameId = requestAnimationFrame(() => {
      applyScroll();
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 60);
    });

    return () => cancelAnimationFrame(frameId);
  }, [pathname]);

  const handleNavScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isRestoringRef.current) return;
    const top = e.currentTarget.scrollTop;
    globalSidebarScrollTop = top;
    try {
      sessionStorage.setItem("sidebar_nav_scroll", String(top));
    } catch {}
  };

  return (
    <aside
      className={cn(
        "h-screen sticky top-0 flex flex-col bg-neutral-950 border-r border-neutral-800/80 transition-all duration-300 z-30 select-none",
        collapsed ? "w-18" : "w-64"
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-800/80">
        {!collapsed && (
          <Link href="/dashboard" scroll={false} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black text-sm shadow-md shadow-blue-500/20">
              B
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-sm tracking-wider text-neutral-100 flex items-center gap-1.5">
                BOOSTERA
                <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">
                  ERP
                </span>
              </span>
              <span className="text-[10px] text-neutral-500">Agence Digitale</span>
            </div>
          </Link>
        )}

        {collapsed && (
          <div className="w-8 h-8 mx-auto rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black text-sm">
            B
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          title={collapsed ? "Agrandir" : "Réduire"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation Groups */}
      <div
        ref={navRef}
        onScroll={handleNavScroll}
        style={{ overflowAnchor: "none" }}
        className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-neutral-800"
      >
        {visibleGroups.map((group) => (
          <div key={group.groupTitle} className="space-y-1">
            {!collapsed && (
              <p className="px-2.5 text-[10px] font-bold text-neutral-500 tracking-wider">
                {group.groupTitle}
              </p>
            )}
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  scroll={false}
                  data-active={isActive ? "true" : undefined}
                  onClick={() => {
                    if (navRef.current) {
                      globalSidebarScrollTop = navRef.current.scrollTop;
                      try {
                        sessionStorage.setItem("sidebar_nav_scroll", String(navRef.current.scrollTop));
                      } catch {}
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 group",
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                      : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0 transition-colors",
                      isActive ? "text-white" : "text-neutral-400 group-hover:text-neutral-200"
                    )}
                  />
                  {!collapsed && (
                    <span className="flex-1 truncate">{item.label}</span>
                  )}
                  {!collapsed && item.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer: User Info */}
      <div className="p-3 border-t border-neutral-800/80 space-y-2">
        {/* User Info */}
        <div className="flex items-center gap-3 p-2 rounded-xl bg-neutral-900/60 border border-neutral-800/60">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs shrink-0">
            {userName ? userName.charAt(0).toUpperCase() : "U"}
          </div>
          {!collapsed && (
            <div className="flex-1 truncate">
              <p className="text-xs font-semibold text-neutral-200 truncate">
                {userName || "Utilisateur"}
              </p>
              <p className="text-[10px] text-neutral-500 truncate">
                {userRole || "Rôle"}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
