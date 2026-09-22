import { PrismaClient } from "@prisma/client";
import { calculateAndSyncPayroll } from "../src/lib/payroll";

const prisma = new PrismaClient();

async function main() {
  const commDeleted = await prisma.commission.deleteMany({});
  console.log("Commissions deleted:", commDeleted.count);

  const absentDeleted = await prisma.attendance.deleteMany({
    where: { status: "ABSENT" }
  });
  console.log("Absent attendances deleted:", absentDeleted.count);

  const employees = await prisma.employee.findMany();
  for (const emp of employees) {
    await prisma.salaryPayment.updateMany({
      where: { employeeId: emp.id },
      data: {
        commissions: 0,
        deductions: 0,
        primes: 0,
        bonuses: 0,
        netSalary: emp.baseSalary,
      }
    });
  }
  console.log("Salary payments reset to baseSalary");

  await calculateAndSyncPayroll();
  console.log("Payroll recalculated and synced.");

  const payments = await prisma.salaryPayment.findMany();
  console.log("Current payments summary:", payments.map(p => ({
    emp: p.employeeId,
    month: p.month,
    year: p.year,
    base: Number(p.baseSalary),
    comm: Number(p.commissions),
    ded: Number(p.deductions),
    net: Number(p.netSalary)
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
