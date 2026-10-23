import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BrandHeader } from "@/components/BrandHeader";
import { PageSpinner } from "@/components/PageState";
import { formatIndiaTel } from "@/lib/phone";
import { withTimeout } from "@/lib/supabase-query";
import {
  User,
  Phone,
  MapPin,
  Receipt,
  Headphones,
  Star,
  FileText,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Edit3,
  X,
  Loader2,
  CheckCircle2,
  MessageSquare,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "My Profile — KhanaGharTak" },
      { name: "description", content: "Manage your account, view delivery addresses, track orders, and reach support on KhanaGharTak." },
      { property: "og:title", content: "My Profile — KhanaGharTak" },
      { property: "og:description", content: "Manage your account, view delivery addresses, track orders, and reach support on KhanaGharTak." },
      { property: "og:url", content: "https://khanaghartak.in/profile" },
    ],
    links: [{ rel: "canonical", href: "https://khanaghartak.in/profile" }],
  }),
});

interface CustomerProfile {
  full_name: string;
  phone: string;
  address: string;
  landmark: string;
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();

  const [profile, setProfile] = useState<CustomerProfile>({
    full_name: "",
    phone: "",
    address: "",
    landmark: "",
  });
  const [profileLoading, setProfileLoading] = useState(true);

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState<CustomerProfile>({
    full_name: "",
    phone: "",
    address: "",
    landmark: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Rating review state
  const [starCount, setStarCount] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);

  // 1. Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login", search: { as: "customer" } });
    }
  }, [user, authLoading, navigate]);

  // 2. Fetch Customer Profile
  useEffect(() => {
    if (!user) return;
    let active = true;

    withTimeout(
      supabase
        .from("profiles")
        .select("full_name, phone, address, landmark")
        .eq("id", user.id)
        .maybeSingle()
    )
      .then(({ data }) => {
        if (!active) return;
        const localAddr = typeof window !== "undefined" ? localStorage.getItem("kgt:delivery-address") || "" : "";
        const defaultName = data?.full_name || (user.user_metadata?.full_name as string) || "Customer";
        const defaultPhone = data?.phone || (user.phone ? user.phone.replace("+91", "") : "");
        const defaultAddress = data?.address || localAddr;
        const defaultLandmark = data?.landmark || "";

        const loaded: CustomerProfile = {
          full_name: defaultName,
          phone: defaultPhone,
          address: defaultAddress,
          landmark: defaultLandmark,
        };

        setProfile(loaded);
        setEditForm(loaded);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  // Handle Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (editForm.full_name.trim().length < 2) {
      toast.error("Please enter a valid name");
      return;
    }
    if (editForm.phone.trim().length < 10) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }

    setSavingProfile(true);
    try {
      const cleanPhone = editForm.phone.replace(/\D/g, "").slice(-10);
      const cleanName = editForm.full_name.trim();
      const cleanAddress = editForm.address.trim();
      const cleanLandmark = editForm.landmark.trim();

      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: cleanName,
        phone: cleanPhone,
        address: cleanAddress,
        landmark: cleanLandmark,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

      if (error) throw error;

      if (typeof window !== "undefined" && cleanAddress) {
        localStorage.setItem("kgt:delivery-address", cleanAddress);
        window.dispatchEvent(new Event("kgt:address-changed"));
      }

      setProfile({
        full_name: cleanName,
        phone: cleanPhone,
        address: cleanAddress,
        landmark: cleanLandmark,
      });

      toast.success("Profile updated successfully!");
      setShowEditModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Submit Rating
  const handleSubmitRating = async () => {
    if (!user) return;
    setSubmittingRating(true);
    try {
      // Record feedback in local storage or toast
      localStorage.setItem("kgt:app-rated", `${starCount}`);
      toast.success("Thank you for rating KhanaGharTak! We appreciate your feedback.");
      setShowRatingModal(false);
    } catch {
      toast.error("Could not record rating");
    } finally {
      setSubmittingRating(false);
    }
  };

  if (authLoading || profileLoading) {
    return <PageSpinner label="Loading your profile…" />;
  }

  const initials = profile.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "CU";

  return (
    <div className="pb-36 bg-background min-h-screen">
      <BrandHeader subtitle="My Profile" />

      <div className="px-4 pt-4 space-y-4 max-w-lg mx-auto">
        {/* 1. PROFILE HEADER CARD */}
        <div className="rounded-3xl border bg-card p-5 shadow-[var(--shadow-card)] relative overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-black text-xl shadow-md shrink-0">
              {initials}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground truncate">
                  {profile.full_name || "Customer"}
                </h1>
                <span className="text-[10px] font-bold text-success bg-success/15 px-2 py-0.5 rounded-full shrink-0">
                  Customer
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-primary" />
                {profile.phone ? `+91 ${profile.phone}` : "No phone added"}
              </p>
            </div>

            <button
              onClick={() => {
                setEditForm(profile);
                setShowEditModal(true);
              }}
              className="p-2.5 rounded-xl border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95 transition shrink-0"
              title="Edit Profile"
            >
              <Edit3 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 2. SAVED DELIVERY ADDRESS CARD */}
        <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] space-y-2.5">
          <div className="flex items-center justify-between pb-1 border-b border-border/40">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary" /> Saved Delivery Address
            </h2>
            <Link
              to="/location"
              className="text-xs font-bold text-primary hover:underline"
            >
              Change on Map
            </Link>
          </div>

          <div className="pt-1">
            {profile.address ? (
              <div className="flex items-start gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0 text-xs">
                  <p className="font-semibold text-foreground leading-relaxed break-words">
                    {profile.address}
                  </p>
                  {profile.landmark && (
                    <p className="text-muted-foreground mt-0.5">
                      Landmark: <span className="text-foreground">{profile.landmark}</span>
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between py-2 text-xs text-muted-foreground">
                <span>No delivery address saved yet.</span>
                <Link
                  to="/location"
                  className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary"
                >
                  Add Address
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* 3. QUICK ACTIONS & SHORTCUTS */}
        <div className="rounded-2xl border bg-card divide-y divide-border/40 shadow-[var(--shadow-card)] overflow-hidden">
          {/* My Orders Shortcut */}
          <Link
            to="/orders"
            className="flex items-center justify-between p-4 hover:bg-muted/30 active:bg-muted/50 transition group"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  My Orders
                </p>
                <p className="text-xs text-muted-foreground">
                  View past orders and live tracking
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>

          {/* Help & Support */}
          <button
            onClick={() => setShowSupportModal(true)}
            className="flex items-center justify-between p-4 w-full text-left hover:bg-muted/30 active:bg-muted/50 transition group"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <Headphones className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  Help & Support
                </p>
                <p className="text-xs text-muted-foreground">
                  Call or WhatsApp our delivery helpline
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>

          {/* Rate & Review */}
          <button
            onClick={() => setShowRatingModal(true)}
            className="flex items-center justify-between p-4 w-full text-left hover:bg-muted/30 active:bg-muted/50 transition group"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-500">
                <Star className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground group-hover:text-amber-500 transition-colors">
                  Rate & Review KhanaGharTak
                </p>
                <p className="text-xs text-muted-foreground">
                  Help us serve you better
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-amber-500 transition-colors" />
          </button>
        </div>

        {/* 4. LEGAL & POLICIES */}
        <div className="rounded-2xl border bg-card divide-y divide-border/40 shadow-[var(--shadow-card)] overflow-hidden">
          {/* Terms & Conditions */}
          <Link
            to="/terms-and-conditions"
            className="flex items-center justify-between p-4 hover:bg-muted/30 active:bg-muted/50 transition group"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-muted-foreground">
                <FileText className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                Terms & Conditions
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>

          {/* Privacy Policy */}
          <Link
            to="/privacy-policy"
            className="flex items-center justify-between p-4 hover:bg-muted/30 active:bg-muted/50 transition group"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                Privacy Policy
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        </div>

        {/* 5. LOGOUT ACTION */}
        <div className="pt-2">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center justify-center gap-2 w-full rounded-2xl border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 p-3.5 text-sm font-bold text-destructive active:scale-[0.99] transition shadow-sm"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout from Account</span>
          </button>
        </div>

        {/* APP VERSION FOOTER */}
        <div className="pt-4 text-center space-y-1 pb-4">
          <p className="text-xs font-semibold text-muted-foreground">
            KhanaGharTak Customer App · v1.0.8
          </p>
          <p className="text-[11px] text-muted-foreground/80">
            Delivering hot, authentic food in Shankargarh & Chakghat
          </p>
        </div>
      </div>

      {/* MODAL: EDIT PROFILE */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> Edit Profile
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Full Name
                </label>
                <input
                  className="ck-input"
                  value={editForm.full_name}
                  maxLength={80}
                  placeholder="Enter your full name"
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Mobile Number
                </label>
                <input
                  className="ck-input"
                  value={editForm.phone}
                  maxLength={10}
                  inputMode="tel"
                  placeholder="10-digit mobile number"
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Default Delivery Address
                </label>
                <textarea
                  className="ck-input"
                  rows={2}
                  value={editForm.address}
                  maxLength={300}
                  placeholder="House no., street, area"
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Landmark (Optional)
                </label>
                <input
                  className="ck-input"
                  value={editForm.landmark}
                  maxLength={100}
                  placeholder="e.g. Near Shiv Mandir"
                  onChange={(e) => setEditForm({ ...editForm, landmark: e.target.value })}
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 rounded-xl border py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground shadow-md disabled:opacity-50"
                >
                  {savingProfile ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HELP & SUPPORT */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl border bg-card p-6 shadow-2xl space-y-4 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary mx-auto">
              <Headphones className="h-7 w-7" />
            </div>

            <div>
              <h2 className="text-base font-bold text-foreground">KhanaGharTak Support</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Need help with your order or delivery? We are here to assist you 7 days a week.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <a
                href={`tel:${formatIndiaTel("9711720846")}`}
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md active:scale-95 transition"
              >
                <Phone className="h-4 w-4" /> Call +91 97117 20846
              </a>

              <a
                href="https://wa.me/919711720846?text=Hi%20KhanaGharTak%20Support,%20I%20need%20help%20with%20my%20order"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-2xl border border-success/40 bg-success/10 py-3 text-sm font-bold text-success active:scale-95 transition"
              >
                <MessageSquare className="h-4 w-4" /> Chat on WhatsApp
              </a>
            </div>

            <button
              onClick={() => setShowSupportModal(false)}
              className="w-full py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* MODAL: RATE & REVIEW */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl border bg-card p-6 shadow-2xl space-y-4 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/10 text-amber-500 mx-auto">
              <Sparkles className="h-7 w-7" />
            </div>

            <div>
              <h2 className="text-base font-bold text-foreground">Rate KhanaGharTak</h2>
              <p className="text-xs text-muted-foreground mt-1">
                How has your experience been with our food and delivery service?
              </p>
            </div>

            {/* STAR SELECTION */}
            <div className="flex justify-center items-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStarCount(s)}
                  className="p-1 active:scale-125 transition-transform"
                >
                  <Star
                    className={`h-8 w-8 ${
                      s <= starCount
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>

            <textarea
              className="ck-input"
              rows={2}
              value={reviewComment}
              placeholder="Tell us what you liked or how we can improve (optional)"
              onChange={(e) => setReviewComment(e.target.value)}
            />

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowRatingModal(false)}
                className="flex-1 rounded-xl border py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitRating}
                disabled={submittingRating}
                className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-600 py-2.5 text-xs font-bold text-white shadow-md active:scale-95 transition"
              >
                Submit Rating
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LOGOUT CONFIRMATION */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xs rounded-3xl border bg-card p-6 shadow-2xl space-y-4 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive mx-auto">
              <LogOut className="h-6 w-6" />
            </div>

            <div>
              <h2 className="text-base font-bold text-foreground">Sign Out?</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Are you sure you want to log out from KhanaGharTak on this device?
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 rounded-xl border py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => signOut()}
                className="flex-1 rounded-xl bg-destructive py-2.5 text-xs font-bold text-destructive-foreground shadow-md active:scale-95 transition"
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.ck-input { width: 100%; border-radius: 12px; padding: 10px 14px; background: var(--color-input); border: 1px solid var(--color-border); font-size: 13.5px; outline: none; transition: border-color 0.15s; } .ck-input:focus { border-color: var(--color-ring); }`}</style>
    </div>
  );
}
