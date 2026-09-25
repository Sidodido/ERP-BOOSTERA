"use client";

import React, { useState, useTransition } from "react";
import {
  BarChart3,
  Calendar,
  Download,
  Printer,
  TrendingUp,
  DollarSign,
  Users,
  Briefcase,
  CheckCircle2,
  PhoneCall,
  Target,
  ArrowUpRight,
  PieChart,
} from "lucide-react";
import { getReportingDataAction } from "@/actions/reporting";

interface ReportingData {
  period: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  commercial: {
    totalProspects: number;
    convertedClients: number;
    commercialConversionRate: number;
    totalCalls: number;
    interestedCalls: number;
    callSuccessRate: number;
    totalAppointments: number;
    completedAppointments: number;
  };
  production: {
    activeProjects: number;
    completedProjects: number;
    totalTasks: number;
    completedTasks: number;
    taskCompletionRate: number;
  };
  finance: {
    totalInvoiced: number;
    totalCollected: number;
    totalReceivables: number;
    totalCosts: number;
    netAgencyProfit: number;
    globalMarginRate: number;
  };
  salesLeaderboard: {
    name: string;
    callsCount: number;
    meetingsCount: number;
    clientsSigned: number;
    revenueGenerated: number;
  }[];
}

interface ReportingClientProps {
  initialData: ReportingData;
}

export function ReportingClient({ initialData }: ReportingClientProps) {
  const [data, setData] = useState<ReportingData>(initialData);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(initialData.period);
  const [isPending, startTransition] = useTransition();

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    startTransition(async () => {
      try {
        const res = await getReportingDataAction(period);
        setData(res);
      } catch (err: any) {
        alert(err.message || "Erreur de chargement");
      }
    });
  };

  const handleExportCSV = () => {
    const rows = [
      ["RAPPORT D'ACTIVITE BOOSTERA", data.periodLabel],
      ["Periode", `${new Date(data.startDate).toLocaleDateString("fr-FR")} au ${new Date(data.endDate).toLocaleDateString("fr-FR")}`],
      [],
      ["INDICATEURS FINANCIERS", "MONTANT (DA)"],
      ["Total Facture", data.finance.totalInvoiced],
      ["Total Encaisse", data.finance.totalCollected],
      ["Creances Clients Restantes", data.finance.totalReceivables],
      ["Depenses & Achats Engages", data.finance.totalCosts],
      ["Marge Nette Agence", data.finance.netAgencyProfit],
      ["Taux de Marge Global", `${data.finance.globalMarginRate}%`],
      [],
      ["PERFORMANCE COMMERCIALE", "VALEUR"],
      ["Prospects Entrants", data.commercial.totalProspects],
      ["Clients Closes", data.commercial.convertedClients],
      ["Taux de Conversion", `${data.commercial.commercialConversionRate}%`],
      ["Appels Effectues", data.commercial.totalCalls],
      ["Appels Positifs", data.commercial.interestedCalls],
      ["Rendez-vous Realises", data.commercial.completedAppointments],
      [],
      ["CLASSEMENT COMMERCIAUX", "APPELS", "RDV", "CLIENTS CLOSES", "CA GENERE (DA)"],
      ...data.salesLeaderboard.map((s) => [
        s.name,
        s.callsCount,
        s.meetingsCount,
        s.clientsSigned,
        s.revenueGenerated,
      ]),
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      rows.map((e) => e.join(";")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Rapport_BOOSTERA_${data.period}_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7 text-indigo-400" />
            Rapports d'Activité & Exports Exécutifs
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Synthèse globale des performances commerciales, de production et financières.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-medium transition"
          >
            <Printer className="w-4 h-4" /> Imprimer Rapport
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20"
          >
            <Download className="w-4 h-4" /> Exporter CSV / Excel
          </button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Période d'Analyse :
          </span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { key: "MONTH", label: "Mois en Cours" },
            { key: "LAST_MONTH", label: "Mois Précédent" },
            { key: "QUARTER", label: "Trimestre" },
            { key: "YEAR", label: "Année en Cours" },
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => handlePeriodChange(p.key)}
              disabled={isPending}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                selectedPeriod === p.key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-white bg-neutral-950/60"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Financial Executive Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Chiffre d'Affaires Encaissé
            </span>
            <span className="p-2 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2 font-mono">
            {data.finance.totalCollected.toLocaleString("fr-FR")}{" "}
            <span className="text-sm font-normal text-emerald-500/80">DA</span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Facturé : {data.finance.totalInvoiced.toLocaleString("fr-FR")} DA
          </p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Dépenses & Coûts Engagés
            </span>
            <span className="p-2 rounded-xl bg-amber-950/60 text-amber-400 border border-amber-800/40">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2 font-mono">
            {data.finance.totalCosts.toLocaleString("fr-FR")}{" "}
            <span className="text-sm font-normal text-amber-500/80">DA</span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">Achats, freelances & SaaS</p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              Marge Nette Globale
            </span>
            <span className="p-2 rounded-xl bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
              <PieChart className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-neutral-100 mt-2 font-mono">
            {data.finance.netAgencyProfit.toLocaleString("fr-FR")}{" "}
            <span className="text-sm font-normal text-neutral-400">DA</span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">Bénéfice net réalisé</p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Taux de Rentabilité
            </span>
            <span className="p-2 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2 font-mono">
            {data.finance.globalMarginRate}%
          </div>
          <p className="text-xs text-neutral-400 mt-1">Rentabilité nette globale</p>
        </div>
      </div>

      {/* Grid: Commercial & Production Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Commercial Overview */}
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2 font-bold text-neutral-200">
              <Users className="w-5 h-5 text-indigo-400" />
              Entonnoir Commercial
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">
              {data.commercial.commercialConversionRate}% de conversion globale
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-800 space-y-1">
              <div className="text-xs text-neutral-400">Prospects Réceptionnés</div>
              <div className="text-xl font-bold font-mono text-neutral-100">
                {data.commercial.totalProspects}
              </div>
            </div>
            <div className="bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-800 space-y-1">
              <div className="text-xs text-neutral-400">Clients Signés / Closés</div>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {data.commercial.convertedClients}
              </div>
            </div>
            <div className="bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-800 space-y-1">
              <div className="text-xs text-neutral-400">Appels Passés</div>
              <div className="text-xl font-bold font-mono text-neutral-100">
                {data.commercial.totalCalls}
              </div>
              <div className="text-[11px] text-neutral-400">
                {data.commercial.callSuccessRate}% d'intérêt
              </div>
            </div>
            <div className="bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-800 space-y-1">
              <div className="text-xs text-neutral-400">Rendez-vous Effectués</div>
              <div className="text-xl font-bold font-mono text-neutral-100">
                {data.commercial.completedAppointments} / {data.commercial.totalAppointments}
              </div>
            </div>
          </div>
        </div>

        {/* Production Overview */}
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2 font-bold text-neutral-200">
              <Briefcase className="w-5 h-5 text-indigo-400" />
              Vélocité de Production
            </div>
            <span className="text-xs font-mono font-bold text-indigo-400">
              {data.production.taskCompletionRate}% de tâches livrées
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-800 space-y-1">
              <div className="text-xs text-neutral-400">Projets en Production</div>
              <div className="text-xl font-bold font-mono text-neutral-100">
                {data.production.activeProjects}
              </div>
            </div>
            <div className="bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-800 space-y-1">
              <div className="text-xs text-neutral-400">Projets Terminés</div>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {data.production.completedProjects}
              </div>
            </div>
            <div className="bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-800 space-y-1 col-span-2">
              <div className="flex justify-between text-xs text-neutral-400 mb-1">
                <span>Avancement Global des Livrables</span>
                <span className="font-mono">
                  {data.production.completedTasks} / {data.production.totalTasks} tâches
                </span>
              </div>
              <div className="w-full bg-neutral-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-500 h-full"
                  style={{ width: `${data.production.taskCompletionRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Commercial Leaderboard */}
      <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 bg-neutral-950/40 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-neutral-200 text-sm">
            <Target className="w-4 h-4 text-indigo-400" />
            Classement de Performance des Commerciaux
          </div>
          <span className="text-xs text-neutral-400">
            Trié par chiffre d'affaires généré
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 text-xs uppercase font-semibold">
                <th className="py-3 px-4">Rang</th>
                <th className="py-3 px-4">Commercial</th>
                <th className="py-3 px-4 text-center">Appels Passés</th>
                <th className="py-3 px-4 text-center">Rendez-vous</th>
                <th className="py-3 px-4 text-center">Clients Closés</th>
                <th className="py-3 px-4 text-right">CA Mensuel Signé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {data.salesLeaderboard.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-neutral-400">
                    Aucune activité commerciale sur cette période.
                  </td>
                </tr>
              ) : (
                data.salesLeaderboard.map((s, idx) => (
                  <tr key={s.name} className="hover:bg-neutral-800/30 transition">
                    <td className="py-3 px-4 font-mono font-bold text-neutral-400 text-xs">
                      #{idx + 1}
                    </td>
                    <td className="py-3 px-4 font-semibold text-neutral-200">
                      {s.name}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-neutral-300">
                      {s.callsCount}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-neutral-300">
                      {s.meetingsCount}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">
                      {s.clientsSigned}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-indigo-400">
                      {s.revenueGenerated.toLocaleString("fr-FR")} DA
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
