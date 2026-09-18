"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface ResetOptions {
  resetAttendances?: boolean;
  resetLeaves?: boolean;
  resetSalaryPayments?: boolean;
}

export async function resetCrmDataAction(options: ResetOptions = { resetAttendances: true, resetLeaves: true, resetSalaryPayments: true }) {
  try {
    const results = await prisma.$transaction(async (tx) => {
      // 1. Audit logs & notifications
      const deletedNotifications = await tx.notification.deleteMany();
      const deletedAuditLogs = await tx.auditLog.deleteMany();

      // 2. Payments, Schedules, Invoices
      const deletedPayments = await tx.payment.deleteMany();
      const deletedPaymentSchedules = await tx.paymentSchedule.deleteMany();
      const deletedInvoiceItems = await tx.invoiceItem.deleteMany();
      const deletedInvoices = await tx.invoice.deleteMany();

      // 3. Commissions
      const deletedCommissions = await tx.commission.deleteMany();

      // 4. Projects & Production
      const deletedPurchaseOrders = await tx.purchaseOrder.deleteMany();
      const deletedProjectCosts = await tx.projectCost.deleteMany();
      const deletedDocuments = await tx.document.deleteMany();
      const deletedProjectTasks = await tx.projectTask.deleteMany();
      const deletedProjects = await tx.project.deleteMany();

      // 5. Commercial Activity (Calls, Appointments, FollowUps)
      const deletedCalls = await tx.call.deleteMany();
      const deletedAppointments = await tx.appointment.deleteMany();
      const deletedFollowUps = await tx.followUp.deleteMany();
      const deletedSponsorCampaigns = await tx.sponsorCampaign.deleteMany();

      // 6. Break bidirectional relation between Prospect and Client before deletion
      await tx.prospect.updateMany({
        data: { convertedClientId: null },
      });

      // 7. Clients & Prospects
      const deletedClients = await tx.client.deleteMany();
      const deletedProspects = await tx.prospect.deleteMany();

      // 8. Goals
      const deletedEmployeeGoals = await tx.employeeGoal.deleteMany();

      // 9. Optional HR test data
      let deletedAttendancesCount = 0;
      let deletedLeavesCount = 0;
      let deletedSalariesCount = 0;

      if (options.resetAttendances) {
        const deletedAttendances = await tx.attendance.deleteMany();
        deletedAttendancesCount = deletedAttendances.count;
      }

      if (options.resetLeaves) {
        const deletedLeaves = await tx.leaveRequest.deleteMany();
        deletedLeavesCount = deletedLeaves.count;
      }

      if (options.resetSalaryPayments) {
        const deletedSalaries = await tx.salaryPayment.deleteMany();
        deletedSalariesCount = deletedSalaries.count;
      }

      return {
        prospects: deletedProspects.count,
        clients: deletedClients.count,
        projects: deletedProjects.count,
        projectTasks: deletedProjectTasks.count,
        invoices: deletedInvoices.count,
        invoiceItems: deletedInvoiceItems.count,
        payments: deletedPayments.count,
        paymentSchedules: deletedPaymentSchedules.count,
        appointments: deletedAppointments.count,
        calls: deletedCalls.count,
        followUps: deletedFollowUps.count,
        sponsorCampaigns: deletedSponsorCampaigns.count,
        commissions: deletedCommissions.count,
        documents: deletedDocuments.count,
        projectCosts: deletedProjectCosts.count,
        purchaseOrders: deletedPurchaseOrders.count,
        employeeGoals: deletedEmployeeGoals.count,
        attendances: deletedAttendancesCount,
        leaveRequests: deletedLeavesCount,
        salaryPayments: deletedSalariesCount,
        notifications: deletedNotifications.count,
        auditLogs: deletedAuditLogs.count,
      };
    });

    // Revalidate all CRM routes to clear Next.js cache immediately
    revalidatePath("/", "layout");
    revalidatePath("/prospects");
    revalidatePath("/clients");
    revalidatePath("/projets");
    revalidatePath("/facturation");
    revalidatePath("/abonnements");
    revalidatePath("/agenda");
    revalidatePath("/equipes");
    revalidatePath("/rh");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: results,
    };
  } catch (error: any) {
    console.error("Error during CRM data reset:", error);
    return {
      success: false,
      error: error.message || "Erreur lors de la réinitialisation des données.",
    };
  }
}

export async function getDatabaseStatusAction() {
  try {
    const [
      users,
      employees,
      commissionRules,
      productionTemplates,
      prospects,
      clients,
      projects,
      invoices,
      appointments,
      calls,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.employee.count(),
      prisma.commissionRule.count(),
      prisma.productionTaskTemplate.count(),
      prisma.prospect.count(),
      prisma.client.count(),
      prisma.project.count(),
      prisma.invoice.count(),
      prisma.appointment.count(),
      prisma.call.count(),
    ]);

    return {
      users,
      employees,
      commissionRules,
      productionTemplates,
      prospects,
      clients,
      projects,
      invoices,
      appointments,
      calls,
    };
  } catch (error: any) {
    return { error: error.message };
  }
}
