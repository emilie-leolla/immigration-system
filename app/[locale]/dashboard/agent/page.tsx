import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import {
    Briefcase,
    Clock,
    CheckCircle,
    Users,
    User,
    ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

export default async function AgentDashboard() {
    const locale = await getLocale();
    const t = await getTranslations("agentOverview");
    const tStep = await getTranslations("stepTypeLabels");

    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (
        !session ||
        !["AGENT", "ADMIN"].includes((session.user as any).role)
    ) {
        return null;
    }

    const isAdmin = (session.user as any).role === "ADMIN";
    const agencyId = (session.user as any).agencyId;

    const scopeFilter = isAdmin
        ? { agencyId }
        : {
              OR: [
                  { agentId: session.user.id },
                  {
                      client: {
                          agentId: session.user.id
                      }
                  }
              ]
          };

    const [assignedApps, inReviewApps, completedApps, totalClients] =
        await Promise.all([
            prisma.application.count({
                where: scopeFilter
            }),
            prisma.application.count({
                where: {
                    ...scopeFilter,
                    status: "IN_REVIEW"
                }
            }),
            prisma.application.count({
                where: {
                    ...scopeFilter,
                    status: "APPROVED"
                }
            }),
            prisma.user.count({
                where: isAdmin
                    ? { role: "CLIENT", agencyId }
                    : { role: "CLIENT", agentId: session.user.id }
            })
        ]);

    const recentApplications = await prisma.application.findMany({
        where: scopeFilter,
        include: {
            client: {
                select: {
                    name: true,
                    email: true
                }
            },
            steps: {
                select: {
                    type: true,
                    label: true,
                    status: true,
                    isLocked: true
                },
                orderBy: {
                    createdAt: "asc"
                }
            }
        },
        orderBy: {
            updatedAt: "desc"
        },
        take: 5
    });

    return (
        <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1
                        className="text-3xl font-black text-gray-900 tracking-tight"
                        style={{ color: "#1E3A8A" }}
                    >
                        {isAdmin
                            ? t("adminTitle")
                            : t("agentTitle")}
                    </h1>

                    <p className="text-gray-500 font-medium">
                        {isAdmin
                            ? t("adminSubtitle")
                            : t("agentSubtitle")}
                    </p>
                </div>

                <Link href="/dashboard/agent/profile">
                    <Button
                        className="rounded-xl border-gray-200 hover:bg-blue-50 hover:text-blue-700 font-bold gap-2"
                    >
                        <User className="h-4 w-4" />
                        {t("myProfile")}
                    </Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <div
                    className="bg-white p-6 shadow-sm border border-gray-100 flex items-center gap-5 transition-all hover:shadow-lg hover:-translate-y-1 group"
                    style={{ borderRadius: "16px" }}
                >
                    <div className="p-4 rounded-2xl bg-purple-50 text-[#1E3A8A] group-hover:bg-purple-500 group-hover:text-white transition-all duration-300">
                        <Users size={26} />
                    </div>

                    <div>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">
                            {t("totalClients")}
                        </p>

                        <h3 className="text-3xl font-black text-gray-900 mt-0.5">
                            {totalClients}
                        </h3>
                    </div>
                </div>

                <div
                    className="bg-white p-6 shadow-sm border border-gray-100 flex items-center gap-5 transition-all hover:shadow-lg hover:-translate-y-1 group"
                    style={{ borderRadius: "16px" }}
                >
                    <div className="p-4 rounded-2xl bg-blue-50 text-[#1E3A8A] group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                        <Briefcase size={26} />
                    </div>

                    <div>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">
                            {t("totalProcedures")}
                        </p>

                        <h3 className="text-3xl font-black text-gray-900 mt-0.5">
                            {assignedApps}
                        </h3>
                    </div>
                </div>

                <div
                    className="bg-white p-6 shadow-sm border border-gray-100 flex items-center gap-5 transition-all hover:shadow-lg hover:-translate-y-1 group"
                    style={{ borderRadius: "16px" }}
                >
                    <div className="p-4 rounded-2xl bg-yellow-50 text-[#1E3A8A] group-hover:bg-yellow-500 group-hover:text-white transition-all duration-300">
                        <Clock size={26} />
                    </div>

                    <div>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">
                            {t("inReview")}
                        </p>

                        <h3 className="text-3xl font-black text-gray-900 mt-0.5">
                            {inReviewApps}
                        </h3>
                    </div>
                </div>

                <div
                    className="bg-white p-6 shadow-sm border border-gray-100 flex items-center gap-5 transition-all hover:shadow-lg hover:-translate-y-1 group"
                    style={{ borderRadius: "16px" }}
                >
                    <div className="p-4 rounded-2xl bg-green-50 text-[#1E3A8A] group-hover:bg-green-500 group-hover:text-white transition-all duration-300">
                        <CheckCircle size={26} />
                    </div>

                    <div>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">
                            {t("completed")}
                        </p>

                        <h3 className="text-3xl font-black text-gray-900 mt-0.5">
                            {completedApps}
                        </h3>
                    </div>
                </div>
            </div>

            <Card className="border-none shadow-xl shadow-gray-200/50 rounded-2xl overflow-hidden">
                <CardHeader className="bg-white border-b border-gray-50 py-6">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-lg font-black text-gray-800 uppercase tracking-tight">
                            {t("recentActivity")}
                        </CardTitle>

                        <Link href="/dashboard/agent/clients">
                            <Button className="text-xs font-bold text-blue-600 hover:bg-blue-50">
                                {t("viewAll")}
                            </Button>
                        </Link>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50/50 text-gray-400 uppercase text-[10px] font-black tracking-widest">
                                <tr>
                                    <th className="px-6 py-4">
                                        {t("colApplicant")}
                                    </th>

                                    <th className="px-6 py-4">
                                        {t("colCurrentStep")}
                                    </th>

                                    <th className="px-6 py-4">
                                        {t("colLastUpdate")}
                                    </th>

                                    <th className="px-6 py-4">
                                        {t("colStatus")}
                                    </th>

                                    <th className="px-6 py-4 text-right">
                                        {t("colAction")}
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-100 bg-white">
                                {recentApplications.map((app) => {
                                    const activeStep = app.steps.find(
                                        (step) =>
                                            step.status === "IN_PROGRESS" ||
                                            (step.status === "PENDING" &&
                                                !step.isLocked)
                                    );

                                    const stepLabel = activeStep
                                        ? activeStep.label ||
                                          (activeStep.type
                                              ? tStep(activeStep.type)
                                              : null) ||
                                          activeStep.type ||
                                          t("defaultStepLabel")
                                        : t("defaultStepLabel");

                                    return (
                                        <tr
                                            key={app.id}
                                            className="hover:bg-blue-50/30 transition-colors group"
                                        >
                                            <td className="px-6 py-5">
                                                <div className="font-bold text-gray-900">
                                                    {app.client.name}
                                                </div>

                                                <div className="text-[10px] text-gray-400 font-mono tracking-tighter uppercase">
                                                    {app.country}
                                                </div>
                                            </td>

                                            <td className="px-6 py-5">
                                                <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[11px] font-bold">
                                                    {stepLabel}
                                                </span>
                                            </td>

                                            <td className="px-6 py-5 text-gray-500 font-medium whitespace-nowrap">
                                                {new Date(
                                                    app.updatedAt
                                                ).toLocaleDateString(locale)}
                                            </td>

                                            <td className="px-6 py-5">
                                                <span
                                                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                                                        app.status ===
                                                        "APPROVED"
                                                            ? "bg-green-100 text-green-700"
                                                            : app.status ===
                                                                "REJECTED"
                                                              ? "bg-gray-100 text-red-700"
                                                              : app.status ===
                                                                  "IN_REVIEW"
                                                                ? "bg-gray-100 text-yellow-700"
                                                                : "bg-gray-100 text-blue-700"
                                                    }`}
                                                >
                                                    {app.status.replace(
                                                        "_",
                                                        " "
                                                    )}
                                                </span>
                                            </td>

                                            <td className="px-6 py-5 text-right">
                                                <Link
                                                    href={`/dashboard/agent/clients/${app.clientId}`}
                                                >
                                                    <Button
                                                        className="h-9 w-9 p-0 rounded-xl border-gray-100 text-[#1E3A8A] hover:bg-blue-50 hover:border-blue-200 shadow-sm transition-all"
                                                        title={t(
                                                            "viewClientDetails"
                                                        )}
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {recentApplications.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-6 py-20 text-center text-gray-500 font-bold"
                                        >
                                            {t("noRecentActivity")}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}