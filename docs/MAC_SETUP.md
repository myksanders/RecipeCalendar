# Running the meal planner on a Mac (lid closed)

An idle Mac makes a good always-on home server. Intel or Apple Silicon both
work; you need **macOS 11 Big Sur or newer** for Node.js 22.13+.

## 1. Install Node.js

Download the **LTS** macOS installer from <https://nodejs.org> and run it. On
macOS 11/12 pick Node **22** LTS; on macOS 13.5+ Node 24 LTS is fine. Check in Terminal:

```bash
node -v
```

## 2. Put the app somewhere outside Desktop/Documents/Downloads

macOS blocks background services from those folders. Use your home folder:

```bash
git clone https://github.com/myksanders/ClaudExperiment.git ~/MealPlan
cd ~/MealPlan/meal-planner
```

(Until the app is merged into the main branch, add `-b claude/focused-thompson-mqdhyl`
to the `git clone` command.)

## 3. Try it

Double-click `start-meal-planner.command` in Finder (first time: right-click → Open).
It installs, builds and starts. When macOS asks whether **node** may accept incoming
network connections, click **Allow**. Open `http://localhost:3000` to check, then
close the Terminal window to stop it.

## 4. Run it in the background, always

```bash
~/MealPlan/meal-planner/scripts/macos/install-launchd.sh
```

This starts the planner now, at every login, and restarts it if it ever crashes.
It prints the address for the phones, e.g. `http://Your-MacBook-Pro.local:3000`.
iPhones find `.local` names by themselves on the same Wi-Fi, so no router setup is
needed. Logs go to `meal-planner/data/server.log`.

To stop and remove it: `scripts/macos/uninstall-launchd.sh` (your data stays).

## 5. Keep it awake with the lid closed

A MacBook sleeps when the lid closes, which takes the planner offline. To stop that
while it's your server:

```bash
sudo pmset -a disablesleep 1      # undo later with: sudo pmset -a disablesleep 0
```

Also:

- **Keep it on the charger.** If you're on macOS 13+, turn on *Optimized Battery
  Charging* (System Settings → Battery) so it doesn't sit at 100% for months.
- **Give it air.** A closed laptop cools less well; don't put it in a drawer or on
  fabric. This app uses almost no CPU, so it shouldn't get warm.
- **Turn on automatic login** (System Settings → Users & Groups → Automatically log
  in as…) so the planner comes back by itself after a power cut. Automatic login
  isn't available while FileVault is on; then you have to log in once after a
  restart. Also turn on *Start up automatically after a power failure* if your Mac
  shows that option (System Settings → Energy, on some models).
- **Wi-Fi with the lid closed** works with `disablesleep`; if the connection is
  flaky, a USB-Ethernet adapter is more reliable.

## 6. On the iPhones

Open Safari → `http://<your-mac>.local:3000` → Share → **Add to Home Screen**. The
app's **Settings** page has the Apple Calendar subscription and the Apple Notes
Shortcut steps, with the right addresses filled in.

## Updating

```bash
cd ~/MealPlan && git pull
meal-planner/scripts/macos/install-launchd.sh    # reinstalls, rebuilds and restarts
```

## Backups

Everything is in `meal-planner/data/` (the SQLite file and photos). Time Machine
covers it if you use it; otherwise copy that folder somewhere now and then.

## Troubleshooting

- **Phone can't connect**: same Wi-Fi? Check System Settings → Network → Firewall:
  node must be allowed. Try the Mac's IP address (System Settings → Wi-Fi → Details).
- **Stopped after closing the lid**: check `pmset -g | grep -i sleep` shows
  `SleepDisabled 1`.
- **Not running after a restart**: someone has to be logged in (see automatic login);
  check `data/server.log`.
