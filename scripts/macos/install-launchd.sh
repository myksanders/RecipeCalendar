#!/bin/bash
# Run the meal planner in the background on macOS: starts at login, restarts if it crashes.
# Usage: ./scripts/macos/install-launchd.sh   (run again after updating to rebuild and restart)
set -euo pipefail

LABEL="nl.mealplan.server"
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
PORT="${PORT:-3000}"

NPM="$(command -v npm || true)"
NODE="$(command -v node || true)"
if [ -z "$NPM" ] || [ -z "$NODE" ]; then
  echo "Node.js is not installed. Get the LTS installer from https://nodejs.org" >&2
  exit 1
fi
NODE_MAJOR="$("$NODE" -p 'process.versions.node.split(".")[0]')"
NODE_MINOR="$("$NODE" -p 'process.versions.node.split(".")[1]')"
if [ "$NODE_MAJOR" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 13 ]; }; then
  echo "Node.js 22.13 or newer is needed (found $("$NODE" -v))." >&2
  exit 1
fi

# macOS privacy protection blocks background apps from Desktop, Documents and Downloads.
case "$APP_DIR" in
  "$HOME/Desktop"*|"$HOME/Documents"*|"$HOME/Downloads"*)
    echo "Move the app out of Desktop/Documents/Downloads first (e.g. to ~/MealPlan):" >&2
    echo "macOS won't let a background service read files there." >&2
    exit 1
    ;;
esac

cd "$APP_DIR"
echo "Installing dependencies and building..."
"$NPM" install --no-fund --no-audit
"$NPM" run build
mkdir -p "$APP_DIR/data"

xml() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }

mkdir -p "$(dirname "$PLIST")"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(xml "$NPM")</string>
    <string>start</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$(xml "$APP_DIR")</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$(xml "$(dirname "$NODE")"):/usr/local/bin:/usr/bin:/bin</string>
    <key>PORT</key>
    <string>$(xml "$PORT")</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>$(xml "$APP_DIR/data/server.log")</string>
  <key>StandardErrorPath</key>
  <string>$(xml "$APP_DIR/data/server.log")</string>
</dict>
</plist>
PLIST

if [ "${MEALPLAN_SKIP_LAUNCHCTL:-}" = "1" ]; then
  echo "Wrote $PLIST (not loaded)."
  exit 0
fi

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo
echo "Meal planner is running in the background and will start at every login."
echo "  On this Mac:    http://localhost:$PORT"
echo "  On your phones: http://$(scutil --get LocalHostName 2>/dev/null || hostname -s).local:$PORT"
echo "  Log file:       $APP_DIR/data/server.log"
