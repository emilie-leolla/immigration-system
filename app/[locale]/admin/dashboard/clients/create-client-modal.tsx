"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
    Plus, Loader2, Eye, EyeOff, RefreshCw, Copy, CheckCircle2, X, UserPlus, KeyRound, User, Mail, Users
} from "lucide-react";
import { createClientAction } from "./actions";
import { useTranslations } from "next-intl";
import { useUpgradeDialog } from "@/app/[locale]/admin/dashboard/upgrade-dialog-context";

interface Agent {
    id: string;
    name: string;
}

interface CreateClientModalProps {
    agents: Agent[];
    onClientCreated?: (client: any) => void;
}
// Generates a random secure-looking password
function generatePassword(): string {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghjkmnpqrstuvwxyz";
    const digits = "23456789";
    const specials = "!@#$%";
    const all = upper + lower + digits + specials;
    let pw = [
        upper[Math.floor(Math.random() * upper.length)],
        lower[Math.floor(Math.random() * lower.length)],
        digits[Math.floor(Math.random() * digits.length)],
        specials[Math.floor(Math.random() * specials.length)],
    ];
    for (let i = 4; i < 12; i++) pw.push(all[Math.floor(Math.random() * all.length)]);
    return pw.sort(() => Math.random() - 0.5).join("");
}

export default function CreateClientModal({ agents, onClientCreated }: CreateClientModalProps) {
    const t = useTranslations("adminCreateClient");
    const { openUpgradeDialog } = useUpgradeDialog();
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(true);
    const [copied, setCopied] = useState(false);
    const [success, setSuccess] = useState<{ name: string; email: string; password: string } | null>(null);

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState(() => generatePassword());
    const [agentId, setAgentId] = useState("");

    const handleOpen = () => {
        setName("");
        setEmail("");
        setPassword(generatePassword());
        setAgentId("");
        setError(null);
        setSuccess(null);
        setIsOpen(true);
    };

    const handleClose = () => {
        setIsOpen(false);
        setSuccess(null);
        setError(null);
    };

    const regeneratePassword = useCallback(() => {
        setPassword(generatePassword());
    }, []);

    const copyPassword = async () => {
        await navigator.clipboard.writeText(password);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const res = await createClientAction({
            name,
            email,
            password,
            agentId: agentId || null,
        });

        setLoading(false);

        if (res.error) {
            if (res.code === "QUOTA_EXCEEDED") {
                setIsOpen(false);
                openUpgradeDialog();
            } else {
                setError(res.error);
            }
        } else {
            // Show success screen with the credentials
            setSuccess({ name, email, password });

            // Let the parent list insert this client immediately instead of
            // requiring a manual reload to see it.
            if (onClientCreated && res.client) {
                const assignedAgent = agentId ? agents.find(a => a.id === agentId) : null;
                onClientCreated({
                    ...res.client,
                    agent: assignedAgent ? { name: assignedAgent.name } : null,
                });
            }
        }
    }
    return (
        <>
            <Button
                onClick={handleOpen}
                className="flex items-center gap-2 text-white font-black px-6 shadow-lg shadow-blue-100 hover:scale-[1.02] transition-transform"
                style={{ backgroundColor: "#1E3A8A", borderRadius: "12px" }}
            >
                <UserPlus size={16} />
                {t("createClient")}
            </Button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative overflow-hidden animate-in zoom-in-95 duration-200">

                        {/* Header */}
                        <div className="bg-gradient-to-r from-[#1E3A8A] to-blue-700 p-6 text-white">
                            <button
                                onClick={handleClose}
                                className="absolute top-5 right-5 text-white/70 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 p-2.5 rounded-xl">
                                    <UserPlus size={22} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black tracking-tight">{t("dialogTitle")}</h2>
                                    <p className="text-blue-200 text-xs font-medium mt-0.5">{t("dialogSubtitle")}</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            {/* SUCCESS SCREEN */}
                            {success ? (
                                <div className="space-y-5">
                                    <div className="flex flex-col items-center gap-3 py-2">
                                        <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                                            <CheckCircle2 size={32} />
                                        </div>
                                        <div className="text-center">
                                            <h3 className="text-lg font-black text-gray-900">{t("clientCreated")}</h3>
                                            <p className="text-sm text-gray-500 font-medium">{t("shareCredentials")}</p>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                                        <div className="flex items-center gap-3 p-4">
                                            <User size={16} className="text-gray-400 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("name")}</p>
                                                <p className="font-bold text-gray-800 truncate">{success.name}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-4">
                                            <Mail size={16} className="text-gray-400 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("email")}</p>
                                                <p className="font-bold text-gray-800 truncate">{success.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-4">
                                            <KeyRound size={16} className="text-gray-400 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("password")}</p>
                                                <p className="font-bold text-gray-800 font-mono tracking-wider">{success.password}</p>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    await navigator.clipboard.writeText(success.password);
                                                    setCopied(true);
                                                    setTimeout(() => setCopied(false), 2000);
                                                }}
                                                className="text-gray-400 hover:text-blue-600 transition-colors shrink-0"
                                                title={t("copyPasswordTooltip")}
                                            >
                                                {copied ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 font-bold">
                                        {t("credentialsWarning")}
                                    </p>

                                    <Button
                                        onClick={handleClose}
                                        className="w-full font-black rounded-xl h-11"
                                        style={{ backgroundColor: "#1E3A8A" }}
                                    >
                                        {t("done")}
                                    </Button>
                                </div>
                            ) : (
                                /* CREATE FORM */
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {error && (
                                        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-xs font-bold border border-red-100 uppercase tracking-tight">
                                            {error}
                                        </div>
                                    )}

                                    {/* Full Name */}
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            {t("fullName")}
                                        </label>
                                        <div className="relative">
                                            <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="text"
                                                required
                                                maxLength={50}
                                                value={name}
                                                onChange={e => setName(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
                                                placeholder={t("fullNamePlaceholder")}
                                            />
                                        </div>
                                    </div>

                                    {/* Email */}
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            {t("emailAddress")}
                                        </label>
                                        <div className="relative">
                                            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="email"
                                                required
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
                                                placeholder={t("emailPlaceholder")}
                                            />
                                        </div>
                                    </div>

                                    {/* Password */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                {t("loginPassword")}
                                            </label>
                                            <button
                                                type="button"
                                                onClick={regeneratePassword}
                                                className="text-[10px] font-black text-blue-600 hover:text-blue-800 flex items-center gap-1 uppercase tracking-widest"
                                            >
                                                <RefreshCw size={11} /> {t("regenerate")}
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                required
                                                minLength={8}
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-20 py-3 text-sm font-mono font-bold tracking-wider focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
                                            />
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={copyPassword}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                                                    title={t("copyPasswordTooltip")}
                                                >
                                                    {copied ? <CheckCircle2 size={15} className="text-emerald-500" /> : <Copy size={15} />}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(v => !v)}
                                                    className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                                                >
                                                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-gray-400 font-medium pl-1">
                                            {t("passwordHint")}
                                        </p>
                                    </div>

                                    {/* Agent Assignment (optional) */}
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            {t("assignToAgent")} <span className="text-gray-300 normal-case font-medium">{t("optional")}</span>
                                        </label>
                                        <div className="relative">
                                            <Users size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <select
                                                value={agentId}
                                                onChange={e => setAgentId(e.target.value)}
                                                className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none cursor-pointer"
                                            >
                                                <option value="">{t("unassignedOption")}</option>
                                                {agents.map(a => (
                                                    <option key={a.id} value={a.id}>{a.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="pt-3 flex gap-3">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={handleClose}
                                            disabled={loading}
                                            className="flex-1 font-bold text-gray-500 rounded-xl border border-gray-200 hover:bg-gray-50"
                                        >
                                            {t("cancel")}
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={loading}
                                            className="flex-1 text-white font-black rounded-xl shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                                            style={{ backgroundColor: "#1E3A8A" }}
                                        >
                                            {loading ? (
                                                <><Loader2 className="h-4 w-4 animate-spin" /> {t("creating")}</>
                                            ) : (
                                                <><UserPlus size={16} /> {t("createClient")}</>
                                            )}
                                        </Button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}