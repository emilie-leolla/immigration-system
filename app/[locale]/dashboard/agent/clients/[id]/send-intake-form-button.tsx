"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { sendIntakeFormLinkAction } from "./actions";

export default function SendIntakeFormButton({ clientId }: { clientId: string }) {
    const t = useTranslations("agentClientDetail");
    const [loading, setLoading] = useState(false);

    const handleClick = async () => {
        setLoading(true);
        try {
            const result = await sendIntakeFormLinkAction(clientId);
            if (result?.error) {
                toast.error(result.error);
                return;
            }
            toast.success(t("intakeFormSentToast"));
        } catch (e) {
            console.error(e);
            toast.error(t("intakeFormErrorToast"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleClick}
            disabled={loading}
            className="gap-2 rounded-xl text-xs font-bold"
        >
            {loading ? (
                <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("sendingIntakeForm")}
                </>
            ) : (
                <>
                    <Send className="h-3.5 w-3.5" />
                    {t("sendIntakeForm")}
                </>
            )}
        </Button>
    );
}