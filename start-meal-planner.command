#!/bin/bash
# Double-click in Finder to start the meal planner. Leave the Terminal window open while you use it.
# To run it in the background at login instead, see docs/MAC_SETUP.md.
cd "$(dirname "$0")" || exit 1
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js is not installed. Get the LTS installer from https://nodejs.org"
  read -r -p "Press Enter to close."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Installing for the first time..."
  npm install || { read -r -p "Install failed. Press Enter to close."; exit 1; }
fi
if [ ! -f web/dist/index.html ]; then
  echo "Building the app..."
  npm run build || { read -r -p "Build failed. Press Enter to close."; exit 1; }
fi
exec npm start
