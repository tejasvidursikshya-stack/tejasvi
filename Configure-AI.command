#!/bin/bash
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/local/mysql/bin:$PATH"
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh"; fi
if [ ! -f .env ] || [ ! -d node_modules/dotenv ]; then
  echo "Use Configure-AI.command in the folder where Start-Tejasvi.command already runs. For a fresh installation, open Start-Tejasvi.command first."
  if [ -t 0 ]; then echo "Press Return to close."; IFS= read -r _; fi
  exit 1
fi
node scripts/configure-ai.mjs
status=$?
if [ -t 0 ]; then echo "Press Return to close."; IFS= read -r _; fi
exit "$status"
