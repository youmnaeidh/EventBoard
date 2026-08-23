# EventBoard

**Event discovery · Behavioral analytics · Organizer reporting**

[Open the live project](https://youmnaeidh.github.io/EventBoard/) · [View my portfolio](https://youmnaeidh.github.io/portfolio/)

EventBoard is a responsive event-discovery website for local activities in Madinah. Visitors can search by interest, period, category, and price. Organizers can submit an event and preview a performance report that connects promotion decisions with audience behavior.

## Recruiter snapshot

- **Original project:** Taibah University graduation project, 2023.
- **My contribution:** Team leadership, concept, requirements, visual direction, and Arabic user experience.
- **Independent update:** Front-end reorganization, behavioral tracking, KPI reporting, recommendation logic, demand-gap analysis, documentation, and CSV export.
- **Tools:** HTML5, CSS3, JavaScript, browser storage, and CSV data.
- **Data scope:** Synthetic interaction data and locally recorded browser actions; no personal data is collected.

![EventBoard project](assets/eventboard-social-preview.png)

## Project background

The idea came from a real experience: I spent a long time searching for a pottery workshop in Madinah, then learned that a nearby studio had offered one—but it had ended the day before. That raised a practical question:

> How many local events begin and end without reaching the people who would actually be interested in them?

## Why I updated it

After graduation, I revisited the project to align it with my direction in data analytics, business intelligence, and digital transformation. I kept the original concept, visual identity, Madinah video, 2023 sample content, and Arabic-first experience, then added a measurable visitor and organizer journey.

## Main features

- Search by event name, location, or type
- Filters for category, event period, and price
- Interest-based browsing and personalized recommendations
- Event details, favorites, planning, and sharing
- Organizer submission form
- Browser-based interaction tracking
- Organizer KPIs and performance reporting
- Interaction funnel and weekly activity pattern
- Audience demand-gap analysis
- Business recommendations based on displayed indicators
- CSV report export
- Responsive mobile and desktop layout
- Reduced-motion support

## Data and analytics

The public experience records browser-based actions such as event views, favorites, plan additions, shares, searches, and selected interests. These actions update the recommendation logic and selected report values.

The organizer report combines local browser activity with synthetic baseline data to demonstrate KPI design, audience demand, and practical recommendations. It is available through the organizer journey on the **Sell your event** page.

The sample dataset is located at:

```text
data/synthetic_event_interactions.csv
```

Field definitions, KPI formulas, and data limitations are documented in [DATA_DICTIONARY.md](DATA_DICTIONARY.md).

## KPI definitions

| KPI | Formula |
|---|---|
| Total Views | Baseline Views + Recorded View Actions |
| Favorites | Baseline Favorites + Recorded Favorite Actions |
| Plan Additions | Baseline Plan Additions + Recorded Plan Actions |
| Shares | Baseline Shares + Recorded Share Actions |
| Interest Rate | Plan Additions / Total Views × 100 |
| Save Rate | Favorites / Total Views × 100 |
| Interest vs Target | Plan Additions / Target Attendance × 100 |
| Category Interest Rate | Category Plan Additions / Category Views × 100 |
| Demand Ratio | Search Volume / Available Events |

`Interest vs Target` represents expressed interest compared with the organizer's target; it does not represent confirmed attendance.

## Technology

- HTML5
- CSS3
- Vanilla JavaScript
- Local Storage and Session Storage
- Hash-based routing
- Responsive design
- CSV data

## Project structure

```text
EventBoard/
├── index.html
├── README.md
├── DATA_DICTIONARY.md
├── data/
│   └── synthetic_event_interactions.csv
├── assets/
├── css/
└── js/
```

## Limitations

- Event dates and content are sample data from the 2023 graduation project.
- Analytics seed values and the included CSV dataset are synthetic.
- Browser activity remains on the device.
- Form submissions and newsletter emails are stored locally.
- The current version is front-end only and has no external database, accounts, payment, or ticketing system.
- Recommendations are rule-based and are not presented as a machine-learning model.

## Author

**Yomna Alhejaili**  
Junior Data & Business Intelligence Analyst with a technical background in web development

- [Portfolio](https://youmnaeidh.github.io/portfolio/)
- [LinkedIn](https://www.linkedin.com/in/yomna-alhejaili-0b3991216)
- [GitHub](https://github.com/youmnaeidh)
