// Sends a real SMS through Twilio when configured; otherwise reports simulated mode.
// Demo waitlist numbers are fake, so live texts all go to DEMO_PHONE (the presenter's phone).
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, DEMO_PHONE } = process.env;
const live = Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM && DEMO_PHONE);

export async function GET() {
  return Response.json({ mode: live ? "live" : "simulated" });
}

export async function POST(req) {
  const { body } = await req.json();
  if (!live) return Response.json({ mode: "simulated", ok: true });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: DEMO_PHONE, From: TWILIO_FROM, Body: String(body).slice(0, 320) }),
    }
  );
  return Response.json({ mode: "live", ok: res.ok }, { status: res.ok ? 200 : 502 });
}
