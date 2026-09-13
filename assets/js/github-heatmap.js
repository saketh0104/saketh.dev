/* GitHub contribution heatmap — LIVE data only, no build step, no JS framework.
   Data comes from the project's own Vercel serverless endpoint, which fetches
   GitHub's public contribution page server-side (no third-party proxies):
       /api/github-contributions  -> { total:{lastYear}, contributions:[{date,count,level}], months }
   The endpoint normalizes the HTML fragment into JSON; this file only fetches,
   validates, and renders. Never falls back to static/fabricated data. */
(function () {
  'use strict';

  var USER = 'saketh0104';
  var CONTAINER = document.getElementById('github-heatmap');
  if (!CONTAINER) return;

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var REQUEST_TIMEOUT = 8000;   // finite deadline (ms) — never stay stuck loading
  var WATCHDOG_TIME = 20000;    // absolute deadline for the graceful fallback (ms)

  /* Every request must settle in finite time. A bare fetch() can hang forever
     (proxies dying mid-request, dropped TCP), which would strand the UI on
     "Loading…". This rejects at REQUEST_TIMEOUT and aborts the request. */
  function fetchWithTimeout(url) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        if (ctrl) ctrl.abort();
        reject(new Error('request timed out after ' + REQUEST_TIMEOUT + 'ms: ' + url));
      }, REQUEST_TIMEOUT);
      fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
        .then(function (r) {
          if (!r.ok) throw new Error('http ' + r.status + ' ' + url);
          return r.json();
        })
        .then(function (data) {
          clearTimeout(timer);
          resolve(data);
        }, function (err) {
          clearTimeout(timer);
          reject(err instanceof Error ? err : new Error('request failed ' + url));
        });
    });
  }

  var watchdog = setTimeout(showFallback, WATCHDOG_TIME);

  function showFallback() {
    clearTimeout(watchdog);
    CONTAINER.innerHTML =
      '<p class="text-sm text-gray-500 py-8 text-center">GitHub contribution data is currently unavailable. '
      + '<a href="https://github.com/' + USER + '" target="_blank" rel="noopener noreferrer" '
      + 'class="text-gray-700 underline hover:text-purple-600">View profile \u2192</a></p>';
  }

  /* Project-local endpoint. Response is already normalized by the server. */
  fetchWithTimeout('/api/github-contributions')
    .then(function (data) {
      if (!data || !data.total || typeof data.total.lastYear !== 'number'
          || !Array.isArray(data.contributions) || !data.contributions.length) {
        throw new Error('invalid response from /api/github-contributions');
      }
      render(data);
    })
    .catch(showFallback);

  /* ---- render: grid derived from the data (matches GitHub's own grid) ---- */
  function render(data) {
    clearTimeout(watchdog);
    var byDate = {};
    data.contributions.forEach(function (d) { byDate[d.date] = d; });

    var firstSun = new Date(data.contributions[0].date);
    firstSun.setDate(firstSun.getDate() - firstSun.getDay());
    var lastSat = new Date(data.contributions[data.contributions.length - 1].date);
    lastSat.setDate(lastSat.getDate() + (6 - lastSat.getDay()));
    var cols = Math.round((lastSat - firstSun) / 86400000 / 7) + 1;

    var months = data.months && data.months.length
      ? data.months
      : computedMonths(firstSun, cols, byDate);

    var monthRow = '', dayRow = '';
    var prevMonth = '';
    for (var c = 0; c < cols; c++) {
      var label = (months[c] && months[c] !== prevMonth) ? months[c] : '';
      if (label) prevMonth = label;
      monthRow += '<div>' + (label ? '<span class="gh-month">' + label + '</span>' : '') + '</div>';
      for (var r = 0; r < 7; r++) {
        var d = new Date(Number(firstSun) + (c * 7 + r) * 86400000);
        var cell = byDate[iso(d)];
        var cls = 'gh-cell l' + (cell ? Math.min(4, cell.level || 0) : 0);
        var tips = cell ? (cell.count || 0) : 0;
        var label = tips > 0
          ? (tips + (tips === 1 ? ' contribution' : ' contributions') + ' on ' + fmt(d))
          : 'No contributions on ' + fmt(d);
        dayRow += '<div class="' + cls + '" title="' + label + '"></div>';
      }
    }

    var legend = '<div class="gh-legend"><span>Less</span>'
      + '<i class="gh-square l0"></i><i class="gh-square l1"></i><i class="gh-square l2"></i>'
      + '<i class="gh-square l3"></i><i class="gh-square l4"></i><span>More</span></div>';

    CONTAINER.innerHTML =
      '<p class="gh-caption">' + (data.total.lastYear || 'Contributions')
      + ' contributions in the last year</p>'
      + '<div class="gh-months">' + monthRow + '</div>'
      + '<div class="gh-grid">' + dayRow + '</div>'
      + legend;
  }

  function computedMonths(firstSun, cols, byDate) {
    var months = [];
    for (var c = 0; c < cols; c++) {
      for (var r = 0; r < 7; r++) {
        var d = new Date(Number(firstSun) + (c * 7 + r) * 86400000);
        if (d.getDate() === 1) { months[c] = MONTHS[d.getMonth()]; break; }
      }
    }
    return months;
  }

  function iso(d) {
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  function fmt(d) {
    return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }
})();