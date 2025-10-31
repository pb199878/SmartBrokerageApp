#!/bin/bash

# OREA Form Validation Testing Script
# Tests DocuPipe integration, validation, and auto-rejection flows

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
LISTING_ALIAS="${LISTING_ALIAS:-l-abc123}"
LISTING_EMAIL="${LISTING_EMAIL:-${LISTING_ALIAS}@inbox.yourapp.ca}"

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   OREA Form Validation Testing Suite${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

# Function to print test header
print_test_header() {
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}TEST $1: $2${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Function to print info
print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check prerequisites
print_test_header "0" "Prerequisites Check"

# Check if API is running
if ! curl -s "${API_URL}/health" > /dev/null 2>&1; then
    print_error "API is not running at ${API_URL}"
    print_info "Start the API with: cd packages/api && npm run dev"
    exit 1
fi
print_success "API is running at ${API_URL}"

# Check if DocuPipe is configured
if [ -z "${DOCUPIPE_API_KEY}" ]; then
    print_error "DOCUPIPE_API_KEY is not set"
    print_info "Set it with: export DOCUPIPE_API_KEY=your_api_key"
    print_info "Note: Tests will still run but use basic extraction only"
else
    print_success "DOCUPIPE_API_KEY is configured"
fi

# Check if mailgun is configured
if [ -z "${MAILGUN_API_KEY}" ]; then
    print_info "MAILGUN_API_KEY is not set (rejection emails will be stubbed)"
else
    print_success "MAILGUN_API_KEY is configured"
fi

echo ""
echo -e "${GREEN}All prerequisites met!${NC}"
echo ""

# =============================================================================
# TEST 1: Valid OREA Form 100
# =============================================================================
print_test_header "1" "Valid OREA Form 100 (fully filled and signed)"

print_info "This test requires a valid OREA Form 100 PDF with:"
print_info "  - Buyer signature(s)"
print_info "  - Purchase price filled in"
print_info "  - All required fields completed"
print_info ""
print_info "To test manually:"
echo "  1. Prepare a valid signed OREA Form 100 PDF"
echo "  2. Email it to: ${LISTING_EMAIL}"
echo "  3. Check logs for: '✅ DocuPipe extraction complete. Validation: passed'"
echo "  4. Verify offer is created in database"
echo "  5. Check mobile app ApsReviewScreen shows extracted data"
print_info ""
print_info "Expected: Offer created successfully, validation passes"

# =============================================================================
# TEST 2: Missing Buyer Signature
# =============================================================================
print_test_header "2" "Invalid Form - Missing Buyer Signature"

print_info "This test requires an OREA Form 100 PDF WITHOUT buyer signature:"
print_info "  - Purchase price filled in"
print_info "  - All other fields completed"
print_info "  - BUT: No buyer signature"
print_info ""
print_info "To test manually:"
echo "  1. Prepare an unsigned OREA Form 100 PDF"
echo "  2. Email it to: ${LISTING_EMAIL}"
echo "  3. Check logs for: '❌ OREA Form validation failed'"
echo "  4. Check logs for: '❌ Offer validation failed. Auto-rejecting...'"
echo "  5. Verify buyer agent receives rejection email"
echo "  6. Verify NO offer is created in database"
print_info ""
print_info "Expected: Validation fails, rejection email sent, no offer created"

# =============================================================================
# TEST 3: Blank Purchase Price
# =============================================================================
print_test_header "3" "Invalid Form - Blank Purchase Price"

print_info "This test requires an OREA Form 100 PDF with blank purchase price:"
print_info "  - Buyer signature present"
print_info "  - All other fields completed"
print_info "  - BUT: Purchase price is blank or zero"
print_info ""
print_info "To test manually:"
echo "  1. Prepare a signed OREA Form 100 PDF with blank price"
echo "  2. Email it to: ${LISTING_EMAIL}"
echo "  3. Check logs for: 'Purchase price must be filled in and greater than zero'"
echo "  4. Verify buyer agent receives rejection email"
echo "  5. Verify NO offer is created"
print_info ""
print_info "Expected: Validation fails, rejection email sent, no offer created"

# =============================================================================
# TEST 4: Missing Deposit
# =============================================================================
print_test_header "4" "Invalid Form - Missing Deposit"

print_info "This test requires an OREA Form 100 PDF with missing deposit:"
print_info "  - Buyer signature present"
print_info "  - Purchase price filled in"
print_info "  - BUT: Deposit amount is blank"
print_info ""
print_info "To test manually:"
echo "  1. Prepare a signed OREA Form 100 PDF with blank deposit"
echo "  2. Email it to: ${LISTING_EMAIL}"
echo "  3. Check logs for: 'Deposit amount must be specified'"
echo "  4. Verify buyer agent receives rejection email"
print_info ""
print_info "Expected: Validation fails, rejection email sent"

# =============================================================================
# TEST 5: Missing Closing Date
# =============================================================================
print_test_header "5" "Invalid Form - Missing Closing Date"

print_info "This test requires an OREA Form 100 PDF with missing closing date:"
print_info "  - Buyer signature present"
print_info "  - Purchase price and deposit filled in"
print_info "  - BUT: Closing date is blank"
print_info ""
print_info "Expected: Validation fails, rejection email sent"

# =============================================================================
# TEST 6: Missing Buyer Name
# =============================================================================
print_test_header "6" "Invalid Form - Missing Buyer Name"

print_info "This test requires an OREA Form 100 PDF with missing buyer name:"
print_info "  - Buyer signature present (but name field blank)"
print_info "  - Purchase price and other fields filled in"
print_info "  - BUT: Buyer name field is blank"
print_info ""
print_info "Expected: Validation fails, rejection email sent"

# =============================================================================
# TEST 7: Data Extraction Verification
# =============================================================================
print_test_header "7" "Data Extraction Verification"

print_info "This test verifies comprehensive data extraction from DocuPipe:"
print_info ""
print_info "Fields that should be extracted:"
echo "  Financial:"
echo "    - Purchase Price"
echo "    - Deposit Amount"
echo "    - Deposit Timing (Herewith, Upon Acceptance, etc.)"
echo ""
echo "  Dates:"
echo "    - Closing Date"
echo "    - Irrevocability Date (offer expiry)"
echo "    - Possession Date"
echo ""
echo "  Buyer Info:"
echo "    - Buyer Name(s)"
echo "    - Buyer Address"
echo "    - Buyer Phone"
echo "    - Buyer Email"
echo ""
echo "  Buyer's Lawyer:"
echo "    - Lawyer Name"
echo "    - Lawyer Address"
echo "    - Lawyer Phone"
echo "    - Lawyer Email"
echo ""
echo "  Property & Terms:"
echo "    - Property Address"
echo "    - Inclusions (chattels)"
echo "    - Exclusions (fixtures)"
echo "    - Conditions (Schedule A)"
echo ""
echo "  Agent Info:"
echo "    - Buyer Agent Name"
echo "    - Buyer Brokerage Name"
echo ""
print_info "To test:"
echo "  1. Send a fully filled OREA Form 100"
echo "  2. Check database DocumentAnalysis.extractedData field"
echo "  3. Open ApsReviewScreen in mobile app"
echo "  4. Verify all fields are populated correctly"

# =============================================================================
# TEST 8: Rejection Email Content
# =============================================================================
print_test_header "8" "Rejection Email Content Verification"

print_info "This test verifies the rejection email contains proper information:"
print_info ""
print_info "Expected email content:"
echo "  Subject: 'Offer Submission Issue - [Property Address]'"
echo "  Body should include:"
echo "    - List of validation errors with field names"
echo "    - Clear instructions on what to fix"
echo "    - Checklist of requirements"
echo "    - Instructions to reply with corrected form"
print_info ""
print_info "To test:"
echo "  1. Send an invalid form"
echo "  2. Check buyer agent's email inbox"
echo "  3. Verify email is properly formatted"
echo "  4. Verify all validation errors are listed"

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Test Suite Documentation Complete${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""
print_success "All test scenarios documented"
print_info ""
print_info "To run tests, you'll need sample OREA Form 100 PDFs:"
print_info "  - Get blank forms from OREA website"
print_info "  - Fill them out with test data"
print_info "  - Test each scenario by emailing PDFs to: ${LISTING_EMAIL}"
print_info ""
print_info "Monitor backend logs for validation results:"
echo "    cd packages/api && npm run dev"
print_info ""
print_info "Check database for created offers:"
echo "    psql \$DATABASE_URL -c 'SELECT * FROM offers ORDER BY created_at DESC LIMIT 5;'"
echo ""

# Note about sample PDFs
echo -e "${YELLOW}NOTE: Sample PDF creation is manual${NC}"
echo -e "${YELLOW}Create test PDFs with different scenarios to test validation${NC}"
echo ""

