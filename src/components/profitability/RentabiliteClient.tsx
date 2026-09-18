"use client";

import React, { useState, useTransition } from "react";
import {
  TrendingUp,
  Plus,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  PieChart,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Building2,
} from "lucide-react";
import { addProjectCostAction } from "@/actions/profitability";
import { OfferType } from "@prisma/client";

interface ProjectMetric {
  id: string;
  name: string;
  code: string;
  clientName: string;
  offerType: OfferType;
  revenue: number;
  costs: number;
  directCosts: number;
  orderCosts: number;
  netMargin: number;
  marginPercentage: number;
  status: string;
  costsList: { id: string; costType: string; amount: number; description: string }[];
}

interface PackSummaryItem {
  pack: OfferType;
  count: number;
  revenue: number;
  costs: number;
  netMargin: number;
  marginPercentage: number;
}

interface RentabiliteClientProps {
  kpis: {
    totalAgencyRevenue: number;
    totalAgencyCosts: number;
    agencyNetMargin: number;
    agencyMarginPercentage: number;
    totalProjects: number;
    profitableProjectsCount: number;
    atRiskProjectsCount: number;
  };
  projects: ProjectMetric[];
  packSummary: PackSummaryItem[];
}

export function RentabiliteClient({
  kpis,
  projects,
  packSummary,
}: RentabiliteClientProps) {
  const [activeTab, setActiveTab] = useState<"PROJECTS" | "PACKS">("PROJECTS");
  const [isPending, startTransition] = useTransition();

  // Modal State
  const [showCostModal, setShowCostModal] = useState(false);
  const [costProjectId, setCostProjectId] = useState("");
  const [costType, setCostType] = useState("FREELANCER");
  const [costAmount, setCostAmount] = useState<number>(10000);
  const [costDesc, setCostDesc] = useState("");

  const handleAddCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!costProjectId || costAmount <= 0) {
      alert("Projet et montant requis");
      return;
    }

    startTransition(async () => {
      try {
        await addProjectCostAction({
          projectId: costProjectId,
          costType,
          amount: costAmount,
          description: costDesc || "Coût additionnel de production",
        });
        setShowCostModal(false);
        window.location.reload();
      } catch (err: any) {
        alert(err.message || "Erreur d'ajout de coût");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2.5">
            <TrendingUp className="w-7 h-7 text-emerald-400" />
            Analyse de la Rentabilité & Contrôle de Gestion
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Calcul de la marge nette réelle par projet, client et typologie de pack d'offres.
          </p>
        </div>
        <button
          onClick={() => setShowCostModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" /> Imputer un Coût Projet
        </button>
      </div>

      {/* Formula Reminder Banner */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-neutral-300">
        <div className="flex items-center gap-2">
          <span className="font-bold text-emerald-400 uppercase tracking-wider">
            Formule de Calcul :
          </span>
          <span>
            Marge Nette = Chiffre d'Affaires Encaissé - (Temps Collaborateurs + Sous-traitance
            + Ads + Outils Imputés)
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono font-semibold text-neutral-400">
          <span className="text-emerald-400">Vert &gt; 35%</span> •{" "}
          <span className="text-amber-400">Orange 20-35%</span> •{" "}
          <span className="text-rose-400">Rouge &lt; 20%</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Chiffre d'Affaires Global
            </span>
            <span className="p-2 rounded-xl bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-neutral-100 mt-2 font-mono">
            {kpis.totalAgencyRevenue.toLocaleString("fr-FR")}{" "}
            <span className="text-sm font-normal text-neutral-400">DA</span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">{kpis.totalProjects} projets suivis</p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Coûts Totaux Engagés
            </span>
            <span className="p-2 rounded-xl bg-amber-950/60 text-amber-400 border border-amber-800/40">
              <ArrowDownRight className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2 font-mono">
            {kpis.totalAgencyCosts.toLocaleString("fr-FR")}{" "}
            <span className="text-sm font-normal text-amber-400/80">DA</span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">Dépenses & sous-traitance</p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Marge Nette Globale
            </span>
            <span className="p-2 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2 font-mono">
            {kpis.agencyNetMargin.toLocaleString("fr-FR")}{" "}
            <span className="text-sm font-normal text-emerald-500/80">DA</span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">Bénéfice opérationnel brut</p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              Taux de Marge Moyen
            </span>
            <span className="p-2 rounded-xl bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
              <PieChart className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-indigo-400 mt-2 font-mono">
            {kpis.agencyMarginPercentage}%
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            {kpis.profitableProjectsCount} projets très rentables (&gt;35%)
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
        <button
          onClick={() => setActiveTab("PROJECTS")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "PROJECTS"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          Rentabilité par Projet ({projects.length})
        </button>
        <button
          onClick={() => setActiveTab("PACKS")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "PACKS"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          Rentabilité par Pack d'Offres
        </button>
      </div>

      {/* TAB 1: PROJECTS */}
      {activeTab === "PROJECTS" && (
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 text-xs uppercase font-semibold">
                  <th className="py-3.5 px-4">Projet & Client</th>
                  <th className="py-3.5 px-4">Offre</th>
                  <th className="py-3.5 px-4 text-right">CA Facturé</th>
                  <th className="py-3.5 px-4 text-right">Coûts Imputés</th>
                  <th className="py-3.5 px-4 text-right">Marge Nette</th>
                  <th className="py-3.5 px-4 text-center">Taux Marge (%)</th>
                  <th className="py-3.5 px-4 text-center">Santé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-neutral-400">
                      Aucun projet enregistré.
                    </td>
                  </tr>
                ) : (
                  projects.map((p) => {
                    const isHigh = p.marginPercentage >= 35;
                    const isMid = p.marginPercentage >= 20 && p.marginPercentage < 35;

                    return (
                      <tr key={p.id} className="hover:bg-neutral-800/30 transition">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-neutral-200">{p.name}</div>
                          <div className="text-xs text-neutral-400 font-mono">
                            {p.code} • {p.clientName}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-neutral-800 text-neutral-300">
                            {p.offerType}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-neutral-200">
                          {p.revenue.toLocaleString("fr-FR")} DA
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-amber-400">
                          {p.costs.toLocaleString("fr-FR")} DA
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                          {p.netMargin.toLocaleString("fr-FR")} DA
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold">
                          <span
                            className={
                              isHigh
                                ? "text-emerald-400"
                                : isMid
                                ? "text-amber-400"
                                : "text-rose-400"
                            }
                          >
                            {p.marginPercentage}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                              isHigh
                                ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                                : isMid
                                ? "bg-amber-950/60 text-amber-400 border border-amber-800/40"
                                : "bg-rose-950/60 text-rose-400 border border-rose-800/40"
                            }`}
                          >
                            {isHigh ? "Excellente" : isMid ? "Moyenne" : "À Risque"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PACKS SUMMARY */}
      {activeTab === "PACKS" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {packSummary.map((ps) => (
            <div
              key={ps.pack}
              className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-100 text-base">
                  Pack {ps.pack}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                  {ps.count} projet{ps.count > 1 ? "s" : ""}
                </span>
              </div>

              <div className="space-y-2 text-sm pt-2 border-t border-neutral-800/60">
                <div className="flex justify-between text-neutral-400">
                  <span>CA Cumulé :</span>
                  <span className="font-mono text-neutral-200 font-semibold">
                    {ps.revenue.toLocaleString("fr-FR")} DA
                  </span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Coûts Engagés :</span>
                  <span className="font-mono text-amber-400">
                    {ps.costs.toLocaleString("fr-FR")} DA
                  </span>
                </div>
                <div className="flex justify-between text-neutral-300 font-semibold pt-2 border-t border-neutral-800">
                  <span>Marge Nette :</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {ps.netMargin.toLocaleString("fr-FR")} DA
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-neutral-400">Taux de Marge :</span>
                  <span className="font-mono font-bold text-indigo-400">
                    {ps.marginPercentage}%
                  </span>
                </div>
                <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full"
                    style={{ width: `${Math.min(100, Math.max(0, ps.marginPercentage))}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: ADD COST */}
      {showCostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <div className="flex items-center gap-2.5">
                <DollarSign className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-neutral-100">
                  Imputer un Coût au Projet
                </h3>
              </div>
              <button
                onClick={() => setShowCostModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCost} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Projet Concerné *
                </label>
                <select
                  value={costProjectId}
                  onChange={(e) => setCostProjectId(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Sélectionner un projet...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name} ({p.clientName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Type de Coût *
                  </label>
                  <select
                    value={costType}
                    onChange={(e) => setCostType(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="FREELANCER">Freelance / Prestataire</option>
                    <option value="ADVERTISING">Budget Publicitaire Ads</option>
                    <option value="SOFTWARE">Logiciel Spécifique</option>
                    <option value="EMPLOYEE_TIME">Temps Passé Additionnel</option>
                    <option value="HARDWARE">Matériel Loué</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Montant (DA) *
                  </label>
                  <input
                    type="number"
                    min="500"
                    step="500"
                    value={costAmount}
                    onChange={(e) => setCostAmount(Number(e.target.value))}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Description / Justification
                </label>
                <input
                  type="text"
                  placeholder="Ex: Tournage drone supplémentaire par externe..."
                  value={costDesc}
                  onChange={(e) => setCostDesc(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCostModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isPending ? "Imputation..." : "Enregistrer le Coût"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
