// ================================================================================================
// AUFTRAG-mega64 BLOCK A — DER DEMO-SEED HÖRT AUF, BEKANNTE KENNWÖRTER ZU VERTEILEN.
// ================================================================================================
//
// Der Befund ist bens (BERICHT-ben-sammel61-mega63.md, Finding 1), und er ist älter als jede Scheibe
// dieser Woche: `POST /api/admin/demo-seed` war in JEDER App bedingungslos registriert und legte auf
// einer bereits eingerichteten Instanz freigegebene Controller- und Expertenkonten mit im Quelltext
// festgeschriebenen Kennwörtern an. Der Login unterscheidet ein Demo-Konto von einem echten nicht.
//
// Dieser Sammler hält die drei Maßnahmen fest, in der Reihenfolge ihrer Wichtigkeit:
//
//   A  DAS TOR. Ohne ausdrücklichen Betriebsschalter EXISTIERT die Route nicht. Mit Kalibrierung —
//      ohne den Nachweis, dass sie MIT Schalter antwortet, wäre ein 404 auch dann grün, wenn die
//      Route gar nicht gebaut wäre oder der Guard aus einem anderen Grund abwiese.
//   B  DIE VORGABE. Der Schalter steht auf AUS, und nur ein ausdrückliches `1`/`true` schaltet ihn
//      scharf — „ja", „on" oder ein leerer Wert nicht.
//   C  DIE KENNWÖRTER. Bei Neuanlage kommt ein Einmalkennwort, das nur in der Antwort steht; zwei
//      Läufe liefern verschiedene, und die alten Quelltextwerte sind nirgends mehr im Produktbaum.
//   D  DIE STILLE RECHTEVERGABE. Ein vorhandenes, NICHT freigegebenes Demo-Konto bleibt nach einem
//      Ladevorgang nicht freigegeben und wird nicht in die Controllerrolle gehoben.
//   E  DIE GEGENPROBE ZUM TOR. Das Tor sperrt nur das ANLEGEN: der lesende Stand und der
//      Entfernen-Weg bleiben ohne Schalter erreichbar. Ein Tor, das den Purge mitnimmt, schlösse
//      den Bestand ein, statt die Quelle zu schließen.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { vorgabeAn } from "../../services/app/src/feature-flags";
import { DEMO_CONTROLLER_EMAIL, DEMO_EXPERT_EMAIL } from "../../services/app/src/seed-demo";

const SCHALTER = "KLARWERK_DEMO_SEED";
const WURZEL = join(__dirname, "..", "..");

let vorher: string | undefined;

beforeEach(() => {
  vorher = process.env[SCHALTER];
});

afterEach(() => {
  // Die Suite schaltet den Schalter global frei (tests/setup-env.ts) — dieser Sammler dreht ihn
  // lokal und stellt danach genau den vorgefundenen Zustand wieder her, statt einen Wert zu raten.
  if (vorher === undefined) {
    delete process.env[SCHALTER];
  } else {
    process.env[SCHALTER] = vorher;
  }
});

/** Eine App im gewünschten Schalterzustand, mit angemeldetem Admin. Der Schalter wirkt beim BAUEN. */
async function adminApp(schalter: string | undefined): Promise<{
  app: ReturnType<typeof buildApp>;
  headers: { authorization: string };
}> {
  if (schalter === undefined) {
    delete process.env[SCHALTER];
  } else {
    process.env[SCHALTER] = schalter;
  }
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  return { app, headers: { authorization: `Bearer ${login.json().token}` } };
}

describe("mega64 A · das Tor vor dem Demodaten-Laden", () => {
  it("A · ohne Schalter EXISTIERT die Route nicht — und mit Schalter antwortet sie (Kalibrierung)", async () => {
    // Die Kalibrierung steht ZUERST: sie belegt, dass derselbe Aufruf mit demselben Admin und
    // demselben Guard durchkommt, sobald der Schalter steht. Ohne sie könnte der 404 unten auch
    // heißen „die Route gibt es nirgends" oder „der Admin darf nicht" — und der Sammler wäre grün,
    // ohne das Tor zu messen.
    const mit = await adminApp("1");
    const antwortet = await mit.app.inject({
      method: "POST",
      url: "/api/admin/demo-seed",
      headers: mit.headers,
    });
    expect(antwortet.statusCode, "mit Schalter muss die Route antworten").toBe(200);
    expect(antwortet.json().skipped).toBe(false);

    // DER BEFUND: derselbe Aufruf, derselbe Admin, kein Schalter → die Route ist nicht da.
    const ohne = await adminApp(undefined);
    const fehlt = await ohne.app.inject({
      method: "POST",
      url: "/api/admin/demo-seed",
      headers: ohne.headers,
    });
    expect(fehlt.statusCode, "ohne Schalter darf die Route nicht existieren").toBe(404);

    // Und sie hat wirklich nichts getan: kein Konto, kein Wissensobjekt.
    const kos = await ohne.app.inject({ method: "GET", url: "/api/kos", headers: ohne.headers });
    expect(kos.json().length).toBe(0);
    const nutzer = await ohne.app.inject({
      method: "GET",
      url: "/api/users",
      headers: ohne.headers,
    });
    expect(
      (nutzer.json() as { email: string }[]).map((u) => u.email),
      "ohne Schalter darf kein Demo-Konto entstehen",
    ).toEqual(["a@x.de"]);
  });

  it("B · Vorgabe AUS: nur ein ausdrückliches 1/true schaltet scharf", async () => {
    // Die Richtung ist begründet und darf nicht kippen: ein Werkzeug, das Konten anlegt, darf nicht
    // dadurch scharf sein, dass niemand widersprochen hat. Die zwei Rechtsflächen aus mega61 haben
    // bewusst die andere Vorgabe — dieser hier nicht.
    expect(vorgabeAn("demodaten"), "der Demodaten-Schalter darf keine Vorgabe AN haben").toBe(
      false,
    );

    for (const wert of ["", "ja", "on", "yes", "0", "false", "JA", "2"]) {
      const { app, headers } = await adminApp(wert);
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/demo-seed",
        headers,
      });
      expect(res.statusCode, `„${wert}" hätte den Schalter nicht scharfstellen dürfen`).toBe(404);
    }
    for (const wert of ["1", "true"]) {
      const { app, headers } = await adminApp(wert);
      const res = await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers });
      expect(res.statusCode, `„${wert}" hätte scharfstellen müssen`).toBe(200);
    }
  });

  // ================================================================================================
  // JOB 1081 · D5 — DER VOLLSTÄNDIGE PARSERVERTRAG, ZEICHENGENAU.
  // ================================================================================================
  //
  // WARUM DIESER FALL NEBEN B STEHT UND IHN NICHT ERSETZT. Fall B belegt die RICHTUNG (Vorgabe AUS,
  // nur `1`/`true` schaltet scharf) und ist damit richtig. Er lässt aber zwei Eigenschaften des
  // Parsers ungeprüft, und beide sind still: `schalterAn` liest den Rohwert OHNE `trim()` und
  // vergleicht ZEICHENGENAU (`wert === "1" || wert === "true"`, feature-flags.ts).
  //
  // GEMESSEN, nicht vermutet: Setzt man in den Parser ein `?.trim().toLowerCase()`, bleibt Fall B
  // vollständig grün (7 von 7) — obwohl damit `" TRUE "`, `"True"` und `" 1 "` das Werkzeug
  // scharfstellen würden, das Konten anlegt. Der Wächter war für genau diese Änderung blind.
  //
  // DIE MATRIX STAMMT AUS DEM GELESENEN PARSER, nicht aus Plausibilität. Jede Zeile ist die
  // Auswertung von `wert === "1" || wert === "true"` für den jeweiligen Rohwert — deshalb steht die
  // Erwartung als Datum daneben und nicht als Prosa. Wer die Auswertung ändert, muss diese Tabelle
  // ändern, und das ist genau die Absicht: eine Änderung an der Schärfstellung eines
  // kontenanlegenden Werkzeugs soll eine sichtbare Entscheidung sein.
  //
  // `undefined` steht bewusst MIT in der Tabelle, obwohl Fall A den fehlenden Schalter schon prüft:
  // dort ist er der BEFUND, hier ist er die erste Zeile eines geschlossenen Vertrags. Eine Matrix
  // mit einer Lücke an der wichtigsten Stelle wäre keine.
  it("B2 · der Parservertrag: zeichengenau, ohne Trim, ohne Kleinschreibung", async () => {
    const matrix: readonly [string | undefined, boolean][] = [
      // fehlend und leer — der Normalzustand eines Betriebs, der nichts eingeschaltet hat.
      [undefined, false],
      ["", false],
      // ausdrückliches Nein.
      ["0", false],
      ["false", false],
      // die EINZIGEN beiden Werte, die scharfstellen.
      ["1", true],
      ["true", true],
      // umgangssprachliche Zustimmung zählt nicht — sie ist nicht eindeutig genug für ein
      // Werkzeug, das Konten anlegt.
      ["on", false],
      ["ja", false],
      ["yes", false],
      // GROSS-/KLEINSCHREIBUNG: der Vergleich ist zeichengenau. Ohne diese drei Zeilen bliebe ein
      // `toLowerCase()` im Parser unbemerkt.
      ["TRUE", false],
      ["True", false],
      ["JA", false],
      // WHITESPACE: der Rohwert wird nicht getrimmt. Ohne diese drei Zeilen bliebe ein `trim()`
      // im Parser unbemerkt — und ein versehentliches Leerzeichen in einer Betriebsdatei
      // entschiede über ein kontenanlegendes Werkzeug.
      [" 1", false],
      ["1 ", false],
      [" true ", false],
    ];

    const befund: Record<string, number> = {};
    const erwartet: Record<string, number> = {};
    for (const [wert, scharf] of matrix) {
      const schluessel = wert === undefined ? "<fehlend>" : `„${wert}"`;
      const { app, headers } = await adminApp(wert);
      const res = await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers });
      befund[schluessel] = res.statusCode;
      erwartet[schluessel] = scharf ? 200 : 404;
    }
    // BEWUSST erst sammeln, dann urteilen: eine Schleife mit sofortigem `expect` bricht beim ersten
    // Fund ab und verschweigt die übrigen. Wer den Parser ändert, soll die ganze Fläche sehen.
    expect(befund).toEqual(erwartet);
  });
});

describe("mega64 A · die Kennwörter verlassen den Quelltext", () => {
  it("C1 · die Antwort nennt ein Einmalkennwort je NEU angelegtem Konto", async () => {
    const { app, headers } = await adminApp("1");
    const res = await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers });
    const zugaenge = res.json().einmalkennwoerter as { email: string; kennwort: string }[];

    // Genau die beiden Demo-Mitnutzer; der ausführende Admin ist ein echtes Konto und bekommt
    // selbstverständlich kein neues Kennwort.
    expect(zugaenge.map((z) => z.email).sort()).toEqual(
      [DEMO_CONTROLLER_EMAIL, DEMO_EXPERT_EMAIL].sort(),
    );
    for (const zugang of zugaenge) {
      // Länge und Zeichenvorrat eines base64url-Werts aus 18 Zufallsbytes.
      expect(zugang.kennwort).toMatch(/^[A-Za-z0-9_-]{24}$/);
    }

    // Es ist ein WIRKLICHES Kennwort, kein Anzeigetext: die Anmeldung damit gelingt.
    const controller = zugaenge.find((z) => z.email === DEMO_CONTROLLER_EMAIL);
    const anmeldung = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: DEMO_CONTROLLER_EMAIL, password: controller?.kennwort },
    });
    expect(anmeldung.statusCode, "das ausgegebene Kennwort muss funktionieren").toBe(200);
  });

  it("C2 · zwei Instanzen bekommen VERSCHIEDENE Kennwörter", async () => {
    // Der eigentliche Punkt. Ein „zufälliges" Kennwort, das für alle Instanzen dasselbe ist, wäre
    // nur ein längeres festgeschriebenes Kennwort.
    const einsApp = await adminApp("1");
    const eins = await einsApp.app.inject({
      method: "POST",
      url: "/api/admin/demo-seed",
      headers: einsApp.headers,
    });
    const zweiApp = await adminApp("1");
    const zwei = await zweiApp.app.inject({
      method: "POST",
      url: "/api/admin/demo-seed",
      headers: zweiApp.headers,
    });

    const kennwort = (res: typeof eins, email: string): string =>
      (res.json().einmalkennwoerter as { email: string; kennwort: string }[]).find(
        (z) => z.email === email,
      )?.kennwort ?? "";
    expect(kennwort(eins, DEMO_CONTROLLER_EMAIL)).not.toBe(kennwort(zwei, DEMO_CONTROLLER_EMAIL));
    expect(kennwort(eins, DEMO_EXPERT_EMAIL)).not.toBe(kennwort(zwei, DEMO_EXPERT_EMAIL));
  });

  it("C3 · die alten Quelltextwerte stehen NIRGENDS mehr im Produktbaum", () => {
    // Der Sammler gegen den Rückfall — und gegen die Kopie an einer neuen Stelle. Er prüft die
    // BAUFORM, nicht die heutigen Dateien: wer einen dieser Werte künftig irgendwo im Produktcode
    // einstreut, wird rot, auch in einer Datei, die es heute noch nicht gibt.
    //
    // Die Werte selbst stehen hier zusammengesetzt, damit diese Testdatei sie nicht ihrerseits als
    // durchsuchbare Zeichenkette in das Repository schreibt.
    const alt = ["demo", "pass", "carla"].join("-");
    const altErik = ["demo", "pass", "erik"].join("-");
    const altAdmin = ["demo", "admin", "pass"].join("-");
    const treffer: string[] = [];
    const durchsuchen = (verzeichnis: string): void => {
      for (const eintrag of readdirSync(join(WURZEL, verzeichnis))) {
        if (eintrag === "node_modules" || eintrag === "dist" || eintrag.startsWith(".")) {
          continue;
        }
        const relativ = join(verzeichnis, eintrag);
        if (statSync(join(WURZEL, relativ)).isDirectory()) {
          durchsuchen(relativ);
          continue;
        }
        if (!relativ.endsWith(".ts") && !relativ.endsWith(".tsx")) {
          continue;
        }
        const inhalt = readFileSync(join(WURZEL, relativ), "utf8");
        for (const wert of [alt, altErik, altAdmin]) {
          if (inhalt.includes(wert)) {
            treffer.push(`${relativ} nennt ein festgeschriebenes Demo-Kennwort`);
          }
        }
      }
    };
    for (const wurzel of ["services", join("apps", "web", "src"), "tests", "tests-smoke"]) {
      durchsuchen(wurzel);
    }
    // Selbstschutz: die Erhebung muss überhaupt Dateien gesehen haben.
    expect(readdirSync(join(WURZEL, "services")).length).toBeGreaterThan(3);
    expect(treffer).toEqual([]);
  });
});

describe("mega64 A · ein Ladevorgang vergibt keine Rechte", () => {
  it("D · ein vorhandenes, NICHT freigegebenes Demo-Konto bleibt gesperrt und ohne Rolle", async () => {
    const { app, headers } = await adminApp("1");

    // Der erreichbare Zustand „deaktiviertes Demo-Konto": das Konto existiert, ist aber NICHT
    // freigegeben. Über die normale Selbstregistrierung entsteht genau dieser Zustand — es braucht
    // dafür keinen Testhaken.
    //
    // NEBENBEFUND, gehört in den Bericht: Der Auth-Dienst hat heute gar keinen eigenen Weg, ein
    // freigegebenes Konto WIEDER zu deaktivieren (`services/auth/src/service.ts` kennt
    // `approveUser`, aber kein Gegenstück; das einzige Rückwärts ist `deleteUser`). „Deaktiviert"
    // heißt im Ist-Stand also: `approved: false` — der Zustand, in dem jedes selbstregistrierte
    // Konto beginnt und in dem ein aus dem Purge zurückgekehrtes Demo-Konto liegen kann.
    const eigen = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Carla", email: DEMO_CONTROLLER_EMAIL, password: "eigenes-kennwort-1" },
    });
    expect(eigen.statusCode).toBeLessThan(300);

    const zustand = async (): Promise<{ approved: boolean; role: string } | undefined> => {
      const alle = await app.inject({ method: "GET", url: "/api/users", headers });
      return (alle.json() as { email: string; approved: boolean; role: string }[]).find(
        (u) => u.email === DEMO_CONTROLLER_EMAIL,
      );
    };
    const anfang = await zustand();
    expect(anfang?.approved, "Selbstregistrierung startet unfreigegeben").toBe(false);
    const anfangsRolle = anfang?.role;

    const seed = await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers });
    expect(seed.statusCode).toBe(200);
    expect(seed.json().skipped).toBe(false);

    // DIE ZUSAGE: der Ladevorgang hat die Entscheidung „nicht freigegeben" nicht umgekehrt und
    // niemanden in die Controllerrolle gehoben. Bis mega64 stand hier `approved: true` und
    // `role: "controller"` — eine stille Rechtevergabe durch einen Datenladevorgang.
    expect(
      await zustand(),
      "ein Demodaten-Ladevorgang darf keine Freigabe und keine Rolle vergeben",
    ).toMatchObject({ approved: false, role: anfangsRolle });
    // Und ausdrücklich NICHT die Controllerrolle — das war der Kern der stillen Rechtevergabe.
    expect((await zustand())?.role).not.toBe("controller");

    // Und er hat auch das Kennwort des vorhandenen Kontos nicht angetastet: es ist nicht in den
    // Einmalkennwörtern genannt (nur NEU angelegte Konten stehen dort).
    const zugaenge = seed.json().einmalkennwoerter as { email: string }[];
    expect(zugaenge.map((z) => z.email)).toEqual([DEMO_EXPERT_EMAIL]);

    // Die Anmeldung bleibt gesperrt — die Deaktivierung wirkt weiterhin.
    const anmeldung = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: DEMO_CONTROLLER_EMAIL, password: "eigenes-kennwort-1" },
    });
    expect(anmeldung.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("E · das Tor sperrt nur das ANLEGEN — Stand und Entfernen bleiben erreichbar", async () => {
    // Erst MIT Schalter laden, dann eine App OHNE Schalter auf denselben Daten wäre der schönere
    // Beleg; die In-Memory-Dienste leben aber je App. Deshalb wird hier belegt, was zählt: die
    // beiden anderen Wege antworten ohne Schalter überhaupt. Sonst hätte das Tor den vorhandenen
    // Demo-Bestand eingeschlossen, statt die Quelle zu schließen.
    const { app, headers } = await adminApp(undefined);
    const stand = await app.inject({ method: "GET", url: "/api/admin/demo-seed", headers });
    expect(stand.statusCode, "der lesende Stand muss ohne Schalter erreichbar bleiben").toBe(200);
    expect(stand.json()).toMatchObject({ present: false, count: 0 });

    const entfernen = await app.inject({ method: "DELETE", url: "/api/admin/demo-seed", headers });
    expect(entfernen.statusCode, "der Entfernen-Weg muss ohne Schalter erreichbar bleiben").toBe(
      200,
    );
  });
});
