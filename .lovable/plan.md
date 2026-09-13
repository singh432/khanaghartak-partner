# Discount-first revenue and payout correction

## Goal
Make every financial view use one rule: all orders contribute platform revenue, discounts are deducted before the 60% rider and 40% KhanaGharTak split.

## Changes
- Define shared order math as gross platform revenue = 15% commission + platform fee + delivery fee; actual KGT earning = gross platform revenue − discount; rider payout = 60% of actual earning; KGT net = 40% of actual earning.
- Aggregate Total Platform Revenue and matching analytics from every order in the selected period, without filtering to Delivered.
- Keep settlement-only amounts, such as restaurant payouts, rider cash collection, and completed-delivery counts, limited to delivered orders where appropriate.
- Update Super Admin dashboard, Revenue, Orders ledger, Analytics, Zone Manager, Rider payout wording/calculations, and any shared totals to use the same source formula.
- Update the zone reporting function so backend reports match the screens for current and historical orders.

## Technical details
- Centralize discount-first calculations in the shared payout module and reuse them everywhere.
- Preserve status counts and operational workflows; only financial aggregation and labels change.
- Keep existing access restrictions on financial reports.

## Validation
- Verify an order with ₹100 gross platform revenue and ₹10 discount yields ₹90 actual earning, ₹54 rider payout, and ₹36 KGT net.
- Verify Total Platform Revenue includes non-delivered orders and dashboard totals equal summed order rows.
- Run focused calculation tests and check the affected pages at desktop and mobile sizes.
