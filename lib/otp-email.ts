export function buildOtpEmailHtml({
    otp,
    type,
}: {
    otp: string;
    type: "sign-in" | "email-verification" | "forget-password";
}) {
    const heading =
        type === "email-verification"
            ? "Verify your email"
            : type === "forget-password"
            ? "Reset your password"
            : "Your sign-in code";

    const body =
        type === "email-verification"
            ? "Use the code below to verify your email and finish setting up your agency account. This code expires in 5 minutes."
            : type === "forget-password"
            ? "Use the code below to reset your password. This code expires in 5 minutes."
            : "Use the code below to sign in. This code expires in 5 minutes.";

    return `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="padding: 30px;">
                <p style="font-size: 18px; font-weight: bold; color: #1E3A8A; margin-bottom: 4px;">
                    ${heading}
                </p>
                <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">
                    ${body}
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <span style="display: inline-block; background-color: #F9FAFB; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 28px; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1E3A8A;">
                        ${otp}
                    </span>
                </div>
                <p style="font-size: 12px; color: #9ca3af; line-height: 1.6;">
                    If you didn't request this code, you can safely ignore this email.
                </p>
            </div>
        </div>
    `;
}