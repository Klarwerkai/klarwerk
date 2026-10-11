// ================================================================================================
// VORLAGEN-EINREICHUNG GEGEN SPACELÖSCHUNG — kein Partnerartikel fällt in den Firmenkontext.
// ================================================================================================
//
// Auftrag `aufnahme:20260922:gesamt-wissensprojekte`, Kriterien „Verknüpfungen bleiben konsistent“
// und „Firmen- und Projektfilter stimmen“. Nacharbeit 8, Bens Befund: Nach erfolgreicher
// Vorlagenprüfung wurde der Partner-Space gelöscht; die Anlage endete mit 201 OHNE Space, ein
// Nichtmitglied las Artikel und Nutzungsbeleg, und der Artikel stand im Firmenkontext.
//
// Der Fall K ist Bens Reproduktion (`HILFE/d104b3c78bf2877d9131a861/vorlagen-loeschkonflikt.test.ts`)
// mit unveränderten Sollwerten — nur ohne absolute Pfade und Dateiausgabe. Er hält `KoService.create`
// NACH der Vorlagenprüfung an, startet die echte Löschung und lässt die Anlage dann weiterlaufen.
// Dazu die beiden Ausgänge, die die Korrektur jetzt hat:
//   V · die Löschung gewinnt VOR der Prüfung → 409 `SPACE_GELOESCHT`, nichts entsteht;
//   Z · die Zuordnung scheitert nach der Anlage → 409 `VORLAGE_SPACE_KONFLIKT`, die Anlage ist
//       zurückgenommen, kein Nutzungsbeleg.
// Alle Daten sind künstlich; keine externen Zugänge.
import { expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const KENNWORT = "synthetisch-vorlage-2026";
const TITEL = "Synthetische Partner-FAQ";

async function buehne() {
  const services = buildServices();
  const app = buildApp(services);
  const erstes = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Probe Admin", email: "admin@vorlagenrace.test", password: KENNWORT },
  });
  expect(erstes.statusCode).toBe(201);
  async function anmelden(email: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: KENNWORT },
    });
    expect(res.statusCode).toBe(200);
    return { authorization: `Bearer ${res.json().token}` };
  }
  const admin = await anmelden("admin@vorlagenrace.test");
  const fremd = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: {
      name: "Probe OhnePartner",
      email: "fremd@vorlagenrace.test",
      role: "viewer",
      password: KENNWORT,
    },
  });
  expect(fremd.statusCode).toBe(201);
  const aussen = await anmelden("fremd@vorlagenrace.test");
  const konten = await app.inject({ method: "GET", url: "/api/spaces/konten", headers: admin });
  const zustaendig = (konten.json().konten as { id: string; name: string }[]).find(
    (u) => u.name === "Probe Admin",
  )?.id;
  const space = await app.inject({
    method: "POST",
    url: "/api/spaces",
    headers: admin,
    payload: {
      name: "Synthetischer Partnerraum",
      zweck: "Künstlicher Bestand für Löschkonflikt",
      verantwortlich: zustaendig,
      zugang: "mitglieder",
      mitglieder: [],
      ansichten: [],
      kontext: "partner",
      partner: "Künstlicher Partner",
    },
  });
  expect(space.statusCode, space.body).toBe(201);
  return { app, services, admin, aussen, sid: space.json().id as string };
}

type Buehne = Awaited<ReturnType<typeof buehne>>;

function anlegen(b: Buehne) {
  return b.app.inject({
    method: "POST",
    url: "/api/kos",
    headers: b.admin,
    payload: {
      confidentiality: "intern",
      type: "best_practice",
      title: TITEL,
      statement: "Rein künstliche Aussage.",
      category: "Allgemein",
      tags: [],
      bodyHtml:
        "<h2>FAQ</h2><h3>Frage</h3><p>Künstliche Frage?</p><h3>Antwort</h3><p>Künstliche Antwort.</p>",
      vorlage: { id: "std-faq", version: 1, spaceId: b.sid },
    },
  });
}

function loeschen(b: Buehne) {
  return b.app.inject({
    method: "POST",
    url: `/api/spaces/${b.sid}/loeschung`,
    headers: b.admin,
    payload: { version: 1 },
  });
}

/**
 * gesamt-leserechte (Nacharbeit 32): einen Space mit leerem sichtbarem Bestand löscht nur, wer
 * ausdrückliches Existenzrecht hat (`KLARWERK_EXISTENZRECHT`). V und Z erteilen es dem Admin.
 */
async function mitExistenzrecht<T>(arbeit: () => Promise<T>): Promise<T> {
  const vorher = process.env.KLARWERK_EXISTENZRECHT;
  process.env.KLARWERK_EXISTENZRECHT = "admin@vorlagenrace.test";
  try {
    return await arbeit();
  } finally {
    if (vorher === undefined) {
      delete process.env.KLARWERK_EXISTENZRECHT;
    } else {
      process.env.KLARWERK_EXISTENZRECHT = vorher;
    }
  }
}

/** Was ein Nichtmitglied und der Firmenfilter vom Ergebnis sehen — gleich für alle Fälle. */
async function lage(b: Buehne) {
  const ko = (await b.services.ko.listEinschliesslichPapierkorb()).find((x) => x.title === TITEL);
  const lesen = ko
    ? await b.app.inject({ method: "GET", url: `/api/kos/${ko.id}`, headers: b.aussen })
    : undefined;
  const firma = await b.app.inject({
    method: "GET",
    url: "/api/spaces/artikel?kontext=firma",
    headers: b.aussen,
  });
  const partner = await b.app.inject({
    method: "GET",
    url: "/api/spaces/artikel?kontext=partner",
    headers: b.admin,
  });
  expect(firma.statusCode).toBe(200);
  expect(partner.statusCode).toBe(200);
  const nutzung = ko ? (await b.services.vorlagen.fassungen("nutzung", ko.id)).at(-1) : undefined;
  const ids = (res: typeof firma) => (res.json().artikel as { id: string }[]).map((a) => a.id);
  return {
    ko,
    lesen,
    imFirmenfilter: Boolean(ko && ids(firma).includes(ko.id)),
    imPartnerfilter: Boolean(ko && ids(partner).includes(ko.id)),
    nutzung: nutzung as { spaceId?: string | null } | undefined,
  };
}

it("Kontrolle: Partnerinhalt bleibt ohne Löschung für Nichtmitglieder verborgen", async () => {
  const b = await buehne();
  try {
    const res = await anlegen(b);
    expect(res.statusCode, res.body).toBe(201);
    const l = await lage(b);
    expect(l.ko?.spaceId).toBe(b.sid);
    expect(l.lesen?.statusCode, "Nichtmitglied darf internen Partnerinhalt nicht lesen").toBe(404);
    expect(l.imFirmenfilter, "Partnerinhalt darf nicht in Firmenkontext ausweichen").toBe(false);
    expect(l.imPartnerfilter).toBe(true);
    expect(l.nutzung?.spaceId).toBe(b.sid);
  } finally {
    await b.app.close();
  }
});

it("K · Löschkonflikt: kein Firmenkontext-Rückfall und kein fremder Lesezugriff", async () => {
  const b = await buehne();
  const original = b.services.ko.create.bind(b.services.ko);
  let weiter = () => {};
  try {
    let erreicht = () => {};
    const angekommen = new Promise<void>((r) => {
      erreicht = r;
    });
    const tor = new Promise<void>((r) => {
      weiter = r;
    });
    b.services.ko.create = async (...args: Parameters<typeof original>) => {
      erreicht();
      await tor;
      return original(...args);
    };
    const anlage = anlegen(b);
    await angekommen;
    const loeschung = loeschen(b);
    // Die Löschung bekommt 100 ms, um vor der Anlage fertig zu werden — ohne Sperre gelang ihr das.
    const frueh = await Promise.race([
      loeschung,
      new Promise<null>((r) => setTimeout(() => r(null), 100)),
    ]);
    weiter();
    const res = await anlage;
    const geloescht = await loeschung;
    const l = await lage(b);
    expect(l.imFirmenfilter, "Partnerinhalt darf nicht in Firmenkontext ausweichen").toBe(false);
    if (l.ko) {
      expect(l.lesen?.statusCode, "Nichtmitglied darf internen Partnerinhalt nicht lesen").toBe(
        404,
      );
    }
    if (geloescht.statusCode === 200) {
      expect(res.statusCode, "Gewonnene Löschung muss als Anlagekonflikt erkennbar sein").toBe(409);
      expect(l.ko, "Kein breiter sichtbarer Restartikel").toBeUndefined();
      expect(l.nutzung, "Kein irreführender erfolgreicher Nutzungsbeleg").toBeUndefined();
    } else {
      expect(res.statusCode, res.body).toBe(201);
      expect(l.ko?.spaceId).toBe(b.sid);
      expect(l.imPartnerfilter).toBe(true);
      expect(l.nutzung?.spaceId).toBe(b.sid);
      expect(geloescht.statusCode).toBe(409);
    }
    // Mit der Sperre wartet die Löschung auf die Anlage — sie kann nicht vorher fertig sein.
    expect(frueh, "die Löschung lief an der Sperre vorbei").toBeNull();
    expect((await b.services.spaces.aktuelle()).some((s) => s.id === b.sid)).toBe(true);
  } finally {
    weiter();
    b.services.ko.create = original;
    await b.app.close();
  }
});

it("V · Löschung vor der Einreichung: 409 SPACE_GELOESCHT, es entsteht nichts", async () => {
  const b = await buehne();
  try {
    expect((await mitExistenzrecht(() => loeschen(b))).statusCode).toBe(200);
    const res = await anlegen(b);
    expect(res.statusCode, res.body).toBe(409);
    expect(res.json().error).toBe("SPACE_GELOESCHT");
    const l = await lage(b);
    expect(l.ko).toBeUndefined();
    expect(l.imFirmenfilter).toBe(false);
  } finally {
    await b.app.close();
  }
});

it("Z · scheitert die Zuordnung, ist die Anlage zurückgenommen: 409, kein Restartikel, kein Beleg", async () => {
  const b = await buehne();
  const original = b.services.ko.setLeadingSpace.bind(b.services.ko);
  try {
    b.services.ko.setLeadingSpace = async () => {
      throw new Error("künstlicher Speicherfehler");
    };
    const res = await anlegen(b);
    expect(res.statusCode, res.body).toBe(409);
    expect(res.json().error).toBe("VORLAGE_SPACE_KONFLIKT");
    const l = await lage(b);
    expect(l.ko, "Kein breiter sichtbarer Restartikel").toBeUndefined();
    expect(l.imFirmenfilter).toBe(false);
    expect(l.nutzung).toBeUndefined();
    // Der Space bleibt, wie er war — und lässt sich löschen, weil nichts in ihm liegt.
    b.services.ko.setLeadingSpace = original;
    expect((await mitExistenzrecht(() => loeschen(b))).statusCode).toBe(200);
  } finally {
    b.services.ko.setLeadingSpace = original;
    await b.app.close();
  }
});
