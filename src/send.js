import nodemailer from "nodemailer";

/**
 * Delivery. Resend when RESEND_API_KEY is set (plain HTTPS, no SDK needed),
 * otherwise Gmail SMTP with an app password. Throws on any failure so the
 * workflow goes red instead of silently not sending.
 */
export async function sendEmail({ cfg, subject, html, text, log = console }) {
  const { to, from, resendApiKey, gmailUser, gmailAppPassword } = cfg.email;
  if (resendApiKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`Resend rejected the email (${res.status}): ${body}`);
    log.info(`[send] delivered via Resend to ${to}: ${body}`);
    return { provider: "resend", response: body };
  }
  if (gmailUser && gmailAppPassword) {
    const transport = nodemailer.createTransport({ service: "gmail", auth: { user: gmailUser, pass: gmailAppPassword } });
    const info = await transport.sendMail({ from: from.includes("@") && !from.includes("resend.dev") ? from : `Shit To Do in NYC <${gmailUser}>`, to, subject, html, text });
    log.info(`[send] delivered via Gmail to ${to}: ${info.messageId}`);
    return { provider: "gmail", response: info.messageId };
  }
  throw new Error("No email provider configured: set RESEND_API_KEY, or GMAIL_USER and GMAIL_APP_PASSWORD");
}
