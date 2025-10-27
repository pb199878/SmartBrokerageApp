#!/bin/bash
# Test Mailgun webhook with multipart/form-data (simulates email with attachments)
# This mimics how Mailgun actually sends webhooks in production

API_URL="${API_URL:-http://localhost:3000}"

echo "🧪 Testing Mailgun webhook with multipart/form-data"
echo "📍 API URL: $API_URL/webhooks/mailgun"
echo ""

# Create a multipart form-data payload similar to what Mailgun sends
# This simulates an email with an attachment
curl -X POST "$API_URL/webhooks/mailgun" \
  -H "Content-Type: multipart/form-data" \
  -F "sender=buyer@example.com" \
  -F "recipient=l-abc123@inbox.yourapp.ca" \
  -F "subject=Interested in viewing the property" \
  -F "body-plain=Hi, I'd like to schedule a viewing. Here's my pre-approval letter." \
  -F "stripped-text=Hi, I'd like to schedule a viewing. Here's my pre-approval letter." \
  -F "Message-Id=<20241027123456.1.ABC123@mail.example.com>" \
  -F "timestamp=1730000000" \
  -F 'attachments=[{"url": "https://example.com/attachment.pdf", "filename": "pre-approval.pdf", "content-type": "application/pdf", "size": 1024}]'

echo ""
echo ""
echo "✅ Request sent!"
echo "Check your API logs to see if the payload was received correctly"

