#!/bin/bash
set -u
cd "$(dirname "$0")" || exit 1
run_test() {
  local adb_bin="" sdk_dir="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
  if [ -x "$sdk_dir/platform-tools/adb" ]; then adb_bin="$sdk_dir/platform-tools/adb"
  elif [ -x "$HOME/Downloads/platform-tools/adb" ]; then adb_bin="$HOME/Downloads/platform-tools/adb"
  elif command -v adb >/dev/null 2>&1; then adb_bin="$(command -v adb)"; fi
  if [ -z "$adb_bin" ]; then
    echo "Download SDK Platform-Tools for Mac from https://developer.android.com/tools/releases/platform-tools"
    echo "Unzip it in Downloads so Downloads/platform-tools/adb exists. Android Studio's Platform-Tools also work."
    echo "Then connect your Android phone with a USB data cable and reopen this file."
    return 1
  fi
  if ! curl --fail --silent --max-time 5 http://localhost:3000/api/mobile/v1/status | grep -q '"mobileApi":1'; then
    echo "First update your original Tejasvi folder to 3.10.0 and start it."
    echo "Keep its Terminal window open. Wait for: Tejasvi is ready: http://localhost:3000"
    return 1
  fi
  "$adb_bin" start-server || return 1
  local devices count serial apk
  devices=$("$adb_bin" devices) || return 1
  count=$(printf '%s\n' "$devices" | awk '$2=="device" {n++} END {print n+0}')
  if [ "$count" != 1 ]; then
    echo "Connect exactly ONE Android phone or emulator."
    echo "On the phone, enable Developer options -> USB debugging. Unlock it and accept Allow USB debugging."
    printf '%s\n' "$devices"
    return 1
  fi
  serial=$(printf '%s\n' "$devices" | awk '$2=="device" {print $1}')
  "$adb_bin" -s "$serial" reverse tcp:3000 tcp:3000 || return 1
  apk="android/pilot/Tejasvi-Android-Pilot.apk"
  if [ ! -f "$apk" ]; then echo "APK missing. Run Build-Android.command or use the APK from the complete 3.10.0 download."; return 1; fi
  "$adb_bin" -s "$serial" install -r "$apk" || { echo "Installation failed. Read the Android message above. No app was uninstalled."; return 1; }
  "$adb_bin" -s "$serial" shell am start -n com.tejasvi.campus.pilot/com.tejasvi.campus.MainActivity || return 1
  echo "Tejasvi Pilot is open. Server address: http://localhost:3000"
  echo "Use the SAME email and password as the website. Keep USB and Tejasvi connected."
  echo "After reconnecting the USB cable, run this helper again."
}
run_test
status=$?
if [ -t 0 ]; then echo "Press Return to close."; IFS= read -r _; fi
exit "$status"
