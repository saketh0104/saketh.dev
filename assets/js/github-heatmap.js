/* GitHub contribution heatmap — LIVE data only, no build step, no JS framework.
   Sources tried in order; each returns real public contribution data for the
   account (the same data GitHub shows at
   github.com/users/<user>/contributions):
     1. api.bloggify.net        — CORS middleman serving GitHub's contribution fragment (HTML)
     2. jogruber.de             — GitHub-GraphQL-backed JSON (?y=last)
     3. api.allorigins.win/raw  — raw pass-through proxy to GitHub's fragment (HTML)
   All paths build { total: {lastYear}, contributions: [{date,count,level}] }.
   Never falls back to static or fabricated data: if every source is
   unreachable a graceful message + profile link is shown instead. */
(function () {
  'use strict';

  var USER = 'saketh0104';
  var CONTAINER = document.getElementById('github-heatmap');
  if (!CONTAINER) return;

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function iso(d) {
    var m = d.getMonth() + 1;
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' +
      (d.getDate() < 10 ? '0' + d.getDate() : d.getDate());
  }

  function fmt(d) {
    return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  /* ---- GitHub's HTML contribution fragment -> normalized data ---- */
  function parseFragment(html) {
    var tm = html.match(/([\d,]+)\s+contributions?\s+in the last year/i);
    var total = tm ? parseInt(tm[1].replace(/,/g, ''), 10) : 0;

    var tips = {};
    var tre = /<tool-tip[^>]*for="([^"]+)"[^>]*>([\s\S]*?)<\/tool-tip>/g;
    var m;
    while ((m = tre.exec(html))) {
      var cm = m[2].match(/([\d,]+)\s+contributions?/);
      tips[m[1]] = cm ? parseInt(cm[1].replace(/,/g, ''), 10) : 0;
    }

    var cells = [];
    var cre = /<td[^>]*class="ContributionCalendar-day"[^>]*>/g;
    while ((m = cre.exec(html))) {
      var block = m[0];
      var dm = block.match(/data-date="([\d-]+)"/);
      var lm = block.match(/data-level="(\d)"/);
      var im = block.match(/id="([^"]+)"/);
      if (!dm || !lm) continue;
      cells.push({ date: dm[1], level: parseInt(lm[1], 10), count: (im && tips[im[1]]) || 0 });
    }

    var months = [];
    var col = 0;
    var mre = /<td class="ContributionCalendar-label" colspan="(\d+)"[\s\S]*?<span[^>]*>([A-Za-z]{3,})<\/span>/g;
    while ((m = mre.exec(html))) {
      var n = parseInt(m[1], 10);
      for (var k = 0; k < n; k++) months[col + k] = m[2].slice(0, 3);
      col += n;
    }

    return { total: { lastYear: total }, contributions: cells, months: months };
  }

  var REQUEST_TIMEOUT = 6000;   // per-source deadline (ms)
  var WATCHDOG_TIME = 20000;    // absolute deadline — never stay stuck on loading (ms)

  /* Every request must settle in finite time. A bare fetch() can hang forever
     (dropped TCP, Cloudflare holding the connection, a flaky proxy), which
     would strand the UI on "Loading…". This wraps fetch in a timeout that
     rejects at REQUEST_TIMEOUT and aborts the underlying request. */
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
          return r.text();
        })
        .then(function (text) {
          clearTimeout(timer);
          resolve(text);
        }, function (err) {
          clearTimeout(timer);
          reject(err instanceof Error ? err : new Error('request failed ' + url));
        });
    });
  }

  /* ---- data sources (each resolves to the normalized shape) ---- */
  var SOURCES = [
    function bloggify() {
      return fetchWithTimeout('https://api.bloggify.net/gh-calendar/?username=' + USER)
        .then(parseFragment);
    },
    function jogruber() {
      return fetchWithTimeout('https://github-contributions-api.jogruber.de/v4/' + USER + '?y=last')
        .then(function (text) { return JSON.parse(text); })
        .then(function (d) {
          return {
            total: d.total || {},
            contributions: (d.contributions || []).map(function (c) {
              return { date: c.date, count: c.count, level: c.level };
            })
          };
        });
    },
    function allorigins() {
      return fetchWithTimeout('https://api.allorigins.win/raw?url=' +
        encodeURIComponent('https://github.com/users/' + USER + '/contributions'))
        .then(parseFragment);
    }
  ];

  var watchdog = setTimeout(showFallback, WATCHDOG_TIME);

  function showFallback() {
    clearTimeout(watchdog);
    CONTAINER.innerHTML =
      '<p class="text-sm text-gray-500 py-8 text-center">GitHub contribution data is currently unavailable. '
      + '<a href="https://github.com/' + USER + '" target="_blank" rel="noopener noreferrer" '
      + 'class="text-gray-700 underline hover:text-purple-600">View profile \u2192</a></p>';
  }

  (function loadSource() {
    if (!SOURCES.length) { showFallback(); return; }
    SOURCES.shift()()
      .then(function (data) {
        if (!data || !data.contributions || !data.contributions.length) throw new Error('empty');
        render(data);
      })
      .catch(loadSource);
  })();

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
    for (var c = 0; c < cols; c++) {
      monthRow += '<div>' + (months[c] ? '<span class="gh-month">' + months[c] + '</span>' : '') + '</div>';
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
})();