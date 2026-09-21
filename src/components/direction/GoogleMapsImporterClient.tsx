"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import {
  MapPin,
  Search,
  ClipboardPaste,
  Building2,
  Phone,
  Globe,
  Star,
  CheckCircle2,
  AlertCircle,
  Users,
  DownloadCloud,
  ExternalLink,
  Filter,
  CheckSquare,
  Square,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  Database,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Shuffle,
  Tag,
  Check,
  Building,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  searchGoogleMapsProspectsAction,
  parseGoogleMapsTextAction,
  importGoogleMapsProspectsAction,
  type GoogleMapsProspectItem,
} from "@/actions/googleMapsProspects";
import { formatDzPhoneDisplay } from "@/lib/phoneUtils";
import { SECTORS, WILAYAS } from "@/lib/constants";
import { WILAYA_COMMUNES, SECTOR_SUBCATEGORIES } from "@/lib/googleMapsConstants";

interface UserOption {
  id: string;
  name: string;
  role?: string;
}

interface GoogleMapsImporterClientProps {
  salesUsers: UserOption[];
  currentUserId: string;
}

const POPULAR_QUERIES = [
  { label: "Cliniques & Santé", query: "clinique médicale", sector: "Cabinet médical" },
  { label: "Grossistes & Import", query: "grossiste import", sector: "Industrie" },
  { label: "Agences Immo", query: "agence immobiliere", sector: "Immobilier" },
  { label: "Hôtels & Complexes", query: "hotel", sector: "Hôtel" },
  { label: "Restaurants & Cafés", query: "restaurant", sector: "Restaurant" },
  { label: "Écoles & Formations", query: "ecole formation", sector: "Éducation / Formation" },
  { label: "Cosmétique & Beauté", query: "cosmetique beaute", sector: "Beauté" },
  { label: "Voyages & Omra", query: "agence voyage omra", sector: "Voyage" },
];

export function GoogleMapsImporterClient({ salesUsers, currentUserId }: GoogleMapsImporterClientProps) {
  const [activeTab, setActiveTab] = useState<"SEARCH" | "PASTE">("SEARCH");

  // Search Basic State
  const [searchQuery, setSearchQuery] = useState("clinique");
  const [selectedWilaya, setSelectedWilaya] = useState("Alger");
  const [selectedSector, setSelectedSector] = useState("Cabinet médical");

  // Advanced Search Filters State
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedCommune, setSelectedCommune] = useState("Toutes les communes");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [onlyWithPhone, setOnlyWithPhone] = useState(true);
  const [onlyWithoutWebsite, setOnlyWithoutWebsite] = useState(false);
  const [onlyWithWebsite, setOnlyWithWebsite] = useState(false);
  const [minRating, setMinRating] = useState<number>(0);
  const [minReviews, setMinReviews] = useState<number>(0);

  // Paste Mode State
  const [pastedText, setPastedText] = useState("");
  const [pasteWilaya, setPasteWilaya] = useState("Alger");
  const [pasteSector, setPasteSector] = useState("Cabinet médical");

  // Assignment & Campaign Options
  const [distributionMode, setDistributionMode] = useState<"SINGLE" | "ROUND_ROBIN">("SINGLE");
  const [assignedToId, setAssignedToId] = useState(currentUserId);
  const [selectedRoundRobinIds, setSelectedRoundRobinIds] = useState<string[]>(() =>
    salesUsers.map((u) => u.id)
  );
  const [campaignTag, setCampaignTag] = useState("");

  // Results & Selection State
  const [prospects, setProspects] = useState<GoogleMapsProspectItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [filterDuplicatesOnly, setFilterDuplicatesOnly] = useState(false);

  // Async Pending State
  const [isSearching, startSearching] = useTransition();
  const [isImporting, startImporting] = useTransition();

  // Notification / Toast
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Communes list according to chosen wilaya
  const availableCommunes = useMemo(() => {
    return WILAYA_COMMUNES[selectedWilaya] || ["Toutes les communes"];
  }, [selectedWilaya]);

  // Subcategories according to chosen sector
  const availableSubCategories = useMemo(() => {
    return SECTOR_SUBCATEGORIES[selectedSector] || [];
  }, [selectedSector]);

  // Count active advanced filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCommune !== "Toutes les communes") count++;
    if (selectedSubCategory) count++;
    if (onlyWithPhone) count++;
    if (onlyWithoutWebsite) count++;
    if (onlyWithWebsite) count++;
    if (minRating > 0) count++;
    if (minReviews > 0) count++;
    return count;
  }, [
    selectedCommune,
    selectedSubCategory,
    onlyWithPhone,
    onlyWithoutWebsite,
    onlyWithWebsite,
    minRating,
    minReviews,
  ]);

  // Search Action
  const handleSearch = () => {
    if (!searchQuery.trim() && !selectedSubCategory) return;
    setFeedback(null);
    startSearching(async () => {
      try {
        const res = await searchGoogleMapsProspectsAction({
          query: searchQuery,
          wilaya: selectedWilaya,
          commune: selectedCommune,
          sector: selectedSector,
          subCategory: selectedSubCategory,
          onlyWithPhone,
          onlyWithoutWebsite,
          onlyWithWebsite,
          minRating: minRating > 0 ? minRating : undefined,
          minReviews: minReviews > 0 ? minReviews : undefined,
          limit: 100,
        });

        if (res.success && res.prospects) {
          setProspects(res.prospects);
          // Select only non-duplicates by default
          const initialSelection: Record<string, boolean> = {};
          res.prospects.forEach((p) => {
            if (!p.isDuplicate && p.phone) {
              initialSelection[p.id] = true;
            }
          });
          setSelectedIds(initialSelection);

          if (res.prospects.length === 0) {
            setFeedback({
              type: "info",
              message: `Aucun établissement ne correspond aux critères pour "${searchQuery}" à ${selectedWilaya}${
                selectedCommune !== "Toutes les communes" ? ` (${selectedCommune})` : ""
              }. Essayez d'élargir vos filtres avancés.`,
            });
          } else {
            const newCount = res.prospects.filter((p) => !p.isDuplicate).length;
            setFeedback({
              type: "success",
              message: `${res.prospects.length} établissements trouvés (${newCount} nouveaux prospects qualifiés prêts à importer).`,
            });
          }
        }
      } catch (err: any) {
        setFeedback({
          type: "error",
          message: err?.message || "Erreur lors de la recherche avancée Google Maps.",
        });
      }
    });
  };

  // Parse Pasted Text Action
  const handleParsePasted = () => {
    if (!pastedText.trim()) return;
    setFeedback(null);
    startSearching(async () => {
      try {
        const res = await parseGoogleMapsTextAction({
          rawText: pastedText,
          defaultWilaya: pasteWilaya,
          defaultSector: pasteSector,
        });

        if (res.success && res.prospects) {
          setProspects(res.prospects);
          const initialSelection: Record<string, boolean> = {};
          res.prospects.forEach((p) => {
            if (!p.isDuplicate && p.phone) {
              initialSelection[p.id] = true;
            }
          });
          setSelectedIds(initialSelection);

          const newCount = res.prospects.filter((p) => !p.isDuplicate).length;
          setFeedback({
            type: "success",
            message: `${res.prospects.length} prospects extraits du texte (${newCount} nouveaux prospects qualifiés).`,
          });
        }
      } catch (err: any) {
        setFeedback({
          type: "error",
          message: err?.message || "Erreur lors de l'analyse du texte collé.",
        });
      }
    });
  };

  // Selection helpers
  const toggleSelectAll = (onlyNew: boolean = false) => {
    const next: Record<string, boolean> = {};
    prospects.forEach((p) => {
      if (onlyNew) {
        if (!p.isDuplicate) next[p.id] = true;
      } else {
        next[p.id] = true;
      }
    });
    setSelectedIds(next);
  };

  const deselectAll = () => {
    setSelectedIds({});
  };

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleRoundRobinUser = (userId: string) => {
    setSelectedRoundRobinIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const selectedCount = Object.values(selectedIds).filter(Boolean).length;
  const newCount = prospects.filter((p) => !p.isDuplicate).length;
  const duplicateCount = prospects.filter((p) => p.isDuplicate).length;

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    if (prospects.length === 0) return;
    const toExport = prospects.filter((p) => (selectedCount > 0 ? selectedIds[p.id] : true));

    const data = toExport.map((p) => ({
      "Entreprise": p.companyName,
      "Téléphone": p.formattedPhone || p.phone,
      "Wilaya": p.wilaya,
      "Adresse": p.address || "",
      "Secteur": p.sector,
      "Note Google": p.rating ? `${p.rating}/5` : "",
      "Nombre d'avis": p.reviewsCount || "",
      "Site Web": p.website || "",
      "Lien Google Maps": p.googleMapsUrl || "",
      "Statut CRM": p.isDuplicate
        ? p.duplicateType === "CLIENT"
          ? "Déjà Client"
          : "Déjà Prospect"
        : "Nouveau Prospect",
      "Détails Doublon": p.duplicateDetails || "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Google Maps DZ");
    XLSX.writeFile(
      wb,
      `prospects-maps-${selectedWilaya.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  // Import Action
  const handleImport = () => {
    const toImport = prospects.filter((p) => selectedIds[p.id]);
    if (toImport.length === 0) {
      setFeedback({ type: "error", message: "Veuillez cocher au moins un prospect à importer." });
      return;
    }

    if (distributionMode === "ROUND_ROBIN" && selectedRoundRobinIds.length === 0) {
      setFeedback({
        type: "error",
        message: "Veuillez sélectionner au moins un commercial pour la rotation équitable.",
      });
      return;
    }

    startImporting(async () => {
      try {
        const res = await importGoogleMapsProspectsAction({
          prospects: toImport,
          assignedToId: distributionMode === "SINGLE" ? assignedToId : undefined,
          assignedUserIds: distributionMode === "ROUND_ROBIN" ? selectedRoundRobinIds : undefined,
          campaignTag: campaignTag.trim() || undefined,
          defaultSector: activeTab === "SEARCH" ? selectedSector : pasteSector,
          defaultWilaya: activeTab === "SEARCH" ? selectedWilaya : pasteWilaya,
        });

        if (res.success) {
          const rotationMsg =
            distributionMode === "ROUND_ROBIN"
              ? ` répartis équitablement entre ${selectedRoundRobinIds.length} commerciaux`
              : "";
          setFeedback({
            type: "success",
            message: `🎉 ${res.imported} prospects importés avec succès dans le CRM${rotationMsg} ! (${res.duplicatesCount} doublons automatiquement ignorés).`,
          });
          // Update list status
          setProspects((prev) =>
            prev.map((p) =>
              selectedIds[p.id]
                ? { ...p, isDuplicate: true, duplicateDetails: "Vient d'être importé !" }
                : p
            )
          );
          setSelectedIds({});
        } else {
          setFeedback({ type: "error", message: res.error || "Erreur lors de l'import." });
        }
      } catch (err: any) {
        setFeedback({
          type: "error",
          message: err?.message || "Erreur serveur lors de l'importation.",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-blue-900/40 via-neutral-900 to-indigo-950/40 border border-blue-500/20 shadow-xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider border border-blue-500/30 flex items-center gap-1.5 shadow-sm">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              Direction & Acquisition
            </span>
            <span className="text-xs text-neutral-400">Algérie (58 Wilayas & Communes Ciblées)</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-neutral-100 flex items-center gap-3">
            Import Prospects Google Maps
          </h1>
          <p className="text-xs md:text-sm text-neutral-400 mt-1 max-w-2xl">
            Recherche avancée multicritère par commune, filtrage sans site web, note Google et répartition équitable (Round-Robin) entre commerciaux.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/base-prospects">
            <button className="px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition flex items-center gap-2 cursor-pointer">
              <Database className="w-3.5 h-3.5 text-neutral-400" />
              <span>Base Prospects</span>
            </button>
          </Link>
          <Link href="/prospection">
            <button className="px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition flex items-center gap-2 cursor-pointer">
              <Building2 className="w-3.5 h-3.5 text-neutral-400" />
              <span>File Prospection</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-1">
        <button
          onClick={() => setActiveTab("SEARCH")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all cursor-pointer ${
            activeTab === "SEARCH"
              ? "bg-neutral-800/90 text-blue-400 border-b-2 border-blue-500 shadow-sm"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Recherche Directe & Avancée</span>
          {activeFiltersCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-500 text-white">
              {activeFiltersCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("PASTE")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all cursor-pointer ${
            activeTab === "PASTE"
              ? "bg-neutral-800/90 text-blue-400 border-b-2 border-blue-500 shadow-sm"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
          }`}
        >
          <ClipboardPaste className="w-4 h-4" />
          <span>Copier / Coller Google Maps</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold">
            Extracteur
          </span>
        </button>
      </div>

      {/* Mode 1: Search Form with Advanced Search */}
      {activeTab === "SEARCH" && (
        <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-4 shadow-sm">
          {/* Preset Chips */}
          <div>
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
              Recherches fréquentes en Algérie :
            </span>
            <div className="flex flex-wrap gap-2">
              {POPULAR_QUERIES.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    setSearchQuery(item.query);
                    setSelectedSector(item.sector);
                    setSelectedSubCategory("");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer border ${
                    searchQuery === item.query
                      ? "bg-blue-600/30 text-blue-300 border-blue-500/50"
                      : "bg-neutral-800/60 text-neutral-300 border-neutral-700/60 hover:bg-neutral-750 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Primary Filters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Mot-clé / Activité
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ex: clinique, grossiste, hôtel, meuble..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 transition"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Wilaya d'Algérie
              </label>
              <select
                value={selectedWilaya}
                onChange={(e) => {
                  setSelectedWilaya(e.target.value);
                  setSelectedCommune("Toutes les communes");
                }}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 transition"
              >
                {WILAYAS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Secteur dans le CRM
              </label>
              <select
                value={selectedSector}
                onChange={(e) => {
                  setSelectedSector(e.target.value);
                  setSelectedSubCategory("");
                }}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 transition"
              >
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer h-[38px] ${
                  showAdvanced || activeFiltersCount > 0
                    ? "bg-blue-600/20 text-blue-300 border-blue-500/40"
                    : "bg-neutral-800/80 hover:bg-neutral-750 text-neutral-300 border-neutral-700"
                }`}
                title="Afficher/masquer les options de recherche avancée"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
                <span>Filtres Avancés</span>
                {activeFiltersCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-blue-500 text-[10px] text-white flex items-center justify-center font-bold">
                    {activeFiltersCount}
                  </span>
                )}
                {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <button
                onClick={handleSearch}
                disabled={isSearching || (!searchQuery.trim() && !selectedSubCategory)}
                className="flex-1 py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer h-[38px]"
              >
                {isSearching ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Recherche...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Rechercher</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ADVANCED SEARCH PANEL */}
          {showAdvanced && (
            <div className="p-4 rounded-2xl bg-neutral-950/70 border border-blue-500/30 space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Options de Recherche Avancée (Ciblage & Qualification)
                </span>
                {activeFiltersCount > 0 && (
                  <button
                    onClick={() => {
                      setSelectedCommune("Toutes les communes");
                      setSelectedSubCategory("");
                      setOnlyWithPhone(false);
                      setOnlyWithoutWebsite(false);
                      setOnlyWithWebsite(false);
                      setMinRating(0);
                      setMinReviews(0);
                    }}
                    className="text-[11px] text-neutral-400 hover:text-rose-400 transition cursor-pointer"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
              </div>

              {/* Row 1: Commune & Speciality */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Specific Commune / District */}
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Commune / Quartier d'Affaires ({selectedWilaya})
                  </label>
                  <select
                    value={selectedCommune}
                    onChange={(e) => setSelectedCommune(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-750 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 transition"
                  >
                    {availableCommunes.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subcategory / Speciality */}
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Spécialité précise ({selectedSector})
                  </label>
                  <select
                    value={selectedSubCategory}
                    onChange={(e) => setSelectedSubCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-750 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 transition"
                  >
                    <option value="">Toutes les spécialités</option>
                    {availableSubCategories.map((sub) => (
                      <option key={sub.label} value={sub.query}>
                        {sub.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Min Google Rating */}
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Note Google minimale
                  </label>
                  <select
                    value={minRating}
                    onChange={(e) => setMinRating(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-750 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 transition"
                  >
                    <option value="0">Toutes les notes</option>
                    <option value="3.5">⭐ 3.5 étoiles et plus</option>
                    <option value="4.0">⭐ 4.0 étoiles et plus (Top qualité)</option>
                    <option value="4.5">⭐ 4.5 étoiles et plus (Excellence)</option>
                  </select>
                </div>

                {/* Min Reviews Count */}
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Nombre d'avis Google
                  </label>
                  <select
                    value={minReviews}
                    onChange={(e) => setMinReviews(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-750 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 transition"
                  >
                    <option value="0">Tous les établissements</option>
                    <option value="5">Au moins 5 avis</option>
                    <option value="15">Au moins 15 avis (Activité établie)</option>
                    <option value="50">Au moins 50 avis (Forte notoriété)</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Qualification Checkboxes */}
              <div className="pt-2 border-t border-neutral-850 flex flex-wrap items-center gap-4 text-xs">
                {/* Only With Phone */}
                <label className="flex items-center gap-2 text-neutral-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyWithPhone}
                    onChange={(e) => setOnlyWithPhone(e.target.checked)}
                    className="rounded border-neutral-700 bg-neutral-900 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Uniquement avec numéro de téléphone (Appel immédiat)</span>
                </label>

                {/* Only Without Website (Prime Prospect for Web Agency) */}
                <label className="flex items-center gap-2 text-neutral-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyWithoutWebsite}
                    onChange={(e) => {
                      setOnlyWithoutWebsite(e.target.checked);
                      if (e.target.checked) setOnlyWithWebsite(false);
                    }}
                    className="rounded border-neutral-700 bg-neutral-900 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <Globe className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sans site web (Prospect idéal création de site BoosterA)</span>
                </label>

                {/* Only With Website */}
                <label className="flex items-center gap-2 text-neutral-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyWithWebsite}
                    onChange={(e) => {
                      setOnlyWithWebsite(e.target.checked);
                      if (e.target.checked) setOnlyWithoutWebsite(false);
                    }}
                    className="rounded border-neutral-700 bg-neutral-900 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <span>Avec site web existant (Audit / Refonte)</span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Paste Form */}
      {activeTab === "PASTE" && (
        <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <ClipboardPaste className="w-4 h-4 text-emerald-400" />
              Copiez-collez les résultats de recherche Google Maps ou des listes d'entreprises :
            </span>
            <button
              onClick={() =>
                setPastedText(`Clinique Médico Chirurgicale El Azhar
4,3 (682) · Clinique privée
Rue Ahmed Ouaked, Dely Ibrahim
023 37 55 55

Société Générale Algérie
4,0 (120) · Banque & Entreprise
Chéraga Alger
021 45 11 55

Hôtel Mercure Aéroport Alger
4,1 (1500) · Hôtel 4 étoiles
BP 12 5 Route de l'Aéroport, Bab Ezzouar
021 24 59 70`)
              }
              className="text-xs text-blue-400 hover:text-blue-300 underline cursor-pointer"
            >
              Insérer un exemple de test
            </button>
          </div>

          <textarea
            rows={6}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Collez ici le texte copié depuis Google Maps..."
            className="w-full p-3 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 font-mono transition"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Wilaya par défaut
              </label>
              <select
                value={pasteWilaya}
                onChange={(e) => setPasteWilaya(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 transition"
              >
                {WILAYAS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Secteur par défaut
              </label>
              <select
                value={pasteSector}
                onChange={(e) => setPasteSector(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 transition"
              >
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleParsePasted}
                disabled={isSearching || !pastedText.trim()}
                className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer h-[38px]"
              >
                {isSearching ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Extraction en cours...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Extraire les Prospects</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-3.5 text-xs rounded-2xl font-medium border flex items-center gap-2.5 ${
            feedback.type === "success"
              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
              : feedback.type === "error"
              ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
              : "bg-blue-500/10 text-blue-300 border-blue-500/30"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : feedback.type === "error" ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <HelpCircle className="w-4 h-4 text-blue-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Results Section */}
      {prospects.length > 0 && (
        <div className="space-y-4">
          {/* Actions Bar & Selection Controls */}
          <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col gap-4 shadow-sm">
            {/* Top row of action bar */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-neutral-200">
                  {prospects.length} Établissements :
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {newCount} Nouveaux
                </span>
                {duplicateCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {duplicateCount} Doublons détectés
                  </span>
                )}

                <div className="h-4 w-px bg-neutral-750 mx-1 hidden sm:block" />

                <button
                  onClick={() => toggleSelectAll(true)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border border-neutral-700 transition cursor-pointer"
                  title="Cocher uniquement les entreprises qui ne sont pas encore dans le CRM"
                >
                  Cocher nouveaux ({newCount})
                </button>
                <button
                  onClick={() => toggleSelectAll(false)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border border-neutral-700 transition cursor-pointer"
                >
                  Tout cocher
                </button>
                <button
                  onClick={deselectAll}
                  className="text-xs px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border border-neutral-700 transition cursor-pointer"
                >
                  Tout décocher
                </button>
              </div>

              {/* Export Excel Button */}
              <button
                onClick={handleExportExcel}
                className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="Télécharger la sélection en fichier Excel .xlsx"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exporter Excel ({selectedCount > 0 ? selectedCount : prospects.length})</span>
              </button>
            </div>

            {/* Bottom row: Assignment & Import Controls */}
            <div className="pt-3 border-t border-neutral-800 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Distribution Mode Switch */}
                <div className="flex items-center rounded-xl bg-neutral-950 p-1 border border-neutral-800 text-xs">
                  <button
                    onClick={() => setDistributionMode("SINGLE")}
                    className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      distributionMode === "SINGLE"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    <Users className="w-3 h-3" />
                    <span>Commercial Unique</span>
                  </button>
                  <button
                    onClick={() => setDistributionMode("ROUND_ROBIN")}
                    className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      distributionMode === "ROUND_ROBIN"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>Rotation Équitable (Round-Robin)</span>
                  </button>
                </div>

                {/* Single Assignee */}
                {distributionMode === "SINGLE" ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-400">Assigner à :</span>
                    <select
                      value={assignedToId}
                      onChange={(e) => setAssignedToId(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-neutral-950 border border-neutral-750 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500"
                    >
                      {salesUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} {u.id === currentUserId ? "(Moi)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  /* Round-Robin Multi-Select Users */
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-neutral-400 mr-1">Commerciaux inclus :</span>
                    {salesUsers.map((u) => {
                      const isChecked = selectedRoundRobinIds.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleRoundRobinUser(u.id)}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border transition cursor-pointer flex items-center gap-1 ${
                            isChecked
                              ? "bg-indigo-600/30 text-indigo-300 border-indigo-500/50"
                              : "bg-neutral-950 text-neutral-400 border-neutral-800 opacity-60"
                          }`}
                        >
                          {isChecked && <Check className="w-2.5 h-2.5 text-indigo-400" />}
                          <span>{u.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Campaign Tag */}
                <div className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-neutral-400" />
                  <input
                    type="text"
                    value={campaignTag}
                    onChange={(e) => setCampaignTag(e.target.value)}
                    placeholder="Tag campagne (ex: Mars 2026)..."
                    className="px-2.5 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 w-44"
                  />
                </div>
              </div>

              {/* Batch Import Button */}
              <button
                onClick={handleImport}
                disabled={isImporting || selectedCount === 0}
                className="w-full xl:w-auto py-2.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importation en cours...</span>
                  </>
                ) : (
                  <>
                    <DownloadCloud className="w-4 h-4" />
                    <span>
                      Importer dans le CRM ({selectedCount} prospects)
                      {distributionMode === "ROUND_ROBIN" ? ` • Répartition équitable` : ""}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Prospects Table */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-950/60 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedCount > 0 && selectedCount === prospects.length}
                        onChange={(e) => (e.target.checked ? toggleSelectAll(false) : deselectAll())}
                        className="rounded border-neutral-700 bg-neutral-800 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                    </th>
                    <th className="p-3">Établissement & Wilaya</th>
                    <th className="p-3">Numéro Téléphone</th>
                    <th className="p-3">Secteur / Activité</th>
                    <th className="p-3">Adresse & Google Maps</th>
                    <th className="p-3">Statut CRM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-850 text-xs">
                  {prospects.map((item) => {
                    const isSelected = Boolean(selectedIds[item.id]);

                    return (
                      <tr
                        key={item.id}
                        className={`transition hover:bg-neutral-800/40 ${
                          item.isDuplicate ? "opacity-75 bg-amber-950/5" : ""
                        } ${isSelected ? "bg-blue-600/10" : ""}`}
                      >
                        {/* Checkbox */}
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleItem(item.id)}
                            className="rounded border-neutral-700 bg-neutral-800 text-blue-600 focus:ring-0 cursor-pointer"
                          />
                        </td>

                        {/* Company & Details */}
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-neutral-100 flex items-center gap-1.5">
                              {item.companyName}
                              {item.rating && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-semibold">
                                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                  {item.rating}
                                  {item.reviewsCount ? ` (${item.reviewsCount})` : ""}
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] text-neutral-400 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-neutral-500" />
                              {item.wilaya}
                            </span>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="p-3">
                          {item.phone ? (
                            <a
                              href={`tel:${item.phone}`}
                              className="font-mono font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5"
                            >
                              <Phone className="w-3.5 h-3.5 text-emerald-500" />
                              {item.formattedPhone || item.phone}
                            </a>
                          ) : (
                            <span className="text-neutral-500 italic text-[11px]">Non renseigné</span>
                          )}
                        </td>

                        {/* Sector */}
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-750">
                            {item.sector}
                          </span>
                        </td>

                        {/* Address & Links */}
                        <td className="p-3 max-w-xs">
                          <div className="flex flex-col gap-1">
                            <span className="truncate text-neutral-300 text-[11px]" title={item.address}>
                              {item.address || "Algérie"}
                            </span>
                            <div className="flex items-center gap-2">
                              {item.googleMapsUrl && (
                                <a
                                  href={item.googleMapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 font-medium"
                                >
                                  <span>Voir sur Maps</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                              {item.website ? (
                                <a
                                  href={item.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 font-medium"
                                >
                                  <Globe className="w-2.5 h-2.5" />
                                  <span>Site web</span>
                                </a>
                              ) : (
                                <span className="text-[10px] text-amber-400/80 font-medium">
                                  Pas de site web
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Duplicate Status */}
                        <td className="p-3">
                          {item.isDuplicate ? (
                            <div className="flex flex-col gap-0.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  item.duplicateType === "CLIENT"
                                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                }`}
                              >
                                <AlertCircle className="w-3 h-3" />
                                {item.duplicateType === "CLIENT" ? "Déjà Client" : "Déjà Prospect"}
                              </span>
                              {item.duplicateDetails && (
                                <span className="text-[10px] text-neutral-400 truncate max-w-[180px]" title={item.duplicateDetails}>
                                  {item.duplicateDetails}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              Nouveau Prospect
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
