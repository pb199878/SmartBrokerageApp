#!/usr/bin/env node

/**
 * Simulate Mailgun Inbound Email Webhook
 * 
 * Sends a multipart/form-data request exactly like Mailgun does
 * when using "Store and notify" with email attachments.
 * 
 * Usage:
 *   node scripts/send-test-email.js                      # Use defaults
 *   node scripts/send-test-email.js ./my-offer.pdf       # Specify PDF
 *   node scripts/send-test-email.js --to l-abc123@...    # Specify recipient
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const http = require('http');

// Parse CLI arguments
const args = process.argv.slice(2);
let options = {
  to: 'l-xyz789@sandbox13e21b5ad0394a1a972068334e2b619e.mailgun.org',
  from: 'testbuyer@gmail.com',
  subject: `Offer Submission - ${new Date().toISOString().split('T')[0]}`,
  body: 'Please find attached my offer document for your property listing.',
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  pdfPath: null,
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--to' && args[i + 1]) {
    options.to = args[++i];
  } else if (arg === '--from' && args[i + 1]) {
    options.from = args[++i];
  } else if (arg === '--subject' && args[i + 1]) {
    options.subject = args[++i];
  } else if (arg === '--body' && args[i + 1]) {
    options.body = args[++i];
  } else if (arg === '--api' && args[i + 1]) {
    options.apiUrl = args[++i];
  } else if (arg === '-h' || arg === '--help') {
    console.log(`
Usage: node ${path.basename(__filename)} [OPTIONS] [PDF_FILE]

Simulate a Mailgun inbound email webhook with an attachment
Sends multipart/form-data exactly like Mailgun does

Options:
  --to EMAIL      Recipient listing email (default: l-xyz789@...)
  --from EMAIL    Sender email (default: testbuyer@gmail.com)
  --subject TEXT  Email subject (default: 'Offer Submission')
  --body TEXT     Email body text
  --api URL       API endpoint (default: http://localhost:3000)
  PDF_FILE        Path to PDF attachment (default: test-orea-form.pdf)

Examples:
  node ${path.basename(__filename)}                         # Use all defaults
  node ${path.basename(__filename)} ./my-offer.pdf          # Use custom PDF
  node ${path.basename(__filename)} --to l-abc123@sandbox... # Send to specific listing
`);
    process.exit(0);
  } else if (arg.endsWith('.pdf') || arg.endsWith('.PDF')) {
    options.pdfPath = path.resolve(arg);
  }
}

// Find default PDF if not specified
const projectRoot = path.resolve(__dirname, '..');
if (!options.pdfPath) {
  const candidates = [
    path.join(projectRoot, 'test-orea-form.pdf'),
    path.join(projectRoot, 'OREA APS Form copy 2.pdf'),
    path.join(projectRoot, 'OREA APS Form copy 3.pdf'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      options.pdfPath = candidate;
      break;
    }
  }
}

if (!options.pdfPath || !fs.existsSync(options.pdfPath)) {
  console.error('❌ Error: PDF file not found');
  console.error('\nAvailable PDF files in project root:');
  const pdfFiles = fs.readdirSync(projectRoot).filter(f => f.endsWith('.pdf'));
  pdfFiles.forEach(f => console.log(`  ${f}`));
  process.exit(1);
}

// Get file info
const pdfFilename = path.basename(options.pdfPath);
const pdfStats = fs.statSync(options.pdfPath);
const timestamp = Math.floor(Date.now() / 1000);
const messageId = `<test-${timestamp}-${Math.random().toString(36).slice(2)}@test.local>`;

console.log('\n📧 Simulating Mailgun Inbound Email Webhook');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  API:        ${options.apiUrl}/webhooks/mailgun`);
console.log(`  From:       ${options.from}`);
console.log(`  To:         ${options.to}`);
console.log(`  Subject:    ${options.subject}`);
console.log(`  Attachment: ${pdfFilename} (${pdfStats.size} bytes)`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Create form data exactly like Mailgun sends it
const form = new FormData();
form.append('sender', options.from);
form.append('recipient', options.to);
form.append('subject', options.subject);
form.append('body-plain', options.body);
form.append('stripped-text', options.body);
form.append('Message-Id', messageId);
form.append('timestamp', timestamp.toString());
form.append('attachment-count', '1');

// Add the PDF file as attachment-1 (how Mailgun sends it with "Store and notify")
form.append('attachment-1', fs.createReadStream(options.pdfPath), {
  filename: pdfFilename,
  contentType: 'application/pdf',
});

// Parse the API URL
const url = new URL(options.apiUrl + '/webhooks/mailgun');
const requestOptions = {
  hostname: url.hostname,
  port: url.port || 3000,
  path: url.pathname,
  method: 'POST',
  headers: form.getHeaders(),
};

// Make the request
const req = http.request(requestOptions, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('✅ Webhook request sent successfully!');
      console.log(`\n  HTTP Status: ${res.statusCode}`);
      console.log(`  Message-Id:  ${messageId}\n`);
      console.log('📝 Response:');
      try {
        console.log(JSON.stringify(JSON.parse(body), null, 2));
      } catch {
        console.log(body);
      }
      console.log('\n💡 Check your API terminal for processing logs!');
    } else {
      console.error(`❌ Webhook request failed (HTTP ${res.statusCode})`);
      console.error('\nResponse:', body);
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Connection failed:', err.message);
  console.error('\nMake sure your API server is running:');
  console.error('  npm run api');
  process.exit(1);
});

// Send the form data
form.pipe(req);
