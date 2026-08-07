# Story 2.6: Receipt gate completes sale in Local Database

Status: done

- Receipt confirmation stores an immutable completed timestamp, cash payment, UUID sale ID, and line-price snapshots.
- Cancelling leaves the local sale incomplete; confirmation clears the cart and shows the completion message.
