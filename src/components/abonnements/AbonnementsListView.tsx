"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Repeat,
  Search,
  Users,
  DollarSign,
  TrendingUp,
  Layers,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Eye,
  CheckCircle2,
  AlertTriangle,
  PauseCircle,
  ShieldAlert,
  Clock,
  Check,
  XCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { OfferType, ClientStatus } from "@prisma/client";
import { WEEKLY_QUOTAS_BY_OFFER } from "@/lib/aiContentGenerator";
import { updateClientStatusAction } from "@/actions/clients";
import { Button } from "@/components/ui/Button";

interface AbonnementsListViewProps {
  clients: any[];
  users: { id: string; name: string; role: string }[];
}

export const CLIENT_STATUS_BADGES: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  ACTIVE: {
    label: "Actif",
    color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    icon: CheckCircle2,
  },
  IN_PREPARATION: {
    label: "En préparation",
    color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    icon: Clock,
  },
  SUSPENDED: {
    label: "Suspendu",
    color: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    icon: PauseCircle,
  },
  CONTENTIOUS: {
    label: "En contentieux",
    color: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    icon: ShieldAlert,
  },
  TERMINATED: {
    label: "Résilié",
    color: "bg-neutral-800 text-neutral-400 border-neutral-700",
    icon: XCircle,
  },
};

export function AbonnementsListView({ clients, users }: AbonnementsListViewProps) {
  const router = useRouter();

  // Navigation entre les 2 grandes sections :
  // 1. ACTIVE_PREP : "Abonnements en cours" (Garder juste Actif & En préparation)
  // 2. SPECIAL : "Partie Spéciale" (Clients Suspendus & Contentieux)
  const [activeSection, setActiveSection] = useState<"ACTIVE_PREP" | "SPECIAL">("ACTIVE_PREP");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPack, setSelectedPack] = useState<"ALL" | OfferType>("ALL");
  const [selectedSpecialFilter, setSelectedSpecialFilter] = useState<"ALL" | "SUSPENDED" | "CONTENTIOUS">("ALL");
  const [showPackGrid, setShowPackGrid] = useState(false);

  const [updatingClientId, setUpdatingClientId] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // 1. Clients Actifs & En Préparation (Gardés dans la partie principale)
  const activeAndPrepClients = useMemo(() => {
    return clients.filter((c) => {
      const st = c.status || "ACTIVE";
      return st === "ACTIVE" || st === "IN_PREPARATION" || st === "NEW";
    });
  }, [clients]);

  // 2. Clients Suspendus & Contentieux (Isolés dans la partie spéciale)
  const specialClients = useMemo(() => {
    return clients.filter((c) => {
      const st = c.status;
      return st === "SUSPENDED" || st === "CONTENTIOUS" || st === "TERMINATED";
    });
  }, [clients]);

  const suspendedOnlyCount = useMemo(
    () => specialClients.filter((c) => c.status === "SUSPENDED").length,
    [specialClients]
  );

  const contentiousOnlyCount = useMemo(
    () => specialClients.filter((c) => c.status === "CONTENTIOUS" || c.status === "TERMINATED").length,
    [specialClients]
  );

  // Statistiques calculées strictement sur les Abonnements Actifs & En Préparation
  const activeStats = useMemo(() => {
    let totalMRR = 0;
    let totalMonthlyPosts = 0;
    let starterCount = 0;
    let silverCount = 0;
    let goldCount = 0;
    let customCount = 0;
    let activeOnlyCount = 0;
    let prepOnlyCount = 0;

    activeAndPrepClients.forEach((c) => {
      const fee = Number(c.monthlyFee) || 0;
      totalMRR += fee;
      const oType = (c.offerType as OfferType) || "STARTER";
      const q = WEEKLY_QUOTAS_BY_OFFER[oType] || WEEKLY_QUOTAS_BY_OFFER.STARTER;
      totalMonthlyPosts += q.monthly;

      if (oType === "STARTER") starterCount++;
      else if (oType === "SILVER") silverCount++;
      else if (oType === "GOLD") goldCount++;
      else customCount++;

      if (c.status === "IN_PREPARATION") prepOnlyCount++;
      else activeOnlyCount++;
    });

    return {
      totalMRR,
      totalMonthlyPosts,
      totalCount: activeAndPrepClients.length,
      starterCount,
      silverCount,
      goldCount,
      customCount,
      activeOnlyCount,
      prepOnlyCount,
    };
  }, [activeAndPrepClients]);

  // Statistiques pour la Partie Spéciale (Suspendus & Contentieux)
  const specialStats = useMemo(() => {
    let totalLostMRR = 0;
    specialClients.forEach((c) => {
      totalLostMRR += Number(c.monthlyFee) || 0;
    });
    return {
      totalLostMRR,
      totalCount: specialClients.length,
      suspendedCount: suspendedOnlyCount,
      contentiousCount: contentiousOnlyCount,
    };
  }, [specialClients, suspendedOnlyCount, contentiousOnlyCount]);

  // Filtrage des clients pour la section "Abonnements en cours"
  const filteredActiveClients = useMemo(() => {
    return activeAndPrepClients.filter((c) => {
      const matchesPack = selectedPack === "ALL" || c.offerType === selectedPack;
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        c.companyName?.toLowerCase().includes(term) ||
        c.brandName?.toLowerCase().includes(term) ||
        c.sector?.toLowerCase().includes(term) ||
        c.wilaya?.toLowerCase().includes(term);

      return matchesPack && matchesSearch;
    });
  }, [activeAndPrepClients, selectedPack, searchTerm]);

  // Filtrage des clients pour la "Partie Spéciale"
  const filteredSpecialClients = useMemo(() => {
    return specialClients.filter((c) => {
      const matchesType =
        selectedSpecialFilter === "ALL" ||
        (selectedSpecialFilter === "SUSPENDED" && c.status === "SUSPENDED") ||
        (selectedSpecialFilter === "CONTENTIOUS" && (c.status === "CONTENTIOUS" || c.status === "TERMINATED"));

      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        c.companyName?.toLowerCase().includes(term) ||
        c.brandName?.toLowerCase().includes(term) ||
        c.sector?.toLowerCase().includes(term) ||
        c.wilaya?.toLowerCase().includes(term);

      return matchesType && matchesSearch;
    });
  }, [specialClients, selectedSpecialFilter, searchTerm]);

  // Modification du statut du client en 1 clic
  const handleUpdateClientStatus = async (clientId: string, newStatus: ClientStatus, clientName: string) => {
    setUpdatingClientId(clientId);
    try {
      await updateClientStatusAction(clientId, newStatus);
      const statusLabel =
        newStatus === "ACTIVE"
          ? "Actif"
          : newStatus === "IN_PREPARATION"
          ? "En préparation"
          : newStatus === "SUSPENDED"
          ? "Suspendu"
          : "En contentieux";

      setStatusFeedback(`Statut de "${clientName}" mis à jour vers "${statusLabel}" avec succès.`);
      setTimeout(() => setStatusFeedback(null), 4000);
      router.refresh();
    } catch (err: any) {
      alert(err?.message || "Erreur lors de la mise à jour du statut.");
    } finally {
      setUpdatingClientId(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* NOTIFICATION FLOTTANTE DE CHANGEMENT DE STATUT */}
      {statusFeedback && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-neutral-900 border border-emerald-500/40 text-emerald-300 shadow-2xl text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{statusFeedback}</span>
        </div>
      )}

      {/* HEADER SECTION & LIENS RAPIDES */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-neutral-100 flex items-center gap-2">
                Abonnements & Gestion des Packs
                <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {activeStats.totalCount} en cours
                </span>
              </h1>
              <p className="text-xs text-neutral-400">
                Suivi des packs récurrents de l'agence (Starter, Silver, Gold), quotas de publication et Studio Éditorial IA.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/clients"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Tous les Clients</span>
          </Link>
          <Link
            href="/projets"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Section Projets</span>
          </Link>
        </div>
      </div>

      {/* SÉLECTEUR DE SECTION : ACTIFS & EN PRÉPARATION VS PARTIE SPÉCIALE */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-1.5 bg-neutral-900/90 border border-neutral-800 rounded-2xl shadow-inner">
        {/* ONGLET 1 : ACTIFS & EN PRÉPARATION (SECTION PRINCIPALE) */}
        <button
          type="button"
          onClick={() => {
            setActiveSection("ACTIVE_PREP");
            setSelectedPack("ALL");
          }}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSection === "ACTIVE_PREP"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
          }`}
        >
          <CheckCircle2
            className={`w-4 h-4 ${activeSection === "ACTIVE_PREP" ? "text-white" : "text-emerald-400"}`}
          />
          <span>Abonnements en Cours (Actifs & En Préparation)</span>
          <span
            className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-bold ${
              activeSection === "ACTIVE_PREP"
                ? "bg-white/20 text-white"
                : "bg-neutral-800 text-neutral-300 border border-neutral-700"
            }`}
          >
            {activeStats.totalCount}
          </span>
        </button>

        {/* ONGLET 2 : PARTIE SPÉCIALE (SUSPENDUS & CONTENTIEUX) */}
        <button
          type="button"
          onClick={() => {
            setActiveSection("SPECIAL");
            setSelectedSpecialFilter("ALL");
          }}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSection === "SPECIAL"
              ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
          }`}
        >
          <AlertTriangle
            className={`w-4 h-4 ${activeSection === "SPECIAL" ? "text-white" : "text-amber-400"}`}
          />
          <span>Partie Spéciale : Suspendus & Contentieux</span>
          <span
            className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-bold ${
              activeSection === "SPECIAL"
                ? "bg-white/20 text-white"
                : specialClients.length > 0
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-neutral-800 text-neutral-400"
            }`}
          >
            {specialClients.length}
          </span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* VUE 1 : ABONNEMENTS EN COURS (ACTIFS & EN PRÉPARATION)  */}
      {/* ======================================================== */}
      {activeSection === "ACTIVE_PREP" && (
        <div className="space-y-6">
          {/* KPI STATS CARDS (ACTIFS & PRÉPARATION) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Clients Abonnés Actifs */}
            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-neutral-400">Abonnements en Cours</p>
                <h3 className="text-2xl font-black text-neutral-100 mt-1">
                  {activeStats.totalCount}
                </h3>
                <p className="text-[11px] text-purple-400 mt-0.5">
                  {activeStats.activeOnlyCount} actifs • {activeStats.prepOnlyCount} en préparation
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>

            {/* MRR Récurrent Actif */}
            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-neutral-400">Revenu Mensuel (MRR)</p>
                <h3 className="text-2xl font-black text-emerald-400 mt-1">
                  {formatCurrency(activeStats.totalMRR)}
                </h3>
                <p className="text-[11px] text-emerald-500/80 mt-0.5">DA récurrents / mois</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            {/* Publications Mensuelles Garanties */}
            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-neutral-400">Publications Garanties</p>
                <h3 className="text-2xl font-black text-blue-400 mt-1">
                  {activeStats.totalMonthlyPosts}
                </h3>
                <p className="text-[11px] text-blue-400/80 mt-0.5">Posts à livrer ce mois</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            {/* Répartition par Packs Actifs */}
            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-semibold text-neutral-400 mb-2">Répartition des Packs</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Starter : {activeStats.starterCount}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Silver : {activeStats.silverCount}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                    Gold : {activeStats.goldCount}
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* GRILLE OFFICIELLE DES PACKS DE L'AGENCE (REPLIABLE) */}
          <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800/80 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowPackGrid(!showPackGrid)}
                className="flex items-center gap-2 text-xs font-bold text-neutral-300 hover:text-white transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Grille Officielle des Packs de l'Agence (Starter, Silver, Gold)</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${
                    showPackGrid ? "rotate-180" : ""
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={() => setShowPackGrid(!showPackGrid)}
                className="text-[11px] text-purple-400 hover:text-purple-300 font-medium cursor-pointer"
              >
                {showPackGrid ? "Masquer les détails" : "Consulter les quotas & détails"}
              </button>
            </div>

            {showPackGrid && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-neutral-800/80 animate-fadeIn">
              {/* STARTER */}
              <div className="p-4 rounded-xl bg-neutral-950/70 border border-blue-500/30 space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-blue-400">Starter</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 font-semibold border border-blue-500/30">
                      Idéal pour débuter
                    </span>
                  </div>
                  <ul className="text-xs text-neutral-300 space-y-1.5 mt-3">
                    <li className="flex items-center gap-1.5 font-bold text-blue-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" /> 2 carrousels + 2 Maquettes (SANS REELS)
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" /> 1 publication / semaine (4 / mois)
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" /> SEO de base & Certification Google
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" /> Site web professionnel
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" /> 1 Shooting / an • 1 Vidéo Pro / an + Sponsor
                    </li>
                  </ul>
                </div>
                <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-neutral-400">Portée cible</span>
                  <span className="text-xs font-black text-blue-300">50K vues</span>
                </div>
              </div>

              {/* SILVER */}
              <div className="p-4 rounded-xl bg-neutral-950/70 border border-amber-500/40 space-y-2.5 flex flex-col justify-between ring-1 ring-amber-500/20">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-amber-400">Silver</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30">
                      Bonne visibilité
                    </span>
                  </div>
                  <ul className="text-xs text-neutral-300 space-y-1.5 mt-3">
                    <li className="flex items-center gap-1.5 font-bold text-amber-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /> 3 carrousels + 3 Maquettes + 2 Reels
                    </li>
                    <li className="flex items-center gap-1.5 font-bold text-purple-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" /> 1 voix off incluse
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /> 2 publications / semaine (8 / mois)
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /> SEO de base & Certification Google
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /> 3 Shootings / an • 3 Vidéos Pro / an + Sponsor
                    </li>
                  </ul>
                </div>
                <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-neutral-400">Portée cible</span>
                  <span className="text-xs font-black text-amber-300">600K vues</span>
                </div>
              </div>

              {/* GOLD */}
              <div className="p-4 rounded-xl bg-neutral-950/70 border border-yellow-500/40 space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-yellow-400">Gold</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300 font-semibold border border-yellow-500/30">
                      Forte présence
                    </span>
                  </div>
                  <ul className="text-xs text-neutral-300 space-y-1.5 mt-3">
                    <li className="flex items-center gap-1.5 font-bold text-yellow-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-yellow-400" /> 4 carrousels + 4 Maquettes + 4 Reels
                    </li>
                    <li className="flex items-center gap-1.5 font-bold text-purple-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" /> 2 voix off incluses
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-yellow-400" /> 3 publications / semaine (12 / mois)
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-yellow-400" /> SEO de base & Certification Google
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-yellow-400" /> 5 Shootings / an • 5 Vidéos Pro / an + Sponsor
                    </li>
                  </ul>
                </div>
                <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-neutral-400">Portée cible</span>
                  <span className="text-xs font-black text-yellow-300">1M vues</span>
                </div>
              </div>
            </div>
            )}
          </div>

          {/* FILTRES PAR PACK & RECHERCHE */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Onglets Filtres par Pack */}
            <div className="flex items-center gap-1.5 bg-neutral-900 p-1 rounded-xl border border-neutral-800 overflow-x-auto w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setSelectedPack("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  selectedPack === "ALL"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
                }`}
              >
                Tous les Packs ({activeStats.totalCount})
              </button>
              <button
                type="button"
                onClick={() => setSelectedPack("STARTER")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  selectedPack === "STARTER"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
                }`}
              >
                Starter ({activeStats.starterCount})
              </button>
              <button
                type="button"
                onClick={() => setSelectedPack("SILVER")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  selectedPack === "SILVER"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
                }`}
              >
                Silver ({activeStats.silverCount})
              </button>
              <button
                type="button"
                onClick={() => setSelectedPack("GOLD")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  selectedPack === "GOLD"
                    ? "bg-yellow-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
                }`}
              >
                Gold ({activeStats.goldCount})
              </button>
            </div>

            {/* Barre de Recherche */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher un client, marque, ville..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-200 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* LISTE DES CLIENTS ABONNÉS ACTIFS & EN PRÉPARATION */}
          <div className="space-y-3">
            {filteredActiveClients.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800 text-neutral-400 text-xs">
                Aucun abonnement actif ou en préparation trouvé pour ce filtre.
              </div>
            ) : (
              filteredActiveClients.map((client) => {
                const offer = (client.offerType as OfferType) || "STARTER";
                const quota = WEEKLY_QUOTAS_BY_OFFER[offer] || WEEKLY_QUOTAS_BY_OFFER.STARTER;
                const clientStatus = client.status || "ACTIVE";
                const statusBadge = CLIENT_STATUS_BADGES[clientStatus] || CLIENT_STATUS_BADGES.ACTIVE;
                const StatusIcon = statusBadge.icon;
                const displayName = client.brandName || client.companyName;

                return (
                  <div
                    key={client.id}
                    className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800/90 hover:border-purple-500/40 transition-all shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                  >
                    {/* Infos Client */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-neutral-800 to-neutral-700 flex items-center justify-center font-bold text-sm text-neutral-200 border border-neutral-700 shrink-0">
                        {displayName.charAt(0).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-neutral-100 truncate">
                            {client.brandName ? (
                              <>
                                {client.brandName}{" "}
                                <span className="text-xs font-normal text-neutral-400">
                                  ({client.companyName})
                                </span>
                              </>
                            ) : (
                              client.companyName
                            )}
                          </h3>

                          {/* Badge Statut Client (Actif ou En préparation) */}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${statusBadge.color}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            <span>{statusBadge.label}</span>
                          </span>

                          {/* Badge Pack */}
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${quota.badgeColor}`}
                          >
                            {quota.label}
                          </span>

                          <span className="text-[10px] font-medium text-neutral-400 bg-neutral-800/80 px-2 py-0.5 rounded-md border border-neutral-700/60">
                            {client.sector || "Secteur"}
                          </span>

                          {client.wilaya && (
                            <span className="text-[10px] text-neutral-500 font-mono">
                              📍 {client.wilaya}
                            </span>
                          )}
                        </div>

                        {/* Prestations & Tarifs */}
                        <div className="flex flex-wrap items-center gap-2.5 mt-2 text-xs text-neutral-400">
                          <span className="text-neutral-200 font-semibold flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-purple-400" />
                            {quota.details}
                          </span>
                          <span>•</span>
                          <span className="text-amber-300/90 font-mono flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" />
                            {quota.features.viewsTarget}
                          </span>
                          <span>•</span>
                          <span className="text-emerald-400 font-mono font-bold">
                            {formatCurrency(Number(client.monthlyFee) || 0)} / mois
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions & Bouton Studio IA */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                      {/* Sélecteur de mise en suspension ou contentieux */}
                      <Link
                        href={`/abonnements/${client.id}`}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Gérer l'Abonnement & Studio IA</span>
                        <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VUE 2 : PARTIE SPÉCIALE (SUSPENDUS & CONTENTIEUX)        */}
      {/* ======================================================== */}
      {activeSection === "SPECIAL" && (
        <div className="space-y-6">
          {/* BANDEAU D'EXPLICATION DE LA PARTIE SPÉCIALE */}
          <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-200">
                  Partie Spéciale : Abonnements Suspendus & Contentieux
                </h3>
                <p className="text-xs text-neutral-300 mt-0.5">
                  Ces dossiers sont volontairement isolés de la file active de production en raison d'impayés, de litiges juridiques ou d'une demande de suspension temporaire.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection("ACTIVE_PREP")}
              className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>← Retour aux Abonnements en cours</span>
            </button>
          </div>

          {/* KPI STATS DE LA PARTIE SPÉCIALE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Dossiers Isolés */}
            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-neutral-400">Dossiers Isolés</p>
                <h3 className="text-2xl font-black text-rose-400 mt-1">
                  {specialStats.totalCount}
                </h3>
                <p className="text-[11px] text-neutral-500 mt-0.5">Suspendus & litiges</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            {/* Suspendus */}
            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-neutral-400">Suspendus (Pause / Impayé)</p>
                <h3 className="text-2xl font-black text-amber-400 mt-1">
                  {specialStats.suspendedCount}
                </h3>
                <p className="text-[11px] text-amber-500/80 mt-0.5">En attente de reprise</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <PauseCircle className="w-5 h-5" />
              </div>
            </div>

            {/* Contentieux */}
            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-neutral-400">En Contentieux</p>
                <h3 className="text-2xl font-black text-rose-400 mt-1">
                  {specialStats.contentiousCount}
                </h3>
                <p className="text-[11px] text-rose-500/80 mt-0.5">Litiges juridiques ou résiliés</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>

            {/* MRR Bloqué / En Souffrance */}
            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-neutral-400">MRR Bloqué / En Souffrance</p>
                <h3 className="text-2xl font-black text-neutral-200 mt-1">
                  {formatCurrency(specialStats.totalLostMRR)}
                </h3>
                <p className="text-[11px] text-neutral-500 mt-0.5">DA / mois en attente</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-400 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* FILTRES DE LA PARTIE SPÉCIALE & RECHERCHE */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-neutral-900 p-1 rounded-xl border border-neutral-800 overflow-x-auto w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setSelectedSpecialFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  selectedSpecialFilter === "ALL"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
                }`}
              >
                Tous les Dossiers ({specialClients.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedSpecialFilter("SUSPENDED")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  selectedSpecialFilter === "SUSPENDED"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
                }`}
              >
                ⏸️ Suspendus ({suspendedOnlyCount})
              </button>
              <button
                type="button"
                onClick={() => setSelectedSpecialFilter("CONTENTIOUS")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  selectedSpecialFilter === "CONTENTIOUS"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
                }`}
              >
                ⚖️ Contentieux ({contentiousOnlyCount})
              </button>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher un dossier suspendu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-200 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* LISTE DES CLIENTS DE LA PARTIE SPÉCIALE */}
          <div className="space-y-3">
            {filteredSpecialClients.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800 text-neutral-400 text-xs">
                Aucun client suspendu ou en contentieux pour ce filtre.
              </div>
            ) : (
              filteredSpecialClients.map((client) => {
                const offer = (client.offerType as OfferType) || "STARTER";
                const quota = WEEKLY_QUOTAS_BY_OFFER[offer] || WEEKLY_QUOTAS_BY_OFFER.STARTER;
                const clientStatus = client.status || "SUSPENDED";
                const statusBadge = CLIENT_STATUS_BADGES[clientStatus] || CLIENT_STATUS_BADGES.SUSPENDED;
                const StatusIcon = statusBadge.icon;
                const isSuspended = clientStatus === "SUSPENDED";
                const displayName = client.brandName || client.companyName;

                return (
                  <div
                    key={client.id}
                    className={`p-5 rounded-2xl bg-neutral-900/90 border transition-all shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 group ${
                      isSuspended
                        ? "border-amber-500/30 hover:border-amber-500/60"
                        : "border-rose-500/40 hover:border-rose-500/70"
                    }`}
                  >
                    {/* Infos Client */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm border shrink-0 ${
                          isSuspended
                            ? "bg-amber-950/40 text-amber-300 border-amber-500/40"
                            : "bg-rose-950/40 text-rose-300 border-rose-500/40"
                        }`}
                      >
                        {displayName.charAt(0).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-neutral-100 truncate">
                            {client.brandName ? (
                              <>
                                {client.brandName}{" "}
                                <span className="text-xs font-normal text-neutral-400">
                                  ({client.companyName})
                                </span>
                              </>
                            ) : (
                              client.companyName
                            )}
                          </h3>

                          {/* Badge Statut */}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${statusBadge.color}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            <span>{statusBadge.label}</span>
                          </span>

                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${quota.badgeColor}`}
                          >
                            {quota.label}
                          </span>

                          <span className="text-[10px] font-medium text-neutral-400 bg-neutral-800/80 px-2 py-0.5 rounded-md border border-neutral-700/60">
                            {client.sector || "Secteur"}
                          </span>

                          {client.wilaya && (
                            <span className="text-[10px] text-neutral-500 font-mono">
                              📍 {client.wilaya}
                            </span>
                          )}
                        </div>

                        {/* Motif & Avertissement */}
                        <p className="text-xs text-neutral-400 mt-2 flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              isSuspended ? "text-amber-400" : "text-rose-400"
                            }`}
                          >
                            {isSuspended ? (
                              <>
                                <PauseCircle className="w-3.5 h-3.5" />
                                <span>Abonnement temporairement gelé / en attente de règlement</span>
                              </>
                            ) : (
                              <>
                                <ShieldAlert className="w-3.5 h-3.5" />
                                <span>Litige financier ou contentieux contractuel en cours</span>
                              </>
                            )}
                          </span>
                          <span>•</span>
                          <span className="text-neutral-500 font-mono">
                            Montant : {formatCurrency(Number(client.monthlyFee) || 0)} / mois
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Actions de Résolution & Réactivation */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-auto">
                      {/* BOUTON 1 : RÉACTIVER EN ACTIF */}
                      <Button
                        size="sm"
                        disabled={updatingClientId === client.id}
                        onClick={() => handleUpdateClientStatus(client.id, "ACTIVE", displayName)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 text-xs font-bold shadow-md cursor-pointer"
                        title="Réactiver cet abonnement et le renvoyer dans la file active"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Réactiver en Actif</span>
                      </Button>

                      {/* BOUTON 2 : PASSER EN PRÉPARATION */}
                      <button
                        type="button"
                        disabled={updatingClientId === client.id}
                        onClick={() => handleUpdateClientStatus(client.id, "IN_PREPARATION", displayName)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-neutral-300 hover:text-cyan-300 hover:bg-cyan-500/10 border border-neutral-700 hover:border-cyan-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Remettre en préparation contractuelle"
                      >
                        <Clock className="w-3 h-3 text-cyan-400" />
                        <span>En préparation</span>
                      </button>

                      {/* BASCULE ENTRE SUSPENDU ET CONTENTIEUX */}
                      {isSuspended ? (
                        <button
                          type="button"
                          disabled={updatingClientId === client.id}
                          onClick={() => handleUpdateClientStatus(client.id, "CONTENTIOUS", displayName)}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-rose-300 hover:bg-rose-500/10 border border-neutral-800 hover:border-rose-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Passer en contentieux"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                          <span>Contentieux</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={updatingClientId === client.id}
                          onClick={() => handleUpdateClientStatus(client.id, "SUSPENDED", displayName)}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-amber-300 hover:bg-amber-500/10 border border-neutral-800 hover:border-amber-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Passer en suspension"
                        >
                          <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                          <span>Suspendre</span>
                        </button>
                      )}

                      {/* LIEN STUDIO IA & DÉTAILS */}
                      <Link
                        href={`/abonnements/${client.id}`}
                        className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors cursor-pointer"
                        title="Consulter le Studio IA et le dossier client"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
