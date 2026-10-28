#!/bin/bash
# Stop the background meal planner and remove it from login. Your data is kept.
set -euo pipefail
# shellcheck source=launchd-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/launchd-lib.sh"
refuse_root
unload_service
rm -f "$PLIST"
echo "Meal planner stopped and removed from login. Data in the app's data/ folder is untouched."
