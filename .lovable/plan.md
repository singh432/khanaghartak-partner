# Correct the payout reconciliation scope

## Confirmed issue
The payout cards mix two different order groups: customer payments and restaurant payables use delivered orders, while gross revenue, discounts, rider cut, and KhanaGharTak net use all orders. This is why ₹3,000 paid and ₹2,155 payable are shown beside an unrelated ₹1,307 gross figure.

## Changes
- Make the payout reconciliation use delivered orders consistently from start to finish.
- Calculate the displayed gross platform amount from the same delivered-order ledger: customer payments minus restaurant payable.
- Show discounts as an explicit deduction, then split the remaining amount 60% to the rider and 40% to KhanaGharTak.
- Keep the separate all-orders platform-revenue headline/report, but do not mix it into the delivered-order payout breakdown.
- Apply the same scoped calculation and wording to the Revenue, Orders, Analytics, Rider, and Zone views where payout or settlement totals are shown.
- Ensure backend zone reports follow the same distinction between all-order revenue reporting and delivered-order settlement.

## Expected reconciliation
For the shown figures:
- Customer payments: ₹3,000
- Restaurant payable: ₹2,155
- Gross available amount: ₹845
- Discount deduction: ₹63
- Actual amount to split: ₹782
- Rider payout: about ₹469 (60%)
- KhanaGharTak net: about ₹313 (40%)

## Validation
- Confirm every payout section balances: customer payment − restaurant payable − discount = rider payout + KhanaGharTak net.
- Confirm dashboard totals equal the sum of their visible order rows for the selected period.
- Confirm all-orders revenue remains available separately and is clearly labelled.
- Check the affected screens on mobile and desktop.
