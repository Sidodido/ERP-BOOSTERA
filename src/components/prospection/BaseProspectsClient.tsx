"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { SECTORS, WILAYAS, PROSPECT_STATUSES, CALL_RESULTS, APPOINTMENT_TYPES } from "@/lib/constants";
import { ProspectStatus, CallResult, AppointmentType } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatDate, toLocalDateString, buildWhatsAppUrl, isVirginProspect } from "@/lib/utils";
import { WhatsAppIcon } from "@/components/common/WhatsAppIcon";
import { trackCommunicationClick } from "@/lib/tracking";
import {
  createProspect,
  updateProspect,
  updateProspectField,
  assignProspect,
  deleteProspect,
  bulkImportProspects,
  importLocalProspectionFile,
  syncContactedProspectsToFollowUpsAction,
} from "@/actions/prospects";
import { logCallAction } from "@/actions/calls";
import { createAppointmentAction } from "@/actions/appointments";
import {
  Plus,
  Search,
  Phone,
  Calendar,
  Building,
  PhoneCall,
  CheckCircle2,
  FileSpreadsheet,
  Zap,
  Table,
  LayoutGrid,
  FileText,
  Edit3,
  User,
  Trash2,
  Save,
  RotateCw,
  ShieldCheck,
  Database,
  Download,
  Flame,
  ArrowUpRight,
  Filter,
  Users,
  Check,
  Clock,
  Briefcase,
  Mail,
  Sparkles,
} from "lucide-react";
import * as XLSX from "xlsx";
import { ProspectAiEmailModal } from "@/components/prospection/ProspectAiEmailModal";

interface ProspectItem {
  id: string;
  companyName: string;
  contactName: string | null;
  phone: string;
  email: string | null;
  sector: string;
  wilaya: string;
  address: string | null;
  status: ProspectStatus;
  rawState?: string | null;
  prospectionDate?: Date | null;
  callStatus?: string | null;
  response?: string | null;
  notes: string | null;
  assignedTo: { id: string; name: string } | null;
  createdAt: Date;
  _count?: {
    calls: number;
    appointments: number;
    followUps: number;
  };
  appointments?: {
    id: string;
    startTime: Date;
    title: string;
    status: string;
  }[];
  calls?: {
    id: string;
    result: CallResult;
    calledAt: Date;
    comment: string | null;
  }[];
}

function formatLocation(wilaya?: string | null, address?: string | null): string {
  const w = (wilaya || "").trim();
  const a = (address || "").trim();

  if (!w && !a) return "—";
  if (!a) return w;
  if (!w) return a;

  if (w.toLowerCase() === a.toLowerCase()) {
    return w;
  }
  if (a.toLowerCase().includes(w.toLowerCase())) {
    return a;
  }
  if (w.toLowerCase().includes(a.toLowerCase())) {
    return w;
  }

  return `${w} • ${a}`;
}

interface UserOption {
  id: string;
  name: string;
}

interface Props {
  initialProspects: ProspectItem[];
  overviewStats?: {
    total: number;
    virgin: number;
    treated: number;
    interested: number;
    converted: number;
    scheduledAppointments: number;
  };
  salesUsers: UserOption[];
  currentUserId: string;
  canDelete: boolean;
  localFileInfo?: {
    exists: boolean;
    filePath?: string;
    sheets: string[];
  };
}

export function BaseProspectsClient({
  initialProspects,
  overviewStats,
  salesUsers,
  currentUserId,
  canDelete,
  localFileInfo,
}: Props) {
  const [prospects, setProspects] = useState<ProspectItem[]>(initialProspects);
  const [search, setSearch] = useState("");
  const [selectedSector, setSelectedSector] = useState("");
  const [selectedWilaya, setSelectedWilaya] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedCommercial, setSelectedCommercial] = useState("");
  const [selectedCallStatus, setSelectedCallStatus] = useState("");
  const [categoryTab, setCategoryTab] = useState<"ALL" | "VIRGIN" | "CONTACTED" | "INTERESTED" | "MEETING" | "CONVERTED" | "UNREACHED">("ALL");

  // Selection & Batch
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  // Modals state
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const [activeProspect, setActiveProspect] = useState<ProspectItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingRelances, setIsSyncingRelances] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [aiEmailProspect, setAiEmailProspect] = useState<ProspectItem | null>(null);

  // Edit Prospect Form State
  const [editForm, setEditForm] = useState({
    id: "",
    companyName: "",
    contactName: "",
    phone: "",
    email: "",
    sector: "",
    wilaya: "",
    address: "",
    callStatus: "",
    rawState: "",
    callResult: "",
    response: "",
    notes: "",
    assignedToId: "",
    prospectionDate: "",
  });

  // New Prospect Form State
  const [newForm, setNewForm] = useState({
    companyName: "",
    contactName: "",
    phone: "",
    email: "",
    sector: SECTORS[0] as string,
    wilaya: "Alger",
    address: "",
    notes: "",
    assignedToId: currentUserId,
  });

  // Call Log Form State
  const [callForm, setCallForm] = useState<{
    result: CallResult;
    comment: string;
    durationSeconds: number;
    autoScheduleFollowUp: boolean;
  }>({
    result: CallResult.INTERESTED,
    comment: "",
    durationSeconds: 180,
    autoScheduleFollowUp: true,
  });

  // Appointment Form State
  const [appointmentForm, setAppointmentForm] = useState({
    title: "",
    type: "COMMERCIAL_VISIT" as AppointmentType,
    date: toLocalDateString(new Date()),
    startTime: "14:00",
    endTime: "15:00",
    location: "",
    notes: "",
  });

  // Import State
  const [uploadedWorkbook, setUploadedWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState<string>("TOUS");
  const [importedRows, setImportedRows] = useState<any[]>([]);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [directImportSheet, setDirectImportSheet] = useState<string>("TOUS");
  const [importAssignedToId, setImportAssignedToId] = useState<string>("");

  // Helper function to parse rows from any worksheet
  const parseRowsFromSheet = (worksheet: XLSX.WorkSheet) => {
    const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
    if (!matrix || matrix.length === 0) {
      setImportedRows([]);
      setImportStatus("Feuille vide ou sans contenu.");
      return;
    }

    let headerRowIdx = -1;
    let maxMatchScore = 0;

    for (let i = 0; i < Math.min(15, matrix.length); i++) {
      const row = matrix[i] || [];
      const normalizedCells = row.map((cell) =>
        String(cell || "")
          .trim()
          .toUpperCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
      );

      let score = 0;
      for (const cell of normalizedCells) {
        if (cell.includes("CLIENT") || cell.includes("NOM")) score += 3;
        if (cell.includes("NUMERO") || cell.includes("TEL") || cell.includes("PHONE") || cell === "µ") score += 3;
        if (cell.includes("DATE")) score += 2;
        if (cell.includes("TYPE") || cell.includes("SECTEUR")) score += 2;
        if (cell.includes("ADRESS") || cell.includes("ZONE") || cell.includes("PLACE")) score += 2;
        if (cell.includes("APPEL")) score += 2;
        if (cell.includes("ETAT") || cell.includes("STATUT")) score += 2;
        if (cell.includes("REPENSE") || cell.includes("REPONSE")) score += 2;
        if (cell.includes("REMARQUE") || cell.includes("NOTE")) score += 2;
        if (cell.includes("MAIL")) score += 2;
      }

      if (score > maxMatchScore) {
        maxMatchScore = score;
        headerRowIdx = i;
      }
    }

    if (headerRowIdx === -1 || maxMatchScore < 3) {
      headerRowIdx = 0;
    }

    const rawHeaders = matrix[headerRowIdx] || [];

    let clientIdx = -1;
    let numeroIdx = -1;
    let dateIdx = -1;
    let typeIdx = -1;
    let adressIdx = -1;
    let appelIdx = -1;
    let etatIdx = -1;
    let mailIdx = -1;
    let repenseIdx = -1;
    let remarqueIdx = -1;
    let commercialIdx = -1;

    rawHeaders.forEach((h, colIdx) => {
      const norm = String(h || "")
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      if (clientIdx === -1 && (norm.includes("CLIENT") || norm.includes("NOM") || norm.includes("ENTREPRISE") || norm.includes("SOCIETE"))) {
        clientIdx = colIdx;
      } else if (numeroIdx === -1 && (norm.includes("NUMERO") || norm.includes("TEL") || norm.includes("PHONE") || norm === "µ")) {
        numeroIdx = colIdx;
      } else if (dateIdx === -1 && norm.includes("DATE")) {
        dateIdx = colIdx;
      } else if (typeIdx === -1 && (norm.includes("TYPE") || norm.includes("SECTEUR") || norm.includes("ACTIVITE"))) {
        typeIdx = colIdx;
      } else if (adressIdx === -1 && (norm.includes("ADRESS") || norm.includes("ZONE") || norm.includes("PLACE") || norm.includes("WILAYA") || norm.includes("VILLE"))) {
        adressIdx = colIdx;
      } else if (appelIdx === -1 && norm.includes("APPEL")) {
        appelIdx = colIdx;
      } else if (etatIdx === -1 && (norm.includes("ETAT") || norm.includes("STATUT"))) {
        etatIdx = colIdx;
      } else if (mailIdx === -1 && (norm.includes("MAIL") || norm.includes("EMAIL") || norm.includes("WHATSAPP"))) {
        mailIdx = colIdx;
      } else if (repenseIdx === -1 && (norm.includes("REPENSE") || norm.includes("REPONSE"))) {
        repenseIdx = colIdx;
      } else if (remarqueIdx === -1 && (norm.includes("REMARQUE") || norm.includes("NOTE") || norm.includes("COMMENT"))) {
        remarqueIdx = colIdx;
      } else if (commercialIdx === -1 && (norm.includes("COMMERCIAL") || norm.includes("VENDEUR") || norm.includes("AGENT") || norm.includes("AFFECTE") || norm.includes("RESPONSABLE"))) {
        commercialIdx = colIdx;
      }
    });

    if (clientIdx === -1) clientIdx = 0;
    if (numeroIdx === -1) numeroIdx = 1;

    const parsed: any[] = [];

    for (let r = headerRowIdx + 1; r < matrix.length; r++) {
      const row = matrix[r];
      if (!row || row.length === 0) continue;

      const rawClient = row[clientIdx];
      const rawNumero = row[numeroIdx];

      const clientStr = String(rawClient || "").trim();
      const numeroStr = String(rawNumero || "").trim();

      if (!clientStr && !numeroStr) continue;
      if (clientStr.toUpperCase() === "CLIENT" || numeroStr.toUpperCase() === "NUMERO") continue;

      const detectedCommercial = commercialIdx !== -1 && row[commercialIdx]
        ? String(row[commercialIdx]).trim()
        : (selectedSheetName !== "TOUS" && selectedSheetName !== "Feuille 1" ? selectedSheetName : undefined);

      parsed.push({
        companyName: clientStr || "Sans nom",
        phone: numeroStr,
        date: dateIdx !== -1 ? row[dateIdx] : null,
        sector: typeIdx !== -1 && row[typeIdx] ? String(row[typeIdx]).trim() : "Agence de voyage",
        address: adressIdx !== -1 && row[adressIdx] ? String(row[adressIdx]).trim() : "Alger",
        wilaya: adressIdx !== -1 && row[adressIdx] ? String(row[adressIdx]).trim() : "Alger",
        callStatus: appelIdx !== -1 && row[appelIdx] ? String(row[appelIdx]).trim() : null,
        rawState: etatIdx !== -1 && row[etatIdx] ? String(row[etatIdx]).trim() : null,
        email: mailIdx !== -1 && row[mailIdx] ? String(row[mailIdx]).trim() : null,
        response: repenseIdx !== -1 && row[repenseIdx] ? String(row[repenseIdx]).trim() : null,
        notes: remarqueIdx !== -1 && row[remarqueIdx] ? String(row[remarqueIdx]).trim() : null,
        commercialName: detectedCommercial,
      });
    }

    setImportedRows(parsed);
    setImportStatus(`${parsed.length} lignes valides détectées (Ligne d'en-tête détectée à la ligne ${headerRowIdx + 1}).`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      setUploadedWorkbook(workbook);
      setAvailableSheets(workbook.SheetNames);

      const defaultSheet = workbook.SheetNames.includes("TOUS")
        ? "TOUS"
        : workbook.SheetNames[0];
      setSelectedSheetName(defaultSheet);

      const ws = workbook.Sheets[defaultSheet];
      parseRowsFromSheet(ws);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheetName(sheetName);
    if (uploadedWorkbook) {
      const ws = uploadedWorkbook.Sheets[sheetName];
      if (ws) {
        parseRowsFromSheet(ws);
      }
    }
  };

  const handleDirectServerImport = async () => {
    setIsLoading(true);
    setImportStatus("Import direct depuis le fichier serveur...");
    try {
      const res = await importLocalProspectionFile(
        directImportSheet,
        importAssignedToId || undefined
      );
      if ("error" in res && res.error) {
        setImportStatus(`Erreur : ${res.error}`);
      } else if ("imported" in res) {
        setImportStatus(`Succès ! ${res.imported} prospects importés et synchronisés (${res.skippedDuplicates} doublons ignorés).`);
        setTimeout(() => {
          setImportModalOpen(false);
          window.location.reload();
        }, 1500);
      }
    } catch (err: any) {
      setImportStatus(`Erreur serveur : ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (importedRows.length === 0) return;
    setIsLoading(true);
    const BATCH_SIZE = 100;
    const total = importedRows.length;
    let totalImported = 0;
    let totalDuplicates = 0;

    try {
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const chunk = importedRows.slice(i, i + BATCH_SIZE);
        const currentCount = Math.min(i + chunk.length, total);
        const percent = Math.round((currentCount / total) * 100);

        setImportStatus(`Importation en cours : ${currentCount} / ${total} (${percent}%)... Ne quittez pas.`);

        const res = await bulkImportProspects(chunk, importAssignedToId || undefined);
        if (res) {
          totalImported += res.imported || 0;
          totalDuplicates += res.skippedDuplicates || 0;
        }
      }

      setImportStatus(`Import terminé avec succès ! ${totalImported} prospects ajoutés (${totalDuplicates} doublons ignorés).`);
      setTimeout(() => {
        setImportModalOpen(false);
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setImportStatus(`Erreur lors de l'importation : ${err.message || "Erreur réseau"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync to followups
  const handleSyncContactedToFollowUps = async () => {
    setIsSyncingRelances(true);
    try {
      const res = await syncContactedProspectsToFollowUpsAction();
      if (res.success) {
        setFeedbackMessage({
          type: "success",
          text: res.message || `Synchronisation réussie ! ${res.syncedCount} prospect(s) contacté(s) synchronisé(s) vers les relances.`,
        });
      } else {
        setFeedbackMessage({
          type: "error",
          text: (res as any).error || "Erreur lors de la synchronisation des relances.",
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err?.message || "Erreur lors de la synchronisation.",
      });
    } finally {
      setIsSyncingRelances(false);
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    const dataToExport = filtered.map((p) => ({
      "Entreprise / Client": p.companyName,
      "Contact": p.contactName || "",
      "Téléphone": p.phone,
      "Email": p.email || "",
      "Secteur / Activité": p.sector,
      "Wilaya / Zone": p.wilaya,
      "Adresse": p.address || "",
      "Statut CRM": p.status,
      "Statut Appel": p.callStatus || "",
      "Résultat / État": p.rawState || "",
      "Réponse Client": p.response || "",
      "Remarque / Notes": p.notes || "",
      "Commercial Assigné": p.assignedTo?.name || "Non assigné",
      "Date d'ajout": formatDate(p.createdAt),
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Base Prospects");
    XLSX.writeFile(workbook, `Base_Globale_Prospects_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // Open Edit Modal
  const handleOpenEditModal = (prospect: ProspectItem) => {
    setEditForm({
      id: prospect.id,
      companyName: prospect.companyName,
      contactName: prospect.contactName || "",
      phone: prospect.phone,
      email: prospect.email || "",
      sector: prospect.sector,
      wilaya: prospect.wilaya,
      address: prospect.address || "",
      callStatus: prospect.callStatus || "",
      rawState: prospect.rawState || "",
      callResult: prospect.calls?.[0]?.result || "",
      response: prospect.response || "",
      notes: prospect.notes || "",
      assignedToId: prospect.assignedTo?.id || "",
      prospectionDate: prospect.prospectionDate
        ? toLocalDateString(new Date(prospect.prospectionDate))
        : "",
    });
    setEditModalOpen(true);
  };

  // Save Edit Prospect
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await updateProspect(editForm.id, {
        companyName: editForm.companyName,
        contactName: editForm.contactName || undefined,
        phone: editForm.phone,
        email: editForm.email || undefined,
        sector: editForm.sector,
        wilaya: editForm.wilaya,
        address: editForm.address || undefined,
        callStatus: editForm.callStatus || undefined,
        rawState: editForm.rawState || undefined,
        response: editForm.response || undefined,
        notes: editForm.notes || undefined,
        assignedToId: editForm.assignedToId || undefined,
        prospectionDate: editForm.prospectionDate || undefined,
      });

      if (res && res.success && res.prospect) {
        setProspects((prev) =>
          prev.map((p) =>
            p.id === editForm.id
              ? {
                  ...p,
                  ...res.prospect,
                  assignedTo: salesUsers.find((u) => u.id === editForm.assignedToId) || null,
                }
              : p
          )
        );
        setEditModalOpen(false);
        setFeedbackMessage({ type: "success", text: "Prospect mis à jour avec succès." });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err?.message || "Erreur lors de la mise à jour." });
    } finally {
      setIsLoading(false);
    }
  };

  // Inline field update
  const handleInlineFieldChange = async (
    prospectId: string,
    field: "callStatus" | "assignedToId" | "callResult" | "status",
    value: string
  ) => {
    setProspects((prev) =>
      prev.map((p) => {
        if (p.id !== prospectId) return p;
        if (field === "callStatus") return { ...p, callStatus: value };
        if (field === "status") return { ...p, status: value as ProspectStatus };
        if (field === "assignedToId") {
          const u = salesUsers.find((su) => su.id === value);
          return { ...p, assignedTo: u ? { id: u.id, name: u.name } : null };
        }
        if (field === "callResult") {
          return {
            ...p,
            rawState: value,
            calls: [
              {
                id: "temp",
                result: value as CallResult,
                calledAt: new Date(),
                comment: `Résultat: ${value}`,
              },
            ],
          };
        }
        return p;
      })
    );

    if (field === "assignedToId") {
      await assignProspect(prospectId, value);
      setFeedbackMessage({ type: "success", text: "Commercial réassigné avec succès." });
      return;
    }

    if (field === "status") {
      try {
        await updateProspect(prospectId, { status: value as ProspectStatus });
        setFeedbackMessage({ type: "success", text: "Statut mis à jour avec succès." });
      } catch (err: any) {
        setFeedbackMessage({ type: "error", text: err?.message || "Erreur lors de la mise à jour du statut." });
      }
      return;
    }

    try {
      await updateProspectField(prospectId, field, value || null);
      setFeedbackMessage({ type: "success", text: "Modification enregistrée avec succès." });
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err?.message || "Erreur lors de la modification." });
    }
  };

  // Delete Prospect
  const handleDelete = async (prospectId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer définitivement ce prospect ?")) return;
    const res = await deleteProspect(prospectId);
    if (res.error) {
      setFeedbackMessage({ type: "error", text: res.error });
      return;
    }
    setProspects((prev) => prev.filter((p) => p.id !== prospectId));
    setFeedbackMessage({ type: "success", text: "Prospect supprimé avec succès." });
  };

  // Counts by category
  const counts = useMemo(() => {
    let virgin = 0;
    let contacted = 0;
    let interested = 0;
    let meeting = 0;
    let converted = 0;
    let unreached = 0;

    prospects.forEach((p) => {
      if (isVirginProspect(p)) virgin++;
      if (p.status === ProspectStatus.CONTACTED) contacted++;
      if (p.status === ProspectStatus.INTERESTED || p.rawState === "INTERESSE" || p.rawState === "INTERRESE") interested++;
      if (p.status === ProspectStatus.MEETING_SCHEDULED || p.rawState === "RDV PRIS") meeting++;
      if (p.status === ProspectStatus.CONVERTED) converted++;
      if (
        p.status === ProspectStatus.NOT_INTERESTED ||
        p.callStatus === "INJOIGNABLE" ||
        p.callStatus === "PAS DE REPONSE" ||
        p.rawState === "PAS INTERESSE"
      ) {
        unreached++;
      }
    });

    return {
      total: prospects.length,
      virgin,
      contacted,
      interested,
      meeting,
      converted,
      unreached,
    };
  }, [prospects]);

  // Filter prospects
  const filtered = useMemo(() => {
    return prospects.filter((p) => {
      // Category tab
      if (categoryTab === "VIRGIN" && !isVirginProspect(p)) return false;
      if (categoryTab === "CONTACTED" && p.status !== ProspectStatus.CONTACTED) return false;
      if (categoryTab === "INTERESTED" && p.status !== ProspectStatus.INTERESTED && p.rawState !== "INTERESSE" && p.rawState !== "INTERRESE") return false;
      if (categoryTab === "MEETING" && p.status !== ProspectStatus.MEETING_SCHEDULED && p.rawState !== "RDV PRIS") return false;
      if (categoryTab === "CONVERTED" && p.status !== ProspectStatus.CONVERTED) return false;
      if (categoryTab === "UNREACHED") {
        const isUnreached =
          p.status === ProspectStatus.NOT_INTERESTED ||
          p.callStatus === "INJOIGNABLE" ||
          p.callStatus === "PAS DE REPONSE" ||
          p.rawState === "PAS INTERESSE";
        if (!isUnreached) return false;
      }

      // Search query
      const matchesSearch =
        !search ||
        p.companyName.toLowerCase().includes(search.toLowerCase()) ||
        (p.contactName && p.contactName.toLowerCase().includes(search.toLowerCase())) ||
        p.phone.includes(search) ||
        (p.email && p.email.toLowerCase().includes(search.toLowerCase())) ||
        (p.response && p.response.toLowerCase().includes(search.toLowerCase())) ||
        (p.notes && p.notes.toLowerCase().includes(search.toLowerCase())) ||
        (p.assignedTo?.name && p.assignedTo.name.toLowerCase().includes(search.toLowerCase()));

      const matchesSector = !selectedSector || p.sector === selectedSector;
      const matchesWilaya = !selectedWilaya || p.wilaya === selectedWilaya;
      const matchesStatus = !selectedStatus || p.status === selectedStatus;
      const matchesCallStatus = !selectedCallStatus || p.callStatus === selectedCallStatus;
      const matchesCommercial =
        !selectedCommercial ||
        (selectedCommercial === "unassigned" ? !p.assignedTo : p.assignedTo?.id === selectedCommercial);

      return (
        matchesSearch &&
        matchesSector &&
        matchesWilaya &&
        matchesStatus &&
        matchesCallStatus &&
        matchesCommercial
      );
    });
  }, [prospects, categoryTab, search, selectedSector, selectedWilaya, selectedStatus, selectedCallStatus, selectedCommercial]);

  // Client Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(50);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedSector, selectedWilaya, selectedStatus, selectedCallStatus, selectedCommercial, categoryTab]);

  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedProspects = useMemo(() => {
    if (pageSize === "all") return filtered;
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Handle New Prospect Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFeedbackMessage(null);

    const res = await createProspect(newForm);
    if (res.error) {
      setFeedbackMessage({ type: "error", text: res.error });
      setIsLoading(false);
      return;
    }

    setFeedbackMessage({ type: "success", text: "Prospect créé avec succès !" });
    setIsLoading(false);
    setNewModalOpen(false);
    window.location.reload();
  };

  // Handle Call Submit
  const handleCallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProspect) return;
    setIsLoading(true);

    await logCallAction({
      prospectId: activeProspect.id,
      result: callForm.result,
      comment: callForm.comment,
      durationSeconds: Number(callForm.durationSeconds),
      autoScheduleFollowUp: callForm.autoScheduleFollowUp,
    });

    setIsLoading(false);
    setCallModalOpen(false);

    setProspects((prev) =>
      prev.map((p) =>
        p.id === activeProspect.id
          ? {
              ...p,
              callStatus: "EFFECTUE",
              prospectionDate: new Date(),
              _count: {
                appointments: p._count?.appointments ?? 0,
                followUps: p._count?.followUps ?? 0,
                calls: (p._count?.calls ?? 0) + 1,
              },
              calls: [
                {
                  id: "temp",
                  result: callForm.result,
                  calledAt: new Date(),
                  comment: callForm.comment,
                },
                ...(p.calls || []),
              ],
            }
          : p
      )
    );

    setFeedbackMessage({
      type: "success",
      text: "Appel enregistré avec succès ! Le prospect est synchronisé avec la fenêtre Appels.",
    });
  };

  // Handle Appointment Submit
  const handleAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProspect) return;
    setIsLoading(true);

    const startDateTime = `${appointmentForm.date}T${appointmentForm.startTime}:00`;
    const endDateTime = `${appointmentForm.date}T${appointmentForm.endTime}:00`;

    await createAppointmentAction({
      title: appointmentForm.title || `RDV avec ${activeProspect.companyName}`,
      type: appointmentForm.type,
      startTime: startDateTime,
      endTime: endDateTime,
      location: appointmentForm.location,
      notes: appointmentForm.notes,
      prospectId: activeProspect.id,
    });

    setProspects((prev) =>
      prev.map((p) =>
        p.id === activeProspect.id
          ? {
              ...p,
              prospectionDate: new Date(),
              callStatus: "EFFECTUE",
              status: ProspectStatus.MEETING_SCHEDULED,
              rawState: "RDV PRIS",
              _count: {
                calls: p._count?.calls ?? 0,
                followUps: p._count?.followUps ?? 0,
                appointments: (p._count?.appointments ?? 0) + 1,
              },
            }
          : p
      )
    );

    setIsLoading(false);
    setAppointmentModalOpen(false);
    setFeedbackMessage({
      type: "success",
      text: `Rendez-vous planifié avec succès pour ${activeProspect.companyName} !`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2">
                Base de Données Globale des Prospects
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                  {filtered.length} / {prospects.length} total
                </span>
              </h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                Répertoire centralisé et complet du CRM : recherche globale, filtres avancés, attribution et suivi de l&apos;ensemble du vivier commercial.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/prospection"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors shadow-xs"
            title="Aller directement à la file des prospects vierges non contactés"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Prospects Vierges ({counts.virgin})</span>
            <ArrowUpRight className="w-3 h-3 text-amber-400" />
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportModalOpen(true)}
            className="gap-1.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Importer Excel</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="gap-1.5 bg-neutral-900 text-neutral-300 border-neutral-700 hover:bg-neutral-800 cursor-pointer"
            title="Exporter les prospects filtrés au format Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-neutral-400" />
            <span>Exporter ({filtered.length})</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setNewModalOpen(true)}
            className="gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer bg-blue-600 hover:bg-blue-500 text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouveau Prospect</span>
          </Button>
        </div>
      </div>

      {feedbackMessage && (
        <div
          className={`p-3 text-xs rounded-xl font-medium border flex items-center gap-2 ${
            feedbackMessage.type === "success"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* KPI Cards Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div
          onClick={() => setCategoryTab("ALL")}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            categoryTab === "ALL"
              ? "bg-blue-600/15 border-blue-500/50 shadow-md"
              : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-neutral-400 font-medium">Base Totale</span>
            <Database className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-neutral-100 mt-1">{counts.total}</div>
          <p className="text-[10px] text-neutral-500 mt-0.5">Tous les prospects</p>
        </div>

        <div
          onClick={() => setCategoryTab("VIRGIN")}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            categoryTab === "VIRGIN"
              ? "bg-amber-600/15 border-amber-500/50 shadow-md"
              : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-amber-300 font-medium">Prospects Vierges</span>
            <Flame className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-300 mt-1">{counts.virgin}</div>
          <p className="text-[10px] text-amber-400/70 mt-0.5">Non contactés</p>
        </div>

        <div
          onClick={() => setCategoryTab("CONTACTED")}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            categoryTab === "CONTACTED"
              ? "bg-cyan-600/15 border-cyan-500/50 shadow-md"
              : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-neutral-400 font-medium">Contactés</span>
            <PhoneCall className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-neutral-100 mt-1">{counts.contacted}</div>
          <p className="text-[10px] text-neutral-500 mt-0.5">En cours d&apos;échange</p>
        </div>

        <div
          onClick={() => setCategoryTab("INTERESTED")}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            categoryTab === "INTERESTED"
              ? "bg-emerald-600/15 border-emerald-500/50 shadow-md"
              : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-emerald-300 font-medium">Intéressés</span>
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-300 mt-1">{counts.interested}</div>
          <p className="text-[10px] text-emerald-400/70 mt-0.5">Pistes chaudes</p>
        </div>

        <div
          onClick={() => setCategoryTab("MEETING")}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            categoryTab === "MEETING"
              ? "bg-purple-600/15 border-purple-500/50 shadow-md"
              : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-purple-300 font-medium">RDV Fixés</span>
            <Calendar className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-purple-300 mt-1">{counts.meeting}</div>
          <p className="text-[10px] text-purple-400/70 mt-0.5">Visites / Démo</p>
        </div>

        <div
          onClick={() => setCategoryTab("CONVERTED")}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            categoryTab === "CONVERTED"
              ? "bg-green-600/15 border-green-500/50 shadow-md"
              : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-green-300 font-medium">Convertis</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
          </div>
          <div className="text-xl font-bold text-green-300 mt-1">{counts.converted}</div>
          <p className="text-[10px] text-green-400/70 mt-0.5">Devenus Clients</p>
        </div>
      </div>

      {/* Quick Category Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-neutral-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setCategoryTab("ALL")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            categoryTab === "ALL"
              ? "bg-blue-600 text-white shadow-md"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          🌐 Tous ({counts.total})
        </button>

        <button
          type="button"
          onClick={() => setCategoryTab("VIRGIN")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
            categoryTab === "VIRGIN"
              ? "bg-amber-600 text-white shadow-md"
              : "text-amber-400/90 hover:text-amber-200 hover:bg-amber-500/10"
          }`}
        >
          <Flame className="w-3 h-3 text-amber-400" />
          <span>Vierges ({counts.virgin})</span>
        </button>

        <button
          type="button"
          onClick={() => setCategoryTab("CONTACTED")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            categoryTab === "CONTACTED"
              ? "bg-cyan-600 text-white shadow-md"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          📞 Contactés ({counts.contacted})
        </button>

        <button
          type="button"
          onClick={() => setCategoryTab("INTERESTED")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            categoryTab === "INTERESTED"
              ? "bg-emerald-600 text-white shadow-md"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          🎯 Intéressés ({counts.interested})
        </button>

        <button
          type="button"
          onClick={() => setCategoryTab("MEETING")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            categoryTab === "MEETING"
              ? "bg-purple-600 text-white shadow-md"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          📅 RDV Fixés ({counts.meeting})
        </button>

        <button
          type="button"
          onClick={() => setCategoryTab("CONVERTED")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            categoryTab === "CONVERTED"
              ? "bg-green-600 text-white shadow-md"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          🤝 Convertis ({counts.converted})
        </button>

        <button
          type="button"
          onClick={() => setCategoryTab("UNREACHED")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            categoryTab === "UNREACHED"
              ? "bg-rose-600 text-white shadow-md"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          🚫 Pas Intéressés / Injoignables ({counts.unreached})
        </button>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 bg-neutral-900/60 border border-neutral-800 p-3 rounded-2xl">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Recherche dans toute la base (Nom, téléphone, email, notes)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={selectedSector}
          onChange={(e) => setSelectedSector(e.target.value)}
          className="h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value="">Tous les secteurs</option>
          {SECTORS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={selectedWilaya}
          onChange={(e) => setSelectedWilaya(e.target.value)}
          className="h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value="">Toutes les wilayas</option>
          {WILAYAS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value="">Tous les statuts CRM</option>
          {Object.entries(PROSPECT_STATUSES).map(([key, val]) => (
            <option key={key} value={key}>
              {val.label}
            </option>
          ))}
        </select>

        <select
          value={selectedCommercial}
          onChange={(e) => setSelectedCommercial(e.target.value)}
          className="h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value="">Tous les commerciaux</option>
          <option value="unassigned">-- Non assignés --</option>
          {salesUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {/* Global Table */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/80 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                <th className="py-3 px-3">Prospect / Entreprise</th>
                <th className="py-3 px-3">Contact & Téléphone</th>
                <th className="py-3 px-3">Secteur / Wilaya</th>
                <th className="py-3 px-3">Statut CRM</th>
                <th className="py-3 px-3">Statut Appel</th>
                <th className="py-3 px-3">Résultat Appel</th>
                <th className="py-3 px-3">Commercial</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {paginatedProspects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-500">
                    Aucun prospect trouvé dans la base pour les filtres sélectionnés.
                  </td>
                </tr>
              ) : (
                paginatedProspects.map((prospect) => {
                  const isVirgin = isVirginProspect(prospect);
                  const statusInfo = PROSPECT_STATUSES[prospect.status] || {
                    label: prospect.status,
                    color: "bg-neutral-800 text-neutral-400 border-neutral-700",
                  };

                  return (
                    <tr
                      key={prospect.id}
                      className="hover:bg-neutral-800/30 transition-colors group"
                    >
                      {/* Entreprise */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-bold text-neutral-200 flex items-center gap-1.5">
                              <span>{prospect.companyName}</span>
                              {isVirgin && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase tracking-wider">
                                  Vierge
                                </span>
                              )}
                            </div>
                            {prospect.notes && (
                              <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5 italic">
                                {prospect.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contact & Phone */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          {prospect.contactName && (
                            <span className="font-medium text-neutral-300">
                              {prospect.contactName}
                            </span>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            <a
                              href={`tel:${prospect.phone}`}
                              onClick={() => {
                                trackCommunicationClick({
                                  type: "PHONE",
                                  targetName: prospect.companyName || prospect.contactName,
                                  phone: prospect.phone,
                                  entityType: "PROSPECT",
                                  entityId: prospect.id,
                                });
                              }}
                              className="font-mono text-neutral-200 hover:text-emerald-400 font-semibold w-24 shrink-0 tracking-tight transition-colors cursor-pointer"
                              title="Appeler ce numéro"
                            >
                              {prospect.phone}
                            </a>
                            <a
                              href={buildWhatsAppUrl(prospect.phone, prospect.contactName || prospect.companyName)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => {
                                trackCommunicationClick({
                                  type: "WHATSAPP",
                                  targetName: prospect.contactName || prospect.companyName,
                                  phone: prospect.phone,
                                  entityType: "PROSPECT",
                                  entityId: prospect.id,
                                });
                              }}
                              className="text-emerald-400 hover:text-emerald-300 transition-colors shrink-0 p-0.5 rounded hover:bg-emerald-500/10"
                              title="Envoyer un message WhatsApp standard après appel"
                            >
                              <WhatsAppIcon className="w-3.5 h-3.5" />
                            </a>

                            <button
                              type="button"
                              onClick={() => setAiEmailProspect(prospect)}
                              className="text-indigo-400 hover:text-indigo-300 transition-colors shrink-0 p-0.5 rounded hover:bg-indigo-500/10 cursor-pointer"
                              title={`Email IA : Proposition commerciale & Recommandation de pack pour ${prospect.companyName}`}
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Secteur & Wilaya */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="text-neutral-300 font-medium">{prospect.sector}</span>
                          <span className="text-[11px] text-neutral-500 font-mono">
                            {formatLocation(prospect.wilaya, prospect.address)}
                          </span>
                        </div>
                      </td>

                      {/* Statut CRM */}
                      <td className="py-3 px-3">
                        <select
                          value={prospect.status}
                          onChange={(e) => handleInlineFieldChange(prospect.id, "status", e.target.value)}
                          className={`h-7 px-2 text-[11px] font-bold rounded-lg border focus:outline-none cursor-pointer transition-all ${statusInfo.color}`}
                        >
                          {Object.entries(PROSPECT_STATUSES).map(([key, val]) => (
                            <option key={key} value={key} className="bg-neutral-950 text-neutral-200">
                              {val.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Statut Appel */}
                      <td className="py-3 px-3">
                        <select
                          value={prospect.callStatus || ""}
                          onChange={(e) => handleInlineFieldChange(prospect.id, "callStatus", e.target.value)}
                          className={`h-7 px-2 text-[11px] font-semibold rounded-lg border focus:outline-none cursor-pointer transition-all ${
                            prospect.callStatus === "EFFECTUE"
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold"
                              : prospect.callStatus?.includes("PAS") || prospect.callStatus?.includes("OCCUPE")
                              ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                              : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700"
                          }`}
                        >
                          <option value="" className="bg-neutral-950 text-neutral-400">— Appel —</option>
                          <option value="EFFECTUE" className="bg-neutral-950 text-emerald-400 font-bold">✓ EFFECTUE</option>
                          <option value="PAS DE REPONSE" className="bg-neutral-950 text-amber-400">PAS DE REPONSE</option>
                          <option value="OCCUPE" className="bg-neutral-950 text-amber-400">OCCUPE</option>
                          <option value="INJOIGNABLE" className="bg-neutral-950 text-rose-400">INJOIGNABLE</option>
                          <option value="A RAPPELER" className="bg-neutral-950 text-blue-400">A RAPPELER</option>
                          <option value="PAS DE CONTACT" className="bg-neutral-950 text-neutral-400">PAS DE CONTACT</option>
                          <option value="NON EFFECTUE" className="bg-neutral-950 text-neutral-400">NON EFFECTUE</option>
                        </select>
                      </td>

                      {/* Résultat Appel */}
                      <td className="py-3 px-3">
                        {(() => {
                          const latestResult =
                            prospect.calls?.[0]?.result ||
                            (prospect.status === ProspectStatus.INTERESTED || prospect.rawState === "INTERESSE"
                              ? CallResult.INTERESTED
                              : prospect.status === ProspectStatus.MEETING_SCHEDULED || prospect.rawState === "RDV PRIS"
                              ? CallResult.APPOINTMENT_BOOKED
                              : prospect.status === ProspectStatus.NOT_INTERESTED || prospect.rawState === "PAS INTERESSE"
                              ? CallResult.NOT_INTERESTED
                              : prospect.rawState === "A RAPPELER" || prospect.callStatus === "A RAPPELER"
                              ? CallResult.CALLBACK_REQUESTED
                              : prospect.callStatus === "PAS DE REPONSE" || prospect.rawState === "PAS DE CONTACT"
                              ? CallResult.NO_ANSWER
                              : prospect.callStatus === "INJOIGNABLE" || prospect.callStatus === "OCCUPE"
                              ? CallResult.UNREACHABLE
                              : "");

                          return (
                            <select
                              value={latestResult || ""}
                              onChange={(e) => handleInlineFieldChange(prospect.id, "callResult", e.target.value)}
                              className={`h-7 px-2 text-[10px] font-semibold rounded-lg border focus:outline-none cursor-pointer transition-all max-w-[130px] ${
                                latestResult === CallResult.INTERESTED
                                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold"
                                  : latestResult === CallResult.APPOINTMENT_BOOKED
                                  ? "bg-purple-500/20 text-purple-400 border-purple-500/40 font-bold"
                                  : latestResult === CallResult.CALLBACK_REQUESTED
                                  ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                                  : latestResult === CallResult.NOT_INTERESTED
                                  ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                                  : latestResult === CallResult.NO_ANSWER
                                  ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                                  : latestResult === CallResult.UNREACHABLE
                                  ? "bg-red-500/20 text-red-400 border-red-500/40"
                                  : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700"
                              }`}
                            >
                              <option value="" className="bg-neutral-950 text-neutral-400">— Résultat —</option>
                              <option value="INTERESTED" className="bg-neutral-950 text-emerald-400 font-bold">Intéressé</option>
                              <option value="APPOINTMENT_BOOKED" className="bg-neutral-950 text-purple-400 font-bold">RDV fixé</option>
                              <option value="CALLBACK_REQUESTED" className="bg-neutral-950 text-blue-400">À rappeler</option>
                              <option value="NOT_INTERESTED" className="bg-neutral-950 text-rose-400">Pas intéressé</option>
                              <option value="NO_ANSWER" className="bg-neutral-950 text-amber-400">Pas de réponse</option>
                              <option value="UNREACHABLE" className="bg-neutral-950 text-red-400">Injoignable</option>
                            </select>
                          );
                        })()}
                      </td>

                      {/* Commercial */}
                      <td className="py-3 px-3">
                        <select
                          value={prospect.assignedTo?.id || ""}
                          onChange={(e) => handleInlineFieldChange(prospect.id, "assignedToId", e.target.value)}
                          className="h-7 px-2 text-[11px] bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-300 focus:outline-none focus:border-blue-500 cursor-pointer max-w-[130px]"
                        >
                          <option value="">Non assigné</option>
                          {salesUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">

                          {/* Plan RDV */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveProspect(prospect);
                              setAppointmentModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 transition-colors cursor-pointer"
                            title="Planifier un Rendez-vous"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Details */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(prospect)}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                            title="Modifier la fiche du prospect"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDelete(prospect.id)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                              title="Supprimer ce prospect"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

        {/* Pagination Footer */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span>Afficher par page :</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const v = e.target.value === "all" ? "all" : Number(e.target.value);
                setPageSize(v);
              }}
              className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-neutral-200 cursor-pointer focus:outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">Tous ({filtered.length})</option>
            </select>
            <span className="text-neutral-500">
              ({filtered.length} prospect{filtered.length > 1 ? "s" : ""} trouvé{filtered.length > 1 ? "s" : ""})
            </span>
          </div>

          {pageSize !== "all" && totalPages > 1 && (
            <div className="flex items-center gap-1.5 self-center sm:self-auto">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-200 transition-colors cursor-pointer font-medium"
              >
                Précédent
              </button>
              <span className="px-2 font-mono text-neutral-300">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-200 transition-colors cursor-pointer font-medium"
              >
                Suivant
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL NOUVEAU PROSPECT */}
      <Modal isOpen={newModalOpen} onClose={() => setNewModalOpen(false)} title="Nouveau Prospect">
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">Nom Entreprise *</label>
            <Input
              required
              value={newForm.companyName}
              onChange={(e) => setNewForm({ ...newForm, companyName: e.target.value })}
              placeholder="Ex: Clinique Al-Chiffa"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Contact / Responsable</label>
              <Input
                value={newForm.contactName}
                onChange={(e) => setNewForm({ ...newForm, contactName: e.target.value })}
                placeholder="Ex: Dr. Ahmed"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Téléphone *</label>
              <Input
                required
                value={newForm.phone}
                onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
                placeholder="0550 00 00 00"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Secteur</label>
              <select
                value={newForm.sector}
                onChange={(e) => setNewForm({ ...newForm, sector: e.target.value })}
                className="w-full h-10 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200"
              >
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Wilaya</label>
              <select
                value={newForm.wilaya}
                onChange={(e) => setNewForm({ ...newForm, wilaya: e.target.value })}
                className="w-full h-10 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200"
              >
                {WILAYAS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">Commercial Assigné</label>
            <select
              value={newForm.assignedToId}
              onChange={(e) => setNewForm({ ...newForm, assignedToId: e.target.value })}
              className="w-full h-10 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200"
            >
              <option value="">Non assigné</option>
              {salesUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setNewModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Créer le prospect
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL APPEL */}
      <Modal isOpen={callModalOpen} onClose={() => setCallModalOpen(false)} title="Enregistrer un Appel">
        <form onSubmit={handleCallSubmit} className="space-y-4">
          <p className="text-xs text-neutral-400">
            Appel avec <strong className="text-neutral-200">{activeProspect?.companyName}</strong> ({activeProspect?.phone})
          </p>
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">Résultat de l&apos;appel</label>
            <select
              value={callForm.result}
              onChange={(e) => setCallForm({ ...callForm, result: e.target.value as CallResult })}
              className="w-full h-10 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200"
            >
              {Object.entries(CALL_RESULTS).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">Notes / Commentaires</label>
            <textarea
              rows={3}
              value={callForm.comment}
              onChange={(e) => setCallForm({ ...callForm, comment: e.target.value })}
              className="w-full p-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none"
              placeholder="Détails de la conversation..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCallModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Enregistrer l&apos;appel
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL RENDEZ-VOUS */}
      <Modal isOpen={appointmentModalOpen} onClose={() => setAppointmentModalOpen(false)} title="Planifier un Rendez-vous">
        <form onSubmit={handleAppointmentSubmit} className="space-y-4">
          <p className="text-xs text-neutral-400">
            Rendez-vous avec <strong className="text-neutral-200">{activeProspect?.companyName}</strong>
          </p>
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">Titre du rendez-vous</label>
            <Input
              value={appointmentForm.title}
              onChange={(e) => setAppointmentForm({ ...appointmentForm, title: e.target.value })}
              placeholder={`RDV commercial avec ${activeProspect?.companyName}`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Date</label>
              <Input
                type="date"
                value={appointmentForm.date}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Type</label>
              <select
                value={appointmentForm.type}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, type: e.target.value as AppointmentType })}
                className="w-full h-10 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200"
              >
                {Object.entries(APPOINTMENT_TYPES).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Heure de début</label>
              <Input
                type="time"
                value={appointmentForm.startTime}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, startTime: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Heure de fin</label>
              <Input
                type="time"
                value={appointmentForm.endTime}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, endTime: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setAppointmentModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Confirmer le RDV
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL ÉDITION PROSPECT */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Modifier la Fiche Prospect">
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">Nom Entreprise *</label>
            <Input
              required
              value={editForm.companyName}
              onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Contact</label>
              <Input
                value={editForm.contactName}
                onChange={(e) => setEditForm({ ...editForm, contactName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Téléphone *</label>
              <Input
                required
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Secteur</label>
              <select
                value={editForm.sector}
                onChange={(e) => setEditForm({ ...editForm, sector: e.target.value })}
                className="w-full h-10 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200"
              >
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Wilaya</label>
              <select
                value={editForm.wilaya}
                onChange={(e) => setEditForm({ ...editForm, wilaya: e.target.value })}
                className="w-full h-10 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200"
              >
                {WILAYAS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">Commercial Assigné</label>
            <select
              value={editForm.assignedToId}
              onChange={(e) => setEditForm({ ...editForm, assignedToId: e.target.value })}
              className="w-full h-10 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200"
            >
              <option value="">Non assigné</option>
              {salesUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">Remarques / Notes</label>
            <textarea
              rows={3}
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              className="w-full p-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL IMPORT EXCEL */}
      <Modal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} title="Importer des Prospects">
        <div className="space-y-4">
          <div className="border-2 border-dashed border-neutral-800 rounded-2xl p-6 text-center">
            <FileSpreadsheet className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
            <p className="text-xs text-neutral-300 font-medium">Sélectionnez votre fichier Excel (.xlsx, .xls, .csv)</p>
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="mt-3 text-xs text-neutral-400" />
          </div>

          {availableSheets.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Feuille à importer</label>
              <select
                value={selectedSheetName}
                onChange={(e) => handleSheetChange(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200"
              >
                {availableSheets.map((sh) => (
                  <option key={sh} value={sh}>
                    {sh}
                  </option>
                ))}
              </select>
            </div>
          )}

          {importStatus && (
            <p className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 p-2.5 rounded-xl font-medium">
              {importStatus}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={() => setImportModalOpen(false)}
            >
              Fermer
            </Button>
            {importedRows.length > 0 && (
              <Button
                onClick={handleConfirmImport}
                isLoading={isLoading}
                disabled={isLoading}
              >
                Importer {importedRows.length} prospects
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* MODAL EMAIL IA DE PROPOSITION COMMERCIALE */}
      <ProspectAiEmailModal
        isOpen={Boolean(aiEmailProspect)}
        onClose={() => setAiEmailProspect(null)}
        prospect={aiEmailProspect}
      />
    </div>
  );
}
