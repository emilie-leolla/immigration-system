"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { LOGOS } from "@/lib/branding";

function SignInForm() {
    const t = useTranslations("auth.signIn");
    const locale = useLocale();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (searchParams.get("suspended")) {
            setError(t("suspendedError"));
        }
    }, [searchParams, t]);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        if (!email || !password) {
            setError(t("allFieldsRequired"));
            setLoading(false);
            return;
        }

        const res = await signIn.email({ email, password, rememberMe: true });

        if (res.error) {
            setError(res.error.message || t("invalidCredentials"));
            setLoading(false);
        } else {
            router.push("/dashboard");
        }
    }

    async function handleGoogleLogin() {
        setLoading(true);
        try {
            await signIn.social({ provider: "google", callbackURL: "/dashboard" });
        } catch {
            setError(t("googleLoginFailed"));
            setLoading(false);
        }
    }

    return (
        <div className="w-full max-w-md bg-white rounded-md shadow-sm border border-gray-100 p-8 relative z-10">
            <div className="text-center mb-8">
                <Image
                    src={LOGOS.login}
                    alt="Procédure Facile"
                    width={1000}
                    height={400}
                    className="h-24 w-auto mx-auto mb-4 object-contain"
                    priority
                />
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t("title")}</h1>
                <p className="mt-2 text-sm text-gray-500">{t("subtitle")}</p>
            </div>

            {error && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm text-sm flex items-center">
                    <span className="block sm:inline font-medium">{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-800 mb-1">{t("email")}</label>
                    <input
                        id="email" name="email" type="email"
                        placeholder={locale === "fr" ? "Entrez votre e-mail" : "Enter your email"}
                        required disabled={loading}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-sm text-gray-900 focus:ring-1 focus:ring-[#1E3A8A] focus:border-[#1E3A8A] sm:text-sm transition-colors disabled:bg-gray-50 disabled:text-gray-500"
                    />
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-semibold text-gray-800 mb-1">{t("password")}</label>
                    <div className="relative">
                        <input
                            id="password" name="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            required disabled={loading}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-sm text-gray-900 focus:ring-1 focus:ring-[#1E3A8A] focus:border-[#1E3A8A] sm:text-sm transition-colors disabled:bg-gray-50 disabled:text-gray-500 pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    <div className="mt-2 text-right">
                   <a href={`/${locale}/forgot-password`} className="text-sm font-semibold text-[#1E3A8A] hover:underline">                            {t("forgotPassword")}
                        </a>
                    </div>
                </div>

                <button
                    type="submit" disabled={loading}
                    className="w-full flex justify-center items-center py-2.5 px-4 rounded-sm shadow-sm text-sm font-medium text-white bg-[#1E3A8A] hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1E3A8A] disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("button")}
                </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-500">
                {t("noAccount")}{" "}
                <a
                    href={`/${locale}/admin/register`}
                    className="font-semibold text-[#1E3A8A] hover:underline"
                >
                    {t("signUp")}
                </a>
            </div>
        </div>
    );
}

export default function SignInPage() {
    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            <main className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
                <Suspense fallback={
                    <div className="w-full max-w-md h-96 bg-white rounded-md shadow-sm border border-gray-100 animate-pulse" />
                }>
                    <SignInForm />
                </Suspense>
            </main>
        </div>
    );
}