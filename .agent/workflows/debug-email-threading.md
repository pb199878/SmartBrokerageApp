---
description: Debug email threading issues when replies create new threads
---

# Debug Email Threading

Use this when email replies create new threads instead of continuing conversations.

## Checklist

1. **Check Message-IDs in Database**

   - Verify outbound messages have `messageId` stored
   - Message-ID format must be RFC 5322 compliant: `<unique-id@resolvable-domain.com>`

2. **Verify Domain is Resolvable**

   - Use your Mailgun domain, NOT fake domains like `yourapp.ca`
   - Gmail will override invalid Message-IDs with `SMTPIN_ADDED_BROKEN@mx.google.com`

3. **Check Incoming Email Headers**

   - Parse `References` header (full conversation chain)
   - Parse `In-Reply-To` header (direct parent)
   - Log all Message-IDs from incoming emails

4. **Verify Outbound Email Headers**

   - `h:Message-Id`: Your generated Message-ID
   - `h:In-Reply-To`: The root `thread.emailThreadId`
   - `h:References`: Full chain of all Message-IDs (space-separated)

5. **Check Parameter Order**
   ```typescript
   sendEmail(from, to, subject, text, html, inReplyTo, references, messageId);
   ```

## Common Issues

- ❌ Using unresolvable domains → Gmail overrides Message-ID
- ❌ Not storing Message-IDs in DB → Can't match replies
- ❌ Wrong parameter order in sendEmail() → Headers missing
- ❌ Only storing one emailThreadId → Fails after 2-3 replies
- ❌ Not parsing References header → Can't match later replies
