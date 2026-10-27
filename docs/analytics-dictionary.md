# Analytics definitions

All per-event charts use one selected 7/14/30-calendar-day window in Asia/Riyadh, including
the current partial day. The comparison window immediately precedes it and has the same day count.

| Field | Definition |
| --- | --- |
| Views | View records; newly recorded views are deduplicated per event/session for 30 minutes. Legacy synthetic records remain unchanged. |
| Sessions | Distinct random session IDs with a view in the window. Not verified people. |
| Favorites | Currently active favorite rows created in the window; not lifetime favorite actions. |
| Shares | Share-button interactions in the window, not confirmed link deliveries. |
| Bookings / seats | Currently confirmed bookings created in the window / their seat sum. |
| Cancelled | Bookings created in the window whose current status is cancelled. Not cancellation-time activity. |
| Booking ratio | Confirmed booking count divided by view count; not a visitor conversion funnel. |
| Booking value | Sum of seats times stored unit price for confirmed bookings created in the window. Not collected revenue. |
| Unknown price | Real legacy bookings without captured unit price; excluded from value and counted explicitly. |
| Fill | Current confirmed seats over event capacity, for the entire event lifetime; independent of the chart period. |
| Sources | Source on view records in the same window. Synthetic sources have meta.synthetic=true and is_sample=true. |
| Demand sample | Up to 5,000 distinct identity/query/day records in the last 28 days. Old missing diagnostics are not treated as proven inventory gaps. |

Daily counts use the same underlying rows/definitions as summary counts. The interaction summary
does not assert that any person moved through stages in a particular order. Demonstration values are synthetic.
