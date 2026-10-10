// ================================================================================================
// aufnahme:20260922:gesamt-wissen-frische — DIE WEGE AM ECHTEN SERVER (In-Memory-Aufbau).
// ================================================================================================
//
// Gemessen über `app.inject` gegen die echte Kompositionswurzel: echtes Login, echte Rollen, echte
// Lese- und Mutationsrouten. Kein Nachbau der Regel — die reine Ableitung prüft
// `services/knowledge-object/src/frische.test.ts`.
//
//   R-0207 / R-0236 / R-0652 / FR-EXT-06: beide Lesewege liefern `frische` (Stufe, Schutz,
//            Betriebsmodell, Dokumente, aktueller Stand, nächster Schritt).
//   R-0206 / R-1746: „Stimmt weiterhin" — Frische-Signal ohne neue Fassung, ohne Statuswechsel.
//   R-0248: nur die Bestätigung des Verantwortlichen setzt die Frist neu.
//   R-1732 / R-1745: erneute Prüfung aus der Bibliothek → Merker → Reiter „Erneut".
//   R-0203 / R-1635 / FR-LIF-01: Anlagenänderung über ein Objekt markiert die Nachbarn; „Noch
//            gültig" erzeugt eine Fassung und räumt den Merker.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;

interface Frische {
  stufe: string;
  gesichert: boolean;
  aktuellerStand: boolean;
  schutz: string | null;
  betriebsmodell: string;
  inDokumente: boolean;
  naechsterSchritt: string;
  verantwortlich: string;
  letztesSignal: { at: string; by: string } | null;
}

interface Objekt {
  id: string;
  status: string;
  version: number;
  author: string;
  frische?: Frische;
}

async function login(app: App, email: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
  });
  expect(res.statusCode, res.body).toBe(200);
  return { authorization: `Bearer ${(res.json() as { token: string }).token}` };
}

async function aufbau(marke: string) {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: `admin@${marke}.test`, password: "geheim12345" },
  });
  const admin = await login(app, `admin@${marke}.test`);
  for (const [email, role] of [
    [`viewer@${marke}.test`, "viewer"],
    [`experte@${marke}.test`, "experte"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "geheim12345", role },
    });
    expect(res.statusCode, res.body).toBe(201);
  }
  const viewer = await login(app, `viewer@${marke}.test`);
  const experte = await login(app, `experte@${marke}.test`);
  return { app, admin, viewer, experte };
}

// Jedes Objekt bekommt eine eigene Aussage, damit keine Dublettenerkennung die Freigabe aufhält.
const AUSSAGEN = [
  "Bei Überdruck das Ventil manuell schließen.",
  "Den Filter der Kühlpumpe wöchentlich reinigen.",
  "Nach Schichtwechsel die Förderbandspannung messen.",
  "Schweißnähte am Kessel jährlich röntgen lassen.",
];
let naechsteAussage = 0;

async function anlegen(app: App, headers: Kopf, titel: string): Promise<string> {
  const statement = AUSSAGEN[naechsteAussage % AUSSAGEN.length] ?? AUSSAGEN[0];
  naechsteAussage += 1;
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      confidentiality: "intern",
      title: titel,
      statement,
      type: "best_practice",
      category: "Anlage 7",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return (res.json() as { id: string }).id;
}

function put(app: App, headers: Kopf, id: string, payload: Record<string, unknown>) {
  return app.inject({ method: "PUT", url: `/api/kos/${id}`, headers, payload });
}

async function lesen(app: App, headers: Kopf, id: string): Promise<Objekt> {
  const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Objekt;
}

async function faellig(app: App, headers: Kopf): Promise<string[]> {
  const res = await app.inject({ method: "GET", url: "/api/lifecycle/pending", headers });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as string[];
}

async function geprueftesObjekt(app: App, admin: Kopf, titel: string): Promise<string> {
  const id = await anlegen(app, admin, titel);
  const frei = await put(app, admin, id, { action: "admin-validate" });
  expect(frei.statusCode, frei.body).toBe(200);
  return id;
}

describe("Lesewege: zwei Sichten je Objekt mit Empfehlung (R-0207 / R-0652 / FR-EXT-06)", () => {
  it("Detail und Liste tragen dieselbe Frische-Auskunft", async () => {
    const { app, admin } = await aufbau("f1");
    const id = await geprueftesObjekt(app, admin, "Frisch geprüftes Wissen");
    const detail = await lesen(app, admin, id);
    expect(detail.status).toBe("validiert");
    expect(detail.frische?.stufe).toBe("frisch");
    expect(detail.frische?.gesichert).toBe(true);
    expect(detail.frische?.aktuellerStand).toBe(true);
    expect(detail.frische?.schutz).toBe("intern");
    expect(detail.frische?.betriebsmodell).toBe("freigegebene_ki");
    expect(detail.frische?.inDokumente).toBe(true);
    expect(detail.frische?.naechsterSchritt).toBe("keiner");
    expect(detail.frische?.verantwortlich).toBe(detail.author);

    const liste = await app.inject({ method: "GET", url: "/api/kos", headers: admin });
    expect(liste.statusCode, liste.body).toBe(200);
    const eintrag = (liste.json() as Objekt[]).find((k) => k.id === id);
    expect(eintrag?.frische?.stufe).toBe("frisch");
    expect(eintrag?.frische?.inDokumente).toBe(true);
  });

  it("GEGENPROBE: ungeprüftes Wissen darf nicht in Dokumente und verlangt die Prüfung", async () => {
    const { app, admin } = await aufbau("f2");
    const id = await anlegen(app, admin, "Noch offenes Wissen");
    const detail = await lesen(app, admin, id);
    expect(detail.status).toBe("offen");
    expect(detail.frische?.inDokumente).toBe(false);
    expect(detail.frische?.gesichert).toBe(false);
    expect(detail.frische?.naechsterSchritt).toBe("validierung_abschliessen");
  });
});

describe("„Stimmt weiterhin“ — Frische-Signal, keine neue Prüfung (R-0206 / R-1746 / R-0248)", () => {
  it("jeder Leser kann es setzen; Fassung und Status bleiben, das Signal steht am Objekt", async () => {
    const { app, admin, viewer } = await aufbau("f3");
    const id = await geprueftesObjekt(app, admin, "Angewendetes Wissen");
    const vorher = await lesen(app, admin, id);

    const res = await put(app, viewer, id, { action: "confirm-fresh" });
    expect(res.statusCode, res.body).toBe(200);
    const nachher = await lesen(app, admin, id);
    expect(nachher.version).toBe(vorher.version);
    expect(nachher.status).toBe("validiert");
    expect(vorher.frische?.letztesSignal).toBeNull();
    expect(nachher.frische?.letztesSignal?.by).toBeTruthy();
    // Bestätigt hat der Betrachter, nicht der Verantwortliche (der Autor, hier der Admin).
    expect(nachher.frische?.letztesSignal?.by).not.toBe(nachher.frische?.verantwortlich);
    expect(nachher.frische?.gesichert).toBe(true);
  });

  it("GEGENPROBE: an ungeprüftem Wissen wird nichts bestätigt", async () => {
    const { app, admin } = await aufbau("f4");
    const id = await anlegen(app, admin, "Ungeprüft");
    const res = await put(app, admin, id, { action: "confirm-fresh" });
    expect(res.statusCode, res.body).toBe(400);
    expect((await lesen(app, admin, id)).frische?.letztesSignal).toBeNull();
  });
});

describe("Erneute Prüfung aus der Bibliothek (R-1732 / R-1745)", () => {
  it("die Anforderung stellt das Objekt in die Fälligkeitsliste; „Noch gültig“ räumt es", async () => {
    const { app, admin, experte } = await aufbau("f5");
    const id = await geprueftesObjekt(app, admin, "Zur erneuten Prüfung");
    expect(await faellig(app, admin)).not.toContain(id);

    const anfrage = await put(app, experte, id, { action: "request-revalidation" });
    expect(anfrage.statusCode, anfrage.body).toBe(204);
    expect(await faellig(app, admin)).toContain(id);
    const markiert = await lesen(app, admin, id);
    expect(markiert.frische?.stufe).toBe("faellig");
    expect(markiert.frische?.gesichert).toBe(false);
    expect(markiert.frische?.naechsterSchritt).toBe("erneut_bestaetigen");

    // produkt:20261010:aenderungsfolgen-sichtbar (Nacharbeit 4): ohne Stand kein Abschluss.
    const ohneStand = await put(app, admin, id, { action: "revalidate" });
    expect(ohneStand.statusCode, ohneStand.body).toBe(409);
    expect(await faellig(app, admin)).toContain(id);
    const gezeigt = await lesen(app, admin, id);
    const bestaetigt = await put(app, admin, id, {
      action: "revalidate",
      stand: 1,
      fassung: gezeigt.version,
    });
    expect(bestaetigt.statusCode, bestaetigt.body).toBe(200);
    expect(await faellig(app, admin)).not.toContain(id);
  });

  it("GEGENPROBE: ein Betrachter darf keine Prüfung anstossen", async () => {
    const { app, admin, viewer } = await aufbau("f6");
    const id = await geprueftesObjekt(app, admin, "Nur lesbar");
    const anfrage = await put(app, viewer, id, { action: "request-revalidation" });
    expect(anfrage.statusCode, anfrage.body).toBe(403);
    expect(await faellig(app, admin)).not.toContain(id);
  });
});

describe("Auslöser über benachbarte Wissensobjekte (R-0203 / R-1635 / FR-LIF-01)", () => {
  it("die Meldung an EINEM Objekt markiert alle Objekte an denselben Anlagen — nur sie", async () => {
    const { app, admin } = await aufbau("f7");
    const a = await geprueftesObjekt(app, admin, "Druckventil der Presse");
    const b = await geprueftesObjekt(app, admin, "Kühlpumpe am Härteofen");
    const c = await geprueftesObjekt(app, admin, "Förderband im Versand");
    for (const [koId, anlage] of [
      [a, "anlage-7"],
      [b, "anlage-7"],
      [c, "anlage-9"],
    ] as const) {
      const res = await app.inject({
        method: "POST",
        url: "/api/lifecycle/couple",
        headers: admin,
        payload: { assetRef: anlage, koId },
      });
      expect([200, 204], res.body).toContain(res.statusCode);
    }

    const meldung = await put(app, admin, a, { action: "neighbors-changed" });
    expect(meldung.statusCode, meldung.body).toBe(200);
    expect(meldung.json()).toEqual({ markiert: 2 });
    const liste = await faellig(app, admin);
    expect(liste).toContain(a);
    expect(liste).toContain(b);
    expect(liste, "ein Objekt an einer anderen Anlage bleibt unberührt").not.toContain(c);

    // FR-LIF-01: Bestätigen versioniert und räumt den Merker.
    const vorher = await lesen(app, admin, b);
    const bestaetigt = await put(app, admin, b, {
      action: "revalidate",
      stand: 1,
      fassung: vorher.version,
    });
    expect(bestaetigt.statusCode, bestaetigt.body).toBe(200);
    expect((bestaetigt.json() as Objekt).version).toBe(vorher.version + 1);
    expect(await faellig(app, admin)).not.toContain(b);
  });

  it("GEGENPROBE: ein Experte darf die Anlagenänderung nicht melden (ko.validate)", async () => {
    const { app, admin, experte } = await aufbau("f8");
    const a = await geprueftesObjekt(app, admin, "Objekt an Anlage 3");
    await app.inject({
      method: "POST",
      url: "/api/lifecycle/couple",
      headers: admin,
      payload: { assetRef: "anlage-3", koId: a },
    });
    const meldung = await put(app, experte, a, { action: "neighbors-changed" });
    expect(meldung.statusCode, meldung.body).toBe(403);
    expect(await faellig(app, admin)).not.toContain(a);
  });
});
