#!/bin/bash
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/local/mysql/bin:$PATH"
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh"; fi
if [ ! -f .env ] || [ ! -d node_modules/mysql2 ]; then
  echo "Open Start-Tejasvi.command first to set up this app."
else
  npm run user:password
fi
echo "Press Return to close this window."
read -r
