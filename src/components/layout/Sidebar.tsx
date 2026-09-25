"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
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
  ShieldCheck,
  UserPlus,
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
  badge?: string;
}

interface NavGroup {
  groupTitle: string;
  items: NavItem[];
}

const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    groupTitle: "PRINCIPAL",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Chat Équipe", href: "/chat", icon: MessagesSquare, badge: "Live" },
      { label: "Assistant IA", href: "/assistant-ia", icon: Bot, badge: "IA" },
    ],
  },
  {
    groupTitle: "OPÉRATIONS",
    items: [
      { label: "Base Prospects", href: "/base-prospects", icon: Database },
      { label: "Prospection", href: "/prospection", icon: Target, badge: "Vierges" },
      { label: "Appels", href: "/appels", icon: PhoneCall },
      { label: "Rendez-vous", href: "/rendez-vous", icon: Calendar },
      { label: "Relances", href: "/relances", icon: Clock },
      { label: "Import Google Maps", href: "/direction/google-maps", icon: MapPin, badge: "DZ" },
      { label: "Projets Web & Mobile", href: "/projets", icon: Briefcase, badge: "Tech" },
      { label: "Abonnements", href: "/abonnements", icon: Repeat, badge: "Packs" },
      { label: "Production", href: "/production", icon: Kanban },
      { label: "Calendrier Tâches", href: "/calendrier-technicien", icon: CalendarDays, badge: "Mois" },
      { label: "Documents", href: "/documents", icon: FileText },
    ],
  },
  {
    groupTitle: "GESTION",
    items: [
      { label: "Collaborateurs", href: "/collaborateurs", icon: UserCheck },
      { label: "Demandes d'accès", href: "/collaborateurs?tab=REQUESTS", icon: UserPlus, badge: "Demandes" },
      { label: "Clients", href: "/clients", icon: Users },
      { label: "Ressources Humaines", href: "/rh", icon: Briefcase },
      { label: "Équipes", href: "/equipes", icon: Layers },
      { label: "Rôles & Permissions", href: "/parametres?tab=USERS", icon: Settings, badge: "RBAC" },
    ],
  },
  {
    groupTitle: "FINANCE & ACHATS",
    items: [
      { label: "Finance & Trésorerie", href: "/finance", icon: CreditCard },
      { label: "Facturation", href: "/facturation", icon: Receipt },
      { label: "Rentabilité", href: "/rentabilite", icon: TrendingUp },
      { label: "Fournisseurs", href: "/fournisseurs", icon: Truck },
      { label: "Achats & Commandes", href: "/achats", icon: ShoppingCart },
    ],
  },
  {
    groupTitle: "ANALYTIQUE",
    items: [
      { label: "Reporting & KPIs", href: "/reporting", icon: BarChart3 },
      { label: "Activités Collaborateurs", href: "/activites", icon: Activity },
    ],
  },
  {
    groupTitle: "SYSTÈME",
    items: [
      { label: "Paramètres Généraux", href: "/parametres", icon: Settings },
      { label: "Configuration Agence", href: "/parametres?tab=AGENCY", icon: RefreshCw },
      { label: "Journal d'Activité (Audit)", href: "/parametres?tab=AUDIT", icon: Clock },
      { label: "Sauvegardes DB", href: "/parametres?tab=BACKUP", icon: Database },
      { label: "Mises à jour", href: "/parametres?tab=UPDATES", icon: RefreshCw, badge: "Deploy" },
    ],
  },
];

const COMMERCIAL_NAV_GROUPS: NavGroup[] = [
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
];

const TECHNICIAN_NAV_GROUPS: NavGroup[] = [
  {
    groupTitle: "PRINCIPAL",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Chat Équipe", href: "/chat", icon: MessagesSquare, badge: "Live" },
      { label: "Assistant IA", href: "/assistant-ia", icon: Bot, badge: "IA" },
    ],
  },
  {
    groupTitle: "PRODUCTION & MISSIONS",
    items: [
      { label: "Clients", href: "/clients", icon: Users },
      { label: "Projets Web & Mobile", href: "/projets", icon: Briefcase, badge: "Tech" },
      { label: "Abonnements", href: "/abonnements", icon: Repeat, badge: "Packs" },
      { label: "Production", href: "/production", icon: Kanban },
      { label: "Calendrier Tâches", href: "/calendrier-technicien", icon: CalendarDays, badge: "Mois" },
    ],
  },
];

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export function Sidebar({
  userRole,
  rawRole,
  userName,
  initialCollapsed = false,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const { mobileOpen, setMobileOpen } = useSidebar();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  // Détection du rôle Commercial
  const isCommercial =
    rawRole === "SALES_REP" ||
    rawRole === "COMMERCIAL" ||
    userRole === "Commercial" ||
    userRole === "Commerciale" ||
    userRole?.trim().toLowerCase() === "commercial" ||
    userRole?.trim().toLowerCase() === "commerciale";

  // Détection du rôle Technicien
  const isTechnician =
    !isCommercial &&
    (rawRole === "TECH_LEAD" ||
      rawRole === "DEVELOPER" ||
      rawRole === "DESIGNER" ||
      rawRole === "VIDEO_EDITOR" ||
      rawRole === "TECHNICIEN" ||
      rawRole === "TECHNICIAN" ||
      userRole?.toLowerCase().includes("technic") ||
      userRole?.toLowerCase().includes("développeur") ||
      userRole?.toLowerCase().includes("developpeur") ||
      userRole?.toLowerCase().includes("designer") ||
      userRole?.toLowerCase().includes("monteur"));

  // Sélection du groupe de navigation selon le profil
  let visibleGroups = ADMIN_NAV_GROUPS;
  if (isCommercial) {
    visibleGroups = COMMERCIAL_NAV_GROUPS;
  } else if (isTechnician) {
    visibleGroups = TECHNICIAN_NAV_GROUPS;
  }

  // Active checking helper supporting query parameters
  const isItemActive = (href: string) => {
    if (href.includes("?")) {
      const [path, query] = href.split("?");
      if (pathname !== path) return false;
      const targetParam = new URLSearchParams(query);
      for (const [key, value] of targetParam.entries()) {
        if (searchParams?.get(key) !== value) return false;
      }
      return true;
    }
    // For parametres base without tab
    if (href === "/parametres") {
      return pathname === "/parametres" && (!searchParams?.get("tab") || searchParams.get("tab") === "ATTENDANCE");
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  // Restore scroll position
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
  }, [pathname, searchParams]);

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
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex h-screen sticky top-0 flex-col bg-neutral-950 border-r border-neutral-800/80 transition-all duration-300 z-30 select-none shrink-0",
          collapsed ? "w-18" : "w-64"
        )}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-3.5 border-b border-neutral-800/80">
          {!collapsed && (
            <Link href="/dashboard" scroll={false} className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center p-1 shadow-md shadow-blue-500/15 border border-neutral-800 shrink-0 group-hover:scale-105 transition-transform">
                <Image
                  src="/logo.png"
                  alt="BOOSTERA Logo"
                  width={34}
                  height={34}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-sm tracking-wider text-neutral-100 flex items-center gap-1.5">
                  HDZ SECURITY
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">
                    ERP
                  </span>
                </span>
                <span className="text-[10px] text-neutral-500">Direction & Sécurité</span>
              </div>
            </Link>
          )}

          {collapsed && (
            <div className="w-9 h-9 mx-auto rounded-xl bg-white flex items-center justify-center p-1 shadow-md shadow-blue-500/15 border border-neutral-800" title="HDZ SECURITY ERP">
              <Image
                src="/logo.png"
                alt="BOOSTERA"
                width={32}
                height={32}
                className="w-full h-full object-contain"
                priority
              />
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
          className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin scrollbar-thumb-neutral-800"
        >
          {visibleGroups.map((group) => {
            const hasActiveItem = group.items.some((item) => isItemActive(item.href));
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
                    const active = isItemActive(item.href);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        scroll={false}
                        data-active={active ? "true" : undefined}
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
                          active
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/25 font-semibold"
                            : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900"
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon
                          className={cn(
                            "w-4 h-4 shrink-0 transition-colors",
                            active ? "text-white" : "text-neutral-400 group-hover:text-neutral-200"
                          )}
                        />
                        {!collapsed && (
                          <span className="flex-1 truncate">{item.label}</span>
                        )}
                        {!collapsed && item.badge && (
                          <span
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded-md font-semibold border",
                              active
                                ? "bg-white/20 text-white border-white/30"
                                : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                            )}
                          >
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

        {/* Footer: User Identity Card */}
        <div className="p-3 border-t border-neutral-800/80">
          <Link
            href="/parametres?tab=USERS"
            className="flex items-center gap-3 p-2 rounded-xl bg-neutral-900/60 border border-neutral-800/60 hover:border-neutral-700 transition-colors group"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
              {userName ? userName.charAt(0).toUpperCase() : "A"}
            </div>
            {!collapsed && (
              <div className="flex-1 truncate">
                <p className="text-xs font-semibold text-neutral-200 truncate group-hover:text-white">
                  {userName || "Administrateur"}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3 h-3 text-blue-400 shrink-0" />
                  <p className="text-[10px] text-neutral-400 truncate">
                    {userRole || "Administrateur"}
                  </p>
                </div>
              </div>
            )}
          </Link>
        </div>
      </aside>

      {/* Mobile Drawer */}
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
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center p-1 shadow-md shadow-blue-500/15 border border-neutral-800 shrink-0">
                  <Image
                    src="/logo.png"
                    alt="BOOSTERA Logo"
                    width={34}
                    height={34}
                    className="w-full h-full object-contain"
                    priority
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-sm tracking-wider text-neutral-100 flex items-center gap-1.5">
                    HDZ SECURITY
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">
                      ERP
                    </span>
                  </span>
                  <span className="text-[10px] text-neutral-500">Direction & Sécurité</span>
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
              className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin scrollbar-thumb-neutral-800"
            >
              {visibleGroups.map((group) => {
                const hasActiveItem = group.items.some((item) => isItemActive(item.href));
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
                        const active = isItemActive(item.href);
                        const Icon = item.icon;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 group",
                              active
                                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25 font-semibold"
                                : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900"
                            )}
                          >
                            <Icon
                              className={cn(
                                "w-4 h-4 shrink-0 transition-colors",
                                active ? "text-white" : "text-neutral-400 group-hover:text-neutral-200"
                              )}
                            />
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.badge && (
                              <span
                                className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded-md font-semibold border",
                                  active
                                    ? "bg-white/20 text-white border-white/30"
                                    : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                                )}
                              >
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
                  {userName ? userName.charAt(0).toUpperCase() : "A"}
                </div>
                <div className="flex-1 truncate">
                  <p className="text-xs font-semibold text-neutral-200 truncate">
                    {userName || "Administrateur"}
                  </p>
                  <p className="text-[10px] text-neutral-400 truncate">
                    {userRole || "Administrateur"}
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
