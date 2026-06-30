# Smartbar

A full-stack bar and restaurant management system built for real venues — multiple roles, real-time order tracking, and a kitchen/counter workflow that actually reflects how a busy bar runs day by day and  night to night.

SmartBar started as a way to fix the chaos of paper tickets and shouted orders across the floor. It's grown into a complete operations app: clients order from their table, waiters claim and deliver, kitchen and counter staff prep and dispatch, and managers get a live, numbers-driven view of everything happening in the house — including a proper daily reconciliation report so nobody has to guess what was sold, what's left in stock, and what the till should say at closing.

## Tech Stack

- **Frontend:** React Native (Expo, SDK 54)
- **Backend:** Node.js / Express
- **Database:** PostgreSQL (hosted on Neon)
- **Real-time:** Socket.io
- **Auth:** JWT, role-based access control
- **Deployment:** Render (backend), EAS (mobile builds)

## Roles & Dashboards

SmartBar runs on a single codebase with role-gated navigation. Everyone logs into the same app; what they see depends on who they are.

| Role | What they do |

| **Client** | Browses the menu, places orders from their table, tracks order status live, sends messages to Manager |
| **Waiter** | Claims incoming orders, delivers to tables, confirms with clients |
| **Kitchen** | Sees food-only tickets, marks dishes ready for dispatch |
| **Counter** | Sees drink-only tickets, marks drinks ready for dispatch |
| **Manager** | Full visibility — inventory, live sales, daily reconciliation, revenue trends |
| **Admin** | Same access as Manager plus account/role management |

## Core Features

### User management
- User sign up in the system depending to the user-role in order to access Dashboard
 
### Ordering & Real-Time Tracking
- Clients place orders directly from their table, with items automatically routed to Kitchen (food) or Counter (drinks) based on category.
- Every order is tracked through a clear lifecycle: `pending → preparing → ready → delivered → completed`.
- Socket.io pushes live updates to the client the moment a waiter claims their order, including the waiter's name and contact.
- Clients can send real-time messages straight to the Manager dashboard, with unread badge counts so nothing gets missed.

### Kitchen & Counter Dashboards
- Each dashboard only shows tickets relevant to it — Kitchen never sees drinks, Counter never sees food.
- Orders auto-refresh every few seconds so staff aren't stuck hitting refresh during a rush.
- One tap marks an item ready, instantly removing it from the queue and flagging it as sold on the Manager side.

### Manager Dashboard

**Overview** — daily revenue, total product count, and a weekly revenue trend chart at a glance.

**Inventory** — add new products with name, price, category, and photo (uploaded straight from the device camera roll), and manage the existing catalog.

**Sales** — a live, auto-updating view of everything sold so far today, split into Food and Drinks tables. The moment Kitchen or Counter marks an order ready, it lands here automatically — no manual entry. Each table shows quantity, unit price, and line total, with running totals per category and a grand total combining both.

**Reconciliation** — this is the heart of the daily accounting workflow. For every product, it tracks:

- **Opening Stock** — what you started the day with (auto-rolls over from yesterday's closing stock, or can be entered manually)
- **Purchase Stock** — anything restocked during the day, entered by the manager
- **Sales** — calculated automatically from confirmed orders (no manual counting)
- **Closing Stock** — calculated as `Opening + Purchases − Sales`
- **Total Price** — `Unit Price × Sales`

Food and Drinks get their own tables, each with category totals and a combined grand total. A date navigator lets the manager flip back through any previous day's report, and tomorrow's opening stock is set automatically from today's closing figure — so the count carries forward without anyone re-entering it by hand.

### Stock & Order Safety
- Orders use database transactions with row-level locking, so two people can't oversell the same item at the same time.
- Stock is checked and decremented atomically when an order is placed — if there isn't enough stock, the order is rejected before it ever reaches the kitchen.

## Project Structure

Smartbar_App-main/
├── smartbar-backend/
│   ├── controllers/      # Business logic (orders, products, inventory, auth)
│   ├── models/            # Database queries
│   ├── routes/             # API endpoints
│   ├── middleware/      # Auth & role-based access control
│   ├── services/           # Shared service logic
│   └── server.js
└── SmartbarApp/
    └── app/
        ├── (tabs)/
        │   ├── Manager.tsx
        │   ├── Kitchen.tsx
        │   ├── Counter.tsx
        │   ├── Waiter.tsx
        │   └── ...
        ├── Auth.tsx
        └── index.tsx


## Getting Started

### Backend

`bash
cd smartbar-backend
npm install
`

Create a `.env` file with your database connection string and JWT secret, then:
`bash
node server.js
`

### Frontend
`bash
cd SmartbarApp
npm install
npx expo start -c
`


## Roadmap
- Per-item readiness tracking (currently status is tracked at the order level)
- Exportable daily reconciliation reports (PDF/CSV)
- Staff performance analytics
- Multi-location support
