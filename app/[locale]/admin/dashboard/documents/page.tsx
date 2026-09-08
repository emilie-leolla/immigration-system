// Forced rebuild to resolve import path cache
import React from "react";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import DocumentTable from "@/app/[locale]/admin/dashboard/documents/document-table";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function DocumentMonitoringPage() {
    const t = await getTranslations("adminDocuments");
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = (session?.user as any)?.agencyId;

    // 1. Fetch all documents for this agency (Document has no direct agencyId
    // column — scoped through Procedure -> Application -> agencyId instead)
    const rawDocuments = await prisma.document.findMany({
        where: {
            Procedure: {
                application: { agencyId }
            }
        },
        include: {
            Procedure: {
                include: {
                    application: {
                        include: {
                            client: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true
                                }
                            }
                        }
                    }
                }
            },
            uploader: {
                select: {
                    id: true,
                    name: true,
                    role: true
                }
            }
        },
        orderBy: {
            uploadedAt: "desc"
        }
    });

    // 2. Map data for the UI
    const documents = rawDocuments.map(doc => {
        const application = doc.Procedure.application;
        const client = application.client;

        return {
            id: doc.id,
            name: doc.name,
            fileUrl: doc.fileUrl,
            storageKey: doc.storageKey,
            type: doc.type,
            status: doc.status,
            uploadedAt: doc.uploadedAt,
            uploader: doc.uploader,
            client: client,
            application: {
                id: application.id,
                destination: application.country
            },
            step: {
                id: doc.Procedure.id,
                type: doc.Procedure.type
            }
        };
    });

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#1E3A8A" }}>{t("pageTitle")}</h1>
                    <p className="text-gray-500 text-sm mt-1">{t("pageSubtitle")}</p>
                </div>
                <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
                    <span className="text-blue-700 text-sm font-semibold">{t("totalDocuments", { count: documents.length })}</span>
                </div>
            </div>

            <DocumentTable initialDocuments={documents} />
        </div>
    );
}