# Customer Behavior Dashboard (Web Rebuild)

An interactive, self-contained recreation of the original Power BI
*Customer Behavior Dashboard* — built as a static web page that reads
`customer_data.csv` directly in the browser. **No Power BI account or license
required.** Deploys to Vercel (or any static host) with zero build step.

## What it shows

Mirrors the original report and `customer_queries.sql`:

- **KPIs:** Number of Customers, Average Purchase Amount, Average Review Rating
- **% of Customers by Subscription Status** (donut)
- **Revenue by Category** / **Sales by Category** (bar)
- **Revenue by Age Group** / **Sales by Age Group** (horizontal bar)
- **Slicers:** Subscription Status, Gender, Category, Shipping Type
  (click to filter — all charts + KPIs update live; empty = show all)

Age groups use the same bins as the SQL: Young Adult 18–30, Adult 31–45,
Middle Aged 46–60, Senior 61+.

## Tech

Plain HTML/CSS/JS. [Chart.js](https://www.chartjs.org/) for visuals and
[PapaParse](https://www.papaparse.com/) for CSV parsing, both via CDN.

## Run locally

The CSV is fetched over HTTP, so serve the folder (don't open `index.html` as a file):

```bash
cd customer-dashboard-web
python -m http.server 3000
# open http://localhost:3000
```

## Deploy to Vercel

**CLI:**
```bash
npm i -g vercel
cd customer-dashboard-web
vercel --prod
```

**Git:** push this folder to GitHub → vercel.com → Add New → Project → Import →
framework preset **Other** (no build) → Deploy.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page layout (KPIs, charts, slicers) |
| `styles.css` | Power BI-style theming |
| `app.js` | CSV load, aggregation, charts, slicer filtering |
| `customer_data.csv` | The dataset (3,900 rows) |
| `vercel.json` | Static hosting + security headers |
