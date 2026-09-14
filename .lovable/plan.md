# Delivered-only platform revenue

## Goal
Show platform revenue only for completed deliveries. Pending, accepted, preparing, ready, out-for-delivery, cancelled, and rejected orders must contribute zero revenue.

## Changes
- Filter platform revenue totals to `status = delivered` across the Super Admin overview, Revenue, Analytics, and Zone Manager screens.
- Update zone-level breakdowns and labels so they clearly describe delivered-order revenue.
- Update the backend zone report to apply the same delivered-only filter while preserving existing order-status counts.
- Keep the current discount-first formula for delivered orders: gross platform earning minus discount, then the existing rider/platform split.

## Technical details
- Keep the shared per-order formulas unchanged; scope the order collections before aggregating revenue.
- Add a forward database migration for the zone report rather than rewriting migration history.

## Validation
- Confirm a delivered order contributes platform revenue.
- Confirm pending, in-progress, cancelled, and rejected orders contribute no platform revenue.
- Verify totals and zone rows match their delivered orders on the affected screens.