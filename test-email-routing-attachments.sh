#!/bin/bash

# Test Email Routing with Attachments for Smart Brokerage App
# This script tests attachment handling including filtering and edge cases

echo "🧪 Testing Email Routing with Attachments"
echo "==========================================="
echo ""

API_URL="http://localhost:3000"

# Test data
SENDER_EMAIL="john.smith@remax.com"
SENDER_NAME="John Smith"
LISTING1_EMAIL="l-abc123@inbox.yourapp.ca"

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: OREA Form (should be downloaded)
echo -e "${GREEN}📧 Test 1: Valid OREA Form PDF (SHOULD DOWNLOAD)${NC}"
echo "Expected: Download and store attachment"
echo ""

curl -X POST "$API_URL/webhooks/mailgun" \
  -H "Content-Type: application/json" \
  -d "{
    \"timestamp\": \"$(date +%s)\",
    \"token\": \"test-token\",
    \"signature\": \"test-signature\",
    \"sender\": \"$SENDER_EMAIL\",
    \"recipient\": \"$LISTING1_EMAIL\",
    \"subject\": \"Offer for 123 Main Street\",
    \"body-plain\": \"Please find attached our client's offer for your property.\",
    \"stripped-text\": \"Please find attached our client's offer for your property.\",
    \"Message-Id\": \"<test-$(date +%s)-offer@remax.com>\",
    \"timestamp\": $(date +%s),
    \"attachments\": [
      {
        \"filename\": \"APS_Form_100_123_Main_Street.pdf\",
        \"content-type\": \"application/pdf\",
        \"size\": 425000,
        \"url\": \"https://storage.mailgun.net/v3/domains/mg.yourapp.ca/messages/test-offer.pdf\"
      }
    ]
  }"

echo ""
echo ""

# Test 2: Signature image (should be filtered out)
echo -e "${YELLOW}📧 Test 2: Signature Image (SHOULD BE FILTERED)${NC}"
echo "Expected: Skip download, log filtering message"
echo ""

curl -X POST "$API_URL/webhooks/mailgun" \
  -H "Content-Type: application/json" \
  -d "{
    \"timestamp\": \"$(date +%s)\",
    \"token\": \"test-token\",
    \"signature\": \"test-signature\",
    \"sender\": \"$SENDER_EMAIL\",
    \"recipient\": \"$LISTING1_EMAIL\",
    \"subject\": \"Quick question\",
    \"body-plain\": \"Just following up on the property.\",
    \"stripped-text\": \"Just following up on the property.\",
    \"Message-Id\": \"<test-$(date +%s)-signature@remax.com>\",
    \"timestamp\": $(date +%s),
    \"attachments\": [
      {
        \"filename\": \"agent_signature.png\",
        \"content-type\": \"image/png\",
        \"size\": 15000,
        \"url\": \"https://storage.mailgun.net/v3/domains/mg.yourapp.ca/messages/signature.png\"
      }
    ]
  }"

echo ""
echo ""

# Test 3: Logo image (should be filtered out)
echo -e "${YELLOW}📧 Test 3: Company Logo (SHOULD BE FILTERED)${NC}"
echo "Expected: Skip download, log filtering message"
echo ""

curl -X POST "$API_URL/webhooks/mailgun" \
  -H "Content-Type: application/json" \
  -d "{
    \"timestamp\": \"$(date +%s)\",
    \"token\": \"test-token\",
    \"signature\": \"test-signature\",
    \"sender\": \"$SENDER_EMAIL\",
    \"recipient\": \"$LISTING1_EMAIL\",
    \"subject\": \"Property inquiry\",
    \"body-plain\": \"Interested in scheduling a viewing.\",
    \"stripped-text\": \"Interested in scheduling a viewing.\",
    \"Message-Id\": \"<test-$(date +%s)-logo@remax.com>\",
    \"timestamp\": $(date +%s),
    \"attachments\": [
      {
        \"filename\": \"company_logo.png\",
        \"content-type\": \"image/png\",
        \"size\": 22000,
        \"url\": \"https://storage.mailgun.net/v3/domains/mg.yourapp.ca/messages/logo.png\"
      }
    ]
  }"

echo ""
echo ""

# Test 4: Disclaimer file (should be filtered out)
echo -e "${YELLOW}📧 Test 4: Disclaimer Text File (SHOULD BE FILTERED)${NC}"
echo "Expected: Skip download, log filtering message"
echo ""

curl -X POST "$API_URL/webhooks/mailgun" \
  -H "Content-Type: application/json" \
  -d "{
    \"timestamp\": \"$(date +%s)\",
    \"token\": \"test-token\",
    \"signature\": \"test-signature\",
    \"sender\": \"$SENDER_EMAIL\",
    \"recipient\": \"$LISTING1_EMAIL\",
    \"subject\": \"Following up\",
    \"body-plain\": \"Any update on the offer?\",
    \"stripped-text\": \"Any update on the offer?\",
    \"Message-Id\": \"<test-$(date +%s)-disclaimer@remax.com>\",
    \"timestamp\": $(date +%s),
    \"attachments\": [
      {
        \"filename\": \"email_disclaimer.txt\",
        \"content-type\": \"text/plain\",
        \"size\": 8500,
        \"url\": \"https://storage.mailgun.net/v3/domains/mg.yourapp.ca/messages/disclaimer.txt\"
      }
    ]
  }"

echo ""
echo ""

# Test 5: Multiple attachments (mixed relevant and irrelevant)
echo -e "${GREEN}📧 Test 5: Multiple Attachments - Mixed (PARTIAL DOWNLOAD)${NC}"
echo "Expected: Download OREA form and schedule, skip signature and footer"
echo ""

curl -X POST "$API_URL/webhooks/mailgun" \
  -H "Content-Type: application/json" \
  -d "{
    \"timestamp\": \"$(date +%s)\",
    \"token\": \"test-token\",
    \"signature\": \"test-signature\",
    \"sender\": \"$SENDER_EMAIL\",
    \"recipient\": \"$LISTING1_EMAIL\",
    \"subject\": \"Offer Package - 123 Main Street\",
    \"body-plain\": \"Please find attached our complete offer package.\",
    \"stripped-text\": \"Please find attached our complete offer package.\",
    \"Message-Id\": \"<test-$(date +%s)-package@remax.com>\",
    \"timestamp\": $(date +%s),
    \"attachments\": [
      {
        \"filename\": \"APS_Form_100.pdf\",
        \"content-type\": \"application/pdf\",
        \"size\": 380000,
        \"url\": \"https://storage.mailgun.net/v3/domains/mg.yourapp.ca/messages/aps.pdf\"
      },
      {
        \"filename\": \"Schedule_A.pdf\",
        \"content-type\": \"application/pdf\",
        \"size\": 125000,
        \"url\": \"https://storage.mailgun.net/v3/domains/mg.yourapp.ca/messages/schedule.pdf\"
      },
      {
        \"filename\": \"buyer_signature.png\",
        \"content-type\": \"image/png\",
        \"size\": 18000,
        \"url\": \"https://storage.mailgun.net/v3/domains/mg.yourapp.ca/messages/buyer_sig.png\"
      },
      {
        \"filename\": \"email_footer.png\",
        \"content-type\": \"image/png\",
        \"size\": 12000,
        \"url\": \"https://storage.mailgun.net/v3/domains/mg.yourapp.ca/messages/footer.png\"
      }
    ]
  }"

echo ""
echo ""

# Test 6: Very small file (should be filtered out)
echo -e "${YELLOW}📧 Test 6: Very Small Non-PDF File (SHOULD BE FILTERED)${NC}"
echo "Expected: Skip download due to size < 10KB"
echo ""

curl -X POST "$API_URL/webhooks/mailgun" \
  -H "Content-Type: application/json" \
  -d "{
    \"timestamp\": \"$(date +%s)\",
    \"token\": \"test-token\",
    \"signature\": \"test-signature\",
    \"sender\": \"$SENDER_EMAIL\",
    \"recipient\": \"$LISTING1_EMAIL\",
    \"subject\": \"Quick note\",
    \"body-plain\": \"See attached note.\",
    \"stripped-text\": \"See attached note.\",
    \"Message-Id\": \"<test-$(date +%s)-small@remax.com>\",
    \"timestamp\": $(date +%s),
    \"attachments\": [
      {
        \"filename\": \"note.txt\",
        \"content-type\": \"text/plain\",
        \"size\": 3000,
        \"url\": \"https://storage.mailgun.net/v3/domains/mg.yourapp.ca/messages/note.txt\"
      }
    ]
  }"

echo ""
echo ""

# Test 7: Large PDF with priority keywords (should be downloaded and prioritized)
echo -e "${GREEN}📧 Test 7: Large PDF with Priority Keywords (HIGH PRIORITY DOWNLOAD)${NC}"
echo "Expected: Download and prioritize (offer + form keywords)"
echo ""

curl -X POST "$API_URL/webhooks/mailgun" \
  -H "Content-Type: application/json" \
  -d "{
    \"timestamp\": \"$(date +%s)\",
    \"token\": \"test-token\",
    \"signature\": \"test-signature\",
    \"sender\": \"$SENDER_EMAIL\",
    \"recipient\": \"$LISTING1_EMAIL\",
    \"subject\": \"Formal Offer Submission\",
    \"body-plain\": \"Our client is submitting a formal offer on your property.\",
    \"stripped-text\": \"Our client is submitting a formal offer on your property.\",
    \"Message-Id\": \"<test-$(date +%s)-formal@remax.com>\",
    \"timestamp\": $(date +%s),
    \"attachments\": [
      {
        \"filename\": \"Offer_Agreement_123_Main_St.pdf\",
        \"content-type\": \"application/pdf\",
        \"size\": 520000,
        \"url\": \"https://storage.mailgun.net/v3/domains/mg.yourapp.ca/messages/offer.pdf\"
      }
    ]
  }"

echo ""
echo ""

# Test 8: Edge Case - Missing content-type
echo -e "${RED}📧 Test 8: Edge Case - Missing Content-Type (SHOULD HANDLE GRACEFULLY)${NC}"
echo "Expected: Handle missing content-type, default to octet-stream"
echo ""

curl -X POST "$API_URL/webhooks/mailgun" \
  -H "Content-Type: application/json" \
  -d "{
    \"timestamp\": \"$(date +%s)\",
    \"token\": \"test-token\",
    \"signature\": \"test-signature\",
    \"sender\": \"$SENDER_EMAIL\",
    \"recipient\": \"$LISTING1_EMAIL\",
    \"subject\": \"Document attached\",
    \"body-plain\": \"Please review the attached document.\",
    \"stripped-text\": \"Please review the attached document.\",
    \"Message-Id\": \"<test-$(date +%s)-notype@remax.com>\",
    \"timestamp\": $(date +%s),
    \"attachments\": [
      {
        \"filename\": \"document.pdf\",
        \"size\": 150000,
        \"url\": \"https://storage.mailgun.net/v3/domains/mg.yourapp.ca/messages/doc.pdf\"
      }
    ]
  }"

echo ""
echo ""

# Test 9: Edge Case - Missing size
echo -e "${RED}📧 Test 9: Edge Case - Missing Size (SHOULD HANDLE GRACEFULLY)${NC}"
echo "Expected: Handle missing size, default to 0"
echo ""

curl -X POST "$API_URL/webhooks/mailgun" \
  -H "Content-Type: application/json" \
  -d "{
    \"timestamp\": \"$(date +%s)\",
    \"token\": \"test-token\",
    \"signature\": \"test-signature\",
    \"sender\": \"$SENDER_EMAIL\",
    \"recipient\": \"$LISTING1_EMAIL\",
    \"subject\": \"Amendment\",
    \"body-plain\": \"Amendment to the original offer.\",
    \"stripped-text\": \"Amendment to the original offer.\",
    \"Message-Id\": \"<test-$(date +%s)-nosize@remax.com>\",
    \"timestamp\": $(date +%s),
    \"attachments\": [
      {
        \"filename\": \"Amendment_Form_120.pdf\",
        \"content-type\": \"application/pdf\",
        \"url\": \"https://storage.mailgun.net/v3/domains/mg.yourapp.ca/messages/amendment.pdf\"
      }
    ]
  }"

echo ""
echo ""

# Test 10: Edge Case - Special characters in filename
echo -e "${RED}📧 Test 10: Edge Case - Special Characters in Filename (SHOULD SANITIZE)${NC}"
echo "Expected: Handle special characters gracefully"
echo ""

curl -X POST "$API_URL/webhooks/mailgun" \
  -H "Content-Type: application/json" \
  -d "{
    \"timestamp\": \"$(date +%s)\",
    \"token\": \"test-token\",
    \"signature\": \"test-signature\",
    \"sender\": \"$SENDER_EMAIL\",
    \"recipient\": \"$LISTING1_EMAIL\",
    \"subject\": \"Offer with special characters\",
    \"body-plain\": \"Offer document attached.\",
    \"stripped-text\": \"Offer document attached.\",
    \"Message-Id\": \"<test-$(date +%s)-special@remax.com>\",
    \"timestamp\": $(date +%s),
    \"attachments\": [
      {
        \"filename\": \"Offer - Client's Property (2024).pdf\",
        \"content-type\": \"application/pdf\",
        \"size\": 280000,
        \"url\": \"https://storage.mailgun.net/v3/domains/mg.yourapp.ca/messages/special.pdf\"
      }
    ]
  }"

echo ""
echo ""

# Test 11: Confidentiality notice (should be filtered)
echo -e "${YELLOW}📧 Test 11: Confidentiality Notice (SHOULD BE FILTERED)${NC}"
echo "Expected: Skip download due to confidentiality keyword"
echo ""

curl -X POST "$API_URL/webhooks/mailgun" \
  -H "Content-Type: application/json" \
  -d "{
    \"timestamp\": \"$(date +%s)\",
    \"token\": \"test-token\",
    \"signature\": \"test-signature\",
    \"sender\": \"$SENDER_EMAIL\",
    \"recipient\": \"$LISTING1_EMAIL\",
    \"subject\": \"Follow up\",
    \"body-plain\": \"Just checking in.\",
    \"stripped-text\": \"Just checking in.\",
    \"Message-Id\": \"<test-$(date +%s)-conf@remax.com>\",
    \"timestamp\": $(date +%s),
    \"attachments\": [
      {
        \"filename\": \"confidentiality_notice.pdf\",
        \"content-type\": \"application/pdf\",
        \"size\": 25000,
        \"url\": \"https://storage.mailgun.net/v3/domains/mg.yourapp.ca/messages/conf.pdf\"
      }
    ]
  }"

echo ""
echo ""

# Test 12: Icon image (should be filtered)
echo -e "${YELLOW}📧 Test 12: Icon Image (SHOULD BE FILTERED)${NC}"
echo "Expected: Skip download due to icon keyword"
echo ""

curl -X POST "$API_URL/webhooks/mailgun" \
  -H "Content-Type: application/json" \
  -d "{
    \"timestamp\": \"$(date +%s)\",
    \"token\": \"test-token\",
    \"signature\": \"test-signature\",
    \"sender\": \"$SENDER_EMAIL\",
    \"recipient\": \"$LISTING1_EMAIL\",
    \"subject\": \"Update\",
    \"body-plain\": \"Quick update.\",
    \"stripped-text\": \"Quick update.\",
    \"Message-Id\": \"<test-$(date +%s)-icon@remax.com>\",
    \"timestamp\": $(date +%s),
    \"attachments\": [
      {
        \"filename\": \"app_icon.png\",
        \"content-type\": \"image/png\",
        \"size\": 8000,
        \"url\": \"https://storage.mailgun.net/v3/domains/mg.yourapp.ca/messages/icon.png\"
      }
    ]
  }"

echo ""
echo ""

echo "✅ Attachment tests complete!"
echo ""
echo "📊 Expected Results Summary:"
echo "  ✓ Downloaded (7): APS forms, schedules, offers, amendments, large PDFs"
echo "  ✗ Filtered (5): Signatures, logos, disclaimers, icons, confidentiality notices"
echo ""
echo "🔍 To verify the results:"
echo "  1. Check API logs for filtering messages (⏭️ Skipping...)"
echo "  2. Check API logs for download confirmations (📎 Downloading... ✅ Uploaded...)"
echo "  3. Query attachments table:"
echo "     curl http://localhost:3000/threads | jq '.data[].messages[].attachments'"
echo "  4. Check Prisma Studio attachments table - should see ~7 attachments"
echo "  5. Verify Supabase Storage bucket has the downloaded files"
echo ""
echo "📝 Notes:"
echo "  - This test uses mock Mailgun URLs (won't actually download)"
echo "  - In production, Mailgun provides real download URLs"
echo "  - Filtering happens BEFORE any HTTP requests are made"
echo ""

