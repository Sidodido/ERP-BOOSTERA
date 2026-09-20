"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { Search, Bell, LogOut, ShieldCheck, CheckCheck, ExternalLink, Sparkles, X, Trash2, Menu } from "lucide-react";
import { logoutAction } from "@/actions/auth";
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
  const [isPending, startTransition] = useTransition();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

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

  const handleToggle = () => {
    setShowNotifications((prev) => {
      if (!prev) {
        fetchNotifications();
      }
      return !prev;
    });
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
    <header className="h-16 sticky top-0 z-20 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800/80 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-3 w-full">
      {/* Left side: Hamburger on mobile + Search Input */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        <button
          type="button"
          onClick={toggleMobile}
          className="p-2 -ml-1 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 rounded-xl md:hidden transition-colors cursor-pointer shrink-0"
          title="Menu de navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search Input */}
        <div className="relative w-32 xs:w-40 sm:w-80 transition-all">
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Recherche..."
            className="w-full h-8.5 sm:h-9 pl-8 sm:pl-9 pr-2.5 sm:pr-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>


      {/* Right Actions */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Pointage Rapide */}
        <HeaderAttendancePill />

        {/* Role Badge (Masqué sur mobile pour éviter la surcharge) */}
        {userRole && (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] font-semibold text-blue-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{userRole}</span>
          </div>
        )}

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={handleToggle}
            className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 rounded-xl transition-colors relative cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="min-w-4 h-4 px-1 rounded-full bg-blue-500 text-[10px] font-bold text-white flex items-center justify-center absolute -top-0.5 -right-0.5 ring-2 ring-neutral-950 animate-pulse">
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
                          <span>Voir le projet</span>
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

        {/* Logout Form */}
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl border border-neutral-800 hover:border-rose-500/20 transition-colors cursor-pointer"
            title="Déconnexion"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Quitter</span>
          </button>
        </form>
      </div>
    </header>
  );
}
