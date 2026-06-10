# Pull/Line

A browser collection game about Australian public transport vehicles.
Claim daily tickets, board mystery services, and complete the network guide —
**65 active vehicle classes across all 8 states and territories**, from the
Waratah and the HCMT down to the Westgate Punt and the once-a-week Gulflander,
each with a rare gold "limited livery" variant.

## How it hooks you

- **Pity system** — an epic or better is guaranteed within 10 pulls, a legendary within 30.
  Progress bars on the service board show exactly how close you are.
- **Express run** — pull 10 services for 9 tickets.
- **Limited liveries** — every pull has a 6% chance of arriving as a gold foil variant,
  doubling the collection to 22 entries.
- **Stamps** — duplicate pulls earn stamps. Trade 8 for a ticket at the Depot, or save up
  and charter a specific missing vehicle straight from the collection page.
- **Daily streak** — the daily delivery grows from +3 up to +7 tickets the longer your streak runs.
- **Ticket regeneration** — a free ticket arrives every 15 minutes (up to a bank of 10).
- **Daily commuter bonus** — board 3 services in a day for bonus tickets.
- **Conductor levels & achievements** — XP from every action, with 20 claimable achievement
  rewards in the Rewards Depot.

## Run

Open `index.html` directly, or run the included zero-dependency local server:

```powershell
npm run dev
```

Then visit `http://localhost:8000`.

Progress is stored in browser `localStorage` (existing saves carry over). Vehicle photographs
are loaded from Wikimedia Commons, and each vehicle detail panel links to its source article.
