"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Repeat,
  Sparkles,
  Layers,
  Calendar,
  CalendarDays,
  DollarSign,
  User,
  Phone,
  Mail,
  MapPin,
  Tag,
  CheckCircle2,
  Clock,
  Plus,
  Flame,
  Check,
  Eye,
  Camera,
  Video,
  Mic,
  FileText,
  ExternalLink,
  PauseCircle,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import { formatCurrency, formatDate, parseClientMedia, normalizeMediaUrl, formatSocialLabel } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { OfferType, TaskStatus, TaskPriority, ClientStatus } from "@prisma/client";
import { WEEKLY_QUOTAS_BY_OFFER } from "@/lib/aiContentGenerator";
import { AiEditorialPlanner } from "@/components/projects/AiEditorialPlanner";
import { createTaskAction, updateTaskStatusAction } from "@/actions/production";
import { updateClientStatusAction } from "@/actions/clients";
import { CLIENT_STATUS_BADGES } from "@/components/abonnements/AbonnementsListView";

interface UserOption {
  id: string;
  name: string;
  role: string;
}

interface AbonnementDetailViewProps {
  client: any;
  users: UserOption[];
}

export function AbonnementDetailView({ client, users }: AbonnementDetailViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"STUDIO_IA" | "TASKS" | "INVOICES">("STUDIO_IA");
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Pack et configuration
  const offerType = (client.offerType as OfferType) || "STARTER";
  const quota = WEEKLY_QUOTAS_BY_OFFER[offerType] || WEEKLY_QUOTAS_BY_OFFER.STARTER;

  // Réseaux sociaux extraits des informations et métadonnées du client
  const { media: clientMedia } = parseClientMedia(client.notes, client);
  const displayInstagram = clientMedia.instagram || client.instagram;
  const displayFacebook = clientMedia.facebook || client.facebook;
  const displayTiktok = clientMedia.tiktok;

  // Tâches agrégées de tous les projets de ce client
  const allTasks: any[] = (client.projects || []).flatMap((p: any) =>
    (p.tasks || []).map((t: any) => ({ ...t, project: p }))
  );

  // Formulaire nouvelle tâche manuelle
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    assigneeId: users[0]?.id || "",
    priority: "MEDIUM" as TaskPriority,
    dueDate: "",
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;

    // Trouver un projet de production ou le premier projet du client
    const targetProject = client.projects?.[0];
    if (!targetProject) return;

    startTransition(async () => {
      await createTaskAction({
        projectId: targetProject.id,
        title: taskForm.title,
        description: taskForm.description,
        assigneeId: taskForm.assigneeId || undefined,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || undefined,
        timeSpentHours: 0,
      });

      setIsTaskModalOpen(false);
      setTaskForm({
        title: "",
        description: "",
        assigneeId: users[0]?.id || "",
        priority: "MEDIUM" as TaskPriority,
        dueDate: "",
      });
      router.refresh();
    });
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    startTransition(async () => {
      await updateTaskStatusAction(taskId, newStatus);
      router.refresh();
    });
  };

  // Gestion du Statut du Client (Actif, Préparation, Suspendu, Contentieux)
  const clientStatus = (client.status as ClientStatus) || "ACTIVE";
  const statusBadge = CLIENT_STATUS_BADGES[clientStatus] || CLIENT_STATUS_BADGES.ACTIVE;
  const StatusIcon = statusBadge.icon;
  const isSuspended = clientStatus === "SUSPENDED";
  const isContentious = clientStatus === "CONTENTIOUS";

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const handleUpdateClientStatus = async (newStatus: ClientStatus) => {
    try {
      setUpdatingStatus(true);
      setStatusFeedback(null);
      await updateClientStatusAction(client.id, newStatus);
      setStatusFeedback(`Statut mis à jour avec succès : ${CLIENT_STATUS_BADGES[newStatus]?.label || newStatus}`);
      router.refresh();
    } catch (err: any) {
      setStatusFeedback(err?.message || "Erreur inattendue");
    } finally {
      setUpdatingStatus(false);
      setTimeout(() => setStatusFeedback(null), 4000);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* BOUTON RETOUR & TITRE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/abonnements"
            className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Retour à la liste des abonnements"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-purple-400">
                Abonnement Mensuel & Studio IA
              </span>
              <span className="text-neutral-600">•</span>
              <span className="text-xs font-mono text-neutral-400">
                {client.code || "CLI-OFFRE"}
              </span>
            </div>
            <h1 className="text-xl font-black text-neutral-100 flex flex-wrap items-center gap-2.5">
              {client.brandName || client.companyName}
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${quota.badgeColor}`}>
                {quota.label}
              </span>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${statusBadge.color}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                <span>{statusBadge.label}</span>
              </span>
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsTaskModalOpen(true)}
            className="bg-purple-600 hover:bg-purple-500 text-white gap-1.5 text-xs shadow-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvelle Tâche Abonnement</span>
          </Button>
        </div>
      </div>

      {/* MESSAGE FEEDBACK DE CHANGEMENT DE STATUT */}
      {statusFeedback && (
        <div className="p-3 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-200 text-xs font-medium flex items-center justify-between animate-fadeIn">
          <span>{statusFeedback}</span>
          <button
            type="button"
            onClick={() => setStatusFeedback(null)}
            className="text-neutral-400 hover:text-white ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* BANNIÈRE D'ALERTE PARTIE SPÉCIALE (SUSPENDU / CONTENTIEUX) */}
      {(isSuspended || isContentious) && (
        <div
          className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl ${
            isSuspended
              ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
              : "bg-rose-500/10 border-rose-500/30 text-rose-200"
          }`}
        >
          <div className="flex items-start gap-3.5">
            <div
              className={`p-2.5 rounded-xl border shrink-0 ${
                isSuspended
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                  : "bg-rose-500/20 border-rose-500/40 text-rose-400"
              }`}
            >
              {isSuspended ? <PauseCircle className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-black/40 border border-current">
                  Partie Spéciale
                </span>
                <span className="text-sm font-bold">
                  {isSuspended ? "Abonnement Actuellement Suspendu" : "Dossier en Contentieux Juridique / Financier"}
                </span>
              </div>
              <p className="text-xs mt-1 text-neutral-300 leading-relaxed max-w-3xl">
                {isSuspended
                  ? "Ce client est actuellement isolé dans la Partie Spéciale des abonnements suite à une mise en pause ou attente de règlement. Sa production et ses quotas sont gelés."
                  : "Ce client fait l'objet d'un litige ou contentieux contractuel. Il est exclu de la flotte active d'abonnements jusqu'à résolution."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-auto">
            <Button
              size="sm"
              disabled={updatingStatus}
              onClick={() => handleUpdateClientStatus("ACTIVE")}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-md cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Réactiver en Actif</span>
            </Button>

            <button
              type="button"
              disabled={updatingStatus}
              onClick={() => handleUpdateClientStatus("IN_PREPARATION")}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>En préparation</span>
            </button>

            {isSuspended ? (
              <button
                type="button"
                disabled={updatingStatus}
                onClick={() => handleUpdateClientStatus("CONTENTIOUS")}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>Transférer Contentieux</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={updatingStatus}
                onClick={() => handleUpdateClientStatus("SUSPENDED")}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Passer en Suspendu</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* BANDEAU CLIENT & RÉCAPITULATIF DU PACK */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Données Client */}
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-base shadow-md shadow-purple-500/20 shrink-0">
              {(client.brandName || client.companyName).charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-neutral-100">
                  {client.companyName}
                </h3>
                {client.brandName && (
                  <span className="text-xs text-neutral-400 font-mono">
                    (Marque : {client.brandName})
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-neutral-400">
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3 text-neutral-500" />
                  {client.sector || "Secteur général"}
                </span>
                {client.wilaya && (
                  <span className="flex items-center gap-1 font-mono">
                    <MapPin className="w-3 h-3 text-neutral-500" />
                    {client.wilaya}
                  </span>
                )}
                {client.phone && (
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="w-3 h-3 text-neutral-500" />
                    {client.phone}
                  </span>
                )}
                {client.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-neutral-500" />
                    {client.email}
                  </span>
                )}
                {displayInstagram && (
                  <a
                    href={normalizeMediaUrl(displayInstagram, "instagram")}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-pink-400 hover:text-pink-300 transition-colors font-mono"
                    title="Instagram du client"
                  >
                    <span>IG: {formatSocialLabel(displayInstagram, "instagram")}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
                {displayFacebook && (
                  <a
                    href={normalizeMediaUrl(displayFacebook, "facebook")}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors font-mono"
                    title="Facebook du client"
                  >
                    <span>FB: {formatSocialLabel(displayFacebook, "facebook")}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
                {displayTiktok && (
                  <a
                    href={normalizeMediaUrl(displayTiktok, "tiktok")}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors font-mono"
                    title="TikTok du client"
                  >
                    <span>TT: {formatSocialLabel(displayTiktok, "tiktok")}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Tarification & Quota */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold">
                Tarif Mensuel (MRR)
              </span>
              <span className="text-base font-extrabold text-emerald-400 font-mono mt-0.5">
                {formatCurrency(Number(client.monthlyFee) || 0)} / mois
              </span>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold">
                Quota Garanti
              </span>
              <span className="text-base font-extrabold text-blue-400 font-mono mt-0.5">
                {quota.weekly} pub{quota.weekly > 1 ? "s" : ""} / sem ({quota.monthly} / mois)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SÉLECTEUR D'ONGLETS PRINCIPAUX */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("STUDIO_IA")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "STUDIO_IA"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Planning Éditorial (Thèmes & Sujets)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("TASKS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "TASKS"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Tâches en Production ({allTasks.length})</span>
        </button>
      </div>

      {/* CONTENU DE L'ONGLET SÉLECTIONNÉ */}
      {activeTab === "STUDIO_IA" ? (
        <AiEditorialPlanner
          client={client}
          project={client.projects?.[0]}
          users={users}
          onTaskCreated={() => router.refresh()}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-200">
              Tâches de Production pour cet Abonnement
            </h3>
            <span className="text-xs text-neutral-400">
              {allTasks.length} tâche{allTasks.length > 1 ? "s" : ""} enregistrée{allTasks.length > 1 ? "s" : ""}
            </span>
          </div>

          {allTasks.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800 text-neutral-400 text-xs space-y-2">
              <p>Aucune tâche créée pour le moment.</p>
              <p className="text-[11px] text-neutral-500">
                Planifiez vos thèmes et sujets dans l'onglet &quot;Planning Éditorial&quot; et cliquez sur &quot;+ Créer la tâche&quot;.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {allTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className={`w-3 h-3 rounded-full mt-1 shrink-0 ${
                        task.status === "COMPLETED" || task.status === "VALIDATED"
                          ? "bg-emerald-500"
                          : task.status === "IN_PROGRESS"
                          ? "bg-blue-500"
                          : "bg-neutral-500"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-neutral-100 truncate">
                        {task.title}
                      </h4>
                      <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-1">
                        {task.description?.split("\n")[0] || "Sans description"}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] text-neutral-500">
                        {task.assignee && (
                          <span className="text-neutral-300 flex items-center gap-1">
                            <User className="w-3 h-3 text-purple-400" />
                            {task.assignee.name}
                          </span>
                        )}
                        {task.dueDate && (
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3" />
                            Échéance : {formatDate(task.dueDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                      className="text-xs bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-neutral-300 focus:outline-none focus:border-purple-500 cursor-pointer"
                    >
                      <option value="TODO">À faire</option>
                      <option value="IN_PROGRESS">En cours</option>
                      <option value="COMPLETED">Terminé</option>
                      <option value="VALIDATED">Validé Client</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL CRÉATION DE TÂCHE MANUELLE */}
      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        title="Créer une tâche pour cet abonnement"
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Titre de la tâche *
            </label>
            <Input
              required
              placeholder="Ex: Maquette Réseaux Sociaux - Promo Fin de Semaine"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Description / Consignes
            </label>
            <textarea
              rows={3}
              placeholder="Détails du livrable, format, consignes de tournage..."
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              className="w-full text-xs bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-neutral-200 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Assigner à
              </label>
              <select
                value={taskForm.assigneeId}
                onChange={(e) => setTaskForm({ ...taskForm, assigneeId: e.target.value })}
                className="w-full text-xs bg-neutral-950 border border-neutral-800 rounded-xl p-2 text-neutral-300 focus:outline-none focus:border-purple-500"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role.replace("_", " ")})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Date d'échéance
              </label>
              <Input
                type="date"
                value={taskForm.dueDate}
                onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                className="text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsTaskModalOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="bg-purple-600 hover:bg-purple-500 text-white"
            >
              Créer la tâche
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
