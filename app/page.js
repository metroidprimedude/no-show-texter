"use client";

import { useEffect, useReducer, useRef, useState } from "react";

// ---------- Demo data ----------
const TIMES = ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"];

const CLINICS = {
  dental: {
    label: "Dental",
    name: "Riverbend Family Dental",
    value: 325,
    room: "Op",
    services: ["Cleaning", "Crown prep", "Filling", "Exam + X-rays", "Root canal", "Cleaning", "Filling", "Crown seat"],
    patients: ["Dana R.", "Marcus L.", "Priya S.", "Tom W.", "Grace H.", "Luis M.", "Aisha K.", "Ben C."],
    waitlist: [
      { name: "Maria Gonzalez", phone: "(916) 555-0142", note: "Any time, 15 min away" },
      { name: "James Chen", phone: "(916) 555-0187", note: "Mornings, overdue cleaning" },
      { name: "Keisha Brown", phone: "(530) 555-0123", note: "Afternoons" },
      { name: "Ryan O'Neil", phone: "(916) 555-0166", note: "Any time" },
      { name: "Sofia Patel", phone: "(916) 555-0199", note: "Lunch hour" },
      { name: "Derek Nguyen", phone: "(530) 555-0110", note: "After 1 PM" },
    ],
  },
  pt: {
    label: "Physical therapy",
    name: "Northgate Physical Therapy",
    value: 140,
    room: "Table",
    services: ["Post-op knee", "Shoulder eval", "Low back rehab", "ACL rehab", "Gait training", "Rotator cuff", "Ankle sprain", "Dry needling"],
    patients: ["Kim T.", "Joe P.", "Angela F.", "Raj D.", "Steve B.", "Nora Q.", "Will A.", "Hana Y."],
    waitlist: [
      { name: "Carlos Rivera", phone: "(916) 555-0131", note: "Post-op, wants extra visits" },
      { name: "Emily Park", phone: "(916) 555-0158", note: "Mornings" },
      { name: "Andre Wilson", phone: "(530) 555-0177", note: "Any time" },
      { name: "Lauren Kelly", phone: "(916) 555-0104", note: "After work" },
      { name: "Hector Ruiz", phone: "(916) 555-0193", note: "Any time" },
      { name: "Mei Lin", phone: "(530) 555-0145", note: "Lunch hour" },
    ],
  },
  vet: {
    label: "Veterinary",
    name: "Fieldstone Veterinary",
    value: 210,
    room: "Exam",
    services: ["Annual exam", "Dental cleaning", "Vaccines", "Ear infection", "Senior wellness", "Spay consult", "Skin allergy", "Limping"],
    patients: ["Biscuit (dog)", "Luna (cat)", "Max (dog)", "Pepper (cat)", "Rocky (dog)", "Mochi (cat)", "Duke (dog)", "Olive (dog)"],
    waitlist: [
      { name: "Jenna Morales (Bailey, dog)", phone: "(916) 555-0128", note: "Itchy, wants in sooner" },
      { name: "Chris Adams (Simba, cat)", phone: "(916) 555-0171", note: "Any time" },
      { name: "Tasha Green (Coco, dog)", phone: "(530) 555-0136", note: "Afternoons" },
      { name: "Paul Ito (Ziggy, cat)", phone: "(916) 555-0115", note: "Mornings" },
      { name: "Rosa Vega (Bruno, dog)", phone: "(916) 555-0182", note: "Any time" },
      { name: "Sam Hill (Juniper, dog)", phone: "(530) 555-0150", note: "After 2 PM" },
    ],
  },
};

const first = (name) => name.split(" ")[0];
const fmt$ = (n) => "$" + Math.round(n).toLocaleString("en-US");
let uid = 0;
const id = () => ++uid;

// ---------- State machine ----------
function init(clinicKey) {
  const c = CLINICS[clinicKey];
  return {
    clinicKey,
    slots: TIMES.map((time, i) => ({
      id: i, time, room: `${c.room} ${(i % 3) + 1}`, patient: c.patients[i], service: c.services[i], status: "booked",
    })),
    waitlist: c.waitlist.map((w, i) => ({ ...w, id: i, status: "waiting" })),
    messages: [],
    log: [],
    recovered: 0,
    refills: 0,
    fillTimes: [],
    round: null,
    phoneId: null,
  };
}

function offerTo(s, members, now) {
  const c = CLINICS[s.clinicKey];
  const slot = s.slots.find((x) => x.id === s.round.slotId);
  const ids = members.map((m) => m.id);
  return {
    ...s,
    slots: s.slots.map((x) => (x.id === slot.id ? { ...x, status: "texting" } : x)),
    waitlist: s.waitlist.map((w) => (ids.includes(w.id) ? { ...w, status: "texted" } : w)),
    messages: [
      ...s.messages,
      ...members.map((m) => ({
        id: id(), memberId: m.id, dir: "out", t: now,
        text: `Hi ${first(m.name)}, ${c.name} just had a ${slot.time} opening today (${slot.service}). Reply YES to claim it. First reply gets it.`,
      })),
    ],
    log: [{ id: id(), t: now, text: `Texted ${members.length} on the short-notice list for ${slot.time}` }, ...s.log],
    round: { ...s.round, texted: [...s.round.texted, ...ids] },
    phoneId: ids[0],
  };
}

function reducer(s, a) {
  switch (a.type) {
    case "RESET":
      return init(a.clinicKey);

    case "CANCEL": {
      if (s.round) return s;
      const slot = s.slots.find((x) => x.id === a.slotId);
      if (!slot || slot.status !== "booked") return s;
      return {
        ...s,
        slots: s.slots.map((x) => (x.id === slot.id ? { ...x, status: "open", cancelled: x.patient } : x)),
        log: [{ id: id(), t: a.now, kind: "bad", text: `${slot.patient} cancelled ${slot.time} ${slot.service}. ${fmt$(a.value)} at risk` }, ...s.log],
        round: { slotId: slot.id, value: a.value, texted: [], startedAt: a.now },
      };
    }

    case "OFFER": {
      if (!s.round || s.round.texted.length) return s;
      const batch = s.waitlist.filter((w) => w.status === "waiting").slice(0, 3);
      if (!batch.length) {
        return { ...s, round: null, log: [{ id: id(), t: a.now, kind: "bad", text: "Waitlist empty. Slot stays open." }, ...s.log] };
      }
      return offerTo(s, batch, a.now);
    }

    case "REPLY": {
      const m = s.waitlist.find((w) => w.id === a.memberId);
      if (!s.round || !m || m.status !== "texted") return s;
      const c = CLINICS[s.clinicKey];
      const slot = s.slots.find((x) => x.id === s.round.slotId);
      const messages = [...s.messages, { id: id(), memberId: m.id, dir: "in", t: a.now, text: a.yes ? "YES" : "No thanks" }];

      if (!a.yes) {
        let next = {
          ...s, messages,
          waitlist: s.waitlist.map((w) => (w.id === m.id ? { ...w, status: "declined" } : w)),
          log: [{ id: id(), t: a.now, text: `${m.name} passed` }, ...s.log],
        };
        const stillOpen = next.waitlist.find((w) => s.round.texted.includes(w.id) && w.status === "texted");
        if (stillOpen) next = { ...next, phoneId: stillOpen.id };
        else {
          const more = next.waitlist.filter((w) => w.status === "waiting").slice(0, 1);
          if (more.length) next = offerTo(next, more, a.now);
          else next = { ...next, round: null, log: [{ id: id(), t: a.now, kind: "bad", text: "No takers. Slot stays open." }, ...next.log] };
        }
        return next;
      }

      const others = s.waitlist.filter((w) => w.id !== m.id && w.status === "texted");
      const secs = Math.max(1, Math.round((a.now - s.round.startedAt) / 1000));
      return {
        ...s,
        slots: s.slots.map((x) => (x.id === slot.id ? { ...x, status: "filled", patient: m.name } : x)),
        waitlist: s.waitlist.map((w) =>
          w.id === m.id ? { ...w, status: "claimed" } : others.some((o) => o.id === w.id) ? { ...w, status: "waiting" } : w
        ),
        messages: [
          ...messages,
          { id: id(), memberId: m.id, dir: "out", t: a.now, text: `You're booked: ${slot.time} today at ${c.name}. Reply C to cancel. See you soon.` },
          ...others.map((o) => ({
            id: id(), memberId: o.id, dir: "out", t: a.now,
            text: `Thanks ${first(o.name)}, that ${slot.time} slot was just claimed. You're still at the top of our short-notice list.`,
          })),
        ],
        log: [{ id: id(), t: a.now, kind: "good", text: `${m.name} claimed ${slot.time}. Chair refilled in ${secs}s. +${fmt$(s.round.value)}` }, ...s.log],
        recovered: s.recovered + s.round.value,
        refills: s.refills + 1,
        fillTimes: [...s.fillTimes, secs],
        round: null,
      };
    }
    default:
      return s;
  }
}

// ---------- UI pieces ----------
function Ticker({ value }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - start) / 1200);
      const v = a + (value - a) * (1 - Math.pow(1 - p, 3));
      setShown(v);
      from.current = v;
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{fmt$(shown)}</>;
}

function Phone({ member, messages, onReply }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);
  const canReply = member?.status === "texted";
  return (
    <div className="phone">
      <div className="phone-notch" />
      <div className="phone-head">
        <div className="avatar">{member ? member.name[0] : "?"}</div>
        <div>
          <div className="phone-name">{member ? member.name : "Patient phone"}</div>
          <div className="muted small">{member ? member.phone : "Waiting for a cancellation"}</div>
        </div>
      </div>
      <div className="thread">
        {!member && <p className="muted small center">Cancel an appointment to see the text go out.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.dir}`}>{m.text}</div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="phone-actions">
        <button className="btn primary" disabled={!canReply} onClick={() => onReply(member.id, true)}>Reply YES</button>
        <button className="btn" disabled={!canReply} onClick={() => onReply(member.id, false)}>No thanks</button>
      </div>
    </div>
  );
}

function Roi({ inputs, setInputs }) {
  const { perWeek, rate, value, fill, price } = inputs;
  const lostAppts = perWeek * (rate / 100) * 50;
  const lost = lostAppts * value;
  const recovered = lost * (fill / 100);
  const cost = price * 12;
  const field = (key, label, suffix, step = 1) => (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">
        {suffix === "$" && <i>$</i>}
        <input type="number" min="0" step={step} value={inputs[key]}
          onChange={(e) => setInputs({ ...inputs, [key]: Number(e.target.value) || 0 })} />
        {suffix && suffix !== "$" && <i>{suffix}</i>}
      </div>
    </label>
  );
  return (
    <section className="card roi">
      <div className="card-head"><h2>The ROI math</h2><span className="muted small">Per provider, 50 working weeks</span></div>
      <div className="roi-grid">
        <div className="fields">
          {field("perWeek", "Appointments per week", "")}
          {field("rate", "No-show + late cancel rate", "%")}
          {field("value", "Revenue per appointment", "$", 5)}
          {field("fill", "Share of gaps refilled", "%")}
          {field("price", "Backfill subscription", "/mo", 1)}
        </div>
        <div className="roi-out">
          <div className="line"><span>Empty chairs per year</span><b>{Math.round(lostAppts).toLocaleString()}</b></div>
          <div className="line bad"><span>Revenue lost to no-shows</span><b>{fmt$(lost)}</b></div>
          <div className="line good"><span>Recovered by backfill</span><b>{fmt$(recovered)}</b></div>
          <div className="line"><span>Annual cost</span><b>{fmt$(cost)}</b></div>
          <div className="roi-hero">
            <span>Return on spend</span>
            <b>{cost ? `${(recovered / cost).toFixed(1)}x` : "—"}</b>
            <span className="muted small">Pays for itself after {value ? Math.max(1, Math.ceil(price / value)) : "—"} refilled appointment{Math.ceil(price / value) === 1 ? "" : "s"} a month</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Page ----------
export default function Page() {
  const [s, dispatch] = useReducer(reducer, "dental", init);
  const [auto, setAuto] = useState(true);
  const [smsMode, setSmsMode] = useState("simulated");
  const [inputs, setInputs] = useState({ perWeek: 20, rate: 25, value: 325, fill: 50, price: 299 });
  const sentRef = useRef(0);
  const c = CLINICS[s.clinicKey];

  useEffect(() => {
    fetch("/api/sms").then((r) => r.json()).then((d) => setSmsMode(d.mode)).catch(() => {});
  }, []);

  // After a cancellation, text the waitlist.
  useEffect(() => {
    if (s.round && !s.round.texted.length) {
      const t = setTimeout(() => dispatch({ type: "OFFER", now: Date.now() }), 900);
      return () => clearTimeout(t);
    }
  }, [s.round]);

  // Autopilot: the featured patient claims the slot a few seconds later.
  const pending = s.round && s.waitlist.find((w) => w.id === s.phoneId && w.status === "texted");
  useEffect(() => {
    if (auto && pending) {
      const t = setTimeout(() => dispatch({ type: "REPLY", memberId: pending.id, yes: true, now: Date.now() }), 3200);
      return () => clearTimeout(t);
    }
  }, [auto, pending?.id, pending?.status]);

  // Mirror the featured patient's outbound texts to a real phone when Twilio is configured.
  useEffect(() => {
    const fresh = s.messages.slice(sentRef.current);
    sentRef.current = s.messages.length;
    if (smsMode !== "live") return;
    fresh.filter((m) => m.dir === "out" && m.memberId === s.phoneId).forEach((m) =>
      fetch("/api/sms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: m.text }) })
    );
  }, [s.messages, s.phoneId, smsMode]);

  const switchClinic = (key) => {
    sentRef.current = 0;
    dispatch({ type: "RESET", clinicKey: key });
    setInputs((i) => ({ ...i, value: CLINICS[key].value }));
  };
  const cancel = (slotId) => dispatch({ type: "CANCEL", slotId, value: inputs.value, now: Date.now() });
  const nextBooked = s.slots.find((x) => x.status === "booked");
  const phoneMember = s.waitlist.find((w) => w.id === s.phoneId);
  const avgFill = s.fillTimes.length ? Math.round(s.fillTimes.reduce((a, b) => a + b, 0) / s.fillTimes.length) : null;
  const annualLoss = inputs.perWeek * (inputs.rate / 100) * 50 * inputs.value;

  return (
    <main>
      <header className="top">
        <div className="brand">
          <div className="logo">B</div>
          <div>
            <div className="brand-name">Backfill</div>
            <div className="muted small">{c.name} · Today</div>
          </div>
        </div>
        <div className="seg">
          {Object.entries(CLINICS).map(([k, v]) => (
            <button key={k} className={k === s.clinicKey ? "on" : ""} onClick={() => switchClinic(k)}>{v.label}</button>
          ))}
        </div>
        <span className={`badge ${smsMode}`}>SMS: {smsMode === "live" ? "live to demo phone" : "simulated"}</span>
      </header>

      <section className="stats">
        <div className="stat hero">
          <span>Recovered today</span>
          <b key={s.refills} className={s.refills ? "pop" : ""}><Ticker value={s.recovered} /></b>
        </div>
        <div className="stat"><span>Chairs refilled</span><b>{s.refills}</b></div>
        <div className="stat"><span>Avg time to refill</span><b>{avgFill ? `${avgFill}s` : "—"}</b></div>
        <div className="stat"><span>Lost to no-shows per year</span><b className="red">{fmt$(annualLoss)}</b></div>
      </section>

      <div className="controls">
        <button className="btn primary big" disabled={!!s.round || !nextBooked} onClick={() => cancel(nextBooked.id)}>
          {s.round ? "Refilling slot..." : nextBooked ? "Simulate a cancellation" : "All slots used"}
        </button>
        <label className="toggle">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          Autopilot patient reply
        </label>
        <button className="btn ghost" onClick={() => switchClinic(s.clinicKey)}>Reset demo</button>
      </div>

      <div className="grid">
        <section className="card">
          <div className="card-head"><h2>Today's schedule</h2><span className="muted small">{c.label}</span></div>
          <ul className="slots">
            {s.slots.map((x) => (
              <li key={x.id} className={`slot ${x.status}`}>
                <div className="time">{x.time}<span>{x.room}</span></div>
                <div className="who">
                  <div className="pname">{x.status === "open" || x.status === "texting" ? "Open chair" : x.patient}</div>
                  <div className="muted small">
                    {x.service}
                    {x.cancelled && x.status === "filled" && <> · backfilled for {x.cancelled}</>}
                    {x.cancelled && x.status !== "filled" && <> · {x.cancelled} cancelled</>}
                  </div>
                </div>
                <div className="state">
                  {x.status === "booked" && <button className="link" disabled={!!s.round} onClick={() => cancel(x.id)}>Cancel</button>}
                  {x.status === "open" && <span className="pill red">Cancelled</span>}
                  {x.status === "texting" && <span className="pill amber">Texting waitlist</span>}
                  {x.status === "filled" && <span className="pill green">Refilled</span>}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="card-head"><h2>Short-notice waitlist</h2><span className="muted small">{s.waitlist.filter((w) => w.status === "waiting").length} ready</span></div>
          <ul className="wait">
            {s.waitlist.map((w) => (
              <li key={w.id} className={w.id === s.phoneId ? "featured" : ""}>
                <div>
                  <div className="pname">{w.name}</div>
                  <div className="muted small">{w.note}</div>
                </div>
                <span className={`pill ${{ waiting: "", texted: "amber", claimed: "green", declined: "grey" }[w.status]}`}>
                  {{ waiting: "Waiting", texted: "Texted", claimed: "Booked", declined: "Passed" }[w.status]}
                </span>
              </li>
            ))}
          </ul>
          <h3>Activity</h3>
          <ul className="log">
            {!s.log.length && <li className="muted small">Nothing yet.</li>}
            {s.log.slice(0, 8).map((l) => (
              <li key={l.id} className={l.kind || ""}>
                <span className="muted small">{new Date(l.t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}</span>
                {l.text}
              </li>
            ))}
          </ul>
        </section>

        <section className="phone-col">
          <Phone
            member={phoneMember}
            messages={s.messages.filter((m) => m.memberId === s.phoneId)}
            onReply={(memberId, yes) => dispatch({ type: "REPLY", memberId, yes, now: Date.now() })}
          />
        </section>
      </div>

      <Roi inputs={inputs} setInputs={setInputs} />

      <footer className="muted small">
        Demo data only. Default math: 20 appts/week, 25% no-show, $325 per visit. Small dental practices typically lose $52K–$118K a year at 20–30% no-show rates.
      </footer>
    </main>
  );
}
