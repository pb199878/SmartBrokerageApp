#!/bin/bash

# Test Buyer Initials Detection
# Usage: ./test-initials.sh "path/to/form.pdf"

if [ -z "$1" ]; then
  echo "Usage: ./test-initials.sh <path-to-pdf>"
  echo ""
  echo "Example:"
  echo "  ./test-initials.sh \"OREA APS Form copy 2.pdf\""
  exit 1
fi

PDF_PATH="$1"
API_URL="${API_URL:-http://localhost:3000}"

if [ ! -f "$PDF_PATH" ]; then
  echo "❌ File not found: $PDF_PATH"
  exit 1
fi

echo "🧪 Testing Buyer Initials Detection"
echo "📄 PDF: $PDF_PATH"
echo "🌐 API: $API_URL"
echo ""
echo "📤 Checking for initials on pages 1, 2, 3, 4, 6..."
echo ""

# Call the dedicated initials test endpoint
curl -X POST "$API_URL/documents/test-initials" \
  -F "pdf=@$PDF_PATH" \
  -H "Accept: application/json" \
  | jq '{
      filename: .filename,
      summary: {
        all_found: .result.allInitialsPresent,
        total_found: "\(.result.totalInitialsFound)/\(.result.totalPagesChecked)",
        status: (if .result.allInitialsPresent then "✅ PASS" else "❌ FAIL" end)
      },
      pages: .details
    }'

echo ""
echo "💡 Tip: Check the server logs for detailed Gemini responses"
echo "    Look for 'Raw response:' lines to see what Gemini actually detected"

