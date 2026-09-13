# Reconciled payout ledger

## Goal
Make every delivered order balance from customer payment through restaurant payout, platform deductions, rider payout, and final KhanaGharTak net.

## Changes
- Replace the shortcut `net = 40% of gross earning` with an order-level reconciliation: customer payment minus restaurant payable minus rider payout.
- Keep gross platform revenue visible, but separately show customer discounts and any other reconciliation adjustment before reporting actual platform earning.
- Aggregate dashboard totals only from the same per-order ledger calculations, including historical delivered orders.
- Add a Super Admin order-level ledger table so each order exposes payment, restaurant payable, gross revenue, deductions, rider payout, and final net.
- Update Super Admin, Zone Manager, revenue, and analytics totals to use the reconciled net.
- Update the backend zone report to apply the same formula.

## Validation
- Verify the reported example balances as ₹890.25 gross revenue − ₹45 discounts − ₹534.15 rider payout = ₹311.10 final net.
- Test totals equal the sum of individual delivered-order ledger rows and confirm discounts never increase platform revenue.
