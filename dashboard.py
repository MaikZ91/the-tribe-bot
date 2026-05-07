#!/usr/bin/env python3
"""THE TRIBE Bot – Desktop Dashboard"""

import json
import os
import subprocess
import sys
import threading
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import customtkinter as ctk
import matplotlib
matplotlib.use('TkAgg')
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg

ANALYTICS_FILE = Path(__file__).parent / '.community-dashboard.json'
BOT_SCRIPT = Path(__file__).parent / 'index.js'
GRAPH_DAYS = 21

META_AD_ACCOUNT_ID = 'act_336635908478667'
META_ACCESS_TOKEN = ''  # TODO: einfügen wenn vorhanden

ctk.set_appearance_mode('dark')
ctk.set_default_color_theme('blue')


def load_analytics() -> dict:
    try:
        with open(ANALYTICS_FILE, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


class TribeApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title('THE TRIBE Bot')
        self.geometry('1300x820')
        self.minsize(900, 600)

        self.bot_process: Optional[subprocess.Popen] = None
        self._stopping = False

        self._build_ui()
        self._refresh_stats()
        self._start_bot()
        self.after(30_000, self._periodic_refresh)
        self.protocol('WM_DELETE_WINDOW', self._on_close)

    # ── Layout ─────────────────────────────────────────────────────────────

    def _build_ui(self):
        self.grid_columnconfigure(0, weight=0)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=0)
        self.grid_rowconfigure(2, weight=0)

        self._build_sidebar()
        self._build_log_panel()
        self._build_button_bar()
        self._build_input_bar()

    def _build_sidebar(self):
        sidebar = ctk.CTkScrollableFrame(self, width=330, corner_radius=0)
        sidebar.grid(row=0, column=0, rowspan=3, sticky='nsew', padx=(8, 4), pady=8)
        sidebar.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            sidebar, text='THE TRIBE',
            font=ctk.CTkFont(size=24, weight='bold'),
        ).pack(pady=(10, 0))
        ctk.CTkLabel(
            sidebar, text='Community Dashboard',
            text_color='gray',
        ).pack(pady=(0, 14))

        # KPI cards
        kpi_box = ctk.CTkFrame(sidebar)
        kpi_box.pack(fill='x', padx=6, pady=4)
        self._kpi = {}
        for key, label in [
            ('members',   'Mitglieder'),
            ('active7d',  'Aktive Nutzer (7d)'),
            ('msgs7d',    'Nachrichten (7d)'),
            ('msgs30d',   'Nachrichten (30d)'),
            ('cta_today', '🌐 CTA-Klicks Heute'),
            ('cta_7d',    '🌐 CTA-Klicks 7d'),
            ('cta_conv',  '🌐 Conversion Rate'),
        ]:
            row = ctk.CTkFrame(kpi_box, fg_color='transparent')
            row.pack(fill='x', padx=10, pady=3)
            ctk.CTkLabel(
                row, text=label,
                text_color='gray', font=ctk.CTkFont(size=11),
            ).pack(side='left')
            val = ctk.CTkLabel(row, text='–', font=ctk.CTkFont(size=13, weight='bold'))
            val.pack(side='right')
            self._kpi[key] = val

        # Chart
        ctk.CTkLabel(
            sidebar, text='Mitglieder-Verlauf',
            font=ctk.CTkFont(size=13, weight='bold'),
        ).pack(pady=(14, 2))
        chart_frame = ctk.CTkFrame(sidebar, height=185)
        chart_frame.pack(fill='x', padx=6, pady=4)
        chart_frame.pack_propagate(False)
        self._setup_chart(chart_frame)

        # Groups
        ctk.CTkLabel(
            sidebar, text='Gruppen',
            font=ctk.CTkFont(size=13, weight='bold'),
        ).pack(pady=(14, 2))
        self._groups_box = ctk.CTkFrame(sidebar)
        self._groups_box.pack(fill='x', padx=6, pady=4)

        # Kennenlernabend
        ctk.CTkLabel(
            sidebar, text='Kennenlernabend',
            font=ctk.CTkFont(size=13, weight='bold'),
        ).pack(pady=(14, 2))
        self._att_label = ctk.CTkLabel(
            sidebar, text='Keine Daten',
            text_color='gray', wraplength=295,
        )
        self._att_label.pack(padx=10, pady=4)

        self._sync_label = ctk.CTkLabel(
            sidebar, text='Letzter Sync: –',
            text_color='#555555', font=ctk.CTkFont(size=10),
        )
        self._sync_label.pack(pady=(10, 6))

    def _build_log_panel(self):
        frame = ctk.CTkFrame(self)
        frame.grid(row=0, column=1, sticky='nsew', padx=(4, 8), pady=(8, 4))
        frame.grid_rowconfigure(1, weight=1)
        frame.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            frame, text='Bot Log',
            font=ctk.CTkFont(size=13, weight='bold'),
        ).grid(row=0, column=0, sticky='w', padx=10, pady=(6, 0))

        self._log_box = ctk.CTkTextbox(
            frame, state='disabled',
            font=ctk.CTkFont(family='Consolas', size=11),
        )
        self._log_box.grid(row=1, column=0, sticky='nsew', padx=6, pady=6)

    def _build_button_bar(self):
        frame = ctk.CTkFrame(self, height=50)
        frame.grid(row=1, column=1, sticky='ew', padx=(4, 8), pady=2)

        for label, cmd in [
            ('Highlights',    '/highlights'),
            ('Poll Mi',       '/poll-mittwoch'),
            ('Poll Fr',       '/poll-freitag'),
            ('Reminder So',   '/kennenlernabend-reminder'),
            ('Tuesday Run',   '/tuesday-run'),
            ('Jam Session',   '/jam-session'),
            ('Fussball Do',   '/thursday-football'),
            ('Ping Pong Do',  '/ping-pong'),
            ('Gruppen',       '/groups'),
        ]:
            ctk.CTkButton(
                frame, text=label, width=110, height=32,
                command=lambda c=cmd: self._send(c),
            ).pack(side='left', padx=4, pady=9)

    def _build_input_bar(self):
        frame = ctk.CTkFrame(self, height=50)
        frame.grid(row=2, column=1, sticky='ew', padx=(4, 8), pady=(2, 8))
        frame.grid_columnconfigure(0, weight=1)

        self._input_var = ctk.StringVar()
        entry = ctk.CTkEntry(
            frame,
            textvariable=self._input_var,
            placeholder_text='Nachricht oder /befehl eingeben…',
            font=ctk.CTkFont(family='Consolas', size=12),
        )
        entry.grid(row=0, column=0, sticky='ew', padx=(8, 4), pady=9)
        entry.bind('<Return>', self._on_enter)

        ctk.CTkButton(
            frame, text='Senden', width=90,
            command=self._on_enter,
        ).grid(row=0, column=1, padx=(0, 8), pady=9)

    # ── Chart ──────────────────────────────────────────────────────────────

    def _setup_chart(self, parent):
        self._fig, self._ax = plt.subplots(figsize=(3.3, 1.75))
        self._fig.patch.set_facecolor('#2b2b2b')
        self._ax.set_facecolor('#1e1e1e')
        self._ax.tick_params(colors='#888', labelsize=7)
        for sp in self._ax.spines.values():
            sp.set_edgecolor('#444')
        self._fig.tight_layout(pad=0.6)

        self._canvas = FigureCanvasTkAgg(self._fig, master=parent)
        self._canvas.get_tk_widget().pack(fill='both', expand=True)

    def _update_chart(self, analytics: dict):
        history = analytics.get('memberCountHistory', {})
        joins_list = analytics.get('communityJoins', [])

        today = datetime.utcnow()
        dates = [today - timedelta(days=GRAPH_DAYS - 1 - i) for i in range(GRAPH_DAYS)]
        keys  = [d.strftime('%Y-%m-%d') for d in dates]

        # Forward-fill member count for days without a snapshot
        values, last = [], 0
        for k in keys:
            if k in history:
                last = int(history[k])
            values.append(last)

        # Collect join days
        join_keys: set[str] = set()
        for j in joins_list:
            d = ''
            if isinstance(j, dict):
                d = j.get('date', j.get('joinedAt', ''))[:10]
            elif isinstance(j, str):
                d = j[:10]
            if d:
                join_keys.add(d)

        self._ax.clear()
        self._ax.set_facecolor('#1e1e1e')
        self._ax.tick_params(colors='#888', labelsize=7)
        for sp in self._ax.spines.values():
            sp.set_edgecolor('#444')

        if any(v > 0 for v in values):
            self._ax.plot(dates, values, color='#4fc3f7', linewidth=1.5)
            self._ax.fill_between(dates, values, alpha=0.15, color='#4fc3f7')

            jd = [d for d, k in zip(dates, keys) if k in join_keys]
            jv = [v for v, k in zip(values, keys) if k in join_keys]
            if jd:
                self._ax.scatter(jd, jv, color='#66bb6a', s=45, zorder=5,
                                  label='Neues Mitglied')
                self._ax.legend(
                    fontsize=6, facecolor='#2b2b2b',
                    labelcolor='#cccccc', loc='upper left',
                )
        else:
            self._ax.text(
                0.5, 0.5, 'Noch keine Daten\n(wird nach erstem Sync gefüllt)',
                ha='center', va='center', transform=self._ax.transAxes,
                color='#666', fontsize=8,
            )

        self._ax.xaxis.set_major_formatter(mdates.DateFormatter('%m-%d'))
        self._ax.xaxis.set_major_locator(mdates.WeekdayLocator(byweekday=0))
        self._fig.autofmt_xdate(rotation=30, ha='right')
        self._fig.tight_layout(pad=0.6)
        self._canvas.draw()

    # ── Stats refresh ───────────────────────────────────────────────────────

    def _refresh_stats(self):
        analytics = load_analytics()
        tracked = analytics.get('trackedChats', {})
        today = datetime.utcnow()

        main_chat = max(
            tracked.values(), key=lambda c: c.get('memberCount', 0), default={}
        )
        self._kpi['members'].configure(text=str(main_chat.get('memberCount', 0)))

        active_set: set[str] = set()
        msgs_7d = msgs_30d = 0
        for i in range(30):
            key = (today - timedelta(days=i)).strftime('%Y-%m-%d')
            v = analytics.get('messagesByDate', {}).get(key, 0)
            c = len(v) if isinstance(v, list) else int(v)
            msgs_30d += c
            if i < 7:
                msgs_7d += c
                for u in (analytics.get('activeUsersByDate', {}).get(key, []) or []):
                    if isinstance(u, str):
                        active_set.add(u)

        self._kpi['active7d'].configure(text=str(len(active_set)))
        self._kpi['msgs7d'].configure(text=str(msgs_7d))
        self._kpi['msgs30d'].configure(text=str(msgs_30d))

        # Website Analytics via lokalen Dashboard-API-Endpoint
        try:
            with urllib.request.urlopen('http://localhost:3000/api/dashboard', timeout=3) as r:
                api_data = json.loads(r.read())
            w = api_data.get('website', {})
            self._kpi['cta_today'].configure(text=str(w.get('ctaToday', '–')))
            self._kpi['cta_7d'].configure(text=str(w.get('cta7d', '–')))
            self._kpi['cta_conv'].configure(text=f"{w.get('conversionRate7d', 0)}%")
        except Exception:
            pass

        self._update_chart(analytics)

        # Groups list
        for w in self._groups_box.winfo_children():
            w.destroy()
        for chat in sorted(
            tracked.values(), key=lambda c: c.get('memberCount', 0), reverse=True
        ):
            row = ctk.CTkFrame(self._groups_box, fg_color='transparent')
            row.pack(fill='x', padx=10, pady=2)
            ctk.CTkLabel(
                row, text=chat.get('label', '?')[:22],
                font=ctk.CTkFont(size=11),
            ).pack(side='left')
            ctk.CTkLabel(
                row, text=str(chat.get('memberCount', 0)),
                font=ctk.CTkFont(size=11, weight='bold'),
            ).pack(side='right')

        # Attendance
        attendance = sorted(
            analytics.get('attendance', []),
            key=lambda a: str(a.get('weekKey', '')),
            reverse=True,
        )
        if attendance:
            a = attendance[0]
            self._att_label.configure(
                text=(
                    f"KW {a.get('weekKey','?')}: "
                    f"{a.get('participationRate', 0)}% "
                    f"({a.get('yesCount', 0)} Zusagen)\n"
                    f"Location: {a.get('venue', '–')}"
                )
            )

        sync_at = analytics.get('lastHistorySyncAt', '')
        try:
            dt = datetime.fromisoformat(sync_at.replace('Z', '+00:00'))
            self._sync_label.configure(
                text=f"Letzter Sync: {dt.strftime('%d.%m.%Y %H:%M')}"
            )
        except Exception:
            pass

    def _periodic_refresh(self):
        self._refresh_stats()
        self.after(30_000, self._periodic_refresh)

    # ── Bot subprocess ──────────────────────────────────────────────────────

    def _log(self, text: str):
        self._log_box.configure(state='normal')
        self._log_box.insert('end', text + '\n')
        self._log_box.see('end')
        self._log_box.configure(state='disabled')

    def _start_bot(self):
        try:
            self.bot_process = subprocess.Popen(
                ['node', str(BOT_SCRIPT)],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                cwd=str(BOT_SCRIPT.parent),
                text=True,
                bufsize=1,
                env={**os.environ, 'FORCE_COLOR': '0'},
            )
        except FileNotFoundError:
            self._log('Fehler: Node.js nicht gefunden. Bitte Node.js installieren.')
            return

        self._log('▶ Bot wird gestartet…')
        threading.Thread(target=self._read_output, daemon=True).start()

    def _read_output(self):
        for line in self.bot_process.stdout:
            if self._stopping:
                break
            line = line.rstrip()
            if line:
                self.after(0, self._log, line)
        if not self._stopping:
            self.after(0, self._log, '■ Bot-Prozess beendet.')

    def _send(self, cmd: str):
        self._log(f'▷ {cmd}')
        if self.bot_process and self.bot_process.poll() is None:
            try:
                self.bot_process.stdin.write(cmd + '\n')
                self.bot_process.stdin.flush()
            except Exception as e:
                self._log(f'Sendefehler: {e}')
        else:
            self._log('Bot läuft nicht.')

    def _on_enter(self, _event=None):
        text = self._input_var.get().strip()
        if text:
            self._send(text)
        self._input_var.set('')

    def _on_close(self):
        self._stopping = True
        if self.bot_process and self.bot_process.poll() is None:
            try:
                self.bot_process.stdin.write('/exit\n')
                self.bot_process.stdin.flush()
                self.bot_process.wait(timeout=3)
            except Exception:
                self.bot_process.terminate()
        self.destroy()


if __name__ == '__main__':
    if not BOT_SCRIPT.exists():
        print(f'Fehler: Bot-Skript nicht gefunden: {BOT_SCRIPT}')
        sys.exit(1)
    TribeApp().mainloop()
