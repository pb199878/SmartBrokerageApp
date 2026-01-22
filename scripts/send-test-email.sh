#!/bin/bash
# Wrapper script for send-test-email.js
# Usage: ./scripts/send-test-email.sh [options] [pdf_file]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/send-test-email.js" "$@"
