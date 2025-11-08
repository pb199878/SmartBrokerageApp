#!/usr/bin/env node

/**
 * Debug tool to extract all text with coordinates from a PDF
 * This helps you find the exact bounding boxes for filled fields
 */

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const fs = require('fs');

async function debugPdfText(pdfPath, pageNum = 1) {
  console.log(`📄 Extracting text coordinates from: ${pdfPath}`);
  console.log(`📃 Page: ${pageNum}`);
  console.log('');

  const pdfBuffer = fs.readFileSync(pdfPath);
  const uint8Array = new Uint8Array(pdfBuffer);
  
  const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
  const pdfDoc = await loadingTask.promise;
  
  const page = await pdfDoc.getPage(pageNum);
  const textContent = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1.0 });

  console.log(`Page dimensions: ${viewport.width} x ${viewport.height}`);
  console.log('');
  console.log('Text items with coordinates:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Group text items by approximate Y position (within 5 pixels)
  const lines = [];
  let currentLine = null;

  textContent.items.forEach((item, index) => {
    if (!item.transform) return;

    const x = Math.round(item.transform[4]);
    const y = Math.round(viewport.height - item.transform[5]); // Convert to top-left origin
    const text = item.str;

    if (!text || text.trim() === '') return;

    // Start new line if Y position changed significantly
    if (!currentLine || Math.abs(currentLine.y - y) > 5) {
      if (currentLine) lines.push(currentLine);
      currentLine = { y, items: [] };
    }

    currentLine.items.push({ x, y, text, width: item.width, height: item.height });
  });

  if (currentLine) lines.push(currentLine);

  // Sort lines by Y position
  lines.sort((a, b) => a.y - b.y);

  // Print each line
  lines.forEach((line, lineIndex) => {
    // Sort items in line by X position
    line.items.sort((a, b) => a.x - b.x);
    
    const fullText = line.items.map(i => i.str).join(' ');
    const firstItem = line.items[0];
    const lastItem = line.items[line.items.length - 1];
    
    console.log(`Line ${lineIndex + 1} (Y: ${line.y}):`);
    console.log(`  Text: "${fullText}"`);
    console.log(`  Bbox: [${firstItem.x}, ${line.y}, ${lastItem.x + lastItem.width}, ${line.y + firstItem.height}]`);
    console.log('');
  });

  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('💡 Tips:');
  console.log('  - Look for lines with filled data (not just labels)');
  console.log('  - Use the bbox coordinates in your field map');
  console.log('  - Adjust the coordinates to be more precise');
  console.log('');
}

const pdfPath = process.argv[2];
const pageNum = parseInt(process.argv[3]) || 1;

if (!pdfPath) {
  console.error('Usage: node debug-pdf-text.js <pdf-path> [page-number]');
  console.error('');
  console.error('Example:');
  console.error('  node debug-pdf-text.js "OREA APS Form copy 2.pdf" 1');
  process.exit(1);
}

debugPdfText(pdfPath, pageNum).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

