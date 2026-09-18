"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Layers,
  Users,
  Target,
  Award,
  Plus,
  CheckCircle2,
  TrendingUp,
  X,
  Briefcase,
  Star,
  MessageSquare,
  RefreshCw,
  Flame,
  Clock,
  Sparkles,
  PhoneCall,
  Calendar,
} from "lucide-react";
import {
  createEmployeeGoalAction,
  updateEmployeeGoalAction,
  createPerformanceReviewAction,
  syncGoalsAction,
} from "@/actions/teams";

interface DepartmentData {
  name: string;
  label: string;
  members: {
    id: string;
    userId: string;
    name: string;
    position: string;
    email?: string | null;
    phone?: string | null;
    activeTasksCount: number;
    goals: {
      id: string;
      metric: string;
      targetValue: number;
      achievedValue: number;
    }[];
    reviews: {
      id: string;
      scorePercentage: number;
      feedback?: string | null;
    }[];
  }[];
  activeTasksCount: number;
}

interface GoalItem {
  id: string;
  employeeId: string;
  metric: string;
  targetValue: number;
  achievedValue: number;
  employee: { id: string; firstName: string; lastName: string; position: string };
}

interface ReviewItem {
  id: string;
  scorePercentage: number;
  commercialScore?: number | null;
  technicalScore?: number | null;
  feedback?: string | null;
  reviewDate: Date | string;
  employee: { id: string; firstName: string; lastName: string; position: string };
  reviewer: { id: string; name: string };
}

interface TeamsClientProps {
  month: number;
  year: number;
  departments: DepartmentData[];
  goals: GoalItem[];
  recentReviews: ReviewItem[];
  employeesList: { id: string; name: string; position: string }[];
}

export function TeamsClient({
  month,
  year,
  departments,
  goals,
  recentReviews,
  employeesList,
}: TeamsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab") as "DEPARTMENTS" | "GOALS" | "REVIEWS" | null;

  const [activeTab, setActiveTabState] = useState<"DEPARTMENTS" | "GOALS" | "REVIEWS">(() => {
    if (tabFromUrl && ["DEPARTMENTS", "GOALS", "REVIEWS"].includes(tabFromUrl)) {
      return tabFromUrl;
    }
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("teams_active_tab");
      if (saved && ["DEPARTMENTS", "GOALS", "REVIEWS"].includes(saved)) {
        return saved as any;
      }
    }
    return "DEPARTMENTS";
  });

  const setActiveTab = (tab: "DEPARTMENTS" | "GOALS" | "REVIEWS") => {
    setActiveTabState(tab);
    if (typeof window !== "undefined") {
      localStorage.setItem("teams_active_tab", tab);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  };

  useEffect(() => {
    if (tabFromUrl && ["DEPARTMENTS", "GOALS", "REVIEWS"].includes(tabFromUrl)) {
      setActiveTabState(tabFromUrl);
    }
  }, [tabFromUrl]);

  const [isPending, startTransition] = useTransition();
  const [isSyncing, setIsSyncing] = useState(false);

  // Modals
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // New Goal State
  const [goalEmpId, setGoalEmpId] = useState("");
  const [goalMetric, setGoalMetric] = useState("APPELS");
  const [goalTarget, setGoalTarget] = useState<number>(100);

  // New Review State
  const [revEmpId, setRevEmpId] = useState("");
  const [revScore, setRevScore] = useState<number>(85);
  const [revCommScore, setRevCommScore] = useState<number>(80);
  const [revTechScore, setRevTechScore] = useState<number>(90);
  const [revFeedback, setRevFeedback] = useState("");

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalEmpId || goalTarget <= 0) {
      alert("Champs obligatoires manquants");
      return;
    }

    startTransition(async () => {
      try {
        await createEmployeeGoalAction({
          employeeId: goalEmpId,
          month,
          year,
          metric: goalMetric,
          targetValue: goalTarget,
        });
        setShowGoalModal(false);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur de création de l'objectif");
      }
    });
  };

  const handleUpdateGoalProgress = (id: string, current: number, delta: number) => {
    const nextVal = Math.max(0, current + delta);
    startTransition(async () => {
      try {
        await updateEmployeeGoalAction(id, nextVal);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur");
      }
    });
  };

  const handleSyncGoals = async () => {
    setIsSyncing(true);
    try {
      await syncGoalsAction(month, year);
      router.refresh();
    } catch (err: any) {
      alert("Erreur lors de la synchronisation des objectifs");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revEmpId) {
      alert("Veuillez sélectionner un collaborateur");
      return;
    }

    startTransition(async () => {
      try {
        await createPerformanceReviewAction({
          employeeId: revEmpId,
          scorePercentage: revScore,
          commercialScore: revCommScore,
          technicalScore: revTechScore,
          feedback: revFeedback,
        });
        setShowReviewModal(false);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur d'évaluation");
      }
    });
  };

  const totalMembers = departments.reduce((acc, d) => acc + d.members.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2.5">
            <Layers className="w-7 h-7 text-indigo-400" />
            Organisation des Équipes & Pôles
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Structuration opérationnelle de l'agence, suivi des objectifs mensuels et compétences.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowGoalModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-medium transition"
          >
            <Target className="w-4 h-4 text-indigo-400" /> Fixer Objectif
          </button>
          <button
            onClick={() => setShowReviewModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20"
          >
            <Award className="w-4 h-4" /> Évaluer Performance
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
        <button
          onClick={() => setActiveTab("DEPARTMENTS")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "DEPARTMENTS"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          Pôles de l'Agence ({departments.filter((d) => d.members.length > 0).length})
        </button>
        <button
          onClick={() => setActiveTab("GOALS")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "GOALS"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          Objectifs Mensuels ({goals.length})
        </button>
        <button
          onClick={() => setActiveTab("REVIEWS")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "REVIEWS"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          Évaluations de Compétences ({recentReviews.length})
        </button>
      </div>

      {/* TAB 1: DEPARTMENTS GRID */}
      {activeTab === "DEPARTMENTS" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {departments.map((dept) => (
            <div
              key={dept.name}
              className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm flex flex-col"
            >
              <div className="p-4 bg-neutral-950/60 border-b border-neutral-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-neutral-200 text-sm">{dept.label}</h3>
                  <span className="text-xs text-neutral-400">
                    {dept.members.length} collaborateur{dept.members.length > 1 ? "s" : ""}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-neutral-800 text-xs font-semibold text-neutral-300">
                  {dept.activeTasksCount} tâches en cours
                </span>
              </div>

              <div className="p-4 space-y-3 flex-1 divide-y divide-neutral-800/50">
                {dept.members.length === 0 ? (
                  <div className="py-8 text-center text-xs text-neutral-500">
                    Aucun collaborateur affecté à ce pôle.
                  </div>
                ) : (
                  dept.members.map((m) => (
                    <div key={m.id} className="pt-3 first:pt-0">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-neutral-200 text-sm">
                          {m.name}
                        </div>
                        <span className="text-[11px] text-indigo-400 font-medium">
                          {m.position}
                        </span>
                      </div>

                      {m.phone && (
                        <div className="text-xs text-neutral-400 font-mono mt-0.5">
                          {m.phone}
                        </div>
                      )}

                      {/* Goals snapshot if any */}
                      {m.goals.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {m.goals.map((g) => {
                            const pct = Math.min(
                              100,
                              Math.round((g.achievedValue / g.targetValue) * 100)
                            );
                            return (
                              <div key={g.id} className="text-[11px]">
                                <div className="flex justify-between text-neutral-400">
                                  <span>{g.metric}</span>
                                  <span className="font-mono">
                                    {g.achievedValue} / {g.targetValue} ({pct}%)
                                  </span>
                                </div>
                                <div className="w-full bg-neutral-800 h-1 rounded-full mt-0.5 overflow-hidden">
                                  <div
                                    className="bg-indigo-500 h-full"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: GOALS LIST */}
      {activeTab === "GOALS" && (
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 bg-neutral-950/40 border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-neutral-200">
                  Objectifs Mensuels des Collaborateurs ({month}/{year})
                </span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-400 text-[10px] font-bold border border-emerald-800/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Synchronisation Active ⚡
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Les valeurs réalisées sont calculées en direct d'après les appels, rendez-vous, clients signés et livrables réels.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncGoals}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition disabled:opacity-50 cursor-pointer"
                title="Recalculer en direct depuis les actions réelles"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Calcul..." : "Actualiser"}</span>
              </button>

              <button
                onClick={() => setShowGoalModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-sm shadow-indigo-600/30 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Nouvel Objectif
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 text-xs uppercase font-semibold">
                  <th className="py-3.5 px-4">Collaborateur</th>
                  <th className="py-3.5 px-4">Métrique</th>
                  <th className="py-3.5 px-4 text-center">Cible</th>
                  <th className="py-3.5 px-4 text-center">Réalisé en Direct ⚡</th>
                  <th className="py-3.5 px-4">Progression & Statut</th>
                  <th className="py-3.5 px-4 text-right">Ajuster Manuel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {goals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-neutral-400">
                      Aucun objectif fixé pour ce mois.
                    </td>
                  </tr>
                ) : (
                  goals.map((g) => {
                    const pct = Math.min(
                      100,
                      Math.round((g.achievedValue / g.targetValue) * 100)
                    );
                    const isOver = g.achievedValue > g.targetValue;
                    return (
                      <tr key={g.id} className="hover:bg-neutral-800/30 transition">
                        <td className="py-3 px-4 font-semibold text-neutral-200">
                          <div>{g.employee.firstName} {g.employee.lastName}</div>
                          <div className="text-[11px] text-neutral-400 font-normal">{g.employee.position}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-950/60 text-indigo-400 border border-indigo-800/30">
                            {g.metric}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-neutral-200">
                          {g.targetValue}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">
                          <span className="inline-flex items-center gap-1.5">
                            {g.achievedValue}
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" title="Synchronisé en direct avec la base de données" />
                          </span>
                        </td>
                        <td className="py-3 px-4 w-52">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className={pct >= 100 ? "text-emerald-400 font-bold" : "text-neutral-300 font-bold"}>
                                {pct}%
                              </span>
                              {pct >= 100 ? (
                                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5">
                                  <CheckCircle2 className="w-3 h-3" /> {isOver ? "Dépassement 🚀" : "Atteint 🎯"}
                                </span>
                              ) : pct >= 70 ? (
                                <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-0.5">
                                  <Flame className="w-3 h-3" /> En bonne voie
                                </span>
                              ) : (
                                <span className="text-[10px] text-neutral-400 font-semibold">
                                  En cours
                                </span>
                              )}
                            </div>
                            <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  pct >= 100
                                    ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                                    : pct >= 70
                                    ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                                    : "bg-gradient-to-r from-indigo-500 to-blue-500"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() =>
                                handleUpdateGoalProgress(g.id, g.achievedValue, -1)
                              }
                              title="Diminuer manuellement (-1)"
                              className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold cursor-pointer"
                            >
                              -1
                            </button>
                            <button
                              onClick={() =>
                                handleUpdateGoalProgress(g.id, g.achievedValue, 1)
                              }
                              title="Augmenter manuellement (+1)"
                              className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                            >
                              +1
                            </button>
                            <button
                              onClick={() =>
                                handleUpdateGoalProgress(g.id, g.achievedValue, 5)
                              }
                              title="Augmenter manuellement (+5)"
                              className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                            >
                              +5
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PERFORMANCE REVIEWS */}
      {activeTab === "REVIEWS" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentReviews.length === 0 ? (
              <div className="col-span-full py-12 text-center text-neutral-400 bg-neutral-900/50 border border-neutral-800 rounded-2xl">
                Aucune évaluation de performance enregistrée.
              </div>
            ) : (
              recentReviews.map((r) => (
                <div
                  key={r.id}
                  className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-neutral-200">
                        {r.employee.firstName} {r.employee.lastName}
                      </div>
                      <div className="text-xs text-neutral-400">{r.employee.position}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-black font-mono text-emerald-400">
                        {r.scorePercentage}%
                      </span>
                    </div>
                  </div>

                  {(r.commercialScore !== null || r.technicalScore !== null) && (
                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-neutral-800">
                      {r.commercialScore !== null && (
                        <div>
                          <span className="text-neutral-500">Commercial :</span>{" "}
                          <span className="font-mono font-semibold text-neutral-300">
                            {r.commercialScore}%
                          </span>
                        </div>
                      )}
                      {r.technicalScore !== null && (
                        <div>
                          <span className="text-neutral-500">Technique :</span>{" "}
                          <span className="font-mono font-semibold text-neutral-300">
                            {r.technicalScore}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {r.feedback && (
                    <div className="text-xs text-neutral-300 italic bg-neutral-950/60 p-2.5 rounded-xl border border-neutral-800/80">
                      "{r.feedback}"
                    </div>
                  )}

                  <div className="text-[11px] text-neutral-500 pt-1 flex justify-between">
                    <span>Évalué par {r.reviewer.name}</span>
                    <span>{new Date(r.reviewDate).toLocaleDateString("fr-FR")}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL: NEW GOAL */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <div className="flex items-center gap-2.5">
                <Target className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-neutral-100">
                  Fixer un Objectif Mensuel
                </h3>
              </div>
              <button
                onClick={() => setShowGoalModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Collaborateur *
                </label>
                <select
                  value={goalEmpId}
                  onChange={(e) => setGoalEmpId(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Sélectionner...</option>
                  {employeesList.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.position})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Métrique de Performance *
                </label>
                <select
                  value={goalMetric}
                  onChange={(e) => setGoalMetric(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="APPELS">Nombre d'Appels Passés</option>
                  <option value="RENDEZ_VOUS">Rendez-vous Décrochés</option>
                  <option value="CLIENTS">Nouveaux Clients Closés</option>
                  <option value="CA_DA">Chiffre d'Affaires Généré (DA)</option>
                  <option value="VIDEOS">Vidéos Montées & Livrées</option>
                  <option value="DESIGNS">Créations Graphiques Validées</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Valeur Cible *
                </label>
                <input
                  type="number"
                  min="1"
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(Number(e.target.value))}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowGoalModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isPending ? "Attribution..." : "Valider l'Objectif"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW REVIEW */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <div className="flex items-center gap-2.5">
                <Award className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-neutral-100">
                  Nouvelle Évaluation de Performance
                </h3>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReview} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Collaborateur à Évaluer *
                </label>
                <select
                  value={revEmpId}
                  onChange={(e) => setRevEmpId(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Sélectionner...</option>
                  {employeesList.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.position})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Score Global (%) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={revScore}
                    onChange={(e) => setRevScore(Number(e.target.value))}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-200 font-mono text-center focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Commercial (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={revCommScore}
                    onChange={(e) => setRevCommScore(Number(e.target.value))}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-200 font-mono text-center focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Technique (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={revTechScore}
                    onChange={(e) => setRevTechScore(Number(e.target.value))}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-200 font-mono text-center focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Appréciation & Recommandations
                </label>
                <textarea
                  rows={3}
                  value={revFeedback}
                  onChange={(e) => setRevFeedback(e.target.value)}
                  placeholder="Points forts, axes d'amélioration..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isPending ? "Enregistrement..." : "Valider l'Évaluation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
