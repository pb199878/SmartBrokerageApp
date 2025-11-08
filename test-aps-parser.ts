#!/usr/bin/env ts-node

/**
 * Quick test script for APS Parser
 * Usage: npx ts-node test-aps-parser.ts "path/to/form.pdf"
 */

import * as fs from 'fs';
import * as path from 'path';

// Import the APS parser service
import { ApsParserService } from './packages/api/src/modules/aps-parser/aps-parser.service.js';

async function testParser(pdfPath: string) {
  console.log('🧪 Testing APS Parser');
  console.log('📄 PDF:', pdfPath);
  console.log('');

  // Read the PDF file
  if (!fs.existsSync(pdfPath)) {
    console.error('❌ File not found:', pdfPath);
    process.exit(1);
  }

  const pdfBuffer = fs.readFileSync(pdfPath);
  console.log(`✅ Loaded PDF (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);
  console.log('');

  // Create parser instance
  const parser = new ApsParserService();

  // Parse the PDF
  console.log('⚙️  Parsing...');
  const startTime = Date.now();
  
  try {
    const result = await parser.parseAps(pdfBuffer);
    const duration = Date.now() - startTime;

    console.log('');
    console.log('✅ Parsing Complete!');
    console.log('⏱️  Duration:', duration, 'ms');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('RESULTS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('Strategy Used:', result.strategyUsed);
    console.log('Form Version:', result.formVersion || 'Not detected');
    console.log('Document Confidence:', (result.docConfidence * 100).toFixed(1) + '%');
    console.log('Success:', result.success);
    console.log('');

    if (result.errors && result.errors.length > 0) {
      console.log('⚠️  Errors:');
      result.errors.forEach(err => console.log('  -', err));
      console.log('');
    }

    console.log('───────────────────────────────────────────────────────────');
    console.log('PARTIES');
    console.log('───────────────────────────────────────────────────────────');
    console.log('');
    console.log('Buyers:');
    result.parties.buyers.forEach((buyer, i) => {
      console.log(`  ${i + 1}. ${buyer.fullName} (confidence: ${(buyer.confidence * 100).toFixed(1)}%)`);
    });
    if (result.parties.buyers.length === 0) console.log('  (none detected)');
    console.log('');

    console.log('Sellers:');
    result.parties.sellers.forEach((seller, i) => {
      console.log(`  ${i + 1}. ${seller.fullName} (confidence: ${(seller.confidence * 100).toFixed(1)}%)`);
    });
    if (result.parties.sellers.length === 0) console.log('  (none detected)');
    console.log('');

    console.log('───────────────────────────────────────────────────────────');
    console.log('PROPERTY');
    console.log('───────────────────────────────────────────────────────────');
    console.log('');
    console.log('Address:', result.property.addressLine1 || '(not detected)');
    console.log('Municipality:', result.property.municipality || '(not detected)');
    console.log('Postal Code:', result.property.postalCode || '(not detected)');
    console.log('Legal Description:', result.property.legalDesc || '(not detected)');
    console.log('Confidence:', (result.property.confidence * 100).toFixed(1) + '%');
    console.log('');

    console.log('───────────────────────────────────────────────────────────');
    console.log('FINANCIALS');
    console.log('───────────────────────────────────────────────────────────');
    console.log('');
    console.log('Purchase Price:', result.financials.price ? `$${result.financials.price}` : '(not detected)');
    console.log('Deposit:', result.financials.deposit ? `$${result.financials.deposit}` : '(not detected)');
    console.log('Deposit Due:', result.financials.depositDue || '(not detected)');
    console.log('Completion Date:', result.financials.completionDate || '(not detected)');
    if (result.financials.irrevocable) {
      console.log('Irrevocable Date:', result.financials.irrevocable.date || '(not detected)');
      console.log('Irrevocable Time:', result.financials.irrevocable.time || '(not detected)');
    }
    console.log('Confidence:', (result.financials.confidence * 100).toFixed(1) + '%');
    console.log('');

    if (result.conditions) {
      console.log('───────────────────────────────────────────────────────────');
      console.log('CONDITIONS');
      console.log('───────────────────────────────────────────────────────────');
      console.log('');
      console.log('Financing:', result.conditions.financing ? '✓ Yes' : '✗ No');
      console.log('Inspection:', result.conditions.inspection ? '✓ Yes' : '✗ No');
      console.log('Status Certificate:', result.conditions.statusCertificate ? '✓ Yes' : '✗ No');
      if (result.conditions.other && result.conditions.other.length > 0) {
        console.log('Other Conditions:');
        result.conditions.other.forEach(cond => console.log('  -', cond));
      }
      console.log('Confidence:', (result.conditions.confidence * 100).toFixed(1) + '%');
      console.log('');
    }

    console.log('───────────────────────────────────────────────────────────');
    console.log('SIGNATURES');
    console.log('───────────────────────────────────────────────────────────');
    console.log('');
    if (result.signatures.length > 0) {
      result.signatures.forEach((sig, i) => {
        console.log(`${i + 1}. ${sig.role.toUpperCase()}`);
        console.log(`   Type: ${sig.type}`);
        console.log(`   Page: ${sig.page}`);
        console.log(`   Signer: ${sig.signerName || '(not detected)'}`);
        console.log(`   Signed At: ${sig.signedAt || '(not detected)'}`);
        console.log(`   Confidence: ${(sig.confidence * 100).toFixed(1)}%`);
        console.log('');
      });
    } else {
      console.log('(no signatures detected)');
      console.log('');
    }

    console.log('───────────────────────────────────────────────────────────');
    console.log('EXTRACTED FIELDS');
    console.log('───────────────────────────────────────────────────────────');
    console.log('');
    console.log(`Total Fields: ${Object.keys(result.fields).length}`);
    console.log('');
    
    // Show first 10 fields as sample
    const fieldEntries = Object.entries(result.fields).slice(0, 10);
    if (fieldEntries.length > 0) {
      console.log('Sample Fields (first 10):');
      fieldEntries.forEach(([key, field]) => {
        const valueStr = typeof field.value === 'boolean' 
          ? (field.value ? '✓' : '✗')
          : String(field.value).substring(0, 50);
        console.log(`  ${key}: ${valueStr}`);
        console.log(`    Source: ${field.source}, Confidence: ${(field.confidence * 100).toFixed(1)}%`);
      });
      if (Object.keys(result.fields).length > 10) {
        console.log(`  ... and ${Object.keys(result.fields).length - 10} more fields`);
      }
    }
    console.log('');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    // Save full result to JSON
    const outputPath = pdfPath.replace('.pdf', '-parsed.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log('💾 Full result saved to:', outputPath);

  } catch (error: any) {
    console.error('');
    console.error('❌ Parsing Failed!');
    console.error('Error:', error.message);
    console.error('');
    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Get PDF path from command line
const pdfPath = process.argv[2];

if (!pdfPath) {
  console.error('Usage: npx ts-node test-aps-parser.ts <path-to-pdf>');
  console.error('');
  console.error('Example:');
  console.error('  npx ts-node test-aps-parser.ts "OREA APS Form copy 2.pdf"');
  process.exit(1);
}

// Run the test
testParser(path.resolve(pdfPath));

