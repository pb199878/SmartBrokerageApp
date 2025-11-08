#!/bin/bash

# Test APS Parser via API endpoint
# Usage: ./test-aps-parse.sh "path/to/form.pdf"

if [ -z "$1" ]; then
  echo "Usage: ./test-aps-parse.sh <path-to-pdf>"
  echo ""
  echo "Example:"
  echo "  ./test-aps-parse.sh \"OREA APS Form copy 2.pdf\""
  exit 1
fi

PDF_PATH="$1"
API_URL="${API_URL:-http://localhost:3000}"

if [ ! -f "$PDF_PATH" ]; then
  echo "❌ File not found: $PDF_PATH"
  exit 1
fi

echo "🧪 Testing APS Parser"
echo "📄 PDF: $PDF_PATH"
echo "🌐 API: $API_URL"
echo ""
echo "📤 Uploading PDF..."
echo ""

# Upload PDF and parse
curl -X POST "$API_URL/documents/test-parse" \
  -F "pdf=@$PDF_PATH" \
  -H "Accept: application/json" \
  | jq '.' > "${PDF_PATH%.pdf}-parsed.json"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Parse complete!"
  echo "💾 Full result saved to: ${PDF_PATH%.pdf}-parsed.json"
  echo ""
  echo "Quick Summary:"
  jq -r '
    "Strategy: \(.data.strategyUsed // "N/A")",
    "Confidence: \((.data.docConfidence // 0) * 100 | floor)%",
    "Buyers: \(.data.parties.buyers | length)",
    "Sellers: \(.data.parties.sellers | length)",
    "Price: $\(.data.financials.price // "N/A")",
    "Signatures: \(.data.signatures | length)"
  ' "${PDF_PATH%.pdf}-parsed.json"
else
  echo ""
  echo "❌ Parse failed!"
  echo "Make sure the API server is running: cd packages/api && npm run dev"
fi

