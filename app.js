/* Customer Behavior Dashboard — rebuilt from customer_data.csv
   Aggregations mirror the original Power BI report + customer_queries.sql. */

const COL = {
  age: "Age",
  gender: "Gender",
  category: "Category",
  amount: "Purchase Amount (USD)",
  rating: "Review Rating",
  subscription: "Subscription Status",
  shipping: "Shipping Type",
};

// Age bins — taken straight from customer_queries.sql (Q10)
function ageGroup(age) {
  if (age >= 18 && age <= 30) return "Young Adult";
  if (age >= 31 && age <= 45) return "Adult";
  if (age >= 46 && age <= 60) return "Middle Aged";
  if (age >= 61) return "Senior";
  return "Unknown";
}

// Fixed slicer option lists (order as in the original report)
const SLICERS = {
  subscription: { col: COL.subscription, el: "slicer-subscription", values: ["No", "Yes"] },
  gender: { col: COL.gender, el: "slicer-gender", values: ["Female", "Male"] },
  category: { col: COL.category, el: "slicer-category", values: ["Accessories", "Clothing", "Footwear", "Outerwear"] },
  shipping: { col: COL.shipping, el: "slicer-shipping", values: ["2-Day Shipping", "Express", "Free Shipping", "Next Day Air", "Standard", "Store Pickup"] },
};

// active selections: empty Set => no filter (show all)
const selected = {
  subscription: new Set(),
  gender: new Set(),
  category: new Set(),
  shipping: new Set(),
};

let ALL_ROWS = [];
const charts = {};

const COLORS = {
  bar: "#1f3bb3",
  pink: "#d81f8c",
  blue: "#1f9bf0",
};

// ---------- helpers ----------
const sum = (arr, f) => arr.reduce((a, r) => a + (f(r) || 0), 0);
const fmtMoney = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function fmtCountK(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}
function fmtShort(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return String(Math.round(n));
}

// group rows -> {label: aggregatedValue}, returns sorted [ [label,val], ... ] desc
function groupBy(rows, keyFn, valFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (k === undefined || k === null || k === "") continue;
    m.set(k, (m.get(k) || 0) + (valFn ? (valFn(r) || 0) : 1));
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// ---------- filtering ----------
function applyFilters(rows) {
  return rows.filter((r) => {
    for (const key of Object.keys(selected)) {
      const set = selected[key];
      if (set.size === 0) continue;
      if (!set.has(String(r[SLICERS[key].col]))) return false;
    }
    return true;
  });
}

// ---------- chart factories ----------
function baseBarOptions(horizontal, valueFormatter) {
  // The "value axis" holds the numbers; the "category axis" holds the labels.
  // Chart.js passes the tick INDEX to the callback, so use getLabelForValue()
  // on the category axis to show the real label instead of 0,1,2,3.
  const valueTicks = { callback: (v) => fmtShort(v) };
  const labelTicks = {
    autoSkip: false,
    callback: function (v) { return this.getLabelForValue(v); },
  };
  return {
    indexAxis: horizontal ? "y" : "x",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (c) => valueFormatter(c.parsed[horizontal ? "x" : "y"]) },
      },
    },
    scales: {
      x: {
        grid: { display: !horizontal },
        ticks: horizontal ? valueTicks : labelTicks,
      },
      y: {
        grid: { display: horizontal },
        ticks: horizontal ? labelTicks : valueTicks,
      },
    },
  };
}

function makeBar(canvasId, horizontal, moneyAxis) {
  const fmt = moneyAxis ? fmtMoney : (v) => v.toLocaleString("en-US");
  return new Chart(document.getElementById(canvasId), {
    type: "bar",
    data: { labels: [], datasets: [{ data: [], backgroundColor: COLORS.bar, borderRadius: 4, maxBarThickness: 46 }] },
    options: baseBarOptions(horizontal, fmt),
  });
}

function makeDonut(canvasId) {
  return new Chart(document.getElementById(canvasId), {
    type: "doughnut",
    data: { labels: [], datasets: [{ data: [], backgroundColor: [COLORS.pink, COLORS.blue], borderWidth: 2, borderColor: "#fff" }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "60%",
      plugins: {
        legend: { position: "right", labels: { boxWidth: 14, font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: (c) => {
              const total = c.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total ? Math.round((c.parsed / total) * 100) : 0;
              return `${c.label}: ${c.parsed.toLocaleString()} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

// ---------- render ----------
function render() {
  const rows = applyFilters(ALL_ROWS);

  // KPIs
  document.getElementById("kpi-customers").textContent = fmtCountK(rows.length);
  const avgAmount = rows.length ? sum(rows, (r) => r[COL.amount]) / rows.length : 0;
  document.getElementById("kpi-avg-amount").textContent = rows.length ? fmtMoney(avgAmount) : "—";
  const rated = rows.filter((r) => typeof r[COL.rating] === "number" && !isNaN(r[COL.rating]));
  const avgRating = rated.length ? sum(rated, (r) => r[COL.rating]) / rated.length : 0;
  document.getElementById("kpi-avg-rating").textContent = rated.length ? avgRating.toFixed(2) : "—";

  // Subscription donut (Yes/No)
  const sub = groupBy(rows, (r) => r[COL.subscription], null);
  // keep stable order Yes, No for color consistency
  const subMap = new Map(sub);
  setChart(charts.subscription, ["Yes", "No"], [subMap.get("Yes") || 0, subMap.get("No") || 0]);

  // Revenue by category
  const revCat = groupBy(rows, (r) => r[COL.category], (r) => r[COL.amount]);
  setChart(charts.revCategory, revCat.map((d) => d[0]), revCat.map((d) => Math.round(d[1])));

  // Sales (count) by category
  const salesCat = groupBy(rows, (r) => r[COL.category], null);
  setChart(charts.salesCategory, salesCat.map((d) => d[0]), salesCat.map((d) => d[1]));

  // Revenue by age group
  const revAge = groupBy(rows, (r) => ageGroup(r[COL.age]), (r) => r[COL.amount]);
  setChart(charts.revAge, revAge.map((d) => d[0]), revAge.map((d) => Math.round(d[1])));

  // Sales by age group
  const salesAge = groupBy(rows, (r) => ageGroup(r[COL.age]), null);
  setChart(charts.salesAge, salesAge.map((d) => d[0]), salesAge.map((d) => d[1]));
}

function setChart(chart, labels, data) {
  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
  chart.update();
}

// ---------- slicer UI ----------
function buildSlicers() {
  for (const key of Object.keys(SLICERS)) {
    const cfg = SLICERS[key];
    const container = document.getElementById(cfg.el);
    container.innerHTML = "";
    for (const val of cfg.values) {
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.textContent = val;
      chip.addEventListener("click", () => {
        if (selected[key].has(val)) selected[key].delete(val);
        else selected[key].add(val);
        chip.classList.toggle("active");
        render();
      });
      container.appendChild(chip);
    }
  }
  document.getElementById("reset").addEventListener("click", () => {
    for (const key of Object.keys(selected)) selected[key].clear();
    document.querySelectorAll(".chip.active").forEach((c) => c.classList.remove("active"));
    render();
  });
}

// ---------- init ----------
Papa.parse("customer_data.csv", {
  download: true,
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true,
  complete: (res) => {
    ALL_ROWS = res.data.filter((r) => r[COL.category]); // drop any blank trailing rows
    charts.subscription = makeDonut("chart-subscription");
    charts.revCategory = makeBar("chart-revenue-category", false, true);
    charts.salesCategory = makeBar("chart-sales-category", false, false);
    charts.revAge = makeBar("chart-revenue-age", true, true);
    charts.salesAge = makeBar("chart-sales-age", true, false);
    buildSlicers();
    render();
    document.getElementById("loading").hidden = true;
    document.getElementById("app").hidden = false;
  },
  error: (err) => {
    document.getElementById("loading").textContent =
      "Failed to load customer_data.csv — make sure the page is served over http (not opened as a file). " + err;
  },
});
