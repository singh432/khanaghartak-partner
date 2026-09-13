// Shared payout math for KhanaGharTak
// Restaurant keeps 85% of food value (subtotal); KhanaGharTak collects 15% commission
// + platform fee + the delivery fee charged to the customer.
// Discounts are deducted before actual KhanaGharTak earning is split:
// riders receive 60% and KhanaGharTak retains 40%.

export const COMMISSION_RATE = 0.15;
export const RIDER_SHARE_RATE = 0.6;

export type PayoutOrder = {
  subtotal?: number | string | null;
  platform_fee?: number | string | null;
  delivery_fee?: number | string | null;
  total?: number | string | null;
  discount?: number | string | null;
  payment_method?: string | null;
};

export type PayoutTotals = {
  restaurant: number;
  platformGross: number;
  discount: number;
  adjustment: number;
  platformActual: number;
  rider: number;
  platformNet: number;
  orderTotal: number;
  cash: number;
  deposit: number;
};


const n = (v: unknown) => Number(v ?? 0) || 0;

export function restaurantPayout(o: PayoutOrder) {
  return n(o.subtotal) * (1 - COMMISSION_RATE);
}

/** Gross KhanaGharTak earning (commission + platform fee + delivery fee). */
export function platformEarning(o: PayoutOrder) {
  return n(o.subtotal) * COMMISSION_RATE + n(o.platform_fee) + n(o.delivery_fee);
}

/** Customer discount recorded on the order. This is never platform revenue. */
export function customerDiscount(o: PayoutOrder) {
  return Math.max(0, n(o.discount));
}

/** Platform revenue available for the rider/KhanaGharTak split. */
export function actualPlatformEarning(o: PayoutOrder) {
  return platformEarning(o) - customerDiscount(o);
}

/** Rider's cut = 60% of actual platform revenue after discounts. */
export function riderEarning(o: PayoutOrder) {
  return actualPlatformEarning(o) * RIDER_SHARE_RATE;
}

/**
 * Full cash ledger for one order. `adjustment` exposes any variance between the
 * stored customer total and the expected subtotal + fees - discount identity.
 */
export function orderLedger(o: PayoutOrder) {
  const customerPayment = n(o.total);
  const restaurant = restaurantPayout(o);
  const platformGross = platformEarning(o);
  const discount = customerDiscount(o);
  const expectedCustomerPayment = n(o.subtotal) + n(o.platform_fee) + n(o.delivery_fee) - discount;
  const adjustment = customerPayment - expectedCustomerPayment;
  const platformActual = actualPlatformEarning(o);
  const rider = riderEarning(o);
  const platformNet = platformActual * (1 - RIDER_SHARE_RATE);

  return {
    customerPayment,
    restaurant,
    platformGross,
    discount,
    adjustment,
    platformActual,
    rider,
    platformNet,
  };
}

/** KhanaGharTak's 40% share of actual platform revenue after discounts. */
export function platformNetEarning(o: PayoutOrder) {
  return orderLedger(o).platformNet;
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
  return orders.reduce<PayoutTotals>(
    (acc, o) => {
      const ledger = orderLedger(o);
      acc.restaurant += ledger.restaurant;
      acc.platformGross += ledger.platformGross;
      acc.discount += ledger.discount;
      acc.adjustment += ledger.adjustment;
      acc.platformActual += ledger.platformActual;
      acc.rider += ledger.rider;
      acc.platformNet += ledger.platformNet;
      acc.orderTotal += ledger.customerPayment;
      acc.cash += cashCollected(o);
      acc.deposit += riderDeposit(o);
      return acc;
    },
    { restaurant: 0, platformGross: 0, discount: 0, adjustment: 0, platformActual: 0, rider: 0, platformNet: 0, orderTotal: 0, cash: 0, deposit: 0 },
  );
}

export const inr = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;

