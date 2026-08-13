import { createFileRoute } from "@tanstack/react-router";

/**
 * Meta WhatsApp Cloud API status webhook.
 * GET  — Meta's subscription handshake (hub.challenge).
 * POST — delivery receipts: sent / delivered / read / failed per message id.
 */
export const Route = createFileRoute("/api/public/notify/whatsapp-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        const expected = process.env["WHATSAPP_WEBHOOK_VERIFY_TOKEN"];
        if (mode === "subscribe" && expected && token === expected) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as
          | {
              entry?: {
                changes?: {
                  value?: {
                    statuses?: {
                      id?: string;
                      status?: string;
                      errors?: { title?: string; message?: string; code?: number }[];
                    }[];
                  };
                }[];
              }[];
            }
          | null;

        const statuses =
          body?.entry?.flatMap((e) => e.changes?.flatMap((c) => c.value?.statuses ?? []) ?? []) ?? [];

        if (statuses.length) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          for (const s of statuses) {
            if (!s.id) continue;
            const err = s.errors?.[0];
            await supabaseAdmin
              .from("notification_log")
              .update({
                delivery_status: s.status ?? null,
                delivery_error: err ? `[${err.code ?? ""}] ${err.title ?? err.message ?? ""}` : null,
                delivery_updated_at: new Date().toISOString(),
              } as never)
              .eq("provider_sid", s.id);
          }
        }

        // Meta retries on any non-200, so always acknowledge.
        return new Response("ok", { status: 200 });
      },
    },
  },
});
