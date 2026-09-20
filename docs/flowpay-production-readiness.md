# FlowPay production readiness checklist

This checklist covers the Evenum side of the FlowPay integration. The current
development environment does not have FlowPay production credentials,
production endpoints, operational dashboards, or live transaction access.

## Verified in Evenum

- [x] FlowPay credentials and the API base URL are read from server-only
      environment variables; they are never bundled into the client.
- [x] Sandbox and production selection is configuration-driven through
      `FLOWPAY_ENVIRONMENT`; environment-specific variables such as
      `FLOWPAY_PRODUCTION_API_BASE_URL` can be supplied independently, while
      the existing generic variables remain supported.
- [x] Every payment intent has a durable Evenum external reference and a
      durable idempotency key.
- [x] FlowPay initialization sends the same idempotency key on a retry.
- [x] Network, timeout, rate-limit, and provider 5xx failures can be retried;
      non-retryable provider errors are not retried.
- [x] Initialization has a bounded timeout and does not log credentials,
      customer payment details, or raw provider responses.
- [x] FlowPay webhook requests are verified against the exact raw request body
      using the server-only webhook secret.
- [x] Webhook deliveries are deduplicated by provider event ID before local
      payment state is changed.
- [x] Webhook status parsing accepts the supported nested and top-level
      transaction shapes used by the Evenum adapter.
- [x] Payment states do not move backward from `processing` to `pending`, and
      terminal `succeeded`/`failed` intents are not mutated by later events.
- [x] Webhook processing locks the payment intent and updates the payment
      intent plus linked financial transaction atomically.
- [x] Successful event, campaign, and election flows finalize their own
      business records after confirmed payment.
- [x] Failed event payments release the reserved ticket inventory.
- [x] The payment status endpoint exposes pending, processing, success, and
      failure outcomes for the asynchronous client polling flow.

## Monetary contexts covered by the Evenum implementation

| Context | Initiation | Confirmed-payment record | Reconciliation key |
| --- | --- | --- | --- |
| Ticket purchase | Event registration creates a paid intent and reserves inventory | Ticket issued after webhook confirmation | Evenum external reference, FlowPay transaction ID, financial transaction ID |
| Campaign collection | Campaign participation creates a paid intent | Campaign response confirmed and campaign total incremented | Same three identifiers |
| Paid voting | Election vote creates a paid intent | Vote and vote selections recorded after webhook confirmation | Same three identifiers |

For each context, verify the complete lifecycle:

`user starts payment → Evenum creates intent → FlowPay processes it → status
changes → webhook/status is received → Evenum finalizes the business record →
user sees the result → finance can reconcile the transaction`.

## Requires FlowPay confirmation

- [ ] Production API base URL and the exact initialization endpoint.
- [ ] Production credential values, scopes, rotation process, and account
      permissions.
- [ ] The production request header names and authentication contract.
- [ ] Supported production currencies, amount precision, and minimum/maximum
      transaction rules.
- [ ] The authoritative webhook event ID, event type, signature header, and
      signature encoding contract.
- [ ] The complete production webhook payload shape for pending, processing,
      success, failure, cancellation, and timeout events.
- [ ] Webhook retry policy, delivery timeout, ordering guarantees, and replay
      behavior.
- [ ] Whether provider-side idempotency is retained across network retries and
      how long its key is valid.
- [ ] Production reconciliation/export reports and the operational process for
      unmatched or manually reversed payments.
- [ ] A controlled live or provider-approved production verification
      transaction before enabling real funds.

## Blocked until production access is provided

- [ ] Live authentication against the production FlowPay account.
- [ ] A real end-to-end transaction for each implemented monetary context.
- [ ] Confirmation that the configured production webhook can reach the
      deployed Evenum endpoint.
- [ ] Provider-side reconciliation of a real transaction and a replayed
      webhook.

Sandbox success is not evidence that real funds are moving. The items above
must be completed with FlowPay engineering/operations before declaring the
integration production-verified.