/* Shared helpers for the free tools of @ai.made.in.bielefeld (no tracking, no network). */
(function (w) {
  'use strict';
  var K = {};
  K.$ = function (id) { return document.getElementById(id); };
  K.num = function (s) {
    s = String(s == null ? '' : s).trim();
    if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
    var v = parseFloat(s);
    return isNaN(v) ? 0 : v;
  };
  K.euro = function (v, digits) {
    return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR',
      minimumFractionDigits: digits == null ? 2 : digits, maximumFractionDigits: digits == null ? 2 : digits });
  };
  K.fmt = function (v, d) { return v.toLocaleString('de-DE', { maximumFractionDigits: d == null ? 1 : d }); };
  K.esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  };
  /* Animated count-up for the big result numbers. */
  K.countUp = function (el, to, render, ms) {
    var from = el._v || 0, t0 = performance.now(); ms = ms || 700;
    el._v = to;
    function tick(t) {
      var p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3);
      el.innerHTML = render(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  };
  K.toast = function (msg) {
    var t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 1600);
  };
  K.copy = function (text) {
    function done() { K.toast('Kopiert ✓'); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
      ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} ta.remove();
    }
  };
  K.whatsapp = function (text) { return 'https://wa.me/?text=' + encodeURIComponent(text); };
  K.download = function (name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  };
  K.store = {
    get: function (k, d) { try { var v = localStorage.getItem('aimib-' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('aimib-' + k, JSON.stringify(v)); } catch (e) {} }
  };
  /* Remember shared company fields (Firma, Ort …) across tools. */
  K.remember = function (ids) {
    var saved = K.store.get('firma', {});
    ids.forEach(function (id) {
      var el = K.$(id); if (!el) return;
      if (saved[id] && !el.value) el.value = saved[id];
      el.addEventListener('change', function () { saved[id] = el.value; K.store.set('firma', saved); });
    });
  };
  /* Footer with links to the other tools + CTA, rendered into #kit-footer. */
  K.TOOLS = [
    ['angebot', 'Angebot in 60 Sek.'], ['rechnung', 'Rechnung + Pflichtangaben'],
    ['stundensatz', 'Stundensatz-Rechner'], ['zeitfresser', 'Was kostet Routinearbeit?'],
    ['antworten', 'Antworten auf Anfragen'], ['termin', 'Terminbestätigung + Kalender'],
    ['mahnung', 'Zahlungserinnerung'], ['bewertungen', 'Google-Bewertungs-QR'],
    ['flaeche', 'Flächen & Material'], ['autoantwort', 'Abwesenheits-Antwort']
  ];
  K.footer = function (current, pitch) {
    var el = K.$('kit-footer'); if (!el) return;
    var links = K.TOOLS.filter(function (t) { return t[0] !== current; }).slice(0, 6)
      .map(function (t) { return '<a href="../' + t[0] + '/">' + t[1] + ' →</a>'; }).join('');
    el.innerHTML =
      '<div class="cta no-print"><b>Das ist die einfache Version.</b><p>' + pitch + '</p>' +
      '<a href="../../ki-automatisierung/?utm_source=tool&utm_medium=' + current + '">Kostenloser KI-Check · 2 Min.</a></div>' +
      '<div class="no-print"><h2 style="font-size:1rem;margin:24px 0 4px">Weitere kostenlose Tools</h2><div class="more">' + links + '</div>' +
      '<p style="text-align:center;margin-top:10px"><a href="../">Alle 10 Tools ansehen</a></p></div>' +
      '<footer class="no-print">Ein Tool von <a href="https://www.instagram.com/ai.made.in.bielefeld/">@ai.made.in.bielefeld</a> · ' +
      '<a href="../../impressum.html">Impressum</a> · <a href="../../datenschutz.html">Datenschutz</a><br>' +
      'Kostenlos, ohne Anmeldung – alle Eingaben bleiben in deinem Browser. Angaben ohne Gewähr.</footer>';
  };
  w.K = K;
})(window);
