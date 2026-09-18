import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Synchronisation des données CRM avec Wiam, Meroua, et Toufik...");

  const defaultPasswordHash = await bcrypt.hash("Boostera2026!", 10);

  // 1. Créer ou mettre à jour les 3 commerciaux
  const wiam = await prisma.user.upsert({
    where: { email: "wiam@boostera.dz" },
    update: {
      name: "Wiam (Commerciale)",
      role: Role.SALES_REP,
      isActive: true,
      passwordHash: defaultPasswordHash,
    },
    create: {
      email: "wiam@boostera.dz",
      name: "Wiam (Commerciale)",
      role: Role.SALES_REP,
      phone: "0550 11 22 31",
      passwordHash: defaultPasswordHash,
      isActive: true,
    },
  });

  const meroua = await prisma.user.upsert({
    where: { email: "meroua@boostera.dz" },
    update: {
      name: "Meroua (Commerciale)",
      role: Role.SALES_REP,
      isActive: true,
      passwordHash: defaultPasswordHash,
    },
    create: {
      email: "meroua@boostera.dz",
      name: "Meroua (Commerciale)",
      role: Role.SALES_REP,
      phone: "0550 11 22 32",
      passwordHash: defaultPasswordHash,
      isActive: true,
    },
  });

  const toufik = await prisma.user.upsert({
    where: { email: "toufik@boostera.dz" },
    update: {
      name: "Toufik (Commercial)",
      role: Role.SALES_REP,
      isActive: true,
      passwordHash: defaultPasswordHash,
    },
    create: {
      email: "toufik@boostera.dz",
      name: "Toufik (Commercial)",
      role: Role.SALES_REP,
      phone: "0550 11 22 33",
      passwordHash: defaultPasswordHash,
      isActive: true,
    },
  });

  console.log("✅ Commerciaux confirmés :", wiam.name, meroua.name, toufik.name);

  const team = [wiam, meroua, toufik];

  // 2. Synchroniser les prospects (1926 leads répartis équitablement)
  const allProspects = await prisma.prospect.findMany({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Synchronisation de ${allProspects.length} prospects...`);

  for (let i = 0; i < allProspects.length; i++) {
    const assignedRep = team[i % team.length];
    await prisma.prospect.update({
      where: { id: allProspects[i].id },
      data: { assignedToId: assignedRep.id },
    });
  }
  console.log(`✅ ${allProspects.length} prospects répartis entre Wiam, Meroua et Toufik.`);

  // 3. Synchroniser les appels
  const allCalls = await prisma.call.findMany({
    select: { id: true, prospectId: true },
  });
  console.log(`Synchronisation de ${allCalls.length} appels...`);
  for (let i = 0; i < allCalls.length; i++) {
    const call = allCalls[i];
    if (call.prospectId) {
      const prospect = await prisma.prospect.findUnique({
        where: { id: call.prospectId },
        select: { assignedToId: true },
      });
      if (prospect?.assignedToId) {
        await prisma.call.update({
          where: { id: call.id },
          data: { userId: prospect.assignedToId },
        });
      }
    } else {
      const assignedRep = team[i % team.length];
      await prisma.call.update({
        where: { id: call.id },
        data: { userId: assignedRep.id },
      });
    }
  }
  console.log(`✅ ${allCalls.length} appels synchronisés.`);

  // 4. Synchroniser les relances (FollowUps)
  const allFollowUps = await prisma.followUp.findMany({
    select: { id: true, prospectId: true },
  });
  console.log(`Synchronisation de ${allFollowUps.length} relances...`);
  for (let i = 0; i < allFollowUps.length; i++) {
    const fu = allFollowUps[i];
    if (fu.prospectId) {
      const prospect = await prisma.prospect.findUnique({
        where: { id: fu.prospectId },
        select: { assignedToId: true },
      });
      if (prospect?.assignedToId) {
        await prisma.followUp.update({
          where: { id: fu.id },
          data: { userId: prospect.assignedToId },
        });
      }
    }
  }
  console.log(`✅ ${allFollowUps.length} relances synchronisées.`);

  // 5. Synchroniser les rendez-vous
  const allAppointments = await prisma.appointment.findMany({
    select: { id: true, prospectId: true },
  });
  console.log(`Synchronisation de ${allAppointments.length} rendez-vous...`);
  for (let i = 0; i < allAppointments.length; i++) {
    const appt = allAppointments[i];
    let repId = team[i % team.length].id;
    if (appt.prospectId) {
      const prospect = await prisma.prospect.findUnique({
        where: { id: appt.prospectId },
        select: { assignedToId: true },
      });
      if (prospect?.assignedToId) {
        repId = prospect.assignedToId;
      }
    }
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { userId: repId },
    });
  }
  console.log(`✅ ${allAppointments.length} rendez-vous synchronisés.`);

  // 6. Synchroniser les clients
  const allClients = await prisma.client.findMany({
    select: { id: true },
  });
  console.log(`Synchronisation de ${allClients.length} clients...`);
  for (let i = 0; i < allClients.length; i++) {
    const assignedRep = team[i % team.length];
    await prisma.client.update({
      where: { id: allClients[i].id },
      data: { assignedToId: assignedRep.id },
    });
  }
  console.log(`✅ ${allClients.length} clients synchronisés.`);

  console.log("🎉 Synchronisation terminée avec succès !");
}

main()
  .catch((e) => {
    console.error("❌ Erreur de synchronisation:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
