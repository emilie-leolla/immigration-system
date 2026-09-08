import React from "react";
import { Users } from "lucide-react";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import ApplicationList from "../applications/application-list";
import NewClientButton from "./new-client-button";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function AssignedClientsPage() {
    const t = await getTranslations("agents");
    const tClients = await getTranslations("clients");

    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session || !["AGENT", "ADMIN"].includes((session.user as any).role)) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-gray-500 font-medium">{t("signInAsAgent")}</p>
            </div>
        );
    }

    const isAdmin = (session.user as any).role === "ADMIN";
    const agencyId = (session.user as any).agencyId;

    // Applications (procedures) — this stays the main content of the page,
    // same query/scoping the old /applications page used.
    const applications = await prisma.application.findMany({
        where: isAdmin ? { agencyId } : {
            OR: [
                { agentId: session.user.id },
                { client: { agentId: session.user.id } }
            ]
        },
        include: {
            client: {
                select: {
                    name: true,
                    email: true
                }
            },
            steps: {
                include: {
                    Document: true
                }
            }
        },
        orderBy: {
            updatedAt: "desc"
        }
    });

    // Total clients — just a count now, the old page's full client table
    // (with per-client suspend/reassign actions) has been folded into this
    // single card + the "New client" button.
    const totalClients = await prisma.user.count({
        where: isAdmin
            ? { role: "CLIENT", agencyId }
            : { role: "CLIENT", agentId: session.user.id }
    });

    return (
        <div className="space-y-8 max-w-6xl mx-auto px-4 py-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between border-b pb-4 border-gray-100 gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: "#1E3A8A" }}>{t("agentWorkspace")}</h1>
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest">{t("manageUpdate")}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold border border-blue-100 flex items-center gap-2">
                        <span className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                        {t("activeProcedures", { count: applications.length })}
                    </div>

                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl border border-blue-100">
                        <Users className="h-5 w-5 text-[#1E3A8A]" />
                        <span className="font-bold text-[#1E3A8A]">
                            {totalClients} {tClients("activeClients")}
                        </span>
                    </div>

                    <NewClientButton isAgent={!isAdmin} />
                </div>
            </div>

            <ApplicationList initialApplications={applications} />
        </div>
    );
}