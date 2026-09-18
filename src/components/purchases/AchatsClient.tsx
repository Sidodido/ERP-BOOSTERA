"use client";

import React, { useState, useTransition } from "react";
import {
  ShoppingCart,
  Plus,
  Receipt,
  Repeat,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  CreditCard,
  Building2,
} from "lucide-react";
import {
  createPurchaseOrderAction,
  updatePurchaseOrderStatusAction,
  createToolSubscriptionAction,
  updateToolSubscriptionAction,
  createExpenseAction,
} from "@/actions/purchases";
import { PaymentMethod } from "@prisma/client";

interface OrderItem {
  id: string;
  amount: number;
  category: string;
  status: string;
  orderedAt: Date | string;
  supplier: { id: string; name: string; company?: string | null; category: string };
  project?: { id: string; name: string; code: string } | null;
}

interface SubscriptionItem {
  id: string;
  name: string;
  category: string;
  monthlyCost: number;
  renewalDate: Date | string;
  paymentCard?: string | null;
  status: string;
  manager?: { id: string; name: string } | null;
}

interface ExpenseItem {
  id: string;
  category: string;
  amount: number;
  date: Date | string;
  description: string;
  paymentMethod: PaymentMethod;
  projectId?: string | null;
}

interface AchatsClientProps {
  orders: OrderItem[];
  subscriptions: SubscriptionItem[];
  expenses: ExpenseItem[];
  suppliers: { id: string; name: string; category: string }[];
  projects: { id: string; name: string; code: string }[];
  kpis: {
    totalOrdersAmount: number;
    totalMonthlySaaS: number;
    totalExpenses: number;
    activeSubscriptionsCount: number;
  };
}

export function AchatsClient({
  orders,
  subscriptions,
  expenses,
  suppliers,
  projects,
  kpis,
}: AchatsClientProps) {
  const [activeTab, setActiveTab] = useState<"ORDERS" | "SUBSCRIPTIONS" | "EXPENSES">(
    "ORDERS"
  );
  const [isPending, startTransition] = useTransition();

  // Modals
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // New Order
  const [orderSupplierId, setOrderSupplierId] = useState("");
  const [orderProjectId, setOrderProjectId] = useState("");
  const [orderAmount, setOrderAmount] = useState<number>(15000);
  const [orderCategory, setOrderCategory] = useState("Production Vidéo");

  // New Subscription
  const [subName, setSubName] = useState("Canva Pro");
  const [subCategory, setSubCategory] = useState("Design");
  const [subCost, setSubCost] = useState<number>(3500);
  const [subRenewal, setSubRenewal] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [subCard, setSubCard] = useState("Carte Agence ****4421");

  // New Expense
  const [expCategory, setExpCategory] = useState("Marketing & Ads");
  const [expAmount, setExpAmount] = useState<number>(5000);
  const [expDesc, setExpDesc] = useState("");
  const [expMethod, setExpMethod] = useState<PaymentMethod>("CASH");
  const [expProjectId, setExpProjectId] = useState("");

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderSupplierId || orderAmount <= 0) {
      alert("Fournisseur et montant requis");
      return;
    }

    startTransition(async () => {
      try {
        await createPurchaseOrderAction({
          supplierId: orderSupplierId,
          projectId: orderProjectId || undefined,
          amount: orderAmount,
          category: orderCategory,
        });
        setShowOrderModal(false);
        window.location.reload();
      } catch (err: any) {
        alert(err.message || "Erreur de création de commande");
      }
    });
  };

  const handleUpdateOrderStatus = (id: string, status: string) => {
    startTransition(async () => {
      try {
        await updatePurchaseOrderStatusAction(id, status);
        window.location.reload();
      } catch (err: any) {
        alert(err.message || "Erreur");
      }
    });
  };

  const handleCreateSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName.trim() || subCost <= 0) {
      alert("Champs requis manquants");
      return;
    }

    startTransition(async () => {
      try {
        await createToolSubscriptionAction({
          name: subName,
          category: subCategory,
          monthlyCost: subCost,
          renewalDate: subRenewal,
          paymentCard: subCard,
        });
        setShowSubModal(false);
        window.location.reload();
      } catch (err: any) {
        alert(err.message || "Erreur");
      }
    });
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expDesc.trim() || expAmount <= 0) {
      alert("Description et montant requis");
      return;
    }

    startTransition(async () => {
      try {
        await createExpenseAction({
          category: expCategory,
          amount: expAmount,
          description: expDesc,
          paymentMethod: expMethod,
          projectId: expProjectId || undefined,
        });
        setShowExpenseModal(false);
        window.location.reload();
      } catch (err: any) {
        alert(err.message || "Erreur");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2.5">
            <ShoppingCart className="w-7 h-7 text-indigo-400" />
            Achats, Dépenses & Abonnements Logiciels
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Approvisionnement, abonnements SaaS (Canva, Adobe, ChatGPT) et dépenses de l'agence.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowExpenseModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-medium transition"
          >
            <DollarSign className="w-4 h-4" /> Nouvelle Dépense
          </button>
          <button
            onClick={() => setShowSubModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-medium transition"
          >
            <Repeat className="w-4 h-4" /> Nouvel Outil SaaS
          </button>
          <button
            onClick={() => setShowOrderModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" /> Bon de Commande
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Bons de Commande
            </span>
            <span className="p-2 rounded-xl bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
              <ShoppingCart className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-neutral-100 mt-2 font-mono">
            {kpis.totalOrdersAmount.toLocaleString("fr-FR")}{" "}
            <span className="text-sm font-normal text-neutral-400">DA</span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">{orders.length} commandes prestataires</p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              Abonnements SaaS / Mois
            </span>
            <span className="p-2 rounded-xl bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
              <Repeat className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-indigo-400 mt-2 font-mono">
            {kpis.totalMonthlySaaS.toLocaleString("fr-FR")}{" "}
            <span className="text-sm font-normal text-indigo-400/80">DA</span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            {kpis.activeSubscriptionsCount} licences actives
          </p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Dépenses Générales
            </span>
            <span className="p-2 rounded-xl bg-amber-950/60 text-amber-400 border border-amber-800/40">
              <Receipt className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2 font-mono">
            {kpis.totalExpenses.toLocaleString("fr-FR")}{" "}
            <span className="text-sm font-normal text-amber-400/80">DA</span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">{expenses.length} dépenses enregistrées</p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Total Achats Engagés
            </span>
            <span className="p-2 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2 font-mono">
            {(kpis.totalOrdersAmount + kpis.totalExpenses).toLocaleString("fr-FR")}{" "}
            <span className="text-sm font-normal text-emerald-500/80">DA</span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">Coûts opérationnels agence</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
        <button
          onClick={() => setActiveTab("ORDERS")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "ORDERS"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          Bons de Commande Fournisseurs ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab("SUBSCRIPTIONS")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "SUBSCRIPTIONS"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          Abonnements Logiciels SaaS ({subscriptions.length})
        </button>
        <button
          onClick={() => setActiveTab("EXPENSES")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "EXPENSES"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          Dépenses Générales ({expenses.length})
        </button>
      </div>

      {/* TAB 1: PURCHASE ORDERS */}
      {activeTab === "ORDERS" && (
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 text-xs uppercase font-semibold">
                  <th className="py-3.5 px-4">Fournisseur</th>
                  <th className="py-3.5 px-4">Catégorie</th>
                  <th className="py-3.5 px-4">Projet Imputé</th>
                  <th className="py-3.5 px-4">Date Commande</th>
                  <th className="py-3.5 px-4 text-right">Montant</th>
                  <th className="py-3.5 px-4 text-center">Statut</th>
                  <th className="py-3.5 px-4 text-right">Action Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-neutral-400">
                      Aucun bon de commande enregistré.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="hover:bg-neutral-800/30 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-neutral-200">
                          {o.supplier.name}
                        </div>
                        {o.supplier.company && (
                          <div className="text-xs text-neutral-400">
                            {o.supplier.company}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-neutral-300">
                        {o.category}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-indigo-400">
                        {o.project ? `${o.project.code} - ${o.project.name}` : "—"}
                      </td>
                      <td className="py-3 px-4 text-xs text-neutral-400 font-mono">
                        {new Date(o.orderedAt).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-neutral-200">
                        {o.amount.toLocaleString("fr-FR")} DA
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            o.status === "PAID"
                              ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                              : o.status === "ORDERED"
                              ? "bg-indigo-950/60 text-indigo-400 border border-indigo-800/40"
                              : "bg-amber-950/60 text-amber-400 border border-amber-800/40"
                          }`}
                        >
                          {o.status === "PAID"
                            ? "Payé"
                            : o.status === "ORDERED"
                            ? "Commandé"
                            : o.status === "RECEIVED"
                            ? "Livré"
                            : o.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <select
                          value={o.status}
                          onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)}
                          className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-neutral-300"
                        >
                          <option value="REQUESTED">Demandé</option>
                          <option value="APPROVED">Validé</option>
                          <option value="ORDERED">Commandé</option>
                          <option value="RECEIVED">Livré</option>
                          <option value="PAID">Payé</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SAAS SUBSCRIPTIONS */}
      {activeTab === "SUBSCRIPTIONS" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {subscriptions.map((sub) => {
            const daysLeft = Math.ceil(
              (new Date(sub.renewalDate).getTime() - new Date().getTime()) /
                (1000 * 60 * 60 * 24)
            );
            const isSoon = daysLeft <= 7 && daysLeft >= 0;

            return (
              <div
                key={sub.id}
                className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-neutral-100 text-base">{sub.name}</h3>
                    <span className="text-xs text-neutral-400">{sub.category}</span>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      sub.status === "ACTIVE"
                        ? "bg-emerald-950/60 text-emerald-400"
                        : "bg-neutral-800 text-neutral-400"
                    }`}
                  >
                    {sub.status === "ACTIVE" ? "Actif" : "En pause"}
                  </span>
                </div>

                <div className="pt-2 border-t border-neutral-800/60 flex items-baseline justify-between">
                  <span className="text-xs text-neutral-400">Coût Mensuel :</span>
                  <span className="font-mono font-black text-lg text-indigo-400">
                    {sub.monthlyCost.toLocaleString("fr-FR")} DA
                  </span>
                </div>

                <div className="text-xs space-y-1 text-neutral-400">
                  <div className="flex justify-between">
                    <span>Renouvellement :</span>
                    <span
                      className={`font-mono ${
                        isSoon ? "text-amber-400 font-bold" : "text-neutral-300"
                      }`}
                    >
                      {new Date(sub.renewalDate).toLocaleDateString("fr-FR")} ({daysLeft}j)
                    </span>
                  </div>
                  {sub.paymentCard && (
                    <div className="flex justify-between text-neutral-500">
                      <span>Carte débitée :</span>
                      <span>{sub.paymentCard}</span>
                    </div>
                  )}
                </div>

                {isSoon && (
                  <div className="bg-amber-950/40 border border-amber-800/40 rounded-xl p-2 text-xs text-amber-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Renouvellement automatique imminent.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: GENERAL EXPENSES */}
      {activeTab === "EXPENSES" && (
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 text-xs uppercase font-semibold">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4">Catégorie</th>
                  <th className="py-3.5 px-4">Moyen de Paiement</th>
                  <th className="py-3.5 px-4 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-neutral-400">
                      Aucune dépense enregistrée.
                    </td>
                  </tr>
                ) : (
                  expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-neutral-800/30 transition">
                      <td className="py-3 px-4 font-mono text-xs text-neutral-400">
                        {new Date(e.date).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="py-3 px-4 font-semibold text-neutral-200">
                        {e.description}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-neutral-800 text-neutral-300">
                          {e.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-neutral-400 font-mono">
                        {e.paymentMethod}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                        {e.amount.toLocaleString("fr-FR")} DA
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: NEW ORDER */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-neutral-100">
                  Nouveau Bon de Commande
                </h3>
              </div>
              <button
                onClick={() => setShowOrderModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Fournisseur / Prestataire *
                </label>
                <select
                  value={orderSupplierId}
                  onChange={(e) => setOrderSupplierId(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Sélectionner un fournisseur...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Montant de la Commande (DA) *
                  </label>
                  <input
                    type="number"
                    min="500"
                    step="500"
                    value={orderAmount}
                    onChange={(e) => setOrderAmount(Number(e.target.value))}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Catégorie de Prestation *
                  </label>
                  <input
                    type="text"
                    value={orderCategory}
                    onChange={(e) => setOrderCategory(e.target.value)}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Imputer à un Projet Client (Optionnel)
                </label>
                <select
                  value={orderProjectId}
                  onChange={(e) => setOrderProjectId(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Frais Général Agence</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isPending ? "Création..." : "Émettre le Bon de Commande"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW SUBSCRIPTION */}
      {showSubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <div className="flex items-center gap-2.5">
                <Repeat className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-neutral-100">
                  Ajouter un Abonnement Logiciel SaaS
                </h3>
              </div>
              <button
                onClick={() => setShowSubModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSub} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Nom du Logiciel / Outil *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Adobe Creative Cloud, ChatGPT Plus..."
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Coût Mensuel (DA) *
                  </label>
                  <input
                    type="number"
                    min="500"
                    step="500"
                    value={subCost}
                    onChange={(e) => setSubCost(Number(e.target.value))}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Prochain Renouvellement *
                  </label>
                  <input
                    type="date"
                    value={subRenewal}
                    onChange={(e) => setSubRenewal(e.target.value)}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Carte ou Mode de Paiement
                </label>
                <input
                  type="text"
                  value={subCard}
                  onChange={(e) => setSubCard(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSubModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isPending ? "Ajout..." : "Enregistrer l'Abonnement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW EXPENSE */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <div className="flex items-center gap-2.5">
                <DollarSign className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-neutral-100">
                  Nouvelle Dépense Générale
                </h3>
              </div>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Description de la dépense *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Campagne Facebook Ads, Abonnement Internet..."
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Montant (DA) *
                  </label>
                  <input
                    type="number"
                    min="500"
                    step="500"
                    value={expAmount}
                    onChange={(e) => setExpAmount(Number(e.target.value))}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Catégorie *
                  </label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Marketing & Ads">Marketing & Ads</option>
                    <option value="Production">Production & Tournage</option>
                    <option value="Locaux & Loyer">Locaux & Loyer</option>
                    <option value="Informatique & Tech">Informatique & Tech</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Moyen de Paiement *
                </label>
                <select
                  value={expMethod}
                  onChange={(e) => setExpMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="CASH">Espèces (Cash)</option>
                  <option value="BARIDIMOB">BaridiMob</option>
                  <option value="BANK_TRANSFER">Virement Bancaire</option>
                  <option value="CARD">Carte Bancaire</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isPending ? "Enregistrement..." : "Valider la Dépense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
