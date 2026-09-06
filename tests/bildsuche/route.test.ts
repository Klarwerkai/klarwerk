// ================================================================================================
// JOB 3095 · M5 — BILDER FINDEN: DIE ROUTE `GET /api/library/images` AM ECHTEN HTTP-WEG
// ================================================================================================
//
// Gemessen wird der Weg, den die Fläche geht (Anmeldung, Rechte, Antwortform) — nicht ein Dienst
// darunter. Die Zusage: Ein vorhandenes Bild wird anhand seiner UNTERSCHRIFT gefunden und kommt
// mit Herkunft (Quelle, Version, Prüfstand) zurück; ein Bild aus einem Objekt, das der Anfragende
// nicht lesen darf, kommt NICHT — weder als Treffer noch als Textschnipsel.
//
// Red-first: vor JOB 3095 kannte der Server diese Route nicht (404).
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

interface Treffer {
  imageId: string;
  koId: string;
  koTitel: string;
  version: number;
  pruefstand: string;
  caption: string;
  // Runde 2: die Benennung des Bildes (alt-Text bzw. Anhangsname), ehrlich null, wenn keine da ist;
  // und WORÜBER gefunden wurde.
  name: string | null;
  gefundenUeber: ("beschreibung" | "name")[];
  thumbnailUrl: string;
}
interface Antwort {
  treffer: Treffer[];
  geprueft: string;
  gedeckelt: boolean;
}

const SCHRAUB_CAPTION = "Schraubverbindung M12 mit Sicherungsblech";
const VERTRAULICH_CAPTION = "Schraubsicherung an der Geheimanlage";
const VENTIL_CAPTION = "Ventil V2 am Pumpenkopf";

function figur(id: string, src: string, caption: string): string {
  return (
    `<figure data-image-id="${id}"><img data-image-id="${id}" src="${src}">` +
    `<figcaption data-image-id="${id}">${caption}</figcaption></figure>`
  );
}

async function login(app: App, email: string, password: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

async function setup() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@bildsuche.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@bildsuche.test", "geheim12345");
  for (const email of ["autor@bildsuche.test", "fremd@bildsuche.test"]) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "geheim12345", role: "experte" },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }
  return {
    app,
    admin,
    autor: await login(app, "autor@bildsuche.test", "geheim12345"),
    fremd: await login(app, "fremd@bildsuche.test", "geheim12345"),
  };
}

async function anlegen(app: App, headers: Auth, payload: Record<string, unknown>): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/api/kos", headers, payload });
  if (res.statusCode !== 201) {
    throw new Error(`Anlage fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return res.json().id as string;
}

async function bildsuche(
  app: App,
  headers: Auth,
  q: string,
  limit?: number,
): Promise<{ status: number; body: string; json: Antwort }> {
  const url = `/api/library/images?q=${encodeURIComponent(q)}${limit === undefined ? "" : `&limit=${limit}`}`;
  const res = await app.inject({ method: "GET", url, headers });
  return {
    status: res.statusCode,
    body: res.body,
    json:
      res.statusCode === 200
        ? (res.json() as Antwort)
        : { treffer: [], geprueft: "", gedeckelt: false },
  };
}

/** Der Bestand des Auftrags: zwei Objekte mit Unterschrift, eines davon mit dem Suchwort. */
async function bestand(app: App, autor: Auth): Promise<{ schraub: string; ventil: string }> {
  const schraub = await anlegen(app, autor, {
    title: "Wartungsnotiz Pumpe P-12",
    statement: "Kurzfassung ohne das Suchwort.",
    type: "best_practice",
    category: "Wartung",
    bodyHtml: `<p>Einleitung.</p>${figur("schraub-1", "/api/objects/s1/raw", SCHRAUB_CAPTION)}`,
  });
  const ventil = await anlegen(app, autor, {
    title: "Ventilwechsel",
    statement: "Kurzfassung.",
    type: "best_practice",
    category: "Wartung",
    bodyHtml: figur("ventil-1", "/api/objects/v1/raw", VENTIL_CAPTION),
  });
  return { schraub, ventil };
}

describe("JOB 3095 · GET /api/library/images — Bilder anhand ihrer Unterschrift", () => {
  it("R1 · „Schraub“ findet GENAU das eine Bild — mit Unterschrift und Herkunft", async () => {
    const { app, autor } = await setup();
    const { schraub } = await bestand(app, autor);

    const res = await bildsuche(app, autor, "Schraub");
    expect(res.status, res.body).toBe(200);
    expect(res.json.treffer).toHaveLength(1);
    const [t] = res.json.treffer;
    expect(t).toEqual({
      imageId: "schraub-1",
      koId: schraub,
      koTitel: "Wartungsnotiz Pumpe P-12",
      version: 1,
      pruefstand: "offen",
      caption: SCHRAUB_CAPTION,
      name: null,
      gefundenUeber: ["beschreibung"],
      thumbnailUrl: "/api/objects/s1/raw",
    });
    // Die Antwort trägt eine frische Prüfzeit (Grundlage des Satzes „geprüft <Zeit>“ an der Fläche)
    // und keinen Deckel-Hinweis, wenn nichts abgeschnitten wurde.
    expect(Number.isNaN(Date.parse(res.json.geprueft))).toBe(false);
    expect(res.json.gedeckelt).toBe(false);
    // Kein Rumpf auf dem Draht: nur die Trefferfelder, kein figure-Markup.
    expect(res.body).not.toContain("<figure");
    expect(res.body).not.toContain("Einleitung.");
  });

  it("R2 · ein Suchwort, das nur im TITEL steht, liefert kein Bild — gesucht wird die Unterschrift", async () => {
    const { app, autor } = await setup();
    await anlegen(app, autor, {
      title: "Schraubenkunde",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml: figur("dichtung-1", "/api/objects/d1/raw", "Dichtring am Deckel"),
    });
    const res = await bildsuche(app, autor, "Schraub");
    expect(res.status, res.body).toBe(200);
    expect(res.json.treffer).toEqual([]);
  });

  it("R3 · Groß-/Kleinschreibung spielt keine Rolle, ein Teilwort genügt", async () => {
    const { app, autor } = await setup();
    await bestand(app, autor);
    expect((await bildsuche(app, autor, "sicherungsblech")).json.treffer).toHaveLength(1);
    expect((await bildsuche(app, autor, "VENTIL v2")).json.treffer).toHaveLength(1);
  });

  it("R4 · ohne Suchwort antwortet die Route 400 statt den Bestand auszuliefern", async () => {
    const { app, autor } = await setup();
    await bestand(app, autor);
    const res = await app.inject({
      method: "GET",
      url: "/api/library/images?q=%20%20",
      headers: autor,
    });
    expect(res.statusCode, res.body).toBe(400);
    expect(res.json().error).toBe("BAD_REQUEST");
  });

  it("R5 · ohne Anmeldung gibt es nichts", async () => {
    const { app, autor } = await setup();
    await bestand(app, autor);
    const res = await app.inject({ method: "GET", url: "/api/library/images?q=Schraub" });
    expect(res.statusCode).toBe(401);
    expect(res.body).not.toContain(SCHRAUB_CAPTION);
  });

  it("R6 · der Deckel wirkt und wird gesagt: limit=1 bei zwei Treffern → ein Treffer, gedeckelt", async () => {
    const { app, autor } = await setup();
    await bestand(app, autor);
    // Ein zweites Bild mit dem Suchwort, in einem weiteren Objekt.
    await anlegen(app, autor, {
      title: "Zweite Notiz",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml: figur("schraub-2", "/api/objects/s2/raw", "Schraubenkopf mit Markierung"),
    });
    const alle = await bildsuche(app, autor, "Schraub");
    expect(alle.json.treffer).toHaveLength(2);
    expect(alle.json.gedeckelt).toBe(false);

    const eins = await bildsuche(app, autor, "Schraub", 1);
    expect(eins.status, eins.body).toBe(200);
    expect(eins.json.treffer).toHaveLength(1);
    expect(eins.json.gedeckelt).toBe(true);
  });

  // RUNDE 3 (Bens Korrekturpflicht 1): `gedeckelt` ist eine BESTANDSAUSSAGE („es gibt mehr
  // passende Bilder als gezeigt"). Sie darf erst wahr werden, wenn ein WEITERES sichtbares,
  // passendes Bild nachgewiesen ist — nicht schon, weil noch ein Kandidat in der Reihe steht, der
  // das Suchwort nur im Text trägt und gar kein passendes Bild hat. Vorher rot: die Route setzte
  // den Deckel beim bloßen Erreichen des Limits, sobald irgendein weiterer Kandidat folgte.
  it("R13 · exakt `limit` Bildtreffer plus weitere reine Textkandidaten → NICHT gedeckelt", async () => {
    const { app, autor } = await setup();
    await bestand(app, autor);
    // Zwei weitere Kandidaten, die das Suchwort tragen, aber KEIN passendes Bild: einer nur im
    // Text (ohne Bild), einer mit einem Bild, dessen Unterschrift nicht passt.
    await anlegen(app, autor, {
      title: "Schraub Lehrtext",
      statement: "Schraubverbindungen im Überblick — ohne Bild.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml: "<p>Nur Text über Schrauben.</p>",
    });
    await anlegen(app, autor, {
      title: "Schraubenkunde mit Dichtungsbild",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml: figur("dichtung-2", "/api/objects/d2/raw", "Dichtring am Deckel"),
    });

    const eins = await bildsuche(app, autor, "Schraub", 1);
    expect(eins.status, eins.body).toBe(200);
    expect(eins.json.treffer).toHaveLength(1);
    expect(eins.json.treffer[0]?.imageId).toBe("schraub-1");
    expect(eins.json.gedeckelt, "kein weiteres passendes Bild → kein Deckel").toBe(false);

    // Gegenstück im selben Bestand: kommt ein ZWEITES passendes Bild hinzu, ist der Deckel wahr —
    // auch wenn zwischen beiden die reinen Textkandidaten liegen.
    await anlegen(app, autor, {
      title: "Zweite Notiz",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml: figur("schraub-2", "/api/objects/s2/raw", "Schraubenkopf mit Markierung"),
    });
    const wieder = await bildsuche(app, autor, "Schraub", 1);
    expect(wieder.json.treffer).toHaveLength(1);
    expect(wieder.json.gedeckelt, "ein weiteres passendes Bild → Deckel").toBe(true);
    // Und ohne Deckel kommen beide, das Textobjekt bleibt ohne Treffer.
    const alle = await bildsuche(app, autor, "Schraub");
    expect(alle.json.treffer.map((t) => t.imageId).sort()).toEqual(["schraub-1", "schraub-2"]);
    expect(alle.json.gedeckelt).toBe(false);
  });
});

// ================================================================================================
// RUNDE 2 — BENENNUNG ALS ZWEITES SUCHFELD (Pedi, Entscheidung 4: „Benennung, Bildunterschrift UND
// Beschreibung"). Die Benennung eines Bildes im Bestand ist sein alt-Text (der Editor schreibt beim
// Einfügen den Dateinamen hinein) bzw. der Name des Anhangs, auf den es zeigt. Eine gesonderte
// KI-Beschreibung gibt es im Bestand nicht — die Bildbeschreibung IST die figcaption (die KI schlägt
// dorthin vor). Deshalb zwei Fundstellen: „beschreibung" und „name", und die Antwort sagt, welche.
// ================================================================================================
const NAME_SW17 = "Schraubenschluessel_SW17.png";
const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

async function anhang(app: App, headers: Auth, koId: string, name: string): Promise<void> {
  const res = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers,
    payload: { action: "attach", attachment: { name, mime: "image/png", dataUrl: PIXEL } },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anhang ${name} nicht angefügt: ${res.statusCode} ${res.body}`);
  }
}

describe("JOB 3095 · Runde 2 — die Benennung des Bildes ist ein Suchfeld", () => {
  it("R9 · ein Bild OHNE Beschreibung wird über seinen Namen gefunden — caption leer, name gesetzt, Fundstelle „name“", async () => {
    const { app, autor } = await setup();
    await bestand(app, autor);
    const werkzeug = await anlegen(app, autor, {
      title: "Werkzeugliste",
      statement: "Kurzfassung ohne das Suchwort.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml: `<figure data-image-id="n1"><img data-image-id="n1" src="/api/objects/n1/raw" alt="${NAME_SW17}"><figcaption data-image-id="n1"></figcaption></figure>`,
    });
    await anhang(app, autor, werkzeug, NAME_SW17);

    const res = await bildsuche(app, autor, "sw17");
    expect(res.status, res.body).toBe(200);
    expect(res.json.treffer).toHaveLength(1);
    expect(res.json.treffer[0]).toEqual({
      imageId: "n1",
      koId: werkzeug,
      koTitel: "Werkzeugliste",
      version: 1,
      pruefstand: "offen",
      caption: "",
      name: NAME_SW17,
      gefundenUeber: ["name"],
      thumbnailUrl: "/api/objects/n1/raw",
    });
  });

  it("R10 · trifft das Suchwort Beschreibung UND Name, nennt die Antwort beide Fundstellen", async () => {
    const { app, autor } = await setup();
    const beide = await anlegen(app, autor, {
      title: "Flansch",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml:
        '<figure data-image-id="b1"><img data-image-id="b1" src="/api/objects/b1/raw" ' +
        'alt="schraub_m12.jpg"><figcaption data-image-id="b1">Schraubverbindung M12</figcaption></figure>',
    });
    const res = await bildsuche(app, autor, "Schraub");
    expect(res.json.treffer.map((t) => t.koId)).toEqual([beide]);
    expect(res.json.treffer[0]?.name).toBe("schraub_m12.jpg");
    expect(res.json.treffer[0]?.gefundenUeber).toEqual(["beschreibung", "name"]);
  });

  // DIE RESTSCHULD IST BENANNT, NICHT VERGESSEN (Muster: eine-quelle-waechter W-6) — und sie ist
  // seit JOB 3111 · B1b BEZAHLT. Bis dahin galt: ein Name, der NUR im `alt` eines eingebetteten
  // Bildes steht, ist body-frei nirgends abgelegt, das Objekt wird kein Kandidat, sein Rumpf wird
  // nie gelesen — das Bild war „nicht auffindbar", und genau das pinnte dieser Fall.
  //
  // Der hier benannte Weg wurde gegangen: neben `captionTexts` liegt jetzt das persistierte
  // `imageNames`-Feld (Schreibweg in knowledge-object/service.ts). Der Fall KIPPT deshalb bewusst
  // — er behauptet ab hier das Gegenteil und bleibt damit der Wächter derselben Zusage, jetzt von
  // der anderen Seite. Der ausführliche Beleg liegt in tests/bild-benennung.
  it("R12 · die einstige Grenze ist zu: ein Name nur im alt eines eingebetteten Bildes wird gefunden", async () => {
    const { app, autor } = await setup();
    const ko = await anlegen(app, autor, {
      title: "Ohne Bezug",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml:
        '<figure data-image-id="e1"><img data-image-id="e1" src="/api/objects/e1/raw" ' +
        'alt="einzelname_xq.jpg"><figcaption data-image-id="e1"></figcaption></figure>',
    });
    const res = await bildsuche(app, autor, "einzelname_xq");
    expect(res.status, res.body).toBe(200);
    expect(res.json.treffer).toHaveLength(1);
    expect(res.json.treffer[0]?.koId).toBe(ko);
    expect(res.json.treffer[0]?.name).toBe("einzelname_xq.jpg");
    expect(res.json.treffer[0]?.gefundenUeber).toEqual(["name"]);
  });

  it("R11 · ein Bild ohne Beschreibung und ohne Benennung ist über kein Suchwort erfindbar", async () => {
    const { app, autor } = await setup();
    await anlegen(app, autor, {
      title: "Ohne alles",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml:
        '<figure data-image-id="o1"><img data-image-id="o1" src="/api/objects/o1/raw">' +
        '<figcaption data-image-id="o1"></figcaption></figure>',
    });
    expect((await bildsuche(app, autor, "Ohne")).json.treffer).toEqual([]);
    expect((await bildsuche(app, autor, "o1")).json.treffer).toEqual([]);
  });
});

describe("JOB 3095 · die Bildsuche leakt nichts", () => {
  it("R7 · ein FREMDES vertrauliches Objekt liefert weder Bild noch Unterschrift noch Titel", async () => {
    const { app, autor, fremd, admin } = await setup();
    await bestand(app, autor);
    const vertraulich = await anlegen(app, autor, {
      title: "Geheimanlage",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml: figur("geheim-1", "/api/objects/g1/raw", VERTRAULICH_CAPTION),
    });
    const hoch = await app.inject({
      method: "PUT",
      url: `/api/kos/${vertraulich}`,
      headers: autor,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(hoch.statusCode, hoch.body).toBe(200);

    // Kalibrierung: der Autor selbst findet BEIDE Schraub-Bilder …
    const eigene = await bildsuche(app, autor, "Schraub");
    expect(eigene.json.treffer.map((t) => t.imageId).sort()).toEqual(["geheim-1", "schraub-1"]);

    // … ein FREMDER Experte nur das sichtbare: kein Treffer, kein Titel, kein Textschnipsel.
    const fremde = await bildsuche(app, fremd, "Schraub");
    expect(fremde.status, fremde.body).toBe(200);
    expect(fremde.json.treffer.map((t) => t.imageId)).toEqual(["schraub-1"]);
    expect(fremde.body).not.toContain("Geheimanlage");
    expect(fremde.body).not.toContain(VERTRAULICH_CAPTION);
    expect(fremde.body).not.toContain("/api/objects/g1/raw");

    // … und `ko.validate` (Admin) sieht es weiterhin — die Regel ist keine Totalsperre.
    const adminTreffer = await bildsuche(app, admin, "Schraub");
    expect(adminTreffer.json.treffer.map((t) => t.imageId).sort()).toEqual([
      "geheim-1",
      "schraub-1",
    ]);
  });

  it("R8 · ein Objekt im Papierkorb liefert kein Bild mehr", async () => {
    const { app, autor } = await setup();
    const { schraub } = await bestand(app, autor);
    const weg = await app.inject({ method: "DELETE", url: `/api/kos/${schraub}`, headers: autor });
    expect([200, 204], weg.body).toContain(weg.statusCode);
    const res = await bildsuche(app, autor, "Schraub");
    expect(res.status, res.body).toBe(200);
    expect(res.json.treffer).toEqual([]);
  });
});
