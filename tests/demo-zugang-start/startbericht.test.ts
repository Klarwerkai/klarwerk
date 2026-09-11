// ================================================================================================
// JOB 3655 · B — DER STARTBERICHT SAGT, WAS DIESE INSTANZ IST. UND ER VERRÄT DABEI KEIN GEHEIMNIS.
// ================================================================================================
//
// Auftrag §3 und §5(c): Der Bericht nennt Betriebsart, Datenbank (Wirt und Name, KEIN Kennwort),
// ob die Datenhaltung leer ist und welche Zusatzfunktionen an sind — und er darf NIE einen Wert
// ausgeben, der ein Geheimnis sein kann.
//
// WIE DIE GEHEIMNISPRÜFUNG GEBAUT IST, damit sie nicht mitwächst und trotzdem grün bleibt: Die
// Probe setzt JEDEN Wert des Vertrags auf eine EINDEUTIGE Zeichenkette und hält den fertigen
// Bericht dagegen. Ein künftiger Eintrag ist damit automatisch mitgeprüft — niemand muss daran
// denken. Ausgenommen ist nur, was der Auftrag ausdrücklich verlangt: Wirt und Name der Datenbank.
//
// ------------------------------------------------------------------------------------------------
// RUNDE 2 — WAS BEN GEMESSEN HAT UND WAS HIER DAGEGEN STEHT
// ------------------------------------------------------------------------------------------------
//   B8/B14  Der Bericht trug einen freien Fehlertext (`String(fehler)`) aus der Bestandsabfrage.
//           Ein künstlich gesetztes Geheimnis erreichte darüber die echte Logsenke.
//   B13     `KLARWERK_REASONER_POLICY` hat exakt 24 Zeichen und wurde von `sanitizeLogText`
//           (Regel 4) zu `[redacted]` — der Warnsatz kam ohne den Namen an, um den es ging.
//   B5      `KLARWERK_DEV_PERSIST=0` meldete ein Journal, obwohl `server.ts` nur „1" aktiviert.
// Alle drei werden hier gegen die ECHTEN Produktionsfunktionen gemessen, nicht gegen Nachbauten.
import { describe, expect, it } from "vitest";
import { addonApiEnabled } from "../../services/app/src/addon-api";
import { senkeUeberWert } from "../../services/app/src/build-app";
import { SCHALTER_REGISTRY } from "../../services/app/src/feature-flags";
import {
  type Bestandsbefund,
  STARTVERTRAG,
  type Startbericht,
  ermittleBestand,
  startbericht,
} from "../../services/app/src/start-vertrag";

const LEER: Bestandsbefund = { art: "leer" };

/** Jeder Vertragswert gesetzt, jeder mit einer eigenen, im Bericht wiedererkennbaren Zeichenkette. */
function alleWerteGesetzt(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  for (const wert of STARTVERTRAG) {
    env[wert.name] = `GEHEIMPROBE-${wert.name}-4711`;
  }
  // Zwei Werte werden vom Bericht ausgelegt statt nur gezählt und brauchen deshalb echte Form.
  env.NODE_ENV = "production";
  env.DATABASE_URL = "postgresql://demo_kennung:SUPERGEHEIM123@db-demo.intern:6543/klarwerk_demo";
  return env;
}

/** Der ganze Bericht als Text — so, wie ihn ein Mensch im Protokoll sieht. */
function alsText(bericht: Startbericht): string {
  return JSON.stringify(bericht);
}

describe("JOB 3655 B · der Startbericht", () => {
  it("B1 · gibt KEINEN gesetzten Wert aus — nur Namen", () => {
    const env = alleWerteGesetzt();
    const text = alsText(startbericht(env, LEER));
    for (const wert of STARTVERTRAG) {
      const gesetzterWert = env[wert.name];
      if (gesetzterWert === undefined || wert.name === "DATABASE_URL" || wert.name === "NODE_ENV") {
        continue;
      }
      expect(text, `der Wert von ${wert.name} steht im Bericht`).not.toContain(gesetzterWert);
      // Der NAME muss dagegen drinstehen — sonst wäre der Bericht still unvollständig.
      expect(text, `${wert.name} fehlt im Bericht`).toContain(wert.name);
    }
  });

  it("B2 · Kalibrierung: die Probe WÜRDE einen durchgereichten Wert finden", () => {
    // Ein Geheimnis-Wächter, der nie rot werden kann, ist keiner. Diese Probe zeigt, dass die
    // Prüfung aus B1 greift: derselbe Vergleich gegen einen Text, der den Wert enthält.
    const env = alleWerteGesetzt();
    const erfunden = `Debug: SMTP_PASS=${env.SMTP_PASS}`;
    expect(erfunden).toContain(env.SMTP_PASS ?? "");
    expect(alsText(startbericht(env, LEER))).not.toContain(env.SMTP_PASS ?? "");
  });

  it("B3 · die Datenbank steht mit Wirt und Namen da — Kennung und Kennwort nicht", () => {
    const text = alsText(startbericht(alleWerteGesetzt(), LEER));
    expect(text).toContain("db-demo.intern:6543");
    expect(text).toContain("klarwerk_demo");
    expect(text).not.toContain("SUPERGEHEIM123");
    expect(text).not.toContain("demo_kennung");
  });

  it("B4 · eine unlesbare Verbindungszeichenkette wird NICHT ausgegeben, sondern gemeldet", () => {
    const text = alsText(
      startbericht({ NODE_ENV: "production", DATABASE_URL: "kein:*:url ??? geheim-rest" }, LEER),
    );
    expect(text).toContain("nicht lesbar");
    expect(text).not.toContain("geheim-rest");
  });

  it("B5 · KORREKTURPFLICHT 4: Journal meldet NUR, was das Journal auch einschaltet", () => {
    // `devPersistFile()` in server.ts prüft `process.env.KLARWERK_DEV_PERSIST !== "1"`. Nur die
    // Zeichenkette „1" aktiviert das Journal — alles andere, auch „0" und „false", bedeutet
    // In-Memory. Runde 1 fragte bloss „gesetzt?" und meldete bei „0" ein Journal, das nicht lief.
    for (const wert of [undefined, "", "  ", "0", "false", "ja", "true", "2"]) {
      const text = alsText(startbericht({ KLARWERK_DEV_PERSIST: wert }, LEER));
      expect(
        text,
        `KLARWERK_DEV_PERSIST=${JSON.stringify(wert)} meldet fälschlich Journal`,
      ).toContain("In-Memory");
      expect(
        text,
        `KLARWERK_DEV_PERSIST=${JSON.stringify(wert)} meldet fälschlich Journal`,
      ).not.toContain("Journal");
    }
    const an = alsText(startbericht({ KLARWERK_DEV_PERSIST: "1" }, LEER));
    expect(an).toContain("Journal");
    expect(an).not.toContain("In-Memory");
  });

  it("B6 · „Bestand leer“ steht nur da, wenn der Bestand wirklich leer ist", () => {
    expect(startbericht({}, LEER).bestand).toContain("leer —");
    const gefuellt = startbericht({}, { art: "gefuellt", wissensobjekte: 12, konten: 3 }).bestand;
    expect(gefuellt).toContain("12 Wissensobjekt(e), 3 Konto/Konten");
    expect(gefuellt).not.toContain("leer");
  });

  it("B7 · eine gescheiterte Abfrage heisst UNBEKANNT, nennt die Quelle und sonst nichts", () => {
    // Das ist die Lehre aus dem Zustandsmodell: eine nicht beantwortbare Frage darf nicht aussehen
    // wie eine beantwortete. Wer „leer" liest, glaubt, die Instanz sei sauber aufgesetzt.
    const bestand = startbericht({}, { art: "unbekannt", gescheitert: ["konten"] }).bestand;
    expect(bestand).toContain("UNBEKANNT");
    expect(bestand).toContain("konten");
    expect(bestand).not.toContain("leer —");
  });

  it("B8 · KORREKTURPFLICHT 2: der Befund trägt keinen Fehlertext, der Fehler geht eigenen Weg", async () => {
    const INHALT = "Key (email)=(pedi@klarwerk.ai) already exists";
    const gemeldet: { quelle: string; fehler: unknown }[] = [];
    const befund = await ermittleBestand(
      {
        wissensobjekte: async () => {
          throw new Error(`duplicate key value violates unique constraint: ${INHALT}`);
        },
        konten: async () => [],
      },
      (quelle, fehler) => gemeldet.push({ quelle, fehler }),
    );
    // Der Befund weiss, WELCHE Abfrage gescheitert ist — und trägt keinerlei freien Text.
    expect(befund).toEqual({ art: "unbekannt", gescheitert: ["wissensobjekte"] });
    expect(JSON.stringify(befund)).not.toContain("pedi@klarwerk.ai");
    expect(alsText(startbericht({}, befund))).not.toContain("pedi@klarwerk.ai");
    // Der rohe Fehler ist NICHT verloren: er geht an den Melder, der ihn in den `err`-Serializer
    // gibt. Nur dort — und dort ersetzt der Serializer Meldung und Stack.
    expect(gemeldet).toHaveLength(1);
    expect(gemeldet[0]?.quelle).toBe("wissensobjekte");
    expect(String((gemeldet[0]?.fehler as Error).message)).toContain("pedi@klarwerk.ai");
  });

  it("B9 · der Bestandsbefund unterscheidet beide Quellen einzeln", async () => {
    await expect(
      ermittleBestand({ wissensobjekte: async () => [], konten: async () => [] }),
    ).resolves.toEqual({ art: "leer" });
    await expect(
      ermittleBestand({ wissensobjekte: async () => [1, 2, 3], konten: async () => [1] }),
    ).resolves.toEqual({ art: "gefuellt", wissensobjekte: 3, konten: 1 });
    // Scheitern BEIDE, stehen auch beide da — eine Sammelmeldung, kein „die erste gewinnt".
    await expect(
      ermittleBestand({
        wissensobjekte: async () => {
          throw new Error("a");
        },
        konten: async () => {
          throw new Error("b");
        },
      }),
    ).resolves.toEqual({ art: "unbekannt", gescheitert: ["wissensobjekte", "konten"] });
    // Und ein gefüllter Bestand neben einer kaputten Abfrage ist NICHT „gefüllt", sondern unbekannt.
    await expect(
      ermittleBestand({
        wissensobjekte: async () => [1],
        konten: async () => {
          throw new Error("b");
        },
      }),
    ).resolves.toEqual({ art: "unbekannt", gescheitert: ["konten"] });
  });

  it("B10 · der Bericht nennt die Mängel, die man sonst erst beim Klicken merkt", () => {
    const leer = startbericht({}, LEER);
    const befunde = leer.maengel.map((m) => m.befund).join(" ");
    const betroffen = leer.maengel.flatMap((m) => m.betrifft);
    expect(befunde).toContain("Kein KI-Schlüssel");
    expect(betroffen).toContain("ANTHROPIC_API_KEY");
    expect(befunde).toContain("Kein Mailversand");
    expect(betroffen).toContain("SMTP_HOST");
    // Halb konfiguriertes SSO ist AUS und sagt, was fehlt.
    const halbesSso = startbericht(
      { OIDC_ISSUER: "https://idp.example", OIDC_AUDIENCE: "klarwerk" },
      LEER,
    );
    const sso = halbesSso.maengel.find((m) => m.befund.includes("SSO ist unvollständig"));
    expect(sso?.betrifft).toContain("OIDC_JWKS_URI");
    // Vollständiges SSO ist KEIN Mangel — sonst wäre die Meldung Rauschen.
    const vollesSso: Record<string, string> = {};
    for (const name of [
      "OIDC_ISSUER",
      "OIDC_AUDIENCE",
      "OIDC_JWKS_URI",
      "OIDC_AUTHORIZE_URL",
      "OIDC_TOKEN_URL",
      "OIDC_CLIENT_ID",
      "OIDC_REDIRECT_URI",
    ]) {
      vollesSso[name] = "x";
    }
    expect(
      startbericht(vollesSso, LEER).maengel.some((m) => m.befund.includes("SSO ist unvollständig")),
    ).toBe(false);
    // Add-in eingeschaltet, aber ohne Schlüssel: der Pfad ist zu.
    const addon = startbericht({ KLARWERK_ADDON_API: "1" }, LEER);
    expect(addon.maengel.map((m) => m.befund).join(" ")).toContain("trotzdem ZU");
    expect(addon.maengel.flatMap((m) => m.betrifft)).toContain("KLARWERK_ADDON_API_KEY");
  });

  it("B11 · die gemessene Falle aus dem Auftrag steht im Bericht", () => {
    // Auftrag §2: Ist KLARWERK_REASONER_POLICY gesetzt, antwortet der Schreibweg der KI-Zuordnung
    // mit 409 (ReasonerPolicyLockedError → reasoner-routes.ts). Eine Vorführung, die die Zuordnung
    // umstellen will, scheitert dann — und niemand wüsste warum.
    const bericht = startbericht({ KLARWERK_REASONER_POLICY: "deterministic" }, LEER);
    const mangel = bericht.maengel.find((m) => m.betrifft.includes("KLARWERK_REASONER_POLICY"));
    expect(mangel?.befund).toContain("409");
    // Der Fehlercode steht in seinem eigenen Feld — im Satz wäre er von der Senke zerstört worden.
    expect(mangel?.code).toBe("REASONER_POLICY_ENV_LOCKED");
    expect(
      startbericht({}, LEER).maengel.some((m) => m.betrifft.includes("KLARWERK_REASONER_POLICY")),
    ).toBe(false);
  });

  it("B12 · der Bericht liest die Schalter aus dem Registry, nicht aus einer Abschrift", () => {
    const bericht = startbericht({}, LEER);
    for (const name of Object.keys(SCHALTER_REGISTRY)) {
      expect(Object.keys(bericht.zusatzfunktionen), `Schalter ${name} fehlt`).toContain(name);
      expect(["an", "aus"]).toContain(bericht.zusatzfunktionen[name]);
    }
  });

  it("B13 · KORREKTURPFLICHT 3: JEDER Name übersteht die echte Logsenke unverändert", () => {
    // DIE MESSUNG, die Runde 1 gefehlt hat: nicht der erzeugte Bericht wird geprüft, sondern der
    // Bericht NACH `senkeUeberWert` — genau der Funktion, die `buildApp` als Log-Hook einhängt.
    // Vorher wurde `KLARWERK_REASONER_POLICY` (24 Zeichen) darin zu `[redacted]`.
    const env = alleWerteGesetzt();
    const bericht = startbericht(env, LEER);
    const durchDieSenke = senkeUeberWert(bericht, env) as Startbericht;
    expect(durchDieSenke).toEqual(bericht);
    // Und namentlich der Wert aus dem Auftrag, in der Form, in der er wirklich ausgegeben wird.
    const mitPolicy = startbericht({ ...env, KLARWERK_REASONER_POLICY: "deterministic" }, LEER);
    expect(JSON.stringify(senkeUeberWert(mitPolicy, env))).toContain("KLARWERK_REASONER_POLICY");
  });

  it("B14 · Kalibrierung: die Senke WÜRDE einen Namen im Fliesstext zerstören", () => {
    // Ohne diese Gegenrichtung wäre B13 ein Wächter, der nicht zeigen kann, dass er etwas bewacht.
    // Genau dieser Satz ist die Form, die Runde 1 ausgegeben hat.
    const satz = "KLARWERK_REASONER_POLICY ist gesetzt — die KI-Zuordnung ist gesperrt.";
    expect(senkeUeberWert(satz, {})).toContain("[redacted]");
    expect(senkeUeberWert(satz, {})).not.toContain("KLARWERK_REASONER_POLICY");
    // Derselbe Name ALLEIN in seinem Feld kommt dagegen durch — das ist der Weg, den der Bericht geht.
    expect(senkeUeberWert("KLARWERK_REASONER_POLICY", {})).toBe("KLARWERK_REASONER_POLICY");
  });

  it("B15 · jeder Vertragsname hat die Form, die durch die Senke kommt", () => {
    // Die Zusicherung aus B13 hängt an einer Eigenschaft der NAMEN: `senkeUeberWert` lässt nur
    // reine GROSSBUCHSTABEN_MIT_UNTERSTRICH unangetastet. Ein künftiger Eintrag mit einer Ziffer
    // oder einem Kleinbuchstaben würde still redigiert — dieser Test fängt ihn vorher ab.
    for (const wert of STARTVERTRAG) {
      expect(wert.name, `${wert.name} überlebt die Logsenke nicht`).toMatch(/^[A-Z_]+$/);
    }
  });

  it("B16 · die „an“-Regel des Berichts läuft mit addonApiEnabled() gleich", () => {
    // Der Bericht wertet KLARWERK_ADDON_API selbst aus (er bekommt seine Umgebung übergeben und
    // liest nicht process.env). Diese Probe hält fest, dass er dabei dieselbe Regel anwendet wie
    // der Code, der den Pfad wirklich registriert — sonst meldete er „an", wo „aus" gilt.
    const vorher = process.env.KLARWERK_ADDON_API;
    try {
      for (const roh of ["1", "true", "0", "false", "ja", "", undefined]) {
        if (roh === undefined) {
          delete process.env.KLARWERK_ADDON_API;
        } else {
          process.env.KLARWERK_ADDON_API = roh;
        }
        const berichtSagtAn = startbericht(
          { KLARWERK_ADDON_API: roh, KLARWERK_ADDON_API_KEY: undefined },
          LEER,
        ).maengel.some((m) => m.betrifft.includes("KLARWERK_ADDON_API"));
        expect(berichtSagtAn, `Wert ${JSON.stringify(roh)}`).toBe(addonApiEnabled());
      }
    } finally {
      if (vorher === undefined) {
        delete process.env.KLARWERK_ADDON_API;
      } else {
        process.env.KLARWERK_ADDON_API = vorher;
      }
    }
  });
});
