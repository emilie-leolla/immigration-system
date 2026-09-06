import Link from "next/link";
import { Users, Briefcase, FileText } from "lucide-react";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

export default async function AdminStats() {
    const t = await getTranslations(
        "dashboard.adminDashboard.stats"
    );

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
     * Statistics visibility:
     *
     * SUPER_ADMIN
     * → Global statistics
     *
     * ADMIN
     * → Statistics for their agency only
     */

    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
        return null;
    }

    /*
     * SUPER_ADMIN:
     * No agency restriction.
     *
     * ADMIN:
     * Restrict every statistic to their agency.
     */
    const agencyFilter =
        role === "SUPER_ADMIN"
            ? {}
            : agencyId
              ? { agencyId }
              : null;

    /*
     * An ADMIN without an agency cannot have
     * agency-specific statistics.
     */
    if (agencyFilter === null) {
        return null;
    }

    const [totalClients, totalAgents, totalApplications] =
        await Promise.all([
            prisma.user.count({
                where: {
                    role: "CLIENT",
                    ...agencyFilter
                }
            }),

            prisma.user.count({
                where: {
                    role: "AGENT",
                    ...agencyFilter
                }
            }),

            prisma.application.count({
                where: agencyFilter
            })
        ]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {/* Total Clients Card */}
            <Link
                href="/admin/dashboard/clients"
                className="bg-white p-6 shadow-sm border border-gray-100 flex items-center gap-5 transition-all hover:shadow-lg hover:-translate-y-1 group"
                style={{ borderRadius: "16px" }}
            >
                <div className="p-4 rounded-2xl bg-blue-50 text-[#1E3A8A] group-hover:bg-[#1E3A8A] group-hover:text-white transition-all duration-300">
                    <Users size={26} />
                </div>

                <div>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">
                        {t("totalClients")}
                    </p>

                    <h3 className="text-3xl font-black text-gray-900 mt-0.5">
                        {totalClients.toLocaleString()}
                    </h3>
                </div>
            </Link>

            {/* Total Agents Card */}
            <Link
                href="/admin/dashboard/agents"
                className="bg-white p-6 shadow-sm border border-gray-100 flex items-center gap-5 transition-all hover:shadow-lg hover:-translate-y-1 group"
                style={{ borderRadius: "16px" }}
            >
                <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-700 group-hover:bg-indigo-700 group-hover:text-white transition-all duration-300">
                    <Briefcase size={26} />
                </div>

                <div>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">
                        {t("totalAgents")}
                    </p>

                    <h3 className="text-3xl font-black text-gray-900 mt-0.5">
                        {totalAgents.toLocaleString()}
                    </h3>
                </div>
            </Link>

            {/* Total Applications Card */}
            <Link
                href="/admin/dashboard/applications"
                className="bg-white p-6 shadow-sm border border-gray-100 flex items-center gap-5 transition-all hover:shadow-lg hover:-translate-y-1 group"
                style={{ borderRadius: "16px" }}
            >
                <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white transition-all duration-300">
                    <FileText size={26} />
                </div>

                <div>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">
                        {t("allProcedures")}
                    </p>

                    <h3 className="text-3xl font-black text-gray-900 mt-0.5">
                        {totalApplications.toLocaleString()}
                    </h3>
                </div>
            </Link>
        </div>
    );
}