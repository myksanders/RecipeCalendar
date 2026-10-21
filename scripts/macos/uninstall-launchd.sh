#!/bin/bash
# Stop the background meal planner and remove it from login. Your data is kept.
LABEL="nl.mealplan.server"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
echo "Meal planner stopped and removed from login. Data in the app's data/ folder is untouched."
