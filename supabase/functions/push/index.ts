// تابع اعلان چت انباریار (Supabase Edge Function به نام push)
// GET  → کلید عمومی VAPID را برمی‌گرداند (اولین بار خودش کلیدها را می‌سازد)
// POST → با x-push-secret از تریگر دیتابیس صدا زده می‌شود و برای گیرندگان پیام اعلان می‌فرستد
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Content-Type": "application/json" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: cors });

async function priv(key: string): Promise<string | null> {
  const { data } = await db.from("wh_private").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}
async function vapid() {
  let pub = await priv("vapid_public"), prv = await priv("vapid_private");
  if (!pub || !prv) {
    const k = webpush.generateVAPIDKeys();
    await db.from("wh_private").upsert([{ key: "vapid_public", value: k.publicKey }, { key: "vapid_private", value: k.privateKey }]);
    pub = (await priv("vapid_public"))!; prv = (await priv("vapid_private"))!;
  }
  return { pub, prv };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (req.method === "GET") return json({ publicKey: (await vapid()).pub });

    const secret = await priv("push_secret");
    if (!secret || req.headers.get("x-push-secret") !== secret) return json({ error: "forbidden" }, 403);
    const { id } = await req.json();
    const { data: m } = await db.from("wh_chat").select("*").eq("id", id).maybeSingle();
    if (!m) return json({ ok: true, skipped: "no message" });

    // گیرندگان: گروه عمومی = همه کاربران فعال به‌جز فرستنده · خصوصی = طرف مقابل
    let to: string[];
    if (m.room === "general") {
      const { data } = await db.from("wh_users").select("user_id").neq("role", "none");
      to = (data ?? []).map((r: { user_id: string }) => r.user_id);
    } else to = String(m.room).slice(3).split(":");
    to = to.filter((u) => u && u !== m.user_id);
    if (!to.length) return json({ ok: true, sent: 0 });

    const { data: subs } = await db.from("wh_push_subs").select("*").in("user_id", to);
    if (!subs?.length) return json({ ok: true, sent: 0 });
    const { pub, prv } = await vapid();
    webpush.setVapidDetails("mailto:admin@anbaryar.app", pub, prv);

    const sender = m.username || "کاربر";
    const mention = (u: string) => new RegExp("(^|\\s)@" + u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\b|$)", "i").test(m.body);
    const { data: names } = await db.from("wh_profiles").select("id,username").in("id", to);
    const uname = new Map((names ?? []).map((p: { id: string; username: string }) => [p.id, p.username]));
    let sent = 0;
    await Promise.all(subs.map(async (s: { endpoint: string; p256dh: string; auth: string; user_id: string }) => {
      const isMention = m.room === "general" && mention(uname.get(s.user_id) ?? "~");
      const payload = JSON.stringify({
        title: m.room === "general" ? (isMention ? `${sender} شما را منشن کرد` : `گروه عمومی · ${sender}`) : `پیام خصوصی از ${sender}`,
        body: String(m.body).slice(0, 180), room: m.room, id: m.id,
      });
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: "high" }); sent++; }
      catch (e) { const c = (e as { statusCode?: number }).statusCode; if (c === 404 || c === 410) await db.from("wh_push_subs").delete().eq("endpoint", s.endpoint); }
    }));
    return json({ ok: true, sent });
  } catch (e) { return json({ error: String((e as Error).message || e) }, 500); }
});
