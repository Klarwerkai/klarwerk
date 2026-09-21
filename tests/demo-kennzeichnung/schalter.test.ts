// ================================================================================================
// JOB 3761 · D1/D2 — DER SCHALTER „DIESE INSTANZ IST DIE DEMO", AN SEINER QUELLE.
// JOB 4365 — DIE QUELLE IST JETZT DER HOSTNAME DER ANFRAGE, NICHT MEHR EIN UMGEBUNGSSCHALTER.
// ================================================================================================
//
// Pedis Satz (11.09. 17:20 über Codex, PRIORITAETEN.md/DEMO-ZUGANG-START): „und man muss ihr
// ansehen, dass sie die Demo ist und nicht das Echte". Diese Datei prüft die SERVERHÄLFTE der
// Zusage: dass ein Unangemeldeter die Kennzeichnung erfährt (die Anmeldemaske ist die erste Fläche,
// auf der es zählt) — und vor allem die Gegenrichtung, die hier die eigentliche Zusage ist: die
// ECHTE Instanz trägt das Etikett unter KEINEM Umstand.
//
// WAS JOB 4365 GEÄNDERT HAT (Entscheidung 1, ENTSCHEIDUNGEN-FACHFRAGEN-20260921.md): Bis hierher
// hing die Kennzeichnung an `KLARWERK_DEMO_INSTANZ` — an einem Wert also, den ein Betreiber von
// Hand richtig setzen musste. Jetzt hängt sie am Host der Anfrage. Der Unterschied ist nicht
// bequemer, er ist WAHRER: Die Adresse ist die Tatsache, die die Vorführung von der echten
// Anwendung unterscheidet; der Schalter war nur eine Behauptung darüber.
//
//   D1   Der Fachname steht in der Auskunft VOR der Anmeldung — und auch in der vollen.
//   D2   Die Richtung, auf die es ankommt: jeder andere Host trägt KEIN Etikett.
//   D2b  Die Nachbarn der Adresse, ausgeschrieben: Unterdomäne, Anhängsel, Port, Schreibweise.
//   D2c  `demoInstanz` und `demodaten` sind ZWEI Aussagen und hängen nicht aneinander.
//   D2d  Die Antwort trägt weiterhin nur Ja/Nein — kein Variablenname, keine Adresse.
//   H1   ABGELÖST: `KLARWERK_DEMO_INSTANZ` ist keine Quelle mehr — gesetzt wie ungesetzt.
//   H2   `X-Forwarded-Host` und Verwandte wirken NICHT, in beide Richtungen.
//   H3   … und das gilt auch mit EINGESCHALTETEM `trustProxy`, wo die Falle erst scharf ist.
//   H4   Kein Produktcode liest den abgelösten Wert noch — am Bestand erhoben.
//   H5   Der Katalog führt ihn nur noch als ABGELÖST (der benannte Rest, s. `start-vertrag.ts`).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveTrustProxy } from "../../services/app/src/addon-auth-throttle";
import { buildApp } from "../../services/app/src/build-app";
import {
  SCHALTER_REGISTRY,
  demoInstanzAusHost,
  schalterAn,
  schalterZustand,
  schalterZustandVorAnmeldung,
} from "../../services/app/src/feature-flags";
import { STARTVERTRAG } from "../../services/app/src/start-vertrag";

/** Die Werkswurzel — dieselbe Bauform wie in `flaechen-mounted.test.tsx` (E1). */
const WURZEL = join(__dirname, "..", "..");

/** Alle `.ts`/`.tsx` eines Baums, ohne `node_modules`, `dist` und Verstecktes. */
function quelldateien(verzeichnis: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(WURZEL, verzeichnis))) {
    if (eintrag === "node_modules" || eintrag === "dist" || eintrag.startsWith(".")) {
      continue;
    }
    const relativ = join(verzeichnis, eintrag);
    if (statSync(join(WURZEL, relativ)).isDirectory()) {
      gefunden.push(...quelldateien(relativ));
    } else if (relativ.endsWith(".ts") || relativ.endsWith(".tsx")) {
      gefunden.push(relativ);
    }
  }
  return gefunden;
}

/** Der Fachname über den Draht — bewusst als Literal, nicht aus dem Registry abgeschrieben. */
const NAME = "demoInstanz";
/** Die Vorführ-Adresse, ebenfalls als Literal: abgeschrieben hätte der Fall keine Aussage. */
const DEMO_HOST = "demo.klarwerk.io";
/** Der Host der ECHTEN Anwendung — der Vergleichsfall, auf den es hier ankommt. */
const ECHT_HOST = "app.klarwerk.ai";
/** Der abgelöste Umgebungsschalter. Er steht hier nur noch, um zu belegen, dass er nichts tut. */
const ABGELOESTE_VARIABLE = "KLARWERK_DEMO_INSTANZ";

function schalterLeeren(): void {
  delete process.env[ABGELOESTE_VARIABLE];
}
beforeEach(schalterLeeren);
afterEach(schalterLeeren);

/** `GET /api/features` unter einem bestimmten Host, ohne Sitzung — der Weg der Anmeldemaske. */
async function auskunftUnterHost(
  app: ReturnType<typeof buildApp>,
  headers: Record<string, string>,
): Promise<Record<string, unknown>> {
  const res = await app.inject({ method: "GET", url: "/api/features", headers });
  expect(res.statusCode, `HTTP ${res.statusCode} statt 200`).toBe(200);
  return (res.json() as { features: Record<string, unknown> }).features;
}

describe("JOB 3761/4365 D1 · die Instanz erkennt sich an ihrer Adresse", () => {
  it("D1a · der Umgebungsschalter ist aus dem Registry verschwunden — nicht daneben gestellt", () => {
    // Die Zusage dieses Falls ist die ABLÖSUNG: `demoInstanz` ist kein Registry-Schalter mehr, und
    // `KLARWERK_DEMO_INSTANZ` kommt im Registry überhaupt nicht mehr vor. Bliebe der Eintrag
    // stehen, gäbe `schalterAn("demoInstanz")` weiterhin eine Antwort — die zweite Wahrheit, die
    // mega46 beseitigt hat.
    expect(Object.keys(SCHALTER_REGISTRY)).not.toContain(NAME);
    expect(Object.values(SCHALTER_REGISTRY)).not.toContain(ABGELOESTE_VARIABLE);
    // Und das Demodaten-Werkzeug ist davon unberührt geblieben (es ist die andere „Demo"-Aussage).
    expect(SCHALTER_REGISTRY.demodaten).toBe("KLARWERK_DEMO_SEED");
  });

  it("D1b · die Auskunft VOR der Anmeldung führt ihn — dort ist er am meisten wert", () => {
    const vor = schalterZustandVorAnmeldung(DEMO_HOST);
    expect(Object.keys(vor)).toContain(NAME);
    expect(vor[NAME]).toBe(true);
    // Die Teilmenge bleibt eine Teilmenge: die Fähigkeiten dieses Betriebs gehen einen
    // Unangemeldeten weiterhin nichts an.
    expect(Object.keys(vor)).not.toContain("herkunft");
    expect(Object.keys(vor)).not.toContain("expertMatching");
    expect(Object.keys(vor)).not.toContain("demodaten");
  });

  it("D1c · derselbe Wert steht auch in der vollen Auskunft — eine Wahrheit, nicht zwei", () => {
    expect(schalterZustand(DEMO_HOST)[NAME]).toBe(true);
    expect(schalterZustand(DEMO_HOST)[NAME]).toBe(schalterZustandVorAnmeldung(DEMO_HOST)[NAME]);
    expect(schalterZustand(ECHT_HOST)[NAME]).toBe(false);
    expect(schalterZustand(ECHT_HOST)[NAME]).toBe(schalterZustandVorAnmeldung(ECHT_HOST)[NAME]);
  });

  it("D1d · ohne Sitzung antwortet `GET /api/features` nach dem Host der Anfrage", async () => {
    const app = buildApp();
    // Die Demo …
    expect((await auskunftUnterHost(app, { host: DEMO_HOST }))[NAME]).toBe(true);
    // … und dieselbe Anwendung, dieselbe Route, ein anderer Host.
    expect((await auskunftUnterHost(app, { host: ECHT_HOST }))[NAME]).toBe(false);
    await app.close();
  });
});

describe("JOB 3761/4365 D2 · die ECHTE Instanz trägt das Etikett unter keinen Umständen", () => {
  it("D2 · jeder andere Host — echte Instanz, localhost, IP, fehlender Kopf", () => {
    for (const host of [
      ECHT_HOST,
      "klarwerk.ai",
      "localhost",
      "localhost:3000",
      "127.0.0.1",
      "127.0.0.1:8080",
      "[::1]:8080",
      "",
      "   ",
    ]) {
      expect(demoInstanzAusHost(host), `„${host}" darf kein Etikett tragen`).toBe(false);
    }
    // Ein fehlender Host-Kopf ist kein Grund zur Annahme (HTTP/1.0 kennt ihn nicht).
    expect(demoInstanzAusHost(undefined), "ohne Host-Kopf kein Etikett").toBe(false);
  });

  it("D2b · die Nachbarn der Adresse: Unterdomäne, Anhängsel, Port, Schreibweise", () => {
    // MIT Port und OHNE — beides ist dieselbe Instanz (Auftrag K1).
    for (const host of [
      DEMO_HOST,
      `${DEMO_HOST}:443`,
      `${DEMO_HOST}:3000`,
      `  ${DEMO_HOST}  `,
      "DEMO.KLARWERK.IO",
      "Demo.Klarwerk.io:443",
    ]) {
      expect(demoInstanzAusHost(host), `„${host}" ist die Vorführ-Instanz`).toBe(true);
    }
    // Und die Namen, die nur so AUSSEHEN. Die Richtung ist hier bewusst streng: zu streng heißt,
    // die Demo bliebe unbeschriftet; zu locker heißt, eine fremde Adresse trüge das Etikett.
    for (const host of [
      "x.demo.klarwerk.io",
      "demo.klarwerk.io.beispiel.de",
      "notdemo.klarwerk.io",
      "demo.klarwerk.ai",
      "demo.klarwerk.io.",
      "demoklarwerk.io",
      "demo.klarwerk.io:443:443",
    ]) {
      expect(demoInstanzAusHost(host), `„${host}" ist NICHT die Vorführ-Instanz`).toBe(false);
    }
  });

  it("D2c · das Demodaten-Werkzeug schaltet das Etikett NICHT ein (und umgekehrt)", () => {
    // Die naheliegende Halbheit wäre gewesen, den vorhandenen `demodaten`-Schalter mitzubenutzen.
    // Dann trüge jede echte Instanz, die einmal Demodaten laden durfte, ein Demo-Etikett — und eine
    // Vorführinstanz ohne geladene Demodaten keines.
    const alt = process.env.KLARWERK_DEMO_SEED;
    process.env.KLARWERK_DEMO_SEED = "1";
    expect(schalterAn("demodaten")).toBe(true);
    expect(schalterZustand(ECHT_HOST)[NAME]).toBe(false);

    delete process.env.KLARWERK_DEMO_SEED;
    expect(schalterZustand(DEMO_HOST)[NAME]).toBe(true);
    expect(schalterAn("demodaten")).toBe(false);
    if (alt === undefined) {
      delete process.env.KLARWERK_DEMO_SEED;
    } else {
      process.env.KLARWERK_DEMO_SEED = alt;
    }
  });

  it("D2d · die Antwort bleibt reines Ja/Nein — kein Variablenname, keine Adresse", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/features",
      headers: { host: DEMO_HOST },
    });
    expect(res.statusCode).toBe(200);
    const features = (res.json() as { features: Record<string, unknown> }).features;
    expect(typeof features[NAME]).toBe("boolean");
    expect(res.body).not.toContain("KLARWERK");
    expect(res.body).not.toContain(ABGELOESTE_VARIABLE);
    // Und ausdrücklich NICHT die Vorführadresse — obwohl sie jetzt die Quelle der Aussage ist:
    // der Gast soll die Tatsache sehen, nicht die Umgebung.
    expect(res.body).not.toContain("klarwerk.io");
    await app.close();
  });
});

// ------------------------------------------------------------------------------------------------
// H — DIE ABLÖSUNG, GEMESSEN (Auftrag K2/K4)
// ------------------------------------------------------------------------------------------------
describe("JOB 4365 H · der Umgebungsschalter ist wirklich keine Quelle mehr", () => {
  it("H1 · `KLARWERK_DEMO_INSTANZ` ändert die Antwort in KEINER Richtung", async () => {
    const app = buildApp();

    // (a) Gesetzt auf dem Host der ECHTEN Anwendung: früher hätte das ein Etikett aufgeklebt.
    // Das ist die gefährlichere Richtung — ein kopierter Umgebungsblock auf der echten Instanz.
    for (const wert of ["1", "true", "ja", "0", "false", ""]) {
      process.env[ABGELOESTE_VARIABLE] = wert;
      expect(
        (await auskunftUnterHost(app, { host: ECHT_HOST }))[NAME],
        `„${wert}" hat die echte Instanz beschriftet`,
      ).toBe(false);
    }

    // (b) Ausdrücklich abgeschaltet auf dem Host der DEMO: der Schalter darf die Kennzeichnung
    // auch nicht mehr wegnehmen können.
    for (const wert of ["0", "false", ""]) {
      process.env[ABGELOESTE_VARIABLE] = wert;
      expect(
        (await auskunftUnterHost(app, { host: DEMO_HOST }))[NAME],
        `„${wert}" hat der Demo die Kennzeichnung genommen`,
      ).toBe(true);
    }

    // (c) Und gar nicht gesetzt — der Normalfall nach diesem Auftrag.
    schalterLeeren();
    expect((await auskunftUnterHost(app, { host: DEMO_HOST }))[NAME]).toBe(true);
    expect((await auskunftUnterHost(app, { host: ECHT_HOST }))[NAME]).toBe(false);
    await app.close();
  });

  it("H2 · ein gefälschter `X-Forwarded-Host` bewirkt nichts — in beide Richtungen", async () => {
    const app = buildApp();

    // (a) DIE ANGRIFFSRICHTUNG: Wer die echte Anwendung aufruft, kann sich kein Demo-Etikett
    // erschleichen. Ein Etikett auf der echten Anwendung machte echte Arbeit unglaubwürdig.
    for (const kopf of ["x-forwarded-host", "x-original-host", "x-host", "forwarded"]) {
      expect(
        (await auskunftUnterHost(app, { host: ECHT_HOST, [kopf]: DEMO_HOST }))[NAME],
        `${kopf} hat die echte Instanz beschriftet`,
      ).toBe(false);
    }

    // (b) Die Gegenrichtung: Er kann der Demo ihre Kennzeichnung auch nicht wegnehmen.
    expect(
      (await auskunftUnterHost(app, { host: DEMO_HOST, "x-forwarded-host": ECHT_HOST }))[NAME],
      "x-forwarded-host hat der Demo die Kennzeichnung genommen",
    ).toBe(true);

    // (c) KALIBRIERUNG: Der Fall kann überhaupt umschlagen — derselbe Aufruf, der Wert im ECHTEN
    // Host-Kopf statt im Weiterleitungskopf. Ohne diese Zeile wäre (a) auch dann grün, wenn die
    // Auskunft nie ein Etikett vergäbe.
    expect((await auskunftUnterHost(app, { host: DEMO_HOST }))[NAME]).toBe(true);
    await app.close();
  });

  it("H3 · auch mit eingeschaltetem `trustProxy` — dort ist die Falle überhaupt erst scharf", async () => {
    // WARUM DIESER FALL NEBEN H2 STEHT UND NICHT IN IHM AUFGEHT. H2 misst die Vorgabe, und in der
    // ist `trustProxy` AUS (`resolveTrustProxy` ohne `KLARWERK_TRUST_PROXY` → `false`). Dort
    // antwortet Fastifys `request.hostname` ohnehin aus dem rohen Host-Kopf — H2 allein bliebe
    // also auch dann grün, wenn die Route `request.hostname` läse. Erst mit vertrautem Proxy zieht
    // Fastify den `X-Forwarded-Host` heran, und erst dann trennt sich die richtige Lesung von der
    // falschen. Genau diese Lage wird hier hergestellt.
    const alt = process.env.KLARWERK_TRUST_PROXY;
    process.env.KLARWERK_TRUST_PROXY = "127.0.0.1";
    try {
      // (a) KALIBRIERUNG ZUERST: Die Falle ist wirklich scharf. Gemessen an einer nackten
      // Fastify-Instanz mit DERSELBEN Vertrauenseinstellung, die `buildApp` benutzt — sie zeigt,
      // dass `request.hostname` unter diesen Bedingungen dem gefälschten Kopf folgt, während der
      // rohe Host-Kopf bei der Wahrheit bleibt. Ohne diese Messung wäre (b) eine Behauptung über
      // Fastify statt einer Messung an ihm.
      const probe = Fastify({ trustProxy: resolveTrustProxy() });
      probe.get("/probe", async (req) => ({
        hostname: req.hostname,
        rohkopf: req.headers.host ?? null,
      }));
      await probe.ready();
      const gemessen = (
        await probe.inject({
          method: "GET",
          url: "/probe",
          headers: { host: ECHT_HOST, "x-forwarded-host": DEMO_HOST },
        })
      ).json() as { hostname: string; rohkopf: string | null };
      expect(
        gemessen.hostname,
        "die Falle ist nicht scharf: `request.hostname` folgt hier gar nicht dem X-Forwarded-Host — H3 misst dann nichts",
      ).toContain(DEMO_HOST);
      expect(gemessen.rohkopf, "der rohe Host-Kopf ist nicht mehr der echte").toBe(ECHT_HOST);
      await probe.close();

      // (b) UND DIE ECHTE AUSKUNFT WIDERSTEHT GENAU DIESEM AUFRUF.
      const app = buildApp();
      expect(
        (await auskunftUnterHost(app, { host: ECHT_HOST, "x-forwarded-host": DEMO_HOST }))[NAME],
        "die echte Instanz hat sich über X-Forwarded-Host ein Demo-Etikett anhängen lassen",
      ).toBe(false);
      // Und die Gegenrichtung bleibt ebenfalls: die Demo behält ihre Kennzeichnung.
      expect(
        (await auskunftUnterHost(app, { host: DEMO_HOST, "x-forwarded-host": ECHT_HOST }))[NAME],
      ).toBe(true);
      await app.close();
    } finally {
      if (alt === undefined) {
        delete process.env.KLARWERK_TRUST_PROXY;
      } else {
        process.env.KLARWERK_TRUST_PROXY = alt;
      }
    }
  });

  it("H4 · KEINE Zeile Produktcode liest den abgelösten Wert noch — gemessen, nicht behauptet", () => {
    // H1 misst die WIRKUNG am Verhalten. Dieser Fall misst die QUELLE am Bestand: Ein Lesezugriff,
    // der heute niemandem auffällt, wäre morgen die zweite Wahrheit — und eine Verhaltensprobe
    // fände ihn nur, wenn sie zufällig seinen Zweig träfe.
    //
    // Gezählt werden Zugriffe (`process.env.NAME`, `env.NAME`, Indexzugriff mit dem Namen als
    // Zeichenkette), NICHT Erwähnungen: der Name steht zu Recht in Erklärtexten — er ist der Anlass
    // dieses Auftrags. Dieselbe Unterscheidung, die `mega46-schalter-eine-wahrheit` trifft.
    const ohneKommentar = (quelle: string): string =>
      quelle
        .split("\n")
        .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
        .join("\n");
    const muster = new RegExp(
      `(process\\.env\\.${ABGELOESTE_VARIABLE}\\b|\\benv\\.${ABGELOESTE_VARIABLE}\\b|\\[\\s*["'\`]${ABGELOESTE_VARIABLE}["'\`]\\s*\\])`,
    );
    // KALIBRIERUNG: Das Muster trifft echte Zugriffe und fällt nicht auf eine Erwähnung herein.
    expect(muster.test(`const a = process.env.${ABGELOESTE_VARIABLE};`)).toBe(true);
    expect(muster.test(`const a = env.${ABGELOESTE_VARIABLE};`)).toBe(true);
    expect(muster.test(`const a = process.env["${ABGELOESTE_VARIABLE}"];`)).toBe(true);
    expect(muster.test(ohneKommentar(`// nur ein Hinweis auf ${ABGELOESTE_VARIABLE}`))).toBe(false);

    const treffer: string[] = [];
    let gelesen = 0;
    for (const datei of quelldateien(join("services"))
      .concat(quelldateien(join("apps", "web", "src")))
      .filter((d) => !d.includes(".test."))) {
      gelesen += 1;
      if (muster.test(ohneKommentar(readFileSync(join(WURZEL, datei), "utf8")))) {
        treffer.push(datei);
      }
    }
    expect(gelesen, "die Erhebung hat gar nichts gelesen").toBeGreaterThan(200);
    expect(treffer, "der abgelöste Wert wird noch gelesen").toEqual([]);
  });

  it("H5 · der Katalog führt ihn NUR noch als abgelöst — kein stiller Kannwert", () => {
    // DER BENANNTE REST DIESES AUFTRAGS, hier festgehalten statt verschwiegen: `start-vertrag.ts`
    // führt den Namen weiter, weil `env.demo.beispiel` über `env-beispiel.test.ts` (C2/C5) hart an
    // den Katalog gebunden ist und NICHT in den Zielpfaden liegt. Der Eintrag muss dann wenigstens
    // sagen, was er ist. Wer ihn eines Tages wieder zu einem normalen Schalter macht — oder wer
    // beides endlich zusammen streicht —, kommt an dieser Zeile nicht vorbei.
    const eintrag = STARTVERTRAG.find((w) => w.name === ABGELOESTE_VARIABLE);
    expect(
      eintrag,
      `${ABGELOESTE_VARIABLE} fehlt im Katalog — dann muss auch die Beispieldatei fallen`,
    ).toBeDefined();
    expect(eintrag?.bereich, "der Katalogeintrag nennt die Ablösung nicht").toContain("abgelöst");
    expect(eintrag?.pflicht.art, "ein abgelöster Wert darf nie Pflicht sein").toBe("nie");
  });
});
