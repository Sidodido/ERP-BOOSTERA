import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getStocksAndAssetsAction } from "@/actions/stocks";
import { StocksClient } from "@/components/stocks/StocksClient";

export default async function StocksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  redirect("/dashboard");
}
