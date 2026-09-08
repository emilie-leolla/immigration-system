"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MailCheck, LifeBuoy } from "lucide-react";
import { useTranslations } from "next-intl";
import { sendSupportRequestAction } from "./actions";

export default function SupportPage() {
    const t = useTranslations("adminSupport");

    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const formData = new FormData();
            formData.set("subject", subject.trim());
            formData.set("message", message.trim());

            const result = await sendSupportRequestAction(formData);

            if (result?.error) {
                setError(result.error);
                return;
            }

            setSent(true);
            setSubject("");
            setMessage("");
        } catch (err) {
            console.error("Support request error:", err);
            setError(t("errorUnexpected"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-4 py-8">
            <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <LifeBuoy className="h-5 w-5" style={{ color: "#1E3A8A" }} />
                </div>
                <h1 className="text-2xl font-bold" style={{ color: "#1E3A8A" }}>
                    {t("title")}
                </h1>
            </div>
            <p className="text-gray-500 text-sm mb-8">{t("subtitle")}</p>

            <div
                className="bg-white p-8"
                style={{ boxShadow: "0 4px 20px rgba(0, 0, 0, 0.06)", borderRadius: "12px" }}
            >
                {sent ? (
                    <div className="text-center py-8">
                        <div className="h-14 w-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                            <MailCheck className="h-7 w-7 text-green-600" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 mb-2">{t("successTitle")}</h2>
                        <p className="text-gray-500 text-sm mb-6">{t("successMessage")}</p>
                        <Button
                            variant="outline"
                            onClick={() => setSent(false)}
                            className="rounded-xl"
                        >
                            {t("sendAnother")}
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded">
                                {error}
                            </div>
                        )}

                        <div>
                            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                                {t("subjectLabel")}
                            </label>
                            <Input
                                id="subject"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder={t("subjectPlaceholder")}
                                required
                                disabled={loading}
                                maxLength={150}
                            />
                        </div>

                        <div>
                            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                                {t("messageLabel")}
                            </label>
                            <Textarea
                                id="message"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder={t("messagePlaceholder")}
                                required
                                disabled={loading}
                                rows={6}
                                maxLength={2000}
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full text-white font-medium py-2.5 rounded-xl hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: "#1E3A8A" }}
                        >
                            {loading ? t("sending") : t("send")}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    );
}