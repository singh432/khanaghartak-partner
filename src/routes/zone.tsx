import { createFileRoute, useNavigate, ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Bike,
  ClipboardList,
  Loader2,
  MapPin,
  ShieldAlert,
  Store,
  Users,
  LogOut,
  Phone,
  MessageSquare,
  Plus,
  Edit2,
  Check,
  X,
  Pause,
  Play,
  Eye,
  AlertCircle,
  RefreshCw,
  Power,
  Utensils,
  Search,
  ChevronDown,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { khanaGharTakLogoUrl } from "@/assets/brand";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { inRange, rangeLabel, todayInputValue, type DateRange } from "@/lib/date-range";
import { sumPayouts, sumPlatformRevenue, inr } from "@/lib/payouts";
import type { ZonePoint } from "@/lib/zones";
import { isRestaurantOpen, hoursLabel } from "@/lib/hours";
import { useMinuteTick } from "@/hooks/useMinuteTick";
import { silencePartnerOrderAlert } from "@/components/PartnerNotificationListener";

const ZoneMapEditor = lazy(() => import("@/components/ZoneMapEditor.client"));

export const Route = createFileRoute("/zone")({
  component: ZoneManagerPage,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Zone Manager — KhanaGharTak" },
      { name: "description", content: "Manage orders, restaurants, riders and customers for your assigned KhanaGharTak delivery zone." },
      { property: "og:title", content: "Zone Manager — KhanaGharTak" },
      { property: "og:description", content: "Manage orders, restaurants, riders and customers for your assigned KhanaGharTak delivery zone." },
      { property: "og:type", content: "website" },
    ],
  }),
});

type Zone = { id: string; name: string; city: string | null; is_active: boolean; polygon: ZonePoint[] | null };

type OrderItem = { name: string; qty: number; price: number; variant?: string };

type Order = {
  id: string;
  restaurant_id: string | null;
  restaurant_name: string | null;
  status: string;
  total: number;
  subtotal: number;
  platform_fee: number;
  delivery_fee: number;
  discount: number;
  customer_name: string;
  customer_phone: string;
  address: string;
  landmark: string | null;
  rider_id: string | null;
  rider_name: string | null;
  items: OrderItem[] | null;
  created_at: string;
};

type Rest = {
  id: string;
  name: string;
  tagline?: string | null;
  status: string;
  is_open: boolean;
  address: string | null;
  phone: string | null;
  opening_time?: string | null;
  closing_time?: string | null;
  delivery_charges?: number;
  min_order_value?: number;
  rating?: number;
  rating_count?: number;
};

type Rider = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  vehicle?: string | null;
  status: string;
  is_online: boolean;
  aadhaar_number?: string | null;
  aadhaar_image_url?: string | null;
};

type Cust = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  orders_count: number;
  total_spent: number | null;
  last_order_at: string;
};

type MenuItem = {
  id: string;
  restaurant_id: string;
  name: string;
  price: number;
  is_veg: boolean;
  is_available: boolean;
  is_out_of_stock?: boolean;
};

type Tab = "orders" | "restaurants" | "riders" | "customers" | "map";

function cleanPhoneDigits(phone: string | null | undefined): string {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "");
  if (d.length > 10) return d.slice(-10);
  return d;
}

function ZoneManagerPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState<string>("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [restaurants, setRestaurants] = useState<Rest[]>([]);
  const [customers, setCustomers] = useState<Cust[]>([]);
  const [tab, setTab] = useState<Tab>("orders");
  const [range, setRange] = useState<DateRange>({ kind: "today", date: todayInputValue() });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [points, setPoints] = useState<ZonePoint[]>([]);
  const [savingMap, setSavingMap] = useState(false);
  const now = useMinuteTick();

  // Search & Filter states
  const [searchRest, setSearchRest] = useState("");
  const [filterRestStatus, setFilterRestStatus] = useState<string>("all");
  const [searchRider, setSearchRider] = useState("");
  const [filterRiderStatus, setFilterRiderStatus] = useState<string>("all");
  const [searchOrder, setSearchOrder] = useState("");
  const [filterOrderStatus, setFilterOrderStatus] = useState<string>("all");

  // Modals state
  const [showAddRestModal, setShowAddRestModal] = useState(false);
  const [editingRest, setEditingRest] = useState<Rest | null>(null);
  const [menuRest, setMenuRest] = useState<Rest | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [showAddRiderModal, setShowAddRiderModal] = useState(false);
  const [viewingKycRider, setViewingKycRider] = useState<Rider | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [reassigningOrder, setReassigningOrder] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login", search: { as: "manager" } });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("zone_my_zones" as any).then(({ data }) => {
      const list = (data ?? []) as unknown as Zone[];
      setZones(list);
      setZoneId((cur) => cur || list[0]?.id || "");
      setLoading(false);
    });
  }, [user]);

  const load = async (id: string) => {
    if (!id) return;
    const [{ data: o }, { data: rd }, { data: rs }, { data: cs }] = await Promise.all([
      supabase.rpc("zone_list_orders" as any, { _zone_id: id, _limit: 300 }),
      supabase.rpc("zone_list_riders" as any, { _zone_id: id }),
      supabase.rpc("zone_list_restaurants" as any, { _zone_id: id }),
      supabase.rpc("zone_list_customers" as any, { _zone_id: id }),
    ]);

    const orderList = ((o ?? []) as any[]).map((ord) => ({
      ...ord,
      items: Array.isArray(ord.items)
        ? ord.items
        : typeof ord.items === "string"
        ? JSON.parse(ord.items || "[]")
        : null,
    })) as Order[];
    setOrders(orderList);
    setSelectedOrder((prev) => (prev ? orderList.find((x) => x.id === prev.id) ?? prev : null));

    const hasPlaced = orderList.some((ord) => ord.status === "placed" && !ord.rider_id);
    if (!hasPlaced) {
      silencePartnerOrderAlert();
    }

    // Enhance riders with vehicle and aadhaar from rider_profiles table
    const rawRiders = (rd ?? []) as unknown as Rider[];
    const rUids = rawRiders.map((r) => r.user_id);
    if (rUids.length) {
      const { data: moreRider } = await (supabase.from("rider_profiles") as any)
        .select("user_id,vehicle,aadhaar_number,aadhaar_image_url")
        .in("user_id", rUids);
      const rdMap: Record<string, any> = {};
      ((moreRider ?? []) as any[]).forEach((item) => {
        rdMap[item.user_id] = item;
      });
      setRiders(rawRiders.map((r) => ({ ...r, ...(rdMap[r.user_id] ?? {}) })));
    } else {
      setRiders(rawRiders);
    }

    // Enhance restaurants with full details
    const rests = (rs ?? []) as unknown as Rest[];
    const ids = rests.map((r) => r.id);
    if (ids.length) {
      const { data: moreRest } = await (supabase.from("restaurants") as any)
        .select("id,tagline,phone,address,status,is_open,opening_time,closing_time,delivery_charges,min_order_value")
        .in("id", ids);
      const rmap: Record<string, any> = {};
      ((moreRest ?? []) as any[]).forEach((h) => {
        rmap[h.id] = h;
      });
      setRestaurants(rests.map((r) => ({ ...r, ...(rmap[r.id] ?? {}) })));
    } else {
      setRestaurants(rests);
    }

    setCustomers((cs ?? []) as unknown as Cust[]);
  };

  useEffect(() => {
    if (!zoneId) return;
    load(zoneId);
    const t = setInterval(() => load(zoneId), 8000);
    const onAlert = () => load(zoneId);
    window.addEventListener("kgt:partner-order-alert", onAlert);
    return () => {
      clearInterval(t);
      window.removeEventListener("kgt:partner-order-alert", onAlert);
    };
  }, [zoneId]);

  const currentZone = zones.find((z) => z.id === zoneId) ?? null;

  useEffect(() => {
    const poly = currentZone?.polygon;
    setPoints(Array.isArray(poly) ? (poly as ZonePoint[]) : []);
  }, [zoneId, currentZone?.polygon]);

  const saveBoundary = async () => {
    if (!zoneId) return;
    if (points.length < 3) return toast.error("Draw at least 3 boundary points on the map");
    setSavingMap(true);
    const { error } = await (supabase.from("delivery_zones") as any)
      .update({ polygon: points as any })
      .eq("id", zoneId);
    setSavingMap(false);
    if (error) return toast.error(error.message);
    toast.success("Zone boundary saved");
    setZones((zs) => zs.map((z) => (z.id === zoneId ? { ...z, polygon: points } : z)));
  };

  // -------------------------------------------------------------
  // RESTAURANT ACTIONS
  // -------------------------------------------------------------
  const setRestaurantStatus = async (id: string, status: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("zone_set_restaurant_status" as any, {
      _restaurant_id: id,
      _status: status,
    });
    setBusy(null);
    if (error) {
      // Fallback
      const { error: fErr } = await (supabase.from("restaurants") as any).update({ status }).eq("id", id);
      if (fErr) return toast.error(error.message || fErr.message);
    }
    toast.success(`Restaurant marked ${status}`);
    load(zoneId);
  };

  const setRestaurantOpen = async (id: string, isOpen: boolean) => {
    setBusy(id);
    const { error } = await supabase.rpc("zone_set_restaurant_open" as any, {
      _restaurant_id: id,
      _is_open: isOpen,
    });
    setBusy(null);
    if (error) {
      const { error: fErr } = await (supabase.from("restaurants") as any).update({ is_open: isOpen }).eq("id", id);
      if (fErr) return toast.error(error.message || fErr.message);
    }
    toast.success(isOpen ? "Restaurant opened" : "Restaurant closed");
    load(zoneId);
  };

  const handleSaveEditRestaurant = async (form: any) => {
    if (!editingRest) return;
    setBusy("saving-edit-rest");
    const { error } = await supabase.rpc("zone_update_restaurant" as any, {
      _restaurant_id: editingRest.id,
      _name: form.name.trim(),
      _phone: form.phone.trim(),
      _address: form.address.trim(),
      _opening_time: form.opening_time,
      _closing_time: form.closing_time,
      _delivery_charges: Number(form.delivery_charges) || 25,
      _min_order_value: Number(form.min_order_value) || 0,
      _tagline: form.tagline ? form.tagline.trim() : null,
    });
    setBusy(null);
    if (error) {
      const { error: fErr } = await (supabase.from("restaurants") as any)
        .update({
          name: form.name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          opening_time: form.opening_time,
          closing_time: form.closing_time,
          delivery_charges: Number(form.delivery_charges) || 25,
          min_order_value: Number(form.min_order_value) || 0,
          tagline: form.tagline ? form.tagline.trim() : null,
        })
        .eq("id", editingRest.id);
      if (fErr) return toast.error(error.message || fErr.message);
    }
    toast.success("Restaurant details updated");
    setEditingRest(null);
    load(zoneId);
  };

  const handleAddRestaurant = async (form: any) => {
    if (!zoneId) return;
    if (!form.name.trim()) return toast.error("Enter restaurant name");
    if (!form.phone.trim()) return toast.error("Enter contact phone");
    setBusy("adding-rest");
    const { error } = await supabase.rpc("zone_add_restaurant" as any, {
      _zone_id: zoneId,
      _name: form.name.trim(),
      _phone: form.phone.trim(),
      _address: form.address.trim(),
      _opening_time: form.opening_time || "09:00",
      _closing_time: form.closing_time || "22:00",
      _delivery_charges: Number(form.delivery_charges) || 25,
      _min_order_value: Number(form.min_order_value) || 0,
      _tagline: form.tagline ? form.tagline.trim() : null,
    });
    setBusy(null);
    if (error) {
      const { error: fErr } = await (supabase.from("restaurants") as any).insert({
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        opening_time: form.opening_time || "09:00",
        closing_time: form.closing_time || "22:00",
        delivery_charges: Number(form.delivery_charges) || 25,
        min_order_value: Number(form.min_order_value) || 0,
        tagline: form.tagline ? form.tagline.trim() : null,
        zone_id: zoneId,
        status: "active",
        is_open: true,
      });
      if (fErr) return toast.error(error.message || fErr.message);
    }
    toast.success("New restaurant onboarded successfully!");
    setShowAddRestModal(false);
    load(zoneId);
  };

  // -------------------------------------------------------------
  // MENU MANAGEMENT ACTIONS
  // -------------------------------------------------------------
  const openMenuModal = async (r: Rest) => {
    setMenuRest(r);
    setLoadingMenu(true);
    const { data, error } = await supabase.rpc("zone_list_menu_items" as any, { _restaurant_id: r.id });
    if (!error && data) {
      setMenuItems((data as MenuItem[]) ?? []);
    } else {
      const { data: fallbackData } = await (supabase.from("menu_items") as any)
        .select("id,restaurant_id,name,price,is_veg,is_available,is_out_of_stock")
        .eq("restaurant_id", r.id)
        .order("name");
      setMenuItems((fallbackData as MenuItem[]) ?? []);
    }
    setLoadingMenu(false);
  };

  const toggleMenuItemStock = async (itemId: string, currentAvailable: boolean) => {
    const nextVal = !currentAvailable;
    setMenuItems((list) => list.map((item) => (item.id === itemId ? { ...item, is_available: nextVal } : item)));
    const { error } = await supabase.rpc("zone_toggle_menu_item" as any, {
      _item_id: itemId,
      _is_available: nextVal,
    });
    if (error) {
      await (supabase.from("menu_items") as any)
        .update({ is_available: nextVal, is_out_of_stock: !nextVal })
        .eq("id", itemId);
    }
    toast.success(nextVal ? "Item marked In Stock" : "Item marked Out of Stock");
  };

  // -------------------------------------------------------------
  // RIDER ACTIONS
  // -------------------------------------------------------------
  const setRiderStatus = async (userId: string, status: string) => {
    setBusy(userId);
    const { error } = await supabase.rpc("zone_set_rider_status" as any, { _user_id: userId, _status: status });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`Rider marked ${status}`);
    load(zoneId);
  };

  const setRiderOnline = async (userId: string, isOnline: boolean) => {
    setBusy(userId);
    const { error } = await supabase.rpc("zone_set_rider_online" as any, { _user_id: userId, _is_online: isOnline });
    setBusy(null);
    if (error) {
      await (supabase.from("rider_profiles") as any).update({ is_online: isOnline }).eq("user_id", userId);
    }
    toast.success(isOnline ? "Rider set Online" : "Rider set Offline");
    load(zoneId);
  };

  const handleAddRider = async (form: any) => {
    if (!zoneId) return;
    if (!form.full_name.trim()) return toast.error("Enter rider full name");
    if (!form.phone.trim()) return toast.error("Enter rider phone number");
    setBusy("adding-rider");
    const { error } = await supabase.rpc("zone_add_rider" as any, {
      _zone_id: zoneId,
      _full_name: form.full_name.trim(),
      _phone: form.phone.trim(),
      _vehicle: form.vehicle.trim() || "Motorcycle",
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Rider enrolled and approved for this zone!");
    setShowAddRiderModal(false);
    load(zoneId);
  };

  // -------------------------------------------------------------
  // ORDER ACTIONS
  // -------------------------------------------------------------
  const assign = async (orderId: string, riderId: string) => {
    if (!riderId) return;
    silencePartnerOrderAlert();
    setBusy(orderId);
    const { error } = await supabase.rpc("zone_assign_rider" as any, { _order_id: orderId, _rider_id: riderId });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Rider assigned to order");
    setReassigningOrder(null);
    setSelectedOrder((prev) => {
      if (prev && prev.id === orderId) {
        const rd = riders.find((r) => r.user_id === riderId);
        return { ...prev, rider_id: riderId, rider_name: rd?.full_name ?? riderId.slice(0, 8) };
      }
      return prev;
    });
    load(zoneId);
  };

  const updateOrderStatus = async (orderId: string, status: string, reason?: string) => {
    setBusy(orderId);
    const { error } = await supabase.rpc("zone_update_order_status" as any, {
      _order_id: orderId,
      _status: status,
      _reason: reason || null,
    });
    setBusy(null);
    if (error) {
      const { error: fErr } = await (supabase.from("orders") as any)
        .update({
          status,
          cancellation_reason: status === "cancelled" ? reason || "Cancelled by Zone Manager" : undefined,
        })
        .eq("id", orderId);
      if (fErr) return toast.error(error.message || fErr.message);
    }
    toast.success(`Order status updated to ${status}`);
    setCancellingOrder(null);
    setSelectedOrder((prev) => (prev && prev.id === orderId ? { ...prev, status } : prev));
    load(zoneId);
  };

  // -------------------------------------------------------------
  // FILTERED DATA
  // -------------------------------------------------------------
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesRange = inRange(o.created_at, range);
      if (!matchesRange) return false;
      if (filterOrderStatus !== "all") {
        if (filterOrderStatus === "needs_rider" && (o.rider_id || o.status !== "placed")) return false;
        else if (filterOrderStatus === "active" && ["delivered", "cancelled", "rejected"].includes(o.status)) return false;
        else if (filterOrderStatus !== "needs_rider" && filterOrderStatus !== "active" && o.status !== filterOrderStatus) return false;
      }
      if (searchOrder) {
        const q = searchOrder.toLowerCase();
        const matchesQuery =
          o.id.toLowerCase().includes(q) ||
          (o.restaurant_name ?? "").toLowerCase().includes(q) ||
          (o.customer_name ?? "").toLowerCase().includes(q) ||
          (o.customer_phone ?? "").includes(q);
        if (!matchesQuery) return false;
      }
      return true;
    });
  }, [orders, range, filterOrderStatus, searchOrder]);

  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((r) => {
      if (filterRestStatus !== "all") {
        if (filterRestStatus === "active" && r.status !== "active") return false;
        if (filterRestStatus === "pending" && r.status !== "pending") return false;
        if (filterRestStatus === "closed" && (r.is_open || r.status !== "active")) return false;
        if (filterRestStatus === "inactive" && r.status !== "inactive" && r.status !== "suspended") return false;
      }
      if (searchRest) {
        const q = searchRest.toLowerCase();
        const matchesQuery =
          r.name.toLowerCase().includes(q) ||
          (r.phone ?? "").includes(q) ||
          (r.address ?? "").toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }
      return true;
    });
  }, [restaurants, filterRestStatus, searchRest]);

  const sortedRestaurants = useMemo(() => {
    return filteredRestaurants.slice().sort((a, b) => {
      const openA = isRestaurantOpen(a, now);
      const openB = isRestaurantOpen(b, now);
      if (openA !== openB) return openA ? -1 : 1;
      return 0;
    });
  }, [filteredRestaurants, now]);

  const filteredRiders = useMemo(() => {
    return riders.filter((r) => {
      if (filterRiderStatus !== "all") {
        if (filterRiderStatus === "approved" && r.status !== "approved") return false;
        if (filterRiderStatus === "pending" && r.status !== "pending") return false;
        if (filterRiderStatus === "online" && (!r.is_online || r.status !== "approved")) return false;
        if (filterRiderStatus === "offline" && (r.is_online || r.status !== "approved")) return false;
      }
      if (searchRider) {
        const q = searchRider.toLowerCase();
        const matchesQuery =
          (r.full_name ?? "").toLowerCase().includes(q) ||
          (r.phone ?? "").includes(q) ||
          (r.vehicle ?? "").toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }
      return true;
    });
  }, [riders, filterRiderStatus, searchRider]);

  const sortedRiders = useMemo(() => {
    const rank = (s: string) => (s === "pending" ? 0 : s === "approved" ? 1 : 2);
    return filteredRiders.slice().sort((a, b) => rank(a.status) - rank(b.status));
  }, [filteredRiders]);

  const stats = useMemo(() => {
    const inRangeOrders = orders.filter((o) => inRange(o.created_at, range));
    const delivered = inRangeOrders.filter((o) => o.status === "delivered");
    const deliveredRevenue = sumPlatformRevenue(delivered as any);
    const pay = sumPayouts(delivered as any);
    return {
      orders: inRangeOrders.length,
      delivered: delivered.length,
      cancelled: inRangeOrders.filter((o) => ["cancelled", "rejected"].includes(o.status)).length,
      gross: pay.platformGross,
      revenue: deliveredRevenue.actual,
      restaurant: pay.restaurant,
      discounts: pay.discount,
      settlement: pay.platformActual,
      rider: pay.rider,
      net: pay.platformNet,
    };
  }, [orders, range]);

  if (authLoading || loading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;

  if (zones.length === 0) {
    return (
      <div className="p-6 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-lg font-bold">No zone assigned</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This account is not a manager of any delivery zone yet. Ask the platform owner to assign you one.
        </p>
        <button onClick={signOut} className="mt-6 rounded-full bg-secondary px-4 py-2 text-sm font-bold">
          Sign out
        </button>
      </div>
    );
  }

  const activeRiders = riders.filter((r) => r.status === "approved");

  return (
    <div className="min-h-screen bg-secondary/30 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-card px-4 py-3 shadow-sm">
        <img src={khanaGharTakLogoUrl} width={36} height={36} alt="" className="h-9 w-9 rounded-lg object-contain" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">Zone Manager</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <select
          value={zoneId}
          onChange={(e) => setZoneId(e.target.value)}
          className="h-9 rounded-lg border bg-background px-2 text-xs font-semibold"
        >
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
        <button
          onClick={signOut}
          aria-label="Sign out"
          className="rounded-full bg-secondary p-2 hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <div className="space-y-4 p-4">
        {/* Date Filter & Metrics */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold">
            <MapPin className="h-4 w-4 text-primary" /> {rangeLabel(range)} · {currentZone?.name}
          </div>
          <DateRangeFilter value={range} onChange={setRange} />
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
          <Stat label="Orders" value={String(stats.orders)} />
          <Stat label="Delivered" value={String(stats.delivered)} />
          <Stat label="Cancelled" value={String(stats.cancelled)} />
          <Stat label="Gross Total" value={inr(stats.gross)} />
          <Stat label="Restaurant Cut" value={inr(stats.restaurant)} />
          <Stat label="Discounts" value={inr(-stats.discounts)} />
          <Stat label="Revenue" value={inr(stats.revenue)} />
          <Stat label="Settlement" value={inr(stats.settlement)} />
          <Stat label="Rider Cut" value={inr(stats.rider)} />
          <Stat label="Net Profit" value={inr(stats.net)} />
        </div>

        {/* Tab Selector */}
        <div className="flex gap-2 overflow-x-auto pb-1" id="kgt-zone-top-tabs">
          {([
            ["orders", `Orders (${orders.length})`, ClipboardList],
            ["restaurants", `Restaurants (${restaurants.length})`, Store],
            ["riders", `Riders (${riders.length})`, Bike],
            ["customers", `Customers (${customers.length})`, Users],
            ["map", "Zone Map", MapPin],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              id={`kgt-zone-btn-${key}`}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                tab === key ? "bg-primary text-primary-foreground shadow-sm" : "bg-card text-muted-foreground hover:bg-secondary"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* ========================================================================= */}
        {/* ORDERS TAB */}
        {/* ========================================================================= */}
        {tab === "orders" && (
          <div className="space-y-3">
            {/* Search and Filter */}
            <div className="flex flex-col gap-2 rounded-2xl border bg-card p-3 shadow-sm">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  value={searchOrder}
                  onChange={(e) => setSearchOrder(e.target.value)}
                  placeholder="Search by order #, restaurant, customer..."
                  className="h-9 w-full rounded-xl border bg-background pl-9 pr-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs font-bold">
                {[
                  ["all", "All"],
                  ["needs_rider", "Needs Rider"],
                  ["active", "Active"],
                  ["placed", "Placed"],
                  ["preparing", "Preparing"],
                  ["ready", "Ready"],
                  ["out_for_delivery", "Out for Delivery"],
                  ["delivered", "Delivered"],
                  ["cancelled", "Cancelled"],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setFilterOrderStatus(k)}
                    className={`rounded-full px-3 py-1 transition-colors ${
                      filterOrderStatus === k ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground/70"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {filteredOrders.length === 0 && <Empty>No orders matching this filter.</Empty>}

            {filteredOrders.map((o) => {
              const cleanCustPhone = cleanPhoneDigits(o.customer_phone);
              const isAssigned = !!o.rider_id;
              const isReassigning = reassigningOrder === o.id;

              return (
                <article
                  key={o.id}
                  data-order-id={o.id}
                  data-order-items={JSON.stringify(o.items || [])}
                  onClick={() => setSelectedOrder(o)}
                  className="group relative cursor-pointer rounded-2xl border bg-card p-4 shadow-sm space-y-3 transition-all hover:border-primary/50 hover:shadow-md active:scale-[0.995]"
                >
                  {/* Top Bar */}
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-muted-foreground">
                          #{o.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold capitalize ${
                            o.status === "delivered"
                              ? "bg-success/15 text-success"
                              : o.status === "cancelled" || o.status === "rejected"
                              ? "bg-destructive/15 text-destructive"
                              : "bg-amber-500/15 text-amber-600"
                          }`}
                        >
                          {o.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="mt-1 text-base font-extrabold text-foreground">{o.restaurant_name ?? "Kitchen"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <p className="text-base font-black text-primary">₹{Number(o.total).toFixed(0)}</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(o);
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        <Eye className="h-3 w-3" /> View Details
                      </button>
                    </div>
                  </div>

                  {/* Customer Info & Contact */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-bold text-foreground">
                        {o.customer_name} <span className="font-normal text-muted-foreground">({o.customer_phone})</span>
                      </p>
                      <p className="text-muted-foreground">{o.landmark || o.address}</p>
                    </div>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {cleanCustPhone && (
                        <>
                          <a
                            href={`tel:${cleanCustPhone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            <Phone className="h-3 w-3" /> Call
                          </a>
                          <a
                            href={`https://wa.me/91${cleanCustPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                          >
                            <MessageSquare className="h-3 w-3" /> WA
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Items List Breakdown */}
                  {o.items && o.items.length > 0 && (
                    <div className="rounded-xl bg-secondary/50 p-2.5 text-xs space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Order Items:</p>
                      {o.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between font-medium">
                          <span>
                            <span className="font-bold text-foreground">{it.qty}x</span> {it.name}
                            {it.variant ? ` (${it.variant})` : ""}
                          </span>
                          <span className="text-muted-foreground">₹{it.price * it.qty}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Rider Assignment / Reassignment */}
                  <div className="rounded-xl border p-2.5 bg-background" onClick={(e) => e.stopPropagation()}>
                    {isAssigned && !isReassigning ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-success">
                          <Bike className="h-4 w-4" />
                          <span>Rider: {o.rider_name ?? o.rider_id?.slice(0, 8)}</span>
                        </div>
                        <button
                          onClick={() => setReassigningOrder(o.id)}
                          className="rounded-lg bg-secondary px-2.5 py-1 text-[11px] font-bold hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          Change Rider
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-amber-600">
                          <span className="flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {isAssigned ? "Reassign to different rider:" : "Assign a Delivery Rider:"}
                          </span>
                          {isReassigning && (
                            <button
                              onClick={() => setReassigningOrder(null)}
                              className="text-[10px] text-muted-foreground underline"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            defaultValue=""
                            disabled={busy === o.id}
                            onChange={(e) => assign(o.id, e.target.value)}
                            className="h-9 flex-1 rounded-xl border bg-card px-2.5 text-xs font-semibold"
                          >
                            <option value="">Select an active rider…</option>
                            {activeRiders.map((r) => (
                              <option key={r.user_id} value={r.user_id}>
                                {r.full_name ?? r.user_id.slice(0, 8)}
                                {r.phone ? ` · ${r.phone}` : ""}
                                {r.is_online ? " [Online]" : " [Offline]"}
                              </option>
                            ))}
                          </select>
                          {busy === o.id && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status Progression Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-1.5">
                      {o.status === "placed" && (
                        <button
                          disabled={busy === o.id}
                          onClick={() => updateOrderStatus(o.id, "preparing")}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90"
                        >
                          <Check className="h-3.5 w-3.5" /> Accept & Prepare
                        </button>
                      )}
                      {(o.status === "preparing" || o.status === "confirmed") && (
                        <button
                          disabled={busy === o.id}
                          onClick={() => updateOrderStatus(o.id, "ready")}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Mark Ready
                        </button>
                      )}
                      {o.status === "ready" && (
                        <button
                          disabled={busy === o.id}
                          onClick={() => updateOrderStatus(o.id, "out_for_delivery")}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                        >
                          <Bike className="h-3.5 w-3.5" /> Out for Delivery
                        </button>
                      )}
                      {o.status === "out_for_delivery" && (
                        <button
                          disabled={busy === o.id}
                          onClick={() => updateOrderStatus(o.id, "delivered")}
                          className="inline-flex items-center gap-1 rounded-lg bg-success px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                        >
                          <Check className="h-3.5 w-3.5" /> Mark Delivered
                        </button>
                      )}
                    </div>
                    {o.status !== "delivered" && o.status !== "cancelled" && o.status !== "rejected" && (
                      <button
                        onClick={() => setCancellingOrder(o)}
                        className="rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/20"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* RESTAURANTS TAB */}
        {/* ========================================================================= */}
        {tab === "restaurants" && (
          <div className="space-y-3">
            {/* Top Toolbar */}
            <div className="flex flex-col gap-2 rounded-2xl border bg-card p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    value={searchRest}
                    onChange={(e) => setSearchRest(e.target.value)}
                    placeholder="Search restaurant by name, phone, address..."
                    className="h-9 w-full rounded-xl border bg-background pl-9 pr-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  onClick={() => setShowAddRestModal(true)}
                  className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 shadow-sm shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Restaurant
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs font-bold">
                {[
                  ["all", `All (${restaurants.length})`],
                  ["active", `Active (${restaurants.filter((r) => r.status === "active").length})`],
                  ["pending", `Pending (${restaurants.filter((r) => r.status === "pending").length})`],
                  ["closed", "Closed Now"],
                  ["inactive", "Suspended / Inactive"],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setFilterRestStatus(k)}
                    className={`rounded-full px-3 py-1 transition-colors ${
                      filterRestStatus === k ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground/70"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {sortedRestaurants.length === 0 && <Empty>No restaurants found matching this criteria.</Empty>}

            {sortedRestaurants.map((r) => {
              const cleanPhone = cleanPhoneDigits(r.phone);
              const isOpen = isRestaurantOpen(r, now);

              return (
                <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-extrabold text-foreground">{r.name}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold capitalize ${
                            r.status === "active"
                              ? "bg-success/15 text-success"
                              : r.status === "pending"
                              ? "bg-amber-500/15 text-amber-600"
                              : "bg-destructive/15 text-destructive"
                          }`}
                        >
                          {r.status}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                            isOpen ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                          }`}
                        >
                          {isOpen ? "Open" : "Closed"}
                        </span>
                      </div>
                      {r.tagline && <p className="text-xs text-muted-foreground italic mt-0.5">{r.tagline}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        📍 {r.address ?? "Address not set"}
                        {hoursLabel(r.opening_time, r.closing_time) ? ` · 🕒 ${hoursLabel(r.opening_time, r.closing_time)}` : ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Delivery: ₹{r.delivery_charges ?? 25} · Min Order: ₹{r.min_order_value ?? 0}
                      </p>
                    </div>

                    {/* Quick Call / WhatsApp */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {cleanPhone && (
                        <>
                          <a
                            href={`tel:${cleanPhone}`}
                            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            <Phone className="h-3 w-3" /> Call
                          </a>
                          <a
                            href={`https://wa.me/91${cleanPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                          >
                            <MessageSquare className="h-3 w-3" /> WA
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Operational Controls & Menu Management */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openMenuModal(r)}
                        className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 font-bold hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        <Utensils className="h-3.5 w-3.5" /> Menu Items
                      </button>
                      <button
                        onClick={() => setEditingRest(r)}
                        className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 font-bold hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Edit Details
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Open / Close toggle */}
                      {r.status === "active" && (
                        <button
                          disabled={busy === r.id}
                          onClick={() => setRestaurantOpen(r.id, !r.is_open)}
                          className={`rounded-lg px-3 py-1.5 font-bold transition-colors ${
                            r.is_open ? "bg-amber-500/10 text-amber-600" : "bg-success/10 text-success"
                          }`}
                        >
                          {r.is_open ? "Close Kitchen" : "Open Kitchen"}
                        </button>
                      )}

                      {/* Status Change Buttons */}
                      {r.status === "pending" && (
                        <>
                          <button
                            disabled={busy === r.id}
                            onClick={() => setRestaurantStatus(r.id, "active")}
                            className="inline-flex items-center gap-1 rounded-lg bg-success px-3 py-1.5 font-bold text-white hover:opacity-90"
                          >
                            <Check className="h-3.5 w-3.5" /> Approve
                          </button>
                          <button
                            disabled={busy === r.id}
                            onClick={() => setRestaurantStatus(r.id, "rejected")}
                            className="inline-flex items-center gap-1 rounded-lg bg-destructive px-3 py-1.5 font-bold text-white hover:opacity-90"
                          >
                            <X className="h-3.5 w-3.5" /> Reject
                          </button>
                        </>
                      )}
                      {r.status === "active" && (
                        <button
                          disabled={busy === r.id}
                          onClick={() => setRestaurantStatus(r.id, "suspended")}
                          className="inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-2.5 py-1.5 font-bold text-destructive hover:bg-destructive/20"
                          title="Suspend restaurant"
                        >
                          <Pause className="h-3.5 w-3.5" /> Suspend
                        </button>
                      )}
                      {(r.status === "suspended" || r.status === "inactive" || r.status === "rejected") && (
                        <button
                          disabled={busy === r.id}
                          onClick={() => setRestaurantStatus(r.id, "active")}
                          className="inline-flex items-center gap-1 rounded-lg bg-success px-3 py-1.5 font-bold text-white hover:opacity-90"
                        >
                          <Play className="h-3.5 w-3.5" /> Activate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* RIDERS TAB */}
        {/* ========================================================================= */}
        {tab === "riders" && (
          <div className="space-y-3">
            {/* Top Toolbar */}
            <div className="flex flex-col gap-2 rounded-2xl border bg-card p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    value={searchRider}
                    onChange={(e) => setSearchRider(e.target.value)}
                    placeholder="Search rider by name, phone, vehicle..."
                    className="h-9 w-full rounded-xl border bg-background pl-9 pr-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  onClick={() => setShowAddRiderModal(true)}
                  className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 shadow-sm shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Rider
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs font-bold">
                {[
                  ["all", `All (${riders.length})`],
                  ["approved", `Approved (${riders.filter((r) => r.status === "approved").length})`],
                  ["pending", `Pending (${riders.filter((r) => r.status === "pending").length})`],
                  ["online", `Online (${riders.filter((r) => r.is_online && r.status === "approved").length})`],
                  ["offline", "Offline"],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setFilterRiderStatus(k)}
                    className={`rounded-full px-3 py-1 transition-colors ${
                      filterRiderStatus === k ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground/70"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {sortedRiders.length === 0 && <Empty>No riders found matching this criteria.</Empty>}

            {sortedRiders.map((r) => {
              const cleanPhone = cleanPhoneDigits(r.phone);

              return (
                <div key={r.user_id} className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-extrabold text-foreground">{r.full_name ?? r.user_id.slice(0, 8)}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold capitalize ${
                            r.status === "approved"
                              ? "bg-success/15 text-success"
                              : r.status === "pending"
                              ? "bg-amber-500/15 text-amber-600"
                              : "bg-destructive/15 text-destructive"
                          }`}
                        >
                          {r.status}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                            r.is_online ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {r.is_online ? "Online" : "Offline"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        📞 {r.phone ?? "No phone"} · 🛵 {r.vehicle || "Motorcycle"}
                      </p>
                      {r.aadhaar_number && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Aadhaar: ****{r.aadhaar_number.slice(-4)}
                        </p>
                      )}
                    </div>

                    {/* Quick Call / WhatsApp */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {cleanPhone && (
                        <>
                          <a
                            href={`tel:${cleanPhone}`}
                            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            <Phone className="h-3 w-3" /> Call
                          </a>
                          <a
                            href={`https://wa.me/91${cleanPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                          >
                            <MessageSquare className="h-3 w-3" /> WA
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Rider Controls & Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      {(r.aadhaar_number || r.aadhaar_image_url) && (
                        <button
                          onClick={() => setViewingKycRider(r)}
                          className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1.5 font-bold hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5" /> View KYC
                        </button>
                      )}
                      {r.status === "approved" && (
                        <button
                          disabled={busy === r.user_id}
                          onClick={() => setRiderOnline(r.user_id, !r.is_online)}
                          className={`rounded-lg px-2.5 py-1.5 font-bold transition-colors ${
                            r.is_online ? "bg-amber-500/10 text-amber-600" : "bg-success/10 text-success"
                          }`}
                        >
                          {r.is_online ? "Set Offline" : "Set Online"}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {r.status !== "approved" && (
                        <button
                          disabled={busy === r.user_id}
                          onClick={() => setRiderStatus(r.user_id, "approved")}
                          className="inline-flex items-center gap-1 rounded-lg bg-success px-3 py-1.5 font-bold text-white hover:opacity-90"
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </button>
                      )}
                      {r.status === "pending" && (
                        <button
                          disabled={busy === r.user_id}
                          onClick={() => setRiderStatus(r.user_id, "rejected")}
                          className="inline-flex items-center gap-1 rounded-lg bg-destructive px-3 py-1.5 font-bold text-white hover:opacity-90"
                        >
                          <X className="h-3.5 w-3.5" /> Reject
                        </button>
                      )}
                      {r.status === "approved" && (
                        <button
                          disabled={busy === r.user_id}
                          onClick={() => setRiderStatus(r.user_id, "suspended")}
                          className="inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-2.5 py-1.5 font-bold text-destructive hover:bg-destructive/20"
                        >
                          <Pause className="h-3.5 w-3.5" /> Suspend
                        </button>
                      )}
                      {(r.status === "suspended" || r.status === "rejected") && (
                        <button
                          disabled={busy === r.user_id}
                          onClick={() => setRiderStatus(r.user_id, "approved")}
                          className="inline-flex items-center gap-1 rounded-lg bg-success px-3 py-1.5 font-bold text-white hover:opacity-90"
                        >
                          <Play className="h-3.5 w-3.5" /> Reactivate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* CUSTOMERS TAB */}
        {/* ========================================================================= */}
        {tab === "customers" && (
          <div className="space-y-2">
            {customers.length === 0 && <Empty>No customers yet in this zone.</Empty>}
            {customers.map((c) => {
              const cleanPhone = cleanPhoneDigits(c.phone);

              return (
                <div key={c.user_id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{c.full_name ?? "Customer"}</p>
                    <p className="text-xs text-muted-foreground">{c.phone ?? "No phone"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs">
                      <p className="font-extrabold text-foreground">{c.orders_count} orders</p>
                      <p className="font-bold text-primary">{inr(Number(c.total_spent ?? 0))}</p>
                    </div>
                    {cleanPhone && (
                      <a
                        href={`tel:${cleanPhone}`}
                        className="rounded-full bg-secondary p-2 hover:bg-primary/10 hover:text-primary transition-colors"
                        title="Call Customer"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* ZONE MAP TAB */}
        {/* ========================================================================= */}
        {tab === "map" && (
          <section className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-foreground">{currentZone?.name} Boundary Editor</p>
                <p className="text-xs text-muted-foreground">
                  Click on the map to place boundary vertices · {points.length} boundary point{points.length === 1 ? "" : "s"}.
                </p>
              </div>
              <div className="flex gap-2">
                {points.length > 0 && (
                  <button onClick={() => setPoints([])} className="h-9 rounded-xl bg-secondary px-3 text-xs font-semibold">
                    Clear
                  </button>
                )}
                <button
                  onClick={saveBoundary}
                  disabled={savingMap}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground shadow-sm"
                >
                  {savingMap && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save Boundary
                </button>
              </div>
            </div>
            <div className="mt-3">
              <ClientOnly fallback={<div className="h-[380px] w-full animate-pulse rounded-2xl border bg-secondary/40" />}>
                <Suspense fallback={<div className="h-[380px] w-full animate-pulse rounded-2xl border bg-secondary/40" />}>
                  <ZoneMapEditor points={points} onChange={setPoints} center={points[0]} />
                </Suspense>
              </ClientOnly>
            </div>
          </section>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* 1. ADD RESTAURANT MODAL */}
      {showAddRestModal && (
        <Modal title="Onboard New Restaurant" onClose={() => setShowAddRestModal(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              handleAddRestaurant(Object.fromEntries(fd.entries()));
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs font-bold text-foreground">Restaurant Name *</label>
              <input
                required
                name="name"
                placeholder="e.g. Royal Biryani & Kebabs"
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground">Owner Contact Phone *</label>
              <input
                required
                name="phone"
                placeholder="e.g. 9876543210"
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground">Full Address *</label>
              <input
                required
                name="address"
                placeholder="e.g. Shop 12, Main Market Road"
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-foreground">Opening Time</label>
                <input
                  type="time"
                  name="opening_time"
                  defaultValue="09:00"
                  className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground">Closing Time</label>
                <input
                  type="time"
                  name="closing_time"
                  defaultValue="22:00"
                  className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-foreground">Delivery Charges (₹)</label>
                <input
                  type="number"
                  name="delivery_charges"
                  defaultValue={25}
                  className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground">Min Order Value (₹)</label>
                <input
                  type="number"
                  name="min_order_value"
                  defaultValue={0}
                  className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-foreground">Tagline (Optional)</label>
              <input
                name="tagline"
                placeholder="e.g. Authentic North Indian & Fast Food"
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy === "adding-rest"}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md hover:opacity-90 disabled:opacity-50"
            >
              {busy === "adding-rest" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Onboard Restaurant"}
            </button>
          </form>
        </Modal>
      )}

      {/* 2. EDIT RESTAURANT MODAL */}
      {editingRest && (
        <Modal title={`Edit ${editingRest.name}`} onClose={() => setEditingRest(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              handleSaveEditRestaurant(Object.fromEntries(fd.entries()));
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs font-bold text-foreground">Restaurant Name</label>
              <input
                required
                name="name"
                defaultValue={editingRest.name}
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground">Owner Contact Phone</label>
              <input
                required
                name="phone"
                defaultValue={editingRest.phone ?? ""}
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground">Address</label>
              <input
                required
                name="address"
                defaultValue={editingRest.address ?? ""}
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-foreground">Opening Time</label>
                <input
                  type="time"
                  name="opening_time"
                  defaultValue={editingRest.opening_time ? editingRest.opening_time.slice(0, 5) : "09:00"}
                  className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground">Closing Time</label>
                <input
                  type="time"
                  name="closing_time"
                  defaultValue={editingRest.closing_time ? editingRest.closing_time.slice(0, 5) : "22:00"}
                  className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-foreground">Delivery Charges (₹)</label>
                <input
                  type="number"
                  name="delivery_charges"
                  defaultValue={editingRest.delivery_charges ?? 25}
                  className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground">Min Order Value (₹)</label>
                <input
                  type="number"
                  name="min_order_value"
                  defaultValue={editingRest.min_order_value ?? 0}
                  className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-foreground">Tagline</label>
              <input
                name="tagline"
                defaultValue={editingRest.tagline ?? ""}
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy === "saving-edit-rest"}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md hover:opacity-90 disabled:opacity-50"
            >
              {busy === "saving-edit-rest" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </button>
          </form>
        </Modal>
      )}

      {/* 3. RESTAURANT MENU ITEMS MODAL */}
      {menuRest && (
        <Modal title={`${menuRest.name} — Menu Items`} onClose={() => setMenuRest(null)}>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Toggle availability to mark items In Stock or Out of Stock for customers ordering in your zone.
            </p>
            {loadingMenu ? (
              <div className="py-10 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                <p className="mt-2 text-xs text-muted-foreground">Loading menu items…</p>
              </div>
            ) : menuItems.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No menu items added by this restaurant yet.</p>
            ) : (
              <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {menuItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-xl border bg-background p-3 shadow-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${item.is_veg ? "bg-emerald-600" : "bg-red-600"}`} />
                        <p className="truncate text-xs font-bold text-foreground">{item.name}</p>
                      </div>
                      <p className="text-xs font-extrabold text-primary mt-0.5">₹{item.price}</p>
                    </div>
                    <button
                      onClick={() => toggleMenuItemStock(item.id, item.is_available)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                        item.is_available
                          ? "bg-success/15 text-success hover:bg-destructive/15 hover:text-destructive"
                          : "bg-amber-500/15 text-amber-600 hover:bg-success/15 hover:text-success"
                      }`}
                    >
                      {item.is_available ? "In Stock" : "Out of Stock"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* 4. ADD RIDER MODAL */}
      {showAddRiderModal && (
        <Modal title="Enroll & Approve New Rider" onClose={() => setShowAddRiderModal(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              handleAddRider(Object.fromEntries(fd.entries()));
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs font-bold text-foreground">Rider Full Name *</label>
              <input
                required
                name="full_name"
                placeholder="e.g. Ramesh Kumar"
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground">Phone Number *</label>
              <input
                required
                name="phone"
                placeholder="e.g. 9876543210"
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground">Vehicle Type</label>
              <select name="vehicle" defaultValue="Motorcycle" className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none">
                <option value="Motorcycle">Motorcycle / Bike</option>
                <option value="Scooter">Scooter / Activa</option>
                <option value="Bicycle">Bicycle</option>
                <option value="Electric Bike">Electric Bike</option>
              </select>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The rider will be assigned to this zone ({currentZone?.name}) and automatically approved to receive delivery offers.
            </p>
            <button
              type="submit"
              disabled={busy === "adding-rider"}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md hover:opacity-90 disabled:opacity-50"
            >
              {busy === "adding-rider" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enroll & Approve Rider"}
            </button>
          </form>
        </Modal>
      )}

      {/* 5. RIDER KYC MODAL */}
      {viewingKycRider && (
        <Modal title={`KYC Verification — ${viewingKycRider.full_name}`} onClose={() => setViewingKycRider(null)}>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase">Aadhaar Number</p>
              <p className="text-base font-extrabold text-foreground mt-0.5">
                {viewingKycRider.aadhaar_number || "Not provided"}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase">Aadhaar Document Photo</p>
              {viewingKycRider.aadhaar_image_url ? (
                <div className="mt-2 overflow-hidden rounded-xl border bg-secondary/30 p-2 text-center">
                  <img
                    src={viewingKycRider.aadhaar_image_url}
                    alt="Aadhaar"
                    className="max-h-64 mx-auto rounded-lg object-contain shadow-xs"
                  />
                  <a
                    href={viewingKycRider.aadhaar_image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs font-bold text-primary underline"
                  >
                    Open Full Image in New Tab
                  </a>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic mt-1">No Aadhaar photo uploaded.</p>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* 6. CANCEL ORDER MODAL */}
      {cancellingOrder && (
        <Modal title={`Cancel Order #${cancellingOrder.id.slice(0, 8).toUpperCase()}`} onClose={() => setCancellingOrder(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              updateOrderStatus(cancellingOrder.id, "cancelled", fd.get("reason") as string);
            }}
            className="space-y-3"
          >
            <p className="text-xs text-muted-foreground">
              Are you sure you want to cancel this order? Enter a brief reason below:
            </p>
            <input
              required
              name="reason"
              placeholder="e.g. Restaurant closed, Customer unreachable, Item out of stock"
              className="h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancellingOrder(null)}
                className="h-10 flex-1 rounded-xl bg-secondary text-xs font-bold"
              >
                Go Back
              </button>
              <button
                type="submit"
                disabled={busy === cancellingOrder.id}
                className="h-10 flex-1 rounded-xl bg-destructive text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                Confirm Cancellation
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 7. ORDER DETAILS MODAL */}
      {selectedOrder && (
        <Modal
          title={`Order #${selectedOrder.id.slice(0, 8).toUpperCase()}`}
          onClose={() => setSelectedOrder(null)}
        >
          <div className="max-h-[75vh] overflow-y-auto pr-1 space-y-3.5 text-xs">
            {/* Status & Timing Banner */}
            <div className="flex items-center justify-between rounded-xl bg-secondary/60 p-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Order Status</p>
                <span
                  className={`mt-0.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-black capitalize ${
                    selectedOrder.status === "delivered"
                      ? "bg-success/20 text-success"
                      : selectedOrder.status === "cancelled" || selectedOrder.status === "rejected"
                      ? "bg-destructive/20 text-destructive"
                      : "bg-amber-500/20 text-amber-700"
                  }`}
                >
                  {selectedOrder.status.replace(/_/g, " ")}
                </span>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Order Time</p>
                <p className="font-semibold text-foreground">
                  {new Date(selectedOrder.created_at).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            </div>

            {/* Restaurant Info */}
            <div className="rounded-xl border bg-background p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
                  <Store className="h-4 w-4 text-primary" />
                  <span>{selectedOrder.restaurant_name ?? "Kitchen"}</span>
                </div>
                {(() => {
                  const restObj = restaurants.find(
                    (r) => r.id === selectedOrder.restaurant_id || r.name === selectedOrder.restaurant_name
                  );
                  const restPhone = cleanPhoneDigits(restObj?.phone);
                  if (!restPhone) return null;
                  return (
                    <div className="flex items-center gap-1">
                      <a
                        href={`tel:${restPhone}`}
                        className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        <Phone className="h-3 w-3" /> Call Kitchen
                      </a>
                      <a
                        href={`https://wa.me/91${restPhone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                      >
                        <MessageSquare className="h-3 w-3" /> WA
                      </a>
                    </div>
                  );
                })()}
              </div>
              {(() => {
                const restObj = restaurants.find(
                  (r) => r.id === selectedOrder.restaurant_id || r.name === selectedOrder.restaurant_name
                );
                return restObj?.address ? (
                  <p className="text-[11px] text-muted-foreground">📍 {restObj.address}</p>
                ) : null;
              })()}
            </div>

            {/* Customer & Delivery Address */}
            <div className="rounded-xl border bg-background p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
                  <Users className="h-4 w-4 text-primary" />
                  <span>{selectedOrder.customer_name || "Customer"}</span>
                </div>
                {(() => {
                  const custPhone = cleanPhoneDigits(selectedOrder.customer_phone);
                  if (!custPhone) return null;
                  return (
                    <div className="flex items-center gap-1">
                      <a
                        href={`tel:${custPhone}`}
                        className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        <Phone className="h-3 w-3" /> Call
                      </a>
                      <a
                        href={`https://wa.me/91${custPhone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                      >
                        <MessageSquare className="h-3 w-3" /> WhatsApp
                      </a>
                    </div>
                  );
                })()}
              </div>
              <div className="space-y-0.5 text-[11px] text-muted-foreground">
                <p>📞 {selectedOrder.customer_phone || "No phone provided"}</p>
                <p>📍 {selectedOrder.address}</p>
                {selectedOrder.landmark && (
                  <p className="font-semibold text-foreground">Landmark: {selectedOrder.landmark}</p>
                )}
              </div>
            </div>

            {/* Items List */}
            <div className="rounded-xl border bg-background p-3 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
                <Utensils className="h-4 w-4 text-primary" />
                <span>Order Items</span>
              </div>
              {selectedOrder.items && selectedOrder.items.length > 0 ? (
                <div className="divide-y divide-border/60">
                  {selectedOrder.items.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1.5">
                      <div>
                        <p className="font-bold text-foreground">
                          {it.qty} × {it.name}
                        </p>
                        {it.variant && (
                          <p className="text-[10px] text-muted-foreground">{it.variant}</p>
                        )}
                      </div>
                      <p className="font-extrabold text-foreground">₹{Number(it.price * it.qty).toFixed(0)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-2 text-center text-muted-foreground italic">No item details recorded</p>
              )}
            </div>

            {/* Price Breakdown */}
            <div className="rounded-xl border bg-background p-3 space-y-1.5">
              <p className="mb-1 font-bold text-sm text-foreground">Bill Summary</p>
              <div className="flex justify-between text-muted-foreground">
                <span>Items Subtotal</span>
                <span>₹{Number(selectedOrder.subtotal || 0).toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery Fee</span>
                <span>₹{Number(selectedOrder.delivery_fee || 0).toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Platform Fee</span>
                <span>₹{Number(selectedOrder.platform_fee || 0).toFixed(0)}</span>
              </div>
              {Number(selectedOrder.discount || 0) > 0 && (
                <div className="flex justify-between font-semibold text-emerald-600">
                  <span>Discount</span>
                  <span>-₹{Number(selectedOrder.discount).toFixed(0)}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between border-t pt-1.5 font-black text-sm text-foreground">
                <span>Grand Total</span>
                <span className="text-base text-primary">₹{Number(selectedOrder.total || 0).toFixed(0)}</span>
              </div>
            </div>

            {/* Rider Management */}
            <div className="rounded-xl border bg-background p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
                  <Bike className="h-4 w-4 text-primary" />
                  <span>Delivery Rider</span>
                </div>
                {selectedOrder.rider_id && (() => {
                  const riderObj = riders.find((r) => r.user_id === selectedOrder.rider_id);
                  const riderPhone = cleanPhoneDigits(riderObj?.phone);
                  if (!riderPhone) return null;
                  return (
                    <a
                      href={`tel:${riderPhone}`}
                      className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      <Phone className="h-3 w-3" /> Call Rider
                    </a>
                  );
                })()}
              </div>

              {selectedOrder.rider_id ? (
                <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-2.5">
                  <div>
                    <p className="font-bold text-foreground">{selectedOrder.rider_name ?? "Assigned Rider"}</p>
                    {(() => {
                      const riderObj = riders.find((r) => r.user_id === selectedOrder.rider_id);
                      return riderObj?.phone ? <p className="text-[11px] text-muted-foreground">{riderObj.phone}</p> : null;
                    })()}
                  </div>
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
                    Assigned
                  </span>
                </div>
              ) : (
                <p className="rounded-lg bg-amber-500/10 p-2 text-[11px] font-medium text-amber-700">
                  ⚠️ No rider assigned yet. Choose an active rider below:
                </p>
              )}

              {/* Rider Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">
                  {selectedOrder.rider_id ? "Reassign Rider" : "Assign Rider"}
                </label>
                <div className="flex items-center gap-2">
                  <select
                    defaultValue=""
                    disabled={busy === selectedOrder.id}
                    onChange={(e) => {
                      if (e.target.value) {
                        assign(selectedOrder.id, e.target.value);
                      }
                    }}
                    className="h-9 flex-1 rounded-xl border bg-card px-2.5 text-xs font-semibold"
                  >
                    <option value="">Choose a rider…</option>
                    {activeRiders.map((r) => (
                      <option key={r.user_id} value={r.user_id}>
                        {r.full_name ?? r.user_id.slice(0, 8)}
                        {r.phone ? ` · ${r.phone}` : ""}
                        {r.is_online ? " [Online]" : " [Offline]"}
                      </option>
                    ))}
                  </select>
                  {busy === selectedOrder.id && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                </div>
              </div>
            </div>

            {/* Order Status Action Buttons */}
            <div className="space-y-2 border-t pt-3">
              <p className="font-bold text-[10px] uppercase text-muted-foreground">Update Order Lifecycle</p>
              <div className="grid grid-cols-2 gap-2">
                {selectedOrder.status === "placed" && (
                  <button
                    disabled={busy === selectedOrder.id}
                    onClick={() => updateOrderStatus(selectedOrder.id, "preparing")}
                    className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" /> Accept & Prepare
                  </button>
                )}
                {(selectedOrder.status === "preparing" || selectedOrder.status === "confirmed") && (
                  <button
                    disabled={busy === selectedOrder.id}
                    onClick={() => updateOrderStatus(selectedOrder.id, "ready")}
                    className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Mark Order Ready
                  </button>
                )}
                {selectedOrder.status === "ready" && (
                  <button
                    disabled={busy === selectedOrder.id}
                    onClick={() => updateOrderStatus(selectedOrder.id, "out_for_delivery")}
                    className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                  >
                    <Bike className="h-4 w-4" /> Dispatch / Out for Delivery
                  </button>
                )}
                {selectedOrder.status === "out_for_delivery" && (
                  <button
                    disabled={busy === selectedOrder.id}
                    onClick={() => updateOrderStatus(selectedOrder.id, "delivered")}
                    className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-success text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" /> Mark Delivered
                  </button>
                )}
                {selectedOrder.status !== "delivered" && selectedOrder.status !== "cancelled" && selectedOrder.status !== "rejected" && (
                  <button
                    type="button"
                    onClick={() => {
                      const ord = selectedOrder;
                      setSelectedOrder(null);
                      setCancellingOrder(ord);
                    }}
                    className="col-span-2 h-9 rounded-xl bg-destructive/10 text-xs font-bold text-destructive hover:bg-destructive/20 transition-colors"
                  >
                    Cancel Order
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Native Mobile Bottom Navigation Bar */}
      <nav
        id="kgt-zone-bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t bg-card/98 backdrop-blur shadow-[0_-2px_10px_rgba(0,0,0,0.06)] md:hidden"
        style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom, 6px))" }}
      >
        {([
          ["orders", "Orders", ClipboardList, orders.filter((o) => o.status === "placed" || o.status === "pending").length],
          ["restaurants", "Kitchens", Store, 0],
          ["riders", "Riders", Bike, riders.filter((r) => r.is_online).length],
          ["customers", "Customers", Users, 0],
          ["map", "Zone Map", MapPin, 0],
        ] as const).map(([key, label, Icon, badge]) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              id={`kgt-ztab-${key}`}
              onClick={() => {
                setTab(key as any);
                window.scrollTo({ top: 0, behavior: "instant" });
              }}
              style={{ touchAction: "manipulation" }}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="relative inline-flex items-center justify-center">
                <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : "stroke-2"}`} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-black text-destructive-foreground shadow">
                    {badge}
                  </span>
                )}
              </div>
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-3 shadow-xs">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      <p className="mt-1 text-lg font-black text-foreground truncate">{value}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border bg-card p-8 text-center text-xs text-muted-foreground">{children}</div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border bg-card p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b pb-3 sticky top-0 bg-card z-10">
          <h3 className="text-base font-extrabold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-full bg-secondary p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
