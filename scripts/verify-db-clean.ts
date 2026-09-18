import { prisma } from "../src/lib/prisma";

async function main() {
  const [
    usersCount,
    employeesCount,
    prospectsCount,
    clientsCount,
    projectsCount,
    invoicesCount,
    paymentsCount,
    appointmentsCount,
    callsCount,
    followUpsCount,
    commissionsCount,
    tasksCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.employee.count(),
    prisma.prospect.count(),
    prisma.client.count(),
    prisma.project.count(),
    prisma.invoice.count(),
    prisma.payment.count(),
    prisma.appointment.count(),
    prisma.call.count(),
    prisma.followUp.count(),
    prisma.commission.count(),
    prisma.projectTask.count(),
  ]);

  const activeUsers = await prisma.user.findMany({
    select: {
      email: true,
      name: true,
      role: true,
    },
    orderBy: { role: "asc" },
  });

  console.log("=== VÉRIFICATION DE LA BASE DE DONNÉES ERP ===");
  console.log({
    utilisateurs_actifs: usersCount,
    collaborateurs_rh: employeesCount,
    prospects: prospectsCount,
    clients: clientsCount,
    projets: projectsCount,
    taches_production: tasksCount,
    factures: invoicesCount,
    paiements: paymentsCount,
    rendez_vous: appointmentsCount,
    appels: callsCount,
    relances: followUpsCount,
    commissions: commissionsCount,
  });

  console.log("\n=== COMPTES UTILISATEURS CONSERVÉS ===");
  activeUsers.forEach((u) => {
    console.log(`- ${u.name} (${u.email}) [${u.role}]`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
