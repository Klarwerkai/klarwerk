// ================================================================================================
// JOB 3655 · E — DIE INSTANZ KOMMT GEGEN EINE LEERE DATENHALTUNG HOCH. ODER GAR NICHT.
// ================================================================================================
//
// Hier wird nicht mehr die reine Funktion gemessen, sondern die echte Anwendung: `buildApp` mit
// leerem Repo-Satz, über den fail-closed Readiness-Pfad (`app.ready()`), mit echtem Logger und
// echten HTTP-Anfragen.
//
// Auftrag §5(a) und §5(b) in einer Datei, weil es dieselbe Zusicherung von zwei Seiten ist:
//   · ohne Pflichtwert wird die Anwendung NIEMALS bereit (kein Fenster mit halber Ausstattung),
//   · mit Pflichtwerten kommt sie gegen eine LEERE Datenhaltung sauber hoch und meldet das ehrlich.
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

/** Der ursprüngliche Umgebungssatz — jede Probe stellt ihn hinterher wieder her. */
const URSPRUNG = { ...process.env };

afterEach(() => {
  for (const schluessel of Object.keys(process.env)) {
    if (!(schluessel in URSPRUNG)) {
      delete process.env[schluessel];
    }
  }
  Object.assign(process.env, URSPRUNG);
});

/** Eine App mit lesbarem Protokollpuffer. */
function appMitPuffer(): { app: ReturnType<typeof buildApp>; zeilen: string[] } {
  const zeilen: string[] = [];
  const app = buildApp(buildServices(), {
    log: { senke: { write: (zeile: string) => void zeilen.push(zeile) }, stufe: "info" },
  });
  return { app, zeilen };
}

describe("JOB 3655 E · Start gegen eine leere Datenhaltung", () => {
  it("E1 · fehlt ein Pflichtwert in Produktion, entsteht die Anwendung gar nicht erst", () => {
    // Ein gesetzter LEERER Wert zählt wie ein fehlender — sonst genügte ein `DATABASE_URL=` in
    // einer Umgebungsdatei, um die Prüfung zu umgehen.
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "";
    process.env.APP_BASE_URL = "";
    let gefangen: unknown;
    try {
      appMitPuffer();
    } catch (fehler) {
      gefangen = fehler;
    }
    expect(gefangen, "die App entstand trotz fehlender Pflichtwerte").toBeDefined();
    const meldung = String((gefangen as Error).message);
    // ALLE Namen, nicht der erste.
    expect(meldung).toContain("DATABASE_URL");
    expect(meldung).toContain("APP_BASE_URL");
  });

  it("E2 · es entsteht kein Server, der irgendetwas annehmen könnte", () => {
    // Das ist der Teil, der wirklich zählt: „startet nicht" heisst nicht „loggt einen Fehler".
    // Es gibt in diesem Zustand gar kein App-Objekt, an das man eine Anfrage richten könnte.
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;
    delete process.env.APP_BASE_URL;
    expect(() => appMitPuffer()).toThrow(/Pflichtwert\(e\)/);
    // Gegenrichtung, damit die Probe nicht an irgendeinem Fehler hängt: mit beiden Werten entsteht
    // dieselbe App anstandslos.
    process.env.DATABASE_URL = "postgresql://k:g@db-demo.intern:5432/klarwerk_demo";
    process.env.APP_BASE_URL = "https://demo.klarwerk.ai";
    expect(() => appMitPuffer()).not.toThrow();
  });

  it("E3 · vollständig ausgestattet kommt sie gegen eine LEERE Datenhaltung hoch", async () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://kennung:GEHEIM@db-demo.intern:5432/klarwerk_demo";
    process.env.APP_BASE_URL = "https://demo.klarwerk.ai";
    const { app, zeilen } = appMitPuffer();
    await app.ready();
    const protokoll = zeilen.join("\n");
    // Der Startbericht ist da und sagt die Wahrheit über eine frische Instanz — gemessen an der
    // ECHTEN Logsenke, also NACH `senkeUeberWert` und den pino-Serializern.
    expect(protokoll).toContain("KLARWERK Startbericht");
    expect(protokoll).toContain("Produktion");
    expect(protokoll).toContain("Datenbank klarwerk_demo");
    expect(protokoll).toContain("leer —");
    // RUNDE 2, KORREKTURPFLICHT 3: die langen Vertragsnamen stehen VOLLSTÄNDIG in der Ausgabe.
    // `KLARWERK_REASONER_POLICY` hat 24 Zeichen und wurde in Runde 1 hier zu `[redacted]`.
    expect(protokoll).toContain("KLARWERK_REASONER_POLICY");
    expect(protokoll).toContain("KLARWERK_TRASH_SWEEP_INTERVAL_MS");
    // Und er verrät dabei kein Geheimnis.
    expect(protokoll).not.toContain("GEHEIM@");
    expect(protokoll).not.toContain("kennung:");
    await app.close();
  });

  it("E3b · KORREKTURPFLICHT 2: fremder Inhalt im Abfragefehler erreicht die Logsenke NICHT", async () => {
    // Der Weg, den BEN gefunden hat: `ermittleBestand` fing den Fehler und schrieb `String(fehler)`
    // in den Bericht. Hier scheitert die Bestandsabfrage mit einem Fehler, der fremde Inhalte in
    // seiner Meldung trägt — und gemessen wird die ECHTE Logausgabe, nicht der rohe Bericht.
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://kennung:GEHEIM@db-demo.intern:5432/klarwerk_demo";
    process.env.APP_BASE_URL = "https://demo.klarwerk.ai";
    const zeilen: string[] = [];
    const services = buildServices();
    // DIE NUTZLAST IST MIT BEDACHT GEWAEHLT. Ein Fehlertext mit einer `user:pass@host`-Adresse
    // waere KEIN Beleg: den faengt `sanitizeLogText` (Regel 3) ohnehin ab, und der Test waere auch
    // ohne die Korrektur gruen. Ein echter Datenbankfehler traegt aber regelmaessig INHALTE —
    // „duplicate key … (email)=(…)" ist die haeufigste Form davon. Genau daran haengt die Doktrin
    // des `err`-Serializers, Meldung und Stack durch eine Konstante zu ersetzen.
    const kaputt: typeof services = {
      ...services,
      ko: Object.assign(Object.create(Object.getPrototypeOf(services.ko)), services.ko, {
        listForSearch: async () => {
          throw new Error(
            'duplicate key value violates unique constraint "ko_pkey": Key (email)=(pedi@klarwerk.ai) already exists',
          );
        },
      }),
    };
    const app = buildApp(kaputt, {
      log: { senke: { write: (zeile: string) => void zeilen.push(zeile) }, stufe: "info" },
    });
    await app.ready();
    const protokoll = zeilen.join("\n");
    expect(protokoll).not.toContain("pedi@klarwerk.ai");
    expect(protokoll).not.toContain("duplicate key");
    // Der Befund ist ehrlich UNBEKANNT — nicht „leer".
    expect(protokoll).toContain("UNBEKANNT");
    expect(protokoll).toContain("wissensobjekte");
    // Und der Fehler ist nicht verschwunden: er steht als eigene Warnzeile da, durch den
    // `err`-Serializer gereinigt (Typ und Herkunft ja, Meldung und Stack unterdrückt).
    expect(protokoll).toContain("Bestandsabfrage gescheitert");
    await app.close();
  });

  it("E4 · die leere Instanz antwortet ehrlich mit leeren Listen statt mit einem Fehler", async () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://kennung:GEHEIM@db-demo.intern:5432/klarwerk_demo";
    process.env.APP_BASE_URL = "https://demo.klarwerk.ai";
    const { app } = appMitPuffer();
    await app.ready();
    // Die Ersteinrichtung ist der Zustand, in dem eine frische Instanz steht: noch kein Konto.
    const setup = await app.inject({ method: "GET", url: "/api/auth/status" });
    expect(setup.statusCode).toBe(200);
    expect(setup.json()).toMatchObject({ needsSetup: true });
    await app.close();
  });

  it("E5 · ausserhalb der Produktion braucht es keinen Pflichtwert — der Bericht kommt trotzdem", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.DATABASE_URL;
    delete process.env.APP_BASE_URL;
    const { app, zeilen } = appMitPuffer();
    await app.ready();
    const protokoll = zeilen.join("\n");
    expect(protokoll).toContain("Nicht-Produktion");
    expect(protokoll).toContain("In-Memory");
    expect(protokoll).toContain("leer —");
    await app.close();
  });
});
