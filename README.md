# EventBoard

EventBoard is a responsive event discovery website for local activities in Madinah. 
Visitors can search by interest, event period, category, and price. Organizers can submit an event and preview a performance report that connects promotion decisions with audience behavior.

## Project background

EventBoard started as my graduation project at Taibah University in 2023. I was the team leader and worked on the concept, requirements, visual direction, and Arabic user experience. The idea was also presented at Taibahthon.

The project came from a real experience. I spent a long time looking for a pottery workshop in Madinah, then found out through a friend that a nearby studio had offered exactly that workshop, but it had ended the day before. That raised a simple question: how many local events begin and end without reaching the people who would actually be interested in them?

## Why I updated it

After graduation, I revisited the project to align it with my current direction in data analytics, business intelligence, and digital transformation. I kept the original idea, visual identity, Madinah video, 2023 event content, and Arabic-first experience, then reorganized the front-end and added a measurable organizer journey.

The updated version adds:

- Browser-based interaction tracking
- Audience actions for views, favorites, plan additions, shares, and searches
- Rule-based personalized recommendations
- Organizer KPIs and performance reporting
- Interest and conversion analysis
- Audience demand-gap analysis
- Business recommendations based on displayed indicators
- CSV report export
- A synthetic interaction dataset and data dictionary
- Clear KPI definitions and limitations

## Main features

- Search by event name, location, or type
- Filters for category, event period, and price
- Early-season, mid-season, and limited-registration event groups
- Interest-based browsing
- Personalized event recommendations
- Event details, favorites, planning, and sharing
- Organizer submission form with attendance target and promotion options
- Interaction tracking in Local Storage
- Organizer performance and demand report
- Interaction funnel and weekly activity pattern
- Audience demand-gap analysis
- CSV report export
- Responsive mobile and desktop layout
- Reduced-motion support

## Data and analytics

The public experience records browser-based actions such as event views, favorites, additions to plan, shares, searches, and selected interests. These actions update the recommendation logic and selected report values.

The organizer report combines local browser activity with synthetic baseline data to demonstrate KPI design, audience demand, and practical recommendations. It is available through the organizer journey on the `Sell your event` page and is not included in the public navigation.

The sample dataset is available in:

```text
data/synthetic_event_interactions.csv
```

Field definitions and data limitations are documented in:

```text
DATA_DICTIONARY.md
```

## KPI formulas

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

`Interest vs Target` measures expressed interest compared with the organizer's target. It does not represent confirmed attendance.

## Tech stack

- HTML5
- CSS3
- Vanilla JavaScript
- Local Storage and Session Storage
- Hash-based routing
- Responsive Design
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
│   ├── variables.css
│   ├── base.css
│   ├── components.css
│   ├── pages.css
│   └── responsive.css
└── js/
    ├── data/
    │   ├── events.js
    │   ├── testimonials.js
    │   └── analytics.js
    ├── core/
    │   ├── storage.js
    │   ├── recommendations.js
    │   └── analytics.js
    ├── ui/
    ├── pages/
    └── app.js


## Project scope

- Event dates and content are sample data from the 2023 graduation project.
- Analytics seed values and the included CSV dataset are synthetic.
- Browser activity is stored locally and does not leave the device.
- Form submissions and newsletter emails are stored in the browser only.
- The current version is front-end only and has no external database, accounts, payment, or ticketing system.
- Recommendations are rule-based and are not presented as a machine-learning model.

## Author

**Yomna Alhejaili**  
Diploma in Full-Stack Web Development, Taibah University  
[LinkedIn](https://www.linkedin.com/in/yomna-alhejaili-0b3991216)
