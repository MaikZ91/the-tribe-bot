/* Redesign.AI Campaign-Seite (Basis: statischer Nachbau, Inhalte: MZ.9)
 * Vanilla-JS für: Scroll-Reveals, Header-Theme, Portfolio-Tabs,
 * WhatsApp-/Mail-CTAs, Newsletter-Hinweis und den URL-Analyse-Funnel. */
(function () {
  'use strict';

  var CONTACT_MAIL = 'maik.z@gmx.de';
  var WA_LINK = 'https://wa.me/4917645961547?text=' + encodeURIComponent('Hi Maik, ich will ein Redesign-Konzept für meine Seite.');
  var PROJECT_NAMES = ['Brotwerk Mühlenrath', 'Café Bar KANTE', 'Zahnatelier LUMEN', 'Kanzlei Morgenstern'];

  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Scroll-Reveals im Original-Stil ----------
     Headline-Zeilen mit Wipe-Overlays: der Akzentbalken fegt über die
     Zeile, der Text erscheint dahinter. Hero-Wörter schieben gestaffelt
     hoch. Rest blendet klassisch ein. ---------- */
  function wipeOverlays(line) {
    var p = line.parentElement;
    if (!p) return [];
    return Array.prototype.filter.call(
      p.querySelectorAll(':scope > span[aria-hidden="true"]'),
      function (o) { return (o.getAttribute('style') || '').indexOf('clip-path') >= 0; }
    );
  }

  function playWipe(line, overlays, delay) {
    if (REDUCED || !line.animate) {
      line.style.opacity = '1';
      overlays.forEach(function (o) { o.style.clipPath = 'inset(0 100% 0 0)'; });
      return;
    }
    setTimeout(function () {
      overlays.forEach(function (o, i) {
        o.animate(
          [{ clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 100%)' }],
          { duration: 850, delay: i * 70, easing: 'cubic-bezier(0.77,0,0.18,1)', fill: 'forwards' });
      });
      setTimeout(function () { line.style.opacity = '1'; }, 380);
    }, delay);
  }

  function setupReveals() {
    document.querySelectorAll('span.invisible[aria-label]').forEach(function (el) {
      el.classList.remove('invisible');
      var words = el.querySelectorAll('span[data-w]');
      if (REDUCED || !words.length || !words[0].animate) return;
      words.forEach(function (w, i) {
        w.animate(
          [{ opacity: 0, transform: 'translateY(0.7em)' }, { opacity: 1, transform: 'translateY(0)' }],
          { duration: 700, delay: 120 + i * 70, easing: 'cubic-bezier(0.22,0.61,0.36,1)', fill: 'backwards' });
      });
    });

    var hidden = Array.prototype.filter.call(
      document.querySelectorAll('[style*="opacity:0"]'),
      function (el) { return parseFloat(el.style.opacity) === 0; }
    );
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        io.unobserve(el);
        var ovl = wipeOverlays(el);
        if (ovl.length) {
          var head = el.closest('h1,h2,h3') || el.parentElement;
          var idx = parseInt(head.getAttribute('data-wipe-i') || '0', 10);
          head.setAttribute('data-wipe-i', String(idx + 1));
          playWipe(el, ovl, idx * 150);
          return;
        }
        el.style.transition = 'opacity 0.7s cubic-bezier(0.625,0.05,0,1), transform 0.7s cubic-bezier(0.625,0.05,0,1)';
        el.style.opacity = '1';
        if (el.style.transform) el.style.transform = 'none';
        if (el.style.filter) el.style.filter = 'none';
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    hidden.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Statement: Wörter füllen sich beim Scrollen ---------- */
  function setupScrollFill() {
    if (REDUCED) return;
    var target = null;
    document.querySelectorAll('section p').forEach(function (p) {
      if (!target && p.textContent.indexOf('spürt man') >= 0) target = p;
    });
    if (!target) return;
    function wrapWords(node) {
      var out = [];
      Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
        if (ch.nodeType === 3) {
          var frag = document.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach(function (tok) {
            if (/^\s*$/.test(tok)) { frag.appendChild(document.createTextNode(tok)); return; }
            var s = document.createElement('span');
            s.textContent = tok;
            s.style.opacity = '0.22';
            s.style.transition = 'opacity 0.3s ease';
            frag.appendChild(s); out.push(s);
          });
          node.replaceChild(frag, ch);
        } else if (ch.nodeType === 1 && ch.getAttribute('aria-hidden') !== 'true') {
          out = out.concat(wrapWords(ch));
        }
      });
      return out;
    }
    var words = wrapWords(target);
    if (!words.length) return;
    // Basis-Opacity der Original-Spans neutralisieren, Füllung übernimmt die Wort-Opacity
    target.style.opacity = '1';
    function upd() {
      var r = target.getBoundingClientRect();
      var prog = (innerHeight * 0.9 - r.top) / (innerHeight * 0.8);
      prog = Math.min(Math.max(prog, 0), 1);
      var n = Math.round(prog * words.length);
      for (var i = 0; i < words.length; i++) words[i].style.opacity = i < n ? '1' : '0.22';
    }
    addEventListener('scroll', function () { requestAnimationFrame(upd); }, { passive: true });
    upd();
  }

  /* ---------- Header-Theme (hell/dunkel je nach Sektion) ---------- */
  function setupNavTheme() {
    var header = document.querySelector('header');
    if (!header) return;
    var logo = header.querySelector('img[alt="Redesign.AI"]');
    var ctaSpan = header.querySelector('button span.relative.z-10');
    var sections = document.querySelectorAll('[data-nav-theme]');
    if (!sections.length) return;

    function apply(theme) {
      if (theme === 'light') {
        header.style.background = 'rgba(244,244,244,0.6)';
        header.style.borderColor = 'rgba(0,0,0,0.1)';
        if (logo) { logo.src = 'redesign-logo-dark.svg'; logo.srcset = ''; }
        if (ctaSpan) {
          ctaSpan.style.color = '#0a0a0a';
          ctaSpan.style.background = 'rgba(0,0,0,0.04)';
          ctaSpan.style.borderColor = 'rgba(0,0,0,0.2)';
        }
      } else {
        header.style.background = '';
        header.style.borderColor = '';
        if (logo) { logo.src = 'redesign-logo.svg'; logo.srcset = ''; }
        if (ctaSpan) { ctaSpan.style.color = ''; ctaSpan.style.background = ''; ctaSpan.style.borderColor = ''; }
      }
    }
    var current = null;
    function update() {
      var y = header.getBoundingClientRect().bottom - 1;
      var theme = 'dark';
      for (var i = 0; i < sections.length; i++) {
        var r = sections[i].getBoundingClientRect();
        if (r.top <= y && r.bottom >= y) { theme = sections[i].getAttribute('data-nav-theme'); break; }
      }
      if (theme !== current) { current = theme; apply(theme); }
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ---------- VSL im Hero: Klick startet Video mit Ton ---------- */
  function setupShowreel() {
    var v = document.getElementById('vsl');
    var btn = document.getElementById('vslPlay');
    if (!v || !btn) return;
    btn.addEventListener('click', function () {
      btn.style.transition = 'opacity 0.4s'; btn.style.opacity = '0';
      setTimeout(function () { btn.remove(); }, 450);
      v.controls = true; v.muted = false;
      var p = v.play(); if (p && p.catch) p.catch(function () { v.controls = true; });
    });
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (!e.isIntersecting && !v.paused) v.pause(); });
    }, { threshold: 0.15 }).observe(v);
  }

  /* ---------- Portfolio: Scroll-Videos in den Mockups + Tabs ---------- */
  var PROJECT_CLIPS = {
    'Brotwerk Mühlenrath': 'videos/work/clip-brotwerk.webm',
    'Café Bar KANTE': 'videos/work/clip-kante.webm',
    'Zahnatelier LUMEN': 'videos/work/clip-lumen.webm',
    'Kanzlei Morgenstern': 'videos/work/clip-morgenstern.webm'
  };

  function setupPortfolio() {
    var slides = {};
    PROJECT_NAMES.forEach(function (n) {
      var a = document.querySelector('a[aria-label="' + n + '"]');
      if (a) slides[n] = a;
      // Screen-Recording in die Bildschirmfläche des Mac-Mockups legen
      if (a && PROJECT_CLIPS[n]) {
        var screen = Array.prototype.find.call(a.querySelectorAll('div'), function (d) {
          return d.style && d.style.left && d.style.left.indexOf('%') >= 0 && d.style.height && d.style.height.indexOf('%') >= 0;
        });
        if (screen) {
          var v = document.createElement('video');
          v.src = PROJECT_CLIPS[n];
          v.muted = true; v.setAttribute('muted', '');
          v.loop = true; v.playsInline = true; v.setAttribute('playsinline', '');
          v.preload = 'metadata';
          v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top;';
          screen.appendChild(v);
          var vio = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
              if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
              else v.pause();
            });
          }, { threshold: 0.3 });
          vio.observe(a);
        }
      }
      document.querySelectorAll('button[aria-label="' + n + '"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (slides[n]) slides[n].scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
    });
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var name = en.target.getAttribute('aria-label');
        PROJECT_NAMES.forEach(function (n) {
          document.querySelectorAll('button[aria-label="' + n + '"]').forEach(function (btn) {
            var act = n === name;
            btn.setAttribute('aria-current', act ? 'true' : 'false');
            var prev = btn.querySelector('div');
            if (prev) prev.style.opacity = act ? '1' : '0.45';
          });
        });
      });
    }, { threshold: 0.55 });
    Object.keys(slides).forEach(function (k) { sio.observe(slides[k]); });
  }

  /* ---------- Horizontale Bild-Bänder wie beim Original:
     zwei Reihen wandern gegenläufig, gekoppelt an den Scroll-Fortschritt
     der Sektion durch den Viewport (kein Pinning). ---------- */
  function setupHScroll() {
    var sec = document.getElementById('showcase');
    var t1 = document.getElementById('strip1');
    var t2 = document.getElementById('strip2');
    if (!sec || !t1 || !t2) return;
    var ticking = false;
    function update() {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        var r = sec.getBoundingClientRect();
        var prog = (innerHeight - r.top) / (innerHeight + r.height);
        prog = Math.min(Math.max(prog, 0), 1);
        var s1 = t1.scrollWidth * 0.28;
        var s2 = t2.scrollWidth * 0.28;
        t1.style.transform = 'translateX(' + (-prog * s1).toFixed(1) + 'px)';
        t2.style.transform = 'translateX(' + (-s2 + prog * s2).toFixed(1) + 'px)';
        ticking = false;
      });
    }
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();
  }

  /* ---------- CTAs: Call buchen -> WhatsApp, Nachricht -> Mail ---------- */
  function setupCtas() {
    // Platzhalter-Links (href="#") aus dem Original-Footer/-Menü dürfen die
    // Seite nicht nach oben springen lassen — Klick wird geschluckt.
    document.addEventListener('click', function (ev) {
      var dead = ev.target.closest ? ev.target.closest('a[href="#"]') : null;
      if (dead) ev.preventDefault();
    });
    document.addEventListener('click', function (ev) {
      var msg = ev.target.closest ? ev.target.closest('button[aria-label="Nachricht senden"]') : null;
      if (msg) { window.location.href = 'mailto:' + CONTACT_MAIL + '?subject=' + encodeURIComponent('MZ.9 Redesign-Konzept'); return; }
      var el = ev.target.closest ? ev.target.closest('.calendly-popup-btn') : null;
      if (el) { ev.preventDefault(); window.open(WA_LINK, '_blank', 'noopener'); }
    });
  }

  /* ---------- Newsletter: statische Demo ---------- */
  function setupNewsletter() {
    document.querySelectorAll('form').forEach(function (f) {
      if (f.id === 'form') return; // Funnel hat eigenes Submit
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (f.querySelector('.replica-note')) return;
        var note = document.createElement('p');
        note.className = 'replica-note';
        note.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.4);margin-top:8px;';
        note.textContent = 'Newsletter folgt bald — schreib solange per WhatsApp.';
        f.appendChild(note);
      });
    });
  }

  /* ---------- URL-Analyse-Funnel (Hero) ---------- */
  function setupFunnel() {
    var form = document.getElementById('form');
    if (!form) return;
    var success = document.getElementById('success');
    var urlInput = document.getElementById('url');
    var brancheGroup = document.getElementById('brancheGroup');
    var industrySelect = document.getElementById('industry');
    var mUrl = document.getElementById('mUrl'), mBiz = document.getElementById('mBiz');
    var urlMode = document.getElementById('urlMode'), bizMode = document.getElementById('bizMode');
    var bizInput = document.getElementById('biz'), bizResults = document.getElementById('bizResults');
    var fName = document.getElementById('bizName'), fSite = document.getElementById('bizWebsite'), fAddr = document.getElementById('bizAddr');

    var industryMap = { arzt: 'Arzt / Praxis', anwalt: 'Anwalt / Kanzlei', coach: 'Coach / Berater', kreativ: 'Kreative / Designer', fotograf: 'Fotograf', gastro: 'Restaurant / Gastro', handwerk: 'Handwerk', business: 'Business / Agentur', other: 'Sonstiges' };

    var mode = 'url';
    function setMode(m) {
      mode = m;
      mUrl.classList.toggle('active', m === 'url');
      mBiz.classList.toggle('active', m === 'biz');
      mUrl.setAttribute('aria-selected', m === 'url');
      mBiz.setAttribute('aria-selected', m === 'biz');
      urlMode.classList.toggle('is-hidden', m !== 'url');
      bizMode.classList.toggle('is-hidden', m !== 'biz');
      closeAc(); syncBranche();
      if (m === 'biz') setTimeout(function () { bizInput.focus(); }, 30);
    }
    mUrl.addEventListener('click', function () { setMode('url'); });
    mBiz.addEventListener('click', function () { setMode('biz'); });

    function syncBranche() {
      var has = (mode === 'url') ? urlInput.value.trim().length > 0 : fName.value.trim().length > 0;
      if (has && brancheGroup.classList.contains('branche-hidden')) {
        brancheGroup.classList.remove('branche-hidden');
        brancheGroup.classList.add('field-in');
      } else if (!has) {
        brancheGroup.classList.add('branche-hidden');
        brancheGroup.classList.remove('field-in');
      }
    }
    urlInput.addEventListener('input', syncBranche);

    function esc(s) { return (s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function closeAc() { bizResults.classList.remove('open'); bizResults.innerHTML = ''; }

    var acTimer, acAbort;
    bizInput.addEventListener('input', function () {
      fName.value = ''; fSite.value = ''; fAddr.value = ''; syncBranche();
      var q = bizInput.value.trim();
      clearTimeout(acTimer);
      if (q.length < 3) { closeAc(); return; }
      bizResults.innerHTML = '<div class="ac-note">Suche…</div>'; bizResults.classList.add('open');
      acTimer = setTimeout(function () { runSearch(q); }, 350);
    });

    var BIZ_CLASSES = ['shop', 'office', 'craft', 'healthcare', 'tourism', 'leisure', 'club'];
    var BIZ_AMENITIES = ['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'ice_cream', 'food_court', 'pharmacy', 'doctors', 'clinic', 'dentist', 'veterinary', 'hospital', 'nursing_home', 'social_facility', 'bank', 'post_office', 'marketplace', 'car_rental', 'car_wash', 'fuel', 'cinema', 'theatre', 'nightclub', 'studio', 'events_venue', 'community_centre', 'coworking_space', 'driving_school', 'language_school', 'music_school', 'dancing_school', 'kindergarten', 'childcare', 'school', 'college', 'university', 'library'];
    function isBusiness(d) {
      var cls = d.category || d.class;
      if (BIZ_CLASSES.indexOf(cls) >= 0) return true;
      if (cls === 'amenity' && BIZ_AMENITIES.indexOf(d.type) >= 0) return true;
      return false;
    }
    function mapIndustry(cls, type) {
      if (cls === 'healthcare') return 'arzt';
      if (cls === 'amenity') {
        if (['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'ice_cream', 'food_court', 'nightclub'].indexOf(type) >= 0) return 'gastro';
        if (['doctors', 'clinic', 'dentist', 'pharmacy', 'veterinary', 'hospital', 'nursing_home', 'social_facility'].indexOf(type) >= 0) return 'arzt';
        return 'business';
      }
      if (cls === 'craft') return 'handwerk';
      if (cls === 'office') return (type === 'lawyer') ? 'anwalt' : 'business';
      if (cls === 'shop') {
        if (['bakery', 'butcher', 'confectionery', 'deli', 'pastry', 'greengrocer'].indexOf(type) >= 0) return 'gastro';
        if (type === 'photo') return 'fotograf';
        return 'business';
      }
      if (cls === 'tourism') return 'gastro';
      return 'business';
    }
    function shortAddr(s) {
      var p = (s || '').split(',').map(function (x) { return x.trim(); });
      if (p.length <= 3) return p.slice(1).join(', ');
      return [p[1], p[p.length - 3] || p[2]].filter(Boolean).join(', ');
    }
    function runSearch(q) {
      if (acAbort) acAbort.abort();
      acAbort = new AbortController();
      var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&namedetails=1&extratags=1&limit=20&accept-language=de&q=' + encodeURIComponent(q);
      fetch(url, { signal: acAbort.signal, headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var items = (data || []).filter(function (d) { return isBusiness(d) && d.namedetails && d.namedetails.name; })
            .map(function (d) {
              return { name: d.namedetails.name, address: shortAddr(d.display_name), website: (d.extratags && (d.extratags.website || d.extratags['contact:website'])) || '', kind: mapIndustry(d.category || d.class, d.type) };
            }).slice(0, 6);
          renderAc(items);
        })
        .catch(function (e) {
          if (e.name === 'AbortError') return;
          bizResults.innerHTML = '<div class="ac-note">Suche gerade nicht erreichbar — gib die Website-URL direkt ein.</div>';
          bizResults.classList.add('open');
        });
    }
    function renderAc(items) {
      if (!items.length) {
        bizResults.innerHTML = '<div class="ac-note">Keine Treffer — tippe Name + Ort, z. B. „Praxis Brandt Bielefeld“.</div>';
        bizResults.classList.add('open'); return;
      }
      bizResults.innerHTML = items.map(function (it, i) {
        return '<div class="ac-item" data-i="' + i + '"><span>📍</span><span><span class="nm">' + esc(it.name) + '</span><br><span class="ad">' + esc(it.address) + '</span></span></div>';
      }).join('');
      bizResults.classList.add('open');
      Array.prototype.forEach.call(bizResults.children, function (el) {
        var it = items[+el.getAttribute('data-i')];
        if (it) el.addEventListener('click', function () { pick(it); });
      });
    }
    function pick(it) {
      bizInput.value = it.name;
      fName.value = it.name; fSite.value = it.website || ''; fAddr.value = it.address || '';
      closeAc(); syncBranche();
      if (it.kind) {
        for (var i = 0; i < industrySelect.options.length; i++) {
          if (industrySelect.options[i].value === it.kind) { industrySelect.value = it.kind; break; }
        }
      }
    }
    document.addEventListener('click', function (e) { if (!bizMode.contains(e.target)) closeAc(); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var lines;
      if (mode === 'url') {
        var url = urlInput.value.trim();
        if (!url) { urlInput.focus(); return; }
        lines = 'URL: ' + url + '\n';
      } else {
        var name = fName.value.trim() || bizInput.value.trim();
        if (!name) { bizInput.focus(); return; }
        lines = 'Unternehmen: ' + name + '\nAdresse: ' + (fAddr.value || '—') + '\nWebsite: ' + (fSite.value || '(bitte aus Google/Maps übernehmen)') + '\n';
      }
      var subject = encodeURIComponent('MZ.9 Redesign-Konzept');
      var bodyTxt = encodeURIComponent('Hallo,\n\nhier sind meine Daten für das kostenlose Redesign-Konzept:\n\n' + lines + 'Branche: ' + (industryMap[industrySelect.value] || '—') + '\n\nBitte sende mir das Konzept zu.\n\nViele Grüße');
      setTimeout(function () {
        window.location.href = 'mailto:' + CONTACT_MAIL + '?subject=' + subject + '&body=' + bodyTxt;
        form.style.display = 'none';
        if (success) success.classList.add('active');
      }, 400);
    });

    /* Typewriter-Placeholder */
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var samples = ['https://deine-website.de', 'https://deine-praxis.de', 'https://deine-kanzlei.de', 'https://dein-restaurant.de', 'https://dein-studio.de'];
      var i = 0, pos = samples[0].length, deleting = true, paused = false;
      urlInput.addEventListener('focus', function () { paused = true; });
      urlInput.addEventListener('input', function () { paused = true; });
      (function tick() {
        if (paused) return;
        var word = samples[i];
        if (deleting) {
          pos--;
          if (pos <= 0) { deleting = false; i = (i + 1) % samples.length; }
        } else {
          pos++;
          if (pos >= word.length) {
            urlInput.setAttribute('placeholder', word);
            deleting = true;
            setTimeout(tick, 1800);
            return;
          }
        }
        urlInput.setAttribute('placeholder', samples[i].slice(0, pos) || ' ');
        setTimeout(tick, deleting ? 45 : 85);
      })();
    }
  }

  onReady(function () {
    setupReveals();
    setupScrollFill();
    setupNavTheme();
    setupShowreel();
    setupHScroll();
    setupPortfolio();
    setupCtas();
    setupNewsletter();
    setupFunnel();
  });
})();
