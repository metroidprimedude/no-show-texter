"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { CLINICS, fmt$, init, reducer } from "./engine";

// ---------- Small helpers ----------
const initials = (name) => name.replace(/\(.*\)/, "").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("");
const clock = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });

const PATHS = {
  check: "M5 12.5l4.5 4.5L19 7.5",
  x: "M6 6l12 12M18 6L6 18",
  msg: "M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v7a2.5 2.5 0 01-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 014 13.5z",
  bolt: "M13 3L5 13.5h6L10 21l8-10.5h-6z",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0",
  chair: "M7 4v8h10M7 12v8M17 12v8M5 12h14",
  back: "M15 5l-7 7 7 7",
  reset: "M4 12a8 8 0 1 0 2.3-5.6M4 4v4.5h4.5",
};
function Icon({ name, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

function Ticker({ value }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - start) / 1400);
      const v = a + (value - a) * (1 - Math.pow(1 - p, 4));
      setShown(v);
      from.current = v;
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{fmt$(shown)}</>;
}

function Sparkline({ points }) {
  const w = 220, h = 44;
  const pts = points.length > 1 ? points : [0, 0];
  const max = Math.max(...pts, 1);
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * w, h - 4 - (v / max) * (h - 10)]);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="sg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--lime)" stopOpacity=".35" />
          <stop offset="1" stopColor="var(--lime)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="url(#sg)" />
      <path d={line} fill="none" stroke="var(--lime)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ---------- Refill pipeline ----------
function Pipeline({ s, elapsed }) {
  const slot = s.round && s.slots.find((x) => x.id === s.round.slotId);
  const texted = s.round?.texted.length || 0;
  const stage = !s.round ? (s.refills ? 5 : 0) : texted ? 3 : 1;
  const steps = [
    { icon: "x", title: "Cancellation", sub: slot ? `${slot.time} · ${slot.cancelled}` : "Watching the schedule" },
    { icon: "msg", title: "Waitlist texted", sub: texted ? `${texted} patient${texted > 1 ? "s" : ""} offered` : "Best matches first" },
    { icon: "user", title: "Patient claims", sub: stage === 3 ? "Waiting for first YES" : "First YES wins" },
    { icon: "chair", title: "Chair refilled", sub: s.refills ? `${s.refills} today` : "Booked and confirmed" },
  ];
  return (
    <section className="pipeline" aria-label="Refill pipeline">
      {steps.map((st, i) => {
        const n = i + 1;
        const state = n < stage ? "done" : n === stage ? "active" : "";
        return (
          <div key={st.title} className={`step ${state}`}>
            <div className="step-icon"><Icon name={state === "done" ? "check" : st.icon} size={15} /></div>
            <div className="step-text">
              <div className="step-title">{st.title}</div>
              <div className="step-sub">{st.sub}</div>
            </div>
          </div>
        );
      })}
      <div className={`timer ${s.round ? "on" : ""}`}>
        <span className="dot" />
        {s.round ? `00:${String(elapsed).padStart(2, "0")}` : "Idle"}
      </div>
    </section>
  );
}

// ---------- Patient phone ----------
function Phone({ clinic, member, messages, typing, onReply }) {
  const threadRef = useRef(null);
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, typing]);
  const canReply = member?.status === "texted";
  return (
    <div className="phone-wrap">
      <div className="phone-label">{member ? `${member.name.split(" (")[0]}'s phone` : "Patient's phone"}</div>
      <div className="phone">
        <div className="screen">
          <div className="status-bar"><span>9:41</span><span className="island" /><span className="sig">5G</span></div>
          <div className="msg-head">
            <span className="back"><Icon name="back" size={18} /></span>
            <div className="msg-contact">
              <div className="msg-avatar">{initials(clinic.name)}</div>
              <div className="msg-name">{clinic.name}</div>
            </div>
          </div>
          <div className="thread" ref={threadRef}>
            {!member ? (
              <div className="empty">
                <Icon name="msg" size={28} />
                <p>No messages yet.<br />Trigger a cancellation to send the first offer.</p>
              </div>
            ) : (
              <div className="stamp">Text Message · Today</div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`bubble ${m.dir}`}>{m.text}</div>
            ))}
          </div>
          <div className="compose">
            <div className="chips">
              <button className="chip yes" disabled={!canReply} onClick={() => onReply(member.id, true)}>YES</button>
              <button className="chip" disabled={!canReply} onClick={() => onReply(member.id, false)}>No thanks</button>
            </div>
            <div className={`field-fake ${typing ? "typing" : ""}`}>{typing ? <>YES<span className="caret" /></> : "Text Message"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- ROI ----------
function Slider({ label, value, min, max, step = 1, format, onChange }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="slider">
      <div className="slider-top"><span>{label}</span><b>{format(value)}</b></div>
      <input type="range" min={min} max={max} step={step} value={value} style={{ "--p": `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Roi({ inputs, setInputs }) {
  const { perWeek, rate, value, fill, price } = inputs;
  const lostAppts = perWeek * (rate / 100) * 50;
  const lost = lostAppts * value;
  const recovered = lost * (fill / 100);
  const cost = price * 12;
  const set = (k) => (v) => setInputs({ ...inputs, [k]: v });
  const breakeven = value ? Math.max(1, Math.ceil(price / value)) : 0;
  return (
    <section className="card roi">
      <div className="roi-left">
        <div className="eyebrow">The math</div>
        <h2 className="display">What empty chairs cost this practice</h2>
        <div className="sliders">
          <Slider label="Appointments per week, per provider" value={perWeek} min={5} max={80} format={(v) => v} onChange={set("perWeek")} />
          <Slider label="No-show + late-cancel rate" value={rate} min={2} max={40} format={(v) => `${v}%`} onChange={set("rate")} />
          <Slider label="Revenue per appointment" value={value} min={50} max={800} step={5} format={fmt$} onChange={set("value")} />
          <Slider label="Share of gaps refilled" value={fill} min={10} max={90} format={(v) => `${v}%`} onChange={set("fill")} />
          <Slider label="Backfill subscription" value={price} min={99} max={799} step={10} format={(v) => `${fmt$(v)}/mo`} onChange={set("price")} />
        </div>
      </div>
      <div className="roi-right">
        <div className="roi-hero">
          <div>
            <div className="eyebrow">Return on spend</div>
            <div className="big">{cost ? (recovered / cost).toFixed(1) : "—"}<span>×</span></div>
          </div>
          <p>Pays for itself after <b>{breakeven} refilled appointment{breakeven === 1 ? "" : "s"}</b> a month.</p>
        </div>
        <div className="bars">
          <div className="bar-row">
            <div className="bar-label"><span>Lost to no-shows</span><b className="coral">{fmt$(lost)}</b></div>
            <div className="track"><div className="fill coral" style={{ width: "100%" }} /></div>
          </div>
          <div className="bar-row">
            <div className="bar-label"><span>Recovered by Backfill</span><b className="green">{fmt$(recovered)}</b></div>
            <div className="track"><div className="fill lime" style={{ width: `${lost ? (recovered / lost) * 100 : 0}%` }} /></div>
          </div>
          <div className="bar-row">
            <div className="bar-label"><span>Annual cost</span><b>{fmt$(cost)}</b></div>
            <div className="track"><div className="fill ink" style={{ width: `${lost ? Math.min(100, (cost / lost) * 100) : 0}%` }} /></div>
          </div>
        </div>
        <div className="roi-foot">{Math.round(lostAppts).toLocaleString()} empty chairs a year · 50 working weeks</div>
      </div>
    </section>
  );
}

// ---------- Page ----------
export default function Page() {
  const [s, dispatch] = useReducer(reducer, "dental", init);
  const [auto, setAuto] = useState(true);
  const [typing, setTyping] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [toast, setToast] = useState(null);
  const [today, setToday] = useState("Today");
  const [smsMode, setSmsMode] = useState("simulated");
  const [inputs, setInputs] = useState({ perWeek: 20, rate: 25, value: 325, fill: 50, price: 299 });
  const sentRef = useRef(0);
  const c = CLINICS[s.clinicKey];

  useEffect(() => {
    setToday(new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }));
    fetch("/api/sms").then((r) => r.json()).then((d) => setSmsMode(d.mode)).catch(() => {});
  }, []);

  // After a cancellation, text the waitlist.
  useEffect(() => {
    if (s.round && !s.round.texted.length) {
      const t = setTimeout(() => dispatch({ type: "OFFER", now: Date.now() }), 1100);
      return () => clearTimeout(t);
    }
  }, [s.round]);

  // Round timer.
  const startedAt = s.round?.startedAt;
  useEffect(() => {
    if (!startedAt) return;
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [startedAt]);

  // Autopilot: patient starts typing, then claims.
  const pending = s.round && s.waitlist.find((w) => w.id === s.phoneId && w.status === "texted");
  useEffect(() => {
    if (!(auto && pending)) return;
    const t1 = setTimeout(() => setTyping(true), 1400);
    const t2 = setTimeout(() => {
      setTyping(false);
      dispatch({ type: "REPLY", memberId: pending.id, yes: true, now: Date.now() });
    }, 3400);
    return () => { clearTimeout(t1); clearTimeout(t2); setTyping(false); };
  }, [auto, pending?.id, pending?.status]);

  // Toast on each refill.
  const lastLog = s.log[0]?.text;
  useEffect(() => {
    if (!s.refills) return;
    setToast(lastLog);
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [s.refills]);

  // Mirror the featured patient's outbound texts to a real phone when Twilio is configured.
  useEffect(() => {
    const fresh = s.messages.slice(sentRef.current);
    sentRef.current = s.messages.length;
    if (smsMode !== "live") return;
    fresh.filter((m) => m.dir === "out" && m.memberId === s.phoneId).forEach((m) => {
      fetch("/api/sms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: m.text }) });
    });
  }, [s.messages, s.phoneId, smsMode]);

  const switchClinic = (key) => {
    sentRef.current = 0;
    setToast(null);
    dispatch({ type: "RESET", clinicKey: key });
    setInputs((i) => ({ ...i, value: CLINICS[key].value }));
  };
  const cancel = (slotId) => dispatch({ type: "CANCEL", slotId, value: inputs.value, now: Date.now() });
  const reply = (memberId, yes) => dispatch({ type: "REPLY", memberId, yes, now: Date.now() });

  const nextBooked = s.slots.find((x) => x.status === "booked");
  const phoneMember = s.waitlist.find((w) => w.id === s.phoneId);
  const avgFill = s.fillTimes.length ? Math.round(s.fillTimes.reduce((a, b) => a + b, 0) / s.fillTimes.length) : null;
  const textsSent = s.messages.filter((m) => m.dir === "out").length;
  const series = [0, ...s.fillTimes.map((_, i) => (i + 1) * inputs.value)];

  return (
    <main>
      <nav className="nav">
        <div className="brand">
          <svg className="mark" viewBox="0 0 32 32" aria-hidden>
            <rect width="32" height="32" rx="9" fill="var(--lime)" />
            <path d="M9.5 17.5a6.5 6.5 0 1 0 2-4.7M9.5 9.5v3.8h3.8" fill="none" stroke="#0c1f12" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="16" cy="17.5" r="2" fill="#0c1f12" />
          </svg>
          <span className="wordmark">Backfill</span>
        </div>
        <div className="seg" role="tablist">
          {Object.entries(CLINICS).map(([k, v]) => (
            <button key={k} role="tab" aria-selected={k === s.clinicKey} className={k === s.clinicKey ? "on" : ""} onClick={() => switchClinic(k)}>{v.label}</button>
          ))}
        </div>
        <div className={`sms ${smsMode}`}><span className="dot" />{smsMode === "live" ? "Live SMS" : "Simulated SMS"}</div>
      </nav>

      <section className="hero">
        <div className="hero-main">
          <div className="hero-meta">{c.name} · {today}</div>
          <div className="hero-label">Recovered today</div>
          <div className="hero-figure">
            <span className="money"><Ticker value={s.recovered} /></span>
            {s.refills > 0 && <span key={s.refills} className="plus">+{fmt$(inputs.value)}</span>}
          </div>
          <Sparkline points={series} />
        </div>
        <div className="hero-side">
          <div className="kpis">
            <div className="kpi"><span>Chairs refilled</span><b>{s.refills}<small>/{s.slots.length}</small></b></div>
            <div className="kpi"><span>Avg time to refill</span><b>{avgFill ? `${avgFill}s` : "—"}</b></div>
            <div className="kpi"><span>Texts sent</span><b>{textsSent}</b></div>
          </div>
          <div className="actions">
            <button className="cta" disabled={!!s.round || !nextBooked} onClick={() => cancel(nextBooked.id)}>
              <Icon name="bolt" />
              {s.round ? "Refilling…" : nextBooked ? "Simulate a cancellation" : "Schedule fully used"}
            </button>
            <div className="action-row">
              <label className="switch">
                <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                <span className="knob" />
                Autopilot replies
              </label>
              <button className="ghost" onClick={() => switchClinic(s.clinicKey)}><Icon name="reset" size={14} />Reset</button>
            </div>
          </div>
        </div>
      </section>

      <Pipeline s={s} elapsed={elapsed} />

      <div className="grid">
        <section className="card">
          <header className="card-head">
            <h2>Today's schedule</h2>
            <span className="legend"><i className="lg-booked" />Booked <i className="lg-open" />Open <i className="lg-filled" />Refilled</span>
          </header>
          <ol className="timeline">
            {s.slots.map((x) => {
              const open = x.status === "open" || x.status === "texting";
              return (
                <li key={x.id} className={`appt ${x.status}`}>
                  <div className="appt-time">{x.time.replace(" ", " ")}</div>
                  <div className="appt-rail"><span /></div>
                  <div className="appt-card">
                    <div className={`av ${open ? "ghost" : ""}`}>{open ? <Icon name="chair" size={14} /> : initials(x.patient)}</div>
                    <div className="appt-body">
                      <div className="appt-name">{open ? "Open chair" : x.patient}</div>
                      <div className="appt-sub">
                        {x.service} · {x.room}
                        {x.cancelled && x.status === "filled" && <> · <em>replaced {x.cancelled}</em></>}
                        {x.cancelled && open && <> · <em>{x.cancelled} cancelled</em></>}
                      </div>
                    </div>
                    {x.status === "booked" && <button className="cancel" disabled={!!s.round} onClick={() => cancel(x.id)}>Cancel</button>}
                    {x.status === "open" && <span className="tag coral">Cancelled</span>}
                    {x.status === "texting" && <span className="tag amber"><span className="pulse" />Texting</span>}
                    {x.status === "filled" && <span className="tag lime"><Icon name="check" size={12} />Refilled</span>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="col">
          <section className="card">
            <header className="card-head">
              <h2>Short-notice waitlist</h2>
              <span className="muted">{s.waitlist.filter((w) => w.status === "waiting").length} ready</span>
            </header>
            <ul className="wait">
              {s.waitlist.map((w, i) => (
                <li key={w.id} className={`${w.id === s.phoneId && s.round ? "featured" : ""} ${w.status}`}>
                  <span className="rank">{i + 1}</span>
                  <div className="wait-body">
                    <div className="wait-name">{w.name}</div>
                    <div className="wait-sub">{w.note}</div>
                    <div className="match" title="Match score: availability, distance, urgency"><div style={{ width: `${w.match}%` }} /></div>
                  </div>
                  <div className="wait-right">
                    <span className="score">{w.match}<small>%</small></span>
                    <span className={`tag ${{ waiting: "", texted: "amber", claimed: "lime", declined: "muted" }[w.status]}`}>
                      {{ waiting: "Ready", texted: "Texted", claimed: "Booked", declined: "Passed" }[w.status]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <header className="card-head"><h2>Activity</h2><span className="muted live"><span className="dot" />Live</span></header>
            <ul className="feed">
              {!s.log.length && <li className="muted">Quiet so far. Cancel an appointment to start.</li>}
              {s.log.slice(0, 6).map((l) => (
                <li key={l.id} className={l.kind || ""}>
                  <span className="feed-dot" />
                  <div><div className="feed-text">{l.text}</div><div className="feed-time">{clock(l.t)}</div></div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="phone-col">
          <Phone clinic={c} member={phoneMember} typing={typing}
            messages={s.messages.filter((m) => m.memberId === s.phoneId)} onReply={reply} />
        </aside>
      </div>

      <Roi inputs={inputs} setInputs={setInputs} />

      <footer className="foot">
        Demo data. Defaults: 20 appointments a week, 25% no-show and late-cancel rate, $325 per visit.
      </footer>

      <div className={`toast ${toast ? "show" : ""}`} role="status">
        <span className="toast-icon"><Icon name="check" size={14} /></span>{toast}
      </div>
    </main>
  );
}
