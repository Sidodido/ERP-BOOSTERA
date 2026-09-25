"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  RefreshCw,
  GitBranch,
  Database,
  Server,
  CheckCircle2,
  AlertTriangle,
  ArrowDownCircle,
  ExternalLink,
  Cpu,
  Layers,
  Sparkles,
  Terminal,
  FileCode,
  ShieldCheck,
  FolderGit2,
} from "lucide-react";
import {
  getSystemStatusAction,
  deploySystemUpdateAction,
  checkRemoteUpdatesAction,
  type SystemStatus,
  type DeploymentLog,
} from "@/actions/systemUpdates";

export function SystemUpdatesTab() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeploying, startDeploy] = useTransition();
  const [isChecking, startChecking] = useTransition();
  const [remoteCheck, setRemoteCheck] = useState<{
    hasUpdates: boolean;
    pendingCount: number;
    commits: string[];
    message: string;
  } | null>(null);
  const [deploymentLogs, setDeploymentLogs] = useState<DeploymentLog[] | null>(null);
  const [deployResult, setDeployResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const data = await getSystemStatusAction();
      setStatus(data);
    } catch (err) {
      console.error("Erreur récupération statut système:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleCheckUpdates = () => {
    startChecking(async () => {
      try {
        const res = await checkRemoteUpdatesAction();
        setRemoteCheck(res);
      } catch (err: any) {
        setRemoteCheck({
          hasUpdates: false,
          pendingCount: 0,
          commits: [],
          message: err.message || "Erreur de communication avec GitHub",
        });
      }
    });
  };

  const handleDeploy = (options = { pullFromGit: true, syncDatabase: true, clearCache: true }) => {
    if (!confirm("Voulez-vous lancer le déploiement de la mise à jour maintenant ? Le code, la base de données et le cache seront synchronisés.")) {
      return;
    }

    startDeploy(async () => {
      setDeployResult(null);
      setDeploymentLogs(null);
      try {
        const res = await deploySystemUpdateAction(options);
        setDeploymentLogs(res.logs);
        if (res.success) {
          setDeployResult({
            success: true,
            message: "Déploiement terminé avec succès ! Toutes les nouvelles sections et outils sont actifs.",
          });
          await fetchStatus();
          setRemoteCheck(null);
        } else {
          setDeployResult({
            success: false,
            message: res.error || "Une erreur est survenue durant le déploiement.",
          });
        }
      } catch (err: any) {
        setDeployResult({
          success: false,
          message: err.message || "Erreur système inattendue.",
        });
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Top Banner / Actions */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-indigo-950/40 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-3.5 h-3.5" /> Centre de Déploiement & Mises à Jour
            </div>
            <h2 className="text-2xl font-bold text-neutral-100 flex items-center gap-2.5">
              Mise à jour rapide de l'ERP Boostera
            </h2>
            <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed">
              Lorsque vous développez ou ajoutez de nouveaux outils, sections ou modèles, déployez-les en 1 clic
              sans coupure de service. Le système synchronise automatiquement le code, met à jour la base de données
              et rafraîchit le cache en direct.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleCheckUpdates}
              disabled={isChecking || isDeploying}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-neutral-700 bg-neutral-800/80 text-neutral-200 hover:bg-neutral-800 hover:text-white transition flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? "animate-spin text-indigo-400" : ""}`} />
              {isChecking ? "Vérification..." : "Vérifier sur GitHub"}
            </button>

            <button
              onClick={() => handleDeploy({ pullFromGit: true, syncDatabase: true, clearCache: true })}
              disabled={isDeploying}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 disabled:opacity-50"
            >
              <ArrowDownCircle className={`w-4 h-4 ${isDeploying ? "animate-spin" : ""}`} />
              {isDeploying ? "Déploiement en cours..." : "Déployer la mise à jour (1-Clic)"}
            </button>
          </div>
        </div>
      </div>

      {/* Remote updates alert if found */}
      {remoteCheck && (
        <div
          className={`border rounded-2xl p-5 ${
            remoteCheck.hasUpdates
              ? "bg-amber-950/20 border-amber-500/30 text-amber-200"
              : "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
          }`}
        >
          <div className="flex items-start gap-3.5">
            {remoteCheck.hasUpdates ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <h4 className="font-semibold text-sm">
                {remoteCheck.hasUpdates
                  ? `Mises à jour détectées (${remoteCheck.pendingCount} commit(s) en attente)`
                  : "Votre ERP est parfaitement synchronisé !"}
              </h4>
              <p className="text-xs text-neutral-300 mt-1">{remoteCheck.message}</p>
              {remoteCheck.commits.length > 0 && (
                <div className="mt-3 space-y-1.5 bg-neutral-900/60 p-3 rounded-xl border border-neutral-800 text-xs font-mono">
                  {remoteCheck.commits.map((c, i) => (
                    <div key={i} className="text-neutral-300">
                      • {c}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {remoteCheck.hasUpdates && (
              <button
                onClick={() => handleDeploy({ pullFromGit: true, syncDatabase: true, clearCache: true })}
                disabled={isDeploying}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-neutral-950 transition shrink-0"
              >
                Installer maintenant
              </button>
            )}
          </div>
        </div>
      )}

      {/* Deployment Result Alert */}
      {deployResult && (
        <div
          className={`border rounded-2xl p-5 ${
            deployResult.success
              ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
              : "bg-rose-950/20 border-rose-500/30 text-rose-200"
          }`}
        >
          <div className="flex items-center gap-3">
            {deployResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            )}
            <div className="flex-1 font-semibold text-sm">{deployResult.message}</div>
          </div>
        </div>
      )}

      {/* Deployment Logs Stream */}
      {deploymentLogs && deploymentLogs.length > 0 && (
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            Journal d'exécution du déploiement
          </h3>
          <div className="space-y-2">
            {deploymentLogs.map((log, index) => (
              <div
                key={index}
                className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800 text-xs flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                    {log.status === "SUCCESS" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : log.status === "WARNING" ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    )}
                    {log.step}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      log.status === "SUCCESS"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : log.status === "WARNING"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-rose-500/10 text-rose-400"
                    }`}
                  >
                    {log.status}
                  </span>
                </div>
                <p className="text-neutral-400">{log.message}</p>
                {log.output && (
                  <pre className="mt-1 p-2 rounded bg-black/50 text-[11px] font-mono text-neutral-300 overflow-x-auto">
                    {log.output}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Version Card */}
        <div className="bg-neutral-900/60 border border-neutral-800 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400">Version Système</span>
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Cpu className="w-4 h-4" />
            </span>
          </div>
          <div className="text-lg font-bold text-neutral-100">{status?.version || "v1.2.5"}</div>
          <div className="text-xs text-neutral-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Mode Production Opérationnel
          </div>
        </div>

        {/* Git Branch Card */}
        <div className="bg-neutral-900/60 border border-neutral-800 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400">Dépôt & Branche Git</span>
            <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
              <GitBranch className="w-4 h-4" />
            </span>
          </div>
          <div className="text-lg font-bold text-neutral-100 font-mono">
            {status?.gitBranch || "main"}
          </div>
          <div className="text-xs text-neutral-400 truncate" title={status?.gitRemote}>
            {status?.gitRemote ? "GitHub: " + status.gitRemote.split("/").slice(-2).join("/") : "Git connecté"}
          </div>
        </div>

        {/* Database Status Card */}
        <div className="bg-neutral-900/60 border border-neutral-800 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400">Base de Données</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Database className="w-4 h-4" />
            </span>
          </div>
          <div className="text-lg font-bold text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5" /> PostgreSQL
          </div>
          <div className="text-xs text-neutral-400">
            Prisma ORM synchronisé
          </div>
        </div>

        {/* Runtime Card */}
        <div className="bg-neutral-900/60 border border-neutral-800 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400">Moteur d'Exécution</span>
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Server className="w-4 h-4" />
            </span>
          </div>
          <div className="text-lg font-bold text-neutral-100">Next.js 16 + Bun</div>
          <div className="text-xs text-neutral-400">
            Turbopack & Server Actions actifs
          </div>
        </div>
      </div>

      {/* Latest Commit Details */}
      {status?.lastCommit && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-purple-400" />
            Dernière mise à jour appliquée au système
          </h3>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-neutral-950/60 rounded-xl border border-neutral-800/80 text-xs">
            <div className="space-y-1">
              <span className="font-mono text-indigo-400 font-semibold mr-2">[{status.lastCommit.hash}]</span>
              <span className="text-neutral-200 font-medium">{status.lastCommit.message}</span>
            </div>
            <div className="text-neutral-400 text-[11px] shrink-0">
              Par {status.lastCommit.author} ({status.lastCommit.date})
            </div>
          </div>
        </div>
      )}

      {/* Guide : How to add tools and deploy */}
      <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-6 space-y-5">
        <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2.5">
          <FileCode className="w-5 h-5 text-indigo-400" />
          Guide : Comment ajouter un nouvel outil ou une section et la déployer ?
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2">
            <div className="w-7 h-7 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-500/20">
              1
            </div>
            <h4 className="font-semibold text-sm text-neutral-200">Créer l'outil ou la page</h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Ajoutez votre nouvelle page dans <code className="text-indigo-300">src/app/votre-outil/page.tsx</code> et
              son composant client. Si nécessaire, ajoutez vos tables dans <code className="text-indigo-300">prisma/schema.prisma</code>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2">
            <div className="w-7 h-7 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-500/20">
              2
            </div>
            <h4 className="font-semibold text-sm text-neutral-200">Envoyer sur GitHub</h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Depuis votre terminal ou VSCode, enregistrez vos modifications :
              <br />
              <code className="text-[11px] bg-black/40 px-1 py-0.5 rounded text-neutral-300 mt-1 inline-block">
                git add . && git commit -m "nouvel outil" && git push
              </code>
            </p>
          </div>

          <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2">
            <div className="w-7 h-7 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-500/20">
              3
            </div>
            <h4 className="font-semibold text-sm text-neutral-200">Déployer en 1 Clic</h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Revenez sur cette page et cliquez sur <strong>"Déployer la mise à jour (1-Clic)"</strong>. Le système
              télécharge le code, met à jour la base de données et active la nouvelle section immédiatement !
            </p>
          </div>
        </div>

        {/* Local Scripts notice */}
        <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-neutral-300">
          <div className="space-y-1">
            <span className="font-semibold text-neutral-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Scripts de déploiement en 1-clic disponibles à la racine :
            </span>
            <p className="text-neutral-400">
              Vous pouvez aussi double-cliquer directement sur <code className="text-emerald-400">deploy-update.bat</code> (Windows) ou exécuter <code className="text-emerald-400">deploy-update.ps1</code>.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleDeploy({ pullFromGit: false, syncDatabase: true, clearCache: true })}
              disabled={isDeploying}
              className="px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition"
            >
              Forcer DB Push
            </button>
            <button
              onClick={() => handleDeploy({ pullFromGit: false, syncDatabase: false, clearCache: true })}
              disabled={isDeploying}
              className="px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition"
            >
              Vider le Cache
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
