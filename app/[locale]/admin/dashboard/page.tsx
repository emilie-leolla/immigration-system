import React, { Suspense } from "react";
import { Activity, Clock } from "lucide-react";
import prisma from "@/lib/prisma";
import AdminStats from "@/components/dashboard/AdminStats";
import { ActivityItem } from "@/components/dashboard/ActivityItem";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function AdminDashboardOverview() {
    const t = await getTranslations("dashboard.adminDashboard");

    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        return null;
    }

    const user = session.user as any;
    const role = user?.role?.toUpperCase();
    const agencyId = user?.agencyId;

    /*
     * Activity visibility:
     *
     * SUPER_ADMIN
     * → Global system activity
     *
     * ADMIN
     * → Activity belonging only to their agency
     *
     * Other roles
     * → No access to this admin dashboard
     */

    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
        return null;
    }

    /*
     * An ADMIN must belong to an agency.
     * A SUPER_ADMIN does not need an agency because
     * they have global access.
     */
    if (role === "ADMIN" && !agencyId) {
        return (
            <div className="max-w-7xl mx-auto p-8 text-center text-gray-500">
                {t("noAgencyLinked")}
            </div>
        );
    }

    /*
     * For SUPER_ADMIN:
     *   {} = all agencies
     *
     * For ADMIN:
     *   { agencyId } = their agency only
     */
    const agencyFilter =
        role === "SUPER_ADMIN"
            ? {}
            : {
                  agencyId
              };

    // 1. Fetch application status groups
    const statusGroups = await prisma.application.groupBy({
        by: ["status"],
        where: agencyFilter,
        _count: {
            _all: true
        }
    });

    // 2. Fetch only the 5 most recent activities
    const logs = await prisma.auditLog.findMany({
        where: agencyFilter,
        take: 5,
        orderBy: {
            createdAt: "desc"
        }
    });

    // Fetch authors for these logs
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
                      role: true
                  }
              })
            : [];

    const userMap = Object.fromEntries(
        users.map((u) => [u.id, u])
    );

    const recentLogs = logs.map((log) => ({
        ...log,
        author: log.userId
            ? userMap[log.userId] ?? null
            : null
    }));

    // 3. Format status counts
    const countsByStatus = {
        PENDING: 0,
        IN_REVIEW: 0,
        APPROVED: 0,
        REJECTED: 0,
        COMPLETED: 0
    };

    statusGroups.forEach((group) => {
        if (group.status in countsByStatus) {
            (countsByStatus as any)[group.status] =
                group._count._all;
        }
    });

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-6 pt-0">
            <Suspense
                fallback={
                    <div className="h-32 w-full bg-gray-50 animate-pulse rounded-xl mb-8" />
                }
            >
                <AdminStats />
            </Suspense>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
                {/* Procedures by Status */}
                <div
                    className="bg-white shadow-sm border border-gray-100 p-6"
                    style={{ borderRadius: "12px" }}
                >
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-50 pb-4">
                        <Activity className="h-5 w-5 text-[#1E3A8A]" />

                        <h2 className="text-lg font-bold text-gray-900">
                            {t("statusHeading")}
                        </h2>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-100 transition-colors hover:bg-white">
                            <div className="flex items-center gap-3">
                                <div className="h-2.5 w-2.5 rounded-full bg-slate-400" />

                                <span className="text-sm font-semibold text-gray-600">
                                    {t("statuses.pendingReview")}
                                </span>
                            </div>

                            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-900 text-xs font-black">
                                {countsByStatus.PENDING}
                            </span>
                        </div>

                        <div className="flex justify-between items-center p-4 bg-blue-50 bg-opacity-40 rounded-lg border border-blue-100 transition-colors hover:bg-white">
                            <div className="flex items-center gap-3">
                                <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />

                                <span className="text-sm font-semibold text-blue-800">
                                    {t("statuses.inReview")}
                                </span>
                            </div>

                            <span className="px-3 py-1 rounded-full bg-white border border-blue-200 text-blue-900 text-xs font-black">
                                {countsByStatus.IN_REVIEW}
                            </span>
                        </div>

                        <div className="flex justify-between items-center p-4 bg-emerald-50 bg-opacity-40 rounded-lg border border-emerald-100 transition-colors hover:bg-white">
                            <div className="flex items-center gap-3">
                                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />

                                <span className="text-sm font-semibold text-emerald-800">
                                    {t("statuses.approved")}
                                </span>
                            </div>

                            <span className="px-3 py-1 rounded-full bg-white border border-emerald-200 text-emerald-900 text-xs font-black">
                                {countsByStatus.APPROVED}
                            </span>
                        </div>

                        <div className="flex justify-between items-center p-4 bg-red-50 bg-opacity-40 rounded-lg border border-red-100 transition-colors hover:bg-white">
                            <div className="flex items-center gap-3">
                                <div className="h-2.5 w-2.5 rounded-full bg-red-500" />

                                <span className="text-sm font-semibold text-red-800">
                                    {t("statuses.rejected")}
                                </span>
                            </div>

                            <span className="px-3 py-1 rounded-full bg-white border border-red-200 text-red-900 text-xs font-black">
                                {countsByStatus.REJECTED}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Recent Activity Feed */}
                <div
                    className="bg-white shadow-sm border border-gray-100 p-6"
                    style={{ borderRadius: "12px" }}
                >
                    <div className="flex items-center justify-between mb-6 border-b border-gray-50 pb-4">
                        <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-[#1E3A8A]" />

                            <h2 className="text-lg font-bold text-gray-800">
                                {t("recentActivityHeading")}
                            </h2>
                        </div>
                    </div>

                    <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {recentLogs.length > 0 ? (
                            recentLogs.map((log) => (
                                <ActivityItem
                                    key={log.id}
                                    log={log as any}
                                />
                            ))
                        ) : (
                            <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-100">
                                <Activity className="h-10 w-10 text-slate-200 mx-auto mb-3" />

                                <p className="text-sm text-gray-400 font-medium">
                                    {t("noActivity")}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}