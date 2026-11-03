# Backfill: no-show recovery for clinics

Demo web app for independent dental, PT and vet practices. A patient cancels, the app texts the short-notice waitlist, the first YES gets the slot, and the "Recovered today" counter ticks up.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Demo script (60 seconds)

1. Pick the clinic type (Dental / Physical therapy / Veterinary).
2. Click **Simulate a cancellation** (or **Cancel** on any row).
3. Watch the slot go red, then amber as 3 waitlisted patients get texted.
4. With autopilot on, the patient on the phone replies YES after ~3s. Turn autopilot off to tap **Reply YES** / **No thanks** yourself (No passes it to the next person).
5. Slot turns green, the others get a "slot was claimed" text, and the counter climbs.
6. Scroll to **The ROI math** and plug in the prospect's numbers live.

## Real texts (optional)

Texting is simulated by default. To send the featured patient's texts to your own phone during a live pitch, set these on Vercel (or in `.env.local`):

```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=+19165550100
DEMO_PHONE=+1yourcell
```

The header badge switches to "SMS: live to demo phone". Inbound replies are still tapped in the UI; wiring a Twilio inbound webhook is the next step toward a real product.

## Stack

Next.js (App Router), React, plain CSS with light and dark themes. Fonts: Instrument Serif, Geist, Geist Mono via `next/font`. No database: demo logic lives in `app/engine.js`, UI in `app/page.js`. Deploy by importing the repo into Vercel.
