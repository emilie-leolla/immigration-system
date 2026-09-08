"use client";

import React, { useState } from "react";
import {
    Loader2,
    Upload,
    FileCheck2,
    ChevronDown,
    GitBranch,
    Sparkles,
    CheckCircle2,
    X
} from "lucide-react";
import {
    updateStepAction,
    updateApplicationStatusAction,
    addDocumentAction,
    deleteDocumentAction,
    toggleSubStepAction,
    createDocumentUploadAction,
    finalizeProcedureAction
} from "../actions";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

// Same document types the client picks from when uploading — kept here so
// the agent/admin can label an upload the same way the client would.
const DOCUMENT_TYPE_OPTIONS: { value: string; label: string }[] = [
    { value: "PASSPORT", label: "Passport" },
    { value: "PASSPORT_PHOTO", label: "Passport Photo" },
    { value: "BIRTH_CERTIFICATE", label: "Birth Certificate" },
    { value: "ID_CARD", label: "National ID Card" },
    { value: "DIPLOMA", label: "Diploma / Degree" },
    { value: "TRANSCRIPT", label: "Academic Transcript" },
    { value: "CV", label: "CV / Resume" },
    { value: "WORK_CERTIFICATE", label: "Work Certificate" },
    { value: "LANGUAGE_REGISTRATION", label: "Language Test Registration" },
    { value: "LANGUAGE_RESULT", label: "Language Test Result" },
    { value: "MEDICAL", label: "Medical Examination" },
    { value: "POLICE_CLEARANCE", label: "Police Clearance" },
    { value: "VISA_APPROVAL", label: "Visa Approval" },
    { value: "OTHER", label: "Other Document" }
];

/**
 * Scopes the document-type dropdown to whatever specific documents were
 * configured as required for THIS step (step.requiredDocuments, a list of
 * free-text names set in the workflow template editor) — instead of always
 * showing the full generic 14-category list regardless of what was set up.
 *
 * If the step has no specific required documents configured, falls back to
 * the full list, since there's nothing more specific to narrow it down to.
 */
function getDocumentOptionsForStep(
    step: { requiredDocuments?: string[] | null }
): { value: string; label: string }[] {
    const required = step.requiredDocuments;

    if (!required || required.length === 0) {
        return DOCUMENT_TYPE_OPTIONS;
    }

    const matched: { value: string; label: string }[] = [];
    const seenValues = new Set<string>();

    for (const docName of required) {
        const normalized = docName.trim().toLowerCase();
        if (!normalized) continue;

        const builtInMatch = DOCUMENT_TYPE_OPTIONS.find((opt) => {
            const optLabel = opt.label.toLowerCase();
            return (
                optLabel === normalized ||
                optLabel.includes(normalized) ||
                normalized.includes(optLabel)
            );
        });

        if (builtInMatch) {
            if (!seenValues.has(builtInMatch.value)) {
                matched.push(builtInMatch);
                seenValues.add(builtInMatch.value);
            }
        } else {
            // No built-in category matches this custom document name.
            // Document.type in the database only accepts the fixed enum
            // values above, so this still saves as OTHER — but the
            // dropdown shows the admin's actual wording, and
            // handleFileUpload below decodes this composite value back
            // into { type: "OTHER", label: docName } at save time.
            const customValue = `OTHER::${docName}`;
            if (!seenValues.has(customValue)) {
                matched.push({ value: customValue, label: docName });
                seenValues.add(customValue);
            }
        }
    }

    // Always keep a plain "Other" option available as a fallback for
    // anything unexpected the client needs to upload outside the
    // configured checklist.
    if (!seenValues.has("OTHER")) {
        matched.push(
            DOCUMENT_TYPE_OPTIONS.find((o) => o.value === "OTHER")!
        );
    }

    return matched;
}

// Built-in step types where the whole point of the step IS getting a
// document from the client.
const DOCUMENT_BEARING_STEP_TYPES = [
    "DOCUMENT_COLLECTION",
    "LANGUAGE_TEST_RESULTS",
    "MEDICAL_EXAMINATION",
    "PASSPORT_SUBMISSION"
];

// A step gets the upload control only if it's one of the built-in
// document-bearing types above, OR the admin has explicitly listed
// required documents for it.
function stepNeedsDocuments(step: any): boolean {
    if (
        step.type &&
        DOCUMENT_BEARING_STEP_TYPES.includes(step.type)
    ) {
        return true;
    }

    return (
        Array.isArray(step.requiredDocuments) &&
        step.requiredDocuments.length > 0
    );
}

interface StepManagementProps {
    applicationId: string;
    currentStatus: string;
    steps: any[];
    country: string;

    // Called after any successful mutation.
    onRefresh?: () => void;
}

export default function StepManagement({
    applicationId,
    currentStatus,
    steps,
    country,
    onRefresh
}: StepManagementProps) {
    const t = useTranslations("agentStepManagement");
    const tStep = useTranslations("stepTypeLabels");

    const router = useRouter();
    const params = useParams();

    const locale = (params?.locale as string) || "en-US";

    const [appStatus, setAppStatus] = useState(currentStatus);
    const [loadingAppStatus, setLoadingAppStatus] = useState(false);
    const [loadingStepId, setLoadingStepId] = useState<string | null>(null);

    // MODAL States
    const [requestModal, setRequestModal] = useState<{
        stepId: string;
        stepName: string;
    } | null>(null);

    const [requestMsg, setRequestMsg] = useState("");
    const [isSubmittingRes, setIsSubmittingRes] = useState(false);
    const [successModal, setSuccessModal] = useState<string | null>(null);

    const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
    const [finalizeMessage, setFinalizeMessage] = useState("");
    const [loadingFinalize, setLoadingFinalize] = useState(false);

    const [uploadingStepId, setUploadingStepId] = useState<string | null>(
        null
    );

    const [loadingSubStepId, setLoadingSubStepId] = useState<string | null>(
        null
    );

    // Which document type is currently selected per step.
    const [docType, setDocType] = useState<Record<string, string>>({});

    // Refresh both server-rendered route and caller's own data source.
    const refreshAll = () => {
        router.refresh();
        onRefresh?.();
    };

    // ---------------------------------------------------------
    // SUB-STEP STATUS UPDATE
    // ---------------------------------------------------------
    const handleUpdateSubStep = async (
        subStepId: string,
        status: string
    ) => {
        setLoadingSubStepId(subStepId);

        const res = await toggleSubStepAction(
            subStepId,
            status as any
        );

        setLoadingSubStepId(null);

        if (res.error) {
            alert(res.error);
        } else {
            refreshAll();
        }
    };

    // ---------------------------------------------------------
    // DOCUMENT UPLOAD
    // ---------------------------------------------------------
    const handleFileUpload = async (
    stepId: string,
    file: File
) => {
    try {
        setUploadingStepId(stepId);

        const rawType = docType[stepId] || "OTHER";

        const [type, customLabel] = rawType.startsWith("OTHER::")
            ? ["OTHER", rawType.slice("OTHER::".length)]
            : [rawType, undefined];

        const label =
            customLabel ||
            DOCUMENT_TYPE_OPTIONS.find(
                (o) => o.value === type
            )?.label || file.name;

        // 1. Ask server for a secure S3 upload URL
        const prepared = await createDocumentUploadAction(
            stepId,
            file.name,
            file.type || "application/octet-stream",
            file.size
        );

        if (prepared.error || !prepared.uploadUrl || !prepared.storageKey) {
            alert(
                prepared.error ||
                "Failed to prepare document upload."
            );
            return;
        }

        // 2. Upload directly from browser to S3
        const uploadResponse = await fetch(
            prepared.uploadUrl,
            {
                method: "PUT",
                headers: {
                    "Content-Type":
                        file.type ||
                        "application/octet-stream"
                },
                body: file
            }
        );

        if (!uploadResponse.ok) {
            throw new Error(
                "S3 upload failed."
            );
        }

        // 3. Save the S3 key in PostgreSQL
        const result = await addDocumentAction(
            stepId,
            label,
            prepared.storageKey,
            type
        );

        if (result.error) {
            alert(result.error);
            return;
        }

        refreshAll();
    } catch (error: any) {
        console.error("Upload error:", error);

        alert(
            error?.message ||
            t("uploadFailed")
        );
    } finally {
        setUploadingStepId(null);
    }
};
    // ---------------------------------------------------------
    // DELETE DOCUMENT
    // ---------------------------------------------------------
    const handleDeleteDocument = async (documentId: string) => {
        if (!confirm(t("removeDocumentConfirm"))) return;

        const res = await deleteDocumentAction(documentId);

        if (res.error) {
            alert(res.error);
        } else {
            refreshAll();
        }
    };

    // Sort main workflow steps.
    const sortedSteps = [...steps].sort(
        (a, b) => a.order - b.order
    );

    // ---------------------------------------------------------
    // APPLICATION STATUS
    // ---------------------------------------------------------
    const handleUpdateAppStatus = async (status: string) => {
        setLoadingAppStatus(true);

        const res = await updateApplicationStatusAction(
            applicationId,
            status
        );

        setLoadingAppStatus(false);

        if (res.error) {
            alert(res.error);
        } else {
            setAppStatus(status);
            onRefresh?.();
        }
    };

    // ---------------------------------------------------------
    // FINALIZE PROCEDURE ACTION
    // ---------------------------------------------------------
    const handleFinalizeProcedure = async () => {
        setLoadingFinalize(true);

        const res = await finalizeProcedureAction(
            applicationId,
            finalizeMessage || undefined
        );

        setLoadingFinalize(false);

        if (res.error) {
            alert(res.error);
        } else {
            setAppStatus("COMPLETED");
            setFinalizeModalOpen(false);
            setSuccessModal(
                t("toastFinalizedSuccess", {
                    defaultValue:
                        "Procedure finalized successfully! The client has been notified."
                })
            );
            refreshAll();
        }
    };

    // ---------------------------------------------------------
    // MAIN STEP UPDATE
    // ---------------------------------------------------------
    const handleUpdateStep = async (
        stepId: string,
        data: any
    ) => {
        setLoadingStepId(stepId);

        const res = await updateStepAction(stepId, data);

        setLoadingStepId(null);

        if (res.error) {
            alert(res.error);
        } else {
            refreshAll();
        }
    };

    return (
        <div className="w-full space-y-8">

            {/* =====================================================
                GLOBAL STATUS CONTROL
            ===================================================== */}
            <div className="bg-white p-6 border border-gray-200 shadow-sm flex flex-col md:flex-row items-center gap-6 justify-between">

                <div>
                    <h3 className="text-lg font-bold text-gray-900">
                        {t("updateProcedureStatus")}
                    </h3>

                    <p className="text-sm text-gray-500">
                        {t("globalStatusControl")}
                    </p>
                </div>

                <div className="flex gap-2 items-center flex-wrap">
                    {[
                        {
                            value: "PENDING",
                            label: t("statusPending")
                        },
                        {
                            value: "IN_REVIEW",
                            label: t("statusInReview")
                        },
                        {
                            value: "APPROVED",
                            label: t("statusApproved")
                        },
                        {
                            value: "REJECTED",
                            label: t("statusRejected")
                        }
                    ].map(({ value: status, label }) => (
                        <button
                            key={status}
                            onClick={() =>
                                handleUpdateAppStatus(status)
                            }
                            disabled={loadingAppStatus}
                            className={`px-4 py-2 text-sm font-bold border ${
                                appStatus === status
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-white text-gray-700 hover:bg-gray-50 border-gray-300"
                            }`}
                        >
                            {label}
                        </button>
                    ))}

                    {loadingAppStatus && (
                        <Loader2 className="animate-spin h-5 w-5 text-blue-500" />
                    )}

                    <div className="h-6 w-px bg-gray-200 hidden sm:block mx-1" />

                    {appStatus === "COMPLETED" ? (
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-300 text-emerald-800 font-extrabold rounded-lg text-sm shadow-2xs">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span>
                                {t("procedureFinalized", {
                                    defaultValue: "Procedure Completed"
                                })}
                            </span>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => {
                                setFinalizeMessage(
                                    t("finalizeDefaultMessage", {
                                        defaultValue:
                                            "Congratulations! Your immigration procedure has been successfully completed. We were delighted to guide you through every step of this journey and wish you all the best for your future!"
                                    })
                                );
                                setFinalizeModalOpen(true);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold rounded-lg shadow-sm hover:shadow transition-all duration-200 text-sm"
                        >
                            <Sparkles className="h-4 w-4 text-amber-300" />
                            <span>
                                {t("finalizeProcedure", {
                                    defaultValue: "Finalize Procedure"
                                })}
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {/* =====================================================
                INDIVIDUAL STEP MANAGEMENT TABLE
            ===================================================== */}
            <div className="w-full overflow-x-auto bg-white border border-gray-200 shadow-sm">

                <table className="w-full text-left border-collapse">

                    {/* TABLE HEADER */}
                    <thead>
                        <tr className="bg-gray-100 border-b border-gray-200 text-sm font-bold text-gray-700">
                            <th className="p-4">
                                {t("colStepNumber")}
                            </th>

                            <th className="p-4">
                                {t("colStepName")}
                            </th>

                            <th className="p-4">
                                {t("colStatus")}
                            </th>

                            <th className="p-4">
                                {t("colLastUpdated")}
                            </th>

                            <th className="p-4">
                                {t("colAction")}
                            </th>
                        </tr>
                    </thead>

                    <tbody className="text-sm">

                        {sortedSteps.map((step, idx) => {
                            const dbStep = step;
                            const isLocked = step.isLocked;

                            const sortedSubSteps = (
                                step.subSteps || []
                            )
                                .slice()
                                .sort(
                                    (a: any, b: any) =>
                                        a.order - b.order
                                );

                            return (
                                <React.Fragment key={step.id}>

                                    {/* =================================================
                                        MAIN STEP ROW
                                    ================================================= */}
                                    <tr
                                        className={`border-b border-gray-100 ${
                                            isLocked
                                                ? "bg-gray-50 text-gray-400"
                                                : "text-gray-900 hover:bg-gray-50"
                                        }`}
                                    >

                                        {/* STEP NUMBER */}
                                        <td className="p-4 font-bold whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                {sortedSubSteps.length > 0 && (
                                                    <GitBranch className="h-4 w-4 text-blue-500" />
                                                )}

                                                <span>
                                                    {idx + 1}
                                                </span>
                                            </div>
                                        </td>

                                        {/* STEP NAME */}
                                        <td className="p-4 font-semibold text-gray-800">
                                            {step.type ===
                                            "PROFILE_CREATION"
                                                ? (
                                                    step.label ||
                                                    t(
                                                        "profileCreationDefaultLabel"
                                                    )
                                                )
                                                : (
                                                    step.label ||
                                                    tStep(
                                                        step.type as any
                                                    )
                                                )}
                                        </td>

                                        {/* MAIN STEP STATUS */}
                                        <td className="p-4">

                                            <select
                                                value={step.status}
                                                onChange={(e) =>
                                                    handleUpdateStep(
                                                        step.id,
                                                        {
                                                            status:
                                                                e.target
                                                                    .value
                                                        }
                                                    )
                                                }
                                                disabled={
                                                    !dbStep ||
                                                    loadingStepId ===
                                                        step.id
                                                }
                                                className="px-2 py-1 text-sm border border-gray-300 rounded cursor-pointer min-w-[120px]"
                                            >
                                                <option value="PENDING">
                                                    {t(
                                                        "stepStatusPending"
                                                    )}
                                                </option>

                                                <option value="IN_PROGRESS">
                                                    {t(
                                                        "stepStatusInProgress"
                                                    )}
                                                </option>

                                                <option value="APPROVED">
                                                    {t(
                                                        "stepStatusApproved"
                                                    )}
                                                </option>

                                                {idx >= 3 && (
                                                    <option value="ACTION_REQUIRED">
                                                        {t(
                                                            "stepStatusActionRequired"
                                                        )}
                                                    </option>
                                                )}
                                            </select>

                                            {loadingStepId ===
                                                step.id && (
                                                <span className="ml-2 text-xs text-blue-500">
                                                    ...
                                                </span>
                                            )}
                                        </td>

                                        {/* LAST UPDATED */}
                                        <td className="p-4">
                                            {dbStep
                                                ? new Date(
                                                      step.updatedAt
                                                  ).toLocaleDateString(
                                                      locale
                                                  )
                                                : "-"}
                                        </td>

                                        {/* ACTIONS */}
                                        <td className="p-4">

                                            <div className="flex flex-col gap-2">

                                                {/* Lock / Unlock Toggle */}
                                                {dbStep ? (
                                                    <div className="flex flex-wrap gap-2">

                                                        <button
                                                            onClick={() =>
                                                                handleUpdateStep(
                                                                    step.id,
                                                                    {
                                                                        isLocked:
                                                                            !step.isLocked
                                                                    }
                                                                )
                                                            }
                                                            disabled={
                                                                loadingStepId ===
                                                                step.id
                                                            }
                                                            className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest w-fit rounded ${
                                                                step.isLocked
                                                                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                                                                    : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                                            }`}
                                                        >
                                                            {step.isLocked
                                                                ? t(
                                                                      "unlockStep"
                                                                  )
                                                                : t(
                                                                      "lockStep"
                                                                  )}
                                                        </button>

                                                        {idx >= 3 &&
                                                            dbStep && (
                                                                <button
                                                                    onClick={() =>
                                                                        setRequestModal(
                                                                            {
                                                                                stepId:
                                                                                    step.id,
                                                                                stepName:
                                                                                    step.label ||
                                                                                    tStep(
                                                                                        step.type as any
                                                                                    )
                                                                            }
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        loadingStepId ===
                                                                        step.id
                                                                    }
                                                                    className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-amber-500 text-white hover:bg-amber-600 rounded-xl transition-all shadow-lg shadow-amber-100 flex items-center gap-2"
                                                                >
                                                                    {t(
                                                                        "requestModification"
                                                                    )}
                                                                </button>
                                                            )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic font-bold">
                                                        {t(
                                                            "legacyProcedure"
                                                        )}
                                                    </span>
                                                )}

                                                {/* =================================================
                                                    STEP 5 SPECIALIZED INPUT
                                                ================================================= */}
                                                {step.type ===
                                                    "DIPLOMA_EQUIVALENCE" &&
                                                    dbStep && (
                                                        <div className="mt-4 p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-3">

                                                            <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">
                                                                {t(
                                                                    "equivalenceDetails"
                                                                )}
                                                            </p>

                                                            <select
                                                                onChange={(e) =>
                                                                    handleUpdateStep(
                                                                        step.id,
                                                                        {
                                                                            organization:
                                                                                e
                                                                                    .target
                                                                                    .value
                                                                        }
                                                                    )
                                                                }
                                                                className="w-full text-xs font-bold p-2 border border-blue-200 rounded-lg bg-white"
                                                                defaultValue={
                                                                    step.description?.match(
                                                                        /Org: ([^|]+)/
                                                                    )?.[1]?.trim() ||
                                                                    ""
                                                                }
                                                            >
                                                                <option value="">
                                                                    {t(
                                                                        "selectOrganization"
                                                                    )}
                                                                </option>

                                                                <option value="WES">
                                                                    WES
                                                                </option>

                                                                <option value="ICAS">
                                                                    ICAS
                                                                </option>

                                                                <option value="IQAS">
                                                                    IQAS
                                                                </option>

                                                                <option value="ICES">
                                                                    ICES
                                                                </option>

                                                                <option value="MCC">
                                                                    MCC
                                                                </option>
                                                            </select>
                                                        </div>
                                                    )}

                                                {/* =================================================
                                                    LANGUAGE TEST REGISTRATION
                                                ================================================= */}
                                                {step.type ===
                                                    "LANGUAGE_TEST_REGISTRATION" &&
                                                    dbStep && (
                                                        <div className="mt-4 p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-3">

                                                            <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">
                                                                {t(
                                                                    "languageTest"
                                                                )}
                                                            </p>

                                                            <select
                                                                onChange={(e) =>
                                                                    handleUpdateStep(
                                                                        step.id,
                                                                        {
                                                                            languageTest:
                                                                                e
                                                                                    .target
                                                                                    .value
                                                                        }
                                                                    )
                                                                }
                                                                className="w-full text-xs font-bold p-2 border border-blue-200 rounded-lg bg-white"
                                                                defaultValue={
                                                                    step.description?.match(
                                                                        /Test: ([^|]+)/
                                                                    )?.[1]?.trim() ||
                                                                    ""
                                                                }
                                                            >
                                                                <option value="">
                                                                    {t(
                                                                        "selectTest"
                                                                    )}
                                                                </option>

                                                                <option value="TCF">
                                                                    TCF
                                                                </option>

                                                                <option value="TEF">
                                                                    TEF
                                                                </option>

                                                                <option value="IELTS">
                                                                    IELTS
                                                                </option>
                                                            </select>
                                                        </div>
                                                    )}

                                                {/* =================================================
                                                    REQUIRED DOCUMENTS
                                                ================================================= */}
                                                {step.requiredDocuments &&
                                                    step.requiredDocuments
                                                        .length >
                                                        0 && (
                                                        <div className="mt-4 p-4 bg-amber-50/60 border border-amber-100 rounded-xl space-y-2">

                                                            <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-1.5">
                                                                <FileCheck2 className="h-3.5 w-3.5" />

                                                                {t(
                                                                    "documentsNeeded"
                                                                )}
                                                            </span>

                                                            <div className="flex flex-wrap gap-1.5">

                                                                {step.requiredDocuments.map(
                                                                    (
                                                                        docName: string,
                                                                        i: number
                                                                    ) => {
                                                                        const isProvided =
                                                                            step.Document?.some(
                                                                                (
                                                                                    d: any
                                                                                ) =>
                                                                                    d.name
                                                                                        .toLowerCase()
                                                                                        .includes(
                                                                                            docName.toLowerCase()
                                                                                        )
                                                                            );

                                                                        return (
                                                                            <span
                                                                                key={
                                                                                    i
                                                                                }
                                                                                className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${
                                                                                    isProvided
                                                                                        ? "bg-green-50 border-green-200 text-green-700"
                                                                                        : "bg-white border-amber-200 text-amber-700"
                                                                                }`}
                                                                            >
                                                                                {
                                                                                    docName
                                                                                }
                                                                            </span>
                                                                        );
                                                                    }
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                {/* =================================================
                                                    VIEW DOCUMENTS
                                                ================================================= */}
                                                {step.Document &&
                                                    step.Document.length >
                                                        0 && (
                                                        <div className="mt-4 p-4 bg-gray-50 border border-gray-100 rounded-xl space-y-2">

                                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                                                                {t(
                                                                    "attachments"
                                                                )}
                                                            </span>

                                                            <div className="flex flex-col gap-1.5">

                                                                {step.Document.map(
                                                                    (
                                                                        doc: any
                                                                    ) => (
                                                                        <div
                                                                            key={
                                                                                doc.id
                                                                            }
                                                                            className="flex items-center justify-between gap-2"
                                                                        >
                                                                            <a
                                                                                href={
                                                                                    doc.fileUrl
                                                                                }
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-2"
                                                                            >
                                                                                <div className="h-1.5 w-1.5 bg-blue-400 rounded-full" />

                                                                                {doc.name.replace(
                                                                                    "_",
                                                                                    " "
                                                                                )}
                                                                            </a>

                                                                            {dbStep && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() =>
                                                                                        handleDeleteDocument(
                                                                                            doc.id
                                                                                        )
                                                                                    }
                                                                                    className="text-[10px] font-black text-red-400 hover:text-red-600 uppercase tracking-widest"
                                                                                >
                                                                                    Remove
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                {/* =================================================
                                                    DOCUMENT UPLOAD
                                                ================================================= */}
                                                {dbStep &&
                                                    stepNeedsDocuments(
                                                        step
                                                    ) && (
                                                        <div className="mt-3 p-3 bg-gray-50 border border-gray-100 rounded-xl flex flex-wrap items-center gap-2">

                                                            <div className="relative">

                                                                {(() => {
                                                                    const stepDocOptions = getDocumentOptionsForStep(step);
                                                                    return (
                                                                <select
                                                                    value={
                                                                        docType[
                                                                            step
                                                                                .id
                                                                        ] ||
                                                                        stepDocOptions[0]?.value ||
                                                                        "OTHER"
                                                                    }
                                                                    onChange={(
                                                                        e
                                                                    ) =>
                                                                        setDocType(
                                                                            (
                                                                                prev
                                                                            ) => ({
                                                                                ...prev,
                                                                                [step.id]:
                                                                                    e
                                                                                        .target
                                                                                        .value
                                                                            })
                                                                        )
                                                                    }
                                                                    className="appearance-none text-xs font-bold pl-3 pr-7 py-2 border border-gray-200 rounded-lg bg-white text-gray-700 cursor-pointer"
                                                                >
                                                                    {stepDocOptions.map(
                                                                        (
                                                                            opt
                                                                        ) => (
                                                                            <option
                                                                                key={
                                                                                    opt.value
                                                                                }
                                                                                value={
                                                                                    opt.value
                                                                                }
                                                                            >
                                                                                {
                                                                                    opt.label
                                                                                }
                                                                            </option>
                                                                        )
                                                                    )}
                                                                </select>
                                                                    );
                                                                })()}

                                                                <ChevronDown className="h-3 w-3 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                            </div>

                                                            <div className="relative">

                                                                <div
                                                                    className={`inline-flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                                                        uploadingStepId ===
                                                                        step.id
                                                                            ? "bg-gray-100 text-gray-400"
                                                                            : "bg-blue-600 text-white hover:bg-blue-700"
                                                                    }`}
                                                                >
                                                                    {uploadingStepId ===
                                                                    step.id ? (
                                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                    ) : (
                                                                        <>
                                                                            <Upload className="h-3.5 w-3.5" />

                                                                            <span>
                                                                                {t(
                                                                                    "uploadFile"
                                                                                )}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>

                                                                {uploadingStepId !==
                                                                    step.id && (
                                                                    <div className="absolute inset-0 opacity-0">
                                                                       <div className="relative">
    <input
        type="file"
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        disabled={uploadingStepId === step.id}
        onChange={(e) => {
            const file = e.target.files?.[0];

            if (file) {
                handleFileUpload(
                    step.id,
                    file
                );
            }

            e.currentTarget.value = "";
        }}
    />

    <div
        className={`inline-flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
            uploadingStepId === step.id
                ? "bg-gray-100 text-gray-400"
                : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
    >
        {uploadingStepId === step.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
            <>
                <Upload className="h-3.5 w-3.5" />

                <span>
                    {t("uploadFile")}
                </span>
            </>
        )}
    </div>
</div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <span className="text-[10px] text-gray-400 font-semibold">
                                                                {t(
                                                                    "fileTypesHint"
                                                                )}
                                                            </span>
                                                        </div>
                                                    )}
                                            </div>
                                        </td>
                                    </tr>

                                    {/* =========================================================
                                        SUB-STEPS
                                        IMPORTANT:
                                        They are REAL TABLE ROWS directly under parent step.
                                        They are NOT inside the Action column anymore.
                                    ========================================================= */}
                                    {sortedSubSteps.length > 0 && (
                                        <>
                                            {/* SUB-STEP SECTION HEADER */}
                                            <tr className="bg-blue-50/40 border-b border-blue-100">
                                                <td
                                                    colSpan={5}
                                                    className="px-4 py-2"
                                                >
                                                    <div className="flex items-center gap-2 ml-8">

                                                        <GitBranch className="h-3.5 w-3.5 text-blue-500" />

                                                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                                                            {t(
                                                                "subStepsLabel"
                                                            )}
                                                        </span>

                                                        <span className="text-[10px] font-bold text-gray-400">
                                                            {sortedSubSteps.length}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* SUB-STEP ROWS */}
                                            {sortedSubSteps.map(
                                                (
                                                    sub: any,
                                                    subIndex: number
                                                ) => (
                                                    <tr
                                                        key={sub.id}
                                                        className="border-b border-gray-100 bg-gray-50/50 hover:bg-blue-50/30 transition-colors"
                                                    >

                                                        {/* SUB-STEP NUMBER */}
                                                        <td className="p-3 pl-12">

                                                            <div className="flex items-center gap-2">

                                                                <span className="text-gray-300 font-bold">
                                                                    └
                                                                </span>

                                                                <span className="text-xs font-black text-gray-500">
                                                                    {idx + 1}.
                                                                    {subIndex +
                                                                        1}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        {/* SUB-STEP NAME */}
                                                        <td className="p-3">

                                                            <div className="flex flex-col">

                                                                <span
                                                                    className={`text-sm font-semibold ${
                                                                        sub.status ===
                                                                        "APPROVED"
                                                                            ? "text-gray-400 line-through"
                                                                            : "text-gray-700"
                                                                    }`}
                                                                >
                                                                    {
                                                                        sub.label
                                                                    }
                                                                </span>

                                                                {sub.description && (
                                                                    <span className="text-[11px] text-gray-400 mt-0.5">
                                                                        {
                                                                            sub.description
                                                                        }
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* SUB-STEP STATUS */}
                                                        <td className="p-3">

                                                            <select
                                                                value={
                                                                    sub.status ||
                                                                    (sub.isCompleted
                                                                        ? "APPROVED"
                                                                        : "PENDING")
                                                                }
                                                                onChange={(
                                                                    e
                                                                ) =>
                                                                    handleUpdateSubStep(
                                                                        sub.id,
                                                                        e
                                                                            .target
                                                                            .value
                                                                    )
                                                                }
                                                                disabled={
                                                                    loadingSubStepId ===
                                                                        sub.id ||
                                                                    step.status ===
                                                                        "APPROVED"
                                                                }
                                                                className="px-2 py-1 text-sm border border-gray-300 rounded cursor-pointer min-w-[120px] bg-white"
                                                            >
                                                                <option value="PENDING">
                                                                    {t(
                                                                        "stepStatusPending"
                                                                    )}
                                                                </option>

                                                                <option value="IN_PROGRESS">
                                                                    {t(
                                                                        "stepStatusInProgress"
                                                                    )}
                                                                </option>

                                                                <option value="APPROVED">
                                                                    {t(
                                                                        "stepStatusApproved"
                                                                    )}
                                                                </option>

                                                                <option value="REJECTED">
                                                                    {t(
                                                                        "stepStatusRejected"
                                                                    )}
                                                                </option>

                                                                <option value="ACTION_REQUIRED">
                                                                    {t(
                                                                        "stepStatusActionRequired"
                                                                    )}
                                                                </option>
                                                            </select>

                                                            {loadingSubStepId ===
                                                                sub.id && (
                                                                <span className="ml-2 text-xs text-blue-500">
                                                                    ...
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* SUB-STEP LAST UPDATED */}
                                                        <td className="p-3 text-gray-500">

                                                            {sub.updatedAt
                                                                ? new Date(
                                                                      sub.updatedAt
                                                                  ).toLocaleDateString(
                                                                      locale
                                                                  )
                                                                : "-"}
                                                        </td>

                                                        {/* SUB-STEP ACTION */}
                                                        <td className="p-3">

                                                            <span
                                                                className={`inline-flex items-center px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                                                                    sub.status ===
                                                                    "APPROVED"
                                                                        ? "bg-emerald-100 text-emerald-700"
                                                                        : sub.status ===
                                                                          "IN_PROGRESS"
                                                                        ? "bg-blue-100 text-blue-700"
                                                                        : sub.status ===
                                                                          "REJECTED"
                                                                        ? "bg-red-100 text-red-700"
                                                                        : "bg-gray-100 text-gray-500"
                                                                }`}
                                                            >
                                                                {t(
                                                                    "subStepsLabel"
                                                                )}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )
                                            )}

                                            {/* SUB-STEP APPROVAL REQUIREMENT */}
                                            {step.status !== "APPROVED" &&
                                                sortedSubSteps.some(
                                                    (sub: any) =>
                                                        sub.status !==
                                                        "APPROVED"
                                                ) && (
                                                    <tr className="border-b border-gray-100 bg-amber-50/40">
                                                        <td
                                                            colSpan={5}
                                                            className="px-4 py-2"
                                                        >
                                                            <p className="text-[10px] font-semibold text-amber-600 ml-12">
                                                                {t(
                                                                    "subStepsMustBeApproved"
                                                                )}
                                                            </p>
                                                        </td>
                                                    </tr>
                                                )}
                                        </>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* =====================================================
                REQUEST MODAL
            ===================================================== */}
            {requestModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">

                    <div className="bg-white rounded-[40px] p-10 max-w-lg w-full shadow-2xl space-y-6">

                        <div className="flex items-center gap-4 border-b-2 border-gray-50 pb-6">

                            <div className="bg-amber-50 p-3 rounded-2xl text-amber-600">
                                <Loader2
                                    size={24}
                                    className={
                                        isSubmittingRes
                                            ? "animate-spin"
                                            : ""
                                    }
                                />
                            </div>

                            <div>

                                <h3 className="text-2xl font-black text-gray-900 tracking-tighter uppercase leading-none">
                                    {t(
                                        "modificationRequestTitle"
                                    )}
                                </h3>

                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">
                                    {t("stepPrefix")}{" "}
                                    {requestModal?.stepName}
                                </p>

                            </div>
                        </div>

                        <div className="space-y-4">

                            <p className="text-sm font-bold text-gray-500 leading-relaxed">
                                {t("describeChange")}
                            </p>

                            <textarea
                                value={requestMsg}
                                onChange={(e) =>
                                    setRequestMsg(e.target.value)
                                }
                                className="w-full h-32 p-4 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-amber-50 focus:border-amber-500 transition-all outline-none text-sm font-medium"
                                placeholder={t(
                                    "reasonPlaceholder"
                                )}
                            />
                        </div>

                        <div className="flex gap-4">

                            <button
                                onClick={() => {
                                    setRequestModal(null);
                                    setRequestMsg("");
                                }}
                                className="flex-1 bg-gray-100 text-gray-500 font-black py-4 rounded-2xl hover:bg-gray-200 transition-all uppercase tracking-widest text-xs"
                            >
                                {t("cancel")}
                            </button>

                            <button
                                onClick={async () => {
                                    if (
                                        !requestMsg.trim() ||
                                        !requestModal
                                    )
                                        return;

                                    setIsSubmittingRes(true);

                                    const res =
                                        await updateStepAction(
                                            requestModal.stepId,
                                            {
                                                status:
                                                    "ACTION_REQUIRED",
                                                description:
                                                    requestMsg
                                            }
                                        );

                                    setIsSubmittingRes(false);

                                    if (res.error) {
                                        alert(res.error);
                                    } else {
                                        setRequestModal(null);
                                        setRequestMsg("");
                                        refreshAll();
                                    }
                                }}
                                disabled={isSubmittingRes}
                                className="flex-1 bg-amber-500 text-white font-black py-4 rounded-2xl hover:bg-amber-600 transition-all uppercase tracking-widest text-xs shadow-lg shadow-amber-100 disabled:opacity-50"
                            >
                                {isSubmittingRes
                                    ? t("sending")
                                    : t(
                                          "sendRequestToClient"
                                      )}
                            </button>

                        </div>
                    </div>
                </div>
            )}

            {/* =====================================================
                FINALIZE PROCEDURE MODAL
            ===================================================== */}
            {finalizeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="h-11 w-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
                                    <Sparkles className="h-6 w-6 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 leading-tight">
                                        {t("finalizeProcedureTitle", {
                                            defaultValue:
                                                "Finalize Procedure & Notify Client"
                                        })}
                                    </h3>
                                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                                        {t("finalizeProcedureSubtitle", {
                                            defaultValue:
                                                "Mark this procedure as completed and send a confirmation message to the client."
                                        })}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFinalizeModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-2 pt-1">
                            <label className="text-xs font-bold text-gray-700">
                                {t("finalizeMessageLabel", {
                                    defaultValue:
                                        "Completion message for client:"
                                })}
                            </label>
                            <textarea
                                rows={4}
                                value={finalizeMessage}
                                onChange={(e) =>
                                    setFinalizeMessage(e.target.value)
                                }
                                className="w-full text-xs p-3.5 rounded-2xl border border-gray-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all leading-relaxed"
                            />
                            <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl flex items-center gap-2 text-[11px] text-emerald-800 font-medium">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                <span>
                                    An official message and notification will be delivered to the client immediately.
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                            <button
                                type="button"
                                disabled={loadingFinalize}
                                onClick={() => setFinalizeModalOpen(false)}
                                className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                {t("cancel", { defaultValue: "Cancel" })}
                            </button>
                            <button
                                type="button"
                                disabled={loadingFinalize}
                                onClick={handleFinalizeProcedure}
                                className="px-5 py-2.5 text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {loadingFinalize ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>
                                            {t("finalizing", {
                                                defaultValue: "Finalizing..."
                                            })}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span>
                                            {t("confirmFinalize", {
                                                defaultValue:
                                                    "Confirm & Finalize"
                                            })}
                                        </span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =====================================================
                SUCCESS MODAL
            ===================================================== */}
            {successModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">

                    <div className="bg-white rounded-[40px] p-10 max-w-sm w-full text-center space-y-6">

                        <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto text-4xl">
                            ✓
                        </div>

                        <h3 className="text-2xl font-black text-gray-900 tracking-tighter uppercase leading-none">
                            {successModal}
                        </h3>

                        <button
                            onClick={() =>
                                setSuccessModal(null)
                            }
                            className="w-full bg-[#1E3A8A] text-white font-black py-4 rounded-2xl hover:bg-blue-900 transition-all uppercase tracking-widest"
                        >
                            {t("understood")}
                        </button>

                    </div>
                </div>
            )}
        </div>
    );
}