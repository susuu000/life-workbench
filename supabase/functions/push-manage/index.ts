/**
 * Supabase Edge Function: push-manage
 * 
 * 功能：
 * - 管理 VAPID 密钥对
 * - 存储/删除用户 Push 订阅
 * - 发送推送通知（单用户 / 批量）
 * - 每日定时提醒触发
 * 
 * 部署：
 *   supabase functions deploy push-manage
 *   supabase secrets set VAPID_PRIVATE_KEY=<your-key>
 *   supabase secrets set VAPID_SUBJECT=mailto:your@email.com
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ===== VAPID 密钥管理 =====
// 如果未设置环境变量，自动生成一对（仅用于开发，生产请设置固定密钥）
// 生成命令：npx web-push generate-vapid-keys

function getVapidKeys() {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
  return { publicKey, privateKey };
}

// ===== 辅助：将 Base64 转为 Uint8Array =====
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ===== 辅助：生成 JWT for Web Push =====
async function createVapidJWT(
  audience: string,
  subject: string,
  privateKey: Uint8Array
): Promise<string> {
  const header = { alg: "ES256", typ: "JWT" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsigned = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "raw",
    privateKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    key,
    encoder.encode(unsigned)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${unsigned}.${sigB64}`;
}

// ===== 发送单条推送 =====
async function sendPushNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: { title: string; body: string; icon?: string; badge?: string; tag?: string; url?: string }
) {
  const { publicKey, privateKey } = getVapidKeys();
  if (!privateKey) {
    console.error("VAPID_PRIVATE_KEY not set");
    return { success: false, error: "VAPID keys not configured" };
  }

  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@yuexi.app";

  try {
    // 生成 VAPID JWT
    const audience = new URL(subscription.endpoint).origin;
    const vapidJWT = await createVapidJWT(
      audience,
      vapidSubject,
      urlBase64ToUint8Array(privateKey)
    );

    // 加密 payload（使用标准 Web Push 协议）
    const pushPayload = JSON.stringify(payload);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "Authorization": `vapid t=${vapidJWT}, k=${publicKey}`,
        "TTL": "86400",
        "Urgency": "normal",
      },
      body: pushPayload,
    });

    if (response.ok || response.status === 201) {
      return { success: true };
    } else {
      const text = await response.text();
      console.error(`Push failed: ${response.status}`, text);
      // 410 Gone = 订阅已过期，应删除
      if (response.status === 410) {
        return { success: false, expired: true };
      }
      return { success: false, error: text };
    }
  } catch (err) {
    console.error("Push error:", err);
    return { success: false, error: String(err) };
  }
}

// ===== 主处理 =====
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, userId, subscription, reminderTime } = await req.json();

    // 初始化 Supabase 客户端
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    switch (action) {
      // ===== 获取 VAPID 公钥 =====
      case "get-vapid-key": {
        const { publicKey } = getVapidKeys();
        return new Response(JSON.stringify({ publicKey }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ===== 订阅 =====
      case "subscribe": {
        if (!userId || !subscription) {
          return new Response(JSON.stringify({ error: "Missing userId or subscription" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // 存储订阅信息
        const { error } = await supabase
          .from("push_subscriptions")
          .upsert({
            user_id: userId,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            reminder_time: reminderTime || "20:00",
            enabled: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

        if (error) throw error;

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ===== 取消订阅 =====
      case "unsubscribe": {
        if (!userId) {
          return new Response(JSON.stringify({ error: "Missing userId" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase
          .from("push_subscriptions")
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq("user_id", userId);

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ===== 发送测试通知 =====
      case "test": {
        if (!userId) {
          return new Response(JSON.stringify({ error: "Missing userId" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: sub } = await supabase
          .from("push_subscriptions")
          .select("*")
          .eq("user_id", userId)
          .eq("enabled", true)
          .maybeSingle();

        if (!sub) {
          return new Response(JSON.stringify({ error: "No active subscription" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const result = await sendPushNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          {
            title: "🌙 月夕生活台",
            body: "这是一条测试通知。每日打卡提醒已就绪！",
            icon: "/assets/icon-192.png",
            badge: "/assets/icon-72.png",
            tag: "test-notification",
          }
        );

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ===== 批量发送每日提醒（由 daily-cron 调用）=====
      case "daily-reminder": {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

        // 查找此时应该提醒的用户
        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("*")
          .eq("enabled", true)
          .eq("reminder_time", timeStr);

        if (!subs || subs.length === 0) {
          return new Response(JSON.stringify({ sent: 0, message: "No reminders at this time" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let sent = 0;
        let expired = 0;

        for (const sub of subs) {
          // 检查用户今日是否已打卡
          const today = now.toISOString().split("T")[0];
          const { data: checkin } = await supabase
            .from("checkin_records")
            .select("id")
            .eq("user_id", sub.user_id)
            .eq("date", today)
            .maybeSingle();

          if (checkin) continue; // 已打卡，跳过

          const result = await sendPushNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            {
              title: "🌙 今日打卡提醒",
              body: "别忘了完成今天的学习打卡哦～打开月夕生活台开始吧！",
              icon: "/assets/icon-192.png",
              badge: "/assets/icon-72.png",
              tag: `daily-reminder-${today}`,
              url: "/",
            }
          );

          if (result.success) sent++;
          if (result.expired) {
            expired++;
            // 清理过期订阅
            await supabase
              .from("push_subscriptions")
              .update({ enabled: false })
              .eq("user_id", sub.user_id);
          }
        }

        return new Response(JSON.stringify({ sent, expired }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    console.error("push-manage error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
