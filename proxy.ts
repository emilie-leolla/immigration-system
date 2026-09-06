import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { auth } from "@/lib/auth";

// Create the next-intl locale routing middleware
const intlMiddleware = createMiddleware(routing);

export default async function proxy(request: NextRequest) {   
     const { pathname } = request.nextUrl;

    // Skip entirely for API routes and static assets
    if (pathname.startsWith("/api") || pathname.includes(".")) {
        return NextResponse.next();
    }

    // /super-admin is outside the [locale] tree, so it must never be handed off to the
    // next-intl middleware.
    const isSuperAdminRoute = pathname === "/super-admin" || pathname.startsWith("/super-admin/");
    const isOutsideLocaleTree = isSuperAdminRoute;

    // Strip leading locale prefix to get the "bare" pathname for auth checks
    // e.g. /en/dashboard/client -> /dashboard/client
    const localePattern = /^\/(en|fr)(\/|$)/;
    const barePathname = pathname.replace(localePattern, "/");

    const url = request.nextUrl.clone();

    // Redirect root URL and public landing pages directly to Login page
    const landingRoutes = ["/", "/about", "/services", "/contact"];
    if (landingRoutes.includes(barePathname)) {
        const localeMatch = pathname.match(/^\/(en|fr)/);
        const localePrefix = localeMatch ? localeMatch[0] : "";
        url.pathname = `${localePrefix}/dashboard`;
        return NextResponse.redirect(url);
    }

    // ── AUTH GUARD ──────────────────────────────────────────────────
    let session = null;
    try {
        session = await auth.api.getSession({
            headers: request.headers,
        });
    } catch (e) {
        console.error("[Middleware] getSession error:", e);
    }

    // TEMPORARY DEBUG — remove once the cookie persistence issue is confirmed fixed
    console.log("[DEBUG] path:", barePathname);
    console.log("[DEBUG] cookie header:", request.headers.get("cookie"));
    console.log("[DEBUG] session found:", session ? `yes (user: ${session.user?.email})` : "NO");

    // /admin/login and /super-admin/login have been removed — everyone now
    // signs in through the single client-designed /sign-in page. Only the
    // admin registration page remains public here.
    const publicAdminRoutes = ["/admin/register"];

    if (!session) {
        const protectedPaths = ["/admin", "/super-admin", "/dashboard", "/complete-profile", "/applications"];
        const needsAuth = protectedPaths.some(p => barePathname.startsWith(p));

        if (needsAuth) {
            if (publicAdminRoutes.includes(barePathname)) {
                if (barePathname.startsWith("/super-admin")) {
                    // /super-admin isn't part of the [locale] tree
                    return NextResponse.next();
                }
                // For /admin/register, let next-intl handle the routing
                return intlMiddleware(request);
            }
            url.pathname = `/sign-in`;
            return NextResponse.redirect(url);
        }
        // Not protected — let next-intl handle locale routing (skip for /admin, /super-admin)
        return isOutsideLocaleTree ? NextResponse.next() : intlMiddleware(request);
    }

    const { role, isSuspended } = session.user as any;
    const userRole = (role || "CLIENT").toUpperCase();

    if (isSuspended && barePathname !== "/sign-in") {
        url.pathname = `/sign-in`;
        url.searchParams.set("suspended", "true");
        return NextResponse.redirect(url);
    }

    const { mustChangePassword } = session.user as any;
    if (mustChangePassword && barePathname !== "/change-password") {
        url.pathname = `/change-password`;
        return NextResponse.redirect(url);
    }

    if (barePathname.startsWith("/admin") && !publicAdminRoutes.includes(barePathname)) {
        if (userRole !== "ADMIN") {
            url.pathname = `/dashboard`;
            return NextResponse.redirect(url);
        }
    }

    if (barePathname.startsWith("/super-admin") && !publicAdminRoutes.includes(barePathname)) {
        if (userRole !== "SUPER_ADMIN") {
            url.pathname = `/dashboard`;
            return NextResponse.redirect(url);
        }
    }

    if (barePathname.startsWith("/dashboard/agent")) {
        if (userRole !== "AGENT" && userRole !== "ADMIN") {
            url.pathname = `/dashboard`;
            return NextResponse.redirect(url);
        }
    }

    if (barePathname === "/change-password" && !mustChangePassword) {
        url.pathname = `/dashboard`;
        return NextResponse.redirect(url);
    }
    if ((userRole === "AGENT" || userRole === "ADMIN") && pathname === barePathname && !isOutsideLocaleTree) {
        url.pathname = `/fr${barePathname}`;
        return NextResponse.redirect(url);
    }


    // All auth checks passed — let next-intl finalize locale routing
    // (skip for /admin and /super-admin, which aren't part of the [locale] tree)
    return isOutsideLocaleTree ? NextResponse.next() : intlMiddleware(request);
}

export const config = {
    matcher: [
        "/",
        "/(en|fr)/:path*",
        "/((?!api|_next|_vercel|.*\\..*).*)",
    ],
};