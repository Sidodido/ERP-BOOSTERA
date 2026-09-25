"use client";

import React, { useState, useTransition } from "react";
import {
  CreditCard,
  Plus,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
  DollarSign,
  Share2,
  X,
} from "lucide-react";
import {
  recordPaymentAction,
  createPaymentScheduleAction,
  createSponsorCampaignAction,
  updateSponsorCampaignAction,
} from "@/actions/finance";
import { PaymentMethod, PaymentType } from "@prisma/client";

interface PaymentItem {
  id: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentType: PaymentType;
  reference?: string | null;
  paymentDate: Date | string;
  notes?: string | null;
  client: { id: string; companyName: string; contactName?: string | null; phone: string };
  invoice?: { id: string; invoiceNumber: string; total: number; balanceDue: number } | null;
  recordedBy?: { id: string; name: string } | null;
}

interface ScheduleItem {
  id: string;
  dueDate: Date | string;
  amount: number;
  status: string;
  alertSentJ7: boolean;
  alertSentJ1: boolean;
  client: { id: string; companyName: string; phone: string };
  invoice?: { id: string; invoiceNumber: string } | null;
}

interface SponsorItem {
  id: string;
  platform: string;
  budget: number;
  durationDays: number;
  startDate: Date | string;
  endDate: Date | string;
  amountPaid: number;
  remaining: number;
  status: string;
  client: { id: string; companyName: string };
}

interface ClientOption {
  id: string;
  companyName: string;
  contactName?: string | null;
  invoices: { id: string; invoiceNumber: string; balanceDue: number; total: number }[];
}

interface FinanceClientProps {
  kpis: {
    totalRevenueCollected: number;
    currentMonthCollected: number;
    totalReceivables: number;
    overdueReceivables: number;
  };
  methodBreakdown: Record<PaymentMethod, number>;
  payments: PaymentItem[];
  schedules: ScheduleItem[];
  sponsorCampaigns: SponsorItem[];
  clients: ClientOption[];
}

const METHOD_LABELS: Record<PaymentMethod, { label: string; color: string; bg: string }> = {
  BARIDIMOB: { label: "BaridiMob", color: "text-amber-400", bg: "bg-amber-500/20" },
  CASH: { label: "Espèces (Cash)", color: "text-emerald-400", bg: "bg-emerald-500/20" },
  BANK_TRANSFER: { label: "Virement Bancaire", color: "text-blue-400", bg: "bg-blue-500/20" },
  CARD: { label: "Carte Bancaire / CIB", color: "text-purple-400", bg: "bg-purple-500/20" },
  OTHER: { label: "Autre", color: "text-neutral-400", bg: "bg-neutral-500/20" },
};

export function FinanceClient({
  kpis,
  methodBreakdown,
  payments,
  schedules,
  sponsorCampaigns,
  clients,
}: FinanceClientProps) {
  const [activeTab, setActiveTab] = useState<"TRANSACTIONS" | "SCHEDULE" | "SPONSOR">(
    "TRANSACTIONS"
  );
  const [isPending, startTransition] = useTransition();

  // Modals
  const [showPayModal, setShowPayModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showSponsorModal, setShowSponsorModal] = useState(false);

  // New Payment Form
  const [payClientId, setPayClientId] = useState("");
  const [payInvoiceId, setPayInvoiceId] = useState("");
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("BARIDIMOB");
  const [payType, setPayType] = useState<PaymentType>("MONTHLY_SUBSCRIPTION");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");

  // New Schedule Form
  const [schClientId, setSchClientId] = useState("");
  const [schDueDate, setSchDueDate] = useState("");
  const [schAmount, setSchAmount] = useState<number>(0);

  // New Sponsor Form
  const [spClientId, setSpClientId] = useState("");
  const [spPlatform, setSpPlatform] = useState("Facebook Ads");
  const [spBudget, setSpBudget] = useState<number>(20000);
  const [spDays, setSpDays] = useState<number>(30);
  const [spPaid, setSpPaid] = useState<number>(20000);
  const [spStartDate, setSpStartDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [spEndDate, setSpEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });

  const selectedClientData = clients.find((c) => c.id === payClientId);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payClientId || payAmount <= 0) {
      alert("Veuillez sélectionner un client et spécifier un montant positif.");
      return;
    }

    startTransition(async () => {
      try {
        await recordPaymentAction({
          clientId: payClientId,
          invoiceId: payInvoiceId || undefined,
          amount: payAmount,
          paymentMethod: payMethod,
          paymentType: payType,
          reference: payRef,
          notes: payNotes,
        });
        setShowPayModal(false);
        window.location.reload();
      } catch (err: any) {
        alert(err.message || "Erreur d'encaissement");
      }
    });
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schClientId || !schDueDate || schAmount <= 0) {
      alert("Champs obligatoires manquants.");
      return;
    }

    startTransition(async () => {
      try {
        await createPaymentScheduleAction({
          clientId: schClientId,
          dueDate: schDueDate,
          amount: schAmount,
        });
        setShowScheduleModal(false);
        window.location.reload();
      } catch (err: any) {
        alert(err.message || "Erreur de création de l'échéance");
      }
    });
  };

  const handleCreateSponsor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spClientId || spBudget <= 0) {
      alert("Champs obligatoires manquants.");
      return;
    }

    startTransition(async () => {
      try {
        await createSponsorCampaignAction({
          clientId: spClientId,
          platform: spPlatform,
          budget: spBudget,
          durationDays: spDays,
          startDate: spStartDate,
          endDate: spEndDate,
          amountPaid: spPaid,
        });
        setShowSponsorModal(false);
        window.location.reload();
      } catch (err: any) {
        alert(err.message || "Erreur de création de la campagne");
      }
    });
  };

  const totalMethodsSum = Object.values(methodBreakdown).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2.5">
            <CreditCard className="w-7 h-7 text-emerald-400" />
            Module Finance & Trésorerie
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Suivi des encaissements (BaridiMob, Cash, Virement), échéancier et budgets sponsors.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowScheduleModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-medium transition"
          >
            <Calendar className="w-4 h-4" />
            Nouvelle Échéance
          </button>
          <button
            onClick={() => setShowPayModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition shadow-lg shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" />
            Encaisser un Paiement
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Total Encaissé
            </span>
            <span className="p-2 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2 font-mono">
            {kpis.totalRevenueCollected.toLocaleString("fr-FR")}{" "}
            <span className="text-sm font-normal text-emerald-500/80">DA</span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">Chiffre d'affaires perçu</p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              Encaissé Ce Mois
            </span>
            <span className="p-2 rounded-xl bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-indigo-400 mt-2 font-mono">
            {kpis.currentMonthCollected.toLocaleString("fr-FR")}{" "}
            <span className="text-sm font-normal text-indigo-400/80">DA</span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">Mois en cours</p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Créances Clients
            </span>
            <span className="p-2 rounded-xl bg-amber-950/60 text-amber-400 border border-amber-800/40">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2 font-mono">
            {kpis.totalReceivables.toLocaleString("fr-FR")}{" "}
            <span className="text-sm font-normal text-amber-400/80">DA</span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">Reste à recouvrer</p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
              Créances en Retard
            </span>
            <span className="p-2 rounded-xl bg-rose-950/60 text-rose-400 border border-rose-800/40">
              <AlertCircle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-rose-400 mt-2 font-mono">
            {kpis.overdueReceivables.toLocaleString("fr-FR")}{" "}
            <span className="text-sm font-normal text-rose-400/80">DA</span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">Échéances dépassées</p>
        </div>
      </div>

      {/* Payment Methods Breakdown Card */}
      <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-5 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-4 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-400" />
          Répartition des Règlements par Canal de Paiement
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(["BARIDIMOB", "CASH", "BANK_TRANSFER", "CARD"] as PaymentMethod[]).map(
            (m) => {
              const amount = methodBreakdown[m] || 0;
              const pct =
                totalMethodsSum > 0
                  ? Math.round((amount / totalMethodsSum) * 100)
                  : 0;
              const cfg = METHOD_LABELS[m];

              return (
                <div
                  key={m}
                  className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs font-mono font-bold text-neutral-400">
                      {pct}%
                    </span>
                  </div>
                  <div className="text-lg font-mono font-bold text-neutral-100">
                    {amount.toLocaleString("fr-FR")}{" "}
                    <span className="text-xs font-normal text-neutral-500">DA</span>
                  </div>
                  <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${cfg.bg} ${cfg.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* Submodules Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("TRANSACTIONS")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === "TRANSACTIONS"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
            }`}
          >
            Grand Livre des Encaissements ({payments.length})
          </button>
          <button
            onClick={() => setActiveTab("SCHEDULE")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === "SCHEDULE"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
            }`}
          >
            Échéancier Financier ({schedules.length})
          </button>
          <button
            onClick={() => setActiveTab("SPONSOR")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === "SPONSOR"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
            }`}
          >
            Campagnes Sponsors ({sponsorCampaigns.length})
          </button>
        </div>

        {activeTab === "SPONSOR" && (
          <button
            onClick={() => setShowSponsorModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
          >
            <Plus className="w-3.5 h-3.5" /> Nouvelle Campagne Sponsor
          </button>
        )}
      </div>

      {/* TAB 1: TRANSACTIONS TABLE */}
      {activeTab === "TRANSACTIONS" && (
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 text-xs uppercase font-semibold">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Client</th>
                  <th className="py-3.5 px-4">Facture Rattachée</th>
                  <th className="py-3.5 px-4">Moyen de Règlement</th>
                  <th className="py-3.5 px-4">Référence</th>
                  <th className="py-3.5 px-4 text-right">Montant Encaissé</th>
                  <th className="py-3.5 px-4">Enregistré Par</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-neutral-400">
                      Aucune transaction d'encaissement enregistrée.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => {
                    const cfg = METHOD_LABELS[p.paymentMethod] || METHOD_LABELS.OTHER;
                    return (
                      <tr key={p.id} className="hover:bg-neutral-800/30 transition">
                        <td className="py-3 px-4 font-mono text-xs text-neutral-400">
                          {new Date(p.paymentDate).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-neutral-200">
                            {p.client.companyName}
                          </div>
                          <div className="text-xs text-neutral-400 font-mono">
                            {p.client.phone}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-neutral-300">
                          {p.invoice ? (
                            <span className="text-indigo-400">
                              {p.invoice.invoiceNumber}
                            </span>
                          ) : (
                            <span className="text-neutral-500">Paiement Direct</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cfg.bg} ${cfg.color}`}
                          >
                            {cfg.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-neutral-400">
                          {p.reference || "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                          +{p.amount.toLocaleString("fr-FR")} DA
                        </td>
                        <td className="py-3 px-4 text-xs text-neutral-400">
                          {p.recordedBy?.name || "Système"}
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

      {/* TAB 2: SCHEDULE TABLE */}
      {activeTab === "SCHEDULE" && (
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 text-xs uppercase font-semibold">
                  <th className="py-3.5 px-4">Date d'Échéance</th>
                  <th className="py-3.5 px-4">Client</th>
                  <th className="py-3.5 px-4">Facture</th>
                  <th className="py-3.5 px-4 text-right">Montant Attendu</th>
                  <th className="py-3.5 px-4 text-center">Statut</th>
                  <th className="py-3.5 px-4 text-center">Alertes J-7 / J-1</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {schedules.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-neutral-400">
                      Aucun échéancier programmé. Cliquez sur "Nouvelle Échéance" pour en créer une.
                    </td>
                  </tr>
                ) : (
                  schedules.map((s) => {
                    const isLate =
                      s.status === "PENDING" && new Date(s.dueDate) < new Date();
                    return (
                      <tr key={s.id} className="hover:bg-neutral-800/30 transition">
                        <td className="py-3 px-4 font-mono text-xs text-neutral-300">
                          {new Date(s.dueDate).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="py-3 px-4 font-semibold text-neutral-200">
                          {s.client.companyName}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-neutral-400">
                          {s.invoice?.invoiceNumber || "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                          {s.amount.toLocaleString("fr-FR")} DA
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                              s.status === "PAID"
                                ? "bg-emerald-950 text-emerald-400"
                                : isLate
                                ? "bg-rose-950 text-rose-400"
                                : "bg-amber-950 text-amber-400"
                            }`}
                          >
                            {s.status === "PAID"
                              ? "Réglée"
                              : isLate
                              ? "En Retard"
                              : "En Attente"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-xs">
                          <span className="text-neutral-500">Auto-programmée</span>
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

      {/* TAB 3: SPONSOR CAMPAIGNS */}
      {activeTab === "SPONSOR" && (
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 text-xs uppercase font-semibold">
                  <th className="py-3.5 px-4">Client</th>
                  <th className="py-3.5 px-4">Plateforme</th>
                  <th className="py-3.5 px-4">Période</th>
                  <th className="py-3.5 px-4 text-right">Budget Total</th>
                  <th className="py-3.5 px-4 text-right">Payé par Client</th>
                  <th className="py-3.5 px-4 text-right">Reste Dû</th>
                  <th className="py-3.5 px-4 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {sponsorCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-neutral-400">
                      Aucune campagne sponsorisée enregistrée.
                    </td>
                  </tr>
                ) : (
                  sponsorCampaigns.map((sc) => (
                    <tr key={sc.id} className="hover:bg-neutral-800/30 transition">
                      <td className="py-3 px-4 font-semibold text-neutral-200">
                        {sc.client.companyName}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
                          {sc.platform}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-neutral-400">
                        {new Date(sc.startDate).toLocaleDateString("fr-FR")} →{" "}
                        {new Date(sc.endDate).toLocaleDateString("fr-FR")} ({sc.durationDays}j)
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-neutral-200">
                        {sc.budget.toLocaleString("fr-FR")} DA
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400">
                        {sc.amountPaid.toLocaleString("fr-FR")} DA
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-amber-400">
                        {sc.remaining.toLocaleString("fr-FR")} DA
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950/50 text-emerald-400 border border-emerald-800/30">
                          {sc.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: RECORD PAYMENT */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-neutral-100">
                  Enregistrer un Encaissement
                </h3>
              </div>
              <button
                onClick={() => setShowPayModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Client *
                </label>
                <select
                  value={payClientId}
                  onChange={(e) => {
                    setPayClientId(e.target.value);
                    setPayInvoiceId("");
                  }}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Sélectionner un client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName} {c.contactName ? `(${c.contactName})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {selectedClientData && selectedClientData.invoices.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Facture Rattachée (Optionnel)
                  </label>
                  <select
                    value={payInvoiceId}
                    onChange={(e) => {
                      setPayInvoiceId(e.target.value);
                      const inv = selectedClientData.invoices.find(
                        (i) => i.id === e.target.value
                      );
                      if (inv) setPayAmount(inv.balanceDue);
                    }}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Aucune (Encaissement global libre)</option>
                    {selectedClientData.invoices.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.invoiceNumber} — Solde restant : {i.balanceDue.toLocaleString("fr-FR")} DA
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Montant Encaissé (DA) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Moyen de Règlement *
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="BARIDIMOB">BaridiMob</option>
                    <option value="CASH">Espèces (Cash)</option>
                    <option value="BANK_TRANSFER">Virement Bancaire</option>
                    <option value="CARD">Carte Bancaire</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Type d'Encaissement
                </label>
                <select
                  value={payType}
                  onChange={(e) => setPayType(e.target.value as PaymentType)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="MONTHLY_SUBSCRIPTION">Abonnement Mensuel</option>
                  <option value="SPONSOR_FACEBOOK">Budget Sponsor Facebook</option>
                  <option value="SPONSOR_TIKTOK">Budget Sponsor TikTok</option>
                  <option value="SPONSOR_INSTAGRAM">Budget Sponsor Instagram</option>
                  <option value="CONTENT_CREATION">Création de Contenu / Tournage</option>
                  <option value="WEBSITE">Site Web & Développement</option>
                  <option value="RENEWAL">Renouvellement</option>
                  <option value="OTHER">Autre</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Référence de Transaction
                </label>
                <input
                  type="text"
                  placeholder="Ex: RIP BaridiMob, N° de bordereau..."
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isPending ? "Validation..." : "Valider l'Encaissement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW SCHEDULE */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-neutral-100">
                  Nouvelle Échéance Financière
                </h3>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Client *
                </label>
                <select
                  value={schClientId}
                  onChange={(e) => setSchClientId(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Sélectionner...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Date d'Échéance *
                </label>
                <input
                  type="date"
                  value={schDueDate}
                  onChange={(e) => setSchDueDate(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Montant Attendu (DA) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={schAmount}
                  onChange={(e) => setSchAmount(Number(e.target.value))}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isPending ? "Création..." : "Programmer l'Échéance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW SPONSOR */}
      {showSponsorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <div className="flex items-center gap-2.5">
                <Share2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-neutral-100">
                  Nouvelle Campagne Sponsorisée
                </h3>
              </div>
              <button
                onClick={() => setShowSponsorModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSponsor} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Client *
                </label>
                <select
                  value={spClientId}
                  onChange={(e) => setSpClientId(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Sélectionner un client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Plateforme Ads *
                  </label>
                  <select
                    value={spPlatform}
                    onChange={(e) => setSpPlatform(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Facebook & Instagram Ads">Facebook & Instagram</option>
                    <option value="TikTok Ads">TikTok Ads</option>
                    <option value="Google Ads">Google Ads</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Budget Sponsor (DA) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={spBudget}
                    onChange={(e) => {
                      setSpBudget(Number(e.target.value));
                      setSpPaid(Number(e.target.value));
                    }}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Date Début *
                  </label>
                  <input
                    type="date"
                    value={spStartDate}
                    onChange={(e) => setSpStartDate(e.target.value)}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Date Fin *
                  </label>
                  <input
                    type="date"
                    value={spEndDate}
                    onChange={(e) => setSpEndDate(e.target.value)}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Montant Déjà Encaissé (DA)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={spPaid}
                  onChange={(e) => setSpPaid(Number(e.target.value))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSponsorModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isPending ? "Création..." : "Lancer la Campagne"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
