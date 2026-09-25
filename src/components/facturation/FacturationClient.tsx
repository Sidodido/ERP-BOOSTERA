"use client";

import React, { useState, useTransition } from "react";
import {
  Receipt,
  Plus,
  Search,
  Printer,
  CreditCard,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  X,
  TrendingUp,
  Building2,
  Calendar,
} from "lucide-react";
import {
  createInvoiceAction,
  updateInvoiceStatusAction,
  deleteInvoiceAction,
} from "@/actions/invoices";
import { recordPaymentAction } from "@/actions/finance";
import { InvoiceStatus, PaymentMethod } from "@prisma/client";

interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total?: number;
}

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  clientId: string;
  projectId?: string | null;
  issueDate: Date | string;
  dueDate: Date | string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: InvoiceStatus;
  notes?: string | null;
  client: {
    id: string;
    companyName: string;
    contactName?: string | null;
    phone: string;
    email?: string | null;
    address?: string | null;
    wilaya?: string | null;
  };
  project?: {
    id: string;
    name: string;
    code: string;
  } | null;
  items: InvoiceItem[];
  payments: {
    id: string;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentDate: Date | string;
    reference?: string | null;
    recordedBy?: { name: string } | null;
  }[];
}

interface FacturationClientProps {
  initialInvoices: InvoiceData[];
  kpis: {
    totalBilled: number;
    totalCollected: number;
    totalBalanceDue: number;
    overdueCount: number;
    totalInvoices: number;
  };
  clients: { id: string; companyName: string; contactName?: string | null; phone: string }[];
  userRole?: string;
}

const STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  DRAFT: {
    label: "Brouillon",
    bg: "bg-neutral-100 dark:bg-neutral-800/60",
    text: "text-neutral-700 dark:text-neutral-300",
    border: "border-neutral-200 dark:border-neutral-700",
  },
  SENT: {
    label: "Émise",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800/50",
  },
  PARTIAL: {
    label: "Partielle",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800/50",
  },
  PAID: {
    label: "Payée",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800/50",
  },
  OVERDUE: {
    label: "En retard",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-800/50",
  },
  CANCELLED: {
    label: "Annulée",
    bg: "bg-neutral-100 dark:bg-neutral-900/60",
    text: "text-neutral-500 dark:text-neutral-500",
    border: "border-neutral-200 dark:border-neutral-800",
  },
};

export function FacturationClient({
  initialInvoices,
  kpis,
  clients,
  userRole,
}: FacturationClientProps) {
  const [invoices, setInvoices] = useState<InvoiceData[]>(initialInvoices);
  const [activeStatus, setActiveStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);

  // New Invoice Form state
  const [newClientId, setNewClientId] = useState("");
  const [newDueDate, setNewDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [newTaxRate, setNewTaxRate] = useState<number>(0);
  const [newNotes, setNewNotes] = useState("");
  const [newItems, setNewItems] = useState<
    { description: string; quantity: number; unitPrice: number }[]
  >([{ description: "Abonnement Marketing & Contenu", quantity: 1, unitPrice: 35000 }]);

  // Payment Form state
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("BARIDIMOB");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");

  const filteredInvoices = invoices.filter((inv) => {
    if (activeStatus !== "ALL" && inv.status !== activeStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = inv.invoiceNumber.toLowerCase().includes(q);
      const matchClient = inv.client.companyName.toLowerCase().includes(q);
      const matchContact = inv.client.contactName?.toLowerCase().includes(q);
      return matchNum || matchClient || matchContact;
    }
    return true;
  });

  const handleAddItemLine = () => {
    setNewItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0 }]);
  };

  const handleRemoveItemLine = (idx: number) => {
    if (newItems.length <= 1) return;
    setNewItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleItemChange = (
    idx: number,
    field: "description" | "quantity" | "unitPrice",
    val: any
  ) => {
    setNewItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  const newSubtotal = newItems.reduce(
    (acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
    0
  );
  const newTaxAmount = (newSubtotal * (Number(newTaxRate) || 0)) / 100;
  const newTotal = newSubtotal + newTaxAmount;

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientId) {
      alert("Veuillez sélectionner un client.");
      return;
    }
    if (newItems.some((it) => !it.description.trim() || it.unitPrice <= 0)) {
      alert("Chaque ligne doit avoir une description et un prix unitaire supérieur à 0.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await createInvoiceAction({
          clientId: newClientId,
          dueDate: newDueDate,
          taxRate: newTaxRate,
          notes: newNotes,
          items: newItems,
        });
        if (res.success) {
          setShowCreateModal(false);
          window.location.reload();
        }
      } catch (err: any) {
        alert(err.message || "Erreur lors de la création");
      }
    });
  };

  const handleOpenPayment = (inv: InvoiceData) => {
    setSelectedInvoice(inv);
    setPayAmount(inv.balanceDue);
    setPayRef("");
    setPayNotes("");
    setShowPayModal(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    if (payAmount <= 0) {
      alert("Le montant doit être supérieur à 0 DA.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await recordPaymentAction({
          clientId: selectedInvoice.clientId,
          invoiceId: selectedInvoice.id,
          amount: payAmount,
          paymentMethod: payMethod,
          reference: payRef,
          notes: payNotes,
        });
        if (res.success) {
          setShowPayModal(false);
          window.location.reload();
        }
      } catch (err: any) {
        alert(err.message || "Erreur lors de l'encaissement");
      }
    });
  };

  const handleUpdateStatus = (id: string, status: InvoiceStatus) => {
    startTransition(async () => {
      try {
        await updateInvoiceStatusAction(id, status);
        setInvoices((prev) =>
          prev.map((inv) => (inv.id === id ? { ...inv, status } : inv))
        );
      } catch (err: any) {
        alert(err.message || "Erreur");
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette facture définitivement ?"))
      return;
    startTransition(async () => {
      try {
        await deleteInvoiceAction(id);
        setInvoices((prev) => prev.filter((inv) => inv.id !== id));
      } catch (err: any) {
        alert(err.message || "Erreur lors de la suppression");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2.5">
            <Receipt className="w-7 h-7 text-indigo-400" />
            Facturation & Devis
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Émission, suivi légal des factures et encaissements des clients HDZ SECURITY.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          Nouvelle Facture
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Total Facturé
            </span>
            <span className="p-2 rounded-xl bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
              <Receipt className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-neutral-100 mt-2 font-mono">
            {kpis.totalBilled.toLocaleString("fr-FR")} <span className="text-sm font-normal text-neutral-400">DA</span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            {kpis.totalInvoices} facture{kpis.totalInvoices > 1 ? "s" : ""} émises
          </p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Total Encaissé
            </span>
            <span className="p-2 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2 font-mono">
            {kpis.totalCollected.toLocaleString("fr-FR")} <span className="text-sm font-normal text-emerald-500/80">DA</span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            {kpis.totalBilled > 0
              ? Math.round((kpis.totalCollected / kpis.totalBilled) * 100)
              : 0}% du total facturé
          </p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Reste à Percevoir
            </span>
            <span className="p-2 rounded-xl bg-amber-950/60 text-amber-400 border border-amber-800/40">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2 font-mono">
            {kpis.totalBalanceDue.toLocaleString("fr-FR")} <span className="text-sm font-normal text-amber-500/80">DA</span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">Créances en attente</p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
              Factures en Retard
            </span>
            <span className="p-2 rounded-xl bg-rose-950/60 text-rose-400 border border-rose-800/40">
              <AlertCircle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-rose-400 mt-2 font-mono">
            {kpis.overdueCount}
          </div>
          <p className="text-xs text-neutral-400 mt-1">Nécessite relance financière</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { key: "ALL", label: "Toutes" },
            { key: "SENT", label: "Émises" },
            { key: "PARTIAL", label: "Partielles" },
            { key: "PAID", label: "Payées" },
            { key: "OVERDUE", label: "En retard" },
            { key: "DRAFT", label: "Brouillons" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveStatus(tab.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                activeStatus === tab.key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher facture, client..."
            className="w-full bg-neutral-950/60 border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-neutral-800/80 bg-neutral-950/40 text-neutral-400 text-xs uppercase font-semibold">
                <th className="py-3.5 px-4">N° Facture</th>
                <th className="py-3.5 px-4">Client</th>
                <th className="py-3.5 px-4">Émission / Échéance</th>
                <th className="py-3.5 px-4 text-right">Montant Total</th>
                <th className="py-3.5 px-4 text-right">Payé</th>
                <th className="py-3.5 px-4 text-right">Solde Dû</th>
                <th className="py-3.5 px-4 text-center">Statut</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 text-neutral-500 opacity-40" />
                    Aucune facture trouvée pour ces critères.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.DRAFT;
                  const isOverdue =
                    inv.status !== "PAID" &&
                    inv.status !== "CANCELLED" &&
                    new Date(inv.dueDate) < new Date();

                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-neutral-800/30 transition group"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-neutral-200">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-neutral-200">
                          {inv.client.companyName}
                        </div>
                        <div className="text-xs text-neutral-400">
                          {inv.client.contactName || inv.client.phone}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-neutral-400">
                        <div>{new Date(inv.issueDate).toLocaleDateString("fr-FR")}</div>
                        <div
                          className={`mt-0.5 ${
                            isOverdue ? "text-rose-400 font-semibold" : "text-neutral-500"
                          }`}
                        >
                          Éch: {new Date(inv.dueDate).toLocaleDateString("fr-FR")}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-neutral-200">
                        {inv.total.toLocaleString("fr-FR")} DA
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-emerald-400">
                        {inv.amountPaid.toLocaleString("fr-FR")} DA
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-400">
                        {inv.balanceDue.toLocaleString("fr-FR")} DA
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Print / View */}
                          <button
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setShowPrintModal(true);
                            }}
                            title="Aperçu & Impression Facture"
                            className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200 dark:bg-neutral-800/80 dark:hover:bg-neutral-700 dark:text-neutral-300 dark:hover:text-white dark:border-transparent transition"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Quick Payment */}
                          {inv.balanceDue > 0 && inv.status !== "CANCELLED" && (
                            <button
                              onClick={() => handleOpenPayment(inv)}
                              title="Encaisser un paiement"
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 dark:text-emerald-400 dark:border-emerald-800/50 transition"
                            >
                              <CreditCard className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete (Admin) */}
                          {(userRole === "ADMIN" || userRole === "SALES_DIRECTOR") && (
                            <button
                              onClick={() => handleDelete(inv.id)}
                              title="Supprimer"
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-400 dark:border-rose-800/40 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE INVOICE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-8">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <div className="flex items-center gap-2.5">
                <Receipt className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-neutral-100">
                  Créer une Facture HDZ SECURITY
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="p-6 space-y-6">
              {/* Client & Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Client Facturé *
                  </label>
                  <select
                    value={newClientId}
                    onChange={(e) => setNewClientId(e.target.value)}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Sélectionner un client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName} {c.contactName ? `(${c.contactName})` : ""}
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
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Items Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Lignes de Prestations *
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemLine}
                    className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
                  </button>
                </div>

                <div className="space-y-2">
                  {newItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-neutral-950/70 p-2.5 rounded-xl border border-neutral-800"
                    >
                      <input
                        type="text"
                        placeholder="Description de la prestation..."
                        value={item.description}
                        onChange={(e) =>
                          handleItemChange(idx, "description", e.target.value)
                        }
                        required
                        className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                      />
                      <div className="w-20">
                        <input
                          type="number"
                          placeholder="Qté"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(idx, "quantity", e.target.value)
                          }
                          required
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-sm text-neutral-200 text-center focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="w-32">
                        <input
                          type="number"
                          placeholder="Prix Unit (DA)"
                          min="0"
                          step="any"
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleItemChange(idx, "unitPrice", e.target.value)
                          }
                          required
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-sm text-neutral-200 text-right focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="w-28 text-right font-mono text-sm text-neutral-300 pr-2">
                        {((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)).toLocaleString(
                          "fr-FR"
                        )}{" "}
                        DA
                      </div>
                      {newItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemLine(idx)}
                          className="p-1 text-neutral-500 hover:text-rose-400 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tax & Total Summary */}
              <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2">
                <div className="flex justify-between items-center text-sm text-neutral-400">
                  <span>Sous-total HT :</span>
                  <span className="font-mono text-neutral-200">
                    {newSubtotal.toLocaleString("fr-FR")} DA
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm text-neutral-400">
                  <div className="flex items-center gap-2">
                    <span>TVA :</span>
                    <select
                      value={newTaxRate}
                      onChange={(e) => setNewTaxRate(Number(e.target.value))}
                      className="bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5 text-xs text-neutral-300"
                    >
                      <option value={0}>0% (Non assujetti / Franchise)</option>
                      <option value={19}>19% (Taux normal)</option>
                    </select>
                  </div>
                  <span className="font-mono text-neutral-200">
                    {newTaxAmount.toLocaleString("fr-FR")} DA
                  </span>
                </div>
                <div className="pt-2 border-t border-neutral-800 flex justify-between items-center text-base font-bold text-neutral-100">
                  <span>Total TTC :</span>
                  <span className="font-mono text-indigo-400 text-lg">
                    {newTotal.toLocaleString("fr-FR")} DA
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Mentions & Notes de Facturation (Optionnel)
                </label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Ex: Règlement attendu par BaridiMob ou chèque..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isPending ? "Génération..." : "Émettre la Facture"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK PAYMENT MODAL */}
      {showPayModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-neutral-100">
                  Encaisser Facture {selectedInvoice.invoiceNumber}
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
              <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 flex justify-between items-center text-sm">
                <div>
                  <div className="font-semibold text-neutral-200">
                    {selectedInvoice.client.companyName}
                  </div>
                  <div className="text-xs text-neutral-400">
                    Total Facture : {selectedInvoice.total.toLocaleString("fr-FR")} DA
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-neutral-400">Reste dû :</div>
                  <div className="font-mono font-bold text-amber-400 text-base">
                    {selectedInvoice.balanceDue.toLocaleString("fr-FR")} DA
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Montant à Encaisser (DA) *
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
                  Moyen de Paiement *
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="BARIDIMOB">BaridiMob (Virement instantané)</option>
                  <option value="CASH">Espèces (Cash)</option>
                  <option value="BANK_TRANSFER">Virement Bancaire</option>
                  <option value="CARD">Carte Bancaire / CIB</option>
                  <option value="OTHER">Autre</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Référence de Transaction / Reçu
                </label>
                <input
                  type="text"
                  placeholder="Ex: BaridiMob TXN-998823..."
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
                  {isPending ? "Enregistrement..." : "Valider l'Encaissement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE OFFICIAL INVOICE MODAL */}
      {showPrintModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="bg-white text-neutral-900 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-6 print:m-0 print:w-full print:max-w-none print:shadow-none print:rounded-none">
            {/* Action Bar (hidden on print) */}
            <div className="p-4 bg-neutral-100 border-b border-neutral-200 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                <FileText className="w-4 h-4 text-indigo-600" />
                Facture Officielle {selectedInvoice.invoiceNumber}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimer / Exporter PDF
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 hover:bg-neutral-200 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="p-8 md:p-12 space-y-8 bg-white text-neutral-900">
              {/* Header: Company & Invoice Info */}
              <div className="flex justify-between items-start border-b border-neutral-200 pb-8">
                <div>
                  <div className="text-2xl font-black tracking-tight text-neutral-950 flex items-center gap-2">
                    <span className="text-blue-600">HDZ</span> SECURITY
                  </div>
                  <div className="text-xs text-neutral-600 mt-1 leading-relaxed">
                    Services de Sécurité, Surveillance & Solutions Technologiques<br />
                    Tél : +213 (0) 550 00 00 00 • contact@hdz-security.dz
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xl font-mono font-black text-neutral-900">
                    {selectedInvoice.invoiceNumber}
                  </div>
                  <div className="text-xs text-neutral-600 mt-1">
                    Date : {new Date(selectedInvoice.issueDate).toLocaleDateString("fr-FR")}<br />
                    Échéance : {new Date(selectedInvoice.dueDate).toLocaleDateString("fr-FR")}
                  </div>
                  <span
                    className={`inline-block mt-2 px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                      selectedInvoice.status === "PAID"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {STATUS_CONFIG[selectedInvoice.status]?.label || selectedInvoice.status}
                  </span>
                </div>
              </div>

              {/* Client Info */}
              <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 flex justify-between">
                <div>
                  <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                    Facturé À :
                  </div>
                  <div className="text-base font-bold text-neutral-900 mt-1">
                    {selectedInvoice.client.companyName}
                  </div>
                  {selectedInvoice.client.contactName && (
                    <div className="text-xs text-neutral-600">
                      À l'attention de : {selectedInvoice.client.contactName}
                    </div>
                  )}
                  <div className="text-xs text-neutral-600">
                    {selectedInvoice.client.phone} • {selectedInvoice.client.email || "Non renseigné"}
                  </div>
                </div>
                {selectedInvoice.client.wilaya && (
                  <div className="text-right text-xs text-neutral-600">
                    <div>{selectedInvoice.client.address || "Alger"}</div>
                    <div className="font-semibold">{selectedInvoice.client.wilaya}</div>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-neutral-900 text-xs font-bold uppercase tracking-wider text-neutral-700">
                    <th className="py-2.5">Désignation</th>
                    <th className="py-2.5 text-center">Qté</th>
                    <th className="py-2.5 text-right">Prix Unitaire</th>
                    <th className="py-2.5 text-right">Total HT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {selectedInvoice.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-3 font-medium text-neutral-900">
                        {it.description}
                      </td>
                      <td className="py-3 text-center text-neutral-600">{it.quantity}</td>
                      <td className="py-3 text-right font-mono text-neutral-700">
                        {it.unitPrice.toLocaleString("fr-FR")} DA
                      </td>
                      <td className="py-3 text-right font-mono font-semibold text-neutral-900">
                        {((it.total ?? (it.quantity * it.unitPrice))).toLocaleString("fr-FR")} DA
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Breakdown */}
              <div className="flex justify-end pt-4">
                <div className="w-72 space-y-2 text-sm">
                  <div className="flex justify-between text-neutral-600">
                    <span>Sous-total HT :</span>
                    <span className="font-mono">
                      {selectedInvoice.subtotal.toLocaleString("fr-FR")} DA
                    </span>
                  </div>
                  {selectedInvoice.taxRate > 0 && (
                    <div className="flex justify-between text-neutral-600">
                      <span>TVA ({selectedInvoice.taxRate}%) :</span>
                      <span className="font-mono">
                        {selectedInvoice.taxAmount.toLocaleString("fr-FR")} DA
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-black text-neutral-950 border-t-2 border-neutral-900 pt-2">
                    <span>Total TTC :</span>
                    <span className="font-mono text-indigo-700">
                      {selectedInvoice.total.toLocaleString("fr-FR")} DA
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-emerald-700 font-semibold pt-1">
                    <span>Montant Encaissé :</span>
                    <span className="font-mono">
                      {selectedInvoice.amountPaid.toLocaleString("fr-FR")} DA
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-amber-700 font-bold border-t border-neutral-200 pt-1">
                    <span>Solde Restant Dû :</span>
                    <span className="font-mono">
                      {selectedInvoice.balanceDue.toLocaleString("fr-FR")} DA
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Details & Stamp Area */}
              <div className="pt-8 border-t border-neutral-200 grid grid-cols-2 gap-8 text-xs text-neutral-600">
                <div>
                  <div className="font-bold text-neutral-900 mb-1">
                    Modalités de Règlement :
                  </div>
                  <p>Règlement par BaridiMob (RIP: 007999990022334455) ou Virement Bancaire.</p>
                  {selectedInvoice.notes && (
                    <p className="mt-2 text-neutral-700 italic">
                      Note : {selectedInvoice.notes}
                    </p>
                  )}
                </div>
                <div className="text-center border border-dashed border-neutral-300 rounded-xl p-4 flex flex-col justify-between h-28">
                  <span className="text-[10px] uppercase font-bold text-neutral-400">
                    Cachet & Signature Agence
                  </span>
                  <div className="text-[11px] font-bold text-neutral-800">
                    HDZ SECURITY SARL
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
