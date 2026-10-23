/** Transactional email via Brevo (https://developers.brevo.com/reference/sendtransacemail). */
export interface MailEnv { BREVO_API_KEY?: string; MAIL_FROM?: string; MAIL_FROM_NAME?: string; DEV_MAIL_LOG?: string }
export type Purpose = "register" | "reset";

export const mailMode = (env: MailEnv): "brevo" | "dev" | "off" => (env.BREVO_API_KEY ? "brevo" : env.DEV_MAIL_LOG === "1" ? "dev" : "off");

function content(purpose: Purpose, code: string) {
  const what = purpose === "register" ? "注册账号" : "重置密码";
  const subject = `【出海合规雷达】${what}验证码：${code}`;
  const text = `你好：\n\n你正在${what}，验证码为：${code}\n\n验证码 10 分钟内有效，请勿告诉他人。如果这不是你本人的操作，请忽略本邮件。\n\n出海合规雷达`;
  const html = `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#f5f6fa;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#1f2433">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#fff;border:1px solid #e6e8f0;border-radius:12px">
<tr><td style="padding:28px 28px 8px;font-size:15px;font-weight:600">出海合规雷达</td></tr>
<tr><td style="padding:8px 28px;font-size:14px;line-height:1.7">你正在${what}，验证码为：</td></tr>
<tr><td style="padding:8px 28px 16px"><div style="font-size:30px;font-weight:700;letter-spacing:8px;color:#3d4fd6">${code}</div></td></tr>
<tr><td style="padding:0 28px 28px;font-size:12.5px;line-height:1.7;color:#6b7185">验证码 10 分钟内有效，请勿告诉他人。<br>如果这不是你本人的操作，请忽略本邮件。</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

/** Sends the code. Never logs the API key; logs the code only in local dev mode (DEV_MAIL_LOG=1 and no key). */
export async function sendCodeMail(env: MailEnv, to: string, purpose: Purpose, code: string): Promise<{ ok: true } | { ok: false; detail: string }> {
  const mode = mailMode(env);
  if (mode === "dev") { console.log(`[dev-mail] ${purpose} code for ${to}: ${code}`); return { ok: true }; }
  if (mode === "off") return { ok: false, detail: "not_configured" };
  const { subject, text, html } = content(purpose, code);
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": env.BREVO_API_KEY!, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { email: env.MAIL_FROM || "zhu05361@gmail.com", name: env.MAIL_FROM_NAME || "出海合规雷达" }, to: [{ email: to }], subject, htmlContent: html, textContent: text, tags: [`auth-${purpose}`] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (r.ok) return { ok: true };
    return { ok: false, detail: `brevo_${r.status}` };
  } catch (e) { return { ok: false, detail: String((e as Error)?.name || "fetch_error") }; }
}
