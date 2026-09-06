"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getMyAgencySubscriptionStatus } from "@/lib/agency-actions";
import { useUpgradeDialog } from "./upgrade-dialog-context";

const SESSION_FLAG_KEY = "freeModeDialogShown";

/**
 * The upgrade dialog itself. Opens in two situations:
 *  1. Automatically, once per login session, the first time an admin on
 *     the free plan lands on the dashboard.
 *  2. Manually, any time useUpgradeDialog().openUpgradeDialog() is called
 *     elsewhere — e.g. when creating an agent/client is blocked because
 *     the plan's limit was reached.
 */
export function FreeModeDialog() {
    const t = useTranslations("freeModeDialog");
    const router = useRouter();
    const { open, setOpen, openUpgradeDialog } = useUpgradeDialog();

    useEffect(() => {
        let cancelled = false;

        if (typeof window !== "undefined" && sessionStorage.getItem(SESSION_FLAG_KEY)) {
            return;
        }

        getMyAgencySubscriptionStatus().then((status) => {
            if (!cancelled && status === "FREE") {
                openUpgradeDialog();
                sessionStorage.setItem(SESSION_FLAG_KEY, "1");
            }
        });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="h-11 w-11 rounded-full bg-blue-50 flex items-center justify-center mb-2">
                        <Sparkles className="h-5 w-5 text-[#1E3A8A]" />
                    </div>
                    <DialogTitle>{t("title")}</DialogTitle>
                    <DialogDescription>{t("description")}</DialogDescription>
                </DialogHeader>

                <DialogFooter className="gap-2 sm:gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        className="w-full sm:w-auto"
                    >
                        {t("continueButton")}
                    </Button>
                    <Button
                        onClick={() => {
                            setOpen(false);
                            router.push("/admin/dashboard/billing");
                        }}
                        className="w-full sm:w-auto text-white"
                        style={{ backgroundColor: "#1E3A8A" }}
                    >
                        {t("upgradeButton")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}