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
  RefreshCw,
  ChevronDown,
  X,
  MessagesSquare,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "./SidebarContext";

let globalSidebarScrollTop = 0;

interface SidebarProps {
  userRole?: string;
  rawRole?: string;
  userName?: string;
  initialCollapsed?: boolean;
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
      { label: "Chat Équipe", href: "/chat", icon: MessagesSquare, badge: "Live" },
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
    groupTitle: "DIRECTION & STRATÉGIE",
    items: [
      { label: "Import Google Maps", href: "/direction/google-maps", icon: MapPin, badge: "DZ" },
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
      { label: "Mises à jour", href: "/parametres?tab=UPDATES", icon: RefreshCw, badge: "Deploy" },
    ],
  },
];

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export function Sidebar({ userRole, rawRole, userName, initialCollapsed = false }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const { mobileOpen, setMobileOpen } = useSidebar();
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const isRestoringRef = useRef(true);

  // Sync state with localStorage on client mount
  useEffect(() => {
    try {
      const savedCollapsed = localStorage.getItem("sidebar_collapsed");
      if (savedCollapsed !== null) {
        setCollapsed(savedCollapsed === "true");
      }
      const savedGroups = localStorage.getItem("sidebar_collapsed_groups");
      if (savedGroups) {
        setCollapsedGroups(JSON.parse(savedGroups));
      }
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_collapsed", String(next));
        document.cookie = `sidebar_collapsed=${next}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {}
      return next;
    });
  };

  const toggleGroup = (groupTitle: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [groupTitle]: !prev[groupTitle] };
      try {
        localStorage.setItem("sidebar_collapsed_groups", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

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
    <>
      {/* Desktop Sidebar (hidden on mobile, retains collapsed/expanded state) */}
      <aside
        className={cn(
          "hidden md:flex h-screen sticky top-0 flex-col bg-neutral-950 border-r border-neutral-800/80 transition-all duration-300 z-30 select-none",
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
            type="button"
            onClick={toggleCollapsed}
            className="p-1.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
            title={collapsed ? "Agrandir le menu" : "Réduire le menu"}
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
          {visibleGroups.map((group) => {
            const hasActiveItem = group.items.some(
              (item) => pathname === item.href || pathname.startsWith(item.href + "/")
            );
            const isGroupCollapsed = !hasActiveItem && !!collapsedGroups[group.groupTitle];

            return (
              <div key={group.groupTitle} className="space-y-1">
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.groupTitle)}
                    className="w-full flex items-center justify-between px-2.5 py-1 text-[10px] font-bold text-neutral-500 hover:text-neutral-300 tracking-wider transition-colors cursor-pointer group select-none"
                    title={isGroupCollapsed ? "Déplier la section" : "Replier la section"}
                  >
                    <span>{group.groupTitle}</span>
                    <ChevronDown
                      className={cn(
                        "w-3 h-3 text-neutral-600 group-hover:text-neutral-400 transition-transform duration-200",
                        isGroupCollapsed && "-rotate-90"
                      )}
                    />
                  </button>
                )}
                {(!collapsed && isGroupCollapsed) ? null : (
                  group.items.map((item) => {
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
                  })
                )}
              </div>
            );
          })}
        </div>

        {/* Footer: User Info */}
        <div className="p-3 border-t border-neutral-800/80 space-y-2">
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

      {/* Mobile Drawer (Always starts closed, only opens on hamburger click) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setMobileOpen(false)}
          />

          {/* Off-canvas Drawer Panel */}
          <aside className="relative flex flex-col w-72 max-w-[85vw] h-full bg-neutral-950 border-r border-neutral-800 shadow-2xl z-50 animate-in slide-in-from-left duration-200">
            {/* Brand Header with Close Button */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-800/80">
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5"
              >
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

              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-2 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 rounded-lg transition-colors cursor-pointer"
                title="Fermer le menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Groups for Mobile */}
            <div
              ref={mobileNavRef}
              className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-neutral-800"
            >
              {visibleGroups.map((group) => {
                const hasActiveItem = group.items.some(
                  (item) => pathname === item.href || pathname.startsWith(item.href + "/")
                );
                const isGroupCollapsed = !hasActiveItem && !!collapsedGroups[group.groupTitle];

                return (
                  <div key={group.groupTitle} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.groupTitle)}
                      className="w-full flex items-center justify-between px-2.5 py-1 text-[10px] font-bold text-neutral-500 hover:text-neutral-300 tracking-wider transition-colors cursor-pointer group select-none"
                    >
                      <span>{group.groupTitle}</span>
                      <ChevronDown
                        className={cn(
                          "w-3 h-3 text-neutral-600 group-hover:text-neutral-400 transition-transform duration-200",
                          isGroupCollapsed && "-rotate-90"
                        )}
                      />
                    </button>

                    {!isGroupCollapsed && (
                      group.items.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                        const Icon = item.icon;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 group",
                              isActive
                                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                                : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900"
                            )}
                          >
                            <Icon
                              className={cn(
                                "w-4 h-4 shrink-0 transition-colors",
                                isActive ? "text-white" : "text-neutral-400 group-hover:text-neutral-200"
                              )}
                            />
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.badge && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer User Info Mobile */}
            <div className="p-3 border-t border-neutral-800/80">
              <div className="flex items-center gap-3 p-2 rounded-xl bg-neutral-900/60 border border-neutral-800/60">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                  {userName ? userName.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="flex-1 truncate">
                  <p className="text-xs font-semibold text-neutral-200 truncate">
                    {userName || "Utilisateur"}
                  </p>
                  <p className="text-[10px] text-neutral-500 truncate">
                    {userRole || "Rôle"}
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

