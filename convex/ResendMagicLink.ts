import { Email } from "@convex-dev/auth/providers/Email";
import { Resend } from "resend";

const TOKEN_BYTES = 32;
const MAX_AGE_SECONDS = 15 * 60;

async function generateToken(): Promise<string> {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const ResendMagicLink = Email({
  id: "resend-magic-link",
  maxAge: MAX_AGE_SECONDS,
  generateVerificationToken: generateToken,
  authorize: undefined,
  async sendVerificationRequest({ identifier: email, token }: { identifier: string; token: string }) {
    const apiKey = process.env.AUTH_RESEND_KEY;
    const from = process.env.AUTH_EMAIL_FROM;
    const appUrl = process.env.APP_URL;
    if (!apiKey) throw new Error("AUTH_RESEND_KEY is not set");
    if (!from) throw new Error("AUTH_EMAIL_FROM is not set");
    if (!appUrl) throw new Error("APP_URL is not set");

    const verifyUrl = `${appUrl}/auth/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: [email],
      subject: "Verify your fileaway account",
      text: `Welcome to fileaway.\n\nClick the link below to verify your email and finish signing up. The link expires in 15 minutes.\n\n${verifyUrl}\n\nIf you didn't sign up, you can ignore this email.`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">
          <h1 style="font-size:18px;margin:0 0 16px">Verify your fileaway account</h1>
          <p style="font-size:14px;line-height:1.5;margin:0 0 24px">Click the button below to verify your email and finish signing up. The link expires in 15 minutes.</p>
          <p style="margin:0 0 24px"><a href="${verifyUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">Verify email</a></p>
          <p style="font-size:12px;color:#666;line-height:1.5;margin:0">If the button doesn't work, paste this URL into your browser:<br><span style="word-break:break-all">${verifyUrl}</span></p>
          <p style="font-size:12px;color:#666;line-height:1.5;margin:24px 0 0">If you didn't sign up, you can ignore this email.</p>
        </div>
      `,
    });
    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }
  },
});
