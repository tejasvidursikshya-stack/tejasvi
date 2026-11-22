#!/bin/bash
set -u
cd "$(dirname "$0")" || exit 1
build_android() {
  if [ -z "${JAVA_HOME:-}" ] || [ ! -x "$JAVA_HOME/bin/javac" ]; then
    if [ -x "/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/javac" ]; then export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
    elif [ -x /usr/libexec/java_home ]; then export JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null)"; fi
  fi
  if [ -z "${JAVA_HOME:-}" ] || [ ! -x "$JAVA_HOME/bin/javac" ]; then echo "Install Android Studio or JDK 17, then run this file again."; return 1; fi
  export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
  if [ ! -d "$ANDROID_HOME/platforms/android-36" ]; then echo "In Android Studio -> SDK Manager, install Android SDK Platform 36 and Build-Tools 36.0.0."; return 1; fi
  echo "Building the native Tejasvi Android pilot. The first build downloads dependencies."
  (cd android && ./gradlew --no-daemon :app:assembleDebug) || return 1
  mkdir -p android/pilot || return 1
  cp android/app/build/outputs/apk/debug/app-debug.apk android/pilot/Tejasvi-Android-Pilot.apk || return 1
  echo "Built: android/pilot/Tejasvi-Android-Pilot.apk"
  echo "To install and connect it to your running Mac server, open Test-Android-USB.command."
}
build_android
status=$?
if [ -t 0 ]; then echo "Press Return to close."; IFS= read -r _; fi
exit "$status"
