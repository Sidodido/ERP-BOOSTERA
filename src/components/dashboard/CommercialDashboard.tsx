"use client";

import React from "react";
import Link from "next/link";
import {
  Target,
  PhoneCall,
  Calendar,
  Clock,
  Users,
  TrendingUp,
  PlusCircle,
  PhoneOutgoing,
  ArrowUpRight,
  ExternalLink,
  MessageCircle,
  CheckCircle2,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/utils";
import { trackCommunicationClick } from "@/lib/tracking";
import type { DashboardMetricsResult } from "@/actions/dashboard";
import { DailyAttendanceWidget } from "@/components/attendance/DailyAttendanceWidget";
import { MonthlyGoalsWidget } from "@/components/dashboard/MonthlyGoalsWidget";

interface CommercialDashboardProps {
  metrics: DashboardMetricsResult;
  userName?: string;
}

export function CommercialDashboard({ metrics, userName }: CommercialDashboardProps) {
  const data = metrics.commercialData || {
    myProspectsCount: metrics.totalProspects,
    myNewProspectsCount: metrics.newProspects,
    myInterestedProspectsCount: metrics.interestedProspects,
    myConvertedProspectsCount: metrics.convertedProspects,
    myCallsToday: metrics.callsToday,
    myCallsTotal: metrics.totalCalls,
    myUpcomingAppointmentsCount: metrics.upcomingAppointments,
    myPendingFollowUpsCount: 0,
    myActiveClientsCount: metrics.activeClients,
    myConversionRate: metrics.conversionRate,
    upcomingAppointmentsList: [],
    pendingFollowUpsList: [],
    recentProspectsList: [],
  };

  const currentDate = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-neutral-900 to-indigo-950/30 border border-blue-500/20 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-wider border border-blue-500/30">
              Espace Commercial
            </span>
            <span className="text-xs text-neutral-400 capitalize">{currentDate}</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-100 mt-1 flex items-center gap-2">
            Bonjour {userName || "Commercial"} 👋
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Suivi personnalisé de votre prospection, appels du jour, rendez-vous et relances clients.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/prospection?modal=new">
            <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25 cursor-pointer">
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Nouveau Prospect</span>
            </Button>
          </Link>
          <Link href="/appels">
            <Button variant="secondary" size="sm" className="gap-1.5 border-neutral-700 cursor-pointer">
              <PhoneOutgoing className="w-3.5 h-3.5 text-emerald-400" />
              <span>Journal Appels</span>
            </Button>
          </Link>
          <Link href="/rendez-vous">
            <Button variant="outline" size="sm" className="gap-1.5 border-neutral-700 cursor-pointer">
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              <span>Rendez-vous</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Pointage Quotidien */}
      <DailyAttendanceWidget />

      {/* Objectifs Mensuels (Personnels ou de l'Équipe pour l'Admin) */}
      <MonthlyGoalsWidget
        goals={
          metrics.isAdmin && metrics.allTeamGoals && metrics.allTeamGoals.length > 0
            ? metrics.allTeamGoals
            : metrics.myMonthlyGoals || []
        }
        userName={userName}
        showAdminLink={metrics.isAdmin}
        title={
          metrics.isAdmin && metrics.allTeamGoals && metrics.allTeamGoals.length > 0
            ? "Objectifs Mensuels des Collaborateurs (Équipe)"
            : "Mes Objectifs du Mois"
        }
        subtitle="Suivi en direct des objectifs de chaque collaborateur synchronisés avec leurs actions réelles."
        showEmployeeBadge={Boolean(metrics.isAdmin && metrics.allTeamGoals && metrics.allTeamGoals.length > 0)}
      />

      {/* Row 1: Key Commercial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <KpiCard
          title="Mes Prospects"
          value={data.myProspectsCount}
          subtitle={`${data.myNewProspectsCount} nouveaux • ${data.myInterestedProspectsCount} intéressés`}
          icon={Target}
          color="blue"
        />

        <KpiCard
          title="Appels du Jour"
          value={data.myCallsToday}
          subtitle={`${data.myCallsTotal} appels au total`}
          icon={PhoneCall}
          color="emerald"
        />

        <KpiCard
          title="Rendez-vous à venir"
          value={data.myUpcomingAppointmentsCount}
          subtitle="Visites & Visio clients"
          icon={Calendar}
          color="purple"
        />

        <KpiCard
          title="Relances à traiter"
          value={data.myPendingFollowUpsCount}
          subtitle="Rappels programmés"
          icon={Clock}
          color="amber"
        />

        <KpiCard
          title="Clients Signés"
          value={data.myActiveClientsCount}
          subtitle={`Taux conversion : ${data.myConversionRate}%`}
          icon={TrendingUp}
          color="indigo"
        />
      </div>

      {/* Row 2: Two Interactive Columns (Agenda RDV/Relances & Derniers Prospects) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agenda & Prochains Rendez-vous */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-neutral-100">
                Prochains Rendez-vous ({data.upcomingAppointmentsList.length})
              </h3>
            </div>
            <Link
              href="/rendez-vous"
              className="text-xs text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1 font-medium"
            >
              <span>Tout voir</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {data.upcomingAppointmentsList.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-neutral-950/40 border border-neutral-800/80">
                <Calendar className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                <p className="text-xs text-neutral-400 font-medium">Aucun rendez-vous planifié.</p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Planifiez un rendez-vous depuis la file d'appels ou la fiche prospect.
                </p>
              </div>
            ) : (
              data.upcomingAppointmentsList.map((appt) => (
                <div
                  key={appt.id}
                  className="p-3.5 bg-neutral-950/60 border border-neutral-800/80 rounded-xl hover:border-purple-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                        {appt.type === "COMMERCIAL_VISIT"
                          ? "Visite physique"
                          : appt.type === "VIDEO"
                          ? "Visio"
                          : "Téléphone"}
                      </span>
                      <span className="text-xs font-bold text-neutral-200 truncate">
                        {appt.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 truncate">
                      {appt.companyName || "Entreprise"}
                      {appt.contactName && ` • ${appt.contactName}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <span className="text-[11px] text-neutral-400 font-mono">
                      {formatDateTime(appt.startTime)}
                    </span>
                    {appt.phone && (
                      <a
                        href={`tel:${appt.phone}`}
                        onClick={() => {
                          trackCommunicationClick({
                            type: "PHONE",
                            targetName: appt.companyName || appt.contactName,
                            phone: appt.phone,
                            entityType: "APPOINTMENT",
                            entityId: appt.id,
                          });
                        }}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                        title={`Appeler ${appt.phone}`}
                      >
                        <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Relances du jour */}
          {data.pendingFollowUpsList.length > 0 && (
            <div className="pt-3 border-t border-neutral-800/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Relances en attente ({data.pendingFollowUpsList.length})</span>
                </div>
                <Link
                  href="/relances"
                  className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                >
                  <span>Gérer</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="space-y-2">
                {data.pendingFollowUpsList.slice(0, 3).map((fol) => (
                  <div
                    key={fol.id}
                    className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs flex items-center justify-between"
                  >
                    <span className="text-neutral-200 font-medium truncate">
                      Relance #{fol.stepNumber} ({fol.companyName || "Prospect"})
                    </span>
                    <span className="text-[10px] text-amber-400/80 font-mono shrink-0 ml-2">
                      {new Date(fol.scheduledAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Mes Derniers Prospects Qualifiés */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-neutral-100">
                Derniers Prospects Qualifiés ({data.recentProspectsList.length})
              </h3>
            </div>
            <Link
              href="/prospection"
              className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 font-medium"
            >
              <span>File Prospection</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {data.recentProspectsList.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-neutral-950/40 border border-neutral-800/80">
                <Target className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                <p className="text-xs text-neutral-400 font-medium">Aucun prospect assigné.</p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Importez ou créez votre premier prospect dès maintenant.
                </p>
              </div>
            ) : (
              data.recentProspectsList.map((p) => {
                const isInterested = p.status === "INTERESTED";
                const isConverted = p.status === "CONVERTED";

                return (
                  <div
                    key={p.id}
                    className="p-3.5 bg-neutral-950/60 border border-neutral-800/80 rounded-xl hover:border-blue-500/40 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-200 truncate">
                          {p.companyName}
                        </span>
                        {p.wilaya && (
                          <span className="text-[10px] text-neutral-500 bg-neutral-900 px-1.5 py-0.2 rounded border border-neutral-800">
                            {p.wilaya}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate">
                        {p.contactName || "Sans contact"}
                        {p.sector && ` • ${p.sector}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isConverted
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                            : isInterested
                            ? "bg-blue-500/15 border-blue-500/30 text-blue-300"
                            : "bg-neutral-800 border-neutral-700 text-neutral-400"
                        }`}
                      >
                        {isConverted
                          ? "Converti"
                          : isInterested
                          ? "Intéressé"
                          : p.callStatus || "En cours"}
                      </span>

                      {p.phone && (
                        <a
                          href={`tel:${p.phone}`}
                          onClick={() => {
                            trackCommunicationClick({
                              type: "PHONE",
                              targetName: p.companyName || p.contactName,
                              phone: p.phone,
                              entityType: "PROSPECT",
                              entityId: p.id,
                            });
                          }}
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                          title={`Appeler ${p.phone}`}
                        >
                          <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-2">
            <Link href="/base-prospects">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs text-neutral-300 border-neutral-800 hover:bg-neutral-800/60 cursor-pointer"
              >
                <span>Accéder à la Base Prospects Complète</span>
                <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
