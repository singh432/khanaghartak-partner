import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { khanaGharTakLogoUrl } from "@/assets/brand";
import { Download, Loader2, QrCode } from "lucide-react";

export const Route = createFileRoute("/qr")({
  component: QrPage,
  head: () => ({
    meta: [
      { title: "Scan to order — KhanaGharTak" },
      { name: "description", content: "Scan the KhanaGharTak QR code to open the app and order home-style food." },
      { property: "og:title", content: "Scan to order — KhanaGharTak" },
      { property: "og:description", content: "Scan the KhanaGharTak QR code to open the app and order home-style food." },
      { property: "og:url", content: "https://khanaghartak.in/qr" },
    ],
    links: [{ rel: "canonical", href: "https://khanaghartak.in/qr" }],
  }),
});

type QRSettings = {
  target_url: string;
  label: string;
};

async function generateQrWithLogo(targetUrl: string): Promise<string> {
  const QRCode = await import("qrcode");
  const canvas = document.createElement("canvas");
  const size = 1024;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const qrDataUrl = await QRCode.toDataURL(targetUrl, {
    width: size,
    margin: 2,
    color: { dark: "#1a1a1a", light: "#ffffff" },
    errorCorrectionLevel: "H",
  });

  const [qrImg, logoImg] = await Promise.all([
    loadImage(qrDataUrl),
    loadImage(khanaGharTakLogoUrl),
  ]);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(qrImg, 0, 0, size, size);

  const logoSize = Math.round(size * 0.22);
  const padding = Math.round(size * 0.06);
  const center = (size - logoSize) / 2;

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(center - padding / 2, center - padding / 2, logoSize + padding, logoSize + padding, size * 0.04);
  ctx.fill();

  ctx.drawImage(logoImg, center, center, logoSize, logoSize);

  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image: " + src));
    img.src = src;
  });
}

function QrPage() {
  const [settings, setSettings] = useState<QRSettings | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    supabase.from("qr_settings").select("target_url, label").limit(1).maybeSingle().then(({ data, error: fetchError }) => {
      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }
      const s = (data as QRSettings | null) ?? { target_url: "https://khanaghartak.in", label: "Scan to order" };
      setSettings(s);
      generateQrWithLogo(s.target_url)
        .then(setDataUrl)
        .catch((e) => setError(e?.message ?? "Could not generate QR code"))
        .finally(() => setLoading(false));
    });
  }, []);

  const download = () => {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "khanaghartak-qr.png";
    link.click();
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 py-10 text-center">
      <div className="w-full max-w-sm rounded-3xl border bg-card p-6 shadow-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <QrCode className="h-7 w-7 text-primary" />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{settings?.label ?? "Scan to order"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Point your camera at the code to open KhanaGharTak.</p>

        <div className="relative mx-auto mt-6 aspect-square w-full max-w-[280px] overflow-hidden rounded-2xl border bg-white p-3">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-white px-4 text-sm text-destructive">
              {error}
            </div>
          )}
          {dataUrl && (
            <img src={dataUrl} alt="KhanaGharTak QR code" className="h-full w-full rounded-xl object-contain" />
          )}
        </div>

        {settings?.target_url && (
          <p className="mt-4 break-all text-xs text-muted-foreground">{settings.target_url}</p>
        )}

        <button
          onClick={download}
          disabled={!dataUrl}
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          <Download className="mr-2 h-4 w-4" /> Download QR
        </button>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        KhanaGharTak — Jo Dil Chahe, Wahi Order Karo
      </p>
    </div>
  );
}
