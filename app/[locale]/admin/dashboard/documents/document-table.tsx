"use client";

import React, { useState } from "react";
import {
    Search,
    Filter,
    Calendar,
    CheckCircle2,
    Clock,
    AlertCircle,
    XCircle,
    Loader2,
    FileText,
    Download,
    ExternalLink
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateDocumentStatusAction } from "@/app/[locale]/admin/dashboard/documents/actions";
import { TruncatedText } from "@/components/ui/truncated-text";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { useTranslations, useLocale } from "next-intl";
import { TablePagination } from "@/components/ui/table-pagination";

const PAGE_SIZE = 10;

interface DocumentItem {
    id: string;
    name: string;
    fileUrl: string;
    storageKey?: string | null;
    type: string;
    status: string;
    uploadedAt: Date;
    uploader: {
        id: string;
        name: string;
        role: string;
    };
    client: {
        id: string;
        name: string;
        email: string;
    };
    application: {
        id: string;
        destination: string;
    };
    step: {
        id: string;
        type: string | null;
    };
}

export default function DocumentTable({
    initialDocuments
}: {
    initialDocuments: DocumentItem[]
}) {
    const t = useTranslations("adminDocuments");
    const locale = useLocale();

    const [documents, setDocuments] =
        useState<DocumentItem[]>(initialDocuments);

    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [previewDoc, setPreviewDoc] =
        useState<DocumentItem | null>(null);
    const [page, setPage] = useState(1);

    const filteredDocuments = documents.filter((doc) => {
        const search = searchTerm.toLowerCase();

        const matchesSearch =
            doc.name.toLowerCase().includes(search) ||
            doc.client.name.toLowerCase().includes(search) ||
            doc.application.id.toLowerCase().includes(search);

        const matchesStatus =
            statusFilter === "ALL" ||
            doc.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    React.useEffect(() => {
        setPage(1);
    }, [searchTerm, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginatedDocuments = filteredDocuments.slice(
        (safePage - 1) * PAGE_SIZE,
        safePage * PAGE_SIZE
    );

    const handleStatusChange = async (
        docId: string,
        newStatus: string
    ) => {
        setLoadingId(docId);

        const res = await updateDocumentStatusAction(
            docId,
            newStatus
        );

        setLoadingId(null);

        if (res.success) {
            setDocuments((prev) =>
                prev.map((d) =>
                    d.id === docId
                        ? { ...d, status: newStatus }
                        : d
                )
            );
        }
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case "VERIFIED":
                return {
                    bg: "bg-gray-50",
                    text: "text-green-700",
                    border: "border-gray-200",
                    icon: <CheckCircle2 size={14} />
                };

            case "REJECTED":
                return {
                    bg: "bg-gray-50",
                    text: "text-red-700",
                    border: "border-gray-200",
                    icon: <XCircle size={14} />
                };

            case "UPLOADED":
                return {
                    bg: "bg-gray-50",
                    text: "text-amber-700",
                    border: "border-gray-200",
                    icon: <Clock size={14} />
                };

            default:
                return {
                    bg: "bg-gray-50",
                    text: "text-gray-700",
                    border: "border-gray-200",
                    icon: <AlertCircle size={14} />
                };
        }
    };

    /*
     * IMPORTANT:
     * Always use the authenticated document download endpoint.
     *
     * This works for:
     * - New S3 documents using storageKey
     * - Older documents using fileUrl
     *
     * The API also checks that the logged-in admin belongs
     * to the same agency as the document.
     */
    const getDocumentUrl = (doc: DocumentItem) => {
        return `/api/documents/${doc.id}/download`;
    };

    const getFileExtension = (doc: DocumentItem) => {
        const source = doc.storageKey || doc.fileUrl || doc.name;

        const cleanSource = source.split("?")[0];

        return cleanSource
            .split(".")
            .pop()
            ?.toLowerCase() || "";
    };

    const isImage = (doc: DocumentItem) => {
        const extension = getFileExtension(doc);

        return [
            "jpg",
            "jpeg",
            "png",
            "webp",
            "gif"
        ].includes(extension);
    };

    const isPDF = (doc: DocumentItem) => {
        return getFileExtension(doc) === "pdf";
    };

    return (
        <div className="bg-[#F9FAFB] rounded-xl shadow-sm border border-gray-200 overflow-hidden">

            {/* Filters */}
            <div className="p-6 lg:p-8 border-b border-gray-200 bg-[#F9FAFB] flex flex-col md:flex-row gap-4 items-center justify-between">

                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#374151]" />

                    <Input
                        placeholder={t("searchPlaceholder")}
                        className="pl-12 h-12 text-[16px] bg-white border-gray-300 focus:ring-blue-100 placeholder-[#6B7280]"
                        value={searchTerm}
                        onChange={(e) =>
                            setSearchTerm(e.target.value)
                        }
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Filter className="h-5 w-5 text-[#374151]" />

                    <select
                        value={statusFilter}
                        onChange={(e) =>
                            setStatusFilter(e.target.value)
                        }
                        className="text-[16px] border border-gray-300 rounded-md bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-100 min-w-[160px]"
                    >
                        <option value="ALL">
                            {t("filterAll")}
                        </option>

                        <option value="UPLOADED">
                            {t("filterUploaded")}
                        </option>

                        <option value="VERIFIED">
                            {t("filterVerified")}
                        </option>

                        <option value="REJECTED">
                            {t("filterRejected")}
                        </option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-0">

                    <thead>
                        <tr className="bg-gray-100/80">

                            <th className="px-6 py-5 text-[14px] lg:text-[16px] font-extrabold uppercase tracking-widest text-[#1E3A8A] border-b-2 border-gray-200 first:rounded-tl-xl whitespace-nowrap">
                                {t("colDocDetails")}
                            </th>

                            <th className="px-6 py-5 text-[14px] lg:text-[16px] font-extrabold uppercase tracking-widest text-[#1E3A8A] border-b-2 border-gray-200 whitespace-nowrap">
                                {t("colClientUploader")}
                            </th>

                            <th className="px-6 py-5 text-[14px] lg:text-[16px] font-extrabold uppercase tracking-widest text-[#1E3A8A] border-b-2 border-gray-200 whitespace-nowrap">
                                {t("colContextRef")}
                            </th>

                            <th className="px-6 py-5 text-[14px] lg:text-[16px] font-extrabold uppercase tracking-widest text-[#1E3A8A] border-b-2 border-gray-200 whitespace-nowrap">
                                {t("colReviewStatus")}
                            </th>

                            <th className="px-6 py-5 text-[14px] lg:text-[16px] font-extrabold uppercase tracking-widest text-[#1E3A8A] border-b-2 border-gray-200 whitespace-nowrap">
                                {t("colUploadedAt")}
                            </th>

                            <th className="px-6 py-5 text-[14px] lg:text-[16px] font-extrabold uppercase tracking-widest text-[#1E3A8A] border-b-2 border-gray-200 text-right last:rounded-tr-xl">
                                {t("colPreview")}
                            </th>

                        </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">

                        {paginatedDocuments.map((doc) => (

                            <tr
                                key={doc.id}
                                className="hover:bg-blue-50/40 transition-all duration-200 group"
                            >

                                <td className="px-6 py-5">
                                    <div className="flex items-center gap-4">

                                        <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center text-[#374151] font-bold border border-gray-200">
                                            <FileText size={20} />
                                        </div>

                                        <div className="max-w-[200px] md:max-w-xs">

                                            <p className="text-[16px] lg:text-[18px] font-extrabold text-[#111827] truncate leading-none mb-1.5">
                                                <TruncatedText
                                                    text={doc.name}
                                                    maxLength={30}
                                                />
                                            </p>

                                        </div>

                                    </div>
                                </td>

                                <td className="px-6 py-5">
                                    <p className="text-[16px] lg:text-[18px] font-bold text-[#374151]">
                                        <TruncatedText
                                            text={doc.client.name}
                                            maxLength={10}
                                        />
                                    </p>
                                </td>

                                <td className="px-6 py-5">

                                    <div className="flex flex-col gap-2">

                                        <div className="flex items-center gap-2 text-[12px] lg:text-[14px] font-bold text-[#374151] bg-blue-50 w-fit px-3 py-1 uppercase tracking-tight rounded">

                                            {t("stepPrefix")}{" "}
                                            {(doc.step.type || "GENERAL")
                                                .replace("_", " ")}

                                        </div>

                                    </div>

                                </td>

                                <td className="px-6 py-5">

                                    <div className="flex items-center gap-2">

                                        <select
                                            value={doc.status}
                                            onChange={(e) =>
                                                handleStatusChange(
                                                    doc.id,
                                                    e.target.value
                                                )
                                            }
                                            className={`
                                                ${getStatusStyles(doc.status).bg}
                                                ${getStatusStyles(doc.status).text}
                                                ${getStatusStyles(doc.status).border}
                                                text-[14px] font-extrabold uppercase tracking-tight px-3 py-1.5 rounded-full border outline-none cursor-pointer transition-all hover:brightness-95 min-w-[150px]
                                            `}
                                            disabled={
                                                loadingId === doc.id
                                            }
                                        >
                                            <option value="UPLOADED">
                                                {t("statusUnderReview")}
                                            </option>

                                            <option value="VERIFIED">
                                                {t("statusApprovedVerified")}
                                            </option>

                                            <option value="REJECTED">
                                                {t("statusRejected")}
                                            </option>
                                        </select>

                                        {loadingId === doc.id && (
                                            <Loader2
                                                size={16}
                                                className="animate-spin text-blue-500"
                                            />
                                        )}

                                    </div>

                                </td>

                                <td className="px-6 py-5 text-[#4B5563] text-[16px] lg:text-[18px] font-bold">

                                    <div className="flex items-center gap-2 whitespace-nowrap">

                                        <Calendar
                                            size={18}
                                            className="text-[#9CA3AF]"
                                        />

                                        {new Date(
                                            doc.uploadedAt
                                        ).toLocaleDateString(
                                            locale,
                                            {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric"
                                            }
                                        )}

                                    </div>

                                </td>

                                <td className="px-6 py-5 text-right">

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-12 px-6 text-[14px] font-extrabold uppercase tracking-widest gap-2"
                                        onClick={() =>
                                            setPreviewDoc(doc)
                                        }
                                    >
                                        {t("view")}
                                        <ExternalLink size={16} />
                                    </Button>

                                </td>

                            </tr>

                        ))}

                    </tbody>

                </table>

                {filteredDocuments.length === 0 && (

                    <div className="py-24 flex flex-col items-center justify-center text-[#6B7280]">

                        <FileText
                            size={50}
                            className="mb-4 opacity-30"
                        />

                        <p className="text-[18px] font-bold">
                            {t("noneMatch")}
                        </p>

                    </div>

                )}

            </div>

            {filteredDocuments.length > PAGE_SIZE && (
                <div className="px-6 lg:px-8 pb-6 pt-2">
                    <TablePagination
                        page={safePage}
                        totalItems={filteredDocuments.length}
                        pageSize={PAGE_SIZE}
                        onPageChange={setPage}
                    />
                </div>
            )}

            {/* Preview Modal */}
            <Dialog
                open={!!previewDoc}
                onOpenChange={(open) =>
                    !open && setPreviewDoc(null)
                }
            >

                <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">

                    <DialogHeader className="px-6 py-4 border-b bg-white">

                        <DialogTitle className="text-lg font-bold text-[#1E3A8A] flex items-center gap-2">

                            <FileText size={20} />

                            {previewDoc?.name}

                        </DialogTitle>

                        <DialogDescription className="text-xs uppercase font-black tracking-widest text-gray-400">

                            {t("docIdPrefix")}{" "}
                            {previewDoc?.id.substring(0, 8)}
                            {" | "}
                            {t("typePrefix")}{" "}
                            {previewDoc?.type}

                        </DialogDescription>

                    </DialogHeader>

                    <div className="flex-1 bg-gray-100 flex items-center justify-center overflow-auto p-4">

                        {previewDoc && (

                            <>

                                {isImage(previewDoc) ? (

                                    <img
                                        src={getDocumentUrl(previewDoc)}
                                        alt={previewDoc.name}
                                        className="max-w-full max-h-full object-contain shadow-lg rounded-sm"
                                    />

                                ) : isPDF(previewDoc) ? (

                                    <iframe
                                        src={getDocumentUrl(previewDoc)}
                                        className="w-full h-full border-none bg-white shadow-lg rounded-sm"
                                        title={previewDoc.name}
                                    />

                                ) : (

                                    <div className="text-center p-12 bg-white rounded-2xl shadow-sm border border-gray-200">

                                        <AlertCircle
                                            size={48}
                                            className="mx-auto mb-4 text-amber-500"
                                        />

                                        <p className="text-lg font-bold text-gray-800">
                                            {t("previewNotAvailable")}
                                        </p>

                                        <p className="text-sm text-gray-500 mt-2">
                                            {t("previewNotAvailableDescription")}
                                        </p>

                                        <a
                                            href={getDocumentUrl(previewDoc)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-6 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-[#1E3A8A] text-white hover:bg-blue-800 h-10 px-4 py-2"
                                        >
                                            {t("downloadInstead")}
                                            <Download className="ml-2 h-4 w-4" />
                                        </a>

                                    </div>

                                )}

                            </>

                        )}

                    </div>

                </DialogContent>

            </Dialog>

        </div>
    );
}