import React from "react";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import SuperAdminLogsTable from "./logs-table";

export const dynamic = "force-dynamic";

export default async function SuperAdminLogsPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || (session.user as any).role !== "SUPER_ADMIN") redirect("/sign-in");

    const t = await getTranslations("superAdminDashboard");

    const logs = await prisma.auditLog.findMany({
        take: 200,
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            logNumber: true,
            action: true,
            details: true,
            userId: true,
            agencyId: true,
            createdAt: true,
        },
    });

    const userIds = Array.from(new Set(logs.map((log) => log.userId).filter(Boolean))) as string[];
    const agencyIds = Array.from(new Set(logs.map((log) => log.agencyId).filter(Boolean))) as string[];

    const [users, agencies] = await Promise.all([
        userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, role: true, email: true } }) : [],
        agencyIds.length ? prisma.agency.findMany({ where: { id: { in: agencyIds } }, select: { id: true, name: true } }) : [],
    ]);

    const userMap = Object.fromEntries(users.map((user) => [user.id, user]));
    const agencyMap = Object.fromEntries(agencies.map((agency) => [agency.id, agency]));

    const formattedLogs = logs.map((log) => ({
        ...log,
        details: log.details || t("activity.noDetails"),
        author: log.userId ? userMap[log.userId] || null : null,
        agency: log.agencyId ? agencyMap[log.agencyId] || null : null,
    }));

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#1E3A8A]">{t("eyebrow")}</p>
                <h1 className="text-2xl font-black text-gray-900 mt-1">{t("historyPage.title")}</h1>
                <p className="text-gray-500 text-sm mt-1">{t("historyPage.subtitle")}</p>
            </div>
            <SuperAdminLogsTable initialLogs={formattedLogs as any} />
        </div>
    );
}