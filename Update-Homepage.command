#!/bin/bash
# Compatibility with the previous release’s Mac instructions.
cd "$(dirname "$0")" || exit 1
exec bash ./Update-Tejasvi.command "$@"
