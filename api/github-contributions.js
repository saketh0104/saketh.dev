/* Vercel serverless function: /api/github-contributions
   Fetches GitHub's PUBLIC contribution page for saketh0104 directly from the
   server and normalizes it into the JSON shape assets/js/github-heatmap.js
   renders. No third-party proxy. No auth. No private data. */

var USER = 'saketh0104';
var TIMEOUT_MS = 8000; // finite server-side timeout — never hang

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

module.exports = async function (req, res) {
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
  try {
    var r = await fetch('https://github.com/users/' + USER + '/contributions', {
      signal: ctrl.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; portfolio/1.0)' }
    });
    if (!r.ok) throw new Error('github http ' + r.status);
    var html = await r.text();
    var data = parseFragment(html);
    if (!data.contributions || !data.contributions.length) throw new Error('no contribution data in github response');
    res.setHeader('cache-control', 'public, max-age=3600, stale-while-revalidate=86400');
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: 'failed to fetch github contributions: ' + e.message });
  } finally {
    clearTimeout(timer);
  }
};