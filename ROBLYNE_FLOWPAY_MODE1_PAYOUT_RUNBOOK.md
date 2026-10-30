# ROBLYNE FlowPay Mode 1 Payout Runbook

## What changed

ROBLYNE payouts now use a FlowPay saved recipient (destination profile), not a free-text account field on every request.

1. An organization owner saves a recipient in ROBLYNE.
2. ROBLYNE sends the target to FlowPay and stores only FlowPay's recipient ID plus a masked target.
3. The recipient must be verified by FlowPay before it can be selected.
4. A withdrawal reserves the exact internal earnings allocation and queues a Mode 1 FlowPay payout with an idempotency key.
5. The ROBLYNE worker polls FlowPay. Only a `success` response completes the settlement and marks its ledger allocations settled.

Administrators cannot manually mark a FlowPay-managed settlement as completed.

## Required FlowPay application settings

For the ROBLYNE FlowPay application, confirm all of the following in Flow Admin before exposing withdrawals:

- Application status is `ACTIVE`.
- `PAYOUT` capability is enabled.
- Recipient/destination-profile provisioning is enabled.
- Recipient profile limit is a positive number suitable for your expected organizations.
- The configured production provider has both collection and payout/disbursement access.
- The application uses Mode 1 / platform-revenue collection, so FlowPay has a settled balance from which it can execute revenue payouts.
- The FlowPay confirmation gateway URL is public and uses HTTPS; new recipients can complete the confirmation page.

No ROBLYNE secret is placed in the static frontend. The API and worker both use the same server-side `FLOWPAY_*` credentials: the worker creates and polls provider payouts directly through the shared adapter. The worker therefore requires `DATABASE_URL`, `REDIS_URL`, and the production `FLOWPAY_*` values. It deliberately refuses to start in production if those payment credentials are missing or invalid.

## Release sequence

1. Deploy the API and worker with the same release.
2. Run database migrations (`pnpm run migrate`) before accepting payouts.
3. Confirm `/api/readyz` reports Redis and the worker healthy.
4. Save a controlled test recipient, complete FlowPay verification, and refresh it in ROBLYNE.
5. Request a low-value payout using that verified recipient.
6. Confirm the settlement remains pending/processing until FlowPay reports success, then becomes completed automatically.
7. Confirm a failed FlowPay payout remains uncompleted and its reserved balance is not silently made spendable again.

## Operational handling

- A pending or processing payout is polled by the worker for up to 20 cycles.
- A FlowPay failure is recorded on the settlement; it is not automatically re-submitted to avoid duplicate transfers.
- Do not alter a recipient's target by editing database data. Create and verify a new recipient instead.
- Treat `providerPayoutStatus=failed` as an operations case: resolve the FlowPay/provider issue first, then implement a controlled retry from a future audited operator action.
