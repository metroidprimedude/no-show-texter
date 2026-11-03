// ---------- Demo data ----------
export const TIMES = ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"];

export const CLINICS = {
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

export const first = (name) => name.split(" ")[0];
export const fmt$ = (n) => "$" + Math.round(n).toLocaleString("en-US");
let uid = 0;
const id = () => ++uid;

// ---------- State machine ----------
export function init(clinicKey) {
  const c = CLINICS[clinicKey];
  return {
    clinicKey,
    slots: TIMES.map((time, i) => ({
      id: i, time, room: `${c.room} ${(i % 3) + 1}`, patient: c.patients[i], service: c.services[i], status: "booked",
    })),
    waitlist: c.waitlist.map((w, i) => ({ ...w, id: i, status: "waiting", match: [97, 92, 86, 81, 74, 68][i] })),
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

export function reducer(s, a) {
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

