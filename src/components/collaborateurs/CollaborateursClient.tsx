"use client";

import React, { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Mail,
  Shield,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  Eye,
  Check,
  X,
  Lock,
  History,
  KeyRound,
  RotateCcw,
  Briefcase,
  Building,
  Phone,
  Calendar,
  Send,
} from "lucide-react";
import {
  approveRegistrationRequestAction,
  rejectRegistrationRequestAction,
  setPendingRegistrationRequestAction,
  initiateEmailChangeAction,
  toggleUserSuspensionAction,
  adminTriggerPasswordResetAction,
  updateUserRoleAction,
  getCollaboratorDetailAction,
} from "@/actions/users-management";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Role, UserStatus, DepartmentType } from "@prisma/client";

interface CollaboratorItem {
  id: string;
  name: string;
  email: string;
  pendingEmail?: string | null;
  phone?: string | null;
  role: Role;
  status: UserStatus;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
  createdAt: string;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    department: DepartmentType;
    baseSalary: number;
    hireDate: string;
  } | null;
  counts?: {
    assignedProspects: number;
    managedClients: number;
    assignedTasks: number;
    loggedCalls: number;
  };
}

interface RequestItem {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: string;
  employee?: {
    firstName: string;
    lastName: string;
    position: string;
    department: DepartmentType;
  } | null;
}

interface CollaborateursClientProps {
  initialRequests: RequestItem[];
  initialCollaborators: CollaboratorItem[];
  initialTab?: string;
}

const DEPARTMENT_LABELS: Record<string, string> = {
  COMMERCIAL: "Commercial & Ventes",
  PROSPECTION: "Prospection Directe",
  SALES: "Ventes B2B",
  CUSTOMER_RELATIONS: "Relation Client",
  MARKETING: "Marketing & Ads",
  SOCIAL_MEDIA: "Social Media",
  ADS: "Média & Sponsoring",
  CONTENT: "Création Contenu",
  TECHNICAL: "Technique",
  DEVELOPMENT: "Développement Web / IT",
  DESIGN: "Design UI/UX",
  VIDEO: "Production & Vidéo",
  ADMINISTRATION: "Direction / Admin",
  FINANCE: "Finance & Compta",
  HR: "Ressources Humaines",
};

const ROLES_LIST: { role: Role; label: string }[] = [
  { role: "ADMIN", label: "Administrateur Général" },
  { role: "SALES_DIRECTOR", label: "Directeur Commercial" },
  { role: "SALES_REP", label: "Commercial / Ventes" },
  { role: "TECH_LEAD", label: "Chef Technique (Tech Lead)" },
  { role: "DEVELOPER", label: "Développeur Web" },
  { role: "DESIGNER", label: "Designer UI/UX" },
  { role: "VIDEO_EDITOR", label: "Monteur Vidéo" },
  { role: "ACCOUNTANT", label: "Comptable & Finance" },
  { role: "HR", label: "Ressources Humaines" },
];

export function CollaborateursClient({
  initialRequests,
  initialCollaborators,
  initialTab,
}: CollaborateursClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"REQUESTS" | "COLLABORATORS">(
    initialTab === "REQUESTS" ? "REQUESTS" : "COLLABORATORS"
  );

  // Lists state
  const [requests, setRequests] = useState<RequestItem[]>(initialRequests);
  const [collaborators, setCollaborators] = useState<CollaboratorItem[]>(initialCollaborators);

  // Feedback banner
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const showFeedback = (text: string, type: "success" | "error" = "success") => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Filters for Collaborators tab
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");

  // Modals & Drawers state
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);
  const [rejectModalData, setRejectModalData] = useState<{ id: string; name: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [detailCollaboratorId, setDetailCollaboratorId] = useState<string | null>(null);
  const [collaboratorDetail, setCollaboratorDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Email change modal state
  const [emailChangeData, setEmailChangeData] = useState<{
    userId: string;
    name: string;
    currentEmail: string;
  } | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [confirmNewEmail, setConfirmNewEmail] = useState("");
  const [emailChangeError, setEmailChangeError] = useState<string | null>(null);

  // Count of pending requests
  const pendingRequestsCount = requests.filter(
    (r) => r.status === "PENDING" || r.status === "EMAIL_UNVERIFIED"
  ).length;

  // Filtered collaborators list
  const filteredCollaborators = useMemo(() => {
    return collaborators.filter((c) => {
      if (statusFilter !== "ALL") {
        if (statusFilter === "EMAIL_UNVERIFIED") {
          if (c.emailVerified) return false;
        } else if (c.status !== statusFilter) {
          return false;
        }
      }

      if (deptFilter !== "ALL") {
        if (c.employee?.department !== deptFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = c.name.toLowerCase().includes(q);
        const matchEmail = c.email.toLowerCase().includes(q);
        const matchPhone = (c.phone || "").toLowerCase().includes(q);
        const matchPos = (c.employee?.position || "").toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone && !matchPos) return false;
      }

      return true;
    });
  }, [collaborators, statusFilter, deptFilter, searchQuery]);

  // Request actions
  const handleApproveRequest = (userId: string, name: string) => {
    startTransition(async () => {
      try {
        await approveRegistrationRequestAction(userId);
        setRequests((prev) => prev.filter((r) => r.id !== userId));
        setCollaborators((prev) =>
          prev.map((c) =>
            c.id === userId ? { ...c, status: "ACTIVE" as UserStatus, isActive: true } : c
          )
        );
        showFeedback(`Le compte de ${name} a été approuvé avec succès.`);
        router.refresh();
      } catch (err: any) {
        showFeedback(err?.message || "Erreur lors de l'approbation.", "error");
      }
    });
  };

  const handleOpenRejectModal = (id: string, name: string) => {
    setRejectModalData({ id, name });
    setRejectionReason("");
  };

  const handleConfirmReject = () => {
    if (!rejectModalData) return;
    startTransition(async () => {
      try {
        await rejectRegistrationRequestAction(rejectModalData.id, rejectionReason);
        setRequests((prev) => prev.filter((r) => r.id !== rejectModalData.id));
        setCollaborators((prev) =>
          prev.map((c) =>
            c.id === rejectModalData.id
              ? { ...c, status: "REJECTED" as UserStatus, isActive: false }
              : c
          )
        );
        showFeedback(`La demande de ${rejectModalData.name} a été refusée.`);
        setRejectModalData(null);
        router.refresh();
      } catch (err: any) {
        showFeedback(err?.message || "Erreur lors du refus.", "error");
      }
    });
  };

  const handleSetPending = (userId: string) => {
    startTransition(async () => {
      try {
        await setPendingRegistrationRequestAction(userId);
        setRequests((prev) =>
          prev.map((r) => (r.id === userId ? { ...r, status: "PENDING" as UserStatus } : r))
        );
        showFeedback("Demande remise en attente de décision.");
        router.refresh();
      } catch (err: any) {
        showFeedback(err?.message || "Erreur", "error");
      }
    });
  };

  // Open detail drawer
  const handleOpenDetail = async (userId: string) => {
    setDetailCollaboratorId(userId);
    setDetailLoading(true);
    try {
      const data = await getCollaboratorDetailAction(userId);
      setCollaboratorDetail(data);
    } catch {
      showFeedback("Erreur lors de la récupération des détails.", "error");
      setDetailCollaboratorId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Toggle suspension
  const handleToggleSuspension = (userId: string, currentSuspended: boolean) => {
    startTransition(async () => {
      try {
        const next = !currentSuspended;
        const res = await toggleUserSuspensionAction(userId, next);
        setCollaborators((prev) =>
          prev.map((c) =>
            c.id === userId ? { ...c, status: res.status, isActive: !next } : c
          )
        );
        if (collaboratorDetail && collaboratorDetail.id === userId) {
          setCollaboratorDetail((prev: any) => ({
            ...prev,
            status: res.status,
            isActive: !next,
          }));
        }
        showFeedback(next ? "Compte collaborateur suspendu." : "Compte réactivé.");
        router.refresh();
      } catch (err: any) {
        showFeedback(err?.message || "Erreur", "error");
      }
    });
  };

  // Trigger password reset email
  const handleTriggerReset = (userId: string) => {
    startTransition(async () => {
      try {
        await adminTriggerPasswordResetAction(userId);
        showFeedback("E-mail de réinitialisation envoyé au collaborateur.");
      } catch (err: any) {
        showFeedback(err?.message || "Erreur", "error");
      }
    });
  };

  // Change Role
  const handleChangeRole = (userId: string, newRole: Role) => {
    startTransition(async () => {
      try {
        await updateUserRoleAction(userId, newRole);
        setCollaborators((prev) =>
          prev.map((c) => (c.id === userId ? { ...c, role: newRole } : c))
        );
        if (collaboratorDetail && collaboratorDetail.id === userId) {
          setCollaboratorDetail((prev: any) => ({ ...prev, role: newRole }));
        }
        showFeedback("Rôle mis à jour.");
        router.refresh();
      } catch (err: any) {
        showFeedback(err?.message || "Erreur", "error");
      }
    });
  };

  // Email change process
  const handleOpenEmailChangeModal = (c: CollaboratorItem) => {
    setEmailChangeData({
      userId: c.id,
      name: c.name,
      currentEmail: c.email,
    });
    setNewEmail("");
    setConfirmNewEmail("");
    setEmailChangeError(null);
  };

  const handleConfirmEmailChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailChangeData) return;
    setEmailChangeError(null);

    if (newEmail.trim().toLowerCase() !== confirmNewEmail.trim().toLowerCase()) {
      setEmailChangeError("Les deux adresses e-mail saisies ne correspondent pas.");
      return;
    }

    startTransition(async () => {
      try {
        await initiateEmailChangeAction(emailChangeData.userId, newEmail.trim());
        setCollaborators((prev) =>
          prev.map((c) =>
            c.id === emailChangeData.userId
              ? {
                  ...c,
                  email: newEmail.trim().toLowerCase(),
                  pendingEmail: null,
                  emailVerified: true,
                }
              : c
          )
        );
        showFeedback(
          `L'adresse e-mail a été modifiée et validée immédiatement avec succès (${newEmail.trim()}).`
        );
        setEmailChangeData(null);
        router.refresh();
      } catch (err: any) {
        setEmailChangeError(err?.message || "Erreur lors de la modification d'e-mail.");
      }
    });
  };

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 text-[10px] font-bold uppercase tracking-wider border border-blue-500/30 flex items-center gap-1">
              <Shield className="w-3 h-3 text-blue-400" />
              Direction & RH
            </span>
            <span className="text-xs text-neutral-400">Gestion des Comptes</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 mt-1 flex items-center gap-2">
            Gestion des Collaborateurs & Inscriptions
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Validation des demandes d'accès, habilitations RBAC, sécurité des comptes et modifications d'e-mail.
          </p>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => router.push("/register")}
            className="gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Créer une Demande</span>
          </Button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
            feedbackMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}
        >
          {feedbackMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("COLLABORATORS")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "COLLABORATORS"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Tous les Collaborateurs</span>
          <span className="px-1.5 py-0.2 rounded-full bg-neutral-800 text-[10px] text-neutral-300">
            {collaborators.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("REQUESTS")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "REQUESTS"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Demandes d'inscription</span>
          {pendingRequestsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-[10px] font-bold text-neutral-950 animate-pulse">
              {pendingRequestsCount}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================
          TAB 1: DEMANDES D'INSCRIPTION
         ======================================================== */}
      {activeTab === "REQUESTS" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex items-center justify-between">
            <div className="text-xs text-neutral-300">
              <strong>{pendingRequestsCount}</strong> demande(s) en attente d'approbation administrative.
            </div>
            <span className="text-[11px] text-neutral-500">
              Notification automatique envoyée au collaborateur après chaque décision.
            </span>
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-950/60 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Collaborateur</th>
                    <th className="py-3 px-4">Adresse E-mail</th>
                    <th className="py-3 px-4">Département / Poste</th>
                    <th className="py-3 px-4">Date de Demande</th>
                    <th className="py-3 px-4">Vérification E-mail</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/80">
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-neutral-500">
                        Aucune demande d'inscription en attente.
                      </td>
                    </tr>
                  ) : (
                    requests.map((r) => (
                      <tr key={r.id} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-neutral-200">{r.name}</div>
                          {r.phone && (
                            <span className="text-[10px] text-neutral-500">{r.phone}</span>
                          )}
                        </td>

                        <td className="py-3 px-4 font-mono text-neutral-300">
                          {r.email}
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-neutral-200 font-medium">
                            {r.employee?.position || "Collaborateur"}
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700/60">
                            {r.employee?.department ? DEPARTMENT_LABELS[r.employee.department] || r.employee.department : "—"}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-neutral-400">
                          {new Date(r.createdAt).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>

                        <td className="py-3 px-4">
                          {r.emailVerified ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                              <Check className="w-3 h-3" />
                              <span>Vérifié</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                              <Clock className="w-3 h-3" />
                              <span>Non vérifié</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {r.status === "PENDING" && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-semibold">
                              En attente Admin
                            </span>
                          )}
                          {r.status === "EMAIL_UNVERIFIED" && (
                            <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700 text-[10px] font-semibold">
                              Attente E-mail
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedRequest(r)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
                              title="Voir les détails de la demande"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleApproveRequest(r.id, r.name)}
                              disabled={isPending}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
                              title="Accepter cette demande"
                            >
                              <Check className="w-3 h-3" />
                              <span>Accepter</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenRejectModal(r.id, r.name)}
                              disabled={isPending}
                              className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-semibold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Refuser cette demande"
                            >
                              <X className="w-3 h-3" />
                              <span>Refuser</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: TOUS LES COLLABORATEURS
         ======================================================== */}
      {activeTab === "COLLABORATORS" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-3">
            <div className="flex flex-col md:flex-row items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, prénom, e-mail ou poste..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-9 pr-4 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Status Filter */}
              <div className="w-full md:w-52">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="ALL">Tous les statuts</option>
                  <option value="ACTIVE">Actifs</option>
                  <option value="PENDING">En attente d'approbation</option>
                  <option value="SUSPENDED">Suspendus</option>
                  <option value="REJECTED">Refusés</option>
                  <option value="EMAIL_UNVERIFIED">E-mail non vérifié</option>
                </select>
              </div>

              {/* Dept Filter */}
              <div className="w-full md:w-56">
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="ALL">Tous les départements</option>
                  {Object.entries(DEPARTMENT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-950/60 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Collaborateur</th>
                    <th className="py-3 px-4">E-mail & Vérification</th>
                    <th className="py-3 px-4">Département & Fonction</th>
                    <th className="py-3 px-4">Rôle Système</th>
                    <th className="py-3 px-4">Statut Compte</th>
                    <th className="py-3 px-4">Dernière Connexion</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/80">
                  {filteredCollaborators.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-neutral-500">
                        Aucun collaborateur ne correspond à vos filtres.
                      </td>
                    </tr>
                  ) : (
                    filteredCollaborators.map((c) => (
                      <tr key={c.id} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600/30 to-indigo-600/30 border border-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center shrink-0">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-neutral-100">{c.name}</div>
                              {c.phone && <span className="text-[10px] text-neutral-500">{c.phone}</span>}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-mono text-neutral-200 text-[11px]">{c.email}</div>
                          {c.pendingEmail && (
                            <div className="text-[10px] text-amber-400 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span>En attente : {c.pendingEmail}</span>
                            </div>
                          )}
                          <div className="mt-0.5">
                            {c.emailVerified ? (
                              <span className="text-[10px] text-emerald-400 font-semibold">✓ E-mail vérifié</span>
                            ) : (
                              <span className="text-[10px] text-amber-400 font-semibold">⚠ E-mail non vérifié</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-neutral-200 font-medium">
                            {c.employee?.position || "Collaborateur"}
                          </div>
                          <span className="text-[10px] text-neutral-400">
                            {c.employee?.department ? DEPARTMENT_LABELS[c.employee.department] || c.employee.department : "—"}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <select
                            value={c.role}
                            onChange={(e) => handleChangeRole(c.id, e.target.value as Role)}
                            className="h-7 px-2 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] font-semibold text-blue-400 focus:outline-none"
                          >
                            {ROLES_LIST.map((r) => (
                              <option key={r.role} value={r.role}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-3 px-4">
                          {c.status === "ACTIVE" && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                              Actif
                            </span>
                          )}
                          {c.status === "SUSPENDED" && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                              Suspendu
                            </span>
                          )}
                          {c.status === "PENDING" && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                              En attente
                            </span>
                          )}
                          {c.status === "EMAIL_UNVERIFIED" && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                              Email non vérifié
                            </span>
                          )}
                          {c.status === "REJECTED" && (
                            <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700 text-[10px] font-bold">
                              Refusé
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-neutral-400">
                          {c.lastLoginAt
                            ? new Date(c.lastLoginAt).toLocaleDateString("fr-FR", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Jamais"}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(c.id)}
                              className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-[11px] font-medium transition-colors cursor-pointer"
                              title="Ouvrir la fiche complète"
                            >
                              Fiche
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEmailChangeModal(c)}
                              className="px-2 py-1 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 text-blue-300 border border-blue-500/30 text-[11px] font-medium transition-colors cursor-pointer"
                              title="Modifier l'adresse e-mail"
                            >
                              E-mail
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleSuspension(c.id, c.status === "SUSPENDED")}
                              className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                                c.status === "SUSPENDED"
                                  ? "bg-emerald-600/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/25"
                                  : "bg-amber-600/15 text-amber-300 border-amber-500/30 hover:bg-amber-600/25"
                              }`}
                              title={c.status === "SUSPENDED" ? "Réactiver le compte" : "Suspendre le compte"}
                            >
                              {c.status === "SUSPENDED" ? "Activer" : "Suspendre"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: DÉTAILS DE DEMANDE (VOIR)
         ======================================================== */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-400" />
                <span>Détails de la demande d'accès</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs bg-neutral-950/70 border border-neutral-800 p-4 rounded-2xl">
              <div>
                <span className="text-neutral-500">Collaborateur :</span>
                <p className="font-bold text-neutral-100 text-sm mt-0.5">{selectedRequest.name}</p>
              </div>
              <div>
                <span className="text-neutral-500">Adresse e-mail :</span>
                <p className="font-mono text-blue-400 font-semibold mt-0.5">{selectedRequest.email}</p>
              </div>
              <div>
                <span className="text-neutral-500">Téléphone :</span>
                <p className="text-neutral-200 mt-0.5">{selectedRequest.phone || "Non renseigné"}</p>
              </div>
              <div>
                <span className="text-neutral-500">Poste / Fonction :</span>
                <p className="text-neutral-200 font-semibold mt-0.5">
                  {selectedRequest.employee?.position || "Collaborateur"}
                </p>
              </div>
              <div>
                <span className="text-neutral-500">Département :</span>
                <p className="text-neutral-200 mt-0.5">
                  {selectedRequest.employee?.department ? DEPARTMENT_LABELS[selectedRequest.employee.department] || selectedRequest.employee.department : "—"}
                </p>
              </div>
              <div>
                <span className="text-neutral-500">Vérification de l'e-mail :</span>
                <p className="mt-0.5 font-bold">
                  {selectedRequest.emailVerified ? (
                    <span className="text-emerald-400">✓ E-mail vérifié</span>
                  ) : (
                    <span className="text-amber-400">⚠ En attente de vérification e-mail</span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-neutral-500">Date de soumission :</span>
                <p className="text-neutral-300 mt-0.5">
                  {new Date(selectedRequest.createdAt).toLocaleString("fr-FR")}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedRequest(null)}
              >
                Fermer
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
                onClick={() => {
                  handleApproveRequest(selectedRequest.id, selectedRequest.name);
                  setSelectedRequest(null);
                }}
              >
                Accepter le compte
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: REFUS DE DEMANDE AVEC MOTIF
         ======================================================== */}
      {rejectModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                <span>Refuser la demande de {rejectModalData.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setRejectModalData(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-300">
              Vous vous apprêtez à refuser cette demande d'accès. Un e-mail professionnel sera envoyé au demandeur l'informant de cette décision.
            </p>

            <div className="space-y-2 text-xs">
              <label className="font-semibold text-neutral-200">
                Motif du refus (optionnel mais recommandé) :
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {[
                  "Informations incomplètes ou erronées",
                  "Adresse e-mail non reconnue par l'agence",
                  "Demande non autorisée par la direction",
                  "Poste déjà pourvu",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectionReason(preset)}
                    className="px-2 py-1 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-[10px] text-neutral-300"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Précisez la raison qui sera communiquée dans l'e-mail..."
                rows={3}
                className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRejectModalData(null)}
              >
                Annuler
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 hover:bg-rose-500 text-white"
                onClick={handleConfirmReject}
                isLoading={isPending}
              >
                Confirmer le refus
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: MODIFICATION SÉCURISÉE D'E-MAIL
         ======================================================== */}
      {emailChangeData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400" />
                <span>Changer l'adresse e-mail de {emailChangeData.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEmailChangeData(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmEmailChange} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 text-neutral-400">
                <span className="text-[10px] uppercase font-bold text-neutral-500">Adresse actuelle :</span>
                <p className="font-mono text-neutral-200 font-semibold mt-0.5">{emailChangeData.currentEmail}</p>
              </div>

              {emailChangeError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-medium">
                  {emailChangeError}
                </div>
              )}

              <Input
                label="Nouvelle adresse e-mail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="nouvelle-adresse@boostera.dz"
                required
              />

              <Input
                label="Confirmer la nouvelle adresse"
                type="email"
                value={confirmNewEmail}
                onChange={(e) => setConfirmNewEmail(e.target.value)}
                placeholder="Répétez la nouvelle adresse"
                required
              />

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 leading-relaxed">
                <strong>Validation directe :</strong> En tant qu'administrateur, cette nouvelle adresse sera immédiatement activée et enregistrée pour l'utilisateur sans envoi d'e-mail de confirmation.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setEmailChangeData(null)}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={isPending}
                  className="bg-blue-600 hover:bg-blue-500 text-white"
                >
                  Valider immédiatement
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          DRAWER: FICHE COLLABORATEUR DÉTAILLÉE
         ======================================================== */}
      {detailCollaboratorId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl h-full bg-neutral-950 border-l border-neutral-800 shadow-2xl p-6 overflow-y-auto space-y-6 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center">
                  {collaboratorDetail?.name?.charAt(0) || "C"}
                </div>
                <div>
                  <h2 className="text-base font-bold text-neutral-100">{collaboratorDetail?.name}</h2>
                  <p className="text-[11px] text-neutral-400">
                    {collaboratorDetail?.employee?.position || "Collaborateur"} • {collaboratorDetail?.role}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDetailCollaboratorId(null);
                  setCollaboratorDetail(null);
                }}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading || !collaboratorDetail ? (
              <div className="py-20 text-center text-xs text-neutral-500">
                Chargement de la fiche collaborateur...
              </div>
            ) : (
              <div className="space-y-6 text-xs">
                {/* 1. Identité */}
                <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                    <span>Identité & Affectation</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-neutral-500">Prénom & Nom :</span>
                      <p className="font-semibold text-neutral-100 mt-0.5">{collaboratorDetail.name}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Poste / Titre :</span>
                      <p className="font-semibold text-neutral-100 mt-0.5">
                        {collaboratorDetail.employee?.position || "Non renseigné"}
                      </p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Département :</span>
                      <p className="text-neutral-200 mt-0.5">
                        {collaboratorDetail.employee?.department ? DEPARTMENT_LABELS[collaboratorDetail.employee.department] || collaboratorDetail.employee.department : "Général"}
                      </p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Numéro de Téléphone :</span>
                      <p className="text-neutral-200 mt-0.5">{collaboratorDetail.phone || "Non renseigné"}</p>
                    </div>
                  </div>
                </div>

                {/* 2. Compte */}
                <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>État du Compte</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-neutral-500">Adresse e-mail :</span>
                      <p className="font-mono text-blue-400 font-semibold mt-0.5">{collaboratorDetail.email}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Vérification E-mail :</span>
                      <p className="mt-0.5 font-bold">
                        {collaboratorDetail.emailVerified ? (
                          <span className="text-emerald-400">✓ Vérifié</span>
                        ) : (
                          <span className="text-amber-400">⚠ En attente</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Statut système :</span>
                      <p className="text-neutral-200 font-bold mt-0.5">{collaboratorDetail.status}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Date d'inscription :</span>
                      <p className="text-neutral-300 mt-0.5">
                        {new Date(collaboratorDetail.createdAt).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Sécurité */}
                <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Sécurité & Accès</span>
                  </h4>
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-neutral-500">Dernière modification mot de passe :</span>
                      <p className="text-neutral-300 mt-0.5">
                        {collaboratorDetail.passwordChangedAt
                          ? new Date(collaboratorDetail.passwordChangedAt).toLocaleString("fr-FR")
                          : "Non modifiée"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTriggerReset(collaboratorDetail.id)}
                      className="text-xs border-neutral-700 hover:bg-neutral-800"
                    >
                      <KeyRound className="w-3.5 h-3.5 mr-1 text-amber-400" />
                      <span>Envoyer lien de réinitialisation</span>
                    </Button>
                  </div>
                </div>

                {/* 4. Activité Récente */}
                <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Activité Récente (Audit Log)</span>
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {collaboratorDetail.auditLogs?.length === 0 ? (
                      <p className="text-neutral-500 text-center py-4">Aucune action enregistrée.</p>
                    ) : (
                      collaboratorDetail.auditLogs?.map((act: any) => (
                        <div
                          key={act.id}
                          className="p-2 rounded-xl bg-neutral-950/80 border border-neutral-800 flex items-center justify-between text-[11px]"
                        >
                          <div>
                            <span className="font-bold text-neutral-200">{act.action}</span>
                            <span className="text-neutral-500 ml-1.5">({act.module})</span>
                          </div>
                          <span className="text-neutral-500 text-[10px]">
                            {new Date(act.createdAt).toLocaleString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
