import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({ component: Splash });

function Splash() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    const t = setTimeout(() => {
      if (loading) return;
      navigate({ to: user ? "/home" : "/login" });
    }, 1400);
    return () => clearTimeout(t);
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-b from-[oklch(0.97_0.04_60)] to-[oklch(0.92_0.09_45)] px-6 text-center">
      <div className="fade-in">
        <img src={logo} alt="KhanaGharTak" width={140} height={140} className="mx-auto h-32 w-32 drop-shadow-xl" />
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[oklch(0.3_0.1_30)]">KhanaGharTak</h1>
        <p className="mt-2 text-sm font-medium text-[oklch(0.4_0.08_30)]">
          Ghar Jaisa Khana, Seedha Aapke Ghar Tak
        </p>
      </div>
      <div className="mt-10 h-1 w-24 overflow-hidden rounded-full bg-white/40">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
      </div>
    </div>
  );
}
