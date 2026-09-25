"use client";

import React, { useState, useEffect, useCallback, useTransition, useRef } from "react";
import Link from "next/link";
import {
  Bell,
  LogOut,
  ShieldCheck,
  CheckCheck,
  ExternalLink,
  X,
  Trash2,
  Menu,
  ChevronDown,
  Settings,
  History,
  Database,
  Palette,
  Sparkles,
  User,
  Edit2,
  CheckCircle2,
} from "lucide-react";
import { logoutAction, updateMyProfileAction } from "@/actions/auth";
import {
  getUserNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  deleteNotificationAction,
  clearAllNotificationsAction,
} from "@/actions/notifications";
import { useRouter } from "next/navigation";
import { HeaderAttendancePill } from "@/components/attendance/HeaderAttendancePill";
import { useSidebar } from "./SidebarContext";
import { GlobalSearch } from "./GlobalSearch";
import { Breadcrumb } from "./Breadcrumb";
import { QuickActionsMenu } from "./QuickActionsMenu";
import { useTheme } from "@/components/common/ThemeProvider";

interface HeaderProps {
  userName?: string;
  userRole?: string;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date | string;
}

export function Header({ userName, userRole }: HeaderProps) {
  const router = useRouter();
  const { toggleMobile } = useSidebar();
  const { setIsModalOpen } = useTheme();
  const [isPending, startTransition] = useTransition();

  // Notifications State
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const notifRef = useRef<HTMLDivElement>(null);

  // User Dropdown & Profile State
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [displayName, setDisplayName] = useState(userName || "Administrateur");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState(userName || "");
  const [profilePhoneInput, setProfilePhoneInput] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userName) {
      setDisplayName(userName);
      setProfileNameInput(userName);
    }
  }, [userName]);

  const handleOpenProfileModal = () => {
    setShowUserMenu(false);
    setProfileNameInput(displayName);
    setProfileError(null);
    setProfileSuccess(false);
    setShowProfileModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileNameInput.trim() || profileNameInput.trim().length < 2) {
      setProfileError("Le nom d'utilisateur doit comporter au moins 2 caractères.");
      return;
    }

    try {
      setProfileSaving(true);
      setProfileError(null);
      const res = await updateMyProfileAction({
        name: profileNameInput.trim(),
        phone: profilePhoneInput.trim() || undefined,
      });
      setDisplayName(res.name);
      setProfileSuccess(true);
      setTimeout(() => {
        setShowProfileModal(false);
        setProfileSuccess(false);
      }, 1200);
      router.refresh();
    } catch (err: any) {
      setProfileError(err.message || "Erreur lors de la mise à jour du profil.");
    } finally {
      setProfileSaving(false);
    }
  };

  const isAdmin =
    userRole?.toLowerCase().includes("admin") ||
    userRole?.toLowerCase().includes("directeur");

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await getUserNotificationsAction();
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch {
      // Ignored if user session expires
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Click outside listeners
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleNotifications = () => {
    setShowNotifications((prev) => {
      if (!prev) {
        fetchNotifications();
      }
      return !prev;
    });
    setShowUserMenu(false);
  };

  const handleMarkAllRead = () => {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    });
  };

  const handleDeleteNotification = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const target = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (target && !target.isRead) {
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    startTransition(async () => {
      await deleteNotificationAction(id);
    });
  };

  const handleClearAll = () => {
    if (notifications.length === 0) return;
    setNotifications([]);
    setUnreadCount(0);
    startTransition(async () => {
      await clearAllNotificationsAction();
    });
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      await markNotificationReadAction(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setShowNotifications(false);
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const formatRelativeTime = (dateInput: Date | string) => {
    const d = new Date(dateInput);
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 60) return "À l'instant";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  return (
    <header className="app-top-header h-16 sticky top-0 z-20 bg-[#090d18]/80 backdrop-blur-2xl border-b border-white/[0.08] px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 w-full select-none shadow-sm shadow-black/20 [box-shadow:inset_0_-1px_0_0_rgba(255,255,255,0.03)]">
      {/* Left side: Hamburger on mobile + Breadcrumb + GlobalSearch */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={toggleMobile}
          className="header-icon-btn p-2 -ml-1 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 rounded-xl md:hidden transition-colors cursor-pointer shrink-0"
          title="Menu de navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Dynamic Breadcrumb */}
        <Breadcrumb />

        {/* Global Search Bar */}
        <div className="min-w-0 max-w-xs sm:max-w-sm flex-1">
          <GlobalSearch />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Quick Actions Menu (Nouveau prospect, facture, etc.) */}
        <QuickActionsMenu />

        {/* Attendance Fast Tracking */}
        <HeaderAttendancePill />

        {/* Notifications Center */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={handleToggleNotifications}
            className="header-icon-btn p-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-xl transition-colors relative cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="min-w-4 h-4 px-1 rounded-full bg-blue-600 dark:bg-blue-500 text-[10px] font-bold text-white flex items-center justify-center absolute -top-0.5 -right-0.5 ring-2 ring-white dark:ring-neutral-950 animate-pulse">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-[-1rem] sm:right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-4 space-y-3 z-50 animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-neutral-100">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-semibold">
                      {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={isPending}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <CheckCheck className="w-3 h-3" />
                    <span>Tout marquer comme lu</span>
                  </button>
                )}
              </div>

              <div className="space-y-2 text-xs overflow-y-auto max-h-96 pr-1 custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center space-y-2">
                    <div className="w-8 h-8 rounded-full bg-neutral-800/80 text-neutral-400 flex items-center justify-center mx-auto">
                      <Bell className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-medium text-neutral-300">Aucune notification pour le moment</p>
                    <p className="text-[10px] text-neutral-400">
                      Vous serez alerté(e) dès qu'une tâche ou mission vous concerne.
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer relative group ${
                        n.isRead
                          ? "bg-neutral-950/60 border-neutral-800/80 hover:bg-neutral-800/40"
                          : "bg-blue-950/30 border-blue-500/30 hover:bg-blue-950/50 shadow-xs"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-1.5 min-w-0 flex-1">
                          {!n.isRead && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1 ring-2 ring-blue-900" />
                          )}
                          <p className={`text-xs leading-snug break-words ${n.isRead ? "font-semibold text-neutral-300" : "font-bold text-neutral-100"}`}>
                            {n.title}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-neutral-400">
                            {formatRelativeTime(n.createdAt)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteNotification(e, n.id)}
                            className="p-1 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                            title="Supprimer cette notification"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-1.5 leading-relaxed line-clamp-2">
                        {n.message}
                      </p>
                      {n.link && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-blue-400 hover:underline font-medium">
                          <span>Voir les détails</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className="pt-2 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={isPending}
                    className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 border border-neutral-800 hover:border-rose-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Effacer toutes les notifications</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Administrator Profile & Menu Trigger */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => {
              setShowUserMenu((prev) => !prev);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition-all cursor-pointer"
            title="Menu Utilisateur & Système"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs shadow-blue-500/20">
              {displayName ? displayName.charAt(0).toUpperCase() : "A"}
            </div>
            <div className="hidden xl:flex flex-col text-left">
              <span className="user-profile-name text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate max-w-[130px]">
                {displayName}
              </span>
              <span className="user-profile-role text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                {userRole || "Admin"}
              </span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 transition-transform duration-200 hidden sm:block ${
                showUserMenu ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* User Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 space-y-2">
              {/* Identity Header */}
              <div className="px-3 py-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
                <p className="text-xs font-bold text-neutral-100 truncate">
                  {displayName}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    {userRole || "Administrateur Général"}
                  </span>
                </div>
              </div>

              {/* Edit Profile Trigger */}
              <button
                type="button"
                onClick={handleOpenProfileModal}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span>Modifier mon profil (Nom)</span>
              </button>

              {/* Admin Shortcuts */}
              {isAdmin && (
                <div className="space-y-0.5 border-b border-neutral-800/80 pb-2">
                  <Link
                    href="/parametres"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-blue-400" />
                    <span>Paramètres Généraux</span>
                  </Link>
                  <Link
                    href="/parametres?tab=AUDIT"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
                  >
                    <History className="w-3.5 h-3.5 text-amber-400" />
                    <span>Journal d'Activité (Audit)</span>
                  </Link>
                  <Link
                    href="/parametres?tab=BACKUP"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
                  >
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sauvegardes Base de Données</span>
                  </Link>
                </div>
              )}

              {/* Theme Switcher Trigger */}
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  setIsModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <Palette className="w-3.5 h-3.5 text-purple-400" />
                <span>Personnaliser l'Apparence</span>
              </button>

              {/* Logout Form */}
              <div className="pt-1 border-t border-neutral-800/80">
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Se Déconnecter</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL MODIFICATION DU PROFIL UTILISATEUR */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setShowProfileModal(false)}
              className="absolute top-5 right-5 text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Modifier mon Profil</h3>
                <p className="text-xs text-neutral-400">
                  Mettez à jour votre nom d'affichage dans l'ERP
                </p>
              </div>
            </div>

            {profileError && (
              <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl font-medium">
                {profileError}
              </div>
            )}

            {profileSuccess && (
              <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Nom d'utilisateur mis à jour avec succès !</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Nom d'utilisateur / Nom complet *
                </label>
                <input
                  type="text"
                  required
                  value={profileNameInput}
                  onChange={(e) => setProfileNameInput(e.target.value)}
                  placeholder="Ex: Zidane Sidahmed, Direction..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Numéro de Téléphone (Optionnel)
                </label>
                <input
                  type="text"
                  value={profilePhoneInput}
                  onChange={(e) => setProfilePhoneInput(e.target.value)}
                  placeholder="05 / 06 / 07..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-xs font-medium cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-lg shadow-blue-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {profileSaving ? "Enregistrement..." : "Enregistrer les modifications"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
