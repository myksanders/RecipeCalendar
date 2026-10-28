# Shared by install-launchd.sh and uninstall-launchd.sh. Source it; don't run it.
#
# launchd has a few "domains" a background service can live in. The normal one,
# gui/<uid>, only exists for a shell running in your logged-in desktop session;
# over SSH, a remote terminal or sudo it fails with
# "Bootstrap failed: 125: Domain does not support specified action".
# So we try gui/, then user/ (available in those cases too), then the old
# `launchctl load` command.

LABEL="nl.mealplan.server"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
UID_NUM="$(id -u)"

refuse_root() {
  if [ "$UID_NUM" -eq 0 ]; then
    echo "Please run this without sudo. The meal planner runs as your own user, not as root." >&2
    exit 1
  fi
}

service_loaded() {
  launchctl print "gui/$UID_NUM/$LABEL" >/dev/null 2>&1 ||
    launchctl print "user/$UID_NUM/$LABEL" >/dev/null 2>&1 ||
    launchctl list "$LABEL" >/dev/null 2>&1
}

# Stop and unload the service wherever it was loaded, and wait until it's gone.
unload_service() {
  launchctl bootout "gui/$UID_NUM/$LABEL" >/dev/null 2>&1 || true
  launchctl bootout "user/$UID_NUM/$LABEL" >/dev/null 2>&1 || true
  [ -f "$PLIST" ] && launchctl unload -w "$PLIST" >/dev/null 2>&1 || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    service_loaded || return 0
    sleep 0.5
  done
  return 0
}

# Load the plist, trying each domain in turn. Prints which one worked.
load_service() {
  local err
  if err="$(launchctl bootstrap "gui/$UID_NUM" "$PLIST" 2>&1)"; then
    LOADED_VIA="your desktop session"
    return 0
  fi
  echo "  (desktop session not available: ${err:-unknown error}; trying another way)"
  if launchctl bootstrap "user/$UID_NUM" "$PLIST" >/dev/null 2>&1; then
    LOADED_VIA="your user's background services"
    return 0
  fi
  if launchctl load -w "$PLIST" >/dev/null 2>&1 && service_loaded; then
    LOADED_VIA="launchctl load"
    return 0
  fi
  return 1
}
