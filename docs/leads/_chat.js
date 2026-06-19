/* MZ.9 — wiederverwendbares scripted Chat-Widget (kein Backend, kein API-Key).
   Konfiguration pro Seite via window.MZ9CHAT vor dem Einbinden:
   window.MZ9CHAT = {
     mode:   "mz9" | "lead",          // mz9 = Website-Check-Funnel, lead = Business-Assistent (Demo)
     name:   "Café Knigge",           // Anzeigename
     accent: "#10b981",               // Akzentfarbe
     to:     "mzschach@googlemail.com",// Empfänger der Anfrage (MZ.9 / Maik)
     cta:    "#termin"                 // optional: Anker-Ziel für "Termin/Anfrage" (lead-Modus)
   };
*/
(function(){
  "use strict";
  var C = window.MZ9CHAT || {};
  var MODE = C.mode || "mz9";
  var NAME = C.name || "MZ.9";
  var ACCENT = C.accent || "#10b981";
  var TO = C.to || "mzschach@googlemail.com";
  var CTA = C.cta || "";
  var esc = function(s){return String(s).replace(/[&<>"]/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]);});};

  var css = ""
  + ".mz9c-btn{position:fixed;right:18px;bottom:18px;z-index:99998;width:60px;height:60px;border-radius:50%;border:0;cursor:pointer;"
  + "background:"+ACCENT+";color:#06150f;box-shadow:0 14px 34px -10px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;transition:transform .25s}"
  + ".mz9c-btn:hover{transform:translateY(-3px) scale(1.05)}"
  + ".mz9c-btn svg{width:27px;height:27px}"
  + ".mz9c-btn .dot{position:absolute;top:-3px;right:-3px;width:16px;height:16px;border-radius:50%;background:#FF5C5C;border:2px solid #fff;animation:mz9pulse 2s infinite}"
  + "@keyframes mz9pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.25)}}"
  + ".mz9c-panel{position:fixed;right:18px;bottom:88px;z-index:99999;width:min(380px,calc(100vw - 28px));height:min(560px,calc(100vh - 120px));"
  + "background:#0E1116;color:#E8ECF1;border:1px solid rgba(255,255,255,.12);border-radius:18px;overflow:hidden;display:none;flex-direction:column;"
  + "box-shadow:0 30px 80px -24px rgba(0,0,0,.7);font-family:Inter,system-ui,sans-serif}"
  + ".mz9c-panel.open{display:flex;animation:mz9in .28s cubic-bezier(.22,.61,.36,1)}"
  + "@keyframes mz9in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}"
  + ".mz9c-head{display:flex;align-items:center;gap:11px;padding:14px 16px;background:linear-gradient(120deg,"+ACCENT+"22,transparent);border-bottom:1px solid rgba(255,255,255,.1)}"
  + ".mz9c-av{width:38px;height:38px;border-radius:50%;background:"+ACCENT+";color:#06150f;display:flex;align-items:center;justify-content:center;font-weight:800;flex:none}"
  + ".mz9c-head b{font-size:14.5px;display:block} .mz9c-head span{font-size:11.5px;color:#8a93a0;display:flex;align-items:center;gap:6px}"
  + ".mz9c-head span i{width:7px;height:7px;border-radius:50%;background:"+ACCENT+";display:inline-block}"
  + ".mz9c-x{margin-left:auto;background:transparent;border:0;color:#8a93a0;font-size:20px;cursor:pointer;line-height:1}"
  + ".mz9c-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}"
  + ".mz9c-msg{max-width:84%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-break:break-word}"
  + ".mz9c-bot{align-self:flex-start;background:#1b212b;border-bottom-left-radius:4px}"
  + ".mz9c-user{align-self:flex-end;background:"+ACCENT+";color:#06150f;border-bottom-right-radius:4px;font-weight:500}"
  + ".mz9c-chips{display:flex;flex-wrap:wrap;gap:8px;padding:0 16px 12px}"
  + ".mz9c-chip{background:transparent;border:1px solid rgba(255,255,255,.18);color:#E8ECF1;border-radius:50px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;transition:.2s;font-family:inherit}"
  + ".mz9c-chip:hover{border-color:"+ACCENT+";color:"+ACCENT+"}"
  + ".mz9c-chip.go{background:"+ACCENT+";color:#06150f;border-color:transparent}"
  + ".mz9c-form{display:flex;gap:8px;padding:12px 14px;border-top:1px solid rgba(255,255,255,.1)}"
  + ".mz9c-form input{flex:1;background:#1b212b;border:1px solid rgba(255,255,255,.14);border-radius:10px;color:#E8ECF1;padding:11px 13px;font-size:14px;font-family:inherit;min-width:0}"
  + ".mz9c-form button{background:"+ACCENT+";color:#06150f;border:0;border-radius:10px;width:44px;cursor:pointer;font-size:18px;flex:none}"
  + ".mz9c-foot{text-align:center;font-size:10px;color:#586;padding:0 0 9px}"
  ;

  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var wrap = document.createElement("div");
  wrap.innerHTML = ""
  + '<button class="mz9c-btn" id="mz9cBtn" aria-label="Chat öffnen"><span class="dot"></span>'
  + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"/></svg></button>'
  + '<div class="mz9c-panel" id="mz9cPanel" role="dialog" aria-label="Chat">'
  + '  <div class="mz9c-head"><span class="mz9c-av">'+(MODE==="mz9"?"M9":esc(NAME.charAt(0)))+'</span>'
  + '    <div><b>'+(MODE==="mz9"?"MZ.9 Assistent":esc(NAME))+'</b><span><i></i>Antwortet meist sofort</span></div>'
  + '    <button class="mz9c-x" id="mz9cX" aria-label="Schließen">×</button></div>'
  + '  <div class="mz9c-body" id="mz9cBody"></div>'
  + '  <div class="mz9c-chips" id="mz9cChips"></div>'
  + '  <div class="mz9c-foot">Persönlich betreut · keine Bots, kein Spam</div>'
  + '</div>';
  document.body.appendChild(wrap);

  var panel=document.getElementById("mz9cPanel"), body=document.getElementById("mz9cBody"),
      chips=document.getElementById("mz9cChips"), btn=document.getElementById("mz9cBtn");
  var state={url:"", contact:""};

  function open(){ panel.classList.add("open"); btn.querySelector(".dot").style.display="none"; if(!body.children.length) start(); }
  function close(){ panel.classList.remove("open"); }
  btn.onclick=function(){ panel.classList.contains("open")?close():open(); };
  document.getElementById("mz9cX").onclick=close;

  function bot(t,delay){ setTimeout(function(){ add(t,"bot"); },delay||280); }
  function add(t,who){ var d=document.createElement("div"); d.className="mz9c-msg mz9c-"+who; d.innerHTML=t; body.appendChild(d); body.scrollTop=body.scrollHeight; return d; }
  function setChips(arr){ chips.innerHTML=""; (arr||[]).forEach(function(c){ var b=document.createElement("button"); b.className="mz9c-chip"+(c.go?" go":""); b.textContent=c.t; b.onclick=c.fn; chips.appendChild(b); }); }
  function clearChips(){ chips.innerHTML=""; }

  function mailLink(subject,bodyText){ return "mailto:"+encodeURIComponent(TO)+"?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(bodyText); }

  /* ---------- MZ.9 Website-Check-Funnel ---------- */
  function start(){
    if(MODE==="lead") return startLead();
    bot("Hi, ich bin der Assistent von <b>MZ.9</b> 👋");
    bot("Magst du wissen, was an eurer Website besser laufen könnte? Schick mir einfach eure Webadresse.",900);
    setTimeout(function(){ setChips([{t:"Webadresse posten",go:true,fn:askUrl},{t:"Was macht ihr?",fn:about}]); },1100);
  }
  function about(){ add("Was macht ihr?","user"); clearChips();
    bot("Wir gestalten Websites lokaler Betriebe komplett neu — modern, mobil, mit klaren Buchungs-/Anfrage-Wegen. Du bekommst vorab eine kostenlose Konzept-Vorschau.");
    setTimeout(function(){ setChips([{t:"Webadresse posten",go:true,fn:askUrl}]); },700);
  }
  function askUrl(){ clearChips();
    bot("Super — poste hier einfach eure Webadresse (z. B. www.deinbetrieb.de):");
    showForm("www.deinbetrieb.de", function(v){
      state.url=v; add(esc(v),"user");
      bot("Danke! Ich schaue mir das an — typische Hebel, die ich bei lokalen Seiten fast immer sehe:");
      bot("• Hero ohne klaren Call-to-Action\n• Keine Online-Buchung/-Anfrage\n• Google-Bewertungen nicht eingebunden\n• Nicht sauber mobil optimiert\n• Veraltetes Design / langsame Ladezeit",900);
      bot("Das Beste: Ich (Maik) baue euch daraus eine <b>komplett neue Seite</b> — kostenlos als unverbindliche Vorschau. Wenn sie gefällt, setzen wir sie gemeinsam um.",1900);
      setTimeout(function(){ setChips([{t:"Ja, kostenlose Neugestaltung",go:true,fn:askContact},{t:"Erstmal nur Infos",fn:justInfo}]); },2100);
    });
  }
  function justInfo(){ add("Erstmal nur Infos","user"); clearChips();
    bot("Alles gut! Schau dich gern um. Wenn du später eine kostenlose Vorschau willst, bin ich hier. 🙂");
  }
  function askContact(){ add("Ja, kostenlose Neugestaltung","user"); clearChips();
    bot("Klasse! Wie erreiche ich dich am besten? (E-Mail oder Telefon)");
    showForm("deine@email.de", function(v){
      state.contact=v; add(esc(v),"user");
      finish();
    });
  }
  function finish(){ clearChips();
    var subject="Kostenlose Neugestaltung — "+(state.url||"meine Website");
    var bodyText="Hallo Maik,\n\nich habe euren Website-Check genutzt und möchte gern eine kostenlose, komplette Neugestaltung als Vorschau.\n\nMeine Website: "+(state.url||"-")+"\nKontakt: "+(state.contact||"-")+"\n\nFreue mich auf deine Rückmeldung!\n";
    var href=mailLink(subject,bodyText);
    bot("Perfekt — ich hab alles. 🎉 Tipp den Button, dann ist deine Anfrage an Maik fertig vorbereitet — du musst nur noch auf Senden klicken.");
    setTimeout(function(){ setChips([{t:"✉ Anfrage an Maik öffnen",go:true,fn:function(){ window.location.href=href; }}]); },600);
    var a=add('Falls sich nichts öffnet: <a href="'+href+'" style="color:'+ACCENT+';font-weight:700">hier klicken</a> oder schreib direkt an <b>'+esc(TO)+'</b>.',"bot");
  }

  /* ---------- Lead-Demo Business-Assistent ---------- */
  function startLead(){
    bot("Hallo 👋 Willkommen bei <b>"+esc(NAME)+"</b>! Wie kann ich helfen?");
    setTimeout(function(){ setChips([
      {t:"Leistungen",fn:function(){ add("Leistungen","user"); bot("Einen Überblick unserer Leistungen findest du direkt auf der Seite — soll ich dich hinführen?"); setTimeout(function(){setChips([{t:"Zu den Leistungen",go:true,fn:function(){goTo("#leistungen");}},{t:"Termin/Anfrage",fn:leadCta}]);},600); }},
      {t:"Öffnungszeiten",fn:function(){ add("Öffnungszeiten","user"); bot("Unsere Öffnungszeiten &amp; Kontaktdaten stehen weiter unten im Bereich „Kontakt". Ich bring dich hin:"); setTimeout(function(){setChips([{t:"Zu Kontakt",go:true,fn:function(){goTo("#info");}}]);},600); }},
      {t:"Termin / Anfrage",fn:leadCta}
    ]); },800);
  }
  function leadCta(){ add("Termin / Anfrage","user"); clearChips();
    bot("Gern! Tipp hier — dann bringe ich dich direkt zur Anfrage:");
    setTimeout(function(){ setChips([{t:"Jetzt anfragen",go:true,fn:function(){ goTo(CTA||"#termin"); }}]); },500);
  }
  function goTo(sel){ var el=sel&&document.querySelector(sel); if(el){ close(); el.scrollIntoView({behavior:"smooth"}); } else { bot("Schau dazu gern direkt auf der Seite — oder ruf uns kurz an. 🙂"); } }

  /* ---------- shared input form ---------- */
  function showForm(ph,cb){
    var f=document.createElement("form"); f.className="mz9c-form";
    f.innerHTML='<input type="text" placeholder="'+esc(ph)+'" autocomplete="off"><button type="submit" aria-label="Senden">➤</button>';
    panel.insertBefore(f,chips);
    var inp=f.querySelector("input"); setTimeout(function(){inp.focus();},50);
    f.onsubmit=function(e){ e.preventDefault(); var v=inp.value.trim(); if(!v) return; f.remove(); cb(v); };
  }
})();
