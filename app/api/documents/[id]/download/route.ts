import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { createS3DownloadUrl } from "@/lib/s3";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        return new NextResponse("Unauthorized", {
            status: 401
        });
    }

    try {
        const { id } = await params;

        const document = await prisma.document.findUnique({
            where: { id },
            include: {
                Procedure: {
                    include: {
                        application: true
                    }
                }
            }
        });

        if (!document) {
            return new NextResponse("Document not found", {
                status: 404
            });
        }

        const application = document.Procedure.application;

        const role = (session.user as any).role;
        const agencyId = (session.user as any).agencyId;

        const isAgentOrAdmin =
            role === "AGENT" || role === "ADMIN";

        const isOwner =
            application.clientId === session.user.id;

        const sameAgency =
            !!agencyId &&
            application.agencyId === agencyId;

        if (!isOwner && !(isAgentOrAdmin && sameAgency)) {
            return new NextResponse("Forbidden", {
                status: 403
            });
        }

        // New S3 documents
        if (document.storageKey) {
            const signedUrl = await createS3DownloadUrl(
                document.storageKey
            );

            return NextResponse.redirect(signedUrl);
        }

        // Old UploadThing documents
        if (document.fileUrl) {
            const absoluteUrl = document.fileUrl.startsWith("http")
                ? document.fileUrl
                : new URL(document.fileUrl, request.url).toString();

            return NextResponse.redirect(absoluteUrl);
        }

        return new NextResponse("File unavailable", {
            status: 404
        });
    } catch (error) {
        console.error("Document download error:", error);

        return new NextResponse(
            "Failed to open document",
            { status: 500 }
        );
    }
}