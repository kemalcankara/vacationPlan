# Vacation Plan Agent Notes

When the user puts ticket, hotel, flight, reservation, or screenshot files under `data/` and asks to create/update the live plan:

1. Inspect every new source file in `data/`.
2. Extract dates, times, places, passenger counts, and useful non-sensitive notes.
3. Update `data/trip-events.js` with deterministic event ids.
4. Bump `window.LONDON_STARTER_EVENTS_VERSION`.
5. Do not commit raw tickets, screenshots, PDFs, phone numbers, email addresses, full booking references, ride ids, or exact private hotel reservation screenshots.
6. Keep public seed data masked and practical: times, areas, high-level hotel/location labels, and non-sensitive notes are fine.
7. Do not add `data/...` attachments for raw source files unless the user explicitly says the file is safe to publish.
8. Run:
   - `node --check app.js`
   - `node --check data/trip-events.js`
9. Commit and push to `origin/main`.

The app merges `data/trip-events.js` into local state and Firestore automatically, so pushed seed changes should appear on the live site after the static host deploys and the browser refreshes.
