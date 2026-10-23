/** Test helper: log in (or register, solving the math challenge) against a local worker. */
export async function getToken(api: string, email: string, password: string): Promise<string> {
  const post = (p: string, b: unknown) => fetch(`${api}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, body: await r.json() as any }));
  let r = await post("/api/auth/login", { email, password });
  if (r.status === 401) {
    const c = await fetch(`${api}/api/auth/challenge`).then((x) => x.json() as any);
    const [a, b] = c.question.match(/\d+/g).map(Number);
    r = await post("/api/auth/register", { email, password, challenge_token: c.token, challenge_answer: a + b, website: "" });
  }
  if (!r.body.ok) throw new Error(`auth failed: ${r.status} ${r.body.code}`);
  return r.body.token;
}
