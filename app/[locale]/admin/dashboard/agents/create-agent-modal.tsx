"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Eye, EyeOff } from "lucide-react";
import { createAgentAction } from "./actions";
import { useTranslations } from "next-intl";
import { useUpgradeDialog } from "@/app/[locale]/admin/dashboard/upgrade-dialog-context";

export default function CreateAgentModal() {
    const t = useTranslations("adminAgents.create");
    const { openUpgradeDialog } = useUpgradeDialog();
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const res = await createAgentAction(formData);

        setLoading(false);

        if (res.error) {
            if (res.code === "QUOTA_EXCEEDED") {
                setIsOpen(false);
                openUpgradeDialog();
            } else {
                setError(res.error);
            }
        } else {
            setIsOpen(false);
        }
    }

    return (
        <>
            <Button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 text-white font-black px-6"
                style={{ backgroundColor: "#1E3A8A", borderRadius: "12px" }}
            >
                <Plus size={16} />
                {t("button")}
            </Button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative border-none">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="absolute top-6 right-6 text-gray-400 hover:text-gray-700 font-bold"
                        >
                            ✕
                        </button>

                        <h2 className="text-2xl font-black mb-1 text-[#1E3A8A]">{t("title")}</h2>
                        <p className="text-sm text-gray-500 mb-8 font-medium">{t("subtitle")}</p>

                        {error && (
                            <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold border border-red-100 uppercase tracking-tight">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t("fullName")}</label>
                                <input
                                    name="name"
                                    type="text"
                                    required
                                    maxLength={50}
                                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-200 outline-none font-bold"
                                    placeholder={t("fullNamePlaceholder")}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t("email")}</label>
                                <input
                                    name="email"
                                    type="email"
                                    required
                                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-200 outline-none font-bold"
                                    placeholder={t("emailPlaceholder")}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t("password")}</label>
                                <div className="relative">
                                    <input
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        minLength={6}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-200 outline-none font-bold pr-12"
                                        placeholder={t("passwordPlaceholder")}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="pt-6 flex justify-end gap-3">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setIsOpen(false)}
                                    disabled={loading}
                                    className="font-bold text-gray-500 rounded-xl"
                                >
                                    {t("cancel")}
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={loading}
                                    style={{ backgroundColor: "#1E3A8A" }}
                                    className="text-white font-black rounded-xl px-8 shadow-lg shadow-blue-100"
                                >
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    {loading ? t("creating") : t("save")}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}