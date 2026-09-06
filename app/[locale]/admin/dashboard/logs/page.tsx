import React from "react";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import LogsTable from "./logs-table";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function SystemLogsPage() {
    const t = await getTranslations("adminLogs");

    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        return null;
    }

    const user = session.user as any;
    const userRole = user?.role?.toUpperCase();
    const agencyId = user?.agencyId;

    /*
     * Access rules:
     *
     * SUPER_ADMIN
     * → Can see all system audit logs.
     *
     * ADMIN
     * → Can only see logs belonging to their own agency.
     *
     * Any other role
     * → No access to this system-wide log page.
     */

    if (userRole !== "SUPER_ADMIN" && userRole !== "ADMIN") {
        return null;
    }

    /*
     * Build the Prisma filter according to the user's role.
     *
     * SUPER_ADMIN:
     * No agency filter → global system history.
     *
     * ADMIN:
     * agencyId is mandatory → only this agency's history.
     */
    const where =
        userRole === "SUPER_ADMIN"
            ? {}
            : agencyId
              ? {
                    agencyId
                }
              : null;

    /*
     * An ADMIN without an agency must not receive any logs.
     */
    if (where === null) {
        return (
            <div className="space-y-6 max-w-7xl mx-auto">
                <div>
                    <h1
                        className="text-2xl font-bold tracking-tight"
                        style={{ color: "#1E3A8A" }}
                    >
                        {t("title")}
                    </h1>

                    <p className="text-gray-500 text-sm mt-1">
                        {t("subtitle")}
                    </p>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
                    No agency is associated with this account.
                </div>
            </div>
        );
    }

    const logs = await prisma.auditLog.findMany({
        where,
        include: {
            author: true
        },
        orderBy: {
            createdAt: "desc"
        }
    });

    const userIds = Array.from(
        new Set(
            logs
                .map((log) => log.userId)
                .filter(Boolean)
        )
    ) as string[];

    const users =
        userIds.length > 0
            ? await prisma.user.findMany({
                  where: {
                      id: {
                          in: userIds
                      }
                  },
                  select: {
                      id: true,
                      name: true,
                      role: true,
                      email: true
                  }
              })
            : [];

    const userMap = Object.fromEntries(
        users.map((user) => [user.id, user])
    );

    const formattedLogs = logs.map((log) => ({
        id: log.id,
        logNumber: log.logNumber,
        action: log.action,
        details: log.details || t("noDetails"),
        createdAt: log.createdAt,
        author:
            log.userId && userMap[log.userId]
                ? userMap[log.userId]
                : null
    }));

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1
                        className="text-2xl font-bold tracking-tight"
                        style={{ color: "#1E3A8A" }}
                    >
                        {t("title")}
                    </h1>

                    <p className="text-gray-500 text-sm mt-1">
                        {t("subtitle")}
                    </p>
                </div>

                <div className="bg-slate-100 flex items-center gap-3 px-4 py-2 rounded-lg border border-slate-200">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />

                    <span className="text-slate-700 text-sm font-bold tracking-widest uppercase">
                        {t("totalLogs", {
                            count: formattedLogs.length
                        })}
                    </span>
                </div>
            </div>

            <LogsTable initialLogs={formattedLogs as any} />
        </div>
    );
}