#!/bin/bash

# Test Email Routing for Smart Brokerage App
# This script sends test emails to both listings to verify routing works correctly

echo "🧪 Testing Email Routing for Smart Brokerage App"
echo "================================================"
echo ""

API_URL="http://localhost:3000"

# Test data
SENDER_EMAIL="john.smith@remax.com"
SENDER_NAME="John Smith"

# Listing 1: Toronto
LISTING1_EMAIL="l-abc123@inbox.yourapp.ca"
LISTING1_SUBJECT="Showing Request - 123 Main Street"
LISTING1_BODY="Hi, I have a client interested in viewing your property at 123 Main Street, Toronto. Are you available this weekend?"

# Listing 2: Ottawa  
LISTING2_EMAIL="l-xyz789@inbox.yourapp.ca"
LISTING2_SUBJECT="Offer Inquiry - 456 Oak Avenue"
LISTING2_BODY="Hello, my client would like to submit an offer on 456 Oak Avenue, Ottawa. What is the best way to proceed?"

echo "📧 Test 1: Sending email to Listing 1 (Toronto)"
echo "To: $LISTING1_EMAIL"
echo "Subject: $LISTING1_SUBJECT"
echo ""

curl -X POST "$API_URL/webhooks/mailgun" \
  -H "Content-Type: application/json" \
  -d "{
    \"timestamp\": \"$(date +%s)\",
    \"token\": \"test-token\",
    \"signature\": \"test-signature\",
    \"sender\": \"$SENDER_EMAIL\",
    \"recipient\": \"$LISTING1_EMAIL\",
    \"subject\": \"$LISTING1_SUBJECT\",
    \"body-plain\": \"$LISTING1_BODY\",
    \"stripped-text\": \"$LISTING1_BODY\",
    \"Message-Id\": \"<test-$(date +%s)-listing1@remax.com>\",
    \"timestamp\": $(date +%s)
  }"

echo ""
echo ""
echo "📧 Test 2: Sending email to Listing 2 (Ottawa)"
echo "To: $LISTING2_EMAIL"
echo "Subject: $LISTING2_SUBJECT"
echo ""

curl -X POST "$API_URL/webhooks/mailgun" \
  -H "Content-Type: application/json" \
  -d "{
    \"timestamp\": \"$(date +%s)\",
    \"token\": \"test-token\",
    \"signature\": \"test-signature\",
    \"sender\": \"$SENDER_EMAIL\",
    \"recipient\": \"$LISTING2_EMAIL\",
    \"subject\": \"$LISTING2_SUBJECT\",
    \"body-plain\": \"$LISTING2_BODY\",
    \"stripped-text\": \"$LISTING2_BODY\",
    \"Message-Id\": \"<test-$(date +%s)-listing2@remax.com>\",
    \"timestamp\": $(date +%s)
  }"

echo ""
echo ""
echo "✅ Tests complete!"
echo ""
echo "📊 To verify the results:"
echo "  1. Check the API logs to see which listing IDs were used"
echo "  2. Run: curl http://localhost:3000/listings | jq"
echo "  3. Open Prisma Studio: npm run prisma:studio"
echo "  4. Check the threads table - you should see 2 threads with different listingIds"
echo ""

