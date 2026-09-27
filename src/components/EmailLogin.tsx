import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function EmailLogin({ onBack, backLabel = "← Back to all options" }: { onBack: () => void; backLabel?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isOtpMode, setIsOtpMode] = useState(false);
  const [busy, setBusy] = useState(false);

  const cleanEmail = email.trim().toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validEmail) return toast.error("Enter a valid email address");
    if (!password) return toast.error("Enter your password");

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: password,
    });
    setBusy(false);

    if (error) {
      toast.error(error.message || "Invalid email or password");
      return;
    }
    toast.success("Signed in successfully");
  };

  const handleOtpSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validEmail) return toast.error("Enter a valid email address");

    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
      },
    });
    setBusy(false);

    if (error) {
      toast.error(error.message || "Could not send login link");
      return;
    }
    toast.success("Login link sent! Please check your email inbox.");
  };

  return (
    <div className="mt-8 space-y-4">
      {isOtpMode ? (
        <form onSubmit={handleOtpSignIn} className="space-y-3">
          <label className="block text-sm font-semibold">Email address</label>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <input
              className="h-[52px] flex-1 bg-transparent text-[15px] font-medium outline-none"
              type="email"
              placeholder="partner@khanaghartak.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">We'll send you a secure one-click sign in link to your inbox.</p>
          <Button type="submit" disabled={busy || !validEmail} className="h-[52px] w-full font-bold">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Magic Link
          </Button>
          <button
            type="button"
            onClick={() => setIsOtpMode(false)}
            className="w-full text-center text-xs font-semibold text-primary underline"
          >
            Sign in with password instead
          </button>
        </form>
      ) : (
        <form onSubmit={handlePasswordSignIn} className="space-y-3">
          <label className="block text-sm font-semibold">Email address</label>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <input
              className="h-[52px] flex-1 bg-transparent text-[15px] font-medium outline-none"
              type="email"
              placeholder="partner@khanaghartak.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <label className="block text-sm font-semibold">Password</label>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <input
              className="h-[52px] flex-1 bg-transparent text-[15px] font-medium outline-none"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <Button type="submit" disabled={busy || !validEmail || !password} className="h-[52px] w-full font-bold">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign In
          </Button>

          <button
            type="button"
            onClick={() => setIsOtpMode(true)}
            className="w-full text-center text-xs font-semibold text-primary underline"
          >
            Email me a sign-in link instead (no password)
          </button>
        </form>
      )}

      <button type="button" onClick={onBack} className="mt-4 w-full text-center text-xs font-medium text-primary underline">
        {backLabel}
      </button>
    </div>
  );
}
