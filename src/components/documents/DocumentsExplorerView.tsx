"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Search,
  Download,
  ExternalLink,
  Trash2,
  FolderOpen,
  Calendar,
  User,
  HardDrive,
  Film,
  FileCheck,
  Receipt,
  File,
  Filter,
  Layers,
  LayoutGrid,
  List,
} from "lucide-react";
import { formatDate, formatBytes } from "@/lib/utils";
import { DOCUMENT_CATEGORIES } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { uploadDocumentAction, deleteDocumentAction } from "@/actions/documents";

interface ClientOption {
  id: string;
  companyName: string;
}

interface ProjectOption {
  id: string;
  name: string;
  code: string;
}

interface DocumentItem {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  category: string;
  clientId: string | null;
  projectId: string | null;
  createdAt: Date;
  client: {
    id: string;
    companyName: string;
    brandName: string | null;
  } | null;
  project: {
    id: string;
    name: string;
    code: string;
  } | null;
  uploadedBy: {
    id: string;
    name: string;
    role: string;
  } | null;
}

interface DocumentsExplorerViewProps {
  initialData: {
    documents: DocumentItem[];
    totalCount: number;
    totalBytes: number;
    categoriesCount: Record<string, number>;
  };
  clients: ClientOption[];
  projects: ProjectOption[];
}

export function DocumentsExplorerView({
  initialData,
  clients,
  projects,
}: DocumentsExplorerViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [selectedClientId, setSelectedClientId] = useState<string>("ALL");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL");
  const [selectedFileType, setSelectedFileType] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    name: "",
    fileUrl: "",
    fileType: "PDF",
    category: "CONTRACT",
    clientId: "",
    projectId: "",
  });

  // Filtered documents
  const filteredDocs = initialData.documents.filter((d) => {
    if (activeCategory !== "ALL" && d.category !== activeCategory) return false;
    if (selectedClientId !== "ALL" && d.clientId !== selectedClientId) return false;
    if (selectedProjectId !== "ALL" && d.projectId !== selectedProjectId) return false;
    if (selectedFileType !== "ALL" && d.fileType !== selectedFileType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = d.name.toLowerCase().includes(q);
      const matchClient = d.client?.companyName.toLowerCase().includes(q);
      const matchProj = d.project?.name.toLowerCase().includes(q);
      if (!matchName && !matchClient && !matchProj) return false;
    }
    return true;
  });

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.name.trim() || !uploadForm.fileUrl.trim()) return;

    startTransition(async () => {
      await uploadDocumentAction({
        name: uploadForm.name,
        fileUrl: uploadForm.fileUrl,
        fileType: uploadForm.fileType,
        category: uploadForm.category,
        clientId: uploadForm.clientId || undefined,
        projectId: uploadForm.projectId || undefined,
      });
      setIsUploadModalOpen(false);
      setUploadForm({
        name: "",
        fileUrl: "",
        fileType: "PDF",
        category: "CONTRACT",
        clientId: "",
        projectId: "",
      });
      router.refresh();
    });
  };

  const handleDelete = (docId: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce document ?")) return;
    startTransition(async () => {
      await deleteDocumentAction(docId);
      router.refresh();
    });
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "CONTRACT":
        return <FileCheck className="w-4 h-4 text-emerald-400" />;
      case "BRIEF":
        return <FileText className="w-4 h-4 text-blue-400" />;
      case "MEDIA":
        return <Film className="w-4 h-4 text-purple-400" />;
      case "INVOICE":
        return <Receipt className="w-4 h-4 text-amber-400" />;
      default:
        return <File className="w-4 h-4 text-neutral-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
              Centre de Gestion Documentaire
            </h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Classement et accès rapide aux contrats, briefs créatifs, devis, médias et livrables.
          </p>
        </div>

        <Button onClick={() => setIsUploadModalOpen(true)} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          <span>Ajouter un Document</span>
        </Button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80">
          <span className="text-[11px] font-medium text-neutral-400">Total Fichiers</span>
          <p className="text-2xl font-extrabold text-neutral-100 mt-0.5">
            {initialData.totalCount}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80">
          <span className="text-[11px] font-medium text-blue-400 flex items-center gap-1.5">
            <HardDrive className="w-3 h-3" />
            Volume Stocké
          </span>
          <p className="text-2xl font-extrabold text-blue-300 mt-0.5 truncate">
            {formatBytes(initialData.totalBytes)}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80">
          <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1.5">
            <FileCheck className="w-3 h-3" />
            Contrats Signés
          </span>
          <p className="text-2xl font-extrabold text-emerald-300 mt-0.5">
            {initialData.categoriesCount.CONTRACT || 0}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80">
          <span className="text-[11px] font-medium text-purple-400 flex items-center gap-1.5">
            <Film className="w-3 h-3" />
            Livrables Médias
          </span>
          <p className="text-2xl font-extrabold text-purple-300 mt-0.5">
            {initialData.categoriesCount.MEDIA || 0}
          </p>
        </div>
      </div>

      {/* Category Pills Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveCategory("ALL")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
            activeCategory === "ALL"
              ? "bg-neutral-800 text-white border border-neutral-700 shadow-sm"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60 border border-transparent"
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span>Tous les documents</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-700 text-neutral-200 font-mono">
            {initialData.totalCount}
          </span>
        </button>

        {Object.entries(DOCUMENT_CATEGORIES).map(([key, item]) => {
          const count = initialData.categoriesCount[key] || 0;
          const isActive = activeCategory === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveCategory(key)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? "bg-neutral-800 text-white border border-neutral-700 shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60 border border-transparent"
              }`}
            >
              {getCategoryIcon(key)}
              <span>{item.label}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-850 text-neutral-400 font-mono">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Rechercher un document, client ou projet..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="h-8 px-2.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-300 focus:outline-none focus:border-blue-500 max-w-[180px] truncate cursor-pointer"
          >
            <option value="ALL">Tous les clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>

          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="h-8 px-2.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-300 focus:outline-none focus:border-blue-500 max-w-[180px] truncate cursor-pointer"
          >
            <option value="ALL">Tous les projets</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>

          <select
            value={selectedFileType}
            onChange={(e) => setSelectedFileType(e.target.value)}
            className="h-8 px-2.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">Tous formats</option>
            <option value="PDF">PDF</option>
            <option value="IMAGE">Images (PNG, JPG)</option>
            <option value="VIDEO">Vidéos (MP4)</option>
            <option value="EXCEL">Tableurs</option>
            <option value="OTHER">Autres</option>
          </select>
        </div>

        <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
              viewMode === "grid" ? "bg-neutral-800 text-white shadow-xs" : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
              viewMode === "table" ? "bg-neutral-800 text-white shadow-xs" : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Documents Grid / Table */}
      {filteredDocs.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800/60 space-y-3">
          <FolderOpen className="w-10 h-10 text-neutral-600 mx-auto" />
          <h3 className="text-sm font-semibold text-neutral-300">Aucun document trouvé</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            Aucun fichier ne correspond à vos filtres actuels.
          </p>
          <Button onClick={() => setIsUploadModalOpen(true)} variant="outline" size="sm" className="mt-2">
            Ajouter un document
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-900 transition-all flex flex-col justify-between space-y-3 group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {getCategoryIcon(doc.category)}
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300">
                      {doc.fileType}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(doc.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-neutral-500 hover:text-rose-400 rounded cursor-pointer"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-neutral-100 line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors">
                    {doc.name}
                  </h4>

                  {doc.client && (
                    <span className="text-[10px] text-neutral-400 block truncate mt-1">
                      Client : {doc.client.companyName}
                    </span>
                  )}
                  {doc.project && (
                    <Link
                      href={`/projets/${doc.project.id}`}
                      className="text-[10px] text-blue-400 hover:underline block truncate"
                    >
                      Projet : {doc.project.code}
                    </Link>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-800/60 space-y-2">
                <div className="flex items-center justify-between text-[10px] text-neutral-500">
                  <span>{formatBytes(doc.fileSize)}</span>
                  <span>{formatDate(doc.createdAt)}</span>
                </div>

                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Consulter</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950/70 border-b border-neutral-800 text-[11px] font-semibold text-neutral-400 uppercase">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">Client / Projet</th>
                <th className="px-4 py-3">Format & Taille</th>
                <th className="px-4 py-3">Ajouté par</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-neutral-800/30">
                  <td className="px-4 py-3">
                    <span className="font-semibold text-neutral-200">{doc.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-neutral-300">
                      {getCategoryIcon(doc.category)}
                      <span>{doc.category}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-300">
                    {doc.client && <div>{doc.client.companyName}</div>}
                    {doc.project && (
                      <div className="text-[10px] text-blue-400">{doc.project.code}</div>
                    )}
                    {!doc.client && !doc.project && (
                      <span className="text-neutral-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    {doc.fileType} • {formatBytes(doc.fileSize)}
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    {doc.uploadedBy?.name || "Système"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-blue-400 hover:text-blue-300"
                        title="Consulter"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        className="p-1.5 text-neutral-500 hover:text-rose-400"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Upload Document */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Ajouter un Document au Centre Documentaire"
        description="Associez le fichier à un client ou à un projet pour un classement centralisé."
      >
        <form onSubmit={handleUploadSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Nom du document *</label>
            <Input
              placeholder="Ex: Contrat Signé SARL Vigie, Brief Créatif Campagne..."
              value={uploadForm.name}
              onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Lien / URL du fichier *</label>
            <Input
              placeholder="https://drive.google.com/... ou lien de stockage"
              value={uploadForm.fileUrl}
              onChange={(e) => setUploadForm({ ...uploadForm, fileUrl: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Catégorie</label>
              <select
                value={uploadForm.category}
                onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                className="w-full h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="CONTRACT">Contrat & Accord</option>
                <option value="BRIEF">Brief & Cahier des charges</option>
                <option value="MEDIA">Livrables Médias (Photo / Vidéo)</option>
                <option value="INVOICE">Facture & Devis</option>
                <option value="HR">Document RH</option>
                <option value="OTHER">Autre</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Format</label>
              <select
                value={uploadForm.fileType}
                onChange={(e) => setUploadForm({ ...uploadForm, fileType: e.target.value })}
                className="w-full h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="PDF">PDF</option>
                <option value="VIDEO">Vidéo (MP4, MOV)</option>
                <option value="IMAGE">Image (PNG, JPG)</option>
                <option value="EXCEL">Tableur (Excel / Sheets)</option>
                <option value="OTHER">Autre format</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Client rattaché</label>
              <select
                value={uploadForm.clientId}
                onChange={(e) => setUploadForm({ ...uploadForm, clientId: e.target.value })}
                className="w-full h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">Aucun client spécifique</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Projet rattaché</label>
              <select
                value={uploadForm.projectId}
                onChange={(e) => setUploadForm({ ...uploadForm, projectId: e.target.value })}
                className="w-full h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">Aucun projet spécifique</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsUploadModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Ajout..." : "Enregistrer le Document"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
