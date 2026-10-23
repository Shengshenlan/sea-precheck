/**
 * Test helper: log in, or register via the email-code flow against a LOCAL worker.
 * Registration needs the worker running with DEV_MAIL_LOG=1 and no BREVO_API_KEY (worker/.dev.vars), so that
 * /api/auth/send-code returns `dev_code` — it only does that on a loopback host and never in production.
 */
export async function getToken(api: string, email: string, password: string): Promise<string> {
  const post = (p: string, b: unknown) => fetch(`${api}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, body: await r.json() as any }));
  let r = await post("/api/auth/login", { email, password });
  if (r.status === 401) {
    const s = await post("/api/auth/send-code", { email, purpose: "register", website: "" });
    if (!s.body.ok || !s.body.dev_code) throw new Error(`send-code failed (${s.status} ${s.body.code || ""}); run the worker locally with DEV_MAIL_LOG=1 and no BREVO_API_KEY`);
    r = await post("/api/auth/register", { email, password, code: s.body.dev_code, website: "" });
  }
  if (!r.body.ok) throw new Error(`auth failed: ${r.status} ${r.body.code}`);
  return r.body.token;
}
