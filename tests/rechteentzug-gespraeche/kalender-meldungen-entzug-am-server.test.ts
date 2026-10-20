// AW04-K02/K04/K05: vorhandene Erinnerungssteuerung und ihre gespeicherten Projektionen.
// Echte App/Anmeldung/Originale; nur fiktive Daten, Date-Uhr und ein angehaltener Ablageleser.
// Kein Listener, Modell, Provider, Browser oder Office. Alte PV05-Prüfungen werden nicht ersetzt.
import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { KlaraErinnerungLaufbericht } from "../../services/app/src/klara-erinnerung";
import { KlaraNotizDienst } from "../../services/app/src/klara-notiz";

type Konto = { id: string; token: string; email: string };
type Erinnerung = { id: string; fassung: number; status: string };
const BASIS = "/api/me/klara/erinnerungen";
const MARKE = "Fiktive-Sperrquelle-AW04-Kalender";
const KENNWORT = "Aw04-fiktives-Kennwort-1";
let services: ReturnType<typeof assembleServices>;
let app: ReturnType<typeof buildApp>;
let admin: Konto;
let anna: Konto;
let bert: Konto;
let lauf: (() => Promise<KlaraErinnerungLaufbericht>) | null;

async function auf(
  konto: Konto | null,
  method: "GET" | "POST" | "PUT",
  url: string,
  payload?: Record<string, unknown>,
) {
  return app.inject({
    method,
    url,
    headers: konto ? { authorization: `Bearer ${konto.token}` } : {},
    ...(payload ? { payload } : {}),
  });
}

async function anmelden(email: string): Promise<Konto> {
  const r = await auf(null, "POST", "/api/auth/login", { email, password: KENNWORT });
  expect(r.statusCode, r.body).toBe(200);
  const token = r.json<{ token: string }>().token;
  const me = await app.inject({
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${token}` },
  });
  expect(me.statusCode, me.body).toBe(200);
  return { id: me.json<{ id: string }>().id, token, email };
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T08:00:00Z"));
  services = assembleServices(inMemoryRepos());
  lauf = null;
  app = buildApp(services, {
    klaraErinnerungen: (l) => {
      lauf = l;
      return 60_000;
    },
  });
  const registration = await auf(null, "POST", "/api/auth/register", {
    name: "AW04 Admin",
    email: "admin-aw04@klarwerk.test",
    password: KENNWORT,
  });
  expect(registration.statusCode, registration.body).toBe(201);
  admin = await anmelden("admin-aw04@klarwerk.test");
  const konten: Konto[] = [];
  for (const name of ["anna", "bert"]) {
    const email = `${name}-aw04@klarwerk.test`;
    const r = await auf(admin, "POST", "/api/users", {
      name,
      email,
      password: KENNWORT,
      role: "experte",
    });
    expect(r.statusCode, r.body).toBe(201);
    konten.push(await anmelden(email));
  }
  const a = konten[0];
  const b = konten[1];
  if (!a || !b) throw new Error("Fiktive Konten fehlen");
  anna = a;
  bert = b;
});

afterEach(async () => {
  await app.close();
  vi.useRealTimers();
});

async function takt() {
  if (!lauf) throw new Error("Vorhandene Steuerung fehlt");
  return lauf();
}

async function quelle(art: "notiz" | "aufgabe" = "notiz") {
  const ko = await services.ko.create({
    title: MARKE,
    statement: `${MARKE}: fiktive geschützte Messung prüfen.`,
    type: "best_practice",
    category: "Fiktive AW04-Probe",
    confidentiality: "intern",
    author: admin.id,
  });
  await services.ko.setQuellrechte(ko.id, { stufe: "intern", leser: [anna.id, bert.id] }, admin.id);
  // Kontrollierter gespeicherter Herkunftsbestand, wie ihn Norm-/Wissenswege bereits schreiben.
  // Keine Behauptung, dass ein Browser oder Modell diese fiktive Notiz erzeugt hätte.
  const inhalt = ko.statement;
  const { notiz } = await new KlaraNotizDienst({ repo: services.klaraNotizen }).lege(
    anna.id,
    {
      vorgang: `aw04-notiz-${crypto.randomUUID()}`,
      titel: MARKE,
      inhalt,
      weg: "geschrieben",
      objektbezug: { pfad: `/wissen/${ko.id}`, seitenName: "Wissen", objekt: MARKE },
    },
    undefined,
    {
      projekt: "aw04-fiktiv",
      abschnitt: "kalender",
      antwortFassung: "aw04-kalender-1",
      anbieter: null,
      modell: null,
      vorherigeNotiz: null,
      textAbdruck: createHash("sha256").update(inhalt).digest("hex"),
      aussagen: [
        { text: inhalt, art: "behauptung", quellen: [{ id: ko.id, fassung: ko.version }] },
      ],
    },
  );
  expect((await auf(anna, "GET", `/api/me/klara/notizen/${notiz.id}`)).statusCode).toBe(200);
  let bezug: Record<string, string> = { art: "notiz", notizId: notiz.id };
  let aufgabeId: string | null = null;
  if (art === "aufgabe") {
    const a = await auf(anna, "POST", "/api/me/klara/aufgaben", {
      vorgang: `aw04-aufgabe-${crypto.randomUUID()}`,
      weg: "notiz",
      quelle: { notizId: notiz.id },
    });
    expect(a.statusCode, a.body).toBe(201);
    aufgabeId = a.json<{ aufgabe: { id: string } }>().aufgabe.id;
    bezug = { art: "aufgabe", aufgabeId };
  }
  const entziehen = async () => {
    await services.ko.setQuellrechte(ko.id, { stufe: "intern", leser: [] }, admin.id);
    expect((await auf(anna, "GET", `/api/me/klara/notizen/${notiz.id}`)).statusCode).toBe(404);
  };
  const freigeben = () =>
    services.ko.setQuellrechte(ko.id, { stufe: "intern", leser: [anna.id, bert.id] }, admin.id);
  return { ko, notiz, bezug, aufgabeId, entziehen, freigeben };
}

async function erinnere(bezug: Record<string, string>, serie = false): Promise<Erinnerung> {
  const r = await auf(anna, "POST", BASIS, {
    vorgang: `aw04-erinnerung-${crypto.randomUUID()}`,
    bezug,
    zeitzone: "Europe/Berlin",
    zeitplan: serie
      ? {
          art: "serie",
          datum: "2026-10-20",
          uhrzeit: "11:00",
          wiederholung: { takt: "taeglich", intervall: 1, anzahl: 3 },
        }
      : { art: "einmalig", datum: "2026-10-20", uhrzeit: "11:00" },
    ...(bezug.art === "aufgabe" ? { aktion: "aufgabe_pruefen" } : {}),
  });
  expect(r.statusCode, r.body).toBe(201);
  return r.json<{ erinnerung: Erinnerung }>().erinnerung;
}

it.each(["liste", "direkt", "glocke", "empfaenger"] as const)(
  "AW04-K04: gespeicherte %s verrät nach echtem Quellrechteentzug weder Titel noch Erinnerungskennung",
  async (weg) => {
    const q = await quelle();
    const e = await erinnere(q.bezug);
    if (weg === "empfaenger") {
      const r = await auf(anna, "POST", `${BASIS}/${e.id}/uebergabe`, {
        fassung: e.fassung,
        an: bert.email,
      });
      expect(r.statusCode, r.body).toBe(200);
    }
    vi.setSystemTime(new Date("2026-10-20T09:00:00Z"));
    await takt();
    const ziel = weg === "empfaenger" ? bert : anna;
    const url =
      weg === "direkt" ? `${BASIS}/${e.id}` : weg === "glocke" ? "/api/notifications" : BASIS;
    const vorher = await auf(ziel, "GET", url);
    expect(vorher.statusCode, vorher.body).toBe(200);
    expect(vorher.body).toContain(MARKE);
    await q.entziehen();
    const nachher = await auf(ziel, "GET", url);
    expect(nachher.body).not.toContain(MARKE);
    expect(nachher.body).not.toContain(e.id);
    if (weg === "direkt") {
      const unbekannt = await auf(anna, "GET", `${BASIS}/aw04-gibt-es-nicht`);
      expect(nachher.statusCode).toBe(404);
      expect(nachher.body).toBe(unbekannt.body);
    }
    if (weg === "liste") {
      const ueberwachung = await auf(anna, "GET", `${BASIS}/ueberwachung`);
      expect(ueberwachung.statusCode, ueberwachung.body).toBe(200);
      expect(
        Object.values(ueberwachung.json<{ laeufe: Record<string, number> }>().laeufe).every(
          (n) => n === 0,
        ),
      ).toBe(true);
    }
    // Kein Löschen/Neuanlegen als Ersatz für die aktuelle Sichtbarkeitsprüfung.
    expect((await services.klaraErinnerungen.erinnerungen.hole(anna.id, e.id))?.erinnerung.id).toBe(
      e.id,
    );
  },
);

it("AW04-K02: Entzug der geschützten Aufgabenquelle im gehaltenen Planungsschritt verhindert die Meldung", async () => {
  const q = await quelle("aufgabe");
  const e = await erinnere(q.bezug);
  const original = services.klaraAufgaben.hole.bind(services.klaraAufgaben);
  let erreicht!: () => void;
  let weiter!: () => void;
  const wartet = new Promise<void>((r) => {
    erreicht = r;
  });
  const sperre = new Promise<void>((r) => {
    weiter = r;
  });
  let halten = true;
  services.klaraAufgaben.hole = async (...args) => {
    const a = await original(...args);
    if (halten) {
      halten = false;
      erreicht();
      await sperre;
    }
    return a;
  };
  vi.setSystemTime(new Date("2026-10-20T09:00:00Z"));
  const arbeit = takt();
  try {
    await wartet;
    await q.entziehen();
    const direkt = await auf(anna, "GET", `/api/me/klara/aufgaben/${q.aufgabeId}`);
    expect(direkt.statusCode, direkt.body).toBe(404);
  } finally {
    weiter();
    await arbeit;
    services.klaraAufgaben.hole = original;
  }
  expect(await services.klaraErinnerungen.meldungen.fuerKonto(anna.id, 100)).toEqual([]);
  const laeufe = await services.klaraErinnerungen.laeufe.fuerErinnerung(e.id, 100);
  expect(laeufe.some((l) => l.status === "zugestellt")).toBe(false);
});

it("AW04-K05: erneute Freigabe startet die ausdrücklich beendete Serie nicht; eigene freie Erinnerung bleibt nutzbar", async () => {
  const q = await quelle();
  const e = await erinnere(q.bezug, true);
  const ende = await auf(anna, "POST", `${BASIS}/${e.id}/status`, {
    fassung: e.fassung,
    aktion: "beenden",
  });
  expect(ende.statusCode, ende.body).toBe(200);
  await q.entziehen();
  await q.freigeben();
  const frei = await auf(anna, "POST", BASIS, {
    vorgang: "aw04-freie-kontrolle",
    titel: "Fiktive eigene freie Erinnerung",
    zeitzone: "Europe/Berlin",
    zeitplan: { art: "einmalig", datum: "2026-10-20", uhrzeit: "11:00" },
  });
  expect(frei.statusCode, frei.body).toBe(201);
  vi.setSystemTime(new Date("2026-10-20T09:00:00Z"));
  await takt();
  vi.setSystemTime(new Date("2026-10-21T09:00:00Z"));
  await takt();
  expect(
    (await services.klaraErinnerungen.erinnerungen.hole(anna.id, e.id))?.erinnerung.status,
  ).toBe("beendet");
  expect((await services.klaraErinnerungen.laeufe.fuerErinnerung(e.id, 100)).length).toBe(0);
  const meldungen = await services.klaraErinnerungen.meldungen.fuerKonto(anna.id, 100);
  expect(meldungen.some((m) => m.erinnerungId === e.id)).toBe(false);
  expect(meldungen.some((m) => m.titel === "Fiktive eigene freie Erinnerung")).toBe(true);
});
