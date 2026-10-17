import subprocess,time,requests,os
from playwright.sync_api import sync_playwright
srv=subprocess.Popen(['python3','-m','http.server','8790','-d','/home/user/the-tribe-bot/docs'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
C={}
def img(r):
    u=r.request.url
    try:
        if u not in C: C[u]=requests.get(u,headers={'User-Agent':'Mozilla/5.0 Chrome/130','Referer':'https://maikz91.github.io/'},timeout=15,verify='/root/.ccr/ca-bundle.crt')
        x=C[u];r.fulfill(status=x.status_code,body=x.content,headers={'content-type':x.headers.get('content-type','image/jpeg')})
    except Exception: r.abort()
O='reel/app3/';os.makedirs(O,exist_ok=True)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=3,timezone_id='Europe/Berlin',geolocation={'latitude':52.0281,'longitude':8.5226},permissions=['geolocation'])
    pg=ctx.new_page();pg.clock.install(time='2026-10-16T21:40:00+02:00')
    pg.route('https://raw.githubusercontent.com/**',lambda r:r.fulfill(path='ev_live.json',content_type='application/json'))
    pg.route(lambda u: u.startswith('http') and 'localhost' not in u and 'raw.githubusercontent' not in u, img)
    pg.add_init_script("try{localStorage.setItem('tribe_inst_x',Date.now()+9e9);localStorage.setItem('tribe_profile',JSON.stringify({name:'Maik',moods:['party','musik'],genres:['hiphop','techno'],vibe:'social',solo:true,created:Date.now()}))}catch(e){}")
    pg.goto('http://localhost:8790/tribe/');pg.wait_for_timeout(6000)
    # ticker frames
    for k in range(4):
        pg.clock.run_for(3300);pg.wait_for_timeout(500);pg.screenshot(path=O+f'tick{k}.png')
    # fy horizontal scroll frames
    for k in range(8):
        pg.evaluate(f"document.querySelector('.fyx').scrollLeft={k*55}");pg.wait_for_timeout(250);pg.screenshot(path=O+f'fy{k}.png')
    pg.evaluate("document.querySelector('.fyx').scrollLeft=0");pg.wait_for_timeout(200)
    pg.locator('.fyk [data-like]').nth(2).click();pg.wait_for_timeout(700);pg.screenshot(path=O+'liked.png')
    # full page for pan
    pg.screenshot(path=O+'full.png',full_page=True)
    # chat
    pg.click('#askGo');pg.wait_for_timeout(500);pg.fill('#chatIn','Wo kann ich heute tanzen?');pg.screenshot(path=O+'chat0.png');pg.press('#chatIn','Enter');pg.wait_for_timeout(1300);pg.screenshot(path=O+'chat1.png');pg.click('#chatX')
    # stadtpuls
    pg.click('nav [data-v=map]');pg.wait_for_timeout(4500)
    for k,v in enumerate([1170,1230,1290,1350,1410,1470,1530]):
        pg.fill('#slR',str(v));pg.dispatch_event('#slR','input');pg.wait_for_timeout(900);pg.screenshot(path=O+f'puls{k}.png')
    pg.click('#nmLoc');pg.wait_for_timeout(3000);pg.evaluate("document.querySelector('#nmPost').scrollIntoView({block:'center'})");pg.wait_for_timeout(600);pg.screenshot(path=O+'here.png')
    # tonight
    pg.click('nav [data-v=events]');pg.wait_for_timeout(600);pg.click('#ttOpen');pg.wait_for_timeout(900);pg.screenshot(path=O+'tt0.png');pg.click('[data-tt=start]');pg.wait_for_timeout(500);pg.screenshot(path=O+'tt1.png')
    pg.click('[data-tq="0"][data-tv=wild]');pg.click('[data-tq="1"][data-tv=crew]');pg.click('[data-tq="2"][data-tv=late]');pg.wait_for_timeout(1200);pg.screenshot(path=O+'tt2.png');pg.wait_for_timeout(2500);pg.screenshot(path=O+'tt3.png')
    b.close()
srv.terminate()
