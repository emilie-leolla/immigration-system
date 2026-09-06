import React from "react";
import Link from "next/link";
import {
    Building2,
    Users,
    UserCog,
    FileText,
    CreditCard,
    Activity,
    ArrowRight,
    CheckCircle2,
    Clock3,
    XCircle,
} from "lucide-react";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { resolveAuditDetails } from "@/lib/audit-log-render";

export const dynamic = "force-dynamic";

const statusKeys = [
    ["PENDING", "pending"],
    ["IN_REVIEW", "inReview"],
    ["APPROVED", "approved"],
    ["REJECTED", "rejected"],
    ["COMPLETED", "completed"],
] as const;

export default async function SuperAdminDashboardPage() {
    const t = await getTranslations("superAdminDashboard");
    const tAudit = await getTranslations("auditLog");
    const tAction = await getTranslations("auditActions");

    const session = await auth.api.getSession({ headers: await headers() });

    if (!session || (session.user as any).role !== "SUPER_ADMIN") {
        return null;
    }

    const [
        totalAgencies,
        activeAgencies,
        suspendedAgencies,
        totalAdmins,
        totalAgents,
        totalClients,
        totalApplications,
        successfulPayments,
        statusGroups,
        logs,
    ] = await Promise.all([
        prisma.agency.count(),
        prisma.agency.count({ where: { status: "ACTIVE" } }),
        prisma.agency.count({ where: { status: "SUSPENDED" } }),
        prisma.user.count({ where: { role: "ADMIN" } }),
        prisma.user.count({ where: { role: "AGENT" } }),
        prisma.user.count({ where: { role: "CLIENT" } }),
        prisma.application.count(),
        prisma.payment.aggregate({
            where: { status: "SUCCESS" },
            _sum: { amountFcfa: true },
        }),
        prisma.application.groupBy({
            by: ["status"],
            _count: { _all: true },
        }),
        prisma.auditLog.findMany({
            take: 8,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                action: true,
                details: true,
                userId: true,
                createdAt: true,
                agencyId: true,
            },
        }),
    ]);

    const userIds = Array.from(
        new Set(logs.map((log) => log.userId).filter(Boolean))
    ) as string[];

    const agencyIds = Array.from(
        new Set(logs.map((log) => log.agencyId).filter(Boolean))
    ) as string[];

    const [authors, agencies] = await Promise.all([
        userIds.length
            ? prisma.user.findMany({
                  where: { id: { in: userIds } },
                  select: { id: true, name: true, role: true },
              })
            : [],
        agencyIds.length
            ? prisma.agency.findMany({
                  where: { id: { in: agencyIds } },
                  select: { id: true, name: true },
              })
            : [],
    ]);

    const authorMap = Object.fromEntries(authors.map((user) => [user.id, user]));
    const agencyMap = Object.fromEntries(agencies.map((agency) => [agency.id, agency]));

    const counts = {
        PENDING: 0,
        IN_REVIEW: 0,
        APPROVED: 0,
        REJECTED: 0,
        COMPLETED: 0,
    } as Record<string, number>;

    statusGroups.forEach((group) => {
        if (group.status in counts) counts[group.status] = group._count._all;
    });

    const statCards = [
        {
            label: t("stats.agencies"),
            value: totalAgencies,
            href: "/super-admin/dashboard/agencies",
            icon: Building2,
            tone: "blue",
            iconClass: "bg-blue-50 text-blue-700",
        },
        {
            label: t("stats.users"),
            value: totalAdmins + totalAgents + totalClients,
            href: "/super-admin/dashboard/users",
            icon: Users,
            tone: "indigo",
            iconClass: "bg-indigo-50 text-indigo-700",
        },
        {
            label: t("stats.procedures"),
            value: totalApplications,
            icon: FileText,
            tone: "emerald",
            iconClass: "bg-emerald-50 text-emerald-700",
        },
        {
            label: t("stats.revenue"),
            value: `${(successfulPayments._sum.amountFcfa ?? 0).toLocaleString()} FCFA`,
            href: "/super-admin/dashboard/payments",
            icon: CreditCard,
            tone: "amber",
            iconClass: "bg-amber-50 text-amber-700",
        },
    ];

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#1E3A8A]">
                    {t("eyebrow")}
                </p>
                <h1 className="text-3xl font-black tracking-tight text-gray-900 mt-1">
                    {t("title")}
                </h1>
                <p className="text-gray-500 text-sm mt-2">{t("subtitle")}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                {statCards.map((card) => {
                    const Icon = card.icon;
                    const content = (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 h-full transition-all hover:shadow-md hover:-translate-y-0.5">
                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${card.iconClass}`}>
                                <Icon className="h-6 w-6" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                    {card.label}
                                </p>
                                <p className="text-2xl font-black text-gray-900 mt-1 truncate">
                                    {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
                                </p>
                            </div>
                        </div>
                    );
                    return card.href ? <Link key={card.label} href={card.href}>{content}</Link> : <div key={card.label}>{content}</div>;
                })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
                        <div className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-[#1E3A8A]" />
                            <h2 className="text-lg font-black text-gray-900">{t("activity.title")}</h2>
                        </div>
                        <Link href="/super-admin/dashboard/logs" className="text-xs font-bold text-[#1E3A8A] hover:underline inline-flex items-center gap-1">
                            {t("activity.viewAll")} <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>

                    {logs.length ? (
                        <div className="space-y-1 max-h-[440px] overflow-y-auto pr-2 custom-scrollbar">
                            {logs.map((log) => {
                                const author = log.userId ? authorMap[log.userId] : null;
                                const agency = log.agencyId ? agencyMap[log.agencyId] : null;
                                const actionLabel = tAction.has(log.action)
                                    ? tAction(log.action)
                                    : log.action.replace(/_/g, " ");
                                const details = resolveAuditDetails(log.details, tAudit, t("activity.noDetails"));

                                return (
                                    <div key={log.id} className="group flex gap-4 py-4 border-b border-gray-50 last:border-0">
                                        <div className="mt-1 h-9 w-9 rounded-full bg-blue-50 text-[#1E3A8A] flex items-center justify-center shrink-0">
                                            <Activity className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded bg-slate-100 text-slate-700">
                                                    {actionLabel}
                                                </span>
                                                <span className="text-[11px] text-gray-400">
                                                    {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(log.createdAt))}
                                                </span>
                                            </div>
                                            <p className="text-sm font-medium text-gray-700 mt-2 leading-relaxed">{details}</p>
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-[11px]">
                                                <span className="font-bold text-[#1E3A8A]">{author?.name || t("activity.system")}</span>
                                                {author?.role && <span className="text-gray-400">• {author.role}</span>}
                                                <span className="text-gray-300">•</span>
                                                <span className="font-semibold text-gray-500">{agency?.name || t("activity.platform")}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-20 text-center text-sm text-gray-400">{t("activity.empty")}</div>
                    )}
                </div>

                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <div className="flex items-center gap-2 border-b border-gray-100 pb-4 mb-5">
                            <Building2 className="h-5 w-5 text-[#1E3A8A]" />
                            <h2 className="text-lg font-black text-gray-900">{t("agencyStatus.title")}</h2>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                                <span className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" />{t("agencyStatus.active")}</span>
                                <span className="font-black text-emerald-900">{activeAgencies}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 rounded-xl bg-red-50 border border-red-100">
                                <span className="flex items-center gap-2 text-sm font-semibold text-red-800"><XCircle className="h-4 w-4" />{t("agencyStatus.suspended")}</span>
                                <span className="font-black text-red-900">{suspendedAgencies}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <div className="flex items-center gap-2 border-b border-gray-100 pb-4 mb-5">
                            <Clock3 className="h-5 w-5 text-[#1E3A8A]" />
                            <h2 className="text-lg font-black text-gray-900">{t("procedures.title")}</h2>
                        </div>
                        <div className="space-y-3">
                            {statusKeys.map(([status, key]) => (
                                <div key={status} className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600 font-semibold">{t(`procedures.${key}`)}</span>
                                    <span className="min-w-9 text-center px-2 py-1 rounded-full bg-gray-50 border border-gray-200 font-black text-gray-800">{counts[status]}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-[#1E3A8A] rounded-2xl p-6 text-white shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <UserCog className="h-5 w-5" />
                            <h2 className="font-black">{t("users.title")}</h2>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div><p className="text-2xl font-black">{totalAdmins}</p><p className="text-[10px] uppercase tracking-wider opacity-70">{t("users.admins")}</p></div>
                            <div><p className="text-2xl font-black">{totalAgents}</p><p className="text-[10px] uppercase tracking-wider opacity-70">{t("users.agents")}</p></div>
                            <div><p className="text-2xl font-black">{totalClients}</p><p className="text-[10px] uppercase tracking-wider opacity-70">{t("users.clients")}</p></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
