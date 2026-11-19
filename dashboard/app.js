// Token Radar dashboard (radar-2). Reads window.RADAR, written beside
// dashboard/ by main.ts from the sealed snapshot. No fetch, no network:
// every byte it shows is in data.js. The board's farm steps are the ones
// board.json carries, shown verbatim; the model breakdown is recomputed
// from the row's own figures so the page and the board visibly agree.
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', scope: 'all', sort: 'implied', dir: -1, selected: null };
  var WATCH = {};
  (DATA.watchlist || []).forEach(function (s) { WATCH[s] = true; });

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(d) {
    if (d === null || d === undefined) return 'unknown';
    if (d >= 365) return (d / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(d)) + 'd';
  }
  function fmtMult(n) { return (n === null || n === undefined) ? 'n/a' : 'x' + n.toFixed(2); }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) node.appendChild(x); });
      else if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    }
    return node;
  }

  function readHash() {
    var h = window.location.hash.replace(/^#/, '');
    if (!h) return;
    var p = new URLSearchParams(h);
    if (p.get('q')) state.q = p.get('q');
    if (p.get('category')) state.category = p.get('category');
    if (p.get('chain')) state.chain = p.get('chain');
    if (p.get('scope')) state.scope = p.get('scope');
    if (p.get('sort')) state.sort = p.get('sort');
    if (p.get('p')) state.selected = p.get('p');
  }
  function writeHash() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.category !== 'all') p.set('category', state.category);
    if (state.chain !== 'all') p.set('chain', state.chain);
    if (state.scope !== 'all') p.set('scope', state.scope);
    if (state.sort !== 'implied') p.set('sort', state.sort);
    if (state.selected) p.set('p', state.selected);
    var next = p.toString();
    window.history.replaceState(null, '', next ? '#' + next : window.location.pathname + window.location.search);
  }

  function inScope(r) {
    if (state.scope === 'watchlist') return WATCH[r.slug] === true;
    if (state.scope === 'early') return WATCH[r.slug] !== true;
    return true;
  }
  function filtered() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (!inScope(r)) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (!q) return true;
      return [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }
  function sorted(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }
  function topImplied() { return DATA.rows.length ? DATA.rows[0].implied_value_usd : 1; }

  function sortButton(label, key) {
    var arrow = state.sort === key ? (state.dir === -1 ? ' \u25bc' : ' \u25b2') : '';
    return el('button', { type: 'button', onclick: function () {
      if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; }
      writeHash(); render();
    } }, label + arrow);
  }

  function rowEl(r) {
    var tr = el('tr', { 'data-selected': state.selected === r.slug ? 'true' : 'false', onclick: function () { select(r.slug); } });
    var badge = WATCH[r.slug] ? el('span', { class: 'badge', text: 'WATCHLIST' }) : el('span', { class: 'badge early', text: 'EARLY' });
    var name = el('td', {}, el('span', { class: 'name' }, el('b', {}, r.name), el('span', { class: 'sub' }, (r.category || 'Uncategorized') + ' \u00b7 ' + (r.chains || []).slice(0, 3).join(', ') + ((r.chains || []).length > 3 ? ' +' + ((r.chains || []).length - 3) : ''))), badge);
    var growth = el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg') }, fmtPct(r.change_7d));
    var imp = el('td', {}, el('span', { class: 'implied' }, el('span', { class: 'num' }, fmtUsd(r.implied_value_usd)), el('span', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(2, Math.round(100 * r.implied_value_usd / topImplied())) + '%' }))));
    tr.appendChild(el('td', { class: 'num' }, String(r.rank)));
    tr.appendChild(name);
    tr.appendChild(el('td', { class: 'num' }, fmtUsd(r.tvl_usd)));
    tr.appendChild(growth);
    tr.appendChild(el('td', { class: 'num' }, fmtAge(r.age_days)));
    tr.appendChild(imp);
    tr.appendChild(el('td', { class: 'num' }, fmtMult(r.category_multiple)));
    return tr;
  }

  function select(slug) {
    state.selected = slug;
    writeHash();
    render();
    var panel = document.getElementById('detail');
    if (panel && !panel.hidden) panel.scrollTop = 0;
  }

  function renderDetail() {
    var panel = document.getElementById('detail');
    if (!panel) return;
    var r = null;
    if (state.selected) DATA.rows.forEach(function (x) { if (x.slug === state.selected) r = x; });
    if (!r) { panel.hidden = true; panel.innerHTML = ''; return; }
    panel.hidden = false;
    panel.innerHTML = '';
    var head = el('div', { class: 'detail-head' },
      el('div', {}, el('span', { class: 'sub' }, 'Rank #' + r.rank + ' \u00b7 ' + (WATCH[r.slug] ? 'Watchlist \u00b7 TVL above $50M' : 'Early \u00b7 below the $50M floor')),
        el('h2', {}, r.name),
        el('p', { class: 'sub' }, (r.category || 'Uncategorized') + ' \u00b7 ' + (r.chains || []).join(', ') + ' \u00b7 listed ' + (r.listed_at || 'unknown'))),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close detail', onclick: function () { state.selected = null; writeHash(); render(); } }, '\u00d7'));
    panel.appendChild(head);
    var kv = el('div', { class: 'kv' });
    [['Implied value', fmtUsd(r.implied_value_usd)], ['TVL', fmtUsd(r.tvl_usd)],
     ['7-day TVL change', fmtPct(r.change_7d)], ['Age', fmtAge(r.age_days)],
     ['Category multiple', fmtMult(r.category_multiple)], ['Growth multiplier', fmtMult(r.growth_multiplier)],
     ['Readiness multiplier', fmtMult(r.maturity_multiplier)], ['Breadth multiplier', fmtMult(r.breadth_multiplier)]
    ].forEach(function (pair) { kv.appendChild(el('div', {}, el('span', {}, pair[0]), el('b', {}, pair[1]))); });
    panel.appendChild(kv);
    panel.appendChild(el('p', { class: 'note' }, 'Implied value = TVL \u00d7 category multiple \u00d7 growth multiplier \u00d7 readiness multiplier \u00d7 breadth multiplier. The category multiple is calibrated from this snapshot\u2019s live-token protocols, so a DEX and a lender do not trade at the same multiple of TVL.'));
    panel.appendChild(el('h3', { style: 'margin-top:18px' }, 'How to farm ' + r.name));
    var steps = el('ol', { class: 'steps' });
    (r.farm_steps || []).forEach(function (s) { steps.appendChild(el('li', {}, el('div', {}, el('p', {}, s)))); });
    panel.appendChild(steps);
    panel.appendChild(el('p', { class: 'note' }, 'This protocol records no token in the snapshot. That is not proof it has none: DefiLlama\u2019s record may miss one. Never pay to claim an airdrop, and claim only from the protocol\u2019s own published link.'));
  }

  function render() {
    readHashOnce();
    var list = sorted(filtered());
    var live = state.scope === 'live';
    app.innerHTML = '';
    app.setAttribute('aria-busy', 'false');
    var shell = el('div', { class: 'shell' });
    app.appendChild(shell);

    var top = el('div', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark', 'aria-hidden': 'true' }), el('b', {}, 'Token Radar')),
      el('div', { class: 'top-meta' },
        el('span', {}, 'Snapshot ', el('b', {}, DATA.as_of)),
        el('span', {}, 'Protocols ', el('b', {}, String(DATA.snapshot_protocols || (DATA.rows.length + DATA.live_size)))),
        el('span', {}, 'Model ', el('b', {}, DATA.model_version))));
    shell.appendChild(top);

    var med = DATA.rows.length ? DATA.rows[Math.floor(DATA.rows.length / 2)].implied_value_usd : 0;
    var lede = el('div', { class: 'lede' },
      el('div', {},
        el('h1', {}, 'Which pre-token protocol is worth farming next?'),
        el('p', {}, 'A radar over the DefiLlama snapshot of ' + DATA.as_of + ': every protocol that records no token, ranked by the implied value of the token it may one day issue. The watchlist is the $50M floor; the early rows below it are the point of the radar.')),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', {}, 'Ranked rows'), el('b', {}, String(DATA.rows.length))),
        el('div', { class: 'fact' }, el('span', {}, 'Watchlist (TVL \u2265 $50M)'), el('b', {}, String(DATA.watchlist_size))),
        el('div', { class: 'fact' }, el('span', {}, 'Early rows below the floor'), el('b', {}, String(DATA.early_size))),
        el('div', { class: 'fact' }, el('span', {}, 'Top implied value'), el('b', {}, fmtUsd(topImplied()))),
        el('div', { class: 'fact' }, el('span', {}, 'Median implied value'), el('b', {}, fmtUsd(med))),
        el('div', { class: 'fact' }, el('span', {}, 'Live tokens set aside'), el('b', {}, String(DATA.live_size)))));
    shell.appendChild(lede);

    var cats = [];
    DATA.rows.forEach(function (r) { if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category); });
    cats.sort();
    var chains = [];
    DATA.rows.forEach(function (r) { (r.chains || []).forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); }); });
    chains.sort();
    var controls = el('div', { class: 'controls' });
    var search = el('input', { type: 'search', placeholder: 'Search name, slug, chain\u2026', value: state.q, 'aria-label': 'Search protocols' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); renderTable(); });
    controls.appendChild(el('div', { class: 'field' }, el('label', {}, 'Search'), search));
    var catSel = el('select', { 'aria-label': 'Category' });
    catSel.appendChild(el('option', { value: 'all' }, 'All categories'));
    cats.forEach(function (c) { var o = el('option', { value: c }, c); if (state.category === c) o.selected = true; catSel.appendChild(o); });
    catSel.addEventListener('change', function () { state.category = catSel.value; writeHash(); renderTable(); });
    controls.appendChild(el('div', { class: 'field' }, el('label', {}, 'Category'), catSel));
    var chainSel = el('select', { 'aria-label': 'Chain' });
    chainSel.appendChild(el('option', { value: 'all' }, 'All chains'));
    chains.forEach(function (c) { var o = el('option', { value: c }, c); if (state.chain === c) o.selected = true; chainSel.appendChild(o); });
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; writeHash(); renderTable(); });
    controls.appendChild(el('div', { class: 'field' }, el('label', {}, 'Chain'), chainSel));
    var tabs = el('div', { class: 'tabs', role: 'group', 'aria-label': 'Scope' });
    [['all', 'All ' + DATA.rows.length], ['watchlist', 'Watchlist'], ['early', 'Early'], ['live', 'Live tokens']].forEach(function (t) {
      tabs.appendChild(el('button', { type: 'button', 'aria-pressed': state.scope === t[0] ? 'true' : 'false', onclick: function () { state.scope = t[0]; writeHash(); render(); } }, t[1]));
    });
    controls.appendChild(tabs);
    controls.appendChild(el('span', { class: 'count', id: 'count' }, ''));
    shell.appendChild(controls);

    var panel = el('div', { class: 'panel' });
    var wrap = el('div', { class: 'table-wrap', id: 'table-wrap' });
    panel.appendChild(wrap);
    shell.appendChild(panel);
    var tableHost = wrap;

    var sections = el('div', { class: 'sections' });
    var multRows = Object.keys(DATA.category_multiples).sort().map(function (c) {
      return el('tr', {}, el('td', {}, c), el('td', { class: 'num' }, fmtMult(DATA.category_multiples[c])));
    });
    sections.appendChild(el('div', { class: 'card' },
      el('h2', {}, 'The model, in the open'),
      el('p', { class: 'formula' }, 'implied = TVL \u00d7 category multiple \u00d7 growth \u00d7 readiness \u00d7 breadth'),
      el('ul', {},
        el('li', {}, 'Category multiple: median mcap/TVL of this snapshot\u2019s live protocols in the category, shrunk toward the global median ' + fmtMult(DATA.global_multiple) + ' and clamped to 0.08\u20130.40.'),
        el('li', {}, 'Growth: 7-day TVL change clamped to \u221250\u2026+150%, weighted 0.6.'),
        el('li', {}, 'Readiness: an age hump \u2014 0.65 at listing, 1.00 at 90 days, 1.15 at 3 years, easing back to 1.00 after.'),
        el('li', {}, 'Breadth: +4% per extra chain, up to 5 extra chains.')),
      el('h3', {}, 'Category multiples this snapshot calibrates'),
      el('table', { class: 'mini' }, el('thead', {}, el('tr', {}, el('th', {}, 'Category'), el('th', {}, 'Multiple'))), el('tbody', {}, multRows))));
    var liveRows = DATA.live.slice(0, 12).map(function (p) {
      return el('tr', {}, el('td', {}, p.name), el('td', { class: 'num' }, fmtUsd(p.mcap_usd)), el('td', { class: 'num' }, p.mcap_tvl === null ? 'n/a' : p.mcap_tvl.toFixed(2)));
    });
    sections.appendChild(el('div', { class: 'card' },
      el('h2', {}, 'Live tokens, kept apart'),
      el('p', {}, 'These protocols already trade, so the board never ranks them by a model: the market has already priced them. They are the calibration set the category multiples above come from.'),
      el('table', { class: 'mini' }, el('thead', {}, el('tr', {}, el('th', {}, 'Protocol'), el('th', {}, 'Market cap'), el('th', {}, 'Mcap / TVL'))), el('tbody', {}, liveRows)),
      el('p', {}, 'Showing the top 12 of ' + DATA.live_size + ' live-token protocols by market cap.')));
    shell.appendChild(sections);
    shell.appendChild(el('div', { class: 'foot' },
      el('p', {}, 'Source: ' + DATA.source + '. The snapshot is frozen; re-running the program on it writes the same board.'),
      el('p', {}, 'Implied value is this entry\u2019s own claim, never a promise: it asks what a token would be worth if the protocol\u2019s record stayed as it is. It does not predict whether or when a token is issued.'),
      el('p', {}, 'Farming costs real money and real risk. Use a fresh wallet, keep positions small, and never pay to claim.')));

    var detail = el('div', { class: 'detail', id: 'detail', hidden: true });
    shell.appendChild(detail);
    renderTable();
    renderDetail();
    function renderTable() { renderTableInto(tableHost, live); }
  }

  var hashRead = false;
  function readHashOnce() { if (!hashRead) { hashRead = true; readHash(); } }

  function renderTableInto(host, live) {
    var list = sorted(filtered());
    var count = document.getElementById('count');
    host.innerHTML = '';
    if (live) {
      var lt = el('table', {},
        el('thead', {}, el('tr', {}, el('th', {}, 'Protocol'), el('th', {}, 'Category'), el('th', {}, 'TVL'), el('th', {}, 'Market cap'), el('th', {}, 'Mcap / TVL'), el('th', {}, '7d'))),
        el('tbody', {}, DATA.live.map(function (p) {
          return el('tr', { style: 'cursor:default' },
            el('td', {}, el('span', { class: 'name' }, el('b', {}, p.name), el('span', { class: 'sub' }, (p.chains || []).slice(0, 3).join(', ')))),
            el('td', {}, p.category || 'Uncategorized'),
            el('td', { class: 'num' }, fmtUsd(p.tvl_usd)),
            el('td', { class: 'num' }, fmtUsd(p.mcap_usd)),
            el('td', { class: 'num' }, p.mcap_tvl === null ? 'n/a' : p.mcap_tvl.toFixed(2)),
            el('td', { class: 'num ' + (p.change_7d === null ? '' : p.change_7d >= 0 ? 'pos' : 'neg') }, fmtPct(p.change_7d)));
        })));
      host.appendChild(lt);
      if (count) count.textContent = DATA.live_size + ' live-token protocols';
      return;
    }
    if (list.length === 0) {
      host.appendChild(el('div', { class: 'empty' }, el('h2', {}, 'No protocol matches'), el('p', {}, 'Loosen the search or clear a filter.'), el('button', { class: 'button primary', type: 'button', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; writeHash(); render(); } }, 'Clear filters')));
      if (count) count.textContent = '0 of ' + DATA.rows.length + ' rows';
      return;
    }
    var head = el('thead', {}, el('tr', {},
      el('th', {}, sortButton('#', 'implied')),
      el('th', {}, sortButton('Protocol', 'name')),
      el('th', {}, sortButton('TVL', 'tvl')),
      el('th', {}, sortButton('7d', 'growth')),
      el('th', {}, sortButton('Age', 'age')),
      el('th', {}, sortButton('Implied value', 'implied')),
      el('th', {}, 'Cat. mult.')));
    var body = el('tbody', {}, list.map(rowEl));
    host.appendChild(el('table', {}, head, body));
    if (count) count.textContent = list.length + ' of ' + DATA.rows.length + ' rows';
  }

  render();
})();
