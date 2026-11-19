# Email Invitation System - Setup Complete

## What Was Implemented

Email invitation system using Resend API for sending collaboration invitations.

### Files Created/Modified

| File | Purpose |
|------|---------|
| [emails/InvitationEmail.tsx](emails/InvitationEmail.tsx) | Beautiful HTML email template |
| [app/api/invitations/send/route.ts](app/api/invitations/send/route.ts) | API endpoint for sending emails |
| [components/modals/ShareModal.tsx](components/modals/ShareModal.tsx:161-183) | Updated to send emails after creating invitations |
| [.env.example](.env.example:32-34) | Added Resend configuration |

## How It Works

1. **User sends invitation** via ShareModal
2. **Invitation saved to Firestore** (existing behavior)
3. **Email sent automatically** via Resend API
4. **Recipient receives email** with:
   - Personalized message from inviter
   - "Accept Invitation" button
   - Direct link to invitation page
   - Expiration notice (7 days)

## Email Preview

```
┌─────────────────────────────────────┐
│ NovaMachine                         │
├─────────────────────────────────────┤
│                                     │
│ You've been invited to collaborate!│
│                                     │
│ John Doe has invited you to         │
│ collaborate on My Amazing Board.    │
│                                     │
│ ┌─────────────────────────────┐    │
│ │    Accept Invitation        │    │
│ └─────────────────────────────┘    │
│                                     │
│ ⚠️  Expires on Dec 14, 2025        │
└─────────────────────────────────────┘
```

## Remaining Setup Required

### 1. Get Resend API Key

**Steps:**
1. Go to https://resend.com/signup
2. Create account (free tier: 3,000 emails/month)
3. Go to https://resend.com/api-keys
4. Click "Create API Key"
5. Copy the key (starts with `re_`)

### 2. Add Domain (Production Only)

**For Development:**
- Use the default `onboarding@resend.dev` (already configured)
- Emails will work but show "via resend.dev"

**For Production:**
1. Go to https://resend.com/domains
2. Add your domain (e.g., `novamachine.com`)
3. Add DNS records provided by Resend
4. Verify domain
5. Update `RESEND_FROM_EMAIL` in `.env.local`

### 3. Configure Environment Variables

Add to `.env.local`:

```bash
# Resend Email Configuration
RESEND_API_KEY=re_your_resend_key

# Optional: Custom from address (production only, requires verified domain)
RESEND_FROM_EMAIL=NovaMachine <noreply@yourdomain.com>

# Required: Your app URL
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or https://yourdomain.com
```

### 4. Test Email Sending

```bash
# 1. Start the dev server
pnpm dev

# 2. Open the app
open http://localhost:3000

# 3. Go to canvas page with a board
# 4. Click "Share" button
# 5. Enter an email and click "Send Invitation"
# 6. Check the recipient's inbox
```

## Error Handling

The system is designed to be resilient:

- ✅ **Email fails → Invitation still created** (user can manually share link)
- ✅ **Invalid email → Blocked before sending**
- ✅ **Duplicate invites → Prevented**
- ✅ **Auth required → Verified with Firebase token**

Errors are logged to console but don't block the invitation flow.

## Email Features

- ✅ Responsive design (mobile + desktop)
- ✅ Personalized with inviter's name
- ✅ Board name displayed
- ✅ Direct "Accept" button
- ✅ Fallback plain-text link
- ✅ Expiration warning
- ✅ Professional branding

## Cost

**Resend Pricing:**
- Free: 3,000 emails/month, 100 emails/day
- Pro: $20/month for 50,000 emails
- See: https://resend.com/pricing

**Typical Usage:**
- 10 invitations/day = 300/month → **Free tier is fine**
- 100 invitations/day = 3,000/month → **Free tier sufficient**

## Testing Checklist

- [ ] Resend API key added to `.env.local`
- [ ] App URL configured (`NEXT_PUBLIC_APP_URL`)
- [ ] Dev server running (`pnpm dev`)
- [ ] Can send invitation from ShareModal
- [ ] Email received in inbox
- [ ] "Accept Invitation" button works
- [ ] Invitation link works
- [ ] Expiration date shows correctly

## Alternatives (If Needed)

If you prefer not to use Resend:

1. **SendGrid** - Free tier: 100 emails/day
2. **Mailgun** - Free tier: 5,000 emails/month
3. **AWS SES** - $0.10 per 1,000 emails
4. **Firebase Extensions** - Trigger Email extension

Simply replace the Resend code in [app/api/invitations/send/route.ts](app/api/invitations/send/route.ts) with your chosen provider.

## Next Steps

1. ✅ Email system implemented
2. ⏳ Get Resend API key
3. ⏳ Add to `.env.local`
4. ⏳ Test invitation flow
5. ⏳ (Production) Add custom domain to Resend

---

**Status:** Email system is fully implemented and ready to use. Just add the Resend API key to start sending emails.
