"use client";

import React, { useState } from "react";
import Link from "next/link";
import { OFFER_TYPES, OFFER_DETAILS, CLIENT_STATUSES, SECTORS, WILAYAS } from "@/lib/constants";
import { ClientStatus, OfferType } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency, toLocalDateString, formatDate } from "@/lib/utils";
import { createClientAction, deleteClientAction } from "@/actions/clients";
import {
  CustomOfferConfigurator,
  CustomOfferCalculationResult,
  mergeRemarkWithSummary,
} from "./CustomOfferConfigurator";
import {
  Building,
  Search,
  Plus,
  ArrowUpRight,
  Calendar,
  CreditCard,
  Clock,
  Globe,
  Check,
  Sparkles,
  Crown,
  Zap,
  ArrowRight,
  X,
  AlertCircle,
  AlertTriangle,
  Trash2,
  Users,
  User,
} from "lucide-react";

const getCommercialBadgeStyle = (name?: string, id?: string) => {
  const palettes = [
    { bg: "bg-blue-500/15", text: "text-blue-300", border: "border-blue-500/30", dot: "bg-blue-400" },
    { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/30", dot: "bg-emerald-400" },
    { bg: "bg-purple-500/15", text: "text-purple-300", border: "border-purple-500/30", dot: "bg-purple-400" },
    { bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/30", dot: "bg-amber-400" },
    { bg: "bg-rose-500/15", text: "text-rose-300", border: "border-rose-500/30", dot: "bg-rose-400" },
    { bg: "bg-cyan-500/15", text: "text-cyan-300", border: "border-cyan-500/30", dot: "bg-cyan-400" },
    { bg: "bg-indigo-500/15", text: "text-indigo-300", border: "border-indigo-500/30", dot: "bg-indigo-400" },
  ];
  if (!name && !id) return palettes[0];
  const str = name || id || "";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palettes.length;
  return palettes[index];
};

interface ClientItem {
  id: string;
  companyName: string;
  brandName: string | null;
  contactName: string | null;
  phone: string;
  email: string | null;
  sector: string;
  wilaya: string | null;
  status: ClientStatus;
  offerType: OfferType;
  hasWebsite?: boolean;
  contractValue: number | { toString(): string };
  monthlyFee: number | { toString(): string };
  contractStart: Date | null;
  contractEnd: Date | null;
  assignedTo: { id: string; name: string } | null;
  _count: {
    projects: number;
    invoices: number;
    payments: number;
    calls: number;
    appointments: number;
  };
}

interface Props {
  initialClients: ClientItem[];
  salesUsers: { id: string; name: string }[];
  userRole?: string;
  currentUserId?: string;
  initialSearch?: string;
}

function calculateEndDate(startStr: string, months: number): string {
  try {
    const [y, m, d] = startStr.split("-").map(Number);
    const date = new Date(y, m - 1 + months, d);
    return toLocalDateString(date);
  } catch {
    return "";
  }
}

export const CUSTOM_DELIVERABLES_SUGGESTIONS = [
  {
    category: "📱 Réseaux Sociaux & Contenu",
    items: [
      "2 carrousels / mois",
      "4 carrousels / mois",
      "6 carrousels / mois",
      "8 carrousels / mois",
      "2 vidéos Reels / mois",
      "4 vidéos Reels / mois",
      "8 vidéos Reels / mois",
      "12 vidéos Reels / mois",
      "Maquettes réseaux sociaux",
      "Voix off professionnelle",
      "Animation motion design",
      "Calendrier éditorial & publication",
    ],
  },
  {
    category: "🎥 Tournages & Vidéos Pro",
    items: [
      "1 Shooting photo / an",
      "3 Shootings photo / an",
      "5 Shootings photo / an",
      "1 Vidéo Pro d'entreprise / an",
      "3 Vidéos Pro d'entreprise / an",
      "Prise de vue Drone 4K",
      "Couverture d'événement / Inauguration",
      "Interviews & témoignages clients",
    ],
  },
  {
    category: "🚀 Publicité & Acquisition (Ads)",
    items: [
      "Campagne Meta Ads (Facebook & Instagram)",
      "Campagne TikTok Ads dédiée",
      "Sponsoring & Boost ciblé",
      "50K vues garanties",
      "100K vues garanties",
      "500K vues garanties",
      "1M de vues garanties",
      "Rapport hebdomadaire des conversions",
    ],
  },
  {
    category: "🌐 Web & Référencement Google",
    items: [
      "Site Web Vitrine Professionnel",
      "Site Web E-Commerce",
      "Certification Google My Business",
      "Optimisation SEO & Google Maps",
      "Nom de domaine & hébergement",
    ],
  },
  {
    category: "🎨 Branding & Supports Print",
    items: [
      "Création ou refonte de logo",
      "Charte graphique complète",
      "Supports print (Flyers / Menus / Cartes)",
      "Templates Canva personnalisés",
    ],
  },
];

export function ClientsClient({ initialClients, salesUsers, userRole, currentUserId, initialSearch = "" }: Props) {
  const isCommercial =
    userRole === "SALES_REP" ||
    userRole === "COMMERCIAL" ||
    Boolean(userRole?.toLowerCase().includes("commercial"));
  const isAdmin = userRole === "ADMIN";

  const [clients, setClients] = useState<ClientItem[]>(initialClients);
  const [selectedCommercialId, setSelectedCommercialId] = useState<string>("ALL");
  const [search, setSearch] = useState(initialSearch);

  const [clientToDelete, setClientToDelete] = useState<ClientItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch);
    }
  }, [initialSearch]);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedSector, setSelectedSector] = useState("");
  const [selectedOffer, setSelectedOffer] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [offersCatalogOpen, setOffersCatalogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [customDeliverables, setCustomDeliverables] = useState<string[]>([
    "4 carrousels / mois",
    "4 vidéos Reels / mois",
    "Certification Google My Business",
  ]);
  const [newDeliverableInput, setNewDeliverableInput] = useState("");
  const [customQuoteSummary, setCustomQuoteSummary] = useState("");

  const initialStart = toLocalDateString(new Date());
  const initialDuration = 6;

  const [form, setForm] = useState({
    companyName: "",
    brandName: "",
    contactName: "",
    phone: "",
    email: "",
    address: "",
    sector: SECTORS[0] as string,
    wilaya: "Alger",
    offerType: "STARTER" as OfferType,
    hasWebsite: true,
    monthlyFee: 9000,
    durationMonths: initialDuration,
    contractValue: 9000 * initialDuration,
    contractStart: initialStart,
    contractEnd: calculateEndDate(initialStart, initialDuration),
    notes: "",
    assignedToId: currentUserId || salesUsers[0]?.id || "",
    status: "IN_PREPARATION" as ClientStatus,
  });

  const handleCustomCalculationChange = (result: CustomOfferCalculationResult) => {
    setCustomQuoteSummary(result.summaryText);
    setCustomDeliverables(result.deliverablesList);
    setForm((prev) => {
      const mergedNotes = mergeRemarkWithSummary(prev.notes, result.summaryText);
      const fee = result.monthlyRecurring > 0 ? result.monthlyRecurring : result.recommendedMonthlyFee;
      return {
        ...prev,
        monthlyFee: fee,
        contractValue: result.totalContractValue,
        hasWebsite: result.hasWebsite,
        notes: mergedNotes,
      };
    });
  };

  const toggleDeliverable = (item: string) => {
    setCustomDeliverables((prev) => {
      const exists = prev.includes(item);
      let updated: string[];
      if (exists) {
        updated = prev.filter((d) => d !== item);
      } else {
        updated = [...prev, item];
      }
      if (!exists && item.toLowerCase().includes("site web")) {
        setForm((f) => ({ ...f, hasWebsite: true }));
      }
      return updated;
    });
  };

  const handleAddCustomDeliverable = () => {
    const trimmed = newDeliverableInput.trim();
    if (!trimmed) return;
    if (!customDeliverables.includes(trimmed)) {
      setCustomDeliverables((prev) => [...prev, trimmed]);
      if (trimmed.toLowerCase().includes("site web")) {
        setForm((f) => ({ ...f, hasWebsite: true }));
      }
    }
    setNewDeliverableInput("");
  };

  const handleOfferSelect = (newOffer: OfferType) => {
    let fee = 9000;
    let websiteOpt = false;
    if (newOffer === "STARTER") {
      fee = 9000;
      websiteOpt = true; // Inclus
    } else if (newOffer === "SILVER") {
      fee = 26000;
      websiteOpt = false;
    } else if (newOffer === "GOLD") {
      fee = 36000;
      websiteOpt = false;
    } else {
      fee = form.monthlyFee || 0;
      websiteOpt = false;
    }

    setForm((prev) => ({
      ...prev,
      offerType: newOffer,
      hasWebsite: websiteOpt,
      monthlyFee: fee,
      contractValue: fee * prev.durationMonths,
    }));
  };

  const handleWebsiteToggle = (checked: boolean) => {
    setForm((prev) => {
      let baseFee = 0;
      if (prev.offerType === "SILVER") baseFee = 26000;
      else if (prev.offerType === "GOLD") baseFee = 36000;
      else if (prev.offerType === "STARTER") baseFee = 9000;
      else baseFee = prev.monthlyFee;

      const finalFee =
        prev.offerType === "SILVER" || prev.offerType === "GOLD"
          ? checked
            ? baseFee + 2000
            : baseFee
          : prev.monthlyFee;

      return {
        ...prev,
        hasWebsite: checked,
        monthlyFee: finalFee,
        contractValue: finalFee * prev.durationMonths,
      };
    });
  };

  const selectOfferAndOpenForm = (offer: OfferType, withWebsite = false) => {
    let fee = 9000;
    let hasWeb = withWebsite;
    if (offer === "STARTER") {
      fee = 9000;
      hasWeb = true;
    } else if (offer === "SILVER") {
      fee = withWebsite ? 28000 : 26000;
    } else if (offer === "GOLD") {
      fee = withWebsite ? 38000 : 36000;
    } else {
      fee = form.monthlyFee > 0 ? form.monthlyFee : 20000;
      hasWeb = false;
    }

    setCreateError(null);
    setOffersCatalogOpen(false);
    setForm((prev) => ({
      ...prev,
      offerType: offer,
      hasWebsite: hasWeb,
      monthlyFee: fee,
      contractValue: fee * prev.durationMonths,
      status: "IN_PREPARATION" as ClientStatus,
    }));
    setModalOpen(true);
  };

  const openNewClientModal = () => {
    setForm({
      companyName: "",
      brandName: "",
      contactName: "",
      phone: "",
      email: "",
      address: "",
      sector: SECTORS[0] as string,
      wilaya: "Alger",
      offerType: "STARTER" as OfferType,
      hasWebsite: true,
      monthlyFee: 9000,
      durationMonths: initialDuration,
      contractValue: 9000 * initialDuration,
      contractStart: initialStart,
      contractEnd: calculateEndDate(initialStart, initialDuration),
      notes: "",
      assignedToId: currentUserId || salesUsers[0]?.id || "",
      status: "IN_PREPARATION" as ClientStatus,
    });
    setCustomDeliverables([
      "Stratégie & Planning éditorial mensuel",
      "Shooting Photo & Vidéo sur site",
      "4 vidéos Reels / mois",
      "Certification Google My Business",
    ]);
    setNewDeliverableInput("");
    setCustomQuoteSummary("");
    setCreateError(null);
    setModalOpen(true);
  };

  const handleMonthlyFeeChange = (fee: number) => {
    const validFee = Number.isFinite(fee) ? Math.max(0, fee) : 0;
    setForm((prev) => ({
      ...prev,
      monthlyFee: validFee,
      contractValue: validFee * prev.durationMonths,
    }));
  };

  const handleDurationChange = (months: number) => {
    setForm((prev) => ({
      ...prev,
      durationMonths: months,
      contractValue: prev.monthlyFee * months,
      contractEnd: calculateEndDate(prev.contractStart, months),
    }));
  };

  const handleStartDateChange = (startDate: string) => {
    setForm((prev) => ({
      ...prev,
      contractStart: startDate,
      contractEnd: calculateEndDate(startDate, prev.durationMonths),
    }));
  };

  const filtered = clients.filter((c) => {
    const matchesCommercial =
      !selectedCommercialId ||
      selectedCommercialId === "ALL" ||
      c.assignedTo?.id === selectedCommercialId;

    const matchesSearch =
      !search ||
      c.companyName.toLowerCase().includes(search.toLowerCase()) ||
      (c.brandName && c.brandName.toLowerCase().includes(search.toLowerCase())) ||
      (c.contactName && c.contactName.toLowerCase().includes(search.toLowerCase())) ||
      c.phone.includes(search) ||
      (c.assignedTo?.name && c.assignedTo.name.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = !selectedStatus || c.status === selectedStatus;
    const matchesSector = !selectedSector || c.sector === selectedSector;
    const matchesOffer = !selectedOffer || c.offerType === selectedOffer;

    return matchesCommercial && matchesSearch && matchesStatus && matchesSector && matchesOffer;
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setCreateError(null);

    try {
      let finalNotes = form.notes.trim();
      if (form.offerType === "CUSTOM") {
        const detailsText =
          customQuoteSummary ||
          (customDeliverables.length > 0
            ? `📦 Livrables du Pack Sur Mesure :\n${customDeliverables.map((d) => `• ${d}`).join("\n")}`
            : "");
        if (detailsText) {
          finalNotes = finalNotes ? `${finalNotes}\n\n${detailsText}` : detailsText;
        }
      }

      const res = await createClientAction({
        companyName: form.companyName,
        brandName: form.brandName || form.companyName,
        contactName: form.contactName,
        phone: form.phone,
        email: form.email,
        address: form.address,
        sector: form.sector,
        wilaya: form.wilaya,
        offerType: form.offerType,
        hasWebsite: form.hasWebsite || customDeliverables.some((d) => d.toLowerCase().includes("site web")),
        contractValue: Number(form.contractValue) || 0,
        monthlyFee: Number(form.monthlyFee) || 0,
        contractStart: form.contractStart,
        contractEnd: form.contractEnd,
        notes: finalNotes,
        assignedToId: form.assignedToId,
        status: form.status,
      });

      if (!res.success) {
        setCreateError("Erreur lors de la création du client.");
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      setModalOpen(false);
      window.location.reload();
    } catch (err: any) {
      console.error("Error creating client:", err);
      setCreateError(err.message || "Une erreur est survenue lors de la création du client.");
      setIsLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!clientToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await deleteClientAction(clientToDelete.id);
      if (!res.success) {
        setDeleteError(res.error || "Erreur lors de la suppression du client.");
        setIsDeleting(false);
        return;
      }
      setClients((prev) => prev.filter((c) => c.id !== clientToDelete.id));
      setClientToDelete(null);
      setIsDeleting(false);
    } catch (err: any) {
      setDeleteError(err?.message || "Erreur inattendue lors de la suppression.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2">
            Portefeuille Clients
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
              {filtered.length} client{filtered.length > 1 ? "s" : ""} signé{filtered.length > 1 ? "s" : ""} {selectedCommercialId === "ALL" ? "(Tous les commerciaux)" : "filtré(s)"}
            </span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Gérez les comptes clients, abonnements récurrents, contrats et historique de production
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setOffersCatalogOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer hover:border-amber-500/40"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Grille des Offres & Tarifs</span>
          </button>

          <Button size="sm" onClick={openNewClientModal} className="gap-1.5 shadow-md shadow-blue-500/20">
            <Plus className="w-3.5 h-3.5" />
            <span>Nouveau Client</span>
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="space-y-3 bg-neutral-900/60 border border-neutral-800 p-3 rounded-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Rechercher entreprise, contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 h-9">
            <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <select
              value={selectedCommercialId}
              onChange={(e) => setSelectedCommercialId(e.target.value)}
              className="w-full text-xs bg-transparent text-neutral-200 focus:outline-none cursor-pointer font-medium"
            >
              <option value="ALL" className="bg-neutral-900 text-neutral-100">
                Tous les commerciaux ({clients.length})
              </option>
              {salesUsers.map((u) => {
                const count = clients.filter((c) => c.assignedTo?.id === u.id).length;
                return (
                  <option key={u.id} value={u.id} className="bg-neutral-900 text-neutral-100">
                    {u.name} {u.id === currentUserId ? "(Moi)" : ""} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">Tous les secteurs</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(CLIENT_STATUSES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        {/* Secondary filters row & quick shortcuts */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-800/60">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedOffer}
              onChange={(e) => setSelectedOffer(e.target.value)}
              className="h-8 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">Toutes les offres</option>
              {Object.entries(OFFER_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>

            {currentUserId && (
              <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-xl p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCommercialId("ALL")}
                  className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    selectedCommercialId === "ALL"
                      ? "bg-blue-600 text-white shadow-xs font-semibold"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  Tous ({clients.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCommercialId(currentUserId)}
                  className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    selectedCommercialId === currentUserId
                      ? "bg-blue-600 text-white shadow-xs font-semibold"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  Mes clients ({clients.filter((c) => c.assignedTo?.id === currentUserId).length})
                </button>
              </div>
            )}
          </div>

          <div className="text-xs text-neutral-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Affichage :{" "}
              <strong className="text-neutral-200">
                {selectedCommercialId === "ALL"
                  ? "Tous les commerciaux réunis (synchronisé)"
                  : salesUsers.find((u) => u.id === selectedCommercialId)?.name || "Commercial sélectionné"}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl w-full min-w-0">
        <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-700 min-w-0">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950/80 border-b border-neutral-800 text-neutral-400">
              <tr>
                <th className="py-3 px-4 font-semibold min-w-[220px]">Entreprise & Marque</th>
                <th className="py-3 px-4 font-semibold min-w-[140px]">Secteur / Wilaya</th>
                <th className="py-3 px-4 font-semibold min-w-[150px]">Commercial en charge</th>
                <th className="py-3 px-4 font-semibold min-w-[160px]">Offre Commerciale</th>
                <th className="py-3 px-4 font-semibold min-w-[180px] whitespace-nowrap">Contrat & Forfait</th>
                <th className="py-3 px-4 font-semibold min-w-[140px] whitespace-nowrap">Statut</th>
                {!isCommercial && (
                  <th className="py-3 px-4 font-semibold text-right min-w-[120px] whitespace-nowrap">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={isCommercial ? 6 : 7} className="py-12 text-center text-neutral-500">
                    Aucun client enregistré pour l'instant.
                  </td>
                </tr>
              )}

              {filtered.map((client) => {
                const statusConfig = CLIENT_STATUSES[client.status] || {
                  label: client.status,
                  color: "bg-neutral-800 text-neutral-300 border-neutral-700",
                  dot: "bg-neutral-400",
                };
                const commBadge = getCommercialBadgeStyle(client.assignedTo?.name, client.assignedTo?.id);

                return (
                  <tr key={client.id} className="hover:bg-neutral-800/30 transition-colors group">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 shadow-2xs">
                          <Building className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 max-w-xs">
                          <p className="font-bold text-neutral-100 truncate text-xs" title={client.companyName}>
                            {client.companyName}
                          </p>
                          {client.brandName && (
                            <p className="text-[11px] text-neutral-400 truncate" title={client.brandName}>
                              {client.brandName}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-medium text-neutral-200">{client.sector}</p>
                      <p className="text-[10px] text-neutral-500">{client.wilaya || "Algérie"}</p>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {client.assignedTo ? (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border shadow-2xs ${commBadge.bg} ${commBadge.text} ${commBadge.border}`}>
                          <User className="w-3 h-3 shrink-0" />
                          <span>{client.assignedTo.name}</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-neutral-500 italic">Non assigné</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border whitespace-nowrap shadow-2xs ${OFFER_DETAILS[client.offerType]?.theme.badge || "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>
                          {OFFER_DETAILS[client.offerType]?.name || client.offerType}
                        </span>
                        {client.hasWebsite && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] text-emerald-400 font-semibold whitespace-nowrap">
                            <Globe className="w-2.5 h-2.5" />
                            <span>+ Site Vitrine</span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                        <span className="font-extrabold text-neutral-100 text-sm whitespace-nowrap">
                          {formatCurrency(client.monthlyFee)}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-semibold whitespace-nowrap">/&nbsp;mois</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 whitespace-nowrap mt-0.5">
                        Total&nbsp;: <span className="text-neutral-200 font-medium whitespace-nowrap">{formatCurrency(client.contractValue)}</span>
                      </p>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap shadow-2xs ${statusConfig.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot || "bg-current"}`} />
                        <span className="whitespace-nowrap">{statusConfig.label}</span>
                      </span>
                    </td>

                    {!isCommercial && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <Link
                            href={`/clients/${client.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-neutral-800 hover:bg-blue-600 hover:text-white rounded-xl text-neutral-200 font-semibold text-xs transition-colors border border-neutral-700/60 shadow-xs whitespace-nowrap"
                          >
                            <span>Fiche 360°</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setClientToDelete(client)}
                              title="Supprimer définitivement ce client (Admin)"
                              className="p-1.5 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all cursor-pointer shadow-xs"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Client */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Créer un nouveau compte client"
        description="Enregistrez une nouvelle entreprise cliente avec contrat par abonnement mensuel"
        maxWidth="3xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {createError && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{createError}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nom Entreprise / Raison Sociale *"
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              required
            />
            <Input
              label="Nom commercial / Marque"
              value={form.brandName}
              onChange={(e) => setForm({ ...form, brandName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Contact Référent"
              value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
            />
            <Input
              label="Téléphone *"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Secteur *</label>
              <select
                value={form.sector}
                onChange={(e) => setForm({ ...form, sector: e.target.value })}
                className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
              >
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Wilaya</label>
              <select
                value={form.wilaya}
                onChange={(e) => setForm({ ...form, wilaya: e.target.value })}
                className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
              >
                {WILAYAS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* SÉLECTEUR DE PACKS DIGITAUX */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-200">
                Pack / Offre Commerciale *
              </label>
              <span className="text-[11px] text-neutral-400">
                Sélectionnez le forfait souscrit
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(["STARTER", "SILVER", "GOLD", "CUSTOM"] as (keyof typeof OFFER_DETAILS)[]).map((key) => {
                const pack = OFFER_DETAILS[key];
                const isSelected = form.offerType === key;

                return (
                  <div
                    key={key}
                    onClick={() => handleOfferSelect(key as OfferType)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? `${pack.theme.activeBg} ${pack.theme.border} ring-2 ring-blue-500/40 shadow-lg`
                        : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-xs text-neutral-100">{pack.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                      </div>
                      <p className="text-[10px] text-neutral-400 line-clamp-1">{pack.tagline}</p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-neutral-800/80">
                      <div className="font-bold text-xs text-neutral-100">
                        {pack.monthlyPrice > 0 ? (
                          <>
                            {pack.monthlyPrice.toLocaleString("fr-FR")}{" "}
                            <span className="text-[10px] text-emerald-400 font-normal">DA/m</span>
                          </>
                        ) : (
                          <span className="text-purple-400 text-[11px]">Sur mesure</span>
                        )}
                      </div>
                      <span className="text-[10px] text-neutral-500 block truncate">
                        {pack.views}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* OPTION SITE VITRINE (+2 000 DA) - UNIQUEMENT SILVER ET GOLD */}
          {(form.offerType === "SILVER" || form.offerType === "GOLD") ? (
            <div
              onClick={() => handleWebsiteToggle(!form.hasWebsite)}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                form.hasWebsite
                  ? "bg-emerald-950/30 border-emerald-500/50 shadow-sm"
                  : "bg-neutral-950/60 border-neutral-800 hover:border-neutral-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                    form.hasWebsite
                      ? "bg-emerald-500 border-emerald-400 text-neutral-950 font-bold"
                      : "border-neutral-700 bg-neutral-900"
                  }`}
                >
                  {form.hasWebsite && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-bold text-neutral-100">
                      Ajouter l'option Site Vitrine
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      +2 000 DA / mois
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Création et hébergement d'un site web vitrine dédié pour valoriser l'établissement.
                  </p>
                </div>
              </div>

              <span className={`text-xs font-bold font-mono shrink-0 ${form.hasWebsite ? "text-emerald-400" : "text-neutral-500"}`}>
                {form.hasWebsite ? "+ 2 000 DA" : "+ 0 DA"}
              </span>
            </div>
          ) : form.offerType === "STARTER" ? (
            <div className="p-2.5 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-center gap-2 text-xs text-blue-300">
              <Check className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                <strong>Site web professionnel inclus :</strong> Ce service est déjà compris dans le pack Starter à 9 000 DA / mois.
              </span>
            </div>
          ) : null}

          {/* DÉTAIL DES LIVRABLES DU PACK */}
          {form.offerType === "CUSTOM" ? (
            <CustomOfferConfigurator
              durationMonths={form.durationMonths}
              onCalculationChange={handleCustomCalculationChange}
            />
          ) : (
            /* DÉTAIL DES LIVRABLES DU PACK STANDARD */
            <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-xl space-y-1.5">
              <span className="text-[11px] font-semibold text-neutral-400">
                Inclus dans le {OFFER_DETAILS[form.offerType as keyof typeof OFFER_DETAILS]?.name} :
              </span>
              <div className="flex flex-wrap gap-1.5">
                {OFFER_DETAILS[form.offerType as keyof typeof OFFER_DETAILS]?.features.map((feat, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-300 font-medium flex items-center gap-1"
                  >
                    <span className="text-blue-400">•</span>
                    <span>{feat}</span>
                  </span>
                ))}
                {form.hasWebsite && (form.offerType === "SILVER" || form.offerType === "GOLD") && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] text-emerald-300 font-bold flex items-center gap-1">
                    <Globe className="w-2.5 h-2.5 text-emerald-400" />
                    <span>Site vitrine professionnel inclus (+2 000 DA)</span>
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Responsable Commercial</label>
              <select
                value={form.assignedToId}
                onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
                className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
              >
                {salesUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">État / Statut du Client</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as ClientStatus })}
                className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
              >
                {Object.entries(CLIENT_STATUSES).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section Contrat Mensuel */}
          <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-neutral-200">Conditions du Contrat (Abonnement Mensuel)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                Contrat par mois
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Mensualité / Forfait (DA / mois) *"
                type="number"
                value={form.monthlyFee}
                onChange={(e) => handleMonthlyFeeChange(Number(e.target.value))}
                required
              />

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300">Durée d'engagement (Mois)</label>
                <select
                  value={form.durationMonths}
                  onChange={(e) => handleDurationChange(Number(e.target.value))}
                  className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
                >
                  <option value={1}>1 mois (Mensuel sans engagement)</option>
                  <option value={3}>3 mois (Trimestriel)</option>
                  <option value={6}>6 mois (Semestriel)</option>
                  <option value={12}>12 mois (1 an annuel)</option>
                  <option value={24}>24 mois (2 ans)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Date de début"
                type="date"
                value={form.contractStart}
                onChange={(e) => handleStartDateChange(e.target.value)}
                required
              />

              <Input
                label="Date de fin (Calculée auto)"
                type="date"
                value={form.contractEnd}
                onChange={(e) => setForm({ ...form, contractEnd: e.target.value })}
              />
            </div>

            <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800/80 flex items-center justify-between text-xs">
              <span className="text-neutral-400">Total estimé du contrat :</span>
              <span className="font-bold text-neutral-100 text-sm">
                {formatCurrency(form.contractValue)}{" "}
                <span className="text-[11px] font-normal text-neutral-400">
                  ({form.durationMonths} mois × {formatCurrency(form.monthlyFee)})
                </span>
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-200">
                Remarques & Notes Internes du Client
              </label>
              {form.offerType === "CUSTOM" && (
                <span className="text-[10px] text-purple-400 font-semibold">
                  ✓ Le devis détaillé sur mesure sera automatiquement enregistré
                </span>
              )}
            </div>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Ex : Exigences de la marque, contact WhatsApp, modalité de paiement..."
              className="w-full p-2.5 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Créer le client
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: GRILLE DES OFFRES & TARIFS MARKETING */}
      <Modal
        isOpen={offersCatalogOpen}
        onClose={() => setOffersCatalogOpen(false)}
        title="Grille Officielle des Offres & Forfaits Marketing"
        description="Packs principaux BOOSTERA (Starter, Silver, Gold), option Site Vitrine (+2 000 DA) et prestations sur mesure"
        maxWidth="5xl"
      >
        <div className="space-y-6">
          {/* Top highlight banner */}
          <div className="p-3.5 modal-offers-banner bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950 border border-neutral-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-neutral-200">
                  Formules d'accompagnement digital clé en main
                </p>
                <p className="text-[11px] text-neutral-400">
                  Chaque pack inclut production graphique, vidéo, référencement et objectifs de visibilité réels garantis.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-neutral-800/80 text-neutral-300 text-[11px] font-medium border border-neutral-700/60">
                Contrats 6 ou 12 mois
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[11px] font-bold border border-emerald-500/30">
                Option Site Vitrine : +2 000 DA/m
              </span>
            </div>
          </div>

          {/* 3 Main Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
            {/* 1. STARTER */}
            <div className="p-5 rounded-2xl modal-offers-starter bg-gradient-to-b from-blue-950/25 via-neutral-900/90 to-neutral-900/90 border border-blue-500/35 hover:border-blue-500/70 transition-all shadow-xl flex flex-col justify-between relative group">
              <div className="space-y-4">
                {/* Header Tag & Views */}
                <div className="flex items-center justify-between gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-500/20 text-blue-300 border border-blue-500/40 uppercase tracking-wider">
                    Starter
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-neutral-300 border border-neutral-700/80 whitespace-nowrap">
                    50K Vues garanties
                  </span>
                </div>

                {/* Price */}
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl sm:text-4xl font-black text-white modal-offers-price-starter tracking-tight whitespace-nowrap">
                      9 000
                    </span>
                    <span className="text-xs font-semibold text-neutral-400 whitespace-nowrap">
                      DA / mois
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Idéal pour lancer une présence en ligne propre, régulière et structurée.
                  </p>
                </div>

                {/* Site Web Inclus Badge */}
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 whitespace-nowrap">
                    <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Site Web Vitrine Inclus</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase whitespace-nowrap">
                    Offert
                  </span>
                </div>

                {/* Deliverables Checklist */}
                <div className="space-y-2 pt-2 border-t border-neutral-800">
                  <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                    Livrables Mensuels & Annuels :
                  </p>
                  <ul className="space-y-2 text-xs text-neutral-200">
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span><strong>2 carrousels</strong> graphiques / mois</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span><strong>2 maquettes</strong> réseaux sociaux</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span>SEO de base & référencement</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span>Certification Google My Business</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-emerald-400 font-semibold">
                      <Globe className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>Site web pro inclus</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span><strong>1 Shooting</strong> pro / an</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span><strong>1 vidéo Pro</strong> de présentation / an</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span>Sponsor de la vidéo pro inclus</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Action button */}
              <div className="pt-5 mt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => selectOfferAndOpenForm("STARTER", true)}
                  className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Choisir le Pack Starter</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 2. SILVER (LE PLUS POPULAIRE - MIS EN VALEUR) */}
            <div className="p-5 rounded-2xl modal-offers-silver bg-gradient-to-b from-amber-950/30 via-neutral-900/95 to-neutral-900/95 border-2 border-amber-500/80 shadow-2xl shadow-amber-500/15 flex flex-col justify-between relative group scale-[1.02] z-10">
              {/* Featured Badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-0.5 rounded-full text-[10px] font-black tracking-wider bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 uppercase shadow-lg shadow-amber-500/30 flex items-center gap-1 whitespace-nowrap">
                  <Sparkles className="w-3 h-3 text-neutral-950" />
                  <span>Recommandé • Le Plus Choisi</span>
                </span>
              </div>

              <div className="space-y-4 pt-1">
                {/* Header Tag & Views */}
                <div className="flex items-center justify-between gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/25 text-amber-300 border border-amber-500/50 uppercase tracking-wider">
                    Silver
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 whitespace-nowrap">
                    600K Vues garanties
                  </span>
                </div>

                {/* Price */}
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl sm:text-4xl font-black text-amber-300 modal-offers-price-silver tracking-tight whitespace-nowrap">
                      26 000
                    </span>
                    <span className="text-xs font-semibold text-neutral-400 whitespace-nowrap">
                      DA / mois
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Forte visibilité & cadence régulière multi-formats sur les réseaux.
                  </p>
                </div>

                {/* Option Site Vitrine Box */}
                <div className="p-3 rounded-xl modal-offers-box-silver bg-amber-500/10 border border-amber-500/30 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-200 whitespace-nowrap">
                      <Globe className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Option Site Vitrine :</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold text-xs whitespace-nowrap border border-amber-500/30">
                      +2 000 DA
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-200/90 font-medium">
                    Soit <strong className="text-white font-bold">28 000 DA / mois</strong> avec site vitrine complet
                  </p>
                </div>

                {/* Deliverables Checklist */}
                <div className="space-y-2 pt-2 border-t border-neutral-800">
                  <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                    Livrables Mensuels & Annuels :
                  </p>
                  <ul className="space-y-2 text-xs text-neutral-200">
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span><strong>3 carrousels</strong> dynamiques / mois</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span><strong>3 maquettes</strong> graphiques sur mesure</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span><strong>2 vidéos Reels</strong> verticaux optimisés</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span><strong>1 voix off</strong> professionnelle studio</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>SEO de base & Google My Business</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span><strong>3 Shootings</strong> professionnels / an</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span><strong>3 vidéos Pro</strong> haute définition / an</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>Sponsor des vidéos pro & sponsoring</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-5 mt-4 border-t border-neutral-800 space-y-1.5">
                <button
                  type="button"
                  onClick={() => selectOfferAndOpenForm("SILVER", false)}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 text-xs font-black transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Choisir Silver (26 000 DA)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => selectOfferAndOpenForm("SILVER", true)}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 border border-amber-500/30 cursor-pointer"
                >
                  <Globe className="w-3 h-3 text-amber-400" />
                  <span>Avec Site Vitrine : 28 000 DA</span>
                </button>
              </div>
            </div>

            {/* 3. GOLD (HAUTE VISIBILITÉ & SCALING) */}
            <div className="p-5 rounded-2xl modal-offers-gold bg-gradient-to-b from-yellow-950/20 via-neutral-900/90 to-neutral-900/90 border border-yellow-500/40 hover:border-yellow-500/70 transition-all shadow-xl flex flex-col justify-between relative group">
              <div className="space-y-4">
                {/* Header Tag & Views */}
                <div className="flex items-center justify-between gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 uppercase tracking-wider flex items-center gap-1">
                    <Crown className="w-3 h-3 text-yellow-400" />
                    <span>Gold</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 whitespace-nowrap">
                    1M Vues garanties
                  </span>
                </div>

                {/* Price */}
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl sm:text-4xl font-black text-yellow-300 modal-offers-price-gold tracking-tight whitespace-nowrap">
                      36 000
                    </span>
                    <span className="text-xs font-semibold text-neutral-400 whitespace-nowrap">
                      DA / mois
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Notoriété maximale, cadence vidéo intensive et impact sur le marché.
                  </p>
                </div>

                {/* Option Site Vitrine Box */}
                <div className="p-3 rounded-xl modal-offers-box-gold bg-yellow-500/10 border border-yellow-500/30 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-yellow-200 whitespace-nowrap">
                      <Globe className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                      <span>Option Site Vitrine :</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 font-mono font-bold text-xs whitespace-nowrap border border-yellow-500/30">
                      +2 000 DA
                    </span>
                  </div>
                  <p className="text-[11px] text-yellow-200/90 font-medium">
                    Soit <strong className="text-white font-bold">38 000 DA / mois</strong> avec site vitrine complet
                  </p>
                </div>

                {/* Deliverables Checklist */}
                <div className="space-y-2 pt-2 border-t border-neutral-800">
                  <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                    Livrables Mensuels & Annuels :
                  </p>
                  <ul className="space-y-2 text-xs text-neutral-200">
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                      <span><strong>4 carrousels</strong> haute performance / mois</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                      <span><strong>4 maquettes</strong> graphiques sur mesure</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                      <span><strong>4 vidéos Reels</strong> tendance & créatives</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                      <span><strong>2 voix off</strong> professionnelles studio</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                      <span>SEO de base & Google My Business</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                      <span><strong>5 Shootings</strong> professionnels / an</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                      <span><strong>5 vidéos Pro</strong> prestige / an</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                      <span>Sponsor des vidéos pro & sponsoring ciblé</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-5 mt-4 border-t border-neutral-800 space-y-1.5">
                <button
                  type="button"
                  onClick={() => selectOfferAndOpenForm("GOLD", false)}
                  className="w-full py-2.5 px-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-neutral-950 text-xs font-black transition-all shadow-md shadow-yellow-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Choisir Gold (36 000 DA)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => selectOfferAndOpenForm("GOLD", true)}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 border border-yellow-500/30 cursor-pointer"
                >
                  <Globe className="w-3 h-3 text-yellow-400" />
                  <span>Avec Site Vitrine : 38 000 DA</span>
                </button>
              </div>
            </div>
          </div>

          {/* 4. OFFRES PERSONNALISÉES (Bannière Basse) */}
          <div className="p-4 modal-offers-custom bg-gradient-to-r from-purple-950/40 via-neutral-900 to-indigo-950/40 border border-purple-500/30 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black bg-purple-500/25 text-purple-300 border border-purple-500/40 uppercase tracking-wide flex items-center gap-1">
                  <Zap className="w-3 h-3 text-purple-400" />
                  <span>Offres Personnalisées</span>
                </span>
                <span className="text-xs font-bold text-neutral-100">
                  Prestations sur Mesure & Devis Libre
                </span>
              </div>
              <p className="text-xs text-neutral-400 max-w-2xl leading-relaxed">
                Pour les clients aux besoins spécifiques hors grille : volume personnalisé de Reels/carrousels, campagnes Meta Ads / Google Ads avec budgets dédiés, ou création de plateformes web complexes sur devis.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setOffersCatalogOpen(false);
                setForm((prev) => ({
                  ...prev,
                  offerType: "CUSTOM",
                  hasWebsite: false,
                  monthlyFee: 0,
                  status: "IN_PREPARATION" as ClientStatus,
                }));
                setModalOpen(true);
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-all shadow-lg shadow-purple-600/25 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Créer un contrat sur mesure</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Footer close */}
          <div className="flex justify-end pt-2 border-t border-neutral-800">
            <Button variant="outline" onClick={() => setOffersCatalogOpen(false)}>
              Fermer la grille
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Confirmation de suppression du client (Admin uniquement) */}
      <Modal
        isOpen={Boolean(clientToDelete)}
        onClose={() => {
          if (!isDeleting) {
            setClientToDelete(null);
            setDeleteError(null);
          }
        }}
        title="Supprimer définitivement le client"
        maxWidth="md"
      >
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-red-300">Action irréversible (Rôle Administrateur)</p>
              <p className="text-neutral-300 leading-relaxed">
                Êtes-vous certain de vouloir supprimer le client{" "}
                <strong className="text-white font-bold">{clientToDelete?.companyName}</strong>{" "}
                {clientToDelete?.brandName ? `(${clientToDelete.brandName})` : ""} ?
              </p>
              <p className="text-red-400/90 text-[11px] mt-1">
                ⚠️ Cette opération supprimera définitivement le compte client, ainsi que tous ses projets, factures, paiements, appels et documents rattachés.
              </p>
            </div>
          </div>

          {deleteError && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-800">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => {
                setClientToDelete(null);
                setDeleteError(null);
              }}
            >
              Annuler
            </Button>
            <Button
              type="button"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-500 text-white font-bold gap-1.5 shadow-lg shadow-red-600/20 cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>Suppression en cours...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Supprimer définitivement</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
