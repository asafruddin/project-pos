# Story 2.8: Sync outbox and AcceptCompleteSale updates stock

Status: done

- Completed local sales enqueue to a durable outbox and retry on completion or reconnect.
- `POST /sales/sync` is cashier-authorized, idempotent by sale ID, and atomically records the sale plus stock decrement.
- The pure domain function rejects malformed, missing, or insufficient-stock lines.
