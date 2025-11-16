# SMS Delivery Feature

## Overview

Scuttle What now supports **SMS delivery** for answer updates in addition to email. This is perfect for executives who prefer text messages over email.

## Why SMS?

**Executive Behavior:**
- Execs check texts way more than emails
- SMS has 98% open rate vs 20% for email
- Text messages feel more urgent and personal
- No spam folder to worry about
- Instant notification on their phone

**Perfect for Scuttle What because:**
- Updates are short and actionable
- Time-sensitive information (market changes)
- High-value audience (decision makers)
- Creates stronger engagement

---

## How It Works

### User Experience

**1. Ask a Question**
User asks: "Best sales engagement tool"

**2. Get Answer**
3-5 tools with proof + downsides

**3. Choose Delivery Method**
Three options:
- **Email** - Get updates via email
- **SMS** - Get updates via text message
- **Both** - Get both email and SMS

**4. Enter Contact Info**
- If Email: Enter email address
- If SMS: Enter phone number (+1 555-123-4567)
- If Both: Enter both

**5. Pick Frequency**
Daily, every 3 days, weekly, bi-weekly, monthly

**6. Get Updates**
Automated cron job sends updates via chosen method(s)

---

## SMS Message Format

### Short Version (If under 1600 chars):

```
"Best sales engagement tool"

1. Salesloft
   Automate email sequences and calls for sales teams
   ✓ 1,200 PH upvotes, 5,000+ companies
   ⚠ Expensive ($75/user/month minimum)
   → https://salesloft.com

2. Apollo
   All-in-one sales intelligence platform
   ✓ 1,500 users, Series B funded
   ⚠ Learning curve for advanced features
   → https://apollo.io

Powered by Scuttle What
```

### Long Version (If over 1600 chars):

```
Scuttle What Update: "Best sales engagement tool"

5 tools found. Visit scuttlewhat.com for full details.

1. Salesloft - https://salesloft.com
2. Apollo - https://apollo.io
3. Outreach - https://outreach.io
```

---

## Technical Implementation

### Database Schema

Updated `question_subscriptions` table:

```sql
ALTER TABLE question_subscriptions
ADD COLUMN email TEXT NULL,
ADD COLUMN phone TEXT NULL,
ADD COLUMN delivery_method delivery_method_enum NOT NULL DEFAULT 'email';

-- delivery_method can be: 'email', 'sms', 'both'
```

**Validation:**
- Email is nullable (only required if delivery_method includes 'email')
- Phone is nullable (only required if delivery_method includes 'sms')
- Phone numbers are validated and formatted to E.164 standard

### SMS Service (Twilio)

**File:** `src/services/sms.ts`

**Functions:**
- `sendSMSUpdate()` - Send SMS with answer
- `validatePhoneNumber()` - Validate phone format
- `formatPhoneNumber()` - Convert to E.164 (+1234567890)
- `formatAnswerForSMS()` - Format answer for SMS (1600 char limit)

**Phone Number Format:**
- Accepts: `555-123-4567`, `(555) 123-4567`, `+1 555 123 4567`
- Stores: `+15551234567` (E.164 format)
- Auto-adds +1 for US numbers (10 digits)

### API Updates

**`/api/subscribe` Route:**

Now accepts:
```json
{
  "email": "user@example.com",  // Optional
  "phone": "+15551234567",       // Optional
  "deliveryMethod": "both",      // "email" | "sms" | "both"
  "questionId": "q_...",
  "question": "Best sales tool",
  "frequencyDays": 7
}
```

**Validation:**
- If deliveryMethod = "email" or "both" → email required
- If deliveryMethod = "sms" or "both" → phone required
- Phone numbers validated before storing

### Cron Job Updates

**`/api/cron/send-updates` Route:**

Now handles both email and SMS:

```typescript
// For each subscription:
if (deliveryMethod === 'email' || deliveryMethod === 'both') {
  // Send email via Resend
}

if (deliveryMethod === 'sms' || deliveryMethod === 'both') {
  // Send SMS via Twilio
}
```

### Frontend Updates

**Ask Page (`/ask`):**

New UI elements:
- Delivery method selector (3 buttons: Email, SMS, Both)
- Conditional rendering of email/phone inputs
- Phone number input with placeholder
- Form validation based on delivery method

---

## Setup Instructions

### 1. Sign Up for Twilio

**Go to:** https://www.twilio.com/

**Create account:**
1. Sign up (free trial includes $15 credit)
2. Verify your email + phone
3. Get a Twilio phone number (for sending SMS)

**Find credentials:**
- Dashboard → Account Info
- Copy: Account SID, Auth Token, Phone Number

### 2. Configure Environment Variables

Add to `.env`:

```bash
# Twilio SMS
TWILIO_ACCOUNT_SID=AC1234567890abcdef1234567890abcdef
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15551234567
```

**Important:**
- Phone number must include country code (e.g., +1 for US)
- Keep Auth Token secret (never commit to git)

### 3. Test SMS Locally

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Visit /ask page
# Ask a question
# Choose SMS delivery
# Enter your phone number
# Subscribe

# Manually trigger cron job
curl http://localhost:3000/api/cron/send-updates \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Check your phone for SMS
```

### 4. Deploy

**Vercel:**
1. Add environment variables in Vercel dashboard
2. Deploy: `vercel deploy --prod`
3. Test in production

**Other platforms:**
- Add Twilio env vars to your hosting platform
- Ensure cron job is configured
- Test end-to-end

---

## Costs

### Twilio Pricing

**SMS Costs (US):**
- Outbound SMS: **$0.0079 per message**
- Inbound SMS: $0.0079 per message (not used)

**Phone Number:**
- US phone number: **$1.50/month**

**Example Monthly Costs:**

| Subscribers | Messages/Month | Cost/Month |
|------------|----------------|------------|
| 10 | 70 | $1.55 |
| 100 | 700 | $7.03 |
| 500 | 3,500 | $29.15 |
| 1,000 | 7,000 | $56.80 |

*(Assumes weekly updates, ~7 messages per subscriber/month)*

**Free Trial:**
- $15 credit included
- Can send ~1,900 messages
- Good for testing + first 100 subscribers

### Compared to Email

**Resend (Email):**
- Free: 3,000 emails/month
- $20/month: 50,000 emails

**Twilio (SMS):**
- ~$0.01 per message
- More expensive but WAY higher engagement

**ROI:**
- SMS open rate: 98%
- Email open rate: 20%
- For high-value executives, SMS is worth it

---

## Security & Best Practices

### Phone Number Privacy

**Storage:**
- Phone numbers stored in E.164 format
- Indexed for fast lookups
- Never shared or sold

**Validation:**
- Format validation on input
- Twilio validates deliverability
- Invalid numbers rejected

### Rate Limiting

**Twilio Limits:**
- Default: 1 message/second
- Can request higher limits
- Monitor for abuse

**Scuttle What Limits:**
- Max 1 update per subscription per frequency period
- Cron job processes 100 subscriptions at a time
- Prevents accidental spam

### Unsubscribe

**SMS Compliance:**
- Include unsubscribe info in messages
- Add "Reply STOP to unsubscribe" (Twilio handles this automatically)
- Respect opt-outs immediately

**API Endpoint:**
```
DELETE /api/subscribe?id=SUBSCRIPTION_ID
```

---

## Monitoring

### Check SMS Delivery

**Twilio Console:**
- Dashboard → Messaging → Logs
- See all sent messages
- View delivery status
- Check failures

**Database Queries:**

```sql
-- SMS subscriptions
SELECT phone, question, delivery_method, next_send_at
FROM question_subscriptions
WHERE delivery_method IN ('sms', 'both')
AND active = true;

-- Recent updates sent
SELECT phone, last_sent_at
FROM question_subscriptions
WHERE last_sent_at > NOW() - INTERVAL '24 hours'
AND delivery_method IN ('sms', 'both');
```

### Debug Issues

**SMS not sending?**

1. Check Twilio credentials in env
2. Verify phone number format (+1XXXXXXXXXX)
3. Check Twilio balance (need credit)
4. View Twilio logs for errors
5. Verify cron job is running

**Phone number validation failing?**

1. Ensure +1 country code for US
2. Remove spaces/dashes (handled automatically)
3. Check length (10-15 digits)
4. Test with formatPhoneNumber() function

---

## Usage Examples

### Example 1: Email Only (Original)

```
User: "Best CRM for SaaS"
Delivery: Email ✓
Email: exec@company.com
Frequency: Weekly

Result: Gets email every week
```

### Example 2: SMS Only (New)

```
User: "AI meeting notes app"
Delivery: SMS ✓
Phone: +1 555-123-4567
Frequency: Every 3 days

Result: Gets text every 3 days
```

### Example 3: Both (Power User)

```
User: "Customer feedback platform"
Delivery: Both ✓
Email: cro@startup.com
Phone: +1 555-987-6543
Frequency: Daily

Result: Gets email AND text every day
```

---

## Outreach Strategy with SMS

### Cold Email + SMS Follow-Up

**Email (Day 1):**
```
Subject: Built this for you

[Name],

Made a tool that cuts SaaS discovery down to 30 seconds.

scuttlewhat.com/ask

Try it - if you want updates, you can get them via SMS
so you never miss when the market shifts.

Worth 2 minutes.
```

**They try it, subscribe via SMS**

**Follow-Up (Day 7):**
```
Saw you subscribed to Scuttle What updates via text.

Smart move - most execs I talk to prefer SMS for stuff
that actually matters.

Quick question: what else are you tracking right now?
```

### SMS as Social Proof

**In your pitch:**
> "Execs love it because they can get updates via SMS -
> no digging through email. One CRO told me he checks
> our texts before his morning standup."

### Positioning

**SMS = Premium Signal**

- Email = Generic updates
- SMS = "I actually care about this"
- Choosing SMS shows intent
- Higher quality lead

---

## Future Enhancements

### V2: Interactive SMS

**User replies to SMS:**
```
User: "Show me alternatives to Salesloft"
Scuttle What: [Sends 3 alternatives]
```

**Implementation:**
- Webhook from Twilio on inbound SMS
- Parse message as new question
- Send answer via SMS
- Full conversational experience

### V3: Smart Delivery

**Based on user behavior:**
- If they never open emails → Suggest SMS
- If they click links in SMS → Send more
- A/B test email vs SMS engagement
- Auto-optimize delivery method

### V4: Rich Media MMS

**Instead of plain text:**
- Product screenshots
- Comparison charts
- Video previews
- More engaging than text

**Cost:** ~$0.02/message (vs $0.01 for SMS)

---

## Summary

**SMS delivery gives Scuttle What:**

✅ **Higher engagement** - 98% open rate
✅ **Faster action** - Instant notification
✅ **Executive preference** - They check texts
✅ **Differentiation** - Most tools don't do this
✅ **Quality signal** - SMS subscribers = serious users

**Setup cost:** ~$2/month to start
**Per-message cost:** $0.01
**ROI:** Massive for high-value audience

**The move:** Offer both, but pitch SMS as the "executive tier" delivery method. Creates implied premium without charging extra.

That's the play.
