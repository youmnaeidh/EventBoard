# EventBoard Data Dictionary

## Dataset

`data/synthetic_event_interactions.csv` is a small synthetic dataset created to demonstrate how audience interactions could be structured for analysis. It does not contain real user data.

## Fields

| Field | Type | Description | Example |
|---|---|---|---|
| `interaction_id` | Text | Unique identifier for each interaction row | `I001` |
| `user_id` | Text | Anonymous synthetic user identifier | `U004` |
| `event_id` | Integer | Event identifier used by the website | `2` |
| `event_title` | Text | Event name | `تشكيل وإلهام` |
| `category` | Text | Event category | `فن` |
| `action` | Text | Type of audience interaction | `plan_add` |
| `interaction_date` | Date | Date of the synthetic interaction | `2023-08-10` |
| `district` | Text | Event district or area | `حي العريض` |
| `source` | Text | Website entry point that led to the interaction | `search` |

## Action values

| Value | Meaning |
|---|---|
| `view` | The event details were viewed |
| `favorite_add` | The event was added to favorites |
| `plan_add` | The event was added to the visitor's plan |
| `share` | The event link was shared |

## Source values

| Value | Meaning |
|---|---|
| `home` | The interaction started from the home page |
| `search` | The visitor used search |
| `interest_filter` | The visitor selected an interest or category |
| `recommendations` | The event appeared in personalized recommendations |
| `shared_link` | The visitor opened a shared event link |

## KPI definitions

| KPI | Formula | Interpretation |
|---|---|---|
| Total Views | Baseline views + recorded `view` actions | Estimated event exposure |
| Favorites | Baseline favorites + recorded `favorite_add` actions | Visitors who saved an event for later |
| Plan Additions | Baseline plan additions + recorded `plan_add` actions | Visitors who showed stronger intent |
| Shares | Baseline shares + recorded `share` actions | Event sharing activity |
| Interest Rate | Plan Additions / Total Views × 100 | Share of views that resulted in stronger interest |
| Save Rate | Favorites / Total Views × 100 | Share of views saved for later |
| Interest vs Target | Plan Additions / Target Attendance × 100 | Interest level compared with the organizer's target; it is not confirmed attendance |
| Category Interest Rate | Category Plan Additions / Category Views × 100 | Interest performance by event category |
| Demand Ratio | Search Volume / Available Events | Relative gap between audience demand and available supply |

## Notes

- All rows are synthetic and are included for portfolio demonstration only.
- The current website stores browser activity locally and does not collect personal data.
- `plan_add` represents interest, not a confirmed booking or attendance.
- A production version would use a database, unique sessions, validation rules, and a documented ETL process.
