"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Plus,
    ListOrdered,
    Loader2,
    Trash2,
    AlertCircle,
    ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { createTemplateAction, deleteTemplateAction } from "./actions";
import type { TemplateSummary } from "@/lib/steps-server";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useUpgradeDialog } from "@/app/[locale]/admin/dashboard/upgrade-dialog-context";

export default function TemplateList({
    initialTemplates,
}: {
    initialTemplates: TemplateSummary[];
}) {
    const t = useTranslations("adminSteps");
    const locale = useLocale();
    const router = useRouter();
    const { openUpgradeDialog } = useUpgradeDialog();

    const [templates, setTemplates] = useState(initialTemplates);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [error, setError] = useState("");
    const [isPending, startTransition] = useTransition();

    const [deleteTemplate, setDeleteTemplate] =
        useState<TemplateSummary | null>(null);
    const [deleteConfirmName, setDeleteConfirmName] = useState("");

    function handleCreate(e: React.FormEvent) {
        e.preventDefault();

        setError("");

        startTransition(async () => {
            const result = await createTemplateAction(name, description);

            if (result?.error) {
                if (result.code === "QUOTA_EXCEEDED") {
                    setIsCreateOpen(false);
                    openUpgradeDialog();
                    return;
                }
                setError(result.error);
                return;
            }

            if (!result?.templateId) {
                setError(t("createError"));
                return;
            }

            /*
             * IMPORTANT:
             *
             * Do NOT use window.location.href here.
             *
             * window.location.href causes a complete browser reload,
             * including the dashboard sidebar and header.
             *
             * router.push() performs a Next.js client-side navigation,
             * allowing the existing dashboard layout to remain mounted.
             */
            setIsCreateOpen(false);

            router.push(
                `/${locale}/admin/dashboard/steps/${result.templateId}`
            );
        });
    }

    function requestDelete(tpl: TemplateSummary) {
        setDeleteConfirmName("");
        setDeleteTemplate(tpl);
    }

    function handleDelete(
        templateId: string,
        confirmationName: string
    ) {
        startTransition(async () => {
            const result = await deleteTemplateAction(
                templateId,
                confirmationName
            );

            if (result?.error) {
                toast.error(result.error);
            } else {
                setTemplates((prev) =>
                    prev.filter((t) => t.id !== templateId)
                );

                toast.success(t("toastRemoved"));
            }
        });
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button
                    onClick={() => {
                        setError("");
                        setName("");
                        setDescription("");
                        setIsCreateOpen(true);
                    }}
                    className="bg-[#1E3A8A] text-white hover:bg-blue-900 font-bold rounded-xl gap-2"
                >
                    <Plus className="h-4 w-4" />
                    {t("newWorkflow")}
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {templates.map((tpl) => (
                    <Card
                        key={tpl.id}
                        className="border-none shadow-lg rounded-2xl overflow-hidden group"
                    >
                        <CardContent className="p-5 flex items-start justify-between gap-3">
                            <Link
                                href={`/${locale}/admin/dashboard/steps/${tpl.id}`}
                                className="flex-1 min-w-0"
                            >
                                <div className="flex items-center gap-2 text-gray-400 mb-2">
                                    <ListOrdered className="h-4 w-4" />

                                    <span className="text-xs font-bold uppercase tracking-wide">
                                        {t("stepCount", {
                                            count: tpl.stepCount,
                                        })}
                                    </span>
                                </div>

                                <p className="font-black text-gray-900 truncate">
                                    {tpl.name}
                                </p>

                                {tpl.description && (
                                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                        {tpl.description}
                                    </p>
                                )}
                            </Link>

                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    type="button"
                                    onClick={() =>
                                        requestDelete(tpl)
                                    }
                                    className="p-2 text-gray-300 hover:text-red-600 transition-colors rounded-lg"
                                    title={t(
                                        "removeWorkflowTooltip"
                                    )}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>

                                <Link
                                    href={`/${locale}/admin/dashboard/steps/${tpl.id}`}
                                >
                                    <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-[#1E3A8A] transition-colors" />
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {deleteTemplate && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
                        <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                                <Trash2 className="h-5 w-5" />
                            </div>

                            <div>
                                <h2 className="text-lg font-black text-gray-900">
                                    {t(
                                        "removeConfirmTitle",
                                        {
                                            name: deleteTemplate.name,
                                        }
                                    )}
                                </h2>

                                <p className="text-sm text-gray-500 mt-1">
                                    {t(
                                        "removeConfirmDescription"
                                    )}
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 space-y-2">
                            <Label>
                                {t(
                                    "confirmWorkflowNameLabel"
                                )}
                            </Label>

                            <p className="text-xs text-gray-400">
                                {t(
                                    "confirmWorkflowNameHint"
                                )}
                            </p>

                            <Input
                                autoFocus
                                value={deleteConfirmName}
                                onChange={(e) =>
                                    setDeleteConfirmName(
                                        e.target.value
                                    )
                                }
                                placeholder={deleteTemplate.name}
                                disabled={isPending}
                                onKeyDown={(e) => {
                                    if (
                                        e.key === "Enter" &&
                                        deleteConfirmName.trim() ===
                                            deleteTemplate.name
                                    ) {
                                        e.preventDefault();

                                        handleDelete(
                                            deleteTemplate.id,
                                            deleteConfirmName.trim()
                                        );

                                        setDeleteTemplate(null);
                                        setDeleteConfirmName("");
                                    }
                                }}
                            />
                        </div>

                        <div className="flex justify-end gap-2 mt-5">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setDeleteTemplate(null);
                                    setDeleteConfirmName("");
                                }}
                                disabled={isPending}
                                className="rounded-xl"
                            >
                                {t("cancel")}
                            </Button>

                            <Button
                                disabled={
                                    isPending ||
                                    deleteConfirmName.trim() !==
                                        deleteTemplate.name
                                }
                                onClick={() => {
                                    handleDelete(
                                        deleteTemplate.id,
                                        deleteConfirmName.trim()
                                    );

                                    setDeleteTemplate(null);
                                    setDeleteConfirmName("");
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white rounded-xl gap-2"
                            >
                                {isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Trash2 className="h-4 w-4" />
                                )}

                                {t("remove")}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <Dialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
            >
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-[#1E3A8A]">
                            {t("createDialogTitle")}
                        </DialogTitle>

                        <DialogDescription>
                            {t("createDialogDescription")}
                        </DialogDescription>
                    </DialogHeader>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-sm">
                            <AlertCircle className="shrink-0 w-4 h-4 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form
                        onSubmit={handleCreate}
                        className="space-y-4"
                    >
                        <div className="space-y-1.5">
                            <Label>{t("nameLabel")}</Label>

                            <Input
                                value={name}
                                onChange={(e) =>
                                    setName(e.target.value)
                                }
                                placeholder={t(
                                    "namePlaceholder"
                                )}
                                disabled={isPending}
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label>
                                {t("descriptionLabel")}
                            </Label>

                            <Textarea
                                value={description}
                                onChange={(e) =>
                                    setDescription(
                                        e.target.value
                                    )
                                }
                                disabled={isPending}
                                className="min-h-[70px]"
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={isPending}
                            className="w-full bg-[#1E3A8A] text-white hover:bg-blue-900 font-bold h-11 rounded-xl"
                        >
                            {isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                t("createAndBuild")
                            )}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}