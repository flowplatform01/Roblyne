import { logger } from "./logger";

export function isBrevoConfigured(): boolean {
  return process.env.NODE_ENV === "production"
    && Boolean(process.env.BREVO_API_KEY?.trim() && process.env.BREVO_SENDER_EMAIL?.trim());
}

export async function sendPasswordResetOtp(input: { email: string; name: string; code: string }): Promise<void> {
  if (!isBrevoConfigured()) throw new Error("Email delivery is not configured");
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY!, "content-type": "application/json" },
    body: JSON.stringify({
      sender: { email: process.env.BREVO_SENDER_EMAIL!, name: process.env.BREVO_SENDER_NAME?.trim() || "ROBLYNE" },
      to: [{ email: input.email, name: input.name }],
      subject: "Your ROBLYNE password reset code",
      textContent: `Your ROBLYNE password reset code is ${input.code}. It expires in 10 minutes. If you did not request it, you can ignore this email.`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    logger.warn({ statusCode: response.status }, "Brevo password-reset delivery failed");
    throw new Error("Email delivery failed");
  }
}
