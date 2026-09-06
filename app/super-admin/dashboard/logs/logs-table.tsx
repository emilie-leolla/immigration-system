"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
    Search,
    ShieldAlert,
    UserCircle,
    FileText,
    RefreshCw,
    Calendar,
    Clock,
    Activity,
    Building2,
    Users as UsersIcon,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { TruncatedText } from "@/components/ui/truncated-text";
import { useTranslations } from "next-intl";
import { resolveAuditDetails } from "@/lib/audit-log-render";
import { TablePagination } from "@/components/ui/table-pagination";

interface Author {
    id: string;
    name: string;
    role: string;
    email: string;
}

interface Agency {
    id: string;
    name: string;
}

interface LogItem {
    id: string;
    logNumber: number;
    action: string;
    details: string;
    createdAt: Date;
    author: Author | null;
    agency: Agency | null;
}

const PAGE_SIZE = 15;

export default function SuperAdminLogsTable({ initialLogs }: { initialLogs: LogItem[] }) {
    const t = useTranslations("superAdminDashboard");
    const tAudit = useTranslations("auditLog");
    const tAction = useTranslations("auditActions");

    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const isAnomaly = (action: string, details: string) => {
        const str = (action + details).toLowerCase();
        return (
            str.includes("delete") ||
            str.includes("fail") ||
            str.includes("unauthorized") ||
            str.includes("error") ||
            str.includes("suspicious") ||
            str.includes("remove") ||
            str.includes("suspend") ||
            str.includes("reject")
        );
    };

    const filtered = useMemo(
        () =>
            initialLogs.filter((log) => {
                const q = search.trim().toLowerCase();
                const details = log.details || "";
                const matchesSearch =
                    !q ||
                    [log.action, details, log.author?.name, log.agency?.name].some((v) =>
                        String(v || "").toLowerCase().includes(q)
                    );
                const matchesFilter =
                    filter === "ALL" ||
                    (filter === "AGENCIES" && log.action.includes("AGENCY")) ||
                    (filter === "USERS" &&
                        [
                            "CREATE_AGENT",
                            "DELETE_AGENT",
                            "UPDATE_AGENT",
                            "SUSPEND_AGENT",
                            "UNSUSPEND_AGENT",
                            "CREATE_CLIENT",
                            "DELETE_CLIENT",
                            "SUSPEND_CLIENT",
                            "UNSUSPEND_CLIENT",
                        ].includes(log.action));
                return matchesSearch && matchesFilter;
            }),
        [initialLogs, search, filter]
    );

    useEffect(() => setPage(1), [search, filter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageLogs = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const getActionStyles = (action: string) => {
        const a = action.toUpperCase();

        if (a.includes("DELETE") || a.includes("REMOVE") || a.includes("FAIL") || a.includes("REJECT") || a.includes("SUSPEND")) {
            return { text: "text-red-700", icon: <ShieldAlert size={14} /> };
        }
        if (a.includes("SEND_MESSAGE") || a.includes("NOTIFICATION")) {
            return { text: "text-blue-700", icon: <Activity size={14} /> };
        }
        if (a.includes("UPDATE") || a.includes("MODIFY") || a.includes("ASSIGN")) {
            return { text: "text-amber-700", icon: <RefreshCw size={14} /> };
        }
        if (a.includes("CREATE") || a.includes("ADD") || a.includes("UPLOAD") || a.includes("VERIFY")) {
            return { text: "text-green-700", icon: <Activity size={14} /> };
        }
        if (a.includes("LOGIN") || a.includes("AUTH")) {
            return { text: "text-purple-700", icon: <UserCircle size={14} /> };
        }
        return { text: "text-blue-700", icon: <FileText size={14} /> };
    };

    const toggleExpand = (id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Toolbar */}
            <div className="p-6 lg:p-8 border-b border-gray-200 bg-[#F9FAFB] flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#374151]" />
                    <Input
                        placeholder={t("historyPage.searchPlaceholder")}
                        className="pl-12 h-12 text-[16px] bg-white border-gray-300 focus:ring-blue-100"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex gap-3 p-1 bg-gray-100 rounded-lg w-full md:w-auto">
                    <button
                        type="button"
                        onClick={() => setFilter("ALL")}
                        className={`flex-1 md:flex-none px-6 py-2.5 text-[14px] lg:text-[16px] font-bold rounded-md transition-all ${
                            filter === "ALL" ? "bg-white text-gray-900 shadow-sm" : "text-[#4B5563] hover:text-[#111827]"
                        }`}
                    >
                        {t("historyPage.all")}
                    </button>

                    <button
                        type="button"
                        onClick={() => setFilter("AGENCIES")}
                        className={`flex-1 md:flex-none px-6 py-2.5 text-[14px] lg:text-[16px] font-bold rounded-md transition-all flex items-center justify-center gap-2 ${
                            filter === "AGENCIES" ? "bg-[#1E3A8A] text-white shadow-sm" : "text-[#4B5563] hover:text-[#111827]"
                        }`}
                    >
                        <Building2 size={18} />
                        {t("historyPage.agencies")}
                    </button>

                    <button
                        type="button"
                        onClick={() => setFilter("USERS")}
                        className={`flex-1 md:flex-none px-6 py-2.5 text-[14px] lg:text-[16px] font-bold rounded-md transition-all flex items-center justify-center gap-2 ${
                            filter === "USERS" ? "bg-[#1E3A8A] text-white shadow-sm" : "text-[#4B5563] hover:text-[#111827]"
                        }`}
                    >
                        <UsersIcon size={18} />
                        {t("historyPage.users")}
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-0">
                    <thead>
                        <tr className="bg-gray-100/80">
                            <th className="px-6 py-5 text-[14px] lg:text-[16px] font-extrabold uppercase tracking-widest text-[#1E3A8A] border-b-2 border-gray-200 first:rounded-tl-xl whitespace-nowrap">
                                Ref
                            </th>
                            <th className="px-6 py-5 text-[14px] lg:text-[16px] font-extrabold uppercase tracking-widest text-[#1E3A8A] border-b-2 border-gray-200 whitespace-nowrap">
                                Action
                            </th>
                            <th className="px-6 py-5 text-[14px] lg:text-[16px] font-extrabold uppercase tracking-widest text-[#1E3A8A] border-b-2 border-gray-200 w-1/3">
                                Context
                            </th>
                            <th className="px-6 py-5 text-[14px] lg:text-[16px] font-extrabold uppercase tracking-widest text-[#1E3A8A] border-b-2 border-gray-200 whitespace-nowrap">
                                Author
                            </th>
                            <th className="px-6 py-5 text-[14px] lg:text-[16px] font-extrabold uppercase tracking-widest text-[#1E3A8A] border-b-2 border-gray-200 whitespace-nowrap">
                                Agency
                            </th>
                            <th className="px-6 py-5 text-[14px] lg:text-[16px] font-extrabold uppercase tracking-widest text-[#1E3A8A] border-b-2 border-gray-200 last:rounded-tr-xl whitespace-nowrap">
                                Timestamp
                            </th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">
                        {pageLogs.map((log) => {
                            const styles = getActionStyles(log.action);
                            const anomalyDetected = isAnomaly(log.action, log.details);
                            const actionLabel = tAction.has(log.action) ? tAction(log.action) : log.action.replace(/_/g, " ");
                            const detailsText = resolveAuditDetails(log.details, tAudit, t("activity.noDetails"));

                            return (
                                <tr
                                    key={log.id}
                                    className={`hover:bg-blue-50/40 transition-all duration-200 group ${
                                        anomalyDetected && filter !== "ALL" ? "bg-red-50/20" : ""
                                    }`}
                                >
                                    <td className="px-6 py-5 align-top">
                                        <span className="inline-flex text-[14px] font-extrabold text-[#6B7280] bg-gray-100 px-3 py-1.5 rounded border border-gray-200">
                                            LOG-{log.logNumber.toString().padStart(4, "0")}
                                        </span>
                                    </td>

                                    <td className="px-6 py-5 align-top">
                                        <div className={`flex items-center gap-2 w-fit px-3 py-1 rounded bg-gray-50 ${styles.text}`}>
                                            {styles.icon}
                                            <span className="text-[14px] font-extrabold uppercase tracking-widest leading-none">
                                                {actionLabel}
                                            </span>
                                        </div>
                                    </td>

                                    <td className="px-6 py-5 align-top">
                                        <div className="space-y-1">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-[16px] lg:text-[18px] font-medium text-[#374151] leading-snug">
                                                    <TruncatedText text={detailsText} maxLength={30} />
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleExpand(log.id)}
                                                    className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-400 hover:text-blue-600"
                                                    title="View full details"
                                                >
                                                    {expanded.has(log.id) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                </button>
                                            </div>

                                            {expanded.has(log.id) && (
                                                <div className="mt-3 p-4 bg-white rounded-lg border border-gray-200 text-[14px] text-[#4B5563] animate-in slide-in-from-top-1 duration-200 shadow-inner max-h-48 overflow-y-auto custom-scrollbar">
                                                    <p className="whitespace-pre-wrap font-mono leading-relaxed">{detailsText}</p>
                                                </div>
                                            )}
                                        </div>
                                    </td>

                                    <td className="px-6 py-5 align-top">
                                        {log.author ? (
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1E3A8A] text-[14px] font-extrabold shrink-0">
                                                    {log.author.name[0]?.toUpperCase()}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[16px] lg:text-[18px] font-extrabold text-[#111827] leading-tight">
                                                        <TruncatedText text={log.author.name} maxLength={10} />
                                                    </p>
                                                    <span
                                                        className={`flex items-center text-[10px] lg:text-[12px] uppercase font-bold px-2 py-1 rounded leading-none ${
                                                            log.author.role === "ADMIN"
                                                                ? "bg-indigo-100 text-indigo-800"
                                                                : log.author.role === "AGENT"
                                                                ? "bg-blue-100 text-blue-800"
                                                                : "bg-gray-200 text-gray-800"
                                                        }`}
                                                    >
                                                        {log.author.role}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-[#6B7280] bg-gray-100 w-fit px-3 py-1.5 rounded-lg border border-gray-200">
                                                <ShieldAlert size={16} className="text-[#6B7280]" />
                                                <span className="text-[12px] font-extrabold uppercase tracking-widest text-[#6B7280]">
                                                    {t("activity.system")}
                                                </span>
                                            </div>
                                        )}
                                    </td>

                                    <td className="px-6 py-5 align-top">
                                        <div className="flex items-center gap-2 text-[14px] lg:text-[16px] font-medium text-[#374151]">
                                            <Building2 size={16} className="text-[#9CA3AF] shrink-0" />
                                            <TruncatedText text={log.agency?.name || t("activity.platform")} maxLength={16} />
                                        </div>
                                    </td>

                                    <td className="px-6 py-5 align-top">
                                        <div className="flex flex-col gap-2 text-[14px] lg:text-[16px] font-medium text-[#4B5563]">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={16} className="text-[#9CA3AF]" />
                                                {new Date(log.createdAt).toLocaleDateString(undefined, {
                                                    month: "short",
                                                    day: "numeric",
                                                    year: "numeric",
                                                })}
                                            </div>
                                            <div className="flex items-center gap-2 text-[#6B7280]">
                                                <Clock size={16} />
                                                {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {filtered.length === 0 && (
                    <div className="py-24 flex flex-col items-center justify-center text-[#6B7280]">
                        <ShieldAlert size={50} className="mb-4 opacity-30" />
                        <p className="text-[18px] font-bold">{t("historyPage.empty")}</p>
                    </div>
                )}
            </div>

            {filtered.length > PAGE_SIZE && (
                <div className="px-6 pb-6 pt-2">
                    <TablePagination page={safePage} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
                </div>
            )}
        </div>
    );
}