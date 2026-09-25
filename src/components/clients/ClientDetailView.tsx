"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CLIENT_STATUSES,
  CLIENT_MAIN_STATUSES,
  OFFER_TYPES,
  OFFER_DETAILS,
  CALL_RESULTS,
  PAYMENT_METHODS,
  AGENCY_DETAILS,
  SECTORS,
  WILAYAS,
} from "@/lib/constants";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  toLocalDateString,
  formatBytes,
  amountToFrenchWords,
  parseInvoiceNotes,
  parseClientMedia,
  normalizeMediaUrl,
  type ClientMediaLinks,
  parseClientBilling,
  serializeClientBilling,
  type ClientBillingData,
} from "@/lib/utils";
import { trackCommunicationClick } from "@/lib/tracking";
import {
  CallResult,
  ProjectStatus,
  InvoiceStatus,
  PaymentMethod,
  PaymentType,
  ClientStatus,
  OfferType,
} from "@prisma/client";
import {
  createClientCallAction,
  createClientProjectAction,
  uploadProjectFileAction,
  uploadClientDocumentFileAction,
  addProjectFileAction,
  createClientInvoiceAction,
  createClientPaymentAction,
  createClientDocumentAction,
  updateClientMediaAction,
  updateClientAction,
  updateClientStatusAction,
  deleteClientAction,
} from "@/actions/clients";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  GoogleDriveIcon,
  GoogleBusinessIcon,
  FacebookIcon,
  InstagramIcon,
  TikTokIcon,
} from "@/components/common/MediaIcons";
import {
  Phone,
  Briefcase,
  FileText,
  PhoneCall,
  ArrowLeft,
  Receipt,
  CreditCard,
  Plus,
  Eye,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  Layers,
  FileCheck,
  User,
  ExternalLink,
  Percent,
  UploadCloud,
  Paperclip,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Download,
  Printer,
  Building2,
  Hash,
  MapPin,
  Share2,
  Copy,
  Check,
  Globe,
  Edit3,
} from "lucide-react";

interface Props {
  client: any;
  salesUsers?: { id: string; name: string; role?: string }[];
  currentUserRole?: string;
}

const PROJECT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  NEW_REQUEST: { label: "Nouvelle demande", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  PLANNING: { label: "Planification", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  IN_PRODUCTION: { label: "En production", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  CLIENT_VALIDATION: { label: "Validation client", color: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  REVISION: { label: "En révision", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  COMPLETED: { label: "Terminé / Livré", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  CANCELLED: { label: "Annulé", color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
};

const INVOICE_STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Brouillon", color: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20" },
  SENT: { label: "Émise / Envoyée", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  PAID: { label: "Payée", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  PARTIAL: { label: "Partielle", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  OVERDUE: { label: "En retard", color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  CANCELLED: { label: "Annulée", color: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20" },
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  MONTHLY_SUBSCRIPTION: "Abonnement Mensuel",
  SPONSOR_FACEBOOK: "Sponsoring Facebook",
  SPONSOR_TIKTOK: "Sponsoring TikTok",
  SPONSOR_INSTAGRAM: "Sponsoring Instagram",
  CONTENT_CREATION: "Création Contenu",
  VIDEO: "Production Vidéo",
  WEBSITE: "Site Web",
  RENEWAL: "Renouvellement",
  OTHER: "Autre",
};

export const CALL_PURPOSES: Record<
  string,
  { label: string; color: string; fallbackResult: CallResult }
> = {
  PAYMENT: {
    label: "Paiement",
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    fallbackResult: CallResult.INTERESTED,
  },
  THEMES: {
    label: "Proposition des thèmes",
    color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    fallbackResult: CallResult.INTERESTED,
  },
  DETAILS: {
    label: "Avoir des détails",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    fallbackResult: CallResult.INTERESTED,
  },
  CONTRACT_DETAILS: {
    label: "Détails du contrat",
    color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    fallbackResult: CallResult.INTERESTED,
  },
  RECLAMATION: {
    label: "Réclamation",
    color: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    fallbackResult: CallResult.CALLBACK_REQUESTED,
  },
  APPOINTMENT: {
    label: "Rendez-vous",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    fallbackResult: CallResult.APPOINTMENT_BOOKED,
  },
  SHOOTING: {
    label: "Shooting",
    color: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    fallbackResult: CallResult.INTERESTED,
  },
  DELIVERABLES: {
    label: "Validation des livrables",
    color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    fallbackResult: CallResult.INTERESTED,
  },
  OTHER: {
    label: "Autre",
    color: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20",
    fallbackResult: CallResult.INTERESTED,
  },
};

export function parseCallPurpose(comment: string | null | undefined, fallbackResult?: string) {
  if (!comment) {
    const resConfig = fallbackResult && CALL_RESULTS[fallbackResult as keyof typeof CALL_RESULTS];
    return {
      purposeKey: "OTHER",
      purposeLabel: resConfig ? resConfig.label : "Autre",
      cleanComment: "",
      color: resConfig ? resConfig.color : "bg-neutral-500/10 text-neutral-400 border-neutral-500/20",
    };
  }

  const match = comment.match(/^\[BUT:\s*([A-Za-z0-9_]+)\]\s*([\s\S]*)$/);
  if (match) {
    const key = match[1].trim();
    const cleanComment = match[2].trim();
    const config = CALL_PURPOSES[key];
    if (config) {
      return {
        purposeKey: key,
        purposeLabel: config.label,
        cleanComment,
        color: config.color,
      };
    }
    return {
      purposeKey: key,
      purposeLabel: key,
      cleanComment,
      color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    };
  }

  const resConfig = fallbackResult && CALL_RESULTS[fallbackResult as keyof typeof CALL_RESULTS];
  return {
    purposeKey: "OTHER",
    purposeLabel: resConfig ? resConfig.label : "Autre",
    cleanComment: comment,
    color: resConfig ? resConfig.color : "bg-neutral-500/10 text-neutral-400 border-neutral-500/20",
  };
}

export function ClientDetailView({ client, salesUsers = [], currentUserRole }: Props) {
  const router = useRouter();
  const isAdmin = currentUserRole === "ADMIN";
  const [clientData, setClientData] = useState(client);
  const [activeTab, setActiveTab] = useState<
    "history" | "projects" | "invoices" | "payments" | "documents" | "media"
  >("history");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Client State (Admin uniquement)
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  const [deleteClientError, setDeleteClientError] = useState<string | null>(null);

  // Edit Client Modal State (Gérer les informations du client)
  const [openEditClientModal, setOpenEditClientModal] = useState(false);
  const [editClientTab, setEditClientTab] = useState<"general" | "contract" | "media" | "billing">("general");

  const [editClientForm, setEditClientForm] = useState({
    companyName: "",
    brandName: "",
    contactName: "",
    phone: "",
    email: "",
    sector: "Immobilier",
    wilaya: "Oran",
    address: "",
    status: "ACTIVE" as ClientStatus,
    offerType: "STARTER" as OfferType,
    hasWebsite: false,
    contractStart: "",
    contractEnd: "",
    contractValue: 0,
    monthlyFee: 0,
    assignedToId: "",
    driveUrl: "",
    googleBusinessUrl: "",
    facebook: "",
    instagram: "",
    tiktok: "",
    rc: "",
    nif: "",
    nis: "",
    ai: "",
    rib: "",
  });

  const handleEditOfferSelect = (newOffer: OfferType) => {
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
      fee = editClientForm.monthlyFee || 0;
      websiteOpt = editClientForm.hasWebsite;
    }

    setEditClientForm((prev) => ({
      ...prev,
      offerType: newOffer,
      hasWebsite: websiteOpt,
      monthlyFee: fee,
    }));
  };

  const handleEditWebsiteToggle = (checked: boolean) => {
    setEditClientForm((prev) => {
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
      };
    });
  };

  const handleOpenEditClient = (initialTab: "general" | "contract" | "media" | "billing" = "general") => {
    const { media } = parseClientMedia(clientData.notes, clientData);
    const { billing } = parseClientBilling(clientData.notes);
    setEditClientForm({
      companyName: clientData.companyName || "",
      brandName: clientData.brandName || "",
      contactName: clientData.contactName || "",
      phone: clientData.phone || "",
      email: clientData.email || "",
      sector: clientData.sector || "Immobilier",
      wilaya: clientData.wilaya || "Oran",
      address: clientData.address || "",
      status: clientData.status as ClientStatus,
      offerType: clientData.offerType as OfferType,
      hasWebsite: Boolean(clientData.hasWebsite),
      contractStart: clientData.contractStart ? toLocalDateString(clientData.contractStart) : "",
      contractEnd: clientData.contractEnd ? toLocalDateString(clientData.contractEnd) : "",
      contractValue: Number(clientData.contractValue) || 0,
      monthlyFee: Number(clientData.monthlyFee) || 0,
      assignedToId: clientData.assignedToId || clientData.assignedTo?.id || "",
      driveUrl: media.driveUrl || "",
      googleBusinessUrl: media.googleBusinessUrl || "",
      facebook: media.facebook || clientData.facebook || "",
      instagram: media.instagram || clientData.instagram || "",
      tiktok: media.tiktok || "",
      rc: billing.rc || "",
      nif: billing.nif || "",
      nis: billing.nis || "",
      ai: billing.ai || "",
      rib: billing.rib || "",
    });
    setEditClientTab(initialTab);
    setOpenEditClientModal(true);
  };

  const handleSaveEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await updateClientAction(clientData.id, {
        companyName: editClientForm.companyName,
        brandName: editClientForm.brandName,
        contactName: editClientForm.contactName,
        phone: editClientForm.phone,
        email: editClientForm.email,
        sector: editClientForm.sector,
        wilaya: editClientForm.wilaya,
        address: editClientForm.address,
        status: editClientForm.status,
        offerType: editClientForm.offerType,
        hasWebsite: editClientForm.hasWebsite,
        contractStart: editClientForm.contractStart || undefined,
        contractEnd: editClientForm.contractEnd || undefined,
        contractValue: Number(editClientForm.contractValue) || 0,
        monthlyFee: Number(editClientForm.monthlyFee) || 0,
        assignedToId: editClientForm.assignedToId || undefined,
        mediaLinks: {
          driveUrl: editClientForm.driveUrl,
          googleBusinessUrl: editClientForm.googleBusinessUrl,
          facebook: editClientForm.facebook,
          instagram: editClientForm.instagram,
          tiktok: editClientForm.tiktok,
        },
        billingInfo: {
          rc: editClientForm.rc,
          nif: editClientForm.nif,
          nis: editClientForm.nis,
          ai: editClientForm.ai,
          rib: editClientForm.rib,
        },
      });

      if (res.success && res.client) {
        setClientData((prev: any) => ({
          ...prev,
          ...res.client,
          assignedTo: salesUsers.find((u) => u.id === res.client.assignedToId) || res.client.assignedTo || prev.assignedTo,
        }));
        setOpenEditClientModal(false);
        router.refresh();
      }
    } catch (err: any) {
      alert(err?.message || "Erreur lors de la mise à jour des informations du client.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClient = async () => {
    setIsDeletingClient(true);
    setDeleteClientError(null);
    try {
      const res = await deleteClientAction(clientData.id);
      if (!res.success) {
        setDeleteClientError(res.error || "Erreur lors de la suppression du client.");
        setIsDeletingClient(false);
        return;
      }
      setOpenDeleteModal(false);
      router.push("/clients");
      router.refresh();
    } catch (err: any) {
      setDeleteClientError(err?.message || "Erreur inattendue lors de la suppression.");
      setIsDeletingClient(false);
    }
  };

  // Media state & links extraction
  const { media: initialMedia } = parseClientMedia(clientData.notes, clientData);
  const [openMediaModal, setOpenMediaModal] = useState(false);
  const [mediaForm, setMediaForm] = useState<ClientMediaLinks>({
    driveUrl: initialMedia.driveUrl || "",
    googleBusinessUrl: initialMedia.googleBusinessUrl || "",
    facebook: initialMedia.facebook || "",
    instagram: initialMedia.instagram || "",
    tiktok: initialMedia.tiktok || "",
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyLink = (key: string, url?: string, platform?: any) => {
    if (!url) return;
    const fullUrl = normalizeMediaUrl(url, platform);
    navigator.clipboard.writeText(fullUrl);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await updateClientMediaAction(clientData.id, mediaForm);
      if (res.success && res.client) {
        setClientData((prev: any) => ({
          ...prev,
          ...res.client,
        }));
        setOpenMediaModal(false);
        router.refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Modals for creation
  const [openCallModal, setOpenCallModal] = useState(false);
  const [openProjectModal, setOpenProjectModal] = useState(false);
  const [openInvoiceModal, setOpenInvoiceModal] = useState(false);
  const [openPaymentModal, setOpenPaymentModal] = useState(false);
  const [openDocumentModal, setOpenDocumentModal] = useState(false);

  // Modals for viewing details ("Voir la fiche")
  const [viewCall, setViewCall] = useState<any | null>(null);
  const [viewProject, setViewProject] = useState<any | null>(null);
  const [viewInvoice, setViewInvoice] = useState<any | null>(null);
  const [viewPayment, setViewPayment] = useState<any | null>(null);
  const [viewDocument, setViewDocument] = useState<any | null>(null);

  // Forms state
  const todayStr = toLocalDateString(new Date());

  // Form Call
  const [callForm, setCallForm] = useState({
    purpose: "PAYMENT",
    durationMinutes: 5,
    calledAt: new Date().toISOString().slice(0, 16),
    comment: "",
  });

  // Form Project
  const [projectForm, setProjectForm] = useState({
    name: "",
    code: `PRJ-${new Date().getFullYear()}-${String(clientData.projects?.length + 1 || 1).padStart(3, "0")}`,
    description: "",
    status: ProjectStatus.NEW_REQUEST as ProjectStatus,
    startDate: todayStr,
    deadline: toLocalDateString(new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)),
    budget: Number(clientData.monthlyFee) || 35000,
  });

  // Project files state (Cahier des charges)
  const [projectFiles, setProjectFiles] = useState<
    Array<{ name: string; fileUrl: string; fileType: string; fileSize: number }>
  >([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Upload handler for project creation modal
  const handleProjectFileUpload = async (filesList: FileList | File[]) => {
    if (!filesList || filesList.length === 0) return;
    setIsUploadingFiles(true);
    setUploadError(null);
    try {
      const newFiles: Array<{ name: string; fileUrl: string; fileType: string; fileSize: number }> = [];
      for (let i = 0; i < filesList.length; i++) {
        const f = filesList[i];
        const formData = new FormData();
        formData.append("file", f);
        const res = await uploadProjectFileAction(formData);
        if (res.success && res.file) {
          newFiles.push(res.file);
        } else if (res.error) {
          setUploadError(res.error);
        }
      }
      setProjectFiles((prev) => [...prev, ...newFiles]);
    } catch (err: any) {
      setUploadError(err.message || "Erreur lors du téléchargement du fichier.");
    } finally {
      setIsUploadingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Upload handler for project detail modal
  const [isUploadingDetailFile, setIsUploadingDetailFile] = useState(false);
  const detailFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAddDetailFile = async (filesList: FileList | File[]) => {
    if (!filesList || filesList.length === 0 || !viewProject) return;
    setIsUploadingDetailFile(true);
    try {
      for (let i = 0; i < filesList.length; i++) {
        const f = filesList[i];
        const formData = new FormData();
        formData.append("file", f);
        const uploadRes = await uploadProjectFileAction(formData);
        if (uploadRes.success && uploadRes.file) {
          const docRes = await addProjectFileAction({
            projectId: viewProject.id,
            clientId: clientData.id,
            name: uploadRes.file.name,
            fileUrl: uploadRes.file.fileUrl,
            fileType: uploadRes.file.fileType,
            fileSize: uploadRes.file.fileSize,
          });
          if (docRes.success && docRes.document) {
            setViewProject((prev: any) => ({
              ...prev,
              documents: [docRes.document, ...(prev.documents || [])],
            }));
            setClientData((prev: any) => ({
              ...prev,
              projects: (prev.projects || []).map((p: any) =>
                p.id === viewProject.id
                  ? { ...p, documents: [docRes.document, ...(p.documents || [])] }
                  : p
              ),
              documents: [docRes.document, ...(prev.documents || [])],
            }));
          }
        }
      }
      router.refresh();
    } finally {
      setIsUploadingDetailFile(false);
      if (detailFileInputRef.current) detailFileInputRef.current.value = "";
    }
  };

  // Form Invoice
  const currentMonthName = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date());
  const defaultMonthlyFee = Number(clientData.monthlyFee) || 35000;
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: `FAC-${new Date().getFullYear()}-${String(clientData.invoices?.length + 1 || 1).padStart(4, "0")}`,
    monthLabel: `Abonnement ${currentMonthName}`,
    itemDescription: `Prestation de services digitaux & communication — Forfait mensuel (${formatCurrency(defaultMonthlyFee)}/mois)`,
    issueDate: todayStr,
    dueDate: toLocalDateString(new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)),
    taxMode: "HT" as "HT" | "TTC",
    paymentMethod: "BARIDIMOB" as "BARIDIMOB" | "ESPECES" | "VIREMENT" | "CHEQUE",
    subtotal: defaultMonthlyFee,
    taxRate: 0,
    taxAmount: 0,
    total: defaultMonthlyFee,
    status: InvoiceStatus.SENT as InvoiceStatus,
    notes: `Facturation contractuelle — Règlement sous 30 jours`,
    // Coordonnées de facturation client
    clientCompanyName: clientData.companyName || "",
    clientAddress: clientData.address || clientData.wilaya || "Alger, Algérie",
    clientPhone: clientData.phone || "",
    clientEmail: clientData.email || "",
    clientRc: "",
    clientNif: "",
    clientNis: "",
    clientAi: "",
  });

  // Form Payment
  const [paymentForm, setPaymentForm] = useState({
    amount: defaultMonthlyFee,
    paymentMethod: PaymentMethod.CASH as PaymentMethod,
    paymentType: PaymentType.MONTHLY_SUBSCRIPTION as PaymentType,
    reference: `REC-${Date.now().toString().slice(-6)}`,
    paymentDate: todayStr,
    invoiceId: clientData.invoices?.find((i: any) => i.balanceDue > 0)?.id || "",
    notes: `Règlement de l'abonnement mensuel pour ${clientData.companyName}`,
  });

  // Form Document & Upload state
  const [documentForm, setDocumentForm] = useState({
    name: `Contrat Mensuel Prestation - ${clientData.companyName}`,
    fileUrl: "#",
    fileType: "PDF",
    fileSize: 1024 * 150,
    category: "CONTRACT",
    notes: "Document contractuel officiel signé",
    sourceType: "upload" as "upload" | "link",
  });
  const [uploadedDocFile, setUploadedDocFile] = useState<{
    name: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
  } | null>(null);
  const [isUploadingDocFile, setIsUploadingDocFile] = useState(false);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);
  const docFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDocFileUpload = async (filesList: FileList | File[]) => {
    if (!filesList || filesList.length === 0) return;
    const file = filesList[0];
    setIsUploadingDocFile(true);
    setDocUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await uploadClientDocumentFileAction(formData);
      if (res.success && res.file) {
        setUploadedDocFile(res.file);
        setDocumentForm((prev) => ({
          ...prev,
          fileUrl: res.file.fileUrl,
          fileType: res.file.fileType || prev.fileType,
          fileSize: res.file.fileSize,
          name: prev.name.startsWith("Contrat Mensuel Prestation")
            ? `${file.name.replace(/\.[^/.]+$/, "")} - ${clientData.companyName}`
            : prev.name,
        }));
      } else if (res.error) {
        setDocUploadError(res.error);
      }
    } catch (err: any) {
      setDocUploadError(err.message || "Erreur lors du téléchargement du fichier.");
    } finally {
      setIsUploadingDocFile(false);
      if (docFileInputRef.current) docFileInputRef.current.value = "";
    }
  };

  // Tax mode toggle handler (HT vs TTC)
  const handleTaxModeChange = (mode: "HT" | "TTC") => {
    if (mode === "HT") {
      setInvoiceForm((prev) => ({
        ...prev,
        taxMode: "HT",
        taxRate: 0,
        taxAmount: 0,
        total: prev.subtotal,
      }));
    } else {
      setInvoiceForm((prev) => {
        const rate = prev.taxRate > 0 ? prev.taxRate : 19;
        const taxAmount = (prev.subtotal * rate) / 100;
        return {
          ...prev,
          taxMode: "TTC",
          taxRate: rate,
          taxAmount,
          total: prev.subtotal + taxAmount,
        };
      });
    }
  };

  // Recalculate invoice totals when subtotal or tax rate changes
  const handleInvoiceSubtotalChange = (subtotal: number, taxRate: number, forcedMode?: "HT" | "TTC") => {
    const mode = forcedMode || invoiceForm.taxMode;
    if (mode === "HT") {
      setInvoiceForm((prev) => ({
        ...prev,
        subtotal,
        taxRate: 0,
        taxAmount: 0,
        total: subtotal,
      }));
    } else {
      const taxAmount = (subtotal * taxRate) / 100;
      const total = subtotal + taxAmount;
      setInvoiceForm((prev) => ({ ...prev, subtotal, taxRate, taxAmount, total }));
    }
  };

  // Submit handlers
  const handleCreateCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const selectedPurpose = CALL_PURPOSES[callForm.purpose];
      const fallbackResult = selectedPurpose?.fallbackResult || CallResult.INTERESTED;

      const res = await createClientCallAction({
        clientId: clientData.id,
        purpose: callForm.purpose,
        result: fallbackResult,
        comment: callForm.comment,
        durationMinutes: Number(callForm.durationMinutes),
        calledAt: callForm.calledAt,
      });
      if (res.success) {
        setClientData((prev: any) => ({
          ...prev,
          calls: [res.call, ...(prev.calls || [])],
        }));
        setOpenCallModal(false);
        setCallForm({
          purpose: "PAYMENT",
          durationMinutes: 5,
          calledAt: new Date().toISOString().slice(0, 16),
          comment: "",
        });
        router.refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await createClientProjectAction({
        clientId: clientData.id,
        name: projectForm.name,
        code: projectForm.code,
        description: projectForm.description,
        status: projectForm.status,
        startDate: projectForm.startDate,
        deadline: projectForm.deadline,
        budget: Number(projectForm.budget),
        files: projectFiles,
      });
      if (res.success) {
        setClientData((prev: any) => ({
          ...prev,
          projects: [res.project, ...(prev.projects || [])],
          documents: res.project.documents
            ? [...res.project.documents, ...(prev.documents || [])]
            : (prev.documents || []),
        }));
        setOpenProjectModal(false);
        setProjectFiles([]);
        router.refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await createClientInvoiceAction({
        clientId: clientData.id,
        invoiceNumber: invoiceForm.invoiceNumber,
        monthLabel: invoiceForm.monthLabel,
        itemDescription: invoiceForm.itemDescription,
        issueDate: invoiceForm.issueDate,
        dueDate: invoiceForm.dueDate,
        subtotal: Number(invoiceForm.subtotal),
        taxRate: Number(invoiceForm.taxRate),
        taxAmount: Number(invoiceForm.taxAmount),
        total: Number(invoiceForm.total),
        status: invoiceForm.status,
        notes: invoiceForm.notes,
        paymentMethod: invoiceForm.paymentMethod,
        taxMode: invoiceForm.taxMode,
        clientBilling: {
          companyName: invoiceForm.clientCompanyName,
          address: invoiceForm.clientAddress,
          phone: invoiceForm.clientPhone,
          email: invoiceForm.clientEmail,
          rc: invoiceForm.clientRc,
          nif: invoiceForm.clientNif,
          nis: invoiceForm.clientNis,
          ai: invoiceForm.clientAi,
          paymentMethod: invoiceForm.paymentMethod,
          taxMode: invoiceForm.taxMode,
        },
      });
      if (res.success) {
        setClientData((prev: any) => ({
          ...prev,
          invoices: [res.invoice, ...(prev.invoices || [])],
        }));
        setOpenInvoiceModal(false);
        // Automatiquement afficher la facture officielle avec logo et bouton d'impression
        setViewInvoice(res.invoice);
        router.refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await createClientPaymentAction({
        clientId: clientData.id,
        invoiceId: paymentForm.invoiceId || undefined,
        amount: Number(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
        paymentType: paymentForm.paymentType,
        reference: paymentForm.reference,
        paymentDate: paymentForm.paymentDate,
        notes: paymentForm.notes,
      });
      if (res.success) {
        setClientData((prev: any) => ({
          ...prev,
          payments: [res.payment, ...(prev.payments || [])],
        }));
        setOpenPaymentModal(false);
        // Automatiquement ouvrir le reçu officiel de paiement pour visualisation et impression
        setViewPayment(res.payment);
        router.refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await createClientDocumentAction({
        clientId: clientData.id,
        name: documentForm.name,
        fileUrl: documentForm.fileUrl || "#",
        fileType: documentForm.fileType,
        fileSize: uploadedDocFile?.fileSize || documentForm.fileSize || 1024 * 150,
        category: documentForm.category,
        notes: documentForm.notes,
      });
      if (res.success) {
        setClientData((prev: any) => ({
          ...prev,
          documents: [res.document, ...(prev.documents || [])],
        }));
        setOpenDocumentModal(false);
        setUploadedDocFile(null);
        setDocumentForm({
          name: `Contrat Mensuel Prestation - ${clientData.companyName}`,
          fileUrl: "#",
          fileType: "PDF",
          fileSize: 1024 * 150,
          category: "CONTRACT",
          notes: "Document contractuel officiel signé",
          sourceType: "upload",
        });
        router.refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusConfig = CLIENT_STATUSES[clientData.status as keyof typeof CLIENT_STATUSES] || {
    label: clientData.status,
    color: "bg-neutral-800 text-neutral-300",
    dot: "bg-neutral-400",
    accent: "#737373",
  };

  // State for quick status change
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const handleQuickStatusChange = async (newStatus: ClientStatus) => {
    if (clientData.status === newStatus || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    // Optimistic UI update
    setClientData((prev: any) => ({ ...prev, status: newStatus }));
    try {
      const res = await updateClientStatusAction(clientData.id, newStatus);
      if (res.success) {
        setStatusFeedback(`Statut passé à : ${CLIENT_STATUSES[newStatus]?.label || newStatus}`);
        setTimeout(() => setStatusFeedback(null), 3000);
        router.refresh();
      }
    } catch (err: any) {
      alert(err?.message || "Erreur lors de la mise à jour du statut");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Compute live financials
  // 1. Valeur du contrat (Total engagement négocié)
  const contractTotal = Number(clientData.contractValue) || 0;
  // 2. Total des factures émises
  const totalInvoiced = (clientData.invoices || []).reduce((sum: number, inv: any) => sum + Number(inv.total), 0);
  // 3. Total des encaissements reçus
  const totalPaid = (clientData.payments || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  // 4. Reste à Payer :
  // Le montant total dû correspond à l'engagement contractuel (ou au total facturé si supérieur)
  const baseDue = Math.max(contractTotal, totalInvoiced);
  const balanceDue = Math.max(0, baseDue - totalPaid);

  // Extract media items
  const { media: currentMedia } = parseClientMedia(clientData.notes, clientData);
  const mediaItems = [
    {
      key: "driveUrl",
      label: "Google Drive Client",
      shortLabel: "Drive",
      badge: "Production & Livrables",
      url: currentMedia.driveUrl,
      platform: "drive" as const,
      icon: GoogleDriveIcon,
      accentColor: "text-blue-400 border-blue-500/30 bg-blue-500/10",
      description: "Dossier partagé Google Drive contenant les vidéos brutes, montages, shootings photos, chartes graphiques et livrables finaux.",
      placeholder: "https://drive.google.com/drive/folders/...",
    },
    {
      key: "googleBusinessUrl",
      label: "Fiche d'Établissement Google",
      shortLabel: "Google Maps",
      badge: "Google Maps & Business",
      url: currentMedia.googleBusinessUrl,
      platform: "gmaps" as const,
      icon: GoogleBusinessIcon,
      accentColor: "text-rose-400 border-rose-500/30 bg-rose-500/10",
      description: "Fiche Google Business Profile officielle, avis clients, géolocalisation Maps et optimisation du référencement local.",
      placeholder: "https://maps.app.goo.gl/... ou lien fiche d'établissement",
    },
    {
      key: "facebook",
      label: "Page Facebook Officielle",
      shortLabel: "Facebook",
      badge: "Meta Business",
      url: currentMedia.facebook,
      platform: "facebook" as const,
      icon: FacebookIcon,
      accentColor: "text-blue-400 border-blue-600/30 bg-blue-600/10",
      description: "Page Facebook professionnelle de la marque, publications éditoriales et gestion des campagnes sponsorisées.",
      placeholder: "https://facebook.com/nomdelapage ou identifiant page",
    },
    {
      key: "instagram",
      label: "Compte Instagram",
      shortLabel: "Instagram",
      badge: "Instagram Business",
      url: currentMedia.instagram,
      platform: "instagram" as const,
      icon: InstagramIcon,
      accentColor: "text-pink-400 border-pink-500/30 bg-pink-500/10",
      description: "Profil Instagram de la marque, feed, stories quotidiennes, réels et engagement avec les abonnés.",
      placeholder: "https://instagram.com/nomdecompte ou @nom",
    },
    {
      key: "tiktok",
      label: "Compte TikTok",
      shortLabel: "TikTok",
      badge: "Vidéos Courtes & Viralité",
      url: currentMedia.tiktok,
      platform: "tiktok" as const,
      icon: TikTokIcon,
      accentColor: "text-cyan-400 border-cyan-500/30 bg-neutral-900",
      description: "Compte TikTok officiel pour les formats dynamiques verticaux et acquisition d'audience jeune.",
      placeholder: "https://tiktok.com/@nomdecompte ou @nom",
    },
  ];
  const activeMediaCount = mediaItems.filter((m) => !!m.url?.trim()).length;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Back */}
      <div className="flex items-center justify-between">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à la liste des clients</span>
        </Link>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setOpenDeleteModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
            title="Supprimer définitivement ce client (Admin)"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Supprimer le client</span>
          </button>
        )}
      </div>

      {/* Main Header Card with Monthly Contract Focus */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-lg shadow-blue-500/20 shrink-0">
              {clientData.companyName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-neutral-100">{clientData.companyName}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${OFFER_DETAILS[clientData.offerType as keyof typeof OFFER_DETAILS]?.theme.badge || "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>
                  {OFFER_DETAILS[clientData.offerType as keyof typeof OFFER_DETAILS]?.name || clientData.offerType}
                </span>
                {clientData.hasWebsite && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    <span>+ Site Vitrine</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Marque commerciale : <span className="text-neutral-200 font-medium">{clientData.brandName || clientData.companyName}</span> • Secteur : <span className="text-blue-400 font-medium">{clientData.sector}</span> • Wilaya : <span className="text-neutral-200">{clientData.wilaya || "Algérie"}</span>
              </p>
            </div>
          </div>

          {/* Action Button & Monthly Contract Pill */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleOpenEditClient("general")}
              className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
              title="Gérer et modifier l'ensemble des informations du client"
            >
              <Edit3 className="w-4 h-4" />
              <span>Gérer les informations</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setOpenDeleteModal(true)}
                className="flex items-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/25 rounded-2xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                title="Supprimer définitivement ce client (Administrateur uniquement)"
              >
                <Trash2 className="w-4 h-4" />
                <span>Supprimer le client</span>
              </button>
            )}

            {/* Monthly Contract Pill */}
            <div className="flex items-center gap-3 px-4 py-3 bg-neutral-950/80 border border-neutral-800 rounded-2xl">
              <CreditCard className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Contrat par Mois</span>
                <p className="text-lg font-bold text-emerald-400">
                  {formatCurrency(clientData.monthlyFee)} <span className="text-xs text-neutral-400 font-normal">/ mois</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* PARTIE ÉTAT DU CLIENT (Actif / Suspendu / Contentieux / En préparation) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-neutral-950/70 border border-neutral-800 shadow-inner">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: statusConfig.accent || "#10B981" }} />
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              État du Client :
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
            {statusFeedback && (
              <span className="text-[11px] text-emerald-400 font-semibold animate-pulse">
                ✓ {statusFeedback}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {CLIENT_MAIN_STATUSES.map((st) => {
              const isCurrent = clientData.status === st.key;
              return (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => handleQuickStatusChange(st.key as ClientStatus)}
                  disabled={isUpdatingStatus}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                    isCurrent
                      ? `${st.activeClass} shadow-md ring-1 ring-white/10 scale-102`
                      : "bg-neutral-900/90 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:bg-neutral-800 hover:border-neutral-700"
                  }`}
                  title={`Passer le statut du client à "${st.label}"`}
                >
                  <span className={`w-2 h-2 rounded-full ${st.dotClass}`} />
                  <span>{st.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Coordonnées & Commercial Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-neutral-800 text-xs">
          <div className="space-y-1">
            <span className="text-neutral-500">Contact Référent</span>
            <p className="text-neutral-200 font-medium">{clientData.contactName || "Non renseigné"}</p>
            <a
              href={`tel:${clientData.phone}`}
              onClick={() => {
                trackCommunicationClick({
                  type: "PHONE",
                  targetName: clientData.companyName || clientData.contactName,
                  phone: clientData.phone,
                  entityType: "CLIENT",
                  entityId: clientData.id,
                });
              }}
              className="text-emerald-400 hover:underline flex items-center gap-1 font-mono"
            >
              <Phone className="w-3 h-3" />
              <span>{clientData.phone}</span>
            </a>
          </div>

          <div className="space-y-1">
            <span className="text-neutral-500">Responsable Compte</span>
            <p className="text-neutral-200 font-medium">{clientData.assignedTo?.name || "Non assigné"}</p>
            <p className="text-neutral-400">{clientData.assignedTo?.phone || "—"}</p>
          </div>

          <div className="space-y-1">
            <span className="text-neutral-500">Durée du Contrat</span>
            <p className="text-neutral-200 font-medium">
              {formatDate(clientData.contractStart)} → {formatDate(clientData.contractEnd)}
            </p>
            <p className="text-neutral-400">Total engagement : <span className="text-neutral-200 font-semibold">{formatCurrency(clientData.contractValue)}</span></p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Adresse & Médias</span>
              <button
                type="button"
                onClick={() => handleOpenEditClient("media")}
                className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                title="Gérer les informations et liens médias du client"
              >
                <Edit3 className="w-3 h-3" />
                <span>Gérer</span>
              </button>
            </div>
            <p className="text-neutral-300 truncate flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <span>{clientData.address || clientData.wilaya || "Alger"}</span>
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {currentMedia.driveUrl && (
                <a
                  href={normalizeMediaUrl(currentMedia.driveUrl, "drive")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-[10px] font-medium text-blue-300 border border-blue-500/20 transition-all hover:scale-105"
                  title="Ouvrir le Google Drive"
                >
                  <GoogleDriveIcon className="w-3 h-3" />
                  <span>Drive</span>
                </a>
              )}
              {currentMedia.googleBusinessUrl && (
                <a
                  href={normalizeMediaUrl(currentMedia.googleBusinessUrl, "gmaps")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-[10px] font-medium text-rose-300 border border-rose-500/20 transition-all hover:scale-105"
                  title="Voir la Fiche d'Établissement Google"
                >
                  <GoogleBusinessIcon className="w-3 h-3" />
                  <span>Google</span>
                </a>
              )}
              {currentMedia.facebook && (
                <a
                  href={normalizeMediaUrl(currentMedia.facebook, "facebook")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-600/15 hover:bg-blue-600/25 text-[10px] font-medium text-blue-400 border border-blue-600/30 transition-all hover:scale-105"
                  title="Ouvrir la Page Facebook"
                >
                  <FacebookIcon className="w-3 h-3" />
                  <span>FB</span>
                </a>
              )}
              {currentMedia.instagram && (
                <a
                  href={normalizeMediaUrl(currentMedia.instagram, "instagram")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-[10px] font-medium text-pink-300 border border-pink-500/20 transition-all hover:scale-105"
                  title="Ouvrir le Profil Instagram"
                >
                  <InstagramIcon className="w-3 h-3" />
                  <span>Insta</span>
                </a>
              )}
              {currentMedia.tiktok && (
                <a
                  href={normalizeMediaUrl(currentMedia.tiktok, "tiktok")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-[10px] font-medium text-cyan-300 border border-cyan-500/30 transition-all hover:scale-105"
                  title="Ouvrir le Compte TikTok"
                >
                  <TikTokIcon className="w-3 h-3 text-cyan-400" />
                  <span>TikTok</span>
                </a>
              )}
              {activeMediaCount === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMediaForm({
                      driveUrl: currentMedia.driveUrl || "",
                      googleBusinessUrl: currentMedia.googleBusinessUrl || "",
                      facebook: currentMedia.facebook || "",
                      instagram: currentMedia.instagram || "",
                      tiktok: currentMedia.tiktok || "",
                    });
                    setOpenMediaModal(true);
                  }}
                  className="text-[10px] text-neutral-500 hover:text-blue-400 underline cursor-pointer"
                >
                  + Ajouter les médias
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Financial KPI Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-neutral-800">
          <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400 font-semibold">Total Facturé</span>
              <span className="text-[10px] text-neutral-500 font-mono">
                {(clientData.invoices || []).length} facture{(clientData.invoices || []).length > 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-xl font-bold text-neutral-100 mt-1">{formatCurrency(totalInvoiced)}</p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-400 font-semibold">Total Encaissé</span>
              <span className="text-[10px] text-emerald-500/80 font-mono">
                {(clientData.payments || []).length} versement{(clientData.payments || []).length > 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-xl font-bold text-emerald-400 mt-1">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-400 font-semibold">Reste à Payer</span>
              {contractTotal > 0 && (
                <span className="text-[10px] text-amber-500/80 font-medium font-mono">
                  sur {formatCurrency(baseDue)}
                </span>
              )}
            </div>
            <p className="text-xl font-bold text-amber-400 mt-1">{formatCurrency(balanceDue)}</p>
            {totalInvoiced > 0 && totalInvoiced > totalPaid && (
              <span className="text-[10px] text-neutral-400 block mt-1">
                dont {formatCurrency(totalInvoiced - totalPaid)} facturé non réglé
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-neutral-800 gap-6 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab("history")}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "history"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <PhoneCall className="w-4 h-4" />
          <span>Timeline & Appels ({(clientData.calls || []).length})</span>
        </button>

        <button
          onClick={() => setActiveTab("projects")}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "projects"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Projets & Production ({(clientData.projects || []).length})</span>
        </button>

        <button
          onClick={() => setActiveTab("invoices")}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "invoices"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Factures ({(clientData.invoices || []).length})</span>
        </button>

        <button
          onClick={() => setActiveTab("payments")}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "payments"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Paiements Encaissés ({(clientData.payments || []).length})</span>
        </button>

        <button
          onClick={() => setActiveTab("documents")}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "documents"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Documents & Contrats ({(clientData.documents || []).length})</span>
        </button>

        <button
          onClick={() => setActiveTab("media")}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "media"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>Médias & Réseaux ({activeMediaCount}/5)</span>
        </button>
      </div>

      {/* TAB 1: Timeline & Appels */}
      {activeTab === "history" && (
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-neutral-200">Historique des interactions & Appels</h3>
              <p className="text-xs text-neutral-500">Journal des échanges téléphoniques et relances clients</p>
            </div>
            <Button
              size="sm"
              onClick={() => setOpenCallModal(true)}
              className="gap-1.5 shadow-md shadow-blue-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Enregistrer un Appel</span>
            </Button>
          </div>

          {(clientData.calls || []).length === 0 ? (
            <p className="text-xs text-neutral-500 py-8 text-center">Aucun appel ou interaction enregistrée.</p>
          ) : (
            <div className="space-y-3">
              {(clientData.calls || []).map((call: any) => {
                const parsed = parseCallPurpose(call.comment, call.result);
                return (
                  <div
                    key={call.id}
                    className="p-4 bg-neutral-950/60 border border-neutral-800/80 rounded-xl flex items-center justify-between gap-4 text-xs hover:border-neutral-700 transition-colors"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${parsed.color}`}>
                          {parsed.purposeLabel}
                        </span>
                        <span className="text-[11px] text-neutral-500">{formatDateTime(call.calledAt)}</span>
                        {call.durationSeconds ? (
                          <span className="text-[10px] text-neutral-400 font-mono">
                            ({Math.round(call.durationSeconds / 60)} min)
                          </span>
                        ) : null}
                      </div>
                      <p className="text-neutral-200 font-medium line-clamp-2">{parsed.cleanComment || "Appel enregistré"}</p>
                      <p className="text-[10px] text-neutral-500">Par {call.user?.name || "Commercial"}</p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setViewCall(call)}
                      className="gap-1.5 shrink-0 text-xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Voir la fiche</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Projets & Production */}
      {activeTab === "projects" && (
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-neutral-200">Projets de production & Livrables</h3>
              <p className="text-xs text-neutral-500">Suivi des projets créatifs, digitaux et campagnes</p>
            </div>
            <Button
              size="sm"
              onClick={() => setOpenProjectModal(true)}
              className="gap-1.5 shadow-md shadow-blue-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Nouveau Projet</span>
            </Button>
          </div>

          {(clientData.projects || []).length === 0 ? (
            <p className="text-xs text-neutral-500 py-8 text-center">Aucun projet en cours pour ce client.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(clientData.projects || []).map((prj: any) => {
                const prjStatus = PROJECT_STATUS_MAP[prj.status] || {
                  label: prj.status,
                  color: "bg-neutral-800 text-neutral-300",
                };
                return (
                  <div
                    key={prj.id}
                    className="p-4 bg-neutral-950/60 border border-neutral-800 rounded-xl space-y-3 text-xs hover:border-neutral-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-blue-400">{prj.code}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${prjStatus.color}`}>
                        {prjStatus.label}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-neutral-100 text-sm">{prj.name}</h4>
                      {prj.description && (
                        <p className="text-neutral-400 text-xs mt-1 line-clamp-2">{prj.description}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-400">
                          Budget : <strong className="text-neutral-200">{formatCurrency(prj.budget)}</strong>
                        </span>
                        {prj.documents && prj.documents.length > 0 ? (
                          <span className="text-[10px] text-blue-400 font-medium flex items-center gap-1 bg-blue-500/10 px-1.5 py-0.5 rounded-md border border-blue-500/20" title={`${prj.documents.length} fichier(s) joint(s)`}>
                            <Paperclip className="w-3 h-3" />
                            <span>{prj.documents.length}</span>
                          </span>
                        ) : null}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewProject(prj)}
                        className="gap-1 text-xs py-1 h-7"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Voir la fiche</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Factures */}
      {activeTab === "invoices" && (
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-neutral-200">Factures & Appels de mensualités</h3>
              <p className="text-xs text-neutral-500">Factures mensuelles récurrentes et prestations annexes</p>
            </div>
            <Button
              size="sm"
              onClick={() => setOpenInvoiceModal(true)}
              className="gap-1.5 shadow-md shadow-blue-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Émettre une Facture</span>
            </Button>
          </div>

          {(clientData.invoices || []).length === 0 ? (
            <p className="text-xs text-neutral-500 py-8 text-center">Aucune facture émise pour le moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950 border-b border-neutral-800 text-neutral-400">
                  <tr>
                    <th className="p-3">Numéro Facture</th>
                    <th className="p-3">Date d'émission</th>
                    <th className="p-3">Échéance</th>
                    <th className="p-3">Régime</th>
                    <th className="p-3">Modalité de Paiement</th>
                    <th className="p-3">Montant Total</th>
                    <th className="p-3">Statut</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {(clientData.invoices || []).map((inv: any) => {
                    const invStatus = INVOICE_STATUS_MAP[inv.status] || {
                      label: inv.status,
                      color: "bg-neutral-800 text-neutral-300",
                    };
                    const parsedInvNotes = parseInvoiceNotes(inv.notes);
                    const invTaxMode = parsedInvNotes.taxMode || (Number(inv.taxAmount) > 0 ? "TTC" : "HT");
                    const invMethod = parsedInvNotes.paymentMethod || "BARIDIMOB";

                    return (
                      <tr key={inv.id} className="hover:bg-neutral-800/30">
                        <td className="p-3 font-mono font-semibold text-blue-400">{inv.invoiceNumber}</td>
                        <td className="p-3 text-neutral-300">{formatDate(inv.issueDate)}</td>
                        <td className="p-3 text-neutral-300">{formatDate(inv.dueDate)}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              invTaxMode === "TTC"
                                ? "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                                : "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                            }`}
                          >
                            {invTaxMode === "TTC" ? "TTC" : "HT"}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 w-fit ${
                              invMethod === "ESPECES"
                                ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                                : invMethod === "BARIDIMOB"
                                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                : "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                            }`}
                          >
                            {invMethod === "ESPECES" && "💵 Espèces"}
                            {invMethod === "BARIDIMOB" && "💳 BaridiMob"}
                            {invMethod === "VIREMENT" && "🏦 Virement"}
                            {invMethod === "CHEQUE" && "📄 Chèque"}
                            {invMethod === "OTHER" && "Autre"}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-neutral-100">{formatCurrency(inv.total)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${invStatus.color}`}>
                            {invStatus.label}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewInvoice(inv)}
                            className="gap-1.5 text-xs py-1 h-7 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Voir / Imprimer</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Paiements Encaissés */}
      {activeTab === "payments" && (
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-neutral-200">Paiements & Encaissements reçus</h3>
              <p className="text-xs text-neutral-500">Historique des règlements mensuels, virements et reçus BaridiMob</p>
            </div>
            <Button
              size="sm"
              onClick={() => setOpenPaymentModal(true)}
              className="gap-1.5 shadow-md shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Enregistrer un Règlement</span>
            </Button>
          </div>

          {(clientData.payments || []).length === 0 ? (
            <p className="text-xs text-neutral-500 py-8 text-center">Aucun paiement enregistré pour ce compte.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950 border-b border-neutral-800 text-neutral-400">
                  <tr>
                    <th className="p-3">Date Encaissement</th>
                    <th className="p-3">Mode de Paiement</th>
                    <th className="p-3">Référence / Reçu</th>
                    <th className="p-3">Montant Encaissé</th>
                    <th className="p-3">Enregistré par</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {(clientData.payments || []).map((pmt: any) => (
                    <tr key={pmt.id} className="hover:bg-neutral-800/30">
                      <td className="p-3 text-neutral-300">{formatDate(pmt.paymentDate)}</td>
                      <td className="p-3 font-semibold text-emerald-400">
                        {PAYMENT_METHODS[pmt.paymentMethod as keyof typeof PAYMENT_METHODS] || pmt.paymentMethod}
                      </td>
                      <td className="p-3 font-mono text-neutral-400">{pmt.reference || "—"}</td>
                      <td className="p-3 font-bold text-neutral-100">{formatCurrency(pmt.amount)}</td>
                      <td className="p-3 text-neutral-400">{pmt.recordedBy?.name || "Comptabilité"}</td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewPayment(pmt)}
                          className="gap-1.5 text-xs py-1 h-7 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Voir / Imprimer</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Documents & Contrats */}
      {activeTab === "documents" && (
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-neutral-200">Documents Contractuels & Fichiers</h3>
              <p className="text-xs text-neutral-500">Contrats mensuels, devis signés, briefs de communication et pièces jointes</p>
            </div>
            <Button
              size="sm"
              onClick={() => setOpenDocumentModal(true)}
              className="gap-1.5 shadow-md shadow-blue-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Ajouter un Document</span>
            </Button>
          </div>

          {(clientData.documents || []).length === 0 ? (
            <div className="text-center py-10 text-neutral-500 text-xs">
              <FileText className="w-8 h-8 mx-auto text-neutral-600 mb-2" />
              <p>Aucun document contractuel téléversé pour le moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(clientData.documents || []).map((doc: any) => (
                <div
                  key={doc.id}
                  className="p-4 bg-neutral-950/60 border border-neutral-800 rounded-xl flex items-center justify-between gap-4 text-xs hover:border-neutral-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                      <FileCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-neutral-100">{doc.name}</h4>
                      <p className="text-[11px] text-neutral-500">
                        {doc.category} • {doc.fileType} • {formatDate(doc.createdAt)}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setViewDocument(doc)}
                    className="gap-1 text-xs shrink-0 py-1 h-7"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Voir la fiche</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: SECTION MEDIA CLIENT */}
      {activeTab === "media" && (
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl">
          {/* En-tête de section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-neutral-800">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2.5">
                    <span>SECTION MÉDIA & LIENS DIGITAUX DU CLIENT</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {activeMediaCount} / 5 Liens Connectés
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Centralisation des accès Drive de production, fiche d'établissement Google Maps et réseaux officiels (Facebook, Instagram, TikTok).
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={() => {
                setMediaForm({
                  driveUrl: currentMedia.driveUrl || "",
                  googleBusinessUrl: currentMedia.googleBusinessUrl || "",
                  facebook: currentMedia.facebook || "",
                  instagram: currentMedia.instagram || "",
                  tiktok: currentMedia.tiktok || "",
                });
                setOpenMediaModal(true);
              }}
              className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20 cursor-pointer shrink-0"
            >
              <Edit3 className="w-4 h-4" />
              <span>Modifier les Liens Médias</span>
            </Button>
          </div>

          {/* Grille des 5 cartes médias */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {mediaItems.map((item) => {
              const IconComp = item.icon;
              const isConfigured = !!item.url?.trim();
              const fullUrl = isConfigured ? normalizeMediaUrl(item.url, item.platform) : "";

              return (
                <div
                  key={item.key}
                  className={`relative rounded-2xl border transition-all flex flex-col justify-between p-5 ${
                    isConfigured
                      ? "bg-neutral-950/70 border-neutral-800 hover:border-neutral-700 shadow-md"
                      : "bg-neutral-950/30 border-dashed border-neutral-800/80 hover:border-neutral-700"
                  }`}
                >
                  <div className="space-y-3.5">
                    {/* Top Row: Icon + Status */}
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center p-2.5 shadow-inner">
                        <IconComp className="w-7 h-7" />
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border flex items-center gap-1.5 ${
                          isConfigured
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-neutral-800 text-neutral-400 border-neutral-700"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isConfigured ? "bg-emerald-400 animate-pulse" : "bg-neutral-500"
                          }`}
                        />
                        <span>{isConfigured ? "Actif & Configuré" : "Non renseigné"}</span>
                      </span>
                    </div>

                    {/* Titles */}
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
                        {item.badge}
                      </span>
                      <h4 className="text-sm font-bold text-neutral-100">{item.label}</h4>
                      <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    {/* URL Snippet */}
                    {isConfigured ? (
                      <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800/80 font-mono text-[11px] text-neutral-300 break-all flex items-center justify-between gap-2">
                        <span className="truncate">{item.url}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyLink(item.key, item.url, item.platform)}
                          className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors shrink-0 cursor-pointer"
                          title="Copier le lien"
                        >
                          {copiedKey === item.key ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-neutral-900/40 border border-dashed border-neutral-800 font-mono text-[11px] text-neutral-500 italic">
                        {item.placeholder}
                      </div>
                    )}
                  </div>

                  {/* Bottom Actions */}
                  <div className="pt-4 mt-4 border-t border-neutral-800/60 flex items-center justify-between gap-2">
                    {isConfigured ? (
                      <>
                        <a
                          href={fullUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2 px-3 rounded-xl bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 hover:border-blue-600 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <span>Ouvrir {item.shortLabel}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            setMediaForm({
                              driveUrl: currentMedia.driveUrl || "",
                              googleBusinessUrl: currentMedia.googleBusinessUrl || "",
                              facebook: currentMedia.facebook || "",
                              instagram: currentMedia.instagram || "",
                              tiktok: currentMedia.tiktok || "",
                            });
                            setOpenMediaModal(true);
                          }}
                          className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                          title="Modifier ce lien"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setMediaForm({
                            driveUrl: currentMedia.driveUrl || "",
                            googleBusinessUrl: currentMedia.googleBusinessUrl || "",
                            facebook: currentMedia.facebook || "",
                            instagram: currentMedia.instagram || "",
                            tiktok: currentMedia.tiktok || "",
                          });
                          setOpenMediaModal(true);
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 hover:text-neutral-100 border border-neutral-700 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Configurer ce lien</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Guide & Remarque d'équipe */}
          <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800 flex items-start gap-3 text-xs text-neutral-400">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-neutral-200">Recommandations HDZ SECURITY :</p>
              <p className="mt-0.5 leading-relaxed">
                Le dossier <strong>Google Drive</strong> doit être paramétré en accès partagé avec l'équipe de production (graphistes, vidéastes, monteurs) et le client. Pour la <strong>Fiche d'Établissement</strong>, privilégiez le lien de géolocalisation Google Maps ou le gestionnaire de profil Google Business pour suivre les avis et le référencement local.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 0. MODAL: CONFIGURER LES MEDIAS CLIENT                  */}
      {/* ======================================================== */}
      <Modal
        isOpen={openMediaModal}
        onClose={() => setOpenMediaModal(false)}
        title="SECTION MÉDIA CLIENT — Liens & Réseaux Sociaux"
        description={`Paramétrer les accès Drive, fiche d'établissement et réseaux sociaux pour ${clientData.companyName}`}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveMedia} className="space-y-4">
          <div className="space-y-3.5">
            {/* 1. Google Drive */}
            <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-2">
              <label className="text-xs font-semibold text-neutral-200 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <GoogleDriveIcon className="w-4 h-4" />
                  <span>Lien Google Drive (Dossier Cloud de Production)</span>
                </span>
                <span className="text-[10px] text-blue-400 font-normal">Photos, Vidéos, Livrables</span>
              </label>
              <Input
                type="url"
                value={mediaForm.driveUrl || ""}
                onChange={(e) => setMediaForm({ ...mediaForm, driveUrl: e.target.value })}
                placeholder="https://drive.google.com/drive/folders/..."
              />
              <p className="text-[10px] text-neutral-500">
                Dossier partagé pour le stockage des vidéos brutes, montages, photos et chartes graphiques.
              </p>
            </div>

            {/* 2. Fiche d'établissement */}
            <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-2">
              <label className="text-xs font-semibold text-neutral-200 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <GoogleBusinessIcon className="w-4 h-4" />
                  <span>Lien Fiche d'Établissement Google (Maps & Business Profile)</span>
                </span>
                <span className="text-[10px] text-rose-400 font-normal">Avis & Référencement</span>
              </label>
              <Input
                type="url"
                value={mediaForm.googleBusinessUrl || ""}
                onChange={(e) => setMediaForm({ ...mediaForm, googleBusinessUrl: e.target.value })}
                placeholder="https://maps.app.goo.gl/... ou https://business.google.com/..."
              />
              <p className="text-[10px] text-neutral-500">
                Lien officiel Google Maps ou Google Business Profile pour le suivi des avis et géolocalisation.
              </p>
            </div>

            {/* 3. Facebook */}
            <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-2">
              <label className="text-xs font-semibold text-neutral-200 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FacebookIcon className="w-4 h-4" />
                  <span>Lien Page Facebook</span>
                </span>
                <span className="text-[10px] text-blue-400 font-normal">Meta Business</span>
              </label>
              <Input
                type="text"
                value={mediaForm.facebook || ""}
                onChange={(e) => setMediaForm({ ...mediaForm, facebook: e.target.value })}
                placeholder="https://facebook.com/nomdelapage ou identifiant de page"
              />
            </div>

            {/* 4. Instagram */}
            <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-2">
              <label className="text-xs font-semibold text-neutral-200 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <InstagramIcon className="w-4 h-4" />
                  <span>Lien Profil Instagram</span>
                </span>
                <span className="text-[10px] text-pink-400 font-normal">Feed & Stories</span>
              </label>
              <Input
                type="text"
                value={mediaForm.instagram || ""}
                onChange={(e) => setMediaForm({ ...mediaForm, instagram: e.target.value })}
                placeholder="https://instagram.com/nomdecompte ou @nomdecompte"
              />
            </div>

            {/* 5. TikTok */}
            <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-2">
              <label className="text-xs font-semibold text-neutral-200 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <TikTokIcon className="w-4 h-4 text-neutral-200" />
                  <span>Lien Compte TikTok</span>
                </span>
                <span className="text-[10px] text-cyan-400 font-normal">Vidéos courtes & Viralité</span>
              </label>
              <Input
                type="text"
                value={mediaForm.tiktok || ""}
                onChange={(e) => setMediaForm({ ...mediaForm, tiktok: e.target.value })}
                placeholder="https://tiktok.com/@nomdecompte ou @nomdecompte"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-neutral-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpenMediaModal(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer"
            >
              Enregistrer les Liens Médias
            </Button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* 1. MODAL: ENREGISTRER UN APPEL (AVEC SECTIONS A REMPLIR) */}
      {/* ======================================================== */}
      <Modal
        isOpen={openCallModal}
        onClose={() => setOpenCallModal(false)}
        title="Fiche d'enregistrement d'un Appel / Interaction"
        description={`Enregistrer une communication téléphonique avec ${clientData.companyName}`}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateCall} className="space-y-4">
          {/* Section 1: Le but de l'appel & Horodatage */}
          <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              <span>Section 1 : Le but de l'appel & Horodatage</span>
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300">Le but de l'appel *</label>
                <select
                  value={callForm.purpose}
                  onChange={(e) => setCallForm({ ...callForm, purpose: e.target.value })}
                  className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
                >
                  {Object.entries(CALL_PURPOSES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Durée estimée (Minutes)"
                type="number"
                value={callForm.durationMinutes}
                onChange={(e) => setCallForm({ ...callForm, durationMinutes: Number(e.target.value) })}
                min={1}
              />
            </div>

            <Input
              label="Date et heure de l'appel"
              type="datetime-local"
              value={callForm.calledAt}
              onChange={(e) => setCallForm({ ...callForm, calledAt: e.target.value })}
              required
            />
          </div>

          {/* Section 2: Compte-rendu */}
          <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>Section 2 : Compte-rendu & Échanges</span>
            </h4>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Notes de la conversation *</label>
              <textarea
                rows={3}
                value={callForm.comment}
                onChange={(e) => setCallForm({ ...callForm, comment: e.target.value })}
                placeholder="Détaillez les sujets abordés, les retours du client, les prochaines étapes..."
                className="w-full p-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
            <Button type="button" variant="outline" onClick={() => setOpenCallModal(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Enregistrer l'appel
            </Button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* 2. MODAL: NOUVEAU PROJET (AVEC SECTIONS A REMPLIR) */}
      {/* ======================================================== */}
      <Modal
        isOpen={openProjectModal}
        onClose={() => setOpenProjectModal(false)}
        title="Fiche de Création de Projet de Production"
        description={`Nouveau livrable ou projet pour ${clientData.companyName}`}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          {/* Section 1: Identification */}
          <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Section 1 : Identification du Projet</span>
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Nom du Projet / Campagne *"
                value={projectForm.name}
                onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                placeholder="Ex: Campagne Social Media Printemps"
                required
              />
              <Input
                label="Code Projet"
                value={projectForm.code}
                onChange={(e) => setProjectForm({ ...projectForm, code: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Statut initial</label>
              <select
                value={projectForm.status}
                onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value as ProjectStatus })}
                className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
              >
                {Object.entries(PROJECT_STATUS_MAP).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 2: Planning & Budget */}
          <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Section 2 : Planning & Budget Alloué</span>
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Date de Lancement"
                type="date"
                value={projectForm.startDate}
                onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })}
              />
              <Input
                label="Date Limite / Deadline"
                type="date"
                value={projectForm.deadline}
                onChange={(e) => setProjectForm({ ...projectForm, deadline: e.target.value })}
              />
            </div>
            <Input
              label="Budget Alloué (DA)"
              type="number"
              value={projectForm.budget}
              onChange={(e) => setProjectForm({ ...projectForm, budget: Number(e.target.value) })}
            />
          </div>

          {/* Section 3: Cahier des charges & Livrables */}
          <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>Section 3 : Cahier des charges & Livrables</span>
            </h4>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Description et objectifs de production</label>
              <textarea
                rows={3}
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                placeholder="Préciser les visuels attendus, formats vidéos, thématiques et livrables..."
                className="w-full p-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Partie Upload des Fichiers de Cahier des Charges */}
            <div className="space-y-2 pt-2 border-t border-neutral-800/80">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                  <UploadCloud className="w-4 h-4 text-blue-400" />
                  <span>Fichiers du Cahier des Charges (Upload)</span>
                </label>
                {projectFiles.length > 0 && (
                  <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                    {projectFiles.length} fichier{projectFiles.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Zone Drag & Drop */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleProjectFileUpload(e.dataTransfer.files);
                  }
                }}
                className={`border-2 border-dashed rounded-xl p-4 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer text-center ${
                  isUploadingFiles
                    ? "border-blue-500 bg-blue-500/5 animate-pulse"
                    : "border-neutral-700/80 hover:border-blue-500/50 hover:bg-neutral-900/60 bg-neutral-900/30"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.zip,.rar"
                  onChange={(e) => {
                    if (e.target.files) handleProjectFileUpload(e.target.files);
                  }}
                  className="hidden"
                />

                <div className="w-9 h-9 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  {isUploadingFiles ? (
                    <Clock className="w-4 h-4 animate-spin" />
                  ) : (
                    <UploadCloud className="w-4 h-4" />
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-neutral-200">
                    {isUploadingFiles
                      ? "Téléchargement en cours..."
                      : "Glissez-déposez le cahier des charges ici, ou cliquez pour parcourir"}
                  </p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    PDF, Word (.docx), Excel (.xlsx), Images (PNG, JPG), ZIP — max 25 Mo
                  </p>
                </div>
              </div>

              {uploadError && (
                <p className="text-xs text-rose-400 font-medium">{uploadError}</p>
              )}

              {/* Liste des fichiers uploadés */}
              {projectFiles.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {projectFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-neutral-900/90 border border-neutral-800 rounded-xl text-xs hover:border-neutral-700 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-neutral-200 truncate">{file.name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                            <span>{formatBytes(file.fileSize)}</span>
                            <span>•</span>
                            <span className="text-emerald-400 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Fichier prêt
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setProjectFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Supprimer ce fichier"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
            <Button type="button" variant="outline" onClick={() => setOpenProjectModal(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Créer le projet
            </Button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* 3. MODAL: EMETTRE UNE FACTURE (AVEC SECTIONS A REMPLIR) */}
      {/* ======================================================== */}
      <Modal
        isOpen={openInvoiceModal}
        onClose={() => setOpenInvoiceModal(false)}
        title="Fiche d'Émission de Facture"
        description={`Facturation mensuelle contractuelle pour ${clientData.companyName}`}
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          {/* Section 1: Référence & Période */}
          <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5" />
              <span>Section 1 : Numérotation & Période</span>
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Numéro de Facture *"
                value={invoiceForm.invoiceNumber}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                required
              />
              <Input
                label="Période / Mois concerné *"
                value={invoiceForm.monthLabel}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, monthLabel: e.target.value })}
                placeholder="Ex: Mars 2026"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Date d'émission *"
                type="date"
                value={invoiceForm.issueDate}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, issueDate: e.target.value })}
                required
              />
              <Input
                label="Date d'échéance *"
                type="date"
                value={invoiceForm.dueDate}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Section 2: Montants & TVA */}
          <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" />
              <span>Section 2 : Prestation, Régime (HT / TTC) & Montants</span>
            </h4>

            {/* Sélecteur Régime de Facturation HT ou TTC */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Régime de facturation *</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleTaxModeChange("HT")}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                    invoiceForm.taxMode === "HT"
                      ? "bg-blue-600/15 border-blue-500 text-blue-300 ring-1 ring-blue-500"
                      : "bg-neutral-900/90 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                  }`}
                >
                  <div>
                    <p className="font-bold text-xs text-neutral-100 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                      <span>Facture Hors Taxes (HT)</span>
                    </p>
                    <p className="text-[10px] text-neutral-400 pl-3.5">Exonéré de TVA (TVA 0%)</p>
                  </div>
                  {invoiceForm.taxMode === "HT" && <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleTaxModeChange("TTC")}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                    invoiceForm.taxMode === "TTC"
                      ? "bg-purple-600/15 border-purple-500 text-purple-300 ring-1 ring-purple-500"
                      : "bg-neutral-900/90 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                  }`}
                >
                  <div>
                    <p className="font-bold text-xs text-neutral-100 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                      <span>Facture avec TVA (TTC)</span>
                    </p>
                    <p className="text-[10px] text-neutral-400 pl-3.5">Application de la TVA (19% ou 9%)</p>
                  </div>
                  {invoiceForm.taxMode === "TTC" && <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />}
                </button>
              </div>
            </div>

            <Input
              label="Désignation de la prestation / Objet *"
              value={invoiceForm.itemDescription}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, itemDescription: e.target.value })}
              placeholder="Ex: Forfait mensuel agence : Stratégie, Social Media & Ads"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Montant HT (Mensualité en DA) *"
                type="number"
                value={invoiceForm.subtotal}
                onChange={(e) => handleInvoiceSubtotalChange(Number(e.target.value), invoiceForm.taxRate)}
                required
              />
              {invoiceForm.taxMode === "TTC" ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">Taux de TVA applicable *</label>
                  <select
                    value={invoiceForm.taxRate}
                    onChange={(e) => handleInvoiceSubtotalChange(invoiceForm.subtotal, Number(e.target.value))}
                    className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
                  >
                    <option value={19}>19% (Taux normal)</option>
                    <option value={9}>9% (Taux réduit)</option>
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-400">Taux de TVA</label>
                  <div className="w-full h-10 px-3 text-xs bg-neutral-900/60 border border-neutral-800 rounded-xl text-neutral-400 flex items-center">
                    0% (Exonéré de TVA / Régime HT)
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800/80 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-neutral-400 block">
                  {invoiceForm.taxMode === "HT" ? "Total Net HT à régler :" : "Total Général TTC à régler :"}
                </span>
                {invoiceForm.taxMode === "TTC" && (
                  <span className="text-[11px] text-neutral-500 font-mono">
                    HT: {formatCurrency(invoiceForm.subtotal)} + TVA ({invoiceForm.taxRate}%): {formatCurrency(invoiceForm.taxAmount)}
                  </span>
                )}
              </div>
              <span className={`font-bold text-base font-mono ${invoiceForm.taxMode === "HT" ? "text-blue-400" : "text-emerald-400"}`}>
                {formatCurrency(invoiceForm.total)}
              </span>
            </div>
          </div>

          {/* Section 3: Détails de Facturation Client (RC, NIF, NIS...) */}
          <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              <span>Section 3 : Coordonnées Fiscales & Facturation Client</span>
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Nom / Raison Sociale du Client *"
                value={invoiceForm.clientCompanyName}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, clientCompanyName: e.target.value })}
                placeholder="Nom officiel de l'entreprise"
                required
              />
              <Input
                label="Adresse & Localisation *"
                value={invoiceForm.clientAddress}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, clientAddress: e.target.value })}
                placeholder="Ex: 12 Rue Didouche Mourad, Alger"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Numéro de Téléphone *"
                value={invoiceForm.clientPhone}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, clientPhone: e.target.value })}
                placeholder="Ex: 0550 00 00 00"
                required
              />
              <Input
                label="Email de Facturation"
                type="email"
                value={invoiceForm.clientEmail}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, clientEmail: e.target.value })}
                placeholder="contact@client.dz"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="N° Registre de Commerce (RC)"
                value={invoiceForm.clientRc}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, clientRc: e.target.value })}
                placeholder="Ex: 16/00-1234567B22"
              />
              <Input
                label="NIF (Identifiant Fiscal)"
                value={invoiceForm.clientNif}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, clientNif: e.target.value })}
                placeholder="Ex: 002216012345678"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="NIS (Identifiant Statistique)"
                value={invoiceForm.clientNis}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, clientNis: e.target.value })}
                placeholder="Ex: 002216010012345"
              />
              <Input
                label="Article d'Imposition (AI)"
                value={invoiceForm.clientAi}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, clientAi: e.target.value })}
                placeholder="Ex: 16012345678"
              />
            </div>
          </div>

          {/* Section 4: Statut & Modalités de Paiement */}
          <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5" />
              <span>Section 4 : Statut & Modalités de Paiement</span>
            </h4>

            {/* Modalité de Paiement convenue */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Modalité de Paiement convenue *</label>
              <select
                value={invoiceForm.paymentMethod}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, paymentMethod: e.target.value as any })}
                className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
              >
                <option value="BARIDIMOB">💳 BaridiMob / CCP (Compte Postal Agence)</option>
                <option value="ESPECES">💵 Espèces (Cash direct contre reçu de caisse)</option>
                <option value="VIREMENT">🏦 Virement Bancaire (Compte BNA Agence)</option>
                <option value="CHEQUE">📄 Chèque Bancaire</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Statut de la facture</label>
              <select
                value={invoiceForm.status}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, status: e.target.value as InvoiceStatus })}
                className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
              >
                {Object.entries(INVOICE_STATUS_MAP).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Notes / Modalités de règlement"
              value={invoiceForm.notes}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
            <Button type="button" variant="outline" onClick={() => setOpenInvoiceModal(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Émettre la facture
            </Button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* 4. MODAL: ENREGISTRER UN REGLEMENT (AVEC SECTIONS A REMPLIR) */}
      {/* ======================================================== */}
      <Modal
        isOpen={openPaymentModal}
        onClose={() => setOpenPaymentModal(false)}
        title="Fiche d'Encaissement de Paiement"
        description={`Enregistrer un règlement reçu de ${clientData.companyName}`}
        maxWidth="lg"
      >
        <form onSubmit={handleCreatePayment} className="space-y-4">
          {/* Section 1: Montant & Mode de paiement */}
          <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" />
              <span>Section 1 : Montant & Mode de Paiement</span>
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Montant Encaissé (DA) *"
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                required
              />
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300">Mode de règlement *</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value as PaymentMethod })}
                  className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
                >
                  {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Nature du paiement</label>
              <select
                value={paymentForm.paymentType}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentType: e.target.value as PaymentType })}
                className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
              >
                {Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 2: Référence & Facture liée */}
          <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5" />
              <span>Section 2 : Justificatif & Facture Associée</span>
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="N° Reçu / Réf. Transaction"
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                placeholder="Ex: BaridiMob #928312"
              />
              <Input
                label="Date d'encaissement *"
                type="date"
                value={paymentForm.paymentDate}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Facture à imputer (optionnel)</label>
              <select
                value={paymentForm.invoiceId}
                onChange={(e) => setPaymentForm({ ...paymentForm, invoiceId: e.target.value })}
                className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
              >
                <option value="">-- Règlement libre (non rattaché à une facture) --</option>
                {(clientData.invoices || []).map((inv: any) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} — Total: {formatCurrency(inv.total)} (Reste: {formatCurrency(inv.balanceDue)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 3: Notes */}
          <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>Section 3 : Observations de l'encaissement</span>
            </h4>
            <Input
              label="Remarques / Notes internes"
              value={paymentForm.notes}
              onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
            <Button type="button" variant="outline" onClick={() => setOpenPaymentModal(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={isSubmitting} className="bg-emerald-600 hover:bg-emerald-500 text-white">
              Enregistrer l'encaissement
            </Button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* 5. MODAL: AJOUTER UN DOCUMENT (AVEC SECTIONS A REMPLIR) */}
      {/* ======================================================== */}
      <Modal
        isOpen={openDocumentModal}
        onClose={() => setOpenDocumentModal(false)}
        title="Fiche d'Ajout de Document Contractuel"
        description={`Ajouter un fichier au dossier de ${clientData.companyName}`}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateDocument} className="space-y-4">
          {/* Section 1: Fichier & Catégorie */}
          <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5" />
              <span>Section 1 : Typologie du Document</span>
            </h4>
            <Input
              label="Titre / Nom du document *"
              value={documentForm.name}
              onChange={(e) => setDocumentForm({ ...documentForm, name: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300">Catégorie</label>
                <select
                  value={documentForm.category}
                  onChange={(e) => setDocumentForm({ ...documentForm, category: e.target.value })}
                  className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
                >
                  <option value="CONTRACT">Contrat & Engagement</option>
                  <option value="BRIEF">Cahier des charges / Brief</option>
                  <option value="INVOICE">Facture signée / Décharge</option>
                  <option value="MEDIA">Ressources & Médias</option>
                  <option value="OTHER">Autre document</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300">Format</label>
                <select
                  value={documentForm.fileType}
                  onChange={(e) => setDocumentForm({ ...documentForm, fileType: e.target.value })}
                  className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
                >
                  <option value="PDF">PDF (Document standard)</option>
                  <option value="IMAGE">Image / Scan (JPG/PNG)</option>
                  <option value="EXCEL">Feuille Excel / Tableau</option>
                  <option value="OTHER">Autre format</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Fichier Téléversé ou Emplacement Cloud */}
          <div className="p-4 bg-neutral-950/80 border border-neutral-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4" />
                <span>Section 2 : Téléversement du Fichier / Emplacement</span>
              </h4>
              {/* Toggle Source: Upload direct vs Lien Cloud */}
              <div className="flex items-center p-0.5 bg-neutral-900 border border-neutral-800 rounded-xl text-[11px]">
                <button
                  type="button"
                  onClick={() => setDocumentForm((prev) => ({ ...prev, sourceType: "upload" }))}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    documentForm.sourceType === "upload"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  Téléverser un fichier
                </button>
                <button
                  type="button"
                  onClick={() => setDocumentForm((prev) => ({ ...prev, sourceType: "link" }))}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    documentForm.sourceType === "link"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  Lien Cloud / Drive
                </button>
              </div>
            </div>

            {/* Mode 1: Upload Direct de fichier */}
            {documentForm.sourceType === "upload" && (
              <div className="space-y-3">
                {uploadedDocFile ? (
                  /* Carte de succès du fichier uploadé */
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div className="overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-300 truncate">
                            {uploadedDocFile.name}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 uppercase">
                            {uploadedDocFile.fileType}
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-400/80 mt-0.5">
                          Taille : {formatBytes(uploadedDocFile.fileSize)} • Fichier prêt pour enregistrement
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={uploadedDocFile.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 transition-colors"
                        title="Vérifier le fichier téléversé"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadedDocFile(null);
                          setDocumentForm((prev) => ({ ...prev, fileUrl: "#" }));
                        }}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                        title="Changer de fichier"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Zone de Drop / Upload */
                  <div
                    onClick={() => docFileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handleDocFileUpload(e.dataTransfer.files);
                      }
                    }}
                    className={`border-2 border-dashed rounded-2xl p-6 transition-all flex flex-col items-center justify-center gap-2.5 cursor-pointer text-center ${
                      isUploadingDocFile
                        ? "border-blue-500 bg-blue-500/5 animate-pulse"
                        : "border-neutral-700/80 hover:border-blue-500/60 hover:bg-neutral-900/60 bg-neutral-900/40"
                    }`}
                  >
                    <input
                      ref={docFileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.zip,.rar"
                      onChange={(e) => {
                        if (e.target.files) handleDocFileUpload(e.target.files);
                      }}
                      className="hidden"
                    />

                    <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      {isUploadingDocFile ? (
                        <Clock className="w-5 h-5 animate-spin" />
                      ) : (
                        <UploadCloud className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-neutral-200">
                        {isUploadingDocFile
                          ? "Téléversement et sécurisation du fichier..."
                          : "Glissez-déposez votre document ici, ou cliquez pour parcourir"}
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        Formats acceptés : PDF, Word (.docx), Excel (.xlsx), Scans/Images, ZIP (max 30 Mo)
                      </p>
                    </div>
                  </div>
                )}

                {docUploadError && (
                  <p className="text-xs text-rose-400 font-medium">{docUploadError}</p>
                )}
              </div>
            )}

            {/* Mode 2: Lien Externe / Cloud */}
            {documentForm.sourceType === "link" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300">
                  Lien d'accès Cloud ou Google Drive
                </label>
                <Input
                  type="url"
                  value={documentForm.fileUrl === "#" ? "" : documentForm.fileUrl}
                  onChange={(e) => setDocumentForm({ ...documentForm, fileUrl: e.target.value })}
                  placeholder="https://drive.google.com/file/d/..."
                />
                <span className="text-[10px] text-neutral-500">
                  Collez le lien direct vers le fichier hébergé sur Google Drive, OneDrive ou Dropbox.
                </span>
              </div>
            )}

            {/* Notes explicatives */}
            <Input
              label="Notes explicatives & Observations"
              value={documentForm.notes}
              onChange={(e) => setDocumentForm({ ...documentForm, notes: e.target.value })}
              placeholder="Ex : Document original signé par le gérant..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
            <Button type="button" variant="outline" onClick={() => setOpenDocumentModal(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Enregistrer le document
            </Button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* DETAIL MODALS: VOIR LA FICHE (POUR CHAQUE ITEM)          */}
      {/* ======================================================== */}

      {/* 1. Detail Modal: Appel */}
      <Modal
        isOpen={Boolean(viewCall)}
        onClose={() => setViewCall(null)}
        title="Fiche Détaillée de l'Interaction Téléphonique"
        description="Historique et compte-rendu de l'appel"
        maxWidth="md"
      >
        {viewCall && (() => {
          const parsed = parseCallPurpose(viewCall.comment, viewCall.result);
          return (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Le but de l'appel :</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${parsed.color}`}>
                    {parsed.purposeLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Date & Heure :</span>
                  <span className="text-neutral-200 font-semibold">{formatDateTime(viewCall.calledAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Durée :</span>
                  <span className="text-neutral-200 font-mono">
                    {viewCall.durationSeconds ? `${Math.round(viewCall.durationSeconds / 60)} minutes` : "Non précisée"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Commercial référent :</span>
                  <span className="text-neutral-200 font-medium">{viewCall.user?.name || "Équipe Commerciale"}</span>
                </div>
              </div>

              <div className="p-4 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-2">
                <span className="text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                  Compte-rendu de l'appel :
                </span>
                <p className="text-neutral-200 text-sm whitespace-pre-wrap leading-relaxed">
                  {parsed.cleanComment || "Aucune note additionnelle renseignée."}
                </p>
              </div>

              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setViewCall(null)}>
                  Fermer
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* 2. Detail Modal: Projet */}
      <Modal
        isOpen={Boolean(viewProject)}
        onClose={() => setViewProject(null)}
        title="Fiche Technique du Projet"
        description="Spécifications, planning et suivi de la production"
        maxWidth="lg"
      >
        {viewProject && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-blue-400">{viewProject.code}</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  {PROJECT_STATUS_MAP[viewProject.status]?.label || viewProject.status}
                </span>
              </div>
              <h3 className="text-base font-bold text-neutral-100">{viewProject.name}</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-1">
                <span className="text-neutral-400">Budget du Projet</span>
                <p className="text-base font-bold text-emerald-400">{formatCurrency(viewProject.budget)}</p>
              </div>
              <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-1">
                <span className="text-neutral-400">Tâches de production</span>
                <p className="text-base font-bold text-neutral-200">
                  {viewProject._count?.tasks || 0} tâches associées
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-1">
                <span className="text-neutral-400">Date de démarrage</span>
                <p className="text-neutral-200 font-semibold">{formatDate(viewProject.startDate)}</p>
              </div>
              <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-1">
                <span className="text-neutral-400">Date limite / Deadline</span>
                <p className="text-neutral-200 font-semibold">{formatDate(viewProject.deadline)}</p>
              </div>
            </div>

            <div className="p-4 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-2">
              <span className="text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                Description & Directives :
              </span>
              <p className="text-neutral-200 text-sm whitespace-pre-wrap leading-relaxed">
                {viewProject.description || "Aucun cahier des charges textuel renseigné."}
              </p>
            </div>

            {/* Fichiers du Cahier des Charges & Documents joints */}
            <div className="p-4 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400 font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-blue-400" />
                  <span>Fichiers du Cahier des Charges ({(viewProject.documents || []).length})</span>
                </span>
                <div>
                  <input
                    ref={detailFileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.zip,.rar"
                    onChange={(e) => {
                      if (e.target.files) handleAddDetailFile(e.target.files);
                    }}
                    className="hidden"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => detailFileInputRef.current?.click()}
                    isLoading={isUploadingDetailFile}
                    className="gap-1 text-[11px] h-7 px-2.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Ajouter un fichier</span>
                  </Button>
                </div>
              </div>

              {(viewProject.documents || []).length === 0 ? (
                <div className="p-3 bg-neutral-900/50 border border-dashed border-neutral-800 rounded-xl text-center">
                  <p className="text-xs text-neutral-500">
                    Aucun fichier de cahier des charges joint à ce projet.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(viewProject.documents || []).map((doc: any) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2.5 bg-neutral-900/90 border border-neutral-800 rounded-xl text-xs hover:border-neutral-700 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-neutral-200 truncate">{doc.name}</p>
                          <p className="text-[10px] text-neutral-500">
                            {formatBytes(doc.fileSize)} • Ajouté le {formatDate(doc.createdAt)}
                          </p>
                        </div>
                      </div>

                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-lg text-[11px] font-semibold transition-colors shrink-0"
                      >
                        <Download className="w-3 h-3" />
                        <span>Télécharger / Ouvrir</span>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setViewProject(null)}>
                Fermer
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 3. Detail Modal: Facture Officielle & Imprimable */}
      <Modal
        isOpen={Boolean(viewInvoice)}
        onClose={() => setViewInvoice(null)}
        title={`Facture Officielle — ${viewInvoice?.invoiceNumber || ""}`}
        description="Visualisation conforme aux normes fiscales algériennes & Impression"
        maxWidth="4xl"
      >
        {viewInvoice && (() => {
          const parsedNotes = parseInvoiceNotes(viewInvoice.notes);
          const clientBilling = parsedNotes.clientBilling || {};
          const taxMode = parsedNotes.taxMode || (Number(viewInvoice.taxRate) > 0 ? "TTC" : "HT");
          const paymentMethod = parsedNotes.paymentMethod || "BARIDIMOB";
          const clientName = clientBilling.companyName || viewInvoice.client?.companyName || clientData.companyName;
          const clientAddress = clientBilling.address || viewInvoice.client?.address || clientData.address || clientData.wilaya || "Algérie";
          const clientPhone = clientBilling.phone || viewInvoice.client?.phone || clientData.phone || "-";
          const clientEmail = clientBilling.email || viewInvoice.client?.email || clientData.email || "-";
          const clientRc = clientBilling.rc || "-";
          const clientNif = clientBilling.nif || "-";
          const clientNis = clientBilling.nis || "-";
          const clientAi = clientBilling.ai || "-";

          const invStatus = INVOICE_STATUS_MAP[viewInvoice.status] || {
            label: viewInvoice.status,
            color: "bg-neutral-800 text-neutral-300",
          };

          const handlePrint = () => {
            window.print();
          };

          return (
            <div className="space-y-4 text-xs">
              {/* Actions Bar (Screen only, hidden on print) */}
              <div className="flex items-center justify-between p-3 bg-neutral-950/80 border border-neutral-800 rounded-xl print:hidden">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${invStatus.color}`}>
                    {invStatus.label}
                  </span>
                  <span className="text-neutral-400 text-xs">
                    Émise le {formatDate(viewInvoice.issueDate)} • Échéance au {formatDate(viewInvoice.dueDate)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handlePrint}
                    className="gap-1.5 shadow-md shadow-blue-500/20 bg-blue-600 hover:bg-blue-500 text-white font-bold"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimer la Facture</span>
                  </Button>
                  <Button variant="outline" onClick={() => setViewInvoice(null)}>
                    Fermer
                  </Button>
                </div>
              </div>

              {/* Print Style Injector */}
              <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                  body * {
                    visibility: hidden !important;
                  }
                  #printable-invoice-sheet, #printable-invoice-sheet * {
                    visibility: visible !important;
                  }
                  #printable-invoice-sheet {
                    position: fixed !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 12mm 15mm !important;
                    background: #ffffff !important;
                    color: #111827 !important;
                    box-shadow: none !important;
                    border: none !important;
                    z-index: 999999 !important;
                  }
                  @page {
                    size: A4 portrait;
                    margin: 10mm;
                  }
                }
              `}} />

              {/* FACTURE OFFICIELLE (Format A4 Papier / Print & Screen) */}
              <div
                id="printable-invoice-sheet"
                className="bg-white text-neutral-900 rounded-2xl p-6 sm:p-10 shadow-2xl border border-neutral-200 font-sans space-y-6"
              >
                {/* 1. Header Agence & Titre Facture */}
                <div className="flex items-start justify-between border-b border-neutral-200 pb-6 gap-6">
                  {/* Gauche : Logo & Informations de l'Agence */}
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <img
                        src="/logo.png"
                        alt="HDZ SECURITY"
                        className="w-14 h-14 object-contain rounded-xl border border-neutral-200 p-1 shrink-0 bg-white"
                      />
                      <div>
                        <h2 className="text-xl font-black tracking-wider text-neutral-950 flex items-center gap-2">
                          <span>HDZ SECURITY</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full border border-blue-200">
                            SARL
                          </span>
                        </h2>
                        <p className="text-[11px] font-semibold text-neutral-500">{AGENCY_DETAILS.activity}</p>
                      </div>
                    </div>

                    <div className="text-[11px] text-neutral-600 space-y-0.5 leading-relaxed pt-1">
                      <p className="font-bold text-neutral-900">{AGENCY_DETAILS.legalName}</p>
                      <p>{AGENCY_DETAILS.address}, {AGENCY_DETAILS.wilaya}</p>
                      <p>Tél : <span className="font-semibold text-neutral-800">{AGENCY_DETAILS.phone}</span> • Email : <span className="font-semibold text-neutral-800">{AGENCY_DETAILS.email}</span></p>
                      <div className="pt-1 text-[10px] text-neutral-500 font-mono flex flex-wrap gap-x-3 gap-y-0.5 border-t border-neutral-100 mt-1">
                        <span><strong>RC :</strong> {AGENCY_DETAILS.rc}</span>
                        <span><strong>NIF :</strong> {AGENCY_DETAILS.nif}</span>
                        <span><strong>NIS :</strong> {AGENCY_DETAILS.nis}</span>
                        <span><strong>AI :</strong> {AGENCY_DETAILS.ai}</span>
                      </div>
                    </div>
                  </div>

                  {/* Droite : Bloc Titre Facture & Numérotation */}
                  <div className="text-right space-y-2 shrink-0">
                    <div className="bg-neutral-900 text-white px-4 py-2.5 rounded-xl text-right space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 block">Document Officiel</span>
                      <h1 className="text-2xl font-black tracking-wider text-white">FACTURE</h1>
                      <div>
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                            taxMode === "TTC"
                              ? "bg-purple-600 text-white"
                              : "bg-blue-600 text-white"
                          }`}
                        >
                          {taxMode === "TTC" ? "Régime avec TVA (TTC)" : "Régime Hors Taxes (HT)"}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs space-y-1 font-mono text-neutral-700">
                      <p>N° Facture : <strong className="text-blue-600 text-sm">{viewInvoice.invoiceNumber}</strong></p>
                      <p>Date d'émission : <strong>{formatDate(viewInvoice.issueDate)}</strong></p>
                      <p>Date d'échéance : <strong>{formatDate(viewInvoice.dueDate)}</strong></p>
                      <div className="pt-1">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                          Statut : {invStatus.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Coordonnées Destinataire / Facturé à */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Facturé à / Destinataire :</span>
                    </span>
                    <h3 className="text-sm font-black text-neutral-900 uppercase">{clientName}</h3>
                    <div className="text-xs text-neutral-700 space-y-0.5">
                      <p className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span>{clientAddress}</span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span>{clientPhone}</span>
                        {clientEmail && clientEmail !== "-" && (
                          <>
                            <span className="text-neutral-300">•</span>
                            <span>{clientEmail}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Coordonnées Fiscales Client */}
                  <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5" />
                      <span>Identifiants Fiscaux du Client :</span>
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono text-neutral-700 pt-1">
                      <div>
                        <span className="text-[10px] text-neutral-500 block">N° Registre de Commerce (RC)</span>
                        <strong className="text-neutral-900">{clientRc}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Identifiant Fiscal (NIF)</span>
                        <strong className="text-neutral-900">{clientNif}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Identifiant Statistique (NIS)</span>
                        <strong className="text-neutral-900">{clientNis}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Article d'Imposition (AI)</span>
                        <strong className="text-neutral-900">{clientAi}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Tableau des Prestations */}
                <div className="overflow-hidden border border-neutral-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-900 text-white font-semibold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3">Désignation de la Prestation / Livrables</th>
                        <th className="p-3 text-center w-20">Qté</th>
                        <th className="p-3 text-right w-36">Prix Unitaire HT</th>
                        <th className="p-3 text-right w-36">Total HT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 text-neutral-800">
                      {(viewInvoice.items || []).length > 0 ? (
                        (viewInvoice.items || []).map((item: any) => (
                          <tr key={item.id} className="hover:bg-neutral-50/50">
                            <td className="p-3 font-medium text-neutral-900">{item.description}</td>
                            <td className="p-3 text-center">{item.quantity}</td>
                            <td className="p-3 text-right font-mono">{formatCurrency(item.unitPrice || item.total)}</td>
                            <td className="p-3 text-right font-mono font-bold">{formatCurrency(item.total)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="p-3 font-medium text-neutral-900">
                            {parsedNotes.memo || viewInvoice.notes || "Prestation agence digitale contractuelle"}
                          </td>
                          <td className="p-3 text-center">1</td>
                          <td className="p-3 text-right font-mono">{formatCurrency(viewInvoice.subtotal || viewInvoice.total)}</td>
                          <td className="p-3 text-right font-mono font-bold">{formatCurrency(viewInvoice.subtotal || viewInvoice.total)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 4. Totaux & Modalités de Paiement */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start pt-2">
                  {/* Bloc Modalité de Paiement Mentionnée */}
                  <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2.5 text-xs">
                    <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                        <span>Modalité de Règlement :</span>
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wide border ${
                          paymentMethod === "ESPECES"
                            ? "bg-amber-100 text-amber-900 border-amber-300"
                            : paymentMethod === "BARIDIMOB"
                            ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                            : "bg-blue-100 text-blue-900 border-blue-300"
                        }`}
                      >
                        {paymentMethod === "ESPECES" && "💵 Espèces (Cash)"}
                        {paymentMethod === "BARIDIMOB" && "💳 BaridiMob / CCP"}
                        {paymentMethod === "VIREMENT" && "🏦 Virement Bancaire"}
                        {paymentMethod === "CHEQUE" && "📄 Chèque Bancaire"}
                        {paymentMethod === "OTHER" && "Autre Règlement"}
                      </span>
                    </div>

                    {/* Coordonnées spécifiques au mode retenu */}
                    {paymentMethod === "BARIDIMOB" && (
                      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-3 text-xs space-y-1">
                        <p className="font-bold text-emerald-950">Compte BaridiMob & CCP Agence :</p>
                        <p className="font-mono text-sm font-black text-emerald-900">
                          {AGENCY_DETAILS.ccp}
                        </p>
                        <p className="text-[11px] text-emerald-800">
                          Titulaire : <strong>{AGENCY_DETAILS.legalName}</strong>
                        </p>
                        <p className="text-[10px] text-neutral-600 italic pt-1 border-t border-emerald-200/60">
                          * Veuillez mentionner la réf. <strong>{viewInvoice.invoiceNumber}</strong> lors de l'envoi et transmettre le reçu.
                        </p>
                      </div>
                    )}

                    {paymentMethod === "ESPECES" && (
                      <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-3 text-xs space-y-1">
                        <p className="font-bold text-amber-950">Paiement Direct en Espèces :</p>
                        <p className="text-[11px] text-neutral-800">
                          Règlement auprès du service caisse à l'agence : <strong>{AGENCY_DETAILS.address}, {AGENCY_DETAILS.wilaya}</strong>.
                        </p>
                        <p className="text-[10px] text-neutral-600 italic pt-1 border-t border-amber-200/60">
                          * Délivrance immédiate d'un bon de caisse et reçu officiel d'acquittement dès versement.
                        </p>
                      </div>
                    )}

                    {paymentMethod === "VIREMENT" && (
                      <div className="bg-blue-50/70 border border-blue-200/80 rounded-lg p-3 text-xs space-y-1">
                        <p className="font-bold text-blue-950">Virement Bancaire (BNA) :</p>
                        <p className="font-mono text-xs font-black text-blue-900">
                          RIB : {AGENCY_DETAILS.rib}
                        </p>
                        <p className="text-[11px] text-blue-800">
                          Banque : <strong>BNA</strong> • Titulaire : <strong>{AGENCY_DETAILS.legalName}</strong>
                        </p>
                      </div>
                    )}

                    {paymentMethod === "CHEQUE" && (
                      <div className="bg-purple-50/70 border border-purple-200/80 rounded-lg p-3 text-xs space-y-1">
                        <p className="font-bold text-purple-950">Règlement par Chèque :</p>
                        <p className="text-[11px] text-neutral-800">
                          Chèque barré non endossable à l'ordre de : <strong>{AGENCY_DETAILS.legalName}</strong>.
                        </p>
                      </div>
                    )}

                    {/* Rappel général coordonnées agence */}
                    <div className="text-[10px] text-neutral-500 space-y-0.5 pt-1 border-t border-neutral-200">
                      <p>{AGENCY_DETAILS.legalName} • Tél : {AGENCY_DETAILS.phone} • Email : {AGENCY_DETAILS.email}</p>
                      {parsedNotes.memo && (
                        <p className="italic text-neutral-600">Note : {parsedNotes.memo}</p>
                      )}
                    </div>
                  </div>

                  {/* Tableau des Totaux (HT ou TTC) */}
                  <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2.5 text-xs">
                    <div className="flex items-center justify-between text-neutral-600">
                      <span>Total Hors Taxes (HT) :</span>
                      <span className="font-mono font-semibold text-neutral-900">
                        {formatCurrency(viewInvoice.subtotal || viewInvoice.total)}
                      </span>
                    </div>

                    {taxMode === "TTC" ? (
                      <div className="flex items-center justify-between text-neutral-600">
                        <span>TVA ({viewInvoice.taxRate || 19}%) :</span>
                        <span className="font-mono font-semibold text-neutral-900">
                          {formatCurrency(viewInvoice.taxAmount || 0)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-neutral-500 italic">
                        <span>TVA (0%) :</span>
                        <span className="font-mono font-medium text-neutral-500">
                          0,00 DA (Exonéré de TVA / Régime HT)
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2.5 border-t-2 border-neutral-900 text-sm">
                      <span className="font-black text-neutral-950 uppercase">
                        {taxMode === "HT" ? "TOTAL NET À PAYER (HT) :" : "TOTAL GÉNÉRAL TTC :"}
                      </span>
                      <span
                        className={`font-mono font-black text-base ${
                          taxMode === "HT" ? "text-blue-600" : "text-emerald-600"
                        }`}
                      >
                        {formatCurrency(viewInvoice.total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 5. Montant en toutes lettres & Cachet */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-neutral-200 items-end">
                  <div className="md:col-span-2 space-y-1.5 bg-blue-50/60 p-3.5 rounded-xl border border-blue-100">
                    <span className="text-[10px] font-bold uppercase text-blue-900 tracking-wider block">
                      Arrêtée la présente facture à la somme de :
                    </span>
                    <p className="text-xs font-bold text-neutral-900 italic leading-snug">
                      « {amountToFrenchWords(Number(viewInvoice.total), taxMode)} »
                    </p>
                  </div>

                  {/* Cachet & Signature */}
                  <div className="text-center p-3 border-2 border-dashed border-neutral-300 rounded-xl space-y-12">
                    <span className="text-[10px] font-bold uppercase text-neutral-500 block">
                      Cachet & Signature de l'Agence
                    </span>
                    <div className="text-[10px] text-neutral-400 italic">
                      Pour HDZ SECURITY SARL
                    </div>
                  </div>
                </div>

                {/* Footer Légal */}
                <div className="text-center pt-4 border-t border-neutral-200 text-[10px] text-neutral-500 leading-relaxed">
                  <p className="font-medium text-neutral-700">
                    {AGENCY_DETAILS.legalName} • Capital Social : {AGENCY_DETAILS.capital} • {AGENCY_DETAILS.address}, {AGENCY_DETAILS.wilaya}
                  </p>
                  <p>
                    RC : {AGENCY_DETAILS.rc} | NIF : {AGENCY_DETAILS.nif} | NIS : {AGENCY_DETAILS.nis} | AI : {AGENCY_DETAILS.ai}
                  </p>
                </div>
              </div>

              {/* Bottom Close Button (Screen only) */}
              <div className="flex justify-end gap-2 print:hidden">
                <Button
                  onClick={handlePrint}
                  className="gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer la Facture</span>
                </Button>
                <Button variant="outline" onClick={() => setViewInvoice(null)}>
                  Fermer
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* 4. Detail Modal: Reçu de Paiement Officiel & Imprimable */}
      <Modal
        isOpen={Boolean(viewPayment)}
        onClose={() => setViewPayment(null)}
        title={`Reçu de Paiement Officiel — ${viewPayment?.reference || "Bon d'Encaissement"}`}
        description="Visualisation conforme aux normes comptables & Impression directe"
        maxWidth="4xl"
      >
        {viewPayment && (() => {
          const handlePrintReceipt = () => {
            window.print();
          };

          const pmtMethodLabel =
            PAYMENT_METHODS[viewPayment.paymentMethod as keyof typeof PAYMENT_METHODS] ||
            viewPayment.paymentMethod;

          const pmtTypeLabel =
            PAYMENT_TYPE_LABELS[viewPayment.paymentType as keyof typeof PAYMENT_TYPE_LABELS] ||
            viewPayment.paymentType;

          return (
            <div className="space-y-4 text-xs">
              {/* Actions Bar (Screen only, hidden on print) */}
              <div className="flex items-center justify-between p-3 bg-neutral-950/80 border border-neutral-800 rounded-xl print:hidden">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    ✓ Règlement Encaissé & Confirmé
                  </span>
                  <span className="text-neutral-400 text-xs">
                    Date : {formatDate(viewPayment.paymentDate)} • Enregistré par {viewPayment.recordedBy?.name || "Comptabilité"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handlePrintReceipt}
                    className="gap-1.5 shadow-md shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimer le Reçu</span>
                  </Button>
                  <Button variant="outline" onClick={() => setViewPayment(null)}>
                    Fermer
                  </Button>
                </div>
              </div>

              {/* Print Style Injector */}
              <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                  body * {
                    visibility: hidden !important;
                  }
                  #printable-receipt-sheet, #printable-receipt-sheet * {
                    visibility: visible !important;
                  }
                  #printable-receipt-sheet {
                    position: fixed !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 12mm 15mm !important;
                    background: #ffffff !important;
                    color: #111827 !important;
                    box-shadow: none !important;
                    border: none !important;
                    z-index: 999999 !important;
                  }
                  @page {
                    size: A4 portrait;
                    margin: 10mm;
                  }
                }
              `}} />

              {/* REÇU OFFICIEL (Format A4 Papier / Print & Screen) */}
              <div
                id="printable-receipt-sheet"
                className="bg-white text-neutral-900 rounded-2xl p-6 sm:p-10 shadow-2xl border border-neutral-200 font-sans space-y-6"
              >
                {/* 1. Header Agence & Titre Reçu */}
                <div className="flex items-start justify-between border-b border-neutral-200 pb-6 gap-6">
                  {/* Gauche : Logo & Coordonnées de l'Agence */}
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <img
                        src="/logo.png"
                        alt="HDZ SECURITY"
                        className="w-14 h-14 object-contain rounded-xl border border-neutral-200 p-1 shrink-0 bg-white"
                      />
                      <div>
                        <h2 className="text-xl font-black tracking-wider text-neutral-950 flex items-center gap-2">
                          <span>HDZ SECURITY</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                            SARL
                          </span>
                        </h2>
                        <p className="text-[11px] font-semibold text-neutral-500">{AGENCY_DETAILS.activity}</p>
                      </div>
                    </div>

                    <div className="text-[11px] text-neutral-600 space-y-0.5 leading-relaxed pt-1">
                      <p className="font-bold text-neutral-900">{AGENCY_DETAILS.legalName}</p>
                      <p>{AGENCY_DETAILS.address}, {AGENCY_DETAILS.wilaya}</p>
                      <p>Tél : <span className="font-semibold text-neutral-800">{AGENCY_DETAILS.phone}</span> • Email : <span className="font-semibold text-neutral-800">{AGENCY_DETAILS.email}</span></p>
                      <div className="pt-1 text-[10px] text-neutral-500 font-mono flex flex-wrap gap-x-3 gap-y-0.5 border-t border-neutral-100 mt-1">
                        <span><strong>RC :</strong> {AGENCY_DETAILS.rc}</span>
                        <span><strong>NIF :</strong> {AGENCY_DETAILS.nif}</span>
                        <span><strong>NIS :</strong> {AGENCY_DETAILS.nis}</span>
                        <span><strong>AI :</strong> {AGENCY_DETAILS.ai}</span>
                      </div>
                    </div>
                  </div>

                  {/* Droite : Bloc Titre Reçu & Référence */}
                  <div className="text-right space-y-2 shrink-0">
                    <div className="bg-neutral-900 text-white px-4 py-2.5 rounded-xl text-right space-y-0.5">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 block">Bon de Caisse & Preuve</span>
                      <h1 className="text-xl font-black tracking-wider text-white">REÇU DE PAIEMENT</h1>
                    </div>
                    <div className="text-xs space-y-1 font-mono text-neutral-700">
                      <p>Réf. Reçu : <strong className="text-emerald-700 text-sm">{viewPayment.reference || `REC-${viewPayment.id?.slice(0, 8).toUpperCase()}`}</strong></p>
                      <p>Date d'encaissement : <strong>{formatDate(viewPayment.paymentDate)}</strong></p>
                      <div className="pt-1">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Statut : VALIDÉ & ACQUITTÉ
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Coordonnées du Client / Versé par */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Règlement Reçu de / Payeur :</span>
                    </span>
                    <h3 className="text-sm font-black text-neutral-900 uppercase">{clientData.companyName}</h3>
                    <div className="text-xs text-neutral-700 space-y-0.5">
                      <p className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span>{clientData.address || clientData.wilaya || "Algérie"}</span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span>{clientData.phone || "-"}</span>
                        {clientData.email && (
                          <>
                            <span className="text-neutral-300">•</span>
                            <span>{clientData.email}</span>
                          </>
                        )}
                      </p>
                      {clientData.contactName && (
                        <p className="text-[11px] text-neutral-600">
                          Contact référent : <span className="font-semibold text-neutral-800">{clientData.contactName}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Détails de Transaction */}
                  <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                      <span>Paramètres de la Transaction :</span>
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs text-neutral-700 pt-1">
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Mode de Paiement</span>
                        <strong className="text-neutral-900">{pmtMethodLabel}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Nature de l'opération</span>
                        <strong className="text-neutral-900">{pmtTypeLabel}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Facture Rattachée</span>
                        <strong className="text-blue-600 font-mono">
                          {viewPayment.invoice?.invoiceNumber || (viewPayment.invoiceId ? "Facture client" : "Règlement libre")}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Enregistré par</span>
                        <strong className="text-neutral-900">{viewPayment.recordedBy?.name || "Service Comptabilité"}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Tableau Récapitulatif du Règlement */}
                <div className="overflow-hidden border border-neutral-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-900 text-white font-semibold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3">Désignation / Motif de l'Encaissement</th>
                        <th className="p-3 text-center w-36">Mode de Règlement</th>
                        <th className="p-3 text-center w-36">Réf. Transaction</th>
                        <th className="p-3 text-right w-40">Montant Encaissé</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 text-neutral-800">
                      <tr>
                        <td className="p-3">
                          <p className="font-semibold text-neutral-900">{pmtTypeLabel}</p>
                          <p className="text-[11px] text-neutral-500">
                            {viewPayment.notes || `Règlement convenu pour le compte de ${clientData.companyName}`}
                          </p>
                        </td>
                        <td className="p-3 text-center font-medium">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-neutral-100 text-neutral-800 font-semibold border border-neutral-200">
                            {pmtMethodLabel}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono text-neutral-700">
                          {viewPayment.reference || "—"}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-emerald-600 text-sm">
                          {formatCurrency(viewPayment.amount)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 4. Bloc Grand Montant Encaissé & Arrêté en Lettres */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/80 pb-3">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-emerald-600" />
                      <span>MONTANT TOTAL ENCAISSÉ :</span>
                    </span>
                    <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-700">
                      {formatCurrency(viewPayment.amount)}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-emerald-900 tracking-wider block">
                      Arrêté le présent reçu de paiement à la somme de :
                    </span>
                    <p className="text-xs font-bold text-neutral-900 italic leading-snug">
                      « {amountToFrenchWords(Number(viewPayment.amount))} »
                    </p>
                  </div>
                </div>

                {/* 5. Précisions du Mode de Paiement & Notes */}
                <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1.5 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 block">
                    Modalités d'Encaissement & Justificatif :
                  </span>
                  {viewPayment.paymentMethod === "CASH" && (
                    <p className="text-neutral-700">
                      <strong>Règlement en Espèces (Cash) :</strong> Montant perçu intégralement au guichet caisse de l'agence contre délivrance immédiate de ce reçu officiel d'acquittement.
                    </p>
                  )}
                  {viewPayment.paymentMethod === "BARIDIMOB" && (
                    <p className="text-neutral-700">
                      <strong>Transfert BaridiMob / CCP :</strong> Transaction électronique créditée avec succès sur le compte postal de l'agence (<strong>{AGENCY_DETAILS.ccp}</strong>).
                    </p>
                  )}
                  {viewPayment.paymentMethod === "BANK_TRANSFER" && (
                    <p className="text-neutral-700">
                      <strong>Virement Bancaire :</strong> Virement bancaire porté au crédit du compte BNA de l'agence (<strong>RIB : {AGENCY_DETAILS.rib}</strong>).
                    </p>
                  )}
                  {viewPayment.paymentMethod === "CARD" && (
                    <p className="text-neutral-700">
                      <strong>Paiement Électronique :</strong> Transaction par carte interbancaire CIB / Edahabia validée et créditée.
                    </p>
                  )}
                  {viewPayment.notes && (
                    <p className="text-[11px] text-neutral-600 italic pt-1 border-t border-neutral-200">
                      Observations : {viewPayment.notes}
                    </p>
                  )}
                </div>

                {/* 6. Signatures & Cachet */}
                <div className="grid grid-cols-2 gap-6 pt-4 border-t border-neutral-200 items-end">
                  <div className="text-center p-4 border-2 border-dashed border-neutral-300 rounded-xl space-y-12">
                    <span className="text-[10px] font-bold uppercase text-neutral-600 block">
                      Signature du Client / Payeur
                    </span>
                    <div className="text-[10px] text-neutral-400 italic">
                      Pour acquit & conformité
                    </div>
                  </div>

                  <div className="text-center p-4 border-2 border-dashed border-neutral-300 rounded-xl space-y-12">
                    <span className="text-[10px] font-bold uppercase text-neutral-600 block">
                      Cachet & Signature de la Caisse / Direction
                    </span>
                    <div className="text-[10px] text-neutral-500 font-medium">
                      HDZ SECURITY SARL — {viewPayment.recordedBy?.name || "Service Comptabilité"}
                    </div>
                  </div>
                </div>

                {/* Footer Légal */}
                <div className="text-center pt-4 border-t border-neutral-200 text-[10px] text-neutral-500 leading-relaxed">
                  <p className="font-medium text-neutral-700">
                    Ce reçu tient lieu de pièce justificative d'acquittement comptable pour {clientData.companyName}.
                  </p>
                  <p>
                    {AGENCY_DETAILS.legalName} • Capital Social : {AGENCY_DETAILS.capital} • {AGENCY_DETAILS.address}, {AGENCY_DETAILS.wilaya}
                  </p>
                  <p>
                    RC : {AGENCY_DETAILS.rc} | NIF : {AGENCY_DETAILS.nif} | NIS : {AGENCY_DETAILS.nis} | AI : {AGENCY_DETAILS.ai}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* 5. Detail Modal: Document */}
      <Modal
        isOpen={Boolean(viewDocument)}
        onClose={() => setViewDocument(null)}
        title="Fiche du Document Contractuel"
        description="Informations et accès au document"
        maxWidth="md"
      >
        {viewDocument && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-100">{viewDocument.name}</h3>
                  <p className="text-neutral-400 text-[11px]">Format : {viewDocument.fileType}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Catégorie :</span>
                <span className="text-blue-400 font-semibold">{viewDocument.category}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Date d'ajout :</span>
                <span className="text-neutral-200">{formatDate(viewDocument.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Ajouté par :</span>
                <span className="text-neutral-200">{viewDocument.uploadedBy?.name || "Direction Commerciale"}</span>
              </div>
            </div>

            {viewDocument.fileUrl && viewDocument.fileUrl !== "#" ? (
              <a
                href={viewDocument.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Ouvrir / Télécharger le document</span>
              </a>
            ) : null}

            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setViewDocument(null)}>
                Fermer
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 6. Modal: Gérer & Modifier la fiche client complète */}
      <Modal
        isOpen={openEditClientModal}
        onClose={() => setOpenEditClientModal(false)}
        title={`Gérer les informations — ${clientData.companyName}`}
        description="Mise à jour globale de la fiche entreprise, contrat, liens médias et coordonnées fiscales"
        maxWidth="3xl"
      >
        <form onSubmit={handleSaveEditClient} className="space-y-5 text-xs">
          {/* Navigation Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-neutral-950/80 border border-neutral-800 rounded-xl">
            <button
              type="button"
              onClick={() => setEditClientTab("general")}
              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg font-semibold transition-all ${
                editClientTab === "general"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
              }`}
            >
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">1. Entreprise</span>
            </button>
            <button
              type="button"
              onClick={() => setEditClientTab("contract")}
              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg font-semibold transition-all ${
                editClientTab === "contract"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
              }`}
            >
              <FileCheck className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">2. Contrat</span>
            </button>
            <button
              type="button"
              onClick={() => setEditClientTab("media")}
              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg font-semibold transition-all ${
                editClientTab === "media"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
              }`}
            >
              <Share2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">3. Médias</span>
            </button>
            <button
              type="button"
              onClick={() => setEditClientTab("billing")}
              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg font-semibold transition-all ${
                editClientTab === "billing"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
              }`}
            >
              <Receipt className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">4. Facturation</span>
            </button>
          </div>

          {/* TAB 1: Entreprise & Contact */}
          {editClientTab === "general" && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Raison sociale / Entreprise *"
                  value={editClientForm.companyName}
                  onChange={(e) => setEditClientForm({ ...editClientForm, companyName: e.target.value })}
                  placeholder="Ex: SARL BioSanté Algérie"
                  required
                />
                <Input
                  label="Marque / Enseigne commerciale"
                  value={editClientForm.brandName}
                  onChange={(e) => setEditClientForm({ ...editClientForm, brandName: e.target.value })}
                  placeholder="Ex: BioSanté"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Contact référent"
                  value={editClientForm.contactName}
                  onChange={(e) => setEditClientForm({ ...editClientForm, contactName: e.target.value })}
                  placeholder="Ex: Dr. Karima Benali"
                />
                <Input
                  label="Téléphone *"
                  value={editClientForm.phone}
                  onChange={(e) => setEditClientForm({ ...editClientForm, phone: e.target.value })}
                  placeholder="Ex: 0550 12 34 56"
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  value={editClientForm.email}
                  onChange={(e) => setEditClientForm({ ...editClientForm, email: e.target.value })}
                  placeholder="contact@entreprise.dz"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Secteur d'activité
                  </label>
                  <select
                    value={editClientForm.sector}
                    onChange={(e) => setEditClientForm({ ...editClientForm, sector: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-neutral-950/80 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
                  >
                    {SECTORS.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Wilaya
                  </label>
                  <select
                    value={editClientForm.wilaya}
                    onChange={(e) => setEditClientForm({ ...editClientForm, wilaya: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-neutral-950/80 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
                  >
                    {WILAYAS.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Input
                label="Adresse complète"
                value={editClientForm.address}
                onChange={(e) => setEditClientForm({ ...editClientForm, address: e.target.value })}
                placeholder="Ex: 14 Boulevard Colonel Amirouche, Oran"
              />
            </div>
          )}

          {/* TAB 2: Contrat & Forfait */}
          {editClientTab === "contract" && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              {/* SÉLECTEUR DE PACKS DIGITAUX */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-200">
                    Offre / Pack souscrit *
                  </label>
                  <span className="text-[11px] text-neutral-400">
                    Sélectionnez le pack d'accompagnement
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["STARTER", "SILVER", "GOLD", "CUSTOM"] as (keyof typeof OFFER_DETAILS)[]).map((key) => {
                    const pack = OFFER_DETAILS[key];
                    const isSelected = editClientForm.offerType === key;

                    return (
                      <div
                        key={key}
                        onClick={() => handleEditOfferSelect(key as OfferType)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? `${pack.theme.activeBg} ${pack.theme.border} ring-2 ring-blue-500/40 shadow-sm`
                            : "bg-neutral-950/70 border-neutral-800 hover:border-neutral-700"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-bold text-xs text-neutral-100">{pack.name}</span>
                          {isSelected && <Check className="w-3 h-3 text-blue-400 shrink-0" />}
                        </div>
                        <div className="text-[11px] font-bold text-neutral-200 mt-1">
                          {pack.monthlyPrice > 0 ? `${pack.monthlyPrice.toLocaleString("fr-FR")} DA` : "Sur mesure"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* OPTION SITE VITRINE (+2 000 DA) */}
              {(editClientForm.offerType === "SILVER" || editClientForm.offerType === "GOLD" || editClientForm.offerType === "CUSTOM") ? (
                <div
                  onClick={() => handleEditWebsiteToggle(!editClientForm.hasWebsite)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    editClientForm.hasWebsite
                      ? "bg-emerald-950/30 border-emerald-500/50"
                      : "bg-neutral-950/60 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        editClientForm.hasWebsite
                          ? "bg-emerald-500 border-emerald-400 text-neutral-950 font-bold"
                          : "border-neutral-700 bg-neutral-900"
                      }`}
                    >
                      {editClientForm.hasWebsite && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-semibold text-neutral-200">
                        Option Site Vitrine (+2 000 DA / mois)
                      </span>
                    </div>
                  </div>
                  <span className={`text-xs font-bold font-mono ${editClientForm.hasWebsite ? "text-emerald-400" : "text-neutral-500"}`}>
                    {editClientForm.hasWebsite ? "+ 2 000 DA" : "+ 0 DA"}
                  </span>
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-center gap-2 text-[11px] text-blue-300">
                  <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Site web professionnel inclus dans le Pack Starter.</span>
                </div>
              )}

              {/* DÉTAIL DES LIVRABLES DU PACK */}
              <div className="p-2.5 bg-neutral-950/60 border border-neutral-800 rounded-xl space-y-1">
                <span className="text-[11px] font-semibold text-neutral-400">
                  Inclus dans le {OFFER_DETAILS[editClientForm.offerType as keyof typeof OFFER_DETAILS]?.name} :
                </span>
                <div className="flex flex-wrap gap-1">
                  {OFFER_DETAILS[editClientForm.offerType as keyof typeof OFFER_DETAILS]?.features.map((feat, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-300 font-medium"
                    >
                      • {feat}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Statut Client
                </label>
                <select
                  value={editClientForm.status}
                  onChange={(e) => setEditClientForm({ ...editClientForm, status: e.target.value as ClientStatus })}
                  className="w-full h-10 px-3 rounded-xl bg-neutral-950/80 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
                >
                  {Object.entries(CLIENT_STATUSES).map(([key, item]) => (
                    <option key={key} value={key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Forfait Mensuel (DZD)"
                  type="number"
                  min="0"
                  step="any"
                  value={editClientForm.monthlyFee}
                  onChange={(e) => setEditClientForm({ ...editClientForm, monthlyFee: Number(e.target.value) || 0 })}
                  placeholder="35000"
                />
                <Input
                  label="Valeur Globale Engagement (DZD)"
                  type="number"
                  min="0"
                  step="any"
                  value={editClientForm.contractValue}
                  onChange={(e) => setEditClientForm({ ...editClientForm, contractValue: Number(e.target.value) || 0 })}
                  placeholder="420000"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Date de début de contrat"
                  type="date"
                  value={editClientForm.contractStart}
                  onChange={(e) => setEditClientForm({ ...editClientForm, contractStart: e.target.value })}
                />
                <Input
                  label="Date d'échéance / fin de contrat"
                  type="date"
                  value={editClientForm.contractEnd}
                  onChange={(e) => setEditClientForm({ ...editClientForm, contractEnd: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Commercial Assigné
                </label>
                <select
                  value={editClientForm.assignedToId}
                  onChange={(e) => setEditClientForm({ ...editClientForm, assignedToId: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-neutral-950/80 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Non assigné / Direction</option>
                  {salesUsers?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.role ? `(${u.role})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* TAB 3: Médias & Réseaux */}
          {editClientTab === "media" && (
            <div className="space-y-3.5 animate-in fade-in-50 duration-150">
              <div className="p-3 bg-neutral-950/60 border border-neutral-800/80 rounded-xl space-y-1 text-[11px] text-neutral-400">
                <p className="font-semibold text-neutral-200 flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-blue-400" />
                  Ressources digitales & Médias sociaux du client
                </p>
                <p>
                  Ces liens sont directement cliquables et partageables depuis la fiche client par toute l'équipe.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1 flex items-center gap-1.5">
                    <GoogleDriveIcon className="w-3.5 h-3.5" />
                    <span>Lien Dossier Google Drive (Photos, Vidéos, Éléments graphiques)</span>
                  </label>
                  <Input
                    value={editClientForm.driveUrl}
                    onChange={(e) => setEditClientForm({ ...editClientForm, driveUrl: e.target.value })}
                    placeholder="https://drive.google.com/drive/folders/..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1 flex items-center gap-1.5">
                    <GoogleBusinessIcon className="w-3.5 h-3.5" />
                    <span>Lien Fiche Google Maps / Google Business Profile</span>
                  </label>
                  <Input
                    value={editClientForm.googleBusinessUrl}
                    onChange={(e) => setEditClientForm({ ...editClientForm, googleBusinessUrl: e.target.value })}
                    placeholder="https://maps.app.goo.gl/... ou https://google.com/maps/..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1 flex items-center gap-1.5">
                      <FacebookIcon className="w-3.5 h-3.5" />
                      <span>Page Facebook</span>
                    </label>
                    <Input
                      value={editClientForm.facebook}
                      onChange={(e) => setEditClientForm({ ...editClientForm, facebook: e.target.value })}
                      placeholder="https://facebook.com/... ou @page"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1 flex items-center gap-1.5">
                      <InstagramIcon className="w-3.5 h-3.5" />
                      <span>Compte Instagram</span>
                    </label>
                    <Input
                      value={editClientForm.instagram}
                      onChange={(e) => setEditClientForm({ ...editClientForm, instagram: e.target.value })}
                      placeholder="https://instagram.com/... ou @compte"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1 flex items-center gap-1.5">
                    <TikTokIcon className="w-3.5 h-3.5" />
                    <span>Compte TikTok</span>
                  </label>
                  <Input
                    value={editClientForm.tiktok}
                    onChange={(e) => setEditClientForm({ ...editClientForm, tiktok: e.target.value })}
                    placeholder="https://tiktok.com/@... ou @compte"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Facturation & Fiscalité */}
          {editClientTab === "billing" && (
            <div className="space-y-3.5 animate-in fade-in-50 duration-150">
              <div className="p-3 bg-neutral-950/60 border border-neutral-800/80 rounded-xl space-y-1 text-[11px] text-neutral-400">
                <p className="font-semibold text-neutral-200 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-blue-400" />
                  Identifiants légaux et fiscaux de l'entreprise
                </p>
                <p>
                  Ces coordonnées fiscales apparaissent automatiquement lors de l'émission et de l'impression des factures officielles.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Registre de Commerce (RC)"
                  value={editClientForm.rc}
                  onChange={(e) => setEditClientForm({ ...editClientForm, rc: e.target.value })}
                  placeholder="Ex: 16/00-1234567B22"
                />
                <Input
                  label="Numéro d'Identification Fiscale (NIF)"
                  value={editClientForm.nif}
                  onChange={(e) => setEditClientForm({ ...editClientForm, nif: e.target.value })}
                  placeholder="Ex: 002216001234567"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Numéro d'Identification Statistique (NIS)"
                  value={editClientForm.nis}
                  onChange={(e) => setEditClientForm({ ...editClientForm, nis: e.target.value })}
                  placeholder="Ex: 002216090123456"
                />
                <Input
                  label="Article d'Imposition (AI)"
                  value={editClientForm.ai}
                  onChange={(e) => setEditClientForm({ ...editClientForm, ai: e.target.value })}
                  placeholder="Ex: 16012345678"
                />
              </div>

              <Input
                label="Relevé d'Identité Bancaire / Postal (RIB / RIP)"
                value={editClientForm.rib}
                onChange={(e) => setEditClientForm({ ...editClientForm, rib: e.target.value })}
                placeholder="Ex: 001 00123 0123456789 25"
              />
            </div>
          )}

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenEditClientModal(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={isSubmitting}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5"
            >
              Enregistrer les modifications
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Confirmation de suppression du client (Admin uniquement) */}
      <Modal
        isOpen={openDeleteModal}
        onClose={() => {
          if (!isDeletingClient) {
            setOpenDeleteModal(false);
            setDeleteClientError(null);
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
                Êtes-vous sûr de vouloir supprimer définitivement le client{" "}
                <strong className="text-white font-bold">{clientData.companyName}</strong>{" "}
                {clientData.brandName ? `(${clientData.brandName})` : ""} ?
              </p>
              <p className="text-red-400/90 text-[11px] mt-1">
                ⚠️ Cette opération supprimera définitivement le compte client, ainsi que tous ses projets, factures, paiements, appels et documents rattachés.
              </p>
            </div>
          </div>

          {deleteClientError && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{deleteClientError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-800">
            <Button
              type="button"
              variant="outline"
              disabled={isDeletingClient}
              onClick={() => {
                setOpenDeleteModal(false);
                setDeleteClientError(null);
              }}
            >
              Annuler
            </Button>
            <Button
              type="button"
              disabled={isDeletingClient}
              onClick={handleDeleteClient}
              className="bg-red-600 hover:bg-red-500 text-white font-bold gap-1.5 shadow-lg shadow-red-600/20 cursor-pointer"
            >
              {isDeletingClient ? (
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
