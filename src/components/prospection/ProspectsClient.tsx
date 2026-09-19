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
  transferProspectToAppelsAction,
} from "@/actions/prospects";
import { logCallAction } from "@/actions/calls";
import { createAppointmentAction } from "@/actions/appointments";
import {
  Plus,
  Search,
  Phone,
  Calendar,
  Building,
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
  Flame,
  ArrowUpRight,
  Loader2,
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

export function ProspectsClient({
  initialProspects,
  overviewStats,
  salesUsers,
  currentUserId,
  canDelete,
  localFileInfo,
}: Props) {
  const [prospects, setProspects] = useState<ProspectItem[]>(initialProspects);
  const [filterScope, setFilterScope] = useState<"VIRGIN" | "ALL">("VIRGIN");
  const virginCount = useMemo(() => prospects.filter(isVirginProspect).length, [prospects]);
  const [search, setSearch] = useState("");
  const [selectedSector, setSelectedSector] = useState("");
  const [selectedWilaya, setSelectedWilaya] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedCommercial, setSelectedCommercial] = useState("");
  const [tableViewMode, setTableViewMode] = useState<"table10" | "cards">("table10");

  // Modals state
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const [activeProspect, setActiveProspect] = useState<ProspectItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    percent: number;
    statusText: string;
  } | null>(null);
  const [isSyncingRelances, setIsSyncingRelances] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [transferringId, setTransferringId] = useState<string | null>(null);
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

  // Import State with Sheet Selection & Commercial Synchronization
  const [uploadedWorkbook, setUploadedWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState<string>("TOUS");
  const [importedRows, setImportedRows] = useState<any[]>([]);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [directImportSheet, setDirectImportSheet] = useState<string>("TOUS");
  const [importAssignedToId, setImportAssignedToId] = useState<string>("");
  const [importAsVirgin, setImportAsVirgin] = useState<boolean>(true);

  // Helper function to parse rows from any worksheet matching the 10 columns with robust header auto-detection
  const parseRowsFromSheet = (worksheet: XLSX.WorkSheet) => {
    const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
    if (!matrix || matrix.length === 0) {
      setImportedRows([]);
      setImportStatus("Feuille vide ou sans contenu.");
      return;
    }

    // 1. Find the header row by looking for key columns across the first 15 rows
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

    // Create column index mapping
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

  // Handle File Upload
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

  // Change sheet in uploaded workbook
  const handleSheetChange = (sheetName: string) => {
    setSelectedSheetName(sheetName);
    if (!uploadedWorkbook) return;
    const ws = uploadedWorkbook.Sheets[sheetName];
    if (ws) {
      parseRowsFromSheet(ws);
    }
  };

  // Synchronisation globale des relances pour tous les prospects contactés
  const handleSyncContactedToFollowUps = async () => {
    setIsSyncingRelances(true);
    try {
      const res = await syncContactedProspectsToFollowUpsAction();
      if (res.success) {
        setFeedbackMessage({
          type: "success",
          text: `⚡ Synchronisation réussie : ${res.syncedCount} prospect(s) contacté(s) placé(s) en relance (+3j, +7j, +15j). Les prospects 'Pas de contact' et 'Pas intéressé' ont été rigoureusement exclus.`,
        });
        window.location.reload();
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err?.message || "Erreur lors de la synchronisation des relances.",
      });
    } finally {
      setIsSyncingRelances(false);
    }
  };

  // Confirm uploaded file import with chunked processing (avoids server timeouts)
  const handleBulkImportConfirm = async () => {
    if (importedRows.length === 0) return;
    setIsLoading(true);
    const BATCH_SIZE = 250;
    const total = importedRows.length;
    let totalImported = 0;
    let totalDuplicates = 0;
    let totalInvalid = 0;
    let totalRelances = 0;

    setImportProgress({
      current: 0,
      total,
      percent: 0,
      statusText: `Démarrage de l'importation (0 / ${total})...`,
    });

    try {
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const chunk = importedRows.slice(i, i + BATCH_SIZE);
        const currentCount = Math.min(i + chunk.length, total);
        const percent = Math.round((currentCount / total) * 100);

        setImportProgress({
          current: currentCount,
          total,
          percent,
          statusText: `Importation : ${currentCount} / ${total} (${percent}%)...`,
        });

        const res = await bulkImportProspects(chunk, importAssignedToId || undefined, { importAsVirgin });
        if (res) {
          totalImported += res.imported || 0;
          totalDuplicates += res.skippedDuplicates || 0;
          totalInvalid += res.skippedInvalid || 0;
          totalRelances += res.autoRelancesCreated || 0;
        }
      }

      setImportModalOpen(false);
      setFeedbackMessage({
        type: "success",
        text: `✓ ${totalImported} prospects importés avec succès | 🛡️ ${totalDuplicates} doublons automatiquement éliminés (existants conservés intacts) | ⚡ ${totalRelances} prospects contactés synchronisés vers les relances.`,
      });
      window.location.reload();
    } catch (err: any) {
      console.error("Bulk import error:", err);
      setFeedbackMessage({
        type: "error",
        text: `Erreur lors de l'import : ${err?.message || "Erreur de connexion"}. (${totalImported} prospects ont pu être enregistrés en base).`,
      });
    } finally {
      setIsLoading(false);
      setImportProgress(null);
    }
  };

  // Direct 1-Click Import from Local File
  const handleDirectLocalImport = async () => {
    setIsLoading(true);
    const res = await importLocalProspectionFile(directImportSheet);
    setIsLoading(false);

    if ("error" in res && res.error) {
      setFeedbackMessage({ type: "error", text: res.error });
      return;
    }

    if ("imported" in res) {
      setImportModalOpen(false);
      setFeedbackMessage({
        type: "success",
        text: `✓ ${res.imported} prospects importés depuis "${directImportSheet}" | 🛡️ ${res.skippedDuplicates ?? res.skipped} doublons éliminés (existants conservés intacts) | ⚡ ${res.autoRelancesCreated || 0} prospects contactés synchronisés vers les relances (+3j, +7j, +15j).`,
      });
      window.location.reload();
    }
  };

  // Open Edit Prospect Modal
  const openEditModal = (prospect: ProspectItem) => {
    setActiveProspect(prospect);
    const initialCallResult =
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

    setEditForm({
      id: prospect.id,
      companyName: prospect.companyName || "",
      contactName: prospect.contactName || "",
      phone: prospect.phone || "",
      email: prospect.email || "",
      sector: prospect.sector || "Agence de voyage",
      wilaya: prospect.wilaya || "Alger",
      address: prospect.address || "",
      callStatus: prospect.callStatus || "",
      rawState: prospect.rawState || "",
      callResult: initialCallResult,
      response: prospect.response || "",
      notes: prospect.notes || "",
      assignedToId: prospect.assignedTo?.id || "",
      prospectionDate: toLocalDateString(prospect.prospectionDate),
    });
    setEditModalOpen(true);
  };

  // Submit Edit Prospect (Ne déplace pas le prospect automatiquement)
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProspect) return;
    setIsLoading(true);

    const targetUser = salesUsers.find((u) => u.id === editForm.assignedToId);

    try {
      await updateProspect(activeProspect.id, {
        companyName: editForm.companyName,
        contactName: editForm.contactName,
        phone: editForm.phone,
        email: editForm.email,
        sector: editForm.sector,
        wilaya: editForm.wilaya,
        address: editForm.address,
        callStatus: editForm.callStatus || null,
        callResult: editForm.callResult ? (editForm.callResult as CallResult) : undefined,
        response: editForm.response || null,
        notes: editForm.notes,
        assignedToId: editForm.assignedToId || null,
      });

      setProspects((prev) =>
        prev.map((p) =>
          p.id === activeProspect.id
            ? {
                ...p,
                companyName: editForm.companyName,
                contactName: editForm.contactName,
                phone: editForm.phone,
                email: editForm.email,
                sector: editForm.sector,
                wilaya: editForm.wilaya,
                address: editForm.address,
                callStatus: editForm.callStatus || null,
                calls: editForm.callResult
                  ? [{ id: "saved", result: editForm.callResult as CallResult, calledAt: new Date(), comment: null }]
                  : p.calls,
                status:
                  editForm.callResult === "INTERESTED"
                    ? ProspectStatus.INTERESTED
                    : editForm.callResult === "APPOINTMENT_BOOKED"
                    ? ProspectStatus.MEETING_SCHEDULED
                    : editForm.callResult === "NOT_INTERESTED"
                    ? ProspectStatus.NOT_INTERESTED
                    : p.status,
                response: editForm.response || null,
                notes: editForm.notes,
                assignedTo: targetUser ? { id: targetUser.id, name: targetUser.name } : null,
              }
            : p
        )
      );

      setEditModalOpen(false);
      setFeedbackMessage({
        type: "success",
        text: `Fiche de "${editForm.companyName}" mise à jour avec succès !`,
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err?.message || "Erreur lors de la mise à jour de la fiche prospect.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Déplacement explicite d'un prospect vers les Appels et la Base de données (via l'icône +)
  const handleTransferToAppels = async (prospect: ProspectItem) => {
    try {
      setTransferringId(prospect.id);
      const res = await transferProspectToAppelsAction(prospect.id);
      if (res.success) {
        // Retirer immédiatement le prospect de la file active de prospection car déplacé vers Appels
        setProspects((prev) => prev.filter((p) => p.id !== prospect.id));
        if (editModalOpen && activeProspect?.id === prospect.id) {
          setEditModalOpen(false);
        }
        setFeedbackMessage({
          type: "success",
          text: `✓ "${prospect.companyName}" a été déplacé vers la section Appels et la Base de données avec succès !`,
        });
        setTimeout(() => setFeedbackMessage(null), 5000);
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err?.message || "Erreur lors du déplacement du prospect vers les Appels.",
      });
    } finally {
      setTransferringId(null);
    }
  };

  // Quick Commercial Reassignment from Table
  const handleQuickAssign = async (prospectId: string, newUserId: string) => {
    const targetUser = salesUsers.find((u) => u.id === newUserId);
    // Optimistic UI update
    setProspects((prev) =>
      prev.map((p) =>
        p.id === prospectId
          ? {
              ...p,
              assignedTo: targetUser ? { id: targetUser.id, name: targetUser.name } : null,
            }
          : p
      )
    );

    try {
      await assignProspect(prospectId, newUserId || null);
      setFeedbackMessage({
        type: "success",
        text: targetUser
          ? `Prospect synchronisé avec ${targetUser.name} !`
          : "Prospect désassigné.",
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err?.message || "Erreur lors de l'assignation du commercial.",
      });
    }
  };

  // Handle direct inline cell modification from the table
  const handleInlineFieldChange = async (
    prospectId: string,
    field: "callStatus" | "rawState" | "response" | "notes" | "callResult",
    value: string
  ) => {
    const today = new Date();
    // Optimistic UI update
    setProspects((prev) =>
      prev.map((p) => {
        if (p.id !== prospectId) return p;
        if (field === "callResult") {
          const callRes = value as CallResult;
          const isContactMade = Boolean(value && value.trim());
          return {
            ...p,
            prospectionDate: isContactMade ? today : (!p.callStatus ? null : p.prospectionDate),
            calls: value
              ? [{ id: "temp", result: callRes, calledAt: today, comment: null }]
              : [],
            status:
              callRes === CallResult.INTERESTED
                ? ProspectStatus.INTERESTED
                : callRes === CallResult.APPOINTMENT_BOOKED
                ? ProspectStatus.MEETING_SCHEDULED
                : callRes === CallResult.NOT_INTERESTED
                ? ProspectStatus.NOT_INTERESTED
                : p.status,
            callStatus:
              callRes === CallResult.NO_ANSWER
                ? "PAS DE REPONSE"
                : callRes === CallResult.UNREACHABLE
                ? "INJOIGNABLE"
                : callRes === CallResult.CALLBACK_REQUESTED
                ? "A RAPPELER"
                : (value ? "EFFECTUE" : p.callStatus),
          };
        }
        if (field === "callStatus") {
          const isContactMade = Boolean(value && value.trim() && value.trim().toUpperCase() !== "NON EFFECTUE");
          return {
            ...p,
            callStatus: value || null,
            prospectionDate: isContactMade ? today : (value === "" && !p.calls?.length ? null : p.prospectionDate),
          };
        }
        if (field === "response" && value && value.trim()) {
          return {
            ...p,
            response: value,
            prospectionDate: p.prospectionDate || today,
          };
        }
        return { ...p, [field]: value || null };
      })
    );

    try {
      await updateProspectField(prospectId, field, value || null);
      if (field === "callResult") {
        setFeedbackMessage({
          type: "success",
          text: `Résultat d'appel mis à jour. Le prospect reste dans la prospection tant que vous ne cliquez pas sur « + Appels ».`,
        });
      } else if (field === "callStatus") {
        setFeedbackMessage({
          type: "success",
          text: `Statut d'appel mis à jour. Le prospect reste dans la prospection tant que vous ne cliquez pas sur « + Appels ».`,
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err?.message || "Erreur lors de la modification en direct.",
      });
    }
  };

  // Delete Prospect
  const handleDeleteProspect = async (prospectId: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce prospect ?")) return;
    setIsLoading(true);
    const res = await deleteProspect(prospectId);
    setIsLoading(false);

    if (res.error) {
      setFeedbackMessage({ type: "error", text: res.error });
      return;
    }

    setProspects((prev) => prev.filter((p) => p.id !== prospectId));
    setEditModalOpen(false);
    setFeedbackMessage({ type: "success", text: "Prospect supprimé avec succès." });
  };

  // Filter prospects : STRICTEMENT les lignes vierges (— Appel —, — Résultat —, Réponse..., Remarque...)
  const filtered = prospects.filter((p) => {
    if (!isVirginProspect(p)) {
      return false;
    }

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
    const matchesCommercial =
      !selectedCommercial ||
      (selectedCommercial === "unassigned" ? !p.assignedTo : p.assignedTo?.id === selectedCommercial);

    return matchesSearch && matchesSector && matchesWilaya && matchesStatus && matchesCommercial;
  });

  // Client Pagination (50 par page par défaut pour des performances instantanées)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(50);

  // Revenir à la première page quand les filtres changent
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedSector, selectedWilaya, selectedStatus, selectedCommercial, filterScope]);

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
    setFeedbackMessage({ type: "success", text: "Appel enregistré avec succès ! Redirection vers la section Appels..." });
    window.location.href = "/appels";
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

    // Optimistic UI update: turn the RDV icon green immediately!
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
      text: `Rendez-vous planifié avec succès pour ${activeProspect.companyName} ! L'indicateur RDV est passé au vert.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2">
            Prospection Commerciale
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <Flame className="w-3 h-3 text-emerald-400" />
              <span>{filtered.length} fiches vierges prêtes</span>
            </span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            File d&apos;attente active de prospection. Seules les fiches vierges (non encore traitées) s&apos;affichent ici.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Badge Fiches Vierges */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900/90 border border-amber-500/30 rounded-xl text-xs shadow-xs">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-amber-300">Listes Vierges ({filtered.length})</span>
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-neutral-900 border border-neutral-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setTableViewMode("table10")}
              className={`flex items-center gap-1.5 px-3 py-1 font-semibold rounded-lg transition-colors cursor-pointer ${
                tableViewMode === "table10" ? "bg-neutral-800 text-white shadow-xs" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Tableau</span>
            </button>
            <button
              onClick={() => setTableViewMode("cards")}
              className={`flex items-center gap-1.5 px-3 py-1 font-semibold rounded-lg transition-colors cursor-pointer ${
                tableViewMode === "cards" ? "bg-neutral-800 text-white shadow-xs" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cartes</span>
            </button>
          </div>

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
            size="sm"
            onClick={() => setNewModalOpen(true)}
            className="gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
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

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-neutral-900/60 border border-neutral-800 p-3 rounded-2xl">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Recherche (Client, numéro, réponse, remarque)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={selectedSector}
          onChange={(e) => setSelectedSector(e.target.value)}
          className="h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500"
        >
          <option value="">Tous les types / secteurs</option>
          {SECTORS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={selectedWilaya}
          onChange={(e) => setSelectedWilaya(e.target.value)}
          className="h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500"
        >
          <option value="">Toutes les adresses / zones</option>
          {WILAYAS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500"
        >
          <option value="">Tous les états</option>
          {Object.entries(PROSPECT_STATUSES).map(([key, val]) => (
            <option key={key} value={key}>
              {val.label}
            </option>
          ))}
        </select>

        <select
          value={selectedCommercial}
          onChange={(e) => setSelectedCommercial(e.target.value)}
          className="h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500"
        >
          <option value="">Tous les commerciaux</option>
          <option value="unassigned">Non assigné</option>
          {salesUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {/* VUE 1 : TABLEAU 10 COLONNES + COLONNE COMMERCIALE */}
      {tableViewMode === "table10" && (
        <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-700">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-neutral-950/90 border-b border-neutral-800 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3">CLIENT</th>
                  <th className="py-3 px-3">NUMERO</th>
                  <th className="py-3 px-2 text-center text-emerald-400 w-20" title="WhatsApp standard post-appel & Email IA de recommandation">CONTACT</th>
                  <th className="py-3 px-3">DATE</th>
                  <th className="py-3 px-3">TYPE</th>
                  <th className="py-3 px-3">ADRESS</th>
                  <th className="py-3 px-3">APPEL</th>
                  <th className="py-3 px-3 text-emerald-400">RÉSULTAT D'APPEL</th>
                  <th className="py-3 px-3">MAIL</th>
                  <th className="py-3 px-3">REPENSE</th>
                  <th className="py-3 px-3">REMARQUE</th>
                  <th className="py-3 px-3 text-blue-400 bg-blue-950/20">COMMERCIAL</th>
                  <th className="py-3 px-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-medium text-neutral-300">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-neutral-500 font-normal">
                      Aucun prospect trouvé. Cliquez sur "Importer Excel" pour charger vos fichiers.
                    </td>
                  </tr>
                )}

                {paginatedProspects.map((prospect) => {
                  const statusConfig = PROSPECT_STATUSES[prospect.status] || {
                    label: prospect.rawState || prospect.status,
                    color: "bg-neutral-800 text-neutral-300",
                  };

                  return (
                    <tr key={prospect.id} className="hover:bg-neutral-800/40 transition-colors">
                      {/* 1. CLIENT (Cliquable pour ouvrir la fiche) */}
                      <td
                        onClick={() => openEditModal(prospect)}
                        className="py-2.5 px-3 font-semibold text-neutral-100 flex items-center gap-1.5 max-w-[200px] truncate cursor-pointer hover:text-blue-400 group"
                        title="Cliquer pour ouvrir la fiche détaillée"
                      >
                        <Building className="w-3.5 h-3.5 text-blue-400 shrink-0 group-hover:scale-110 transition-transform" />
                        <span className="truncate group-hover:underline">{prospect.companyName}</span>
                      </td>

                      {/* 2. NUMERO */}
                      <td className="py-2.5 px-3 font-mono text-[11px]">
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
                          className="text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{prospect.phone}</span>
                        </a>
                      </td>

                      {/* WHATSAPP DIRECT & EMAIL IA (Automatique après la colonne NUMERO) */}
                      <td className="py-2.5 px-2 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          {prospect.phone ? (
                            <a
                              href={buildWhatsAppUrl(prospect.phone, prospect.companyName, prospect.contactName)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                trackCommunicationClick({
                                  type: "WHATSAPP",
                                  targetName: prospect.companyName || prospect.contactName,
                                  phone: prospect.phone,
                                  entityType: "PROSPECT",
                                  entityId: prospect.id,
                                });
                              }}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/15 hover:bg-[#25D366] text-[#25D366] hover:text-white border border-emerald-500/30 hover:border-[#25D366] transition-all shadow-xs hover:scale-110 cursor-pointer"
                              title={`Envoyer un message WhatsApp standard après appel à ${prospect.companyName}`}
                            >
                              <WhatsAppIcon className="w-4 h-4" />
                            </a>
                          ) : (
                            <span className="text-neutral-600 text-xs">—</span>
                          )}

                          <button
                            type="button"
                            onClick={() => setAiEmailProspect(prospect)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-500/15 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 hover:border-indigo-600 transition-all shadow-xs hover:scale-110 cursor-pointer"
                            title={`Email IA : Proposition commerciale & Recommandation de pack pour ${prospect.companyName}`}
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* 3. DATE (Vide au début, se marque automatiquement à la date du jour lors du contact) */}
                      <td className="py-2.5 px-3 text-[11px]">
                        {prospect.prospectionDate ? (
                          <span className="text-neutral-300 font-mono">
                            {formatDate(prospect.prospectionDate)}
                          </span>
                        ) : (
                          <span className="text-neutral-600 font-mono">—</span>
                        )}
                      </td>

                      {/* 4. TYPE */}
                      <td className="py-2.5 px-3">
                        <span className="text-blue-400 font-medium">{prospect.sector}</span>
                      </td>

                      {/* 5. ADRESS */}
                      <td className="py-2.5 px-3 text-neutral-300 max-w-[150px] truncate">
                        {prospect.address || prospect.wilaya || "—"}
                      </td>

                      {/* 6. APPEL (Statut d'appel) */}
                      <td className="py-2 px-2">
                        <select
                          value={prospect.callStatus || ""}
                          onChange={(e) => handleInlineFieldChange(prospect.id, "callStatus", e.target.value)}
                          className={`h-7 px-2 text-[11px] font-semibold rounded-lg border focus:outline-none cursor-pointer transition-all ${
                            prospect.callStatus === "EFFECTUE"
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                              : prospect.callStatus?.includes("PAS") || prospect.callStatus?.includes("OCCUPE")
                              ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                              : "bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-700"
                          }`}
                          title="Changer le statut d'appel"
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

                      {/* 7. RÉSULTAT D'APPEL (Modification directe par liste déroulante) */}
                      <td className="py-2 px-2">
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
                              className={`h-7 px-2 text-[10px] font-semibold rounded-lg border focus:outline-none cursor-pointer transition-all max-w-[140px] ${
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
                              title="Modifier le résultat de l'appel directement"
                            >
                              <option value="" className="bg-neutral-950 text-neutral-400">— Résultat —</option>
                              <option value="INTERESTED" className="bg-neutral-950 text-emerald-400 font-bold">Intéressé</option>
                              <option value="APPOINTMENT_BOOKED" className="bg-neutral-950 text-purple-400 font-bold">RDV fixé</option>
                              <option value="CALLBACK_REQUESTED" className="bg-neutral-950 text-blue-400">Rappel demandé</option>
                              <option value="NOT_INTERESTED" className="bg-neutral-950 text-rose-400">Pas intéressé</option>
                              <option value="NO_ANSWER" className="bg-neutral-950 text-amber-400">Ne répond pas</option>
                              <option value="UNREACHABLE" className="bg-neutral-950 text-red-400">Injoignable</option>
                            </select>
                          );
                        })()}
                      </td>

                      {/* 8. MAIL */}
                      <td className="py-2.5 px-3 text-neutral-400 text-[11px] max-w-[140px] truncate">
                        {prospect.email || "—"}
                      </td>

                      {/* 9. REPENSE (Édition directe en ligne) */}
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          defaultValue={prospect.response || ""}
                          onBlur={(e) => {
                            if (e.target.value !== (prospect.response || "")) {
                              handleInlineFieldChange(prospect.id, "response", e.target.value);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          placeholder="Réponse..."
                          className="w-32 h-7 px-2 text-[11px] bg-neutral-950/70 border border-transparent hover:border-neutral-700 focus:border-blue-500 focus:bg-neutral-900 rounded-lg text-amber-400/90 placeholder:text-neutral-600 focus:outline-none font-sans truncate transition-colors"
                          title="Modifier directement la réponse (Entrée pour valider)"
                        />
                      </td>

                      {/* 10. REMARQUE (Édition directe en ligne) */}
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          defaultValue={prospect.notes || ""}
                          onBlur={(e) => {
                            if (e.target.value !== (prospect.notes || "")) {
                              handleInlineFieldChange(prospect.id, "notes", e.target.value);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          placeholder="Remarque..."
                          className="w-32 h-7 px-2 text-[11px] bg-neutral-950/70 border border-transparent hover:border-neutral-700 focus:border-blue-500 focus:bg-neutral-900 rounded-lg text-neutral-300 placeholder:text-neutral-600 focus:outline-none font-sans truncate transition-colors"
                          title="Modifier directement la remarque (Entrée pour valider)"
                        />
                      </td>

                      {/* 11. COLONNE COMMERCIALE (Synchronisation directe) */}
                      <td className="py-2.5 px-3 bg-blue-950/10">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-blue-400 shrink-0" />
                          <select
                            value={prospect.assignedTo?.id || ""}
                            onChange={(e) => handleQuickAssign(prospect.id, e.target.value)}
                            className="h-7 px-2 text-[11px] font-medium bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:border-blue-500 focus:outline-none cursor-pointer hover:border-neutral-700 max-w-[130px]"
                            title="Changer le commercial assigné"
                          >
                            <option value="" className="text-neutral-500">Non assigné</option>
                            {salesUsers.map((u) => (
                              <option key={u.id} value={u.id} className="text-neutral-200">
                                {u.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* 12. ACTIONS */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(prospect)}
                            className="px-2 py-1 bg-neutral-800 hover:bg-blue-600 hover:text-white rounded-lg text-neutral-300 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-medium border border-neutral-700/60"
                            title="Ouvrir la fiche et modifier"
                          >
                            <FileText className="w-3 h-3 text-blue-400 group-hover:text-white" />
                            <span>Fiche</span>
                          </button>

                          <button
                            onClick={() => handleTransferToAppels(prospect)}
                            disabled={transferringId === prospect.id}
                            className="px-2 py-1 bg-emerald-500/15 hover:bg-emerald-600 hover:text-white text-emerald-400 rounded-lg transition-colors cursor-pointer border border-emerald-500/30 shadow-xs disabled:opacity-50 flex items-center gap-1 text-[11px] font-bold"
                            title="Déplacer vers les Appels et la Base de données (+)"
                          >
                            {transferringId === prospect.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                            ) : (
                              <Plus className="w-3.5 h-3.5" />
                            )}
                            <span>+ Appels</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VUE 2 : CARTES ERP */}
      {tableViewMode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedProspects.map((prospect) => (
            <div
              key={prospect.id}
              className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 space-y-3 hover:border-neutral-700 transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {prospect.sector}
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    {prospect.wilaya}
                  </span>
                </div>

                <h3 className="text-base font-bold text-neutral-100">{prospect.companyName}</h3>
                
                <div className="flex items-center justify-between gap-2">
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
                    className="text-emerald-400 font-mono text-xs hover:underline flex items-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{prospect.phone}</span>
                  </a>
                  {prospect.phone && (
                    <a
                      href={buildWhatsAppUrl(prospect.phone, prospect.companyName, prospect.contactName)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        trackCommunicationClick({
                          type: "WHATSAPP",
                          targetName: prospect.companyName || prospect.contactName,
                          phone: prospect.phone,
                          entityType: "PROSPECT",
                          entityId: prospect.id,
                        });
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-[#25D366] text-[#25D366] hover:text-white border border-emerald-500/30 hover:border-[#25D366] text-[10px] font-semibold transition-all shadow-xs hover:scale-105"
                      title={`Envoyer un message WhatsApp standard après appel à ${prospect.companyName}`}
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => setAiEmailProspect(prospect)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 hover:border-indigo-600 text-[10px] font-semibold transition-all shadow-xs hover:scale-105 cursor-pointer"
                    title="Générer Email IA de proposition commerciale"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email IA</span>
                  </button>
                </div>

                {prospect.response && (
                  <p className="p-2 bg-neutral-950/60 rounded-xl text-xs text-amber-400/90 font-medium">
                    💬 {prospect.response}
                  </p>
                )}

                {prospect.notes && (
                  <p className="text-[11px] text-neutral-400 italic truncate">
                    "{prospect.notes}"
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
                <span className="text-[10px] text-neutral-500">
                  {prospect.callStatus || "Non contacté"}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(prospect)}
                    className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-300 transition-colors cursor-pointer"
                    title="Modifier la fiche"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleTransferToAppels(prospect)}
                    disabled={transferringId === prospect.id}
                    className="px-2 py-1 bg-emerald-500/15 hover:bg-emerald-600 hover:text-white text-emerald-400 border border-emerald-500/30 rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1 text-[11px] font-bold"
                    title="Déplacer vers les Appels et la Base de données (+)"
                  >
                    {transferringId === prospect.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    ) : (
                      <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>+ Appels</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Barre de Pagination Optimisée */}
      {filtered.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-neutral-900/80 border border-neutral-800 rounded-2xl text-xs shadow-lg">
          <div className="flex flex-wrap items-center gap-3 text-neutral-400">
            <span>
              Affichage de <strong className="text-neutral-100">{pageSize === "all" ? 1 : (currentPage - 1) * pageSize + 1}</strong> à{" "}
              <strong className="text-neutral-100">{pageSize === "all" ? filtered.length : Math.min(currentPage * pageSize, filtered.length)}</strong> sur{" "}
              <strong className="text-blue-400">{filtered.length.toLocaleString("fr-FR")}</strong> prospects
            </span>
            <div className="flex items-center gap-1.5 ml-2 border-l border-neutral-800 pl-3">
              <span className="text-[11px] text-neutral-500">Par page :</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value === "all" ? "all" : Number(e.target.value);
                  setPageSize(val);
                  setCurrentPage(1);
                }}
                className="h-7 px-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-blue-500 text-xs cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50 (recommandé)</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value="all">Tous ({filtered.length})</option>
              </select>
            </div>
          </div>

          {pageSize !== "all" && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Première page"
              >
                «
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold"
              >
                ‹ Précédent
              </button>

              <div className="flex items-center gap-1 mx-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && p - prev > 1;
                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && <span className="px-1 text-neutral-600">...</span>}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`w-8 h-8 rounded-lg font-bold transition-all ${
                            currentPage === p
                              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                              : "bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800"
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold"
              >
                Suivant ›
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Dernière page"
              >
                »
              </button>
            </div>
          )}
        </div>
      )}

      {/* 1. MODAL: NOUVEAU PROSPECT */}
      <Modal
        isOpen={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        title="Créer un nouveau prospect"
        description="Renseignez les coordonnées commerciales du lead pour l'intégrer au CRM"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Entreprise / Clinique / Marque (CLIENT) *"
              value={newForm.companyName}
              onChange={(e) => setNewForm({ ...newForm, companyName: e.target.value })}
              placeholder="ex: Hôtel Les Pins"
              required
            />

            <Input
              label="Nom du contact / Responsable"
              value={newForm.contactName}
              onChange={(e) => setNewForm({ ...newForm, contactName: e.target.value })}
              placeholder="ex: Dr. Benali"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Téléphone (NUMERO) *"
              value={newForm.phone}
              onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
              placeholder="ex: 0550 12 34 56"
              required
            />

            <Input
              label="Email (MAIL)"
              type="email"
              value={newForm.email}
              onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
              placeholder="contact@entreprise.dz"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Secteur / Type (TYPE) *</label>
              <select
                value={newForm.sector}
                onChange={(e) => setNewForm({ ...newForm, sector: e.target.value })}
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
              <label className="text-xs font-medium text-neutral-300">Wilaya / Zone (ADRESS) *</label>
              <select
                value={newForm.wilaya}
                onChange={(e) => setNewForm({ ...newForm, wilaya: e.target.value })}
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

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-300">Commercial Responsable</label>
            <select
              value={newForm.assignedToId}
              onChange={(e) => setNewForm({ ...newForm, assignedToId: e.target.value })}
              className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
            >
              {salesUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Notes & Remarques (REMARQUE)"
            value={newForm.notes}
            onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })}
            placeholder="Besoins exprimés, budget, remarques..."
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
            <Button type="button" variant="outline" onClick={() => setNewModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Enregistrer le prospect
            </Button>
          </div>
        </form>
      </Modal>

      {/* 2. MODAL: ENREGISTRER UN APPEL */}
      <Modal
        isOpen={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        title={`Journaliser un appel : ${activeProspect?.companyName}`}
        description="Enregistrez l'issue de la communication pour mettre à jour la qualification du lead"
        maxWidth="md"
      >
        <form onSubmit={handleCallSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-300">Résultat de l'appel (APPEL / ETAT) *</label>
            <select
              value={callForm.result}
              onChange={(e) => setCallForm({ ...callForm, result: e.target.value as CallResult })}
              className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
            >
              {Object.entries(CALL_RESULTS).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.label}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Durée estimée (secondes)"
            type="number"
            value={callForm.durationSeconds}
            onChange={(e) => setCallForm({ ...callForm, durationSeconds: Number(e.target.value) })}
          />

          <Input
            label="Réponse du client (REPENSE)"
            value={callForm.comment}
            onChange={(e) => setCallForm({ ...callForm, comment: e.target.value })}
            placeholder="Réponse donnée par le prospect..."
          />

          <div className="flex items-center gap-2 p-3 bg-neutral-800/40 border border-neutral-700/60 rounded-xl text-xs">
            <input
              type="checkbox"
              id="autoFollowUp"
              checked={callForm.autoScheduleFollowUp}
              onChange={(e) => setCallForm({ ...callForm, autoScheduleFollowUp: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="autoFollowUp" className="text-neutral-300 cursor-pointer">
              Générer automatiquement la séquence de relance (J+3, J+7, J+15)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
            <Button type="button" variant="outline" onClick={() => setCallModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Enregistrer l'appel
            </Button>
          </div>
        </form>
      </Modal>

      {/* 3. MODAL: PLANIFIER UN RENDEZ-VOUS */}
      <Modal
        isOpen={appointmentModalOpen}
        onClose={() => setAppointmentModalOpen(false)}
        title={`Planifier un rendez-vous : ${activeProspect?.companyName}`}
        description="Fixez une date et un lieu de rencontre commerciale"
        maxWidth="md"
      >
        <form onSubmit={handleAppointmentSubmit} className="space-y-4">
          <Input
            label="Titre de la rencontre *"
            value={appointmentForm.title}
            onChange={(e) => setAppointmentForm({ ...appointmentForm, title: e.target.value })}
            required
          />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-300">Type de RDV</label>
            <select
              value={appointmentForm.type}
              onChange={(e) => setAppointmentForm({ ...appointmentForm, type: e.target.value as AppointmentType })}
              className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
            >
              {Object.entries(APPOINTMENT_TYPES).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Input
              label="Date *"
              type="date"
              value={appointmentForm.date}
              onChange={(e) => setAppointmentForm({ ...appointmentForm, date: e.target.value })}
              required
            />
            <Input
              label="Début *"
              type="time"
              value={appointmentForm.startTime}
              onChange={(e) => setAppointmentForm({ ...appointmentForm, startTime: e.target.value })}
              required
            />
            <Input
              label="Fin *"
              type="time"
              value={appointmentForm.endTime}
              onChange={(e) => setAppointmentForm({ ...appointmentForm, endTime: e.target.value })}
              required
            />
          </div>

          <Input
            label="Lieu ou Lien Visio"
            value={appointmentForm.location}
            onChange={(e) => setAppointmentForm({ ...appointmentForm, location: e.target.value })}
            placeholder="ex: Cabinet du client / Google Meet"
          />

          <Input
            label="Notes de préparation"
            value={appointmentForm.notes}
            onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })}
            placeholder="Documents à apporter, points à négocier..."
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
            <Button type="button" variant="outline" onClick={() => setAppointmentModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Confirmer le Rendez-vous
            </Button>
          </div>
        </form>
      </Modal>

      {/* 4. MODAL: IMPORTER FICHIER EXCEL (10 COLONNES STRICTES) */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Importer la liste des prospects (10 Colonnes)"
        description="Format pris en charge : CLIENT | NUMERO | DATE | TYPE | ADRESS | APPEL | ETAT | MAIL | REPENSE | REMARQUE"
        maxWidth="2xl"
      >
        <div className="space-y-5">
          {/* Bannière Anti-Doublons & Auto-Relance */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-emerald-950/30 border border-blue-500/30 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-blue-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Système Anti-Doublons & Moteur de Relance Automatique</span>
            </div>
            <div className="space-y-1 text-[11px] text-neutral-300 leading-relaxed">
              <p>
                🛡️ <strong>Élimination stricte des doublons :</strong> Si un numéro de téléphone ou un nom de prospect existe déjà dans la base (ou dans vos clients), il est <strong>automatiquement éliminé</strong> de l'import et le prospect existant est <strong>conservé intact</strong>.
              </p>
              <p>
                ⚡ <strong>Mise en relance automatique :</strong> Tout prospect importé comme <strong>contacté</strong> (ex: Effectué, Intéressé, À rappeler, RDV...) est immédiatement intégré au moteur de relance (+3j, +7j, +15j). Les prospects <strong>Pas de contact</strong> et <strong>Pas intéressé</strong> en sont automatiquement exclus.
              </p>
            </div>
          </div>

          {/* Option A: Direct import from local file if detected */}
          {localFileInfo?.exists && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border border-blue-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs">
                  <Zap className="w-4 h-4 text-blue-400" />
                  <span>
                    Fichier local détecté : {localFileInfo.filePath ? localFileInfo.filePath.split("/").pop() : "PROSPECTION BOOSTERA.xlsx"}
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400 font-mono">Dossier Downloads</span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="w-full sm:w-2/3 space-y-1">
                  <label className="text-[11px] text-neutral-300 font-medium">
                    Sélectionner la feuille à importer :
                  </label>
                  <select
                    value={directImportSheet}
                    onChange={(e) => setDirectImportSheet(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-neutral-900 border border-neutral-700 rounded-xl text-neutral-100"
                  >
                    {localFileInfo.sheets.map((s) => (
                      <option key={s} value={s}>
                        Feuille : {s} {s === "TOUS" ? "★ (Recommandée - 1600+ prospects)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-full sm:w-1/3 sm:pt-4">
                  <Button
                    type="button"
                    size="sm"
                    className="w-full h-9 bg-blue-600 hover:bg-blue-500 text-xs font-semibold"
                    isLoading={isLoading}
                    onClick={handleDirectLocalImport}
                  >
                    <span>Importer cette feuille</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Option B: Upload any Excel/CSV file */}
          <div className="border-2 border-dashed border-neutral-800 rounded-2xl p-6 text-center hover:border-blue-500/50 transition-colors">
            <FileSpreadsheet className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
            <p className="text-xs text-neutral-200 font-semibold">
              Ou glissez-déposez un fichier Excel (.xlsx, .xls) ou CSV
            </p>
            <p className="text-[10px] text-neutral-400 mt-1 font-mono">
              Colonnes reconnues : CLIENT • NUMERO • DATE • TYPE • ADRESS • APPEL • ETAT • MAIL • REPENSE • REMARQUE
            </p>
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="mt-4 text-xs text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
            />
          </div>

          {/* Sheet selector for uploaded workbook */}
          {availableSheets.length > 1 && (
            <div className="flex items-center gap-3 p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-xs">
              <span className="text-neutral-400 font-medium">Feuille du classeur :</span>
              <select
                value={selectedSheetName}
                onChange={(e) => handleSheetChange(e.target.value)}
                className="h-8 px-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 font-semibold"
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
            <div className="p-3 bg-neutral-800/60 border border-neutral-700 rounded-xl text-xs flex items-center justify-between">
              <span className="text-neutral-200 font-medium">{importStatus}</span>
              <span className="text-emerald-400 font-semibold">Dédoublonnage automatique activé</span>
            </div>
          )}

          {/* Synchronisation Commerciale lors de l'Import */}
          <div className="p-3.5 bg-gradient-to-r from-blue-950/30 to-neutral-900 border border-blue-500/20 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span>Synchronisation commerciale des nouveaux prospects :</span>
              </label>
              <span className="text-[10px] text-blue-400/80 font-mono">Affectation automatique</span>
            </div>
            <select
              value={importAssignedToId}
              onChange={(e) => setImportAssignedToId(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 focus:border-blue-500 focus:outline-none"
            >
              <option value="">★ Détection automatique selon la colonne "COMMERCIAL" ou le nom de la feuille</option>
              {salesUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  Assigner et synchroniser tous les prospects importés avec : {u.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-neutral-400">
              Chaque prospect importé sera automatiquement rattaché au commercial sélectionné et apparaîtra dans sa colonne dédiée.
            </p>
          </div>

          {/* Mode Liste Vierge Option */}
          {importedRows.length > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  Mode Liste Vierge pour Prospection (Recommandé)
                </p>
                <p className="text-[11px] text-neutral-300 mt-0.5">
                  Réinitialise l&apos;Appel (« — Appel — ») et le Résultat (« — Résultat — ») à vide pour créer des fiches vierges prêtes à être appelées par l&apos;équipe.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={importAsVirgin}
                  onChange={(e) => setImportAsVirgin(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          )}

          {/* Live 10-Column Preview */}
          {importedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>Aperçu des 5 premières lignes avant confirmation :</span>
                <span className="text-neutral-300 font-semibold">{importedRows.length} lignes prêtes</span>
              </div>
              <div className="max-h-56 overflow-x-auto overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950">
                <table className="w-full text-[10px] text-left whitespace-nowrap">
                  <thead className="bg-neutral-900 border-b border-neutral-800 text-neutral-400 font-bold uppercase">
                    <tr>
                      <th className="p-2">CLIENT</th>
                      <th className="p-2">NUMERO</th>
                      <th className="p-2">DATE</th>
                      <th className="p-2">TYPE</th>
                      <th className="p-2">ADRESS</th>
                      <th className="p-2">APPEL</th>
                      <th className="p-2">ETAT</th>
                      <th className="p-2">MAIL</th>
                      <th className="p-2">REPENSE</th>
                      <th className="p-2">REMARQUE</th>
                      <th className="p-2 text-blue-400">COMMERCIAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60 text-neutral-300 font-mono">
                    {importedRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="hover:bg-neutral-900/50">
                        <td className="p-2 font-bold font-sans text-neutral-100">{row.companyName}</td>
                        <td className="p-2 text-emerald-400">{row.phone}</td>
                        <td className="p-2">{importAsVirgin ? "—" : (row.date || "—")}</td>
                        <td className="p-2 text-blue-400 font-sans">{row.sector}</td>
                        <td className="p-2 font-sans">{row.address || "—"}</td>
                        <td className={`p-2 ${importAsVirgin ? "text-neutral-500 font-sans" : ""}`}>
                          {importAsVirgin ? "— Appel —" : (row.callStatus || "—")}
                        </td>
                        <td className={`p-2 ${importAsVirgin ? "text-neutral-500 font-sans" : "text-amber-400"}`}>
                          {importAsVirgin ? "— Résultat —" : (row.rawState || "—")}
                        </td>
                        <td className="p-2">{row.email || "—"}</td>
                        <td className="p-2 text-neutral-300 font-sans">{importAsVirgin ? "—" : (row.response || "—")}</td>
                        <td className="p-2 text-neutral-400 font-sans">{importAsVirgin ? "—" : (row.notes || "—")}</td>
                        <td className="p-2 text-blue-400 font-sans">
                          {row.commercialName ||
                            (importAssignedToId ? salesUsers.find((u) => u.id === importAssignedToId)?.name : "Auto / Connecté")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importProgress && (
            <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/60 rounded-xl space-y-2 mt-2">
              <div className="flex justify-between items-center text-xs font-semibold text-emerald-400">
                <span className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  {importProgress.statusText}
                </span>
                <span className="font-mono">{importProgress.percent}%</span>
              </div>
              <div className="w-full bg-neutral-800/80 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300 ease-out shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                  style={{ width: `${importProgress.percent}%` }}
                />
              </div>
              <p className="text-[11px] text-neutral-400 text-center">
                Traitement par lots sécurisés en cours. Veuillez ne pas fermer cette page.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={() => setImportModalOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              disabled={importedRows.length === 0 || isLoading}
              isLoading={isLoading}
              onClick={handleBulkImportConfirm}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {importProgress
                ? `Importation (${importProgress.percent}%)...`
                : `Importer les ${importedRows.length} prospects`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 6. MODAL: FICHE PROSPECT & MODIFICATION DES DÉTAILS */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Fiche Prospect : ${editForm.companyName}`}
        description="Consultez et modifiez les détails du prospect, ou synchronisez le commercial assigné"
        maxWidth="2xl"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {/* Quick Actions Bar inside the sheet */}
          <div className="flex items-center justify-between p-3 bg-neutral-900/90 border border-neutral-800 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-blue-400" />
                Actions rapides :
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => activeProspect && handleTransferToAppels(activeProspect)}
                disabled={!activeProspect || transferringId === activeProspect.id}
                className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                title="Déplacer vers les Appels et la Base de données (+)"
              >
                {activeProspect && transferringId === activeProspect.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                ) : (
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>Déplacer vers Appels & Base (+)</span>
              </button>
              {editForm.phone && (
                <a
                  href={buildWhatsAppUrl(editForm.phone, editForm.companyName, editForm.contactName)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-emerald-500/15 hover:bg-[#25D366] text-[#25D366] hover:text-white border border-emerald-500/30 hover:border-[#25D366] rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  title="Envoyer un message WhatsApp standard après appel"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              )}
              {activeProspect && (
                <button
                  type="button"
                  onClick={() => setAiEmailProspect(activeProspect)}
                  className="px-2.5 py-1 bg-indigo-500/15 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 hover:border-indigo-600 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  title="Générer Email IA avec recommandation de pack"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email IA</span>
                </button>
              )}
              {(() => {
                const hasAppointment =
                  (activeProspect?._count?.appointments ?? 0) > 0 ||
                  activeProspect?.status === ProspectStatus.MEETING_SCHEDULED ||
                  activeProspect?.rawState === "RDV PRIS" ||
                  (activeProspect?.appointments && activeProspect.appointments.length > 0);

                return (
                  <button
                    type="button"
                    onClick={() => {
                      setAppointmentForm((prev) => ({
                        ...prev,
                        title: `RDV — ${editForm.companyName}`,
                      }));
                      setAppointmentModalOpen(true);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                      hasAppointment
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-600 hover:text-white"
                        : "bg-neutral-800 hover:bg-purple-600 hover:text-white text-neutral-300"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{hasAppointment ? "✓ RDV Planifié" : "Planifier RDV"}</span>
                  </button>
                );
              })()}
              {canDelete && activeProspect && (
                <button
                  type="button"
                  onClick={() => handleDeleteProspect(activeProspect.id)}
                  className="px-2 py-1 bg-rose-600/10 hover:bg-rose-600 hover:text-white border border-rose-500/20 text-rose-400 text-xs rounded-lg transition-colors cursor-pointer"
                  title="Supprimer le prospect"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Form Fields: 10 Colonnes + Commercial */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* 1. CLIENT */}
            <Input
              label="Nom du Client / Entreprise (CLIENT) *"
              value={editForm.companyName}
              onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
              required
            />

            {/* 2. NUMERO */}
            <Input
              label="Numéro de Téléphone (NUMERO) *"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              required
            />

            {/* 3. DATE */}
            <Input
              label="Date de Prospection (DATE)"
              type="date"
              value={editForm.prospectionDate}
              onChange={(e) => setEditForm({ ...editForm, prospectionDate: e.target.value })}
            />

            {/* 4. TYPE */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Type / Secteur d'activité (TYPE)</label>
              <input
                type="text"
                list="sector-list"
                value={editForm.sector}
                onChange={(e) => setEditForm({ ...editForm, sector: e.target.value })}
                className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
                placeholder="ex: Agence de voyage, Clinique..."
              />
              <datalist id="sector-list">
                {SECTORS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            {/* 5. ADRESS & WILAYA */}
            <Input
              label="Adresse / Zone (ADRESS)"
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              placeholder="ex: Draria, Bir Mourad Rais, Oran..."
            />

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Wilaya</label>
              <select
                value={editForm.wilaya}
                onChange={(e) => setEditForm({ ...editForm, wilaya: e.target.value })}
                className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100 focus:outline-none focus:border-blue-500"
              >
                {WILAYAS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            {/* 6. APPEL */}
            <Input
              label="Statut d'Appel (APPEL)"
              value={editForm.callStatus}
              onChange={(e) => {
                const val = e.target.value;
                const isContact = val && val.trim() && val.trim().toUpperCase() !== "NON EFFECTUE";
                setEditForm({
                  ...editForm,
                  callStatus: val,
                  prospectionDate: editForm.prospectionDate || (isContact ? toLocalDateString(new Date()) : editForm.prospectionDate),
                });
              }}
              placeholder="ex: EFFECTUE, PAS DE CONTACT, OCCUPE..."
            />

            {/* 7. RÉSULTAT D'APPEL */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Résultat d'Appel (RÉSULTAT D'APPEL)</label>
              <select
                value={editForm.callResult || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditForm({
                    ...editForm,
                    callResult: val,
                    prospectionDate: editForm.prospectionDate || (val ? toLocalDateString(new Date()) : editForm.prospectionDate),
                  });
                }}
                className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100 focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="">— Aucun résultat d'appel —</option>
                <option value="INTERESTED">Intéressé</option>
                <option value="APPOINTMENT_BOOKED">RDV fixé</option>
                <option value="CALLBACK_REQUESTED">Rappel demandé</option>
                <option value="NOT_INTERESTED">Pas intéressé</option>
                <option value="NO_ANSWER">Ne répond pas</option>
                <option value="UNREACHABLE">Injoignable</option>
              </select>
            </div>

            {/* 8. MAIL */}
            <Input
              label="Adresse Mail ou Contact (MAIL)"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              placeholder="contact@entreprise.com ou lien WhatsApp"
            />

            {/* 9. COMMERCIAL ASSIGNÉ (SYNCHRONISATION) */}
            <div className="space-y-1.5 bg-blue-950/20 p-2.5 rounded-xl border border-blue-500/20">
              <label className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Commercial Assigné (COMMERCIAL) *</span>
              </label>
              <select
                value={editForm.assignedToId}
                onChange={(e) => setEditForm({ ...editForm, assignedToId: e.target.value })}
                className="w-full h-9 px-3 text-xs bg-neutral-900 border border-neutral-700 rounded-xl text-neutral-100 font-semibold focus:border-blue-500 focus:outline-none"
              >
                <option value="">Non assigné</option>
                {salesUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-neutral-400">
                La modification synchronise immédiatement le prospect avec ce commercial.
              </p>
            </div>

            {/* 10. REPENSE (Full width) */}
            <div className="md:col-span-2">
              <Input
                label="Réponse du Prospect (REPENSE)"
                value={editForm.response}
                onChange={(e) => setEditForm({ ...editForm, response: e.target.value })}
                placeholder="ex: no service, ps intrs, rappeler mardi, intéressé par pack Elite..."
              />
            </div>

            {/* 11. REMARQUE (Full width) */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Remarques & Notes (REMARQUE)</label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
                placeholder="Historique, budget estimé, exigences..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
            <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={isLoading} className="bg-blue-600 hover:bg-blue-500 gap-1.5">
              <Save className="w-3.5 h-3.5" />
              <span>Enregistrer les modifications</span>
            </Button>
          </div>
        </form>
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
