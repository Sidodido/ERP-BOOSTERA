"use client";

import React, { useState, useTransition, useMemo, useEffect } from "react";
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
  Upload,
  Key,
  Copy,
  AlertTriangle,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  searchGoogleMapsProspectsAction,
  parseGoogleMapsTextAction,
  importGoogleMapsProspectsAction,
  checkProspectsDuplicatesAction,
  testGoogleMapsApiKeyAction,
  type GoogleMapsProspectItem,
} from "@/actions/googleMapsProspects";
import { cleanDzPhone, formatDzPhoneDisplay } from "@/lib/phoneUtils";
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

const SECTOR_CARDS = [
  { sector: "Cabinet médical", label: "Santé & Cliniques", icon: "🩺", desc: "Cliniques, Dentistes, Hôpitaux, Labos" },
  { sector: "Industrie", label: "Industrie & Grossistes", icon: "🏭", desc: "Grossistes, Usines, Import-Export, BTP" },
  { sector: "Immobilier", label: "Immobilier & BTP", icon: "🏢", desc: "Agences immo, Promoteurs, Bureaux études" },
  { sector: "Hôtel", label: "Hôtels & Hébergement", icon: "🏨", desc: "Hôtels 3/4*, Résidences, Complexes" },
  { sector: "Restaurant", label: "Restaurants & Cafés", icon: "🍽️", desc: "Restaurants, Pizzerias, Salons de thé" },
  { sector: "Voyage", label: "Voyages & Omra", icon: "✈️", desc: "Agences voyages, Omra, Visas" },
  { sector: "Éducation / Formation", label: "Écoles & Formations", icon: "🎓", desc: "Écoles privées, Centres formation, Langues" },
  { sector: "Beauté", label: "Beauté & Cosmétique", icon: "💄", desc: "Salons coiffure, Spas, Parfumeries" },
  { sector: "E-commerce", label: "Commerce & Showrooms", icon: "🛍️", desc: "Showrooms, Meubles, Électroménager" },
  { sector: "Autre prestation", label: "Services & Entreprises", icon: "💼", desc: "Salles des fêtes, Cabinets juridiques, Audit" },
];

export function GoogleMapsImporterClient({ salesUsers, currentUserId }: GoogleMapsImporterClientProps) {
  const [activeTab, setActiveTab] = useState<"PASTE" | "FILE">("PASTE");

  // Search State: Sector-First
  const [selectedSector, setSelectedSector] = useState("Cabinet médical");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [selectedWilaya, setSelectedWilaya] = useState("Alger");
  const [selectedCommune, setSelectedCommune] = useState("Toutes les communes");
  const [searchQuery, setSearchQuery] = useState(""); // optional refine keyword

  // Advanced Search Filters State
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showRefineKeyword, setShowRefineKeyword] = useState(false);
  const [onlyWithPhone, setOnlyWithPhone] = useState(true);
  const [onlyWithoutWebsite, setOnlyWithoutWebsite] = useState(false);
  const [onlyWithWebsite, setOnlyWithWebsite] = useState(false);
  const [minRating, setMinRating] = useState<number>(0);
  const [minReviews, setMinReviews] = useState<number>(0);

  // Google Places API Key (optional)
  const [showApiKeySettings, setShowApiKeySettings] = useState(false);
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [isTestingApiKey, setIsTestingApiKey] = useState(false);
  const [apiKeyTestResult, setApiKeyTestResult] = useState<{
    success: boolean;
    message: string;
    apiType?: "NEW" | "LEGACY";
    errorDetails?: string;
  } | null>(null);
  const [googleApiWarning, setGoogleApiWarning] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("crm_gplaces_api_key") || "";
      if (savedKey) setGoogleApiKey(savedKey);
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    setGoogleApiKey(key);
    setApiKeyTestResult(null);
    setGoogleApiWarning(null);
    if (typeof window !== "undefined") {
      if (key.trim()) {
        localStorage.setItem("crm_gplaces_api_key", key.trim());
      } else {
        localStorage.removeItem("crm_gplaces_api_key");
      }
    }
  };

  const handleTestApiKey = async () => {
    if (!googleApiKey.trim()) {
      setApiKeyTestResult({
        success: false,
        message: "Veuillez d'abord saisir une clé API.",
      });
      return;
    }
    setIsTestingApiKey(true);
    setApiKeyTestResult(null);
    try {
      const res = await testGoogleMapsApiKeyAction(googleApiKey.trim());
      setApiKeyTestResult(res);
    } catch (err: any) {
      setApiKeyTestResult({
        success: false,
        message: "Erreur de communication",
        errorDetails: err?.message || "Impossible de joindre le serveur.",
      });
    } finally {
      setIsTestingApiKey(false);
    }
  };

  // Paste Mode State
  const [pastedText, setPastedText] = useState("");
  const [pasteWilaya, setPasteWilaya] = useState("Alger");
  const [pasteSector, setPasteSector] = useState("Cabinet médical");

  // File Upload State
  const [fileName, setFileName] = useState("");

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
    if (searchQuery.trim()) count++;
    return count;
  }, [
    selectedCommune,
    selectedSubCategory,
    onlyWithPhone,
    onlyWithoutWebsite,
    onlyWithWebsite,
    minRating,
    minReviews,
    searchQuery,
  ]);

  // Search Action: Direct by Sector
  const handleSearch = () => {
    if (!selectedSector) return;
    setFeedback(null);
    startSearching(async () => {
      try {
        const res = await searchGoogleMapsProspectsAction({
          sector: selectedSector,
          subCategory: selectedSubCategory,
          query: searchQuery.trim(),
          wilaya: selectedWilaya,
          commune: selectedCommune,
          onlyWithPhone,
          onlyWithoutWebsite,
          onlyWithWebsite,
          minRating: minRating > 0 ? minRating : undefined,
          minReviews: minReviews > 0 ? minReviews : undefined,
          limit: 100,
          googleApiKey: googleApiKey.trim() || undefined,
        });

        if (res.googleApiStatus?.error) {
          setGoogleApiWarning(res.googleApiStatus.error);
        } else {
          setGoogleApiWarning(null);
        }

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
              message: `Aucun établissement trouvé pour le secteur "${selectedSector}"${
                selectedSubCategory ? ` (${selectedSubCategory})` : ""
              } à ${selectedWilaya}${
                selectedCommune !== "Toutes les communes" ? ` (${selectedCommune})` : ""
              }. Vous pouvez élargir les critères ou cliquer sur "Ouvrir sur Maps" puis utiliser le "📋 Coller 1-Clic".`,
            });
          } else {
            const newCount = res.prospects.filter((p) => !p.isDuplicate).length;
            const apiNotice = res.googleApiStatus?.success
              ? " (via Google Places API Officiel ✨)"
              : "";
            setFeedback({
              type: "success",
              message: `${res.prospects.length} établissements trouvés${apiNotice} dans le secteur "${selectedSector}" (${newCount} nouveaux prospects qualifiés prêts à importer).`,
            });
          }
        }
      } catch (err: any) {
        setFeedback({
          type: "error",
          message: err?.message || "Erreur lors de la recherche du secteur Google Maps.",
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

  // 1-Click Clipboard Import Action
  const handleClipboardImport = async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        setFeedback({
          type: "error",
          message: "L'accès au presse-papier n'est pas supporté par ce navigateur. Utilisez le copier-coller standard.",
        });
        return;
      }
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setFeedback({
          type: "info",
          message: "Votre presse-papier est vide. Copiez d'abord des résultats ou une fiche depuis Google Maps.",
        });
        return;
      }
      setPastedText(text);
      setActiveTab("PASTE");
      setFeedback(null);

      startSearching(async () => {
        try {
          const res = await parseGoogleMapsTextAction({
            rawText: text,
            defaultWilaya: selectedWilaya,
            defaultSector: selectedSector,
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
              message: `📋 ${res.prospects.length} prospects extraits en 1 clic depuis votre presse-papier (${newCount} nouveaux qualifiés) !`,
            });
          }
        } catch (err: any) {
          setFeedback({
            type: "error",
            message: err?.message || "Erreur lors de l'analyse du presse-papier.",
          });
        }
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: "Permission de lecture du presse-papier refusée par votre navigateur. Collez manuellement avec Ctrl+V.",
      });
    }
  };

  // File Upload (CSV / XLSX) Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setFeedback(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);

        if (!rows || rows.length === 0) {
          setFeedback({ type: "error", message: "Le fichier importé est vide." });
          return;
        }

        // Auto-detect columns
        const rawProspects: GoogleMapsProspectItem[] = [];
        const seenKeys = new Set<string>();

        rows.forEach((row, idx) => {
          // Find company name
          const nameKey = Object.keys(row).find((k) =>
            /name|nom|title|titre|company|entreprise|etablissement|raison\s*sociale/i.test(k)
          );
          const name = nameKey ? String(row[nameKey] || "").trim() : "";
          if (!name || name.length < 2) return;

          // Find phone
          const phoneKey = Object.keys(row).find((k) =>
            /phone|tel|telephone|numéro|numero|mobile|contact/i.test(k)
          );
          const rawPhone = phoneKey ? String(row[phoneKey] || "") : "";
          const cleanPhone = cleanDzPhone(rawPhone);

          // Find address
          const addrKey = Object.keys(row).find((k) =>
            /address|adresse|street|rue|location/i.test(k)
          );
          const address = addrKey ? String(row[addrKey] || "").trim() : "";

          // Find wilaya
          const wilayaKey = Object.keys(row).find((k) =>
            /wilaya|city|ville|state|region/i.test(k)
          );
          const wilaya = wilayaKey ? String(row[wilayaKey] || "").trim() : selectedWilaya;

          // Find sector / category
          const secKey = Object.keys(row).find((k) =>
            /category|categorie|sector|secteur|type|industry/i.test(k)
          );
          const sector = secKey ? String(row[secKey] || "").trim() : selectedSector;

          // Find rating & reviews
          const ratingKey = Object.keys(row).find((k) => /rating|note|stars/i.test(k));
          const ratingVal = ratingKey ? parseFloat(String(row[ratingKey]).replace(",", ".")) : undefined;

          const reviewsKey = Object.keys(row).find((k) => /review|reviews|avis/i.test(k));
          const reviewsVal = reviewsKey ? parseInt(String(row[reviewsKey]).replace(/\D/g, ""), 10) : undefined;

          // Find website
          const siteKey = Object.keys(row).find((k) => /website|site|url|web/i.test(k));
          const website = siteKey ? String(row[siteKey] || "").trim() : undefined;

          // Dedupe inside uploaded file
          const dedupeKey = `${name.toLowerCase()}_${cleanPhone || address.toLowerCase()}`;
          if (seenKeys.has(dedupeKey)) return;
          seenKeys.add(dedupeKey);

          rawProspects.push({
            id: `file_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            companyName: name,
            phone: cleanPhone,
            formattedPhone: cleanPhone ? formatDzPhoneDisplay(cleanPhone) : "",
            address: address || `${wilaya}, Algérie`,
            wilaya: wilaya || selectedWilaya,
            sector: sector || selectedSector,
            rating: isNaN(ratingVal as number) ? undefined : ratingVal,
            reviewsCount: isNaN(reviewsVal as number) ? undefined : reviewsVal,
            website,
            source: `Fichier (${file.name})`,
          });
        });

        if (rawProspects.length === 0) {
          setFeedback({
            type: "error",
            message: "Aucune entreprise valide n'a pu être extraite des colonnes du fichier.",
          });
          return;
        }

        // Check duplicates against Prisma
        startSearching(async () => {
          try {
            const verified = await checkProspectsDuplicatesAction(rawProspects);
            setProspects(verified);

            const initialSelection: Record<string, boolean> = {};
            verified.forEach((p) => {
              if (!p.isDuplicate && p.phone) {
                initialSelection[p.id] = true;
              }
            });
            setSelectedIds(initialSelection);

            const newCount = verified.filter((p) => !p.isDuplicate).length;
            setFeedback({
              type: "success",
              message: `📂 ${verified.length} établissements importés depuis "${file.name}" (${newCount} nouveaux prospects qualifiés) !`,
            });
          } catch (err: any) {
            setFeedback({
              type: "error",
              message: err?.message || "Erreur lors de la vérification des doublons du fichier.",
            });
          }
        });
      } catch (err: any) {
        setFeedback({
          type: "error",
          message: "Format de fichier invalide. Veuillez importer un fichier .xlsx ou .csv valide.",
        });
      }
    };
    reader.readAsBinaryString(file);
  };

  // Phone counters & filter state
  const [filterWithPhoneOnly, setFilterWithPhoneOnly] = useState(false);
  const withPhoneCount = prospects.filter((p) => Boolean(p.phone)).length;
  const withoutPhoneCount = prospects.length - withPhoneCount;

  const displayedProspects = useMemo(() => {
    if (!filterWithPhoneOnly) return prospects;
    return prospects.filter((p) => Boolean(p.phone));
  }, [prospects, filterWithPhoneOnly]);

  // Selection helpers
  const toggleSelectAll = (onlyNew: boolean = false, onlyWithPhoneFlag: boolean = false) => {
    const next: Record<string, boolean> = {};
    displayedProspects.forEach((p) => {
      if (onlyNew && p.isDuplicate) return;
      if (onlyWithPhoneFlag && !p.phone) return;
      next[p.id] = true;
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
          defaultSector: pasteSector,
          defaultWilaya: pasteWilaya,
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-1">
        <div className="flex items-center gap-1 sm:gap-2">

          <button
            onClick={() => setActiveTab("PASTE")}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all cursor-pointer ${
              activeTab === "PASTE"
                ? "bg-neutral-800/90 text-blue-400 border-b-2 border-blue-500 shadow-sm"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
            }`}
          >
            <ClipboardPaste className="w-4 h-4" />
            <span>Copier-Coller Maps</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold hidden sm:inline">
              Extracteur
            </span>
          </button>

          <button
            onClick={() => setActiveTab("FILE")}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all cursor-pointer ${
              activeTab === "FILE"
                ? "bg-neutral-800/90 text-blue-400 border-b-2 border-blue-500 shadow-sm"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Fichier CSV / Excel</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 font-bold hidden sm:inline">
              Scraper
            </span>
          </button>
        </div>

        {/* Quick Actions in tab bar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClipboardImport}
            className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Extraire instantanément tout ce qui est copié dans votre presse-papier"
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
            <span>📋 Coller 1-Clic</span>
          </button>

          <button
            type="button"
            onClick={() => setShowApiKeySettings(!showApiKeySettings)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              googleApiKey
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-neutral-800/80 hover:bg-neutral-750 text-neutral-300 border-neutral-700"
            }`}
            title="Configurer une clé API Google Places officielle"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Clé API Google</span>
            {googleApiKey && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
          </button>
        </div>
      </div>

      {/* Google Places API Key Settings Panel */}
      {showApiKeySettings && (
        <div className="p-5 rounded-2xl bg-neutral-950 border border-amber-500/30 space-y-3.5 animate-in fade-in slide-in-from-top-2 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-850 pb-2.5">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Key className="w-4 h-4" />
              Configuration Clé API Google Places
            </span>
            <span className="text-[11px] text-neutral-400">
              Offre Google Cloud : 200$/mois offerts (~40 000 requêtes gratuites)
            </span>
          </div>

          <p className="text-xs text-neutral-300 leading-relaxed">
            La clé API Google Places permet au CRM d&apos;interroger directement les serveurs officiels de Google Maps pour récupérer 100% des coordonnées (téléphones fixes/mobiles vérifiés, adresses exactes, notes et sites web).
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={googleApiKey}
                onChange={(e) => handleSaveApiKey(e.target.value)}
                placeholder="Collez votre clé Google Cloud (ex: AIzaSy...)"
                className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-750 rounded-xl text-neutral-200 font-mono focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            <button
              type="button"
              onClick={handleTestApiKey}
              disabled={isTestingApiKey || !googleApiKey.trim()}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              {isTestingApiKey ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Test en cours...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Tester la clé</span>
                </>
              )}
            </button>

            {googleApiKey && (
              <button
                type="button"
                onClick={() => handleSaveApiKey("")}
                className="px-3 py-2 text-xs text-rose-400 hover:text-rose-300 border border-neutral-800 rounded-xl transition cursor-pointer"
              >
                Supprimer
              </button>
            )}
          </div>

          {/* Test Diagnostic Result */}
          {apiKeyTestResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-1.5 animate-in fade-in ${
                apiKeyTestResult.success
                  ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                  : "bg-rose-950/40 border-rose-500/40 text-rose-200"
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs">
                {apiKeyTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                )}
                <span>{apiKeyTestResult.message}</span>
              </div>
              {apiKeyTestResult.errorDetails && (
                <p className="text-[11px] leading-relaxed opacity-90 pl-6">
                  {apiKeyTestResult.errorDetails}
                </p>
              )}
            </div>
          )}

          {/* Educational Diagnostic Guide */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-neutral-850 text-xs">
            <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1.5">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Pourquoi Google Cloud peut refuser la clé ?
              </div>
              <ul className="list-disc list-inside text-[11px] text-neutral-400 space-y-1">
                <li>
                  <strong className="text-neutral-300">Places API désactivée :</strong> Activez &quot;Places API&quot; et &quot;Places API (New)&quot; dans votre console Google Cloud.
                </li>
                <li>
                  <strong className="text-neutral-300">Facturation obligatoire :</strong> Google exige d&apos;activer la facturation (carte bancaire), même si vous avez 200$/mois offerts.
                </li>
                <li>
                  <strong className="text-neutral-300">Restriction de clé HTTP :</strong> Ne restreignez pas la clé par domaine web (le CRM l&apos;appelle depuis le serveur). Réglez sur &quot;Aucune&quot; ou &quot;Adresses IP&quot;.
                </li>
                <li>
                  <strong className="text-neutral-300">Clé Gemini non compatible :</strong> Une clé commençant par <code className="text-amber-400">AQ.</code> est pour l&apos;IA Gemini, pas pour Google Maps.
                </li>
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-1.5">
              <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
                Alternative 100% Gratuite (Sans carte bancaire) :
              </div>
              <p className="text-[11px] text-neutral-300 leading-relaxed">
                Vous n&apos;avez pas de compte Google Cloud ? Utilisez la méthode la plus populaire :
              </p>
              <ol className="list-decimal list-inside text-[11px] text-neutral-400 space-y-1">
                <li>Cliquez sur le bouton bleu <strong className="text-blue-300">&quot;Ouvrir sur Maps&quot;</strong>.</li>
                <li>Sur Google Maps, faites <strong className="text-neutral-200">Ctrl+A</strong> puis <strong className="text-neutral-200">Ctrl+C</strong> pour tout copier.</li>
                <li>Revenez ici et cliquez sur <strong className="text-emerald-300">&quot;📋 Coller 1-Clic&quot;</strong>.</li>
              </ol>
              <div className="text-[10px] text-emerald-400/80 font-medium">
                👉 Vous obtenez instantanément tous les prospects avec leurs numéros réels sans payer aucun frais API !
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Mode 2: Paste Form */}
      {activeTab === "PASTE" && (
        <div className="p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4 shadow-sm">
          {/* Top 1-Click Clipboard Action */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/60 to-neutral-950 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
            <div>
              <div className="text-xs font-black text-emerald-300 flex items-center gap-1.5 uppercase tracking-wider">
                <ClipboardPaste className="w-4 h-4 text-emerald-400" />
                Extraction 1-Clic depuis votre Presse-Papier
              </div>
              <p className="text-xs text-neutral-300 mt-0.5">
                Copiez n&apos;importe quelle page ou fiche Google Maps (Ctrl+A puis Ctrl+C), puis cliquez ci-contre :
              </p>
            </div>
            <button
              type="button"
              onClick={handleClipboardImport}
              disabled={isSearching}
              className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer shrink-0"
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>📋 Coller & Extraire en 1 Clic</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-neutral-400 pt-1">
            <span className="flex items-center gap-1.5 text-neutral-300 font-semibold">
              Ou collez manuellement votre texte ci-dessous (Ctrl+V) :
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
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
          </div>

          <textarea
            rows={7}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Collez ici le texte copié depuis Google Maps (ou faites Ctrl+V)..."
            className="w-full p-3.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-emerald-500 font-mono transition"
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

      {/* Mode 3: File Upload Tab (CSV / XLSX) */}
      {activeTab === "FILE" && (
        <div className="p-6 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span className="text-xs font-bold text-neutral-200 flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-400" />
              Importer des prospects depuis un fichier (CSV ou Excel .xlsx)
            </span>
            <span className="text-xs text-neutral-400">
              Compatible avec Instant Data Scraper, G-Maps Extractor, Apify, Octoparse
            </span>
          </div>

          <div className="border-2 border-dashed border-neutral-750 hover:border-indigo-500/50 rounded-2xl p-8 text-center transition bg-neutral-950/40 relative group">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 group-hover:bg-indigo-600/20 text-indigo-400 flex items-center justify-center transition border border-indigo-500/20">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-200">
                  {fileName ? (
                    <span className="text-emerald-400 font-bold">Fichier sélectionné : {fileName}</span>
                  ) : (
                    "Glissez-déposez votre fichier ici, ou cliquez pour parcourir"
                  )}
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  Détection automatique des colonnes (Nom d'entreprise, Téléphone, Adresse, Wilaya, Secteur, Note, Avis, Site)
                </p>
              </div>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-indigo-600 group-hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition pointer-events-none"
              >
                Parcourir les fichiers (.csv, .xlsx)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google API Diagnostic Warning Banner */}
      {googleApiWarning && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-3 shadow-md animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5 flex-1">
            <div className="font-bold text-amber-300 flex items-center justify-between">
              <span>Diagnostic Clé Google Places API</span>
              <button
                type="button"
                onClick={() => setGoogleApiWarning(null)}
                className="text-[11px] text-amber-400/70 hover:text-amber-200 cursor-pointer"
              >
                Ignorer
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-200/90">{googleApiWarning}</p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
              <button
                type="button"
                onClick={() => setShowApiKeySettings(true)}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold border border-amber-500/30 cursor-pointer"
              >
                ⚙️ Vérifier / Corriger la clé
              </button>
              <span className="text-neutral-400">
                💡 Les résultats ci-dessous ont été complétés via l&apos;annuaire de secours.
              </span>
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
          {/* Missing Phone Alert (Occurs when user copies from standard Google Maps overview which hides phone numbers) */}
          {withoutPhoneCount > 0 && withPhoneCount === 0 && (
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs space-y-2.5 animate-in fade-in">
              <div className="font-bold flex items-center gap-2 text-amber-300 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Pourquoi tous les numéros indiquent &quot;Non renseigné&quot; ?</span>
              </div>
              <p className="text-neutral-300 leading-relaxed">
                Sur le site <strong>Google Maps classique (maps.google.com)</strong>, Google <u>masque volontairement</u> les numéros de téléphone dans la liste des résultats. En sélectionnant tout avec <em>Ctrl+A</em> sur cette page, aucun numéro n&apos;est copié.
              </p>
              <div className="p-3 rounded-xl bg-neutral-900/90 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="text-[11px] text-neutral-300">
                  <span className="font-bold text-emerald-400">💡 Solution 100% Efficace : </span>
                  Ouvrez <strong>Google Local</strong> où <u>chaque carte affiche son numéro de téléphone en clair</u> (ex: <em>023 37 80 00</em> ou <em>0550...</em>).
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <a
                    href={`https://www.google.com/search?tbm=lcl&q=${encodeURIComponent(
                      [
                        selectedSubCategory || selectedSector,
                        selectedCommune !== "Toutes les communes" ? selectedCommune : "",
                        selectedWilaya,
                        "Algérie",
                      ]
                        .filter(Boolean)
                        .join(" ")
                    )}&hl=fr`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>1. Ouvrir Google Local ↗</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleClipboardImport}
                    className="py-2 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>2. Re-Coller 1-Clic</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Actions Bar & Selection Controls */}
          <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col gap-4 shadow-sm">
            {/* Top row of action bar */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-neutral-200">
                  {displayedProspects.length}{" "}
                  {filterWithPhoneOnly ? "Établissements (avec tél)" : "Établissements"} :
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

                {/* Filter phone toggle if mixed */}
                {withPhoneCount > 0 && withoutPhoneCount > 0 && (
                  <button
                    onClick={() => setFilterWithPhoneOnly(!filterWithPhoneOnly)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                      filterWithPhoneOnly
                        ? "bg-emerald-600/30 text-emerald-300 border-emerald-500/50"
                        : "bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border-neutral-700"
                    }`}
                    title="Afficher uniquement les prospects qui ont un numéro de téléphone"
                  >
                    <Phone className="w-3 h-3 text-emerald-400" />
                    <span>Avec téléphone ({withPhoneCount})</span>
                  </button>
                )}

                <button
                  onClick={() => toggleSelectAll(true, true)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border border-neutral-700 transition cursor-pointer"
                  title="Cocher uniquement les nouveaux prospects qui ont un numéro de téléphone"
                >
                  Cocher nouveaux avec tél ({prospects.filter((p) => !p.isDuplicate && p.phone).length})
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
                <span>Exporter Excel ({selectedCount > 0 ? selectedCount : displayedProspects.length})</span>
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
                        checked={selectedCount > 0 && selectedCount === displayedProspects.length}
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
                  {displayedProspects.map((item) => {
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
                            <span className="font-bold text-neutral-100 flex items-center flex-wrap gap-1.5">
                              {item.companyName}
                              {item.rating && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-semibold">
                                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                  {item.rating}
                                  {item.reviewsCount ? ` (${item.reviewsCount})` : ""}
                                </span>
                              )}
                              {item.source === "Google Places API (Officiel)" && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                  Google Places ✨
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
