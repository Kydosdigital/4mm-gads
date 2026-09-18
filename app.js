(function () {
  "use strict";
  var DATA = window.GADS_DATA;
  var GOOGLE_COLORS = ["#4285F4", "#EA4335", "#FBBC04", "#34A853", "#1A73E8", "#A142F4", "#24C1E0", "#F29900", "#009688", "#9AA0A6"];

  // ---------- formatters ----------
  function fmtGBP(n) {
    return "£" + Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtGBP0(n) {
    return "£" + Number(n).toLocaleString("en-GB", { maximumFractionDigits: 0 });
  }
  function fmtInt(n) {
    return Number(n).toLocaleString("en-GB");
  }
  function fmtPct(n) {
    return (Number(n) * 100).toFixed(2) + "%";
  }
  function fmtWeek(w) {
    if (w === "--") return w;
    var d = new Date(w);
    if (isNaN(d)) return w;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  }

  // ---------- tab switching ----------
  document.querySelectorAll(".nav-item").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".nav-item").forEach(function (b) { b.classList.remove("active"); });
      document.querySelectorAll(".tab-panel").forEach(function (p) { p.classList.remove("active"); });
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
  });

  // ---------- KPI cards ----------
  function buildKpis() {
    var weekly = DATA.weekly;
    var half = Math.floor(weekly.length / 2);
    var prev = weekly.slice(0, half);
    var curr = weekly.slice(half);

    function sum(arr, key) { return arr.reduce(function (a, r) { return a + (r[key] || 0); }, 0); }

    function agg(arr) {
      var cost = sum(arr, "cost"), clicks = sum(arr, "clicks"), impr = sum(arr, "impr"), conv = sum(arr, "conversions");
      return {
        cost: cost, clicks: clicks, impr: impr, conversions: conv,
        ctr: impr ? clicks / impr : 0,
        avg_cpc: clicks ? cost / clicks : 0,
        conv_rate: clicks ? conv / clicks : 0,
        cost_per_conv: conv ? cost / conv : 0
      };
    }
    var a = DATA.account_totals;
    var p = agg(prev), c = agg(curr);

    function delta(curVal, prevVal, higherIsBetter) {
      if (!prevVal) return null;
      var pct = ((curVal - prevVal) / prevVal) * 100;
      var up = pct >= 0;
      var good = higherIsBetter ? up : !up;
      return { pct: pct, up: up, good: good };
    }

    var cards = [
      { label: "Cost", value: fmtGBP(a.cost), d: delta(c.cost, p.cost, true) },
      { label: "Clicks", value: fmtInt(a.clicks), d: delta(c.clicks, p.clicks, true) },
      { label: "Impr.", value: fmtInt(a.impr), d: delta(c.impr, p.impr, true) },
      { label: "CTR", value: fmtPct(a.ctr), d: delta(c.ctr, p.ctr, true) },
      { label: "Avg. CPC", value: fmtGBP(a.avg_cpc), d: delta(c.avg_cpc, p.avg_cpc, false) },
      { label: "Conversions", value: fmtInt(Math.round(a.conversions)), d: delta(c.conversions, p.conversions, true) },
      { label: "Cost / conv.", value: fmtGBP(a.cost_per_conv), d: delta(c.cost_per_conv, p.cost_per_conv, false) },
      { label: "Conv. rate", value: fmtPct(a.conv_rate), d: delta(c.conv_rate, p.conv_rate, true) }
    ];

    var row = document.getElementById("kpi-row");
    row.innerHTML = cards.map(function (k) {
      var deltaHtml = "";
      if (k.d) {
        var cls = k.d.good ? "up" : "down";
        var arrow = k.d.up ? "▲" : "▼";
        deltaHtml = '<div class="kpi-delta ' + cls + '"><span class="arrow">' + arrow + '</span>' +
          Math.abs(k.d.pct).toFixed(1) + '% <span class="kpi-sub">vs prior period</span></div>';
      }
      return '<div class="kpi-card"><div class="kpi-label">' + k.label + '</div>' +
        '<div class="kpi-value">' + k.value + '</div>' + deltaHtml + '</div>';
    }).join("");
  }

  // ---------- charts ----------
  function buildCharts() {
    var weekly = DATA.weekly;
    var labels = weekly.map(function (w) { return fmtWeek(w.week); });

    new Chart(document.getElementById("chart-cost-conv"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Cost (£)",
            data: weekly.map(function (w) { return w.cost; }),
            backgroundColor: "#c8dafc",
            borderRadius: 3,
            yAxisID: "y",
            order: 2
          },
          {
            label: "Conversions",
            data: weekly.map(function (w) { return w.conversions; }),
            type: "line",
            borderColor: "#1a73e8",
            backgroundColor: "#1a73e8",
            pointRadius: 3,
            tension: 0.3,
            yAxisID: "y1",
            order: 1
          }
        ]
      },
      options: chartOpts({ y: { position: "left", title: "Cost (£)" }, y1: { position: "right", title: "Conversions" } })
    });

    new Chart(document.getElementById("chart-clicks-impr"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Impr.",
            data: weekly.map(function (w) { return w.impr; }),
            backgroundColor: "#fde7c8",
            borderRadius: 3,
            yAxisID: "y",
            order: 2
          },
          {
            label: "Clicks",
            data: weekly.map(function (w) { return w.clicks; }),
            type: "line",
            borderColor: "#188038",
            backgroundColor: "#188038",
            pointRadius: 3,
            tension: 0.3,
            yAxisID: "y1",
            order: 1
          }
        ]
      },
      options: chartOpts({ y: { position: "left", title: "Impr." }, y1: { position: "right", title: "Clicks" } })
    });

    buildCpaVsTargetChart();

    var camps = DATA.campaigns;
    new Chart(document.getElementById("chart-cost-share"), {
      type: "doughnut",
      data: {
        labels: camps.map(function (c) { return c.campaign; }),
        datasets: [{
          data: camps.map(function (c) { return c.cost; }),
          backgroundColor: GOOGLE_COLORS,
          borderWidth: 2,
          borderColor: "#fff"
        }]
      },
      options: {
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 }, color: "#3c4043" } },
          tooltip: {
            callbacks: {
              label: function (ctx) { return " " + ctx.label + ": " + fmtGBP(ctx.parsed); }
            }
          }
        },
        maintainAspectRatio: false
      }
    });
  }

  function buildCpaVsTargetChart() {
    var camps = DATA.campaigns.slice().sort(function (a, b) { return b.cost - a.cost; });
    new Chart(document.getElementById("chart-cpa-vs-target"), {
      type: "bar",
      data: {
        labels: camps.map(function (c) { return c.campaign; }),
        datasets: [
          {
            label: "Actual cost / conv.",
            data: camps.map(function (c) { return c.cost_per_conv; }),
            backgroundColor: camps.map(function (c) { return c.cost_per_conv > c.target_cpa ? "#d93025" : "#188038"; }),
            borderRadius: 3
          },
          {
            label: "Target CPA",
            data: camps.map(function (c) { return c.target_cpa; }),
            backgroundColor: "#c6c9cd",
            borderRadius: 3
          }
        ]
      },
      options: {
        indexAxis: "y",
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 }, color: "#3c4043" } },
          tooltip: {
            callbacks: {
              label: function (ctx) { return " " + ctx.dataset.label + ": " + fmtGBP(ctx.parsed.x); }
            }
          }
        },
        scales: {
          x: { grid: { color: "#f1f3f4" }, ticks: { color: "#5f6368", font: { size: 11 }, callback: function (v) { return "£" + v; } } },
          y: { grid: { display: false }, ticks: { color: "#3c4043", font: { size: 11 } } }
        }
      }
    });
  }

  // ---------- campaign detail (weekly breakdown) ----------
  var detailChart = null;
  function renderCampaignDetail(campaignName) {
    var camp = DATA.campaigns.filter(function (c) { return c.campaign === campaignName; })[0];
    var weeks = DATA.weekly_by_campaign[campaignName] || [];
    if (!camp) return;

    document.getElementById("detail-title").textContent = camp.campaign;
    document.getElementById("detail-sub").textContent = weeks.length + " weeks · " + camp.bid_strategy;

    var variancePct = camp.target_cpa ? ((camp.cost_per_conv - camp.target_cpa) / camp.target_cpa) * 100 : null;
    var vCls = "on", vText = "On target";
    if (variancePct !== null) {
      if (variancePct > 1) { vCls = "over"; vText = "+" + variancePct.toFixed(1) + "% over target"; }
      else if (variancePct < -1) { vCls = "under"; vText = variancePct.toFixed(1) + "% under target"; }
      else { vText = "On target"; }
    }

    var statsHtml =
      '<div class="detail-stat"><span class="kpi-label">Cost</span><div class="kpi-value">' + fmtGBP(camp.cost) + '</div></div>' +
      '<div class="detail-stat"><span class="kpi-label">Conversions</span><div class="kpi-value">' + camp.conversions.toFixed(1) + '</div></div>' +
      '<div class="detail-stat"><span class="kpi-label">Actual cost / conv.</span><div class="kpi-value">' + fmtGBP(camp.cost_per_conv) + '</div></div>' +
      '<div class="detail-stat"><span class="kpi-label">Target CPA · <span class="vs-target ' + vCls + '">' + vText + '</span></span><div class="kpi-value">' + fmtGBP(camp.target_cpa) + '</div></div>';
    document.getElementById("detail-stats").innerHTML = statsHtml;

    var labels = weeks.map(function (w) { return fmtWeek(w.week); });
    if (detailChart) detailChart.destroy();
    detailChart = new Chart(document.getElementById("chart-campaign-detail"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Cost (£)",
            data: weeks.map(function (w) { return w.cost; }),
            backgroundColor: "#c8dafc",
            borderRadius: 3,
            yAxisID: "y",
            order: 2
          },
          {
            label: "Conversions",
            data: weeks.map(function (w) { return w.conversions; }),
            type: "line",
            borderColor: "#1a73e8",
            backgroundColor: "#1a73e8",
            pointRadius: 3,
            tension: 0.3,
            yAxisID: "y1",
            order: 1
          }
        ]
      },
      options: chartOpts({ y: { position: "left", title: "Cost (£)" }, y1: { position: "right", title: "Conversions" } })
    });

    var weekColumns = [
      { key: "week", label: "Week", render: function (r) { return fmtWeek(r.week); } },
      { key: "cost", label: "Cost", render: function (r) { return fmtGBP(r.cost); } },
      { key: "clicks", label: "Clicks", render: function (r) { return fmtInt(r.clicks); } },
      { key: "impr", label: "Impr.", render: function (r) { return fmtInt(r.impr); } },
      { key: "ctr", label: "CTR", render: function (r) { return fmtPct(r.ctr); } },
      { key: "avg_cpc", label: "Avg. CPC", render: function (r) { return fmtGBP(r.avg_cpc); } },
      { key: "conversions", label: "Conv.", render: function (r) { return r.conversions.toFixed(1); } },
      {
        key: "cost_per_conv", label: "Cost / conv.", render: function (r) {
          var cls = "on";
          if (camp.target_cpa) {
            if (r.cost_per_conv > camp.target_cpa * 1.01) cls = "over";
            else if (r.cost_per_conv < camp.target_cpa * 0.99) cls = "under";
          }
          return '<span class="vs-target ' + cls + '">' + fmtGBP(r.cost_per_conv) + '</span>';
        }
      }
    ];
    renderTable(document.getElementById("detail-table-wrap"), weekColumns, weeks, { defaultSort: "week", defaultDir: "asc" });
  }

  function chartOpts(axes) {
    return {
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 }, color: "#3c4043" } },
        tooltip: { backgroundColor: "#202124" }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#5f6368", font: { size: 11 }, maxRotation: 0, autoSkip: true } },
        y: { position: axes.y.position, grid: { color: "#f1f3f4" }, ticks: { color: "#5f6368", font: { size: 11 } } },
        y1: { position: axes.y1.position, grid: { display: false }, ticks: { color: "#5f6368", font: { size: 11 } } }
      }
    };
  }

  // ---------- generic sortable table ----------
  function renderTable(container, columns, rows, opts) {
    opts = opts || {};
    var sortKey = opts.defaultSort || columns[0].key;
    var sortDir = opts.defaultDir || "desc";

    function draw() {
      var sorted = rows.slice().sort(function (a, b) {
        var va = a[sortKey], vb = b[sortKey];
        if (typeof va === "string") {
          return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
        }
        return sortDir === "asc" ? va - vb : vb - va;
      });
      if (opts.limit) sorted = sorted.slice(0, opts.limit);

      var thead = "<thead><tr>" + columns.map(function (c) {
        var cls = c.key === sortKey ? "sorted" : "";
        var arrow = c.key === sortKey ? (sortDir === "asc" ? " ↑" : " ↓") : "";
        return '<th class="' + cls + '" data-key="' + c.key + '">' + c.label + arrow + "</th>";
      }).join("") + "</tr></thead>";

      var tbody = "<tbody>" + sorted.map(function (row) {
        var cls = opts.onRowClick ? "clickable" : "";
        var attr = opts.rowKey ? ' data-campaign="' + opts.rowKey(row).replace(/"/g, "&quot;") + '"' : "";
        return '<tr class="' + cls + '"' + attr + ">" + columns.map(function (c) {
          return "<td>" + (c.render ? c.render(row) : row[c.key]) + "</td>";
        }).join("") + "</tr>";
      }).join("") + "</tbody>";

      container.innerHTML = '<table class="gtable">' + thead + tbody + "</table>";

      container.querySelectorAll("th").forEach(function (th) {
        th.addEventListener("click", function () {
          var key = th.dataset.key;
          if (key === sortKey) {
            sortDir = sortDir === "asc" ? "desc" : "asc";
          } else {
            sortKey = key;
            sortDir = "desc";
          }
          draw();
        });
      });

      if (opts.onRowClick) {
        container.querySelectorAll("tbody tr").forEach(function (tr, i) {
          tr.addEventListener("click", function () { opts.onRowClick(sorted[i]); });
        });
        if (opts.selectedKey) {
          container.querySelectorAll("tbody tr").forEach(function (tr) {
            tr.classList.toggle("selected", tr.dataset.campaign === opts.selectedKey());
          });
        }
      }
    }
    draw();
    return { redraw: draw, setRows: function (newRows) { rows = newRows; draw(); } };
  }

  function statusPill(status) {
    if (!status) return "";
    var cls = "other";
    if (/^enabled/i.test(status)) cls = "enabled";
    else if (/limited/i.test(status)) cls = "limited";
    return '<span class="status-pill ' + cls + '">' + status + "</span>";
  }

  // ---------- campaigns table ----------
  var campaignColumns = [
    {
      key: "campaign", label: "Campaign", render: function (r) {
        var idx = DATA.campaigns.indexOf(r);
        var color = GOOGLE_COLORS[idx % GOOGLE_COLORS.length];
        return '<div class="campaign-cell"><span class="campaign-dot" style="background:' + color + '"></span>' + r.campaign + "</div>";
      }
    },
    { key: "status", label: "Status", render: function (r) { return statusPill(r.status); } },
    { key: "campaign_type", label: "Type" },
    { key: "bid_strategy", label: "Bid strategy" },
    { key: "cost", label: "Cost", render: function (r) { return fmtGBP(r.cost); } },
    { key: "clicks", label: "Clicks", render: function (r) { return fmtInt(r.clicks); } },
    { key: "impr", label: "Impr.", render: function (r) { return fmtInt(r.impr); } },
    { key: "ctr", label: "CTR", render: function (r) { return fmtPct(r.ctr); } },
    { key: "avg_cpc", label: "Avg. CPC", render: function (r) { return fmtGBP(r.avg_cpc); } },
    { key: "conversions", label: "Conv.", render: function (r) { return r.conversions.toFixed(1); } },
    { key: "cost_per_conv", label: "Cost / conv.", render: function (r) { return fmtGBP(r.cost_per_conv); } },
    { key: "target_cpa", label: "Target CPA", render: function (r) { return fmtGBP(r.target_cpa); } },
    {
      key: "vs_target", label: "vs Target", render: function (r) {
        if (!r.target_cpa) return "—";
        var pct = ((r.cost_per_conv - r.target_cpa) / r.target_cpa) * 100;
        var cls = pct > 1 ? "over" : (pct < -1 ? "under" : "on");
        var sign = pct > 0 ? "+" : "";
        return '<span class="vs-target ' + cls + '">' + sign + pct.toFixed(1) + '%</span>';
      }
    },
    { key: "conv_rate", label: "Conv. rate", render: function (r) { return fmtPct(r.conv_rate); } }
  ];

  var termColumns = [
    { key: "term", label: "Search term" },
    { key: "campaign", label: "Campaign" },
    { key: "match_type", label: "Match type" },
    { key: "clicks", label: "Clicks", render: function (r) { return fmtInt(r.clicks); } },
    { key: "impr", label: "Impr.", render: function (r) { return fmtInt(r.impr); } },
    { key: "ctr", label: "CTR", render: function (r) { return fmtPct(r.ctr); } },
    { key: "avg_cpc", label: "Avg. CPC", render: function (r) { return fmtGBP(r.avg_cpc); } },
    { key: "cost", label: "Cost", render: function (r) { return fmtGBP(r.cost); } },
    { key: "conversions", label: "Conv.", render: function (r) { return r.conversions.toFixed(1); } },
    { key: "cost_per_conv", label: "Cost / conv.", render: function (r) { return fmtGBP(r.cost_per_conv); } }
  ];

  var selectedCampaign = null;
  var campaignsTableHandle = null;

  function buildTables() {
    DATA.campaigns.forEach(function (r) {
      r.vs_target = r.target_cpa ? ((r.cost_per_conv - r.target_cpa) / r.target_cpa) * 100 : 0;
    });
    selectedCampaign = DATA.campaigns[0].campaign;

    renderTable(document.getElementById("top-campaigns-wrap"),
      [campaignColumns[0], campaignColumns[4], campaignColumns[9]],
      DATA.campaigns, { defaultSort: "cost", limit: 6 });

    campaignsTableHandle = renderTable(document.getElementById("campaigns-table-wrap"), campaignColumns, DATA.campaigns, {
      defaultSort: "cost",
      rowKey: function (r) { return r.campaign; },
      selectedKey: function () { return selectedCampaign; },
      onRowClick: function (r) {
        selectedCampaign = r.campaign;
        campaignsTableHandle.redraw();
        renderCampaignDetail(selectedCampaign);
      }
    });
    renderCampaignDetail(selectedCampaign);

    var termsHandle = renderTable(document.getElementById("terms-table-wrap"), termColumns, DATA.search_terms,
      { defaultSort: "cost", limit: 100 });

    var countLabel = document.getElementById("term-count-label");
    function updateCount(n, total) { countLabel.textContent = "Showing " + n + " of " + total; }
    updateCount(Math.min(100, DATA.search_terms.length), DATA.search_terms.length);

    document.getElementById("term-search").addEventListener("input", function (e) {
      var q = e.target.value.trim().toLowerCase();
      var filtered = !q ? DATA.search_terms : DATA.search_terms.filter(function (r) {
        return r.term.toLowerCase().indexOf(q) !== -1 || (r.campaign || "").toLowerCase().indexOf(q) !== -1;
      });
      termsHandle.setRows(filtered.slice(0, 100));
      updateCount(Math.min(100, filtered.length), filtered.length);
    });
  }

  // ---------- about ----------
  function buildAbout() {
    var grid = document.getElementById("about-grid");
    var html = "";
    Object.keys(DATA.overview).forEach(function (k) {
      html += "<dt>" + k + "</dt><dd>" + DATA.overview[k] + "</dd>";
    });
    grid.innerHTML = html;
  }

  // ---------- analysis tab ----------
  var VERDICT_META = {
    Scale:    { cls: "v-scale",    desc: "Grow this" },
    Merge:    { cls: "v-merge",    desc: "Combine with another campaign" },
    Split:    { cls: "v-split",    desc: "Break into two" },
    Question: { cls: "v-question", desc: "Needs an answer first" },
    Fix:      { cls: "v-fix",      desc: "Needs work" },
    Pause:    { cls: "v-pause",    desc: "Stop spending" },
    Close:    { cls: "v-close",    desc: "Shut down" }
  };
  var FLAG_META = {
    risk: { cls: "flag-risk", label: "Risk" },
    opportunity: { cls: "flag-opportunity", label: "Opportunity" },
    watch: { cls: "flag-watch", label: "Watch" },
    fix: { cls: "flag-fix", label: "Fix" }
  };
  var AN_SHADE_WEEKS = { "08-17": 1, "08-24": 1, "08-31": 1 };

  function anEsc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function anDataTable(cols, rows, shadeIdx) {
    if (!rows || !rows.length) return "";
    var thead = "<tr>" + cols.map(function (c) { return "<th>" + anEsc(c) + "</th>"; }).join("") + "</tr>";
    var tbody = rows.map(function (r) {
      var shaded = shadeIdx != null && AN_SHADE_WEEKS[r[shadeIdx]];
      var cls = shaded ? ' class="an-shaded"' : "";
      return "<tr" + cls + ">" + r.map(function (v) { return "<td>" + anEsc(v) + "</td>"; }).join("") + "</tr>";
    }).join("");
    return '<table class="an-table"><thead>' + thead + "</thead><tbody>" + tbody + "</tbody></table>";
  }

  function anStatTile(label, value) {
    return '<div class="an-stat"><span class="an-stat-label">' + anEsc(label) + '</span><span class="an-stat-value">' + anEsc(value) + "</span></div>";
  }

  function anFlagCard(f) {
    var meta = FLAG_META[f.type];
    return '<div class="an-flag ' + meta.cls + '">' +
      '<div class="an-flag-head"><span class="an-flag-tag">' + meta.label + '</span><span class="an-flag-title">' + anEsc(f.title) + "</span></div>" +
      '<p class="an-flag-body">' + anEsc(f.body) + "</p></div>";
  }

  function anCampaignBlock(c) {
    var vmeta = VERDICT_META[c.verdict];
    var statOrder = [
      ["Spend", c.stats.spend], ["Conversions", c.stats.conversions],
      ["CPL, full period", c.stats.cpl_full], ["CPL to 16 Aug", c.stats.cpl_16aug],
      ["Target CPA", c.stats.target_cpa], ["CVR", c.stats.cvr], ["Daily budget", c.stats.budget]
    ];
    var statsHtml = statOrder.map(function (s) { return anStatTile(s[0], s[1]); }).join("");
    var flagsHtml = c.flags.map(anFlagCard).join("");
    var weeklyHtml = anDataTable(c.weeklyCols, c.weekly, 0);

    var evidenceExtra;
    if (c.keywords && c.keywords.length) {
      var kwNote = c.keywordNote ? '<p class="an-subnote">' + anEsc(c.keywordNote) + "</p>" : "";
      evidenceExtra =
        '<div class="an-evidence-block"><h4>Keywords carrying the visible spend (top 3 by spend)</h4>' + kwNote + anDataTable(c.keywordCols, c.keywords, -1) + "</div>" +
        '<div class="an-evidence-block"><h4>Highest-spending queries (top 3 by spend)</h4>' + anDataTable(c.queryCols, c.queries, -1) + "</div>";
    } else {
      evidenceExtra = '<div class="an-evidence-block"><p class="an-subnote">' + anEsc(c.noTermsNote || "") + "</p></div>";
    }

    return '<article class="an-campaign" id="an-camp-' + c.rank + '">' +
      '<header class="an-camp-head"><div class="an-camp-head-left">' +
      '<span class="an-rank">#' + c.rank + " by spend</span><h3>" + anEsc(c.name) + '</h3>' +
      '<span class="an-camp-sub">' + anEsc(c.spend) + " &middot; " + anEsc(c.share) + ' of account spend</span></div>' +
      '<div class="an-verdict ' + vmeta.cls + '"><span class="an-verdict-label">' + anEsc(c.verdict) + '</span><span class="an-verdict-desc">' + anEsc(vmeta.desc) + "</span></div></header>" +
      '<div class="an-stats-row">' + statsHtml + "</div>" +
      '<p class="an-desc">' + anEsc(c.desc) + "</p>" +
      '<div class="an-flags-grid">' + flagsHtml + "</div>" +
      '<details class="an-evidence"><summary>Show supporting data &mdash; weekly performance, keywords and search terms</summary>' +
      '<div class="an-evidence-block"><h4>Weekly performance</h4>' +
      '<p class="an-subnote">Rows shaded from 17 August are the three weeks affected by the delivery event; the verdict above is based on performance to 16 August.</p>' +
      weeklyHtml + "</div>" + evidenceExtra + "</details></article>";
  }

  function buildAnalysis() {
    var AD = window.ANALYSIS_DATA;
    if (!AD) return;

    document.getElementById("an-date-range").textContent =
      "Motorly second stage exercise · 1 Jun 2026 – 6 Sep 2026 · £48,176 across 10 campaigns";

    var triageHead = "<tr><th>Campaign</th><th>Spend</th><th>Share</th><th>Daily budget</th><th>Conv.</th>" +
      "<th>CPL to 16 Aug</th><th>Target CPA</th><th>CVR</th><th>Verdict</th></tr>";
    var triageBody = AD.triage.map(function (t) {
      var vmeta = VERDICT_META[t.verdict];
      return "<tr><td>" + anEsc(t.name) + "</td><td>" + anEsc(t.spend) + "</td><td>" + anEsc(t.share) + "</td>" +
        "<td>" + anEsc(t.budget) + "</td><td>" + anEsc(t.conv) + "</td><td>" + anEsc(t.cpl) + "</td>" +
        "<td>" + anEsc(t.targetCpa) + "</td><td>" + anEsc(t.cvr) + '</td><td><span class="an-pill ' + vmeta.cls + '">' + anEsc(t.verdict) + "</span></td></tr>";
    }).join("");
    document.getElementById("an-triage-wrap").innerHTML =
      '<table class="an-table an-triage-table"><thead>' + triageHead + "</thead><tbody>" + triageBody + "</tbody></table>";

    document.getElementById("an-camp-nav").innerHTML = AD.campaigns.map(function (c) {
      return '<a href="#an-camp-' + c.rank + '" class="an-chip">' + anEsc(c.name) + "</a>";
    }).join("");

    document.getElementById("an-campaigns").innerHTML = AD.campaigns.map(anCampaignBlock).join("");
  }

  // ---------- budget pacer ----------
  function bpEsc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function bpStatus(actual, forecast, mode) {
    if (!forecast || actual == null) return { key: "na", label: "—", variance: 0 };
    var ratio = actual / forecast;
    var key;
    if (mode === "closer") {
      var dev = Math.abs(ratio - 1);
      key = dev <= 0.10 ? "green" : (dev <= 0.25 ? "amber" : "red");
    } else if (mode === "lower") {
      key = ratio <= 1.10 ? "green" : (ratio <= 1.25 ? "amber" : "red");
    } else {
      key = ratio >= 0.90 ? "green" : (ratio >= 0.75 ? "amber" : "red");
    }
    return { key: key, label: key.charAt(0).toUpperCase() + key.slice(1), variance: ratio - 1 };
  }

  function bpMetricCell(value, display, forecast, mode) {
    var st = bpStatus(value, forecast, mode);
    var pct = st.variance * 100;
    var sign = pct > 0 ? "+" : "";
    var title = st.label + " · " + sign + pct.toFixed(1) + "% vs forecast";
    return '<td class="bp-actual-cell rag-' + st.key + '" title="' + bpEsc(title) + '">' +
      '<div class="bp-cell-inner"><span class="bp-cell-value">' + bpEsc(display) + '</span>' +
      '<span class="bp-rag-pill ' + st.key + '">' + st.label + '</span></div></td>';
  }

  function buildBudgetPacer() {
    var campaignName = "Various 6 tCPA";
    var weeks = DATA.weekly_by_campaign[campaignName] || [];
    if (!weeks.length) return;

    var dailyBudget = 400;
    var days = 7;
    var baselineWeek = "2026-07-27";
    var baseline = weeks.filter(function (w) { return w.week === baselineWeek; })[0];
    if (!baseline) return;

    var baseCpc = baseline.cost / baseline.clicks;
    var baseCvr = baseline.conversions / baseline.clicks;
    var baseCtr = baseline.clicks / baseline.impr;
    var weeklySpend = dailyBudget * days;
    var forecastClicks = weeklySpend / baseCpc;
    var forecastImpr = forecastClicks / baseCtr;
    var forecastConv = forecastClicks * baseCvr;
    var forecastCpl = weeklySpend / forecastConv;

    var forecast = {
      spend: weeklySpend,
      impr: forecastImpr,
      clicks: forecastClicks,
      avg_cpc: baseCpc,
      conversions: forecastConv,
      conv_rate: baseCvr,
      cost_per_conv: forecastCpl
    };

    var cards = [
      ["Daily budget", fmtGBP(dailyBudget)],
      ["Weekly spend", fmtGBP0(forecast.spend)],
      ["Impressions", fmtInt(Math.round(forecast.impr))],
      ["Clicks", fmtInt(Math.round(forecast.clicks))],
      ["Conversions", forecast.conversions.toFixed(0)],
      ["Avg. CPC", fmtGBP(forecast.avg_cpc)],
      ["CVR", fmtPct(forecast.conv_rate)],
      ["CPL", fmtGBP(forecast.cost_per_conv)]
    ];
    document.getElementById("bp-forecast").innerHTML = cards.map(function (c, i) {
      return '<div class="bp-forecast-card' + (i === 0 ? ' primary' : '') + '">' +
        '<span class="bp-forecast-label">' + bpEsc(c[0]) + '</span>' +
        '<strong class="bp-forecast-value">' + bpEsc(c[1]) + '</strong></div>';
    }).join("");

    var baselineDaily = baseline.cost / days;
    var baselineUse = baseline.cost / weeklySpend;
    document.getElementById("bp-insight").innerHTML =
      '<div class="bp-insight-icon">!</div><div><strong>Early warning already visible:</strong> even the strongest pre-August week spent ' +
      fmtGBP(baseline.cost) + ' (' + fmtPct(baselineUse) + ' of the £2,800 weekly budget), or about ' +
      fmtGBP(baselineDaily) + '/day against a £400/day setting. The campaign was efficient, but materially under-delivering.</div>';

    var head = '<thead><tr><th>Week</th><th>Spend</th><th>Impr.</th><th>Clicks</th><th>Avg. CPC</th><th>Conv.</th><th>CVR</th><th>CPL</th></tr></thead>';
    var body = weeks.map(function (w) {
      var cplDisplay = w.conversions ? fmtGBP(w.cost_per_conv) : "—";
      return '<tr>' +
        '<td class="bp-week">' + bpEsc(fmtWeek(w.week)) + '</td>' +
        bpMetricCell(w.cost, fmtGBP(w.cost), forecast.spend, "closer") +
        bpMetricCell(w.impr, fmtInt(w.impr), forecast.impr, "higher") +
        bpMetricCell(w.clicks, fmtInt(w.clicks), forecast.clicks, "higher") +
        bpMetricCell(w.avg_cpc, fmtGBP(w.avg_cpc), forecast.avg_cpc, "lower") +
        bpMetricCell(w.conversions, w.conversions.toFixed(1), forecast.conversions, "higher") +
        bpMetricCell(w.clicks ? w.conversions / w.clicks : 0, fmtPct(w.clicks ? w.conversions / w.clicks : 0), forecast.conv_rate, "higher") +
        bpMetricCell(w.conversions ? w.cost / w.conversions : 999999, cplDisplay, forecast.cost_per_conv, "lower") +
        '</tr>';
    }).join("");
    document.getElementById("bp-weekly-wrap").innerHTML = '<table class="bp-table">' + head + '<tbody>' + body + '</tbody></table>';

    var monthlySpend = dailyBudget * 30;
    var monthlyClicks = monthlySpend / baseCpc;
    var monthlyImpr = monthlyClicks / baseCtr;
    var monthlyConv = monthlyClicks * baseCvr;

    document.getElementById("bp-model-details").innerHTML =
      '<div class="bp-model-grid">' +
        '<div class="bp-model-block"><h3>Benchmark week</h3><p><strong>27 Jul 2026</strong></p>' +
          '<dl><dt>Spend</dt><dd>' + fmtGBP(baseline.cost) + '</dd><dt>Clicks</dt><dd>' + fmtInt(baseline.clicks) +
          '</dd><dt>Impressions</dt><dd>' + fmtInt(baseline.impr) + '</dd><dt>Conversions</dt><dd>' + baseline.conversions.toFixed(2) + '</dd></dl></div>' +
        '<div class="bp-model-block"><h3>Locked rates</h3>' +
          '<dl><dt>CPC</dt><dd>' + fmtGBP(baseCpc) + '</dd><dt>CTR</dt><dd>' + fmtPct(baseCtr) +
          '</dd><dt>CVR</dt><dd>' + fmtPct(baseCvr) + '</dd><dt>CPL</dt><dd>' + fmtGBP(forecastCpl) + '</dd></dl></div>' +
        '<div class="bp-model-block"><h3>30-day view</h3>' +
          '<dl><dt>Spend</dt><dd>' + fmtGBP0(monthlySpend) + '</dd><dt>Clicks</dt><dd>' + fmtInt(Math.round(monthlyClicks)) +
          '</dd><dt>Impressions</dt><dd>' + fmtInt(Math.round(monthlyImpr)) + '</dd><dt>Conversions</dt><dd>' + monthlyConv.toFixed(0) + '</dd></dl></div>' +
      '</div>' +
      '<div class="bp-formula-box"><strong>Forecast formulas</strong>' +
        '<span>CPC = £1,825.04 ÷ 821</span><span>CVR = 304.67 ÷ 821</span><span>CTR = 821 ÷ 7,277</span>' +
        '<span>Weekly spend = £400 × 7</span><span>Clicks = spend ÷ CPC</span><span>Impressions = clicks ÷ CTR</span>' +
        '<span>Conversions = clicks × CVR</span><span>CPL = spend ÷ conversions</span></div>' +
      '<p class="bp-method-note"><strong>RAG logic:</strong> Spend is green within ±10% of forecast, amber within ±25%, otherwise red. ' +
      'Impressions, clicks, conversions and CVR are green at ≥90% of forecast, amber at 75–89.9%, otherwise red. ' +
      'CPC and CPL are green at ≤110% of forecast, amber at 110–125%, otherwise red. ' +
      'This is a pacing benchmark, not a guarantee of linear scale.</p>';
  }

  buildKpis();
  buildCharts();
  buildTables();
  buildAbout();
  buildAnalysis();
  buildBudgetPacer();
})();
