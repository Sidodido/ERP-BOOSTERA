"use client";

import React, { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Loader2,
  Building,
  Target,
  Calendar,
  Briefcase,
  User,
  MessagesSquare,
  ArrowRight,
  Sparkles,
  Phone,
  Clock,
  Command,
} from "lucide-react";
import { globalSearchAction, GlobalSearchResults } from "@/actions/search";

export function GlobalSearch() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResults | null>(null);
  const [isPending, startTransition] = useTransition();

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Écouteur global Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fermer si clic à l'extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Déclencher la recherche avec debounce
  const executeSearch = useCallback((searchQuery: string) => {
    startTransition(async () => {
      try {
        const res = await globalSearchAction(searchQuery);
        setResults(res);
      } catch (err) {
        console.warn("Erreur recherche globale:", err);
      }
    });
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!isOpen) return;

    const timer = setTimeout(() => {
      executeSearch(trimmed);
    }, 220);

    return () => clearTimeout(timer);
  }, [query, isOpen, executeSearch]);

  const handleFocus = () => {
    setIsOpen(true);
    if (!results) {
      executeSearch(query.trim());
    }
  };

  const handleSelectLink = (link: string) => {
    setIsOpen(false);
    setQuery("");
    router.push(link);
  };

  const handleClear = () => {
    setQuery("");
    executeSearch("");
    inputRef.current?.focus();
  };

  const hasAnyResults =
    results &&
    (results.clients.length > 0 ||
      results.prospects.length > 0 ||
      results.appointments.length > 0 ||
      results.projects.length > 0 ||
      results.collaborators.length > 0 ||
      results.pages.length > 0);

  return (
    <div ref={containerRef} className="relative w-36 xs:w-48 sm:w-80 md:w-96 transition-all">
      {/* Champ de Saisie */}
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 absolute left-2.5 sm:left-3 text-neutral-400 pointer-events-none" />
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          placeholder="Recherche globale... (Ctrl+K)"
          className="w-full h-8.5 sm:h-9 pl-8 sm:pl-9 pr-14 text-xs bg-neutral-900/90 border border-neutral-800 rounded-xl text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all shadow-inner"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
          ) : query ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700 pointer-events-none">
              <Command className="w-2.5 h-2.5" /> K
            </span>
          )}
        </div>
      </div>

      {/* Menu Déroulant des Résultats */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-[calc(100vw-2rem)] sm:w-[500px] md:w-[600px] max-w-[94vw] sm:max-w-none bg-neutral-950/95 border border-neutral-800 rounded-2xl shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[75vh]">
          {/* Entête du menu */}
          <div className="px-3.5 py-2.5 border-b border-neutral-800/80 bg-neutral-900/50 flex items-center justify-between text-xs text-neutral-400">
            <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>
                {query.trim()
                  ? `Résultats pour « ${query.trim()} »`
                  : "Navigation et recherche rapide"}
              </span>
            </span>
            <span className="text-[10px] text-neutral-500">Échap pour fermer</span>
          </div>

          {/* Corps défilable */}
          <div className="overflow-y-auto p-2.5 space-y-3 custom-scrollbar text-xs">
            {/* 1. SECTION CLIENTS */}
            {results && results.clients.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5" />
                  <span>Clients ({results.clients.length})</span>
                </div>
                <div className="space-y-1 mt-1">
                  {results.clients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        handleSelectLink(`/clients?search=${encodeURIComponent(c.companyName)}`)
                      }
                      className="w-full text-left p-2.5 rounded-xl hover:bg-neutral-800/60 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-neutral-200 group-hover:text-emerald-300 transition-colors truncate">
                            {c.companyName}
                          </p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                            {c.offerType}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                          {c.contactName ? `${c.contactName} • ` : ""}
                          {c.phone} {c.wilaya ? `• ${c.wilaya}` : ""} • {c.sector}
                        </p>
                      </div>
                      <span className="text-[11px] font-medium text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                        <span>Ouvrir</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2. SECTION PROSPECTS */}
            {results && results.prospects.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  <span>Prospects ({results.prospects.length})</span>
                </div>
                <div className="space-y-1 mt-1">
                  {results.prospects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        handleSelectLink(`/prospection?search=${encodeURIComponent(p.companyName)}`)
                      }
                      className="w-full text-left p-2.5 rounded-xl hover:bg-neutral-800/60 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-neutral-200 group-hover:text-amber-300 transition-colors truncate">
                            {p.companyName}
                          </p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                            {p.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                          {p.contactName ? `${p.contactName} • ` : ""}
                          {p.phone} {p.wilaya ? `• ${p.wilaya}` : ""} • {p.sector}
                        </p>
                      </div>
                      <span className="text-[11px] font-medium text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                        <span>Fiche</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 3. SECTION RENDEZ-VOUS */}
            {results && results.appointments.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[11px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Rendez-vous ({results.appointments.length})</span>
                </div>
                <div className="space-y-1 mt-1">
                  {results.appointments.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() =>
                        handleSelectLink(`/rendez-vous?search=${encodeURIComponent(a.title)}`)
                      }
                      className="w-full text-left p-2.5 rounded-xl hover:bg-neutral-800/60 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-neutral-200 group-hover:text-blue-300 transition-colors truncate">
                          {a.title}
                        </p>
                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                          {a.targetName} • {new Date(a.startTime).toLocaleDateString("fr-FR")} à{" "}
                          {new Date(a.startTime).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          {a.location ? `(${a.location})` : ""}
                        </p>
                      </div>
                      <span className="text-[11px] font-medium text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                        <span>Voir</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 4. SECTION PROJETS WEB & PRODUCTION */}
            {results && results.projects.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[11px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Projets ({results.projects.length})</span>
                </div>
                <div className="space-y-1 mt-1">
                  {results.projects.map((pr) => (
                    <button
                      key={pr.id}
                      type="button"
                      onClick={() => handleSelectLink(`/projets`)}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-neutral-800/60 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-neutral-200 group-hover:text-purple-300 transition-colors truncate">
                            {pr.name}
                          </p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
                            {pr.code}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                          Client : {pr.clientName} • Statut : {pr.status}
                        </p>
                      </div>
                      <span className="text-[11px] font-medium text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                        <span>Suivi</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 5. SECTION COLLABORATEURS / CHAT DIRECT */}
            {results && results.collaborators.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>Collaborateurs ({results.collaborators.length})</span>
                </div>
                <div className="space-y-1 mt-1">
                  {results.collaborators.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelectLink(`/chat?dm=${u.id}`)}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-neutral-800/60 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-7 h-7 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold text-xs flex items-center justify-center shrink-0">
                          {u.name[0]?.toUpperCase() || "C"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-neutral-200 group-hover:text-cyan-300 transition-colors truncate">
                            {u.name}
                          </p>
                          <p className="text-[11px] text-neutral-400 truncate">
                            {u.role} • {u.email}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-cyan-400 bg-cyan-950/40 px-2 py-1 rounded-lg border border-cyan-500/30 group-hover:bg-cyan-500 group-hover:text-black transition-all flex items-center gap-1 shrink-0">
                        <MessagesSquare className="w-3 h-3" />
                        <span>Chatter</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 6. SECTION PAGES & RACCOURCIS SYSTÈME */}
            {results && results.pages.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Modules & Pages</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1">
                  {results.pages.map((pg, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectLink(pg.link)}
                      className="text-left p-2 rounded-xl bg-neutral-900/60 hover:bg-neutral-800 border border-neutral-800/80 hover:border-neutral-700 transition-all group cursor-pointer"
                    >
                      <p className="font-semibold text-neutral-200 group-hover:text-blue-300 transition-colors">
                        {pg.title}
                      </p>
                      <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                        {pg.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 7. AUCUN RÉSULTAT */}
            {query.trim().length > 0 && !isPending && !hasAnyResults && (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-neutral-900 text-neutral-500 flex items-center justify-center mx-auto">
                  <Search className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-neutral-300">
                  Aucun résultat pour « {query.trim()} »
                </p>
                <p className="text-[11px] text-neutral-500 max-w-xs mx-auto">
                  Vérifiez l'orthographe ou tentez un numéro de téléphone, un nom d'entreprise ou
                  un collaborateur.
                </p>
              </div>
            )}
          </div>

          {/* Pied du menu avec astuces */}
          <div className="px-3.5 py-2 border-t border-neutral-800/80 bg-neutral-900/30 flex items-center justify-between text-[10px] text-neutral-500">
            <span>
              Recherche instantanée sur : Clients, Prospects, RDV, Projets, Collaborateurs
            </span>
            <span className="font-medium text-neutral-400">BOOSTERA ERP</span>
          </div>
        </div>
      )}
    </div>
  );
}
