/* ============================================================
   THE TRIBE — Members' Journal · shared interactions
   Booking (PayPal.me + safe WhatsApp fallback), qty stepper,
   billing toggle, reveal, masthead, sticky CTA, tracking.
   ============================================================ */
(function(){
  "use strict";

  /* ---- BOOKING / PAYMENT CONFIG ----
     paypalUser  : PayPal.Me handle (paypal.me/HANDLE). Empty => buttons fall back
                   safely to the WhatsApp group (no dead links).
     customPayUrl: full custom checkout link (Stripe/PayPal button); takes priority.
     app         : link to the Tribe event app (liebefeld.lovable.app — "weiß, wo die besten Events laufen"). */
  var TRIBE = window.TRIBE = {
    whatsapp:    "https://chat.whatsapp.com/CTbK6Xi8QHRExmoXhkaqvL",
    app:         "https://liebefeld.lovable.app/",
    paypalUser:  "",
    customPayUrl:"",
    currency:    "EUR",
    monthly:     49,
    yearly:      490,  /* 2 months free */
    hidePrices:  true  /* set false to show all prices again */
  };
  if(TRIBE.hidePrices){
    document.documentElement.classList.add('hide-prices');
    var _sb=document.querySelector('#sticky a[data-cta="sticky-book"]');
    if(_sb && !/kostenlos/i.test(_sb.textContent)) _sb.textContent='Platz sichern';
  }
  function payUrl(amount){
    if(TRIBE.customPayUrl) return TRIBE.customPayUrl;
    if(TRIBE.paypalUser)   return 'https://www.paypal.com/paypalme/'+encodeURIComponent(TRIBE.paypalUser)+'/'+amount+TRIBE.currency;
    return TRIBE.whatsapp;
  }
  function method(){ return TRIBE.customPayUrl?'custom':(TRIBE.paypalUser?'paypal':'whatsapp_fallback'); }
  function cap(name,props){ try{ if(window.posthog) posthog.capture(name,props); }catch(e){} }
  function variant(){ return (document.body.getAttribute('data-variant')||'club'); }
  function open(url){ window.open(url,'_blank','noopener'); }

  /* ---- single-event "buchen" buttons (index/programme links) ---- */
  document.querySelectorAll('[data-book]').forEach(function(btn){
    btn.addEventListener('click',function(ev){
      ev.preventDefault(); ev.stopPropagation();
      var amount=parseInt(btn.getAttribute('data-amount'),10)||0,
          name=btn.getAttribute('data-book')||'Event';
      cap('premium_event_book_click',{event:name,amount:amount,method:method(),landing_variant:variant()});
      open(payUrl(amount));
    });
  });

  /* ---- event-page booking module (qty stepper + total) ---- */
  (function(){
    var mod=document.querySelector('[data-booking]'); if(!mod) return;
    var unit=parseInt(mod.getAttribute('data-amount'),10)||0,
        max=parseInt(mod.getAttribute('data-max'),10)||10,
        name=mod.getAttribute('data-book')||'Event',
        qty=1,
        free=unit<=0,
        qVal=mod.querySelector('.qval'),
        minus=mod.querySelector('[data-q="-"]'),
        plus=mod.querySelector('[data-q="+"]'),
        priceEl=mod.querySelector('[data-total]'),
        btn=mod.querySelector('[data-pay]'),
        label=mod.querySelector('[data-paylabel]'),
        usingPay=!!(TRIBE.customPayUrl||TRIBE.paypalUser);
    function render(){
      var total=unit*qty;
      if(qVal) qVal.textContent=qty;
      if(minus) minus.disabled=qty<=1;
      if(plus) plus.disabled=qty>=max;
      if(priceEl) priceEl.innerHTML = free ? 'Frei' : (total+'&nbsp;€');
      if(label) label.textContent = free ? 'Kostenlos dabei sein'
        : (TRIBE.hidePrices ? 'Platz sichern'
           : (usingPay?'Mit PayPal bezahlen · ':'Platz sichern · ')+total+' €');
    }
    if(minus) minus.addEventListener('click',function(){ if(qty>1){qty--;render();} });
    if(plus) plus.addEventListener('click',function(){ if(qty<max){qty++;render();} });
    if(btn) btn.addEventListener('click',function(ev){
      ev.preventDefault();
      var total=unit*qty;
      if(free){ cap('premium_event_book_click',{event:name,amount:0,method:'whatsapp_free',landing_variant:variant()}); open(TRIBE.whatsapp); return; }
      cap('premium_event_book_click',{event:name,amount:total,qty:qty,method:method(),landing_variant:variant()});
      open(payUrl(total));
    });
    render();
  })();

  /* ---- premium subscription (monthly / yearly toggle) ---- */
  (function(){
    var sub=document.querySelector('[data-subscribe]'); if(!sub) return;
    var billM=sub.querySelector('[data-bill="m"]'), billY=sub.querySelector('[data-bill="y"]'),
        amt=sub.querySelector('[data-amt]'), per=sub.querySelector('[data-per]'),
        sline=sub.querySelector('[data-psub]'), btn=sub.querySelector('[data-substart]'),
        label=sub.querySelector('[data-sublabel]'), note=sub.querySelector('[data-subnote]');
    var usingPay=!!(TRIBE.customPayUrl||TRIBE.paypalUser), mode='monthly';
    function render(){
      var y=mode==='yearly', price=y?TRIBE.yearly:TRIBE.monthly;
      if(billM) billM.setAttribute('aria-pressed',!y);
      if(billY) billY.setAttribute('aria-pressed',y);
      if(amt) amt.innerHTML=price+'&nbsp;€';
      if(per) per.textContent=y?'/ Jahr':'/ Monat';
      if(sline) sline.textContent = TRIBE.hidePrices
        ? 'Alle exklusiven Events inklusive. Monatlich kündbar.'
        : (y?('Ein Jahr All-Access — 2 Monate geschenkt (statt '+(TRIBE.monthly*12)+' €).')
            :'Alle exklusiven Events inklusive. Monatlich kündbar.');
      if(label) label.textContent = TRIBE.hidePrices ? 'Premium sichern'
        : (usingPay?'Premium holen · ':'Premium sichern · ')+price+(y?' €/Jahr':' €/Monat');
      if(note) note.innerHTML=y?'<b>Bestes Angebot.</b> Ein Jahr Premium · Bestätigung per WhatsApp.'
        :'<b>Monatlich kündbar.</b> Plätze werden persönlich per WhatsApp bestätigt.';
    }
    if(billM) billM.addEventListener('click',function(){mode='monthly';render();cap('premium_billing_toggle',{mode:mode});});
    if(billY) billY.addEventListener('click',function(){mode='yearly';render();cap('premium_billing_toggle',{mode:mode});});
    if(btn) btn.addEventListener('click',function(ev){
      ev.preventDefault();
      var price=mode==='yearly'?TRIBE.yearly:TRIBE.monthly;
      cap('premium_subscribe_click',{plan:mode,amount:price,method:method(),landing_variant:variant()});
      open(payUrl(price));
    });
    render();
  })();

  /* ---- reveal on scroll ---- */
  (function(){
    var els=document.querySelectorAll('.rise');
    if(!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in');});return;}
    var io=new IntersectionObserver(function(en){en.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target);}});},
      {threshold:.1,rootMargin:'0px 0px -8% 0px'});
    els.forEach(function(e){io.observe(e);});
  })();

  /* ---- masthead solidify + sticky CTA ---- */
  (function(){
    var mh=document.querySelector('.masthead'), sticky=document.getElementById('sticky'),
        anchor=document.querySelector('[data-sticky-until]');
    function onScroll(){
      var y=window.scrollY;
      if(mh) mh.classList.toggle('solid', y>24);
      if(sticky){
        var pastHero=y>window.innerHeight*0.7, hideNear=false;
        if(anchor){var r=anchor.getBoundingClientRect(); hideNear=r.top<window.innerHeight*0.95 && r.bottom>0;}
        sticky.classList.toggle('show', pastHero && !hideNear);
      }
    }
    addEventListener('scroll',onScroll,{passive:true}); onScroll();
  })();

  /* ---- count-up ---- */
  addEventListener('load',function(){
    document.querySelectorAll('[data-countup]').forEach(function(el){
      var tgt=parseInt(el.textContent,10)||0, st=Math.max(tgt-20,0); el.textContent=st;
      var t0=performance.now();
      (function f(now){var p=Math.min(1,(now-t0)/700),e=1-Math.pow(1-p,3);
        el.textContent=Math.round(st+(tgt-st)*e); if(p<1)requestAnimationFrame(f);})(t0);
    });
  });

  /* ---- CTA + dwell tracking (names match the main funnel) ---- */
  (function(){
    var clicked=false,t0=Date.now();
    document.querySelectorAll('a[data-cta]').forEach(function(a){
      a.addEventListener('click',function(){clicked=true;
        cap('whatsapp_cta_click',{cta_location:a.getAttribute('data-cta'),landing_variant:variant()});});
    });
    function bye(){cap('tribe_dwell',{dwell_ms:Date.now()-t0,reached_cta:clicked,landing_variant:variant()});}
    addEventListener('pagehide',bye);
    addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')bye();});
  })();
})();
