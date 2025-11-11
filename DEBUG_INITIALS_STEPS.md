# Step-by-Step Debugging Guide for Buyer Initials Detection

## Step 1: Run the Test

```bash
cd /Users/pratyush/code/SmartBrokerageApp
./test-initials.sh "OREA APS Form copy 2.pdf"
```

## Step 2: Check the JSON Output

Look at the response and find the `details` section. You should see something like:

```json
{
  "details": [
    {
      "page": 1,
      "found": "❌",
      "confidence": "10%",
      "location": "..."
    }
  ]
}
```

## Step 3: Check Server Logs

In your terminal where the API is running, look for lines like:

```
🔍 Checking buyer initials on OREA form pages 1, 2, 3, 4, 6...
  Checking page 1...
    Image size: 245.3 KB
    📝 Gemini response: {"hasInitials": false, "confidence": 0.8, "location": "..."}
  Page 1: ❌ (confidence: 80%)
```

## Step 4: Share the Information

Please share:

1. **The JSON output** from the test command
2. **The server logs** showing Gemini's responses for each page
3. **Confirmation:** Are there definitely buyer initials on all 5 pages in your PDF?

## Alternative: Try Single Page Test

Let's test just page 1 to see what's happening:

```bash
curl -X POST http://localhost:3000/documents/test-initials \
  -F "pdf=@OREA APS Form copy 2.pdf" \
  -H "Accept: application/json" | jq '.details[0]'
```

This will show you just page 1's result.

## Common Issues & Quick Fixes

### Issue 1: All Pages Return False

**Possible causes:**
- Image quality too low
- Gemini API quota exceeded
- Initials in unexpected location

**Quick fix to try:**

Edit the prompt to be even more liberal. In `signature-detector.service.ts`, you could try:

```typescript
const prompt = `Look at this image. 
Are there ANY handwritten marks, scribbles, letters, or signatures ANYWHERE in the bottom half of the page? 
Answer YES if you see ANY marks. Answer NO only if completely blank.

Return JSON: {"hasInitials": true/false, "confidence": 0.9, "location": "what you see"}`;
```

### Issue 2: Parse Errors

**Look for:**
```
❌ JSON parse error for page X
Full response: [some non-JSON text]
```

**This means:** Gemini isn't returning valid JSON

**Fix:** The prompt might be confusing. Try the simpler version above.

### Issue 3: Low Confidence

**Look for:**
```
Page 1: ✅ (confidence: 20%)
```

**This means:** Gemini found something but isn't sure

**Fix:** Lower the confidence threshold or accept any detection.

## Nuclear Option: Skip Vision Detection

If it's still not working, we can fall back to text-only validation:

```typescript
// In aps-parser.service.ts, comment out the image validation:
// visualValidation = await this.signatureDetectorService.performVisualValidation(...)
```

This will use only text extraction without visual validation.

## What to Try Next

Based on your results, here's what we should try:

1. **If Gemini says "no marks found":**
   - The image might not be converting properly
   - Try increasing image quality to 95%
   - Check if PDF has security restrictions

2. **If Gemini says "marks present but not clear":**
   - Lower the confidence threshold
   - Make the prompt even simpler
   - Accept partial matches (4/5 pages)

3. **If getting parse errors:**
   - Simplify the JSON structure
   - Try a different Gemini model
   - Add retry logic

Please run the test and share the output so we can determine which path to take! 🔍

