"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Info, Loader2, ExternalLink, Download, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import Link from "next/link";
import CreateApplicationModal from "./create-application-modal";
import { useTranslations } from "next-intl";
import SendIntakeFormButton from "../clients/[id]/send-intake-form-button";

interface ApplicationListProps {
    initialApplications: any[];
}

export default function ApplicationList({ initialApplications }: ApplicationListProps) {
    const t = useTranslations("agents");
    const [applications, setApplications] = useState(initialApplications);
    const [viewingDoc, setViewingDoc] = useState<{ url: string; name: string } | null>(null);

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <CreateApplicationModal onCreated={(newApp) => setApplications((prev) => [newApp, ...prev])} />
            </div>

            <div className="grid grid-cols-1 space-y-6 animate-in fade-in duration-500">
            {applications.map((app) => (
                <ApplicationCard
                    key={app.id}
                    app={app}
                    onViewDoc={(doc) => setViewingDoc(doc)}
                />
            ))}
            {applications.length === 0 && (
                <Card className="flex flex-col items-center py-20 bg-gray-50 border-dashed rounded-[32px]">
                    <Info className="h-10 w-10 text-gray-300 mb-2" />
                    <p className="text-gray-500 font-medium">{t("noAssignedApplications")}</p>
                </Card>
            )}

            {/* Document Viewer Modal */}
            {viewingDoc && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-[#1a1a1a] w-full max-w-6xl h-[90vh] rounded-3xl flex flex-col overflow-hidden shadow-2xl relative">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                                    <FileText size={18} />
                                </div>
                                <h3 className="text-white font-bold truncate max-w-md">{viewingDoc.name}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <a 
                                    href={viewingDoc.url} 
                                    download 
                                    className="h-10 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center gap-2 text-sm font-bold transition-all"
                                >
                                    <Download size={16} /> {t("download")}
                                </a>
                                <Button 
                                    variant="ghost" 
                                    onClick={() => setViewingDoc(null)} 
                                    className="h-10 w-10 text-white hover:bg-white/10 rounded-xl"
                                >
                                    <X size={20} />
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 bg-[#121212] overflow-hidden relative flex items-center justify-center p-4">
                            {/\.(jpe?g|png|gif|webp)$/i.test(viewingDoc.url) ? (
                                <img
                                    src={viewingDoc.url}
                                    alt={viewingDoc.name}
                                    className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
                                />
                            ) : (
                                <iframe 
                                    src={`${viewingDoc.url}#toolbar=1&navpanes=0&view=FitH`}
                                    className="w-full h-full border-none"
                                    title={t("documentViewerTitle")}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
}

function ApplicationCard({ app, onViewDoc }: { app: any, onViewDoc: (doc: any) => void }) {
    const t = useTranslations("agents");
    const completedSteps = app.steps.filter((s:any) => s.status === "APPROVED").length;
    const totalSteps = app.steps.length || 11;
    const progress = Math.round((completedSteps / totalSteps) * 100);

    return (
        <Card className="overflow-hidden border-none shadow-xl shadow-blue-50/50 rounded-[40px] bg-white group hover:shadow-2xl transition-all duration-500">
            <CardHeader className="flex flex-row items-center justify-between p-10 bg-white border-b border-gray-50">
                <div className="flex gap-6 items-center">
                    <div className="bg-blue-50 p-4 rounded-3xl text-[#1E3A8A] shadow-inner group-hover:bg-[#1E3A8A] group-hover:text-white transition-all duration-500">
                        <FileText className="h-8 w-8" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{app.country}</span>
                            <span className="h-1 w-1 bg-gray-300 rounded-full" />
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest">{app.type}</span>
                        </div>
                        <CardTitle className="text-3xl font-black text-gray-900 tracking-tight">
                            {app.client.name}
                        </CardTitle>
                    </div>
                </div>
                <div>
                    <span className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-tighter shadow-sm border ${
                        app.status === "APPROVED" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                        app.status === "REJECTED" ? "bg-red-100 text-red-800 border-red-200" :
                        app.status === "IN_REVIEW" ? "bg-blue-100 text-blue-800 border-blue-200" :
                        "bg-gray-100 text-gray-800 border-gray-200"
                    }`}>
                        {app.status.replace("_", " ")}
                    </span>
                </div>
            </CardHeader>
            <CardContent className="p-10 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Journey Progress */}
                    <div className="space-y-4 bg-gray-50/50 p-8 rounded-[32px] border border-gray-100 relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex justify-between items-end mb-4">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-2">{t("journeyOverview")}</p>
                                    <h4 className="text-4xl font-black text-[#1E3A8A] tracking-tighter">{progress}%</h4>
                                </div>
                                <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-3 py-1 rounded-full">{t("stepsProgress", { completed: completedSteps, total: totalSteps })}</span>
                            </div>
                            <div className="w-full h-3 bg-white rounded-full overflow-hidden shadow-inner ring-1 ring-gray-100">
                                <div 
                                    className="h-full bg-blue-600 rounded-full transition-all duration-1000 shadow-lg shadow-blue-200" 
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Client Credentials */}
                    <div className="space-y-4 p-8 rounded-[32px] border border-gray-100 bg-white">
                        <div className="flex justify-between items-center mb-2">
                           <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("clientIdentity")}</h4>
                           <div className="flex items-center gap-2">
                               <SendIntakeFormButton clientId={app.clientId} />
                               <Link href={`/dashboard/agent/clients/${app.clientId}`}>
                                 <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black text-blue-600 hover:bg-blue-50 px-4 rounded-xl">{t("viewProfile")}</Button>
                               </Link>
                           </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-lg font-black text-gray-900 truncate">{app.client.name}</p>
                            <p className="text-sm font-medium text-gray-500 truncate">{app.client.email}</p>
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex flex-col md:flex-row justify-end gap-4">
                    <Link href={`/dashboard/agent/applications/${app.id}`}>
                        <Button className="w-full md:w-fit bg-[#1E3A8A] hover:bg-blue-900 text-white font-black px-12 py-8 rounded-[24px] shadow-2xl shadow-blue-200 transition-all hover:scale-[1.02] active:scale-95 group">
                            {t("manageFullRoadmap")}
                            <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </Link>
                </div>

                {/* Documents Preview */}
                {app.steps?.some((p: any) => p.documents?.length > 0) && (
                    <div className="mt-8 pt-8 border-t border-gray-50">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 px-1">
                            {t("latestUploads")}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {app.steps.flatMap((p: any) => p.documents || []).slice(0, 3).map((doc: any) => (
                                <div key={doc.id} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-transparent hover:border-blue-100 hover:bg-white transition-all group/doc">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-blue-600 shrink-0 border border-gray-100 shadow-sm">
                                            <FileText size={18} />
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="text-xs font-black text-gray-700 truncate uppercase tracking-tight">{doc.name}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onViewDoc({ url: doc.fileUrl, name: doc.name })}
                                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                    >
                                        <ExternalLink size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}