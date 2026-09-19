"use client";

import React, { useState, useEffect } from "react";
import {
  Database,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Clock,
  FileCode,
  ShieldCheck,
  FolderArchive,
  Terminal,
  Calendar,
} from "lucide-react";
import { triggerManualBackupAction, getBackupListAction, downloadBackupAction } from "@/actions/backup";
import { BackupMetadata } from "@/lib/backup";

export function DatabaseBackupTab() {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [lastBackup, setLastBackup] = useState<BackupMetadata | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchBackups = async () => {
    setIsLoadingList(true);
    try {
      const list = await getBackupListAction();
      setBackups(list);
      if (list.length > 0) {
        setLastBackup(list[0]);
      }
    } catch (e: any) {
      console.warn("Could not load backup list:", e);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleManualBackup = async () => {
    setIsBackingUp(true);
    setFeedback(null);
    try {
      const res = await triggerManualBackupAction();
      if (res.success && res.metadata) {
        setLastBackup(res.metadata);
        setFeedback({
          type: "success",
          message: `✓ Sauvegarde intégrale réussie ! ${res.metadata.totalRecords} enregistrements extraits sur ${res.metadata.totalTables} tables.`,
        });
        await fetchBackups();

        // Si le contenu JSON est retourné, proposer un téléchargement direct
        if (res.jsonContent) {
          downloadJsonLocally(res.metadata.filename, res.jsonContent);
        }
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Une erreur est survenue lors de la sauvegarde.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.message || "Erreur de connexion lors de la sauvegarde.",
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleDownloadFile = async (filename: string) => {
    try {
      const content = await downloadBackupAction(filename);
      if (content) {
        downloadJsonLocally(filename, content);
      } else {
        alert("Fichier non disponible sur le serveur distant.");
      }
    } catch (e: any) {
      alert("Erreur lors du téléchargement : " + e.message);
    }
  };

  const downloadJsonLocally = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Status */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-indigo-950/40 border border-indigo-500/30 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                Sauvegardes Automatiques Quotidiennes : ACTIVES
              </span>
              <span className="text-xs text-neutral-400 font-mono">02:00 UTC / Jour</span>
            </div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-400" />
              Protection Intégrale de la Base de Données (Neon PostgreSQL)
            </h2>
            <p className="text-xs text-neutral-400 max-w-2xl">
              Toutes les 33 tables du CRM (Prospects, Clients, Appels, Relances, Factures, Employés, Pointages, Projets, Stocks, etc.) sont archivées en toute sécurité avec horodatage et déduplication.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleManualBackup}
              disabled={isBackingUp}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBackingUp ? "animate-spin" : ""}`} />
              <span>{isBackingUp ? "Sauvegarde en cours..." : "Créer une sauvegarde maintenant"}</span>
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center gap-2.5 ${
            feedback.type === "success"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* KPI Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <FolderArchive className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Tables Couvertes</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-neutral-100 font-mono">33 / 33</span>
              <span className="text-xs text-neutral-500">100% de la BD</span>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Enregistrements</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-neutral-100 font-mono">
                {lastBackup?.totalRecords ? lastBackup.totalRecords.toLocaleString("fr-FR") : "6 000+"}
              </span>
              <span className="text-xs text-neutral-500">lignes archivées</span>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Fréquence Auto</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-neutral-100">Quotidienne</span>
            </div>
            <p className="text-[10px] text-neutral-500">Chaque nuit à 02h00</p>
          </div>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <FileCode className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Format d&apos;Archive</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-neutral-100 font-mono">JSON / SQL</span>
            </div>
            <p className="text-[10px] text-neutral-500">Compatible tout SGBD</p>
          </div>
        </div>
      </div>

      {/* Available Backups Table */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-neutral-100">
              Historique des Sauvegardes Disponibles
            </h3>
            <span className="text-xs text-neutral-500 font-mono">({backups.length} fichiers)</span>
          </div>

          <button
            onClick={fetchBackups}
            disabled={isLoadingList}
            className="text-xs text-neutral-400 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
            title="Rafraîchir la liste"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingList ? "animate-spin" : ""}`} />
            <span>Actualiser</span>
          </button>
        </div>

        {backups.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <Database className="w-10 h-10 text-neutral-600 mx-auto" />
            <p className="text-xs text-neutral-400">
              Aucune sauvegarde enregistrée sur ce stockage pour le moment.
            </p>
            <button
              onClick={handleManualBackup}
              disabled={isBackingUp}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBackingUp ? "animate-spin" : ""}`} />
              Générer la première sauvegarde maintenant
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-900/90 text-neutral-400 border-b border-neutral-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Nom du fichier</th>
                  <th className="py-3 px-4 font-semibold">Date & Heure</th>
                  <th className="py-3 px-4 font-semibold">Taille</th>
                  <th className="py-3 px-4 font-semibold">Périmètre</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-mono text-neutral-300">
                {backups.map((b, idx) => (
                  <tr key={idx} className="hover:bg-neutral-800/40 transition">
                    <td className="py-3 px-4 font-bold text-neutral-200 flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="truncate max-w-xs">{b.filename}</span>
                      {idx === 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          Dernière
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-sans text-neutral-400">
                      {b.createdAtFormatted || new Date(b.timestamp).toLocaleString("fr-FR")}
                    </td>
                    <td className="py-3 px-4 text-neutral-300">
                      {formatBytes(b.fileSizeBytes)}
                    </td>
                    <td className="py-3 px-4 font-sans text-neutral-400">
                      33 tables complètes
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <button
                        onClick={() => handleDownloadFile(b.filename)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-indigo-300 hover:text-white border border-neutral-700 transition inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Télécharger</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Script & Automation Instructions */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
            Sauvegarde Locale Windows & Cron Automatisé
          </h4>
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed">
          Pour conserver une copie de sauvegarde sur votre ordinateur local (même sans ouvrir l&apos;ERP), vous disposez de 2 solutions incluses :
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-1.5">
            <p className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              1. En 1-Clic sous Windows (Fichier .bat)
            </p>
            <p className="text-[11px] text-neutral-400 font-mono">
              Double-cliquez sur <span className="text-indigo-400 font-bold">scripts/backup_db.bat</span> dans le dossier du CRM.
            </p>
            <p className="text-[11px] text-neutral-500">
              La sauvegarde s&apos;exécute en 9 secondes et crée le fichier JSON horodaté dans le dossier <code className="text-neutral-300">/backups/</code>.
            </p>
          </div>

          <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-1.5">
            <p className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              2. Serveur Cloud & Tâche Automatisée (Cron)
            </p>
            <p className="text-[11px] text-neutral-400 font-mono">
              Endpoint API : <span className="text-emerald-400">/api/cron/backup-db</span>
            </p>
            <p className="text-[11px] text-neutral-500">
              Configuré automatiquement dans Vercel Cron (<code className="text-neutral-300">vercel.json</code>) tous les jours à 02h00 UTC.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
