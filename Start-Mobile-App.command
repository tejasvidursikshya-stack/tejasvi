#!/bin/bash
# Starts the Tejasvi mobile app for testing on an iPhone or Android phone.
# Start Tejasvi first with Start-Tejasvi.command (in this same folder).
cd "$(dirname "$0")/mobile" || { echo "The mobile folder is missing next to this file."; read -r _; exit 1; }

if ! command -v node >/dev/null 2>&1; then echo "Install Node.js 24 from nodejs.org, then open this file again."; read -r _; exit 1; fi

if ! curl -s -o /dev/null http://localhost:3000/api/mobile/v1/status; then
  echo "Tejasvi is not running yet. Double click Start-Tejasvi.command, wait for 'Tejasvi is ready', then open this file again."
  read -r _; exit 1
fi

if [ ! -d node_modules ]; then
  echo "First run: installing the app's packages. This takes a few minutes."
  npm install || { echo "Install failed. Check your internet connection and try again."; read -r _; exit 1; }
fi

node scripts/lan-bridge.mjs &
BRIDGE=$!
trap 'kill $BRIDGE 2>/dev/null' EXIT
sleep 1
echo ""
echo "On your iPhone: join the same Wi-Fi, scan the QR code below with the Camera, open in Expo Go,"
echo "and type the server address shown above (it ends in :3100). Press Control+C here to stop."
echo ""
npx expo start
