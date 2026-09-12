import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail, Phone, MapPin, Calendar, Shield, Briefcase, FileText, ClipboardList, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import NewApplicationModal from "./new-application-modal";
import EditClientProfileModal from "./edit-client-profile-modal";
import { getLocale, getTranslations } from "next-intl/server";

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
    const locale = await getLocale();
    const t = await getTranslations("agentClientDetail");
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session || !["AGENT", "ADMIN"].includes((session.user as any).role)) {
        return null;
    }

    const { id } = await params;
    const isAdmin = (session.user as any).role === "ADMIN";
    const agencyId = (session.user as any).agencyId;

    const client = await prisma.user.findUnique({
        where: isAdmin ? { id, agencyId } : { id, agentId: session.user.id },
        include: {
            applications: {
                include: {
                    steps: {
                        include: {
                            Document: true
                        }
                    }
                },
                orderBy: { createdAt: "desc" }
            }
        }
    });

    if (!client) {
        notFound();
    }

    const documentsCount = client.applications.reduce(
        (total, app) => total + (app as any).steps.reduce((s: number, step: any) => s + step.Document.length, 0),
        0
    );

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-blue-200">
                        {client.name.charAt(0)}
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">{client.name}</h1>
                        <p className="text-gray-500 font-medium flex items-center gap-2">
                           <Shield className="h-4 w-4 text-blue-500" /> {t("assignedClient")}
                        </p>
                    </div>
                </div>
                <NewApplicationModal clientId={id} clientName={client.name} />
            </div>

            {/* Profile Card */}
            <Card className="border-none shadow-xl shadow-gray-200/50 rounded-2xl overflow-hidden">
                <CardHeader className="bg-white border-b border-gray-50 py-6 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-500" /> {t("personalProfile")}
                    </CardTitle>
                    <EditClientProfileModal clientId={id} client={client} />
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{t("emailAddress")}</label>
                        <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                            <Mail className="h-4 w-4 text-gray-400" /> {client.email}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{t("phoneNumber")}</label>
                        <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                            <Phone className="h-4 w-4 text-gray-400" /> {client.phoneNumber || t("notProvided")}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{t("nationality")}</label>
                        <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                            <MapPin className="h-4 w-4 text-gray-400" /> {client.nationality || t("notSpecified")}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{t("dateOfBirth")}</label>
                        <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                            <Calendar className="h-4 w-4 text-gray-400" /> {client.dateOfBirth ? new Date(client.dateOfBirth).toLocaleDateString(locale) : t("notProvided")}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Questionnaire answers */}
            <Link href={`/dashboard/agent/clients/${id}/questionnaire`}>
                <Card className="border-none shadow-xl shadow-blue-50/50 rounded-2xl hover:shadow-2xl transition-all cursor-pointer group">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-11 w-11 rounded-xl bg-blue-50 flex items-center justify-center text-[#1E3A8A] group-hover:bg-[#1E3A8A] group-hover:text-white transition-all">
                                <ClipboardList className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-black text-gray-900">Réponses au questionnaire</p>
                                <p className="text-xs text-gray-400 font-semibold">Voir ce que le client a rempli dans son formulaire de renseignement</p>
                            </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-[#1E3A8A] group-hover:translate-x-1 transition-all" />
                    </CardContent>
                </Card>
            </Link>

            {/* Procedures & documents — quick stats, full management stays on the applications list/detail pages */}
            <Link href="/dashboard/agent/clients">
                <Card className="border-none shadow-xl shadow-blue-50/50 rounded-2xl bg-[#1E3A8A] text-white hover:shadow-2xl transition-all cursor-pointer">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className="grid grid-cols-2 gap-8">
                            <div className="flex items-center gap-3">
                                <Briefcase className="h-5 w-5 text-blue-200" />
                                <div>
                                    <div className="text-[10px] font-black text-blue-200 uppercase tracking-wider">{t("procedures")}</div>
                                    <div className="text-xl font-black">{client.applications.length}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-blue-200" />
                                <div>
                                    <div className="text-[10px] font-black text-blue-200 uppercase tracking-wider">{t("documents")}</div>
                                    <div className="text-xl font-black">{documentsCount}</div>
                                </div>
                            </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-blue-200" />
                    </CardContent>
                </Card>
            </Link>
        </div>
    );
}