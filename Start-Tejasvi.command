#!/bin/bash
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/local/mysql/bin:$PATH"
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh"; fi
run_app() {
  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0])>=24?0:1)'; then
    echo "Install Node.js 24 or newer (with npm), reopen this launcher and keep MySQL 8 running."; return 1
  fi
  if [ ! -f node_modules/.tejasvi-installed ] || ! cmp -s package-lock.json node_modules/.tejasvi-installed; then
    echo "Installing this app's dependencies. Internet is needed on the first run."
    npm ci --include=dev --no-audit --no-fund || return 1
    cp package-lock.json node_modules/.tejasvi-installed || return 1
  fi
  npm start
}
run_app
status=$?
if [ "$status" -ne 0 ]; then
  if command -v brew >/dev/null 2>&1; then
    formula=$(brew list --formula 2>/dev/null | grep -E '^mysql(@[0-9.]+)?$' | head -1)
    if [ -n "$formula" ]; then echo "If MySQL is stopped, run: brew services start $formula"; fi
  fi
  echo "Read the message above. Press Return to close."
  read -r
fi
exit "$status"
