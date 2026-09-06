"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { LOGOS } from "@/lib/branding";
import { registerAgencyAdminAction } from "./actions";

const RESEND_COOLDOWN_SECONDS = 30;

export default function AdminRegisterPage() {
    const t = useTranslations("adminAuth.register");
    const locale = useLocale();
    const router = useRouter();

    const [step, setStep] = useState<"form" | "otp">("form");

    const [agencyName, setAgencyName] = useState("");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [profession, setProfession] = useState("");
    const [address, setAddress] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [otp, setOtp] = useState("");
    const [resendCooldown, setResendCooldown] = useState(0);

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const startResendCooldown = () => {
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        const interval = setInterval(() => {
            setResendCooldown((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError(t("errorPasswordsMismatch"));
            return;
        }

        setLoading(true);

        try {
            const formData = new FormData();
            formData.set("agencyName", agencyName.trim());
            formData.set("name", name.trim());
            formData.set("email", email.trim());
            formData.set("profession", profession.trim());
            formData.set("address", address.trim());
            formData.set("password", password);
            formData.set("confirmPassword", confirmPassword);

            const result = await registerAgencyAdminAction(formData, locale);

            if (result?.error) {
                setError(result.error);
                return;
            }

            // Account exists now, but is unverified — send the OTP and
            // move to the verification step.
            const otpResult = await authClient.emailOtp.sendVerificationOtp({
                email: email.trim(),
                type: "email-verification",
            });

            if (otpResult.error) {
                setError(t("otpErrorSendFailed"));
                router.push("/sign-in");
                return;
            }

            startResendCooldown();
            setStep("otp");
        } catch (err) {
            console.error("Agency registration error:", err);
            setError(t("errorUnexpected"));
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (otp.length !== 6) {
            setError(t("otpErrorLength"));
            return;
        }

        setLoading(true);

        try {
            const result = await authClient.emailOtp.verifyEmail({
                email: email.trim(),
                otp,
            });

            if (result.error) {
                setError(result.error.message || t("otpErrorInvalid"));
                return;
            }

            // autoSignInAfterVerification is enabled on the server, so the
            // session is already set at this point.
            router.push("/admin/dashboard");
        } catch (err) {
            console.error("OTP verification error:", err);
            setError(t("errorUnexpected"));
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0) return;
        setError("");

        try {
            const result = await authClient.emailOtp.sendVerificationOtp({
                email: email.trim(),
                type: "email-verification",
            });

            if (result.error) {
                setError(t("otpErrorResendFailed"));
                return;
            }

            startResendCooldown();
        } catch (err) {
            console.error("Resend OTP error:", err);
            setError(t("otpErrorResendFailed"));
        }
    };

    if (step === "otp") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div
                    className="w-full max-w-md bg-white p-8"
                    style={{
                        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
                        borderRadius: "8px",
                    }}
                >
                    <div className="text-center mb-8">
                        <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
                            <MailCheck className="h-6 w-6" style={{ color: "#1E3A8A" }} />
                        </div>
                        <h1 className="text-2xl font-bold mb-2" style={{ color: "#1E3A8A" }}>
                            {t("otpCheckEmailTitle")}
                        </h1>
                        <p className="text-gray-500 text-sm">
                            {t("otpCheckEmailSubtitle", { email })}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleVerifyOtp} className="space-y-5">
                        <div>
                            <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                                {t("otpCodeLabel")}
                            </label>
                            <Input
                                id="otp"
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                value={otp}
                                onChange={(e) =>
                                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                                }
                                placeholder="123456"
                                required
                                disabled={loading}
                                className="w-full text-center text-2xl tracking-[0.5em] font-bold"
                                maxLength={6}
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full text-white font-medium py-2.5 rounded hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: "#1E3A8A", borderRadius: "8px" }}
                        >
                            {loading ? t("otpVerifying") : t("otpVerifyButton")}
                        </Button>
                    </form>

                    <div className="mt-6 text-center text-sm">
                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={resendCooldown > 0}
                            className="font-semibold text-[#1E3A8A] hover:underline disabled:text-gray-400 disabled:no-underline"
                        >
                            {resendCooldown > 0
                                ? t("otpResendCooldown", { seconds: resendCooldown })
                                : t("otpResend")}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 py-10">
            <div
                className="w-full max-w-lg bg-white p-8"
                style={{
                    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
                    borderRadius: "8px",
                }}
            >
                <div className="text-center mb-8">
                    <Image
                        src={LOGOS.login}
                        alt="Procédure Facile"
                        width={600}
                        height={300}
                        className="h-20 w-auto mx-auto mb-4 object-contain"
                        priority
                    />
                    <h1 className="text-3xl font-bold mb-2" style={{ color: "#1E3A8A" }}>
                        {t("title")}
                    </h1>
                    <p className="text-gray-500 text-sm">{t("subtitle")}</p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded">
                        {error}
                    </div>
                )}

                <form onSubmit={handleRegister} className="space-y-5">
                    <div>
                        <label htmlFor="agencyName" className="block text-sm font-medium text-gray-700 mb-1">
                            {t("agencyName")}
                        </label>
                        <Input
                            id="agencyName"
                            type="text"
                            value={agencyName}
                            onChange={(e) => setAgencyName(e.target.value)}
                            placeholder={t("agencyNamePlaceholder")}
                            required
                            disabled={loading}
                            className="w-full"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                                {t("fullName")}
                            </label>
                            <Input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t("fullNamePlaceholder")}
                                required
                                disabled={loading}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label htmlFor="profession" className="block text-sm font-medium text-gray-700 mb-1">
                                {t("profession")}
                            </label>
                            <Input
                                id="profession"
                                type="text"
                                value={profession}
                                onChange={(e) => setProfession(e.target.value)}
                                placeholder={t("professionPlaceholder")}
                                required
                                disabled={loading}
                                className="w-full"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                            {t("email")}
                        </label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t("emailPlaceholder")}
                            required
                            disabled={loading}
                            className="w-full"
                        />
                    </div>

                    <div>
                        <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                            {t("address")}
                        </label>
                        <Input
                            id="address"
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder={t("addressPlaceholder")}
                            required
                            disabled={loading}
                            className="w-full"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                {t("password")}
                            </label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    disabled={loading}
                                    className="w-full pr-10"
                                    minLength={8}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                {t("confirmPassword")}
                            </label>
                            <div className="relative">
                                <Input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    disabled={loading}
                                    className="w-full pr-10"
                                    minLength={8}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    tabIndex={-1}
                                >
                                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full text-white font-medium py-2.5 rounded hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: "#1E3A8A", borderRadius: "8px" }}
                    >
                        {loading ? t("creating") : t("createAccount")}
                    </Button>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-xs font-medium text-gray-400">{t("footerNote")}</p>
                    <a
                        href={`/${locale}/sign-in`}
                        className="mt-3 inline-block text-sm font-semibold text-[#1E3A8A] hover:underline"
                    >
                        {t("backToSignIn")}
                    </a>
                </div>
            </div>
        </div>
    );
}