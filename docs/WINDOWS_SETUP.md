# Running the meal planner on a Windows 11 PC

The PC acts as a small server on your home network. Phones on the same Wi-Fi
open it in Safari.

## 1. Install Node.js

Download the **LTS** installer from <https://nodejs.org> (version 22.13 or newer;
24 LTS is fine) and run it with the default options.

Check in PowerShell:

```powershell
node -v
```

## 2. Get the app

Clone or [download](https://github.com/myksanders/RecipeCalendar/archive/refs/heads/main.zip) this repository, e.g. to `C:\MealPlan`, then in PowerShell:

```powershell
cd C:\MealPlan
npm install
npm run build
npm start
```

The window prints the addresses, e.g.

```
Meal planner running.
  This computer:  http://localhost:3000
  On your Wi-Fi:  http://192.168.1.23:3000
```

(Or double-click `start-meal-planner.cmd`, which does all of the above.)

## 3. Allow it through the firewall

The first start may show a Windows Defender prompt — tick **Private networks**
and click Allow. If you missed it, run once in an **administrator** PowerShell:

```powershell
New-NetFirewallRule -DisplayName "Meal Planner" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
```

Make sure your home Wi-Fi/Ethernet is set to **Private** (Settings → Network &
internet → your connection → Network profile type → Private).

## 4. Give the PC a stable address

Phones need the same address every time. Either:

- use the PC's name: `http://<pc-name>:3000` (find it in Settings → System → About;
  works on most home routers), or
- reserve its IP in your router (often called "DHCP reservation" / "static lease").

## 5. Start automatically at login (optional)

Easiest: Task Scheduler.

1. Open **Task Scheduler** → *Create Task…*
2. General: name "Meal Planner", select *Run only when user is logged on*.
3. Triggers: *New… → At log on*.
4. Actions: *New… → Start a program* → Program: `C:\MealPlan\start-meal-planner.cmd`,
   Start in: `C:\MealPlan`.
5. Settings: untick *Stop the task if it runs longer than…*.

Prefer it to run even when nobody is logged in? Use [NSSM](https://nssm.cc):
`nssm install MealPlanner "C:\Program Files\nodejs\npm.cmd" start` with the app
folder as the startup directory.

Also turn off sleep while plugged in (Settings → System → Power) or the phones
can't reach it.

## 6. On the iPhones

1. Open Safari → `http://<pc-name>:3000` → Share → **Add to Home Screen**.
2. In the app, **Settings** has copy-paste steps for:
   - subscribing in Apple Calendar (`http://<pc-name>:3000/calendar.ics`), and
   - the **Apple Notes Shortcut** that puts the shopping list in your shared note.

## Updating

```powershell
cd C:\MealPlan
git pull
npm install
npm run build
```

Then restart it. Your data is untouched.

## Backups

Everything lives in `C:\MealPlan\data\` (the SQLite file and the photos).
Copy that folder somewhere safe — e.g. into OneDrive — every so often. Stop the
app first, or copy all three `meal-planner.sqlite*` files together.

## Troubleshooting

- **Phone can't connect** — same Wi-Fi? Firewall rule (step 3)? Network set to Private?
  Try the IP address instead of the PC name.
- **"Copy" doesn't work on the phone** — browsers only allow clipboard access on
  https or localhost; the app falls back to a box you can copy from. "Share…"
  always works.
- **Port 3000 is taken** — start with another port: in PowerShell `$env:PORT=3100; npm start`.
