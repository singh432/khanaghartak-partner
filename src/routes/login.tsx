import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/logo.png";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Sign in — KhanaGharTak" },
      { name: "description", content: "Sign in or create your KhanaGharTak account to order home-style food with Cash on Delivery." },
      { property: "og:title", content: "Sign in — KhanaGharTak" },
      { property: "og:description", content: "Sign in or create your KhanaGharTak account to order home-style food with Cash on Delivery." },
      { property: "og:url", content: "https://khanaghartak.lovable.app/login" },
    ],
    links: [{ rel: "canonical", href: "https://khanaghartak.lovable.app/login" }],
  }),
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(6, "Password must be at least 6 characters").max(72);
const nameSchema = z.string().trim().min(2, "Name is too short").max(80);
const phoneSchema = z.string().trim().regex(/^[0-9+\-\s]{7,15}$/, "Enter a valid phone");
const otpSchema = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code");

type Method = "password" | "otp";
type Mode = "signin" | "signup";

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [method, setMethod] = useState<Method>("password");
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", phone: "" });

  // OTP flow state
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  useEffect(() => { if (user) navigate({ to: "/home" }); }, [user, navigate]);

  const onSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailRes = emailSchema.safeParse(form.email);
    if (!emailRes.success) return toast.error(emailRes.error.issues[0].message);
    const passRes = passwordSchema.safeParse(form.password);
    if (!passRes.success) return toast.error(passRes.error.issues[0].message);
    if (mode === "signup") {
      const nRes = nameSchema.safeParse(form.full_name);
      if (!nRes.success) return toast.error(nRes.error.issues[0].message);
      const phRes = phoneSchema.safeParse(form.phone);
      if (!phRes.success) return toast.error(phRes.error.issues[0].message);
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            emailRedirectTo: `${window.location.origin}/home`,
            data: { full_name: form.full_name, phone: form.phone },
          },
        });
        if (error) throw error;
        toast.success("Account created! Check your email to confirm.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const onSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailRes = emailSchema.safeParse(form.email);
    if (!emailRes.success) return toast.error(emailRes.error.issues[0].message);
    if (mode === "signup") {
      const nRes = nameSchema.safeParse(form.full_name);
      if (!nRes.success) return toast.error(nRes.error.issues[0].message);
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: form.email,
        options: {
          shouldCreateUser: mode === "signup",
          emailRedirectTo: `${window.location.origin}/home`,
          data: mode === "signup"
            ? { full_name: form.full_name, phone: form.phone }
            : undefined,
        },
      });
      if (error) throw error;
      setOtpSent(true);
      toast.success("OTP sent! Check your email for the 6-digit code.");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not send OTP");
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const codeRes = otpSchema.safeParse(otpCode);
    if (!codeRes.success) return toast.error(codeRes.error.issues[0].message);

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: form.email,
        token: otpCode,
        type: "email",
      });
      if (error) throw error;
      toast.success("Logged in!");
    } catch (err: any) {
      toast.error(err?.message ?? "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/home`,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      setLoading(false);
    }
  };

  const switchMethod = (next: Method) => {
    setMethod(next);
    setOtpSent(false);
    setOtpCode("");
  };

  return (
    <div className="flex min-h-[100dvh] flex-col px-6 py-10">
      <div className="text-center">
        <img src={logo} alt="KhanaGharTak" width={72} height={72} className="mx-auto h-16 w-16" />
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ghar jaisa khana, seedha aapke ghar tak.
        </p>
      </div>

      {/* Method tabs */}
      <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-sm font-semibold">
        <button
          type="button"
          onClick={() => switchMethod("otp")}
          className={`h-10 rounded-lg transition ${method === "otp" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
        >
          Email OTP
        </button>
        <button
          type="button"
          onClick={() => switchMethod("password")}
          className={`h-10 rounded-lg transition ${method === "password" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
        >
          Password
        </button>
      </div>

      {method === "password" ? (
        <form onSubmit={onSubmitPassword} className="mt-5 space-y-3">
          {mode === "signup" && (
            <>
              <Field label="Full name">
                <input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="input" placeholder="Surya Kumar" maxLength={80}
                />
              </Field>
              <Field label="Phone (with country code)">
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="input" placeholder="+91 98765 43210" maxLength={15}
                />
              </Field>
            </>
          )}
          <Field label="Email">
            <input
              type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input" placeholder="you@example.com" autoComplete="email" maxLength={255}
            />
          </Field>
          <Field label="Password">
            <input
              type="password" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input" placeholder="••••••••"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              maxLength={72}
            />
          </Field>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
      ) : !otpSent ? (
        <form onSubmit={onSendOtp} className="mt-5 space-y-3">
          {mode === "signup" && (
            <>
              <Field label="Full name">
                <input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="input" placeholder="Surya Kumar" maxLength={80}
                />
              </Field>
              <Field label="Phone (with country code)">
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="input" placeholder="+91 98765 43210" maxLength={15}
                />
              </Field>
            </>
          )}
          <Field label="Email">
            <input
              type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input" placeholder="you@example.com" autoComplete="email" maxLength={255}
            />
          </Field>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send OTP to email
          </button>
          <p className="text-center text-xs text-muted-foreground">
            We'll email you a 6-digit code. No password needed.
          </p>
        </form>
      ) : (
        <form onSubmit={onVerifyOtp} className="mt-5 space-y-3">
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code sent to <span className="font-semibold text-foreground">{form.email}</span>
          </p>
          <Field label="6-digit code">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="input text-center text-2xl tracking-[0.5em] font-bold"
              placeholder="••••••"
              maxLength={6}
            />
          </Field>
          <button type="submit" disabled={loading || otpCode.length !== 6} className="btn-primary w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify & continue
          </button>
          <button
            type="button"
            onClick={() => { setOtpSent(false); setOtpCode(""); }}
            className="block w-full text-center text-sm font-medium text-primary"
          >
            Use a different email
          </button>
        </form>
      )}

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>

      <button onClick={onGoogle} disabled={loading} className="btn-secondary w-full">
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 11v2.7h6.4c-.3 1.6-2 4.6-6.4 4.6-3.9 0-7-3.2-7-7.2s3.1-7.2 7-7.2c2.2 0 3.7.9 4.6 1.7l3.1-3C17.7 1.4 15.1.3 12 .3 5.9.3 1 5.2 1 11.1S5.9 22 12 22c6.9 0 11.5-4.8 11.5-11.7 0-.8-.1-1.4-.2-2L12 11z"/></svg>
        Continue with Google
      </button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "signin" ? "New to KhanaGharTak?" : "Already have an account?"}{" "}
        <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setOtpSent(false); setOtpCode(""); }}
          className="font-semibold text-primary">
          {mode === "signin" ? "Create account" : "Sign in"}
        </button>
      </p>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Are you the restaurant owner?{" "}
        <Link to="/admin" className="font-medium underline">Open admin panel</Link>
      </p>

      <style>{`
        .input { width:100%; height:48px; border-radius: 12px; padding: 0 14px; background: var(--color-input); border: 1px solid var(--color-border); font-size: 15px; outline: none; }
        .input:focus { border-color: var(--color-ring); box-shadow: 0 0 0 3px oklch(0.66 0.21 35 / 0.15); }
        .btn-primary { display:inline-flex; align-items:center; justify-content:center; height: 50px; border-radius: 14px; background: var(--color-primary); color: var(--color-primary-foreground); font-weight: 700; font-size: 15px; box-shadow: var(--shadow-soft); }
        .btn-primary:disabled { opacity: .7; }
        .btn-secondary { display:inline-flex; align-items:center; justify-content:center; height: 48px; border-radius: 14px; background: var(--color-card); border: 1px solid var(--color-border); font-weight: 600; font-size: 14px; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
