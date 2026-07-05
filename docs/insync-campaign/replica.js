/* Statische Campaign-Seite von Redesign.AI (Basis: Replik von www.in-sync.io/campaign/start)
 * Ersetzt die Next.js-Client-Interaktivität durch Vanilla-JS:
 * Scroll-Reveals, VSL-/Testimonial-/Team-Videos, Portfolio-Videos & -Tabs,
 * Testimonial-Slider, Scroll-to-Erstgespräch. */
(function () {
  'use strict';

  var TESTIMONIALS = [
    {
      quote: 'Unsere neue Webseite ist ein kompletter Gamechanger. Sie kann im Look mit den Seiten großer Megakonzerne mithalten - und das ist genau die Liga, mit der wir uns vergleichen wollen. Wenn ihr eine Designagentur sucht, die sich nicht wie eine klassische Agentur anfühlt, seid ihr bei Redesign.AI genau richtig.',
      name: 'Alex Kurze',
      role: 'Director of Innovation · FRAMEN GmbH',
      linkedin: 'https://www.linkedin.com/in/alexkurze/',
      poster: 'images/sanity/9f7733b40c066f78bd7305020abeac1f1bd97752-1200x900.jpg',
      posterAlt: 'Alex Kurze, Director of Innovation bei FRAMEN',
      video: 'videos/wistia/tnbkbvqf08.mp4'
    },
    {
      quote: 'Wir haben unsere Website komplett modernisieren lassen und sind begeistert vom Ergebnis. Die Zusammenarbeit mit Redesign.AI lief schnell, unkompliziert und zuverlässig - auch auf kleinere Änderungen wurde flexibel reagiert. Klare Weiterempfehlung.',
      name: 'Michael Sindlinger',
      role: 'CEO · Linetrack GmbH',
      linkedin: 'https://www.linkedin.com/in/michael-sindlinger-260615172/',
      poster: 'images/sanity/17b0ba46926dcae98ee121789db9a3a4643e1a45-1200x900.jpg',
      posterAlt: 'Michael Sindlinger, CEO der Linetrack GmbH',
      video: null
    },
    {
      quote: 'Die Zusammenarbeit mit Redesign.AI war ein wirklich entspanntes Miteinander - unkompliziert und verlässlich. Vom Entwurf bis zum Go-Live lief alles reibungslos, und das Ergebnis hat uns überzeugt. Wir setzen die Zusammenarbeit direkt mit dem nächsten Projekt fort.',
      name: 'Michael Reeder',
      role: 'Founder & CEO · Theraletik GmbH',
      linkedin: 'https://www.linkedin.com/in/michael-reeder-186705230/',
      poster: 'images/sanity/4166c6d8a8aa7acba94485fed72f988b52d0adce-1200x900.jpg',
      posterAlt: 'Michael Reeder, Founder & CEO der Theraletik GmbH',
      video: null
    },
    {
      quote: 'Ich bedanke mich vielmals beim ganzen Team von Redesign.AI für deren ausgezeichnete Arbeit! Unsere gesamte Unternehmensgruppe hat mit mehreren Websites, komplett unterschiedlicher Designs und Co. ein komplett neues Rebrand inkl. CMS-Verwaltung erhalten. Auf jeden Fall weiterzuempfehlen!',
      name: 'Christoffer Riefenstahl',
      role: 'Partner · X Capital Group',
      linkedin: 'https://www.linkedin.com/in/christoffer-riefenstahl-83a303173/',
      poster: 'images/sanity/8fc30c95c3cbae8b58aa1dcd75e77a5ce73513fa-1200x900.jpg',
      posterAlt: 'Christoffer Riefenstahl, Partner der X Capital Group',
      video: null
    },
    {
      quote: 'Redesign.AI ist für uns ein richtig starker Partner. Das Team liefert konstant hochwertige Arbeit - zuverlässig, pünktlich und immer im vereinbarten Budget. Die Kommunikation läuft reibungslos und ist durchweg professionell. Wir können Redesign.AI absolut weiterempfehlen.',
      name: 'Thomas Messerer',
      role: 'CEO · Silencio Network LLC',
      linkedin: 'https://www.linkedin.com/in/thomas-messerer-tmc/',
      poster: 'images/sanity/95e93c5eaf52f44d7b090b30efa818d7f4501de1-1200x900.jpg',
      posterAlt: 'Thomas Messerer, CEO der Silencio Network LLC',
      video: null
    },
    {
      quote: 'Mit dieser Website fühlt sich alles ein Stück stärker an. Schon irgendwie witzig … vorher war mir eine Website ehrlich gesagt ziemlich egal - bis ich dann eine hatte, die einfach so richtig gut ist.',
      name: 'Michael Conroy',
      role: 'President · Deliver Films Inc.',
      linkedin: null,
      poster: 'images/sanity/a7c474fad2f44481381ee582d3b4f366abfe2212-1200x900.jpg',
      posterAlt: 'Michael Conroy, President von Deliver Films Inc.',
      video: null
    },
    {
      quote: 'Die Zusammenarbeit mit Redesign.AI war von Anfang an super angenehm. Unser Ziel war eine moderne, benutzerfreundliche und optisch starke Website - und Redesign.AI hat unsere Erwartungen definitiv übertroffen. Vom ersten Gespräch bis zum Launch haben wir uns durchgehend gut aufgehoben gefühlt. Neben dem technischen Know-how merkt man einfach, dass hier auch viel Herzblut drinsteckt.',
      name: 'Justine Torka',
      role: 'Gründerin · MedicConnect',
      linkedin: 'https://www.linkedin.com/in/justine-torka/',
      poster: 'images/sanity/c42c7d90a0f3d04801f8259a848f40ef60033b60-1200x900.jpg',
      posterAlt: 'Justine Torka, Gründerin von MedicConnect',
      video: null
    }
  ];

  var PROJECTS = [
    { slug: 'framen', name: 'FRAMEN', video: 'videos/sanity/cf329bfba293f7bada16590d3b84bf636ece8736.mp4' },
    { slug: 'inventry', name: 'INVENTRY', video: 'videos/sanity/3c101645003fabe7dd9baf32a0234aff88c8fb09.mp4' },
    { slug: 'theraletik', name: 'Theraletik', video: 'videos/sanity/aac00ae37c983f252802bbd0f68cba439d7071b5.mp4' },
    { slug: 'soniq', name: 'SONIQ', video: 'videos/sanity/fd409016b7e3e015d5d95ba416e0bd4a1c55943a.mp4' }
  ];

  var CONTACT_MAIL = 'mzschach@googlemail.com';

  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* ---------- 1. Scroll-Reveals (ersetzt Framer-Motion-Eintrittsanimationen) ---------- */
  function setupReveals() {
    // Wort-für-Wort animierte Headlines: SSR-Zustand ist "invisible" — einblenden.
    document.querySelectorAll('span.invisible[aria-label]').forEach(function (el) {
      el.classList.remove('invisible');
    });

    var hidden = Array.prototype.filter.call(
      document.querySelectorAll('[style*="opacity:0"], [style*="opacity: 0"]'),
      function (el) { return parseFloat(el.style.opacity) === 0; }
    );
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.style.transition = 'opacity 0.7s cubic-bezier(0.625,0.05,0,1), transform 0.7s cubic-bezier(0.625,0.05,0,1)';
        el.style.opacity = '1';
        if (el.style.transform) el.style.transform = 'none';
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    hidden.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 2. Video-Helfer ---------- */
  function makeVideo(src, opts) {
    var v = document.createElement('video');
    v.src = src;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    if (opts.poster) v.poster = opts.poster;
    if (opts.controls) v.controls = true;
    if (opts.loop) v.loop = true;
    if (opts.muted) { v.muted = true; v.setAttribute('muted', ''); }
    if (opts.autoplay) v.autoplay = true;
    v.preload = opts.preload || 'metadata';
    v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;' + (opts.css || '');
    return v;
  }

  // play() mit Fallback: wenn Autoplay mit Ton blockiert wird, bleiben die
  // Controls sichtbar, sodass der Nutzer manuell starten kann.
  function safePlay(v) {
    var p = v.play();
    if (p && p.catch) p.catch(function () { v.controls = true; });
  }

  /* ---------- 3. VSL (Haupt-Video) ---------- */
  function setupVsl() {
    var btn = document.querySelector('button[aria-label="Video abspielen"]');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'position:absolute;inset:0;background:#000;';
      var v = makeVideo('videos/wistia/r6e4qrwvdw.mp4', {
        controls: true, autoplay: true, preload: 'auto',
        poster: 'images/campaign/vsl-poster.webp', css: 'object-fit:contain;'
      });
      wrap.appendChild(v);
      btn.replaceWith(wrap);
      safePlay(v);
    }, { once: true });
  }

  /* ---------- 4. Team-Video (Autoplay-Loop) ---------- */
  function setupTeamVideo() {
    var card = document.querySelector('[aria-label="Redesign.AI team"]');
    if (!card) return;
    var slot = card.querySelector('div.absolute.inset-0.size-full');
    if (!slot) slot = card.firstElementChild;
    var v = makeVideo('videos/team/team-0519.mp4', { muted: true, loop: true, autoplay: true, preload: 'auto' });
    slot.appendChild(v);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.isIntersecting ? v.play().catch(function () {}) : v.pause(); });
    }, { threshold: 0.15 });
    io.observe(card);
  }

  /* ---------- 5. Portfolio: Videos in den Mockups + Tab-Navigation ---------- */
  function setupPortfolio() {
    var slides = {};
    PROJECTS.forEach(function (p) {
      var a = document.querySelector('a[aria-label="' + p.name + '"]');
      if (!a) return;
      slides[p.name] = a;
      // Bildschirmfläche im Mac-Studio-Mockup: das absolut positionierte Overlay mit prozentualen Kanten
      var screen = Array.prototype.find.call(a.querySelectorAll('div'), function (d) {
        return d.style && d.style.left && d.style.left.indexOf('%') >= 0 && d.style.height && d.style.height.indexOf('%') >= 0;
      });
      var host = screen || a;
      var v = makeVideo(p.video, { muted: true, loop: true, preload: 'metadata' });
      host.appendChild(v);
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { e.isIntersecting ? v.play().catch(function () {}) : v.pause(); });
      }, { threshold: 0.3 });
      io.observe(a);
    });

    // Tabs (mobil sticky + Desktop): klick -> zum Projekt scrollen
    PROJECTS.forEach(function (p) {
      document.querySelectorAll('button[aria-label="' + p.name + '"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var target = slides[p.name];
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
    });

    // aria-current der Tabs dem sichtbaren Projekt nachführen
    var slideIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var name = e.target.getAttribute('aria-label');
        PROJECTS.forEach(function (p) {
          document.querySelectorAll('button[aria-label="' + p.name + '"]').forEach(function (btn) {
            var active = p.name === name;
            btn.setAttribute('aria-current', active ? 'true' : 'false');
            var prev = btn.querySelector('div');
            if (prev) prev.style.opacity = active ? '1' : '0.45';
          });
        });
      });
    }, { threshold: 0.55 });
    Object.keys(slides).forEach(function (k) { slideIO.observe(slides[k]); });
  }

  /* ---------- 6. Testimonial-Slider ---------- */
  function setupTestimonials() {
    var img = null;
    document.querySelectorAll('img').forEach(function (i) {
      if (!img && i.src.indexOf('9f7733b40c066f78bd7305020abeac1f1bd97752') >= 0) img = i;
    });
    var quoteEl = null;
    document.querySelectorAll('p').forEach(function (p) {
      if (!quoteEl && p.textContent.indexOf('kompletter Gamechanger') >= 0) quoteEl = p;
    });
    var playBtns = document.querySelectorAll('button[aria-label^="Video von"]');
    var prevBtns = document.querySelectorAll('button[aria-label="Vorheriges Testimonial"]');
    var nextBtns = document.querySelectorAll('button[aria-label="Nächstes Testimonial"]');
    if (!img || !quoteEl || !prevBtns.length || !nextBtns.length) return;

    var nameEls = [], roleEls = [], linkEls = [];
    document.querySelectorAll('p').forEach(function (p) {
      if (p.textContent.trim() === 'Alex Kurze') nameEls.push(p);
      if (p.textContent.trim() === 'Director of Innovation · FRAMEN GmbH') roleEls.push(p);
    });
    document.querySelectorAll('a[aria-label$="LinkedIn"]').forEach(function (a) { linkEls.push(a); });

    var mediaBox = img.parentElement; // div.absolute.inset-0 mit dem Poster
    var idx = 0, activeVideo = null;

    function render() {
      var t = TESTIMONIALS[idx];
      if (activeVideo) { activeVideo.remove(); activeVideo = null; img.style.visibility = ''; }
      img.src = t.poster || '';
      img.alt = t.posterAlt || t.name;
      quoteEl.textContent = '“' + t.quote + '”';
      nameEls.forEach(function (e) { e.textContent = t.name; });
      roleEls.forEach(function (e) { e.textContent = t.role; });
      linkEls.forEach(function (a) {
        if (t.linkedin) { a.href = t.linkedin; a.style.display = ''; a.setAttribute('aria-label', t.name + ' LinkedIn'); }
        else a.style.display = 'none';
      });
      playBtns.forEach(function (b) {
        b.style.display = t.video ? '' : 'none';
        b.setAttribute('aria-label', 'Video von ' + t.name + ' abspielen');
      });
    }

    prevBtns.forEach(function (b) {
      b.addEventListener('click', function () { idx = (idx - 1 + TESTIMONIALS.length) % TESTIMONIALS.length; render(); });
    });
    nextBtns.forEach(function (b) {
      b.addEventListener('click', function () { idx = (idx + 1) % TESTIMONIALS.length; render(); });
    });

    playBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var t = TESTIMONIALS[idx];
        if (!t.video || activeVideo) return;
        activeVideo = makeVideo(t.video, { controls: true, autoplay: true, preload: 'auto', poster: t.poster });
        activeVideo.style.zIndex = '15';
        mediaBox.parentElement.appendChild(activeVideo);
        safePlay(activeVideo);
      });
    });
  }

  /* ---------- 6b. Header-Theme (hell/dunkel je nach Sektion unter der Navbar) ---------- */
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

  /* ---------- 7. Call-buchen-Buttons: zum Erstgespräch-Bereich scrollen ---------- */
  function setupCalendly() {
    document.addEventListener('click', function (ev) {
      var el = ev.target.closest ? ev.target.closest('.calendly-popup-btn') : null;
      if (!el) return;
      ev.preventDefault();
      var target = document.getElementById('erstgespraech');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ---------- 8. Kleinkram: Nachricht senden, Newsletter, Cookie-Button ---------- */
  function setupMisc() {
    var msgBtn = document.querySelector('button[aria-label="Nachricht senden"]');
    if (msgBtn) msgBtn.addEventListener('click', function () {
      window.location.href = 'mailto:' + CONTACT_MAIL;
    });

    document.querySelectorAll('form').forEach(function (f) {
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var note = f.querySelector('.replica-note');
        if (!note) {
          note = document.createElement('p');
          note.className = 'replica-note';
          note.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.4);margin-top:8px;';
          note.textContent = 'Statische Kopie – Newsletter-Anmeldung ist hier deaktiviert.';
          f.appendChild(note);
        }
      });
    });
  }

  onReady(function () {
    setupReveals();
    setupVsl();
    setupTeamVideo();
    setupPortfolio();
    setupNavTheme();
    setupTestimonials();
    setupCalendly();
    setupMisc();
  });
})();
