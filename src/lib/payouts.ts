// Shared payout math for KhanaGharTak
// Restaurant keeps 85% of food value (subtotal); KhanaGharTak collects 15% commission
// + platform fee + the delivery fee charged to the customer.
// Riders earn 70% of that KhanaGharTak earning.
// Invariant: restaurantPayout + platformEarning === order total.

export const COMMISSION_RATE = 0.15;
export const RIDER_SHARE_RATE = 0.7;

export type PayoutOrder = {
  subtotal?: number | string | null;
  platform_fee?: number | string | null;
  delivery_fee?: number | string | null;
  total?: number | string | null;
  payment_method?: string | null;
};


const n = (v: unknown) => Number(v ?? 0) || 0;

export function restaurantPayout(o: PayoutOrder) {
  return n(o.subtotal) * (1 - COMMISSION_RATE);
}

/** Gross KhanaGharTak earning (commission + platform fee + delivery fee). */
export function platformEarning(o: PayoutOrder) {
  return n(o.subtotal) * COMMISSION_RATE + n(o.platform_fee) + n(o.delivery_fee);
}

/** Rider's cut = 70% of the KhanaGharTak earning. */
export function riderEarning(o: PayoutOrder) {
  return platformEarning(o) * RIDER_SHARE_RATE;
}

/** What KhanaGharTak keeps after paying the rider. */
export function platformNetEarning(o: PayoutOrder) {
  return platformEarning(o) * (1 - RIDER_SHARE_RATE);
}

/** Cash the rider physically collects from the customer (COD orders only). */
export function cashCollected(o: PayoutOrder) {
  const method = (o.payment_method ?? "cod").toLowerCase();
  return method === "cod" ? n(o.total) : 0;
}

/** What the rider must deposit back to KhanaGharTak: cash collected minus his earning. */
export function riderDeposit(o: PayoutOrder) {
  return cashCollected(o) - riderEarning(o);
}

export function sumPayouts(orders: PayoutOrder[]) {
  return orders.reduce(
    (acc, o) => {
      acc.restaurant += restaurantPayout(o);
      acc.platformGross += platformEarning(o);
      acc.rider += riderEarning(o);
      acc.platformNet += platformNetEarning(o);
      acc.orderTotal += n(o.total);
      acc.cash += cashCollected(o);
      acc.deposit += riderDeposit(o);
      return acc;
    },
    { restaurant: 0, platformGross: 0, rider: 0, platformNet: 0, orderTotal: 0, cash: 0, deposit: 0 },
  );
}

export const inr = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;

