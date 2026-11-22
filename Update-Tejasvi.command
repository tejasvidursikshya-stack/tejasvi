#!/bin/bash
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/local/mysql/bin:$PATH"
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh"; fi
run_update() {
  if ! command -v node >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0])>=24?0:1)'; then echo "Install Node.js 24 or newer, then reopen the updater."; return 1; fi
  echo "Tejasvi Campus · Update an existing Campus installation."
  echo "Stop the running Campus window first (Control+C). Keep MySQL running."
  local target="$1"
  if [ -z "$target" ] && [ "$(uname -s)" = "Darwin" ] && command -v osascript >/dev/null 2>&1; then
    target=$(osascript -e 'POSIX path of (choose folder with prompt "Select your existing, configured Tejasvi-Campus folder (the one you normally run).")') || { echo "Update cancelled."; return 0; }
  elif [ -z "$target" ]; then
    echo "Enter the path to your configured Tejasvi-Campus folder:"
    IFS= read -r target
  fi
  [ -n "$target" ] || { echo "Update cancelled."; return 0; }
  node scripts/update-homepage.mjs "$target"
}
run_update "$1"
status=$?
if [ -t 0 ]; then echo "Press Return to close."; IFS= read -r _; fi
exit "$status"
