import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, User, Globe, Briefcase, GraduationCap, Users, Clock, CheckCircle2 } from "lucide-react";
import StepManagement from "./step-management";
import { getAgencyStepDefinitions } from "@/lib/steps-server";
import { getTranslations } from "next-intl/server";

export default async function AgentApplicationManagementPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
    const { id } = await (params as any);
    const t = await getTranslations("agentApplicationDetail");
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session || !["AGENT", "ADMIN"].includes((session.user as any).role)) {
        return null;
    }

    let application = await prisma.application.findUnique({
        where: { id: id },
        include: {
            client: { select: { name: true, email: true, id: true } },
            steps: {
                include: { Document: true, subSteps: { orderBy: { order: "asc" } } },
                orderBy: { order: "asc" }
            }
        }
    });

    if (application && application.steps.length === 0) {
        // Auto-repair applications that somehow ended up with zero steps
        // (very old legacy rows). Normal creation always creates every step
        // atomically, so partial/missing-a-few-steps is no longer possible —
        // an agency may legitimately have fewer than 11 active steps by design.
        const appId = application.id;
        const stepDefs = await getAgencyStepDefinitions(application.agencyId);

        if (stepDefs.length > 0) {
            await prisma.applicationStep.createMany({
                data: stepDefs.map((def, index) => {
                    const isFirstThree = index < 3;
                    const isStep4 = index === 3;
                    return {
                        applicationId: appId,
                        type: def.type,
                        label: def.label,
                        order: index,
                        status: isFirstThree ? "APPROVED" : (isStep4 ? "IN_PROGRESS" : "PENDING"),
                        isLocked: isFirstThree ? false : (isStep4 ? false : true),
                        description: isFirstThree ? "Automatically verified." : (def.description || null),
                        requiredDocuments: def.requiredDocuments
                    };
                })
            });

            application = await prisma.application.findUnique({
                where: { id: id },
                include: {
                    client: { select: { name: true, email: true, id: true } },
                    steps: {
                include: { Document: true, subSteps: { orderBy: { order: "asc" } } },
                        orderBy: { order: "asc" }
                    }
                }
            });
        }
    }

    if (!application) return <div className="p-8 text-center font-black text-red-500 uppercase">{t("procedureNotFound")}</div>;

    const completedSteps = application.steps.filter(s => s.status === "APPROVED").length;
    const progress = Math.round((completedSteps / application.steps.length) * 100);
    const appType = application.type || "GENERAL";

    return (
        <div className="min-h-screen bg-[#F8F9FF] py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
            
            {/* Header / Navigation */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 pb-12 border-b-2 border-gray-100">
                <div className="space-y-6 flex-1">
                    <Link href="/dashboard/agent/clients" className="inline-flex items-center gap-2 group text-gray-400 hover:text-[#1E3A8A] transition-all">
                        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">{t("backToWorkspace")}</span>
                    </Link>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8">
                        <div className="bg-gradient-to-br from-[#1E3A8A] to-blue-700 p-6 rounded-[32px] text-white shadow-2xl shadow-blue-100 ring-8 ring-blue-50">
                            <Globe size={40} />
                        </div>
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="bg-blue-50 text-[#1E3A8A] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{application.country} {t("procedureSuffix")}</span>
                                <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{appType}</span>
                                <span className="bg-gray-100 text-gray-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{t("idPrefix")}{application.id.slice(-6)}</span>
                            </div>
                            <h1 className="text-6xl font-black text-gray-900 tracking-tighter uppercase leading-none">{application.client.name}</h1>
                        </div>
                    </div>
                </div>

                <div className="w-full lg:w-auto">
                    <div className="bg-white p-10 rounded-[40px] shadow-2xl shadow-gray-100 border border-gray-50 flex items-center gap-6 group">
                       <div className="bg-blue-50 p-4 rounded-3xl transition-transform group-hover:scale-110">
                            <User className="h-10 w-10 text-[#1E3A8A]" />
                       </div>
                       <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-2">{t("subjectInformation")}</p>
                            <h4 className="text-2xl font-black text-gray-900 tracking-tight">{application.client.name}</h4>
                            <p className="text-sm font-bold text-[#1E3A8A] opacity-60">{application.client.email}</p>
                       </div>
                    </div>
                </div>
            </div>

            {/* Application Pulse / Progress */}
            <div className="bg-white p-10 rounded-[50px] shadow-2xl shadow-blue-50 border border-gray-50 overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Clock size={120} className="text-[#1E3A8A]" />
                </div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-10">
                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-1">{t("overallCompletion")}</p>
                        <h3 className="text-4xl font-black text-gray-900 uppercase tracking-tighter">{t("procedureProgress")}</h3>
                        <p className="text-xs font-bold text-[#1E3A8A] opacity-60 uppercase tracking-widest">
                            {t("milestonesValidated", { completed: completedSteps, total: application.steps.length })}
                        </p>
                    </div>
                    <div className="text-left md:text-right">
                        <span className="text-7xl font-black text-[#1E3A8A] tracking-tighter leading-none">{progress}%</span>
                        <div className="flex items-center gap-2 md:justify-end mt-2 uppercase tracking-widest text-[10px] font-black text-emerald-500">
                             <CheckCircle2 size={12} /> {t("liveIntegrityCheck")}
                        </div>
                    </div>
                </div>
                <div className="w-full h-8 bg-gray-50 rounded-full border-4 border-white shadow-inner p-1.5 overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-blue-600 via-[#1E3A8A] to-blue-900 rounded-full transition-all duration-1000 ease-out shadow-xl shadow-blue-200"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            <div className="bg-white p-6 rounded border border-gray-200 shadow-sm">
                <StepManagement 
                    applicationId={application.id} 
                    currentStatus={application.status} 
                    steps={application.steps} 
                    country={application.country}
                />
            </div>

        </div>
    );
}