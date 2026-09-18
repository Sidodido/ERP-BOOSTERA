import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("⏱️ Testing query performance...");

  // Benchmark 1: Current heavy query
  const start1 = performance.now();
  const res1 = await prisma.prospect.findMany({
    include: {
      assignedTo: { select: { id: true, name: true, role: true } },
      _count: {
        select: { calls: true, appointments: true, followUps: true },
      },
      appointments: {
        select: { id: true, startTime: true, title: true, status: true },
        take: 1,
        orderBy: { startTime: "desc" },
      },
      calls: {
        select: { id: true, result: true, calledAt: true, comment: true },
        take: 1,
        orderBy: { calledAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const time1 = performance.now() - start1;
  console.log(`Original getProspects() (${res1.length} rows): ${time1.toFixed(1)}ms`);

  // Benchmark 2: Optimized query
  const start2 = performance.now();
  const [prospects, apptIds] = await Promise.all([
    prisma.prospect.findMany({
      select: {
        id: true,
        companyName: true,
        contactName: true,
        phone: true,
        email: true,
        sector: true,
        wilaya: true,
        address: true,
        status: true,
        rawState: true,
        source: true,
        notes: true,
        prospectionDate: true,
        callStatus: true,
        response: true,
        assignedToId: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        assignedTo: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.appointment.findMany({
      where: { prospectId: { not: null } },
      select: { prospectId: true },
      distinct: ["prospectId"],
    }),
  ]);
  const time2 = performance.now() - start2;
  console.log(`Optimized getProspects() (${prospects.length} rows): ${time2.toFixed(1)}ms`);

  // Benchmark 3: getFollowUps() current
  const start3 = performance.now();
  const fu1 = await prisma.followUp.findMany({
    include: {
      prospect: {
        select: {
          id: true,
          companyName: true,
          contactName: true,
          phone: true,
          sector: true,
          wilaya: true,
        },
      },
      user: { select: { id: true, name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });
  const time3 = performance.now() - start3;
  console.log(`Original getFollowUps() (${fu1.length} rows): ${time3.toFixed(1)}ms`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
