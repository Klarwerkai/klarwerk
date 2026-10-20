import { createHash, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { repoPfad } from "../support/repoPfad";

// ================================================================================================
// KLARA-OFFICE-01 · DER WORD-ADAPTER DER BEGLEITAPP (`apps/web/public/word-addin/office-host-word.js`)
// ================================================================================================
//
// Ausgeführt wird die AUSGELIEFERTE Datei, nicht ein Nachbau. office.js ist eine Attrappe: die
// Auswahl ist von aussen setzbar, `DocumentSelectionChanged` auslösbar. Was das NICHT belegt:
// echtes Word (Mac/Web), echtes office.js, Sideload — das bleibt die lokale Hostbedienprüfung.
//
// Fiktive Inhalte: „Angebot Musterfirma" ist erfunden.

const DATEI = repoPfad("apps/web/public/word-addin/office-host-word.js");
const QUELLE = readFileSync(DATEI, "utf8");
const AUSWAHL = "Angebot Musterfirma";

interface Antwort {
  status: number;
  json: Record<string, unknown> | null;
}
type Abruf = (
  pfad: string,
  methode: string,
  koerper: unknown,
  bindung: Bindung,
) => Promise<Antwort>;
interface Bindung {
  sessionId: string;
  instanz: string;
  dokument: string;
}
interface Adapter {
  melde(): Promise<Record<string, unknown> | null>;
  pruefeZiel(): Promise<Record<string, unknown>>;
  fuegeEin(text: string): Promise<Record<string, unknown>>;
  beobachte(): void;
  kontextWechsel(): void;
  verwerfe(): Promise<unknown>;
  zustand(): string;
  marke(): string | null;
}

function lade(): { erstelleWordAdapter(umgebung: unknown): Adapter; VERTRAG: string } {
  const wurzel: Record<string, unknown> = {};
  // Klassisches Skript wie im Browser: `self` ist die Wurzel, an die es sich hängt.
  new Function("self", QUELLE)(wurzel);
  return wurzel.KlarwerkOfficeHostWord as ReturnType<typeof lade>;
}

function attrappe(start = AUSWAHL) {
  const lage = {
    text: start,
    gelesen: 0,
    handler: null as null | (() => void),
    /** Läuft beim Lesen der Auswahl (in `sync`) — ein Wechsel „während des Auswahllesens". */
    beimLesen: null as null | ((nummer: number) => void),
    /** Läuft beim Hashen — ein Wechsel „während des Hashens". */
    beimHashen: null as null | (() => void),
    eingefuegt: [] as string[],
  };
  const word = {
    run<T>(rueckruf: (kontext: unknown) => Promise<T>): Promise<T> {
      const auswahl: {
        text?: string;
        load(feld: string): void;
        insertText(text: string, ort: string): void;
      } = {
        load(feld: string) {
          expect(feld).toBe("text");
        },
        insertText(text: string, ort: string) {
          lage.eingefuegt.push(`${ort}:${text}`);
        },
      };
      const kontext = {
        document: {
          getSelection() {
            lage.gelesen += 1;
            return auswahl;
          },
        },
        sync: async () => {
          lage.beimLesen?.(lage.gelesen);
          auswahl.text = lage.text;
        },
      };
      return rueckruf(kontext);
    },
  };
  const office = {
    context: {
      diagnostics: { platform: "Mac", version: "16.89" },
      document: {
        addHandlerAsync(art: string, handler: () => void) {
          expect(art).toBe("documentSelectionChanged");
          lage.handler = handler;
        },
      },
    },
    EventType: { DocumentSelectionChanged: "documentSelectionChanged" },
  };
  const krypto = {
    subtle: {
      // Der Datentyp kommt aus der Signatur selbst — so passt er zu jeder Node-Typfassung.
      digest(art: string, daten: Parameters<typeof webcrypto.subtle.digest>[1]) {
        lage.beimHashen?.();
        return webcrypto.subtle.digest(art, daten);
      },
    },
  };
  return { lage, word, office, krypto };
}

/** Ein Abruf, dessen Antworten der Test selbst und in beliebiger Reihenfolge freigibt. */
function steuerbarerAbruf() {
  const offen: {
    pfad: string;
    methode: string;
    koerper: unknown;
    bindung: Bindung;
    antworte(antwort: Antwort): void;
    scheitere(): void;
  }[] = [];
  const abruf: Abruf = (pfad, methode, koerper, bindung) =>
    new Promise<Antwort>((resolve, reject) => {
      offen.push({
        pfad,
        methode,
        koerper,
        bindung: { ...bindung },
        antworte: resolve,
        scheitere: () => reject(new Error("netz")),
      });
    });
  return { abruf, offen };
}

function markeAntwort(marke: string): Antwort {
  return { status: 200, json: { marke, bezug: { kennung: `office:word:doc-s-1#${marke}` } } };
}

const BINDUNG: Bindung = { sessionId: "s-1", instanz: "inst-1", dokument: "doc-s-1" };

function summe(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

describe("KO-01-03 · der Adapter liest nur über die offizielle Word-Schnittstelle", () => {
  it("Quelle: kein window.getSelection, keine Tutorialanker — nur context.document.getSelection", () => {
    expect(QUELLE).toContain("kontext.document.getSelection()");
    expect(QUELLE).not.toMatch(/window\.getSelection|document\.getSelection\(\)\.toString/);
    expect(QUELLE).not.toMatch(/data-help|data-tutorial|querySelector/);
  });

  it("der alte Word-Rückgabevertrag bleibt unberührt: taskpane.html lädt den Adapter nicht", () => {
    const taskpane = readFileSync(repoPfad("apps/web/public/word-addin/taskpane.html"), "utf8");
    expect(taskpane).not.toContain("office-host-word.js");
  });

  it("die Meldung trägt Host, Fassung, Länge und Prüfsumme — nie den Text", async () => {
    const { lage, word, office } = attrappe();
    const gesendet: { pfad: string; methode: string; koerper: unknown }[] = [];
    const abruf: Abruf = async (pfad, methode, koerper) => {
      gesendet.push({ pfad, methode, koerper });
      return { status: 200, json: { marke: "m-1", bezug: { kennung: "office:word:doc-s-1#1" } } };
    };
    const { erstelleWordAdapter, VERTRAG } = lade();
    const adapter = erstelleWordAdapter({
      office,
      word,
      crypto: webcrypto,
      abruf,
      bindung: () => BINDUNG,
    });
    expect(adapter.zustand()).toBe("getrennt");
    const bezug = await adapter.melde();
    expect(bezug).toEqual({ kennung: "office:word:doc-s-1#1" });
    expect(lage.gelesen).toBe(1);
    expect(adapter.zustand()).toBe("aktiv");
    expect(gesendet).toHaveLength(1);
    expect(gesendet[0]?.pfad).toBe("/api/klara/sessions/s-1/office-kontext");
    expect(gesendet[0]?.methode).toBe("POST");
    expect(gesendet[0]?.koerper).toEqual({
      vertrag: VERTRAG,
      host: { anwendung: "word", plattform: "Mac", version: "16.89" },
      objekt: { art: "dokument" },
      auswahl: {
        quelle: "host-api",
        art: "text",
        laenge: AUSWAHL.length,
        pruefsumme: summe(AUSWAHL),
      },
      sequenz: 1,
    });
    expect(JSON.stringify(gesendet)).not.toContain(AUSWAHL);
    await adapter.melde();
    expect((gesendet[1]?.koerper as { sequenz: number }).sequenz).toBe(2);
  });
});

describe("KO-01-06 · Wechsel und Fehlschläge verwerfen den Handlungsbezug sichtbar", () => {
  it("eine Auswahländerung macht die Marke ungültig; ohne Marke wird nicht gefragt", async () => {
    const { lage, word, office } = attrappe();
    let aufrufe = 0;
    const abruf: Abruf = async () => {
      aufrufe += 1;
      return { status: 200, json: { marke: "m-1", bezug: {} } };
    };
    const adapter = lade().erstelleWordAdapter({
      office,
      word,
      crypto: webcrypto,
      abruf,
      bindung: () => BINDUNG,
    });
    adapter.beobachte();
    await adapter.melde();
    lage.handler?.();
    expect(adapter.zustand()).toBe("veraltet");
    expect(adapter.marke()).toBeNull();
    const ergebnis = await adapter.pruefeZiel();
    expect(ergebnis).toEqual({ gueltig: false, grund: "keine_marke", aktion: "aktualisieren" });
    expect(aufrufe).toBe(1);
  });

  it("Absage des Servers, Netzfehler und fehlende Bindung ⇒ getrennt, keine Marke", async () => {
    const { word, office } = attrappe();
    const lade1 = lade();
    const abgelehnt = lade1.erstelleWordAdapter({
      office,
      word,
      crypto: webcrypto,
      abruf: async () => ({ status: 403, json: { error: "OFFICE_HERKUNFT" } }),
      bindung: () => BINDUNG,
    });
    expect(await abgelehnt.melde()).toBeNull();
    expect(abgelehnt.zustand()).toBe("getrennt");

    const netz = lade1.erstelleWordAdapter({
      office,
      word,
      crypto: webcrypto,
      abruf: async () => {
        throw new Error("offline");
      },
      bindung: () => BINDUNG,
    });
    expect(await netz.melde()).toBeNull();
    expect(netz.zustand()).toBe("getrennt");

    let gefragt = false;
    const ohne = lade1.erstelleWordAdapter({
      office,
      word,
      crypto: webcrypto,
      abruf: async () => {
        gefragt = true;
        return { status: 200, json: {} };
      },
      bindung: () => null,
    });
    expect(await ohne.melde()).toBeNull();
    expect(gefragt).toBe(false);
  });

  it("verwerfe() (Konto-/Dokumentwechsel) löscht die Marke und meldet es dem Server", async () => {
    const { word, office } = attrappe();
    const methoden: string[] = [];
    const adapter = lade().erstelleWordAdapter({
      office,
      word,
      crypto: webcrypto,
      abruf: async (_pfad: string, methode: string) => {
        methoden.push(methode);
        return { status: 200, json: { marke: "m-1", bezug: {} } };
      },
      bindung: () => BINDUNG,
    });
    await adapter.melde();
    await adapter.verwerfe();
    expect(methoden).toEqual(["POST", "DELETE"]);
    expect(adapter.marke()).toBeNull();
    expect(adapter.zustand()).toBe("getrennt");
  });
});

// ------------------------------------------------------------------------------------------------
// NACHARBEIT 2 (Ben, office-host-word.js:118) — VERSPÄTETE ANTWORTEN UND KONTEXTWECHSEL
// ------------------------------------------------------------------------------------------------
//
// Die Fälle sind die der technischen Hilfe (QUELLEN-TECHNISCHE-HILFE-bcf85b38-20261010.json,
// `gezielte_testvorbereitung_fuer_claude`). Jede Antwort gibt der Test selbst frei — in der
// Reihenfolge, die den Fehler auslösen würde.

const BEGONNEN = { timeout: 2000 };

function aufbau(bindung: () => Bindung | null = () => BINDUNG) {
  const { lage, word, office, krypto } = attrappe();
  const { abruf, offen } = steuerbarerAbruf();
  const adapter = lade().erstelleWordAdapter({ office, word, crypto: krypto, abruf, bindung });
  adapter.beobachte();
  return { lage, adapter, offen };
}

describe("KO-01-06 · verspätete Antworten aktivieren keinen verworfenen Kontext", () => {
  it("Meldung zurückhalten, verwerfe() abschließen, alte Meldung freigeben: kein aktiver Bezug", async () => {
    const { adapter, offen } = aufbau();
    const laeuft = adapter.melde();
    await vi.waitFor(() => expect(offen).toHaveLength(1), BEGONNEN);
    const weg = adapter.verwerfe();
    expect(offen[1]?.methode).toBe("DELETE");
    offen[1]?.antworte({ status: 200, json: { verbindung: "getrennt" } });
    await weg;
    offen[0]?.antworte(markeAntwort("m-alt"));
    expect(await laeuft).toBeNull();
    expect(adapter.marke()).toBeNull();
    expect(adapter.zustand()).toBe("getrennt");
  });

  it("erste Meldung im Zustand getrennt, Auswahlwechsel vor der Antwort: alte Meldung verworfen", async () => {
    const { lage, adapter, offen } = aufbau();
    expect(adapter.zustand()).toBe("getrennt");
    const laeuft = adapter.melde();
    await vi.waitFor(() => expect(offen).toHaveLength(1), BEGONNEN);
    lage.handler?.();
    offen[0]?.antworte(markeAntwort("m-alt"));
    expect(await laeuft).toBeNull();
    expect(adapter.marke()).toBeNull();
    expect(adapter.zustand()).toBe("getrennt");
  });

  it.each(["auswahlwechsel", "verwerfe"] as const)(
    "pruefeZiel läuft, %s während der Anfrage, gueltig:true freigegeben: bleibt ungültig",
    async (wechsel) => {
      const { lage, adapter, offen } = aufbau();
      const gemeldet = adapter.melde();
      await vi.waitFor(() => expect(offen).toHaveLength(1), BEGONNEN);
      offen[0]?.antworte(markeAntwort("m-1"));
      await gemeldet;
      expect(adapter.zustand()).toBe("aktiv");

      const geprueft = adapter.pruefeZiel();
      await vi.waitFor(() => expect(offen).toHaveLength(2), BEGONNEN);
      expect(offen[1]?.pfad).toBe("/api/klara/sessions/s-1/office-kontext/ziel");
      if (wechsel === "auswahlwechsel") {
        lage.handler?.();
      } else {
        void adapter.verwerfe();
      }
      offen[1]?.antworte({
        status: 200,
        json: { gueltig: true, bestaetigung: "zweiter-klick", sequenz: 1 },
      });
      expect(await geprueft).toEqual({
        gueltig: false,
        grund: "kontext_gewechselt",
        aktion: "aktualisieren",
      });
      expect(adapter.marke()).toBeNull();
    },
  );
});

describe("KO-01-06 · Bindungswechsel während Lesen, Hashen und Anfrage", () => {
  it("in-place geänderte Bindung während des Auswahllesens: nichts gesendet", async () => {
    const bindung: Bindung = { ...BINDUNG };
    const { lage, adapter, offen } = aufbau(() => bindung);
    lage.beimLesen = () => {
      bindung.dokument = "doc-s-2";
    };
    expect(await adapter.melde()).toBeNull();
    expect(offen).toHaveLength(0);
    expect(adapter.zustand()).toBe("veraltet");
  });

  it("Bindungswechsel während des Hashens: nichts gesendet", async () => {
    const bindung: Bindung = { ...BINDUNG };
    const { lage, adapter, offen } = aufbau(() => bindung);
    lage.beimHashen = () => {
      bindung.sessionId = "s-2";
    };
    expect(await adapter.melde()).toBeNull();
    expect(offen).toHaveLength(0);
  });

  it("in-place Wechsel während der Anfrage: gesendet wurde mit A, die Antwort wird verworfen", async () => {
    const bindung: Bindung = { ...BINDUNG };
    const { adapter, offen } = aufbau(() => bindung);
    const laeuft = adapter.melde();
    await vi.waitFor(() => expect(offen).toHaveLength(1), BEGONNEN);
    expect(offen[0]?.bindung.dokument).toBe("doc-s-1");
    bindung.dokument = "doc-s-2";
    offen[0]?.antworte(markeAntwort("m-alt"));
    expect(await laeuft).toBeNull();
    expect(adapter.marke()).toBeNull();
  });

  it("A→B→A: ist B einmal gesehen, gilt die Antwort aus A nicht mehr, auch wenn A zurück ist", async () => {
    const bindung: Bindung = { ...BINDUNG };
    const { adapter, offen } = aufbau(() => bindung);
    const laeuft = adapter.melde();
    await vi.waitFor(() => expect(offen).toHaveLength(1), BEGONNEN);
    bindung.instanz = "inst-2";
    // Irgendein Vorgang sieht B (hier die Zielprüfung, die ohne Marke gar nicht erst fragt).
    expect(await adapter.pruefeZiel()).toMatchObject({ gueltig: false });
    bindung.instanz = "inst-1";
    offen[0]?.antworte(markeAntwort("m-alt"));
    expect(await laeuft).toBeNull();
    expect(adapter.marke()).toBeNull();
  });

  it("A→B→A ohne Beobachtung: kontextWechsel() des Hosts invalidiert trotzdem", async () => {
    const { adapter, offen } = aufbau();
    const laeuft = adapter.melde();
    await vi.waitFor(() => expect(offen).toHaveLength(1), BEGONNEN);
    adapter.kontextWechsel();
    offen[0]?.antworte(markeAntwort("m-alt"));
    expect(await laeuft).toBeNull();
    expect(adapter.zustand()).toBe("getrennt");
  });
});

describe("KO-01-06 · der jüngere gültige Kontext bleibt maßgeblich", () => {
  it("zwei Meldungen umgekehrt beantwortet: die jüngere gilt", async () => {
    const { adapter, offen } = aufbau();
    const erste = adapter.melde();
    await vi.waitFor(() => expect(offen).toHaveLength(1), BEGONNEN);
    const zweite = adapter.melde();
    await vi.waitFor(() => expect(offen).toHaveLength(2), BEGONNEN);
    offen[1]?.antworte(markeAntwort("m-2"));
    expect(await zweite).not.toBeNull();
    offen[0]?.antworte(markeAntwort("m-1"));
    expect(await erste).toBeNull();
    expect(adapter.marke()).toBe("m-2");
    expect(adapter.zustand()).toBe("aktiv");
  });

  it.each(["netzfehler", "absage"] as const)(
    "alte %s nach neuer erfolgreicher Meldung: der neue Bezug bleibt",
    async (art) => {
      const { adapter, offen } = aufbau();
      const erste = adapter.melde();
      await vi.waitFor(() => expect(offen).toHaveLength(1), BEGONNEN);
      const zweite = adapter.melde();
      await vi.waitFor(() => expect(offen).toHaveLength(2), BEGONNEN);
      offen[1]?.antworte(markeAntwort("m-2"));
      await zweite;
      if (art === "netzfehler") {
        offen[0]?.scheitere();
      } else {
        offen[0]?.antworte({ status: 409, json: { error: "OFFICE_SEQUENZ_VERALTET" } });
      }
      expect(await erste).toBeNull();
      expect(adapter.marke()).toBe("m-2");
      expect(adapter.zustand()).toBe("aktiv");
    },
  );
});

describe("KO-01-07 · Einfügen nur nach Zielprüfung und unverrückter Auswahl", () => {
  async function gemeldet() {
    const teile = aufbau();
    const laeuft = teile.adapter.melde();
    await vi.waitFor(() => expect(teile.offen).toHaveLength(1), BEGONNEN);
    teile.offen[0]?.antworte(markeAntwort("m-1"));
    await laeuft;
    return teile;
  }

  it("Ziel gültig, Auswahl unverändert: eingefügt an der Auswahl, Bezug danach verbraucht", async () => {
    const { lage, adapter, offen } = await gemeldet();
    const fertig = adapter.fuegeEin("Antworttext");
    await vi.waitFor(() => expect(offen).toHaveLength(2), BEGONNEN);
    offen[1]?.antworte({ status: 200, json: { gueltig: true, bestaetigung: "zweiter-klick" } });
    expect(await fertig).toEqual({ gueltig: true, eingefuegt: true });
    expect(lage.eingefuegt).toEqual(["Replace:Antworttext"]);
    expect(adapter.marke()).toBeNull();
  });

  it("Auswahl verrutscht zwischen Zusage und Schreiben: nichts eingefügt", async () => {
    const { lage, adapter, offen } = await gemeldet();
    const lesenVorher = lage.gelesen;
    lage.beimLesen = (nummer) => {
      // Das Lesen im Einfüge-Schritt (nach der Lesung der Zielprüfung) sieht eine andere Auswahl.
      if (nummer === lesenVorher + 2) {
        lage.text = "Anderer Absatz";
      }
    };
    const fertig = adapter.fuegeEin("Antworttext");
    await vi.waitFor(() => expect(offen).toHaveLength(2), BEGONNEN);
    offen[1]?.antworte({ status: 200, json: { gueltig: true, bestaetigung: "zweiter-klick" } });
    expect(await fertig).toMatchObject({ gueltig: false });
    expect(lage.eingefuegt).toEqual([]);
  });

  it("Server verweigert das Ziel: nichts eingefügt", async () => {
    const { lage, adapter, offen } = await gemeldet();
    const fertig = adapter.fuegeEin("Antworttext");
    await vi.waitFor(() => expect(offen).toHaveLength(2), BEGONNEN);
    offen[1]?.antworte({
      status: 409,
      json: { gueltig: false, grund: "ziel_abweichend", aktion: "aktualisieren" },
    });
    expect(await fertig).toMatchObject({ gueltig: false, grund: "ziel_abweichend" });
    expect(lage.eingefuegt).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------
// ENDE ZU ENDE: derselbe Adapter gegen die echte Kompositionswurzel
// ------------------------------------------------------------------------------------------------

const offen: ReturnType<typeof buildApp>[] = [];
afterEach(async () => {
  for (const app of offen.splice(0)) {
    await app.close();
  }
});

describe("KO-01-07 · Adapter und Kern sprechen denselben Vertrag (echter Server)", () => {
  it("melden → Ziel gültig → Auswahl ändert sich → Ziel abweichend → neu melden → gültig", async () => {
    const app = buildApp(buildServices());
    offen.push(app);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Ada Admin", email: "ada@word-adapter.test", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "ada@word-adapter.test", password: "secret123" },
    });
    const authorization = `Bearer ${login.json().token as string}`;
    const start = await app.inject({
      method: "POST",
      url: "/api/klara/sessions",
      headers: { authorization },
      payload: {
        addinInstanceId: "inst-e2e",
        documentDescriptor: { kind: "saved", canonicalUrl: "https://fiktiv/angebot" },
      },
    });
    expect(start.statusCode, start.body).toBe(201);
    const bindung: Bindung = {
      sessionId: start.json().sessionId,
      instanz: "inst-e2e",
      dokument: start.json().documentContextId,
    };
    const abruf: Abruf = async (pfad, methode, koerper, b) => {
      const res = await app.inject({
        method: methode as "POST" | "DELETE",
        url: pfad,
        headers: {
          authorization,
          origin: "http://localhost",
          "x-klara-session": b.sessionId,
          "x-klara-instance": b.instanz,
          "x-klara-document": b.dokument,
        },
        ...(koerper === null ? {} : { payload: koerper as Record<string, unknown> }),
      });
      return { status: res.statusCode, json: res.json() };
    };
    const { lage, word, office } = attrappe();
    const adapter = lade().erstelleWordAdapter({
      office,
      word,
      crypto: webcrypto,
      abruf,
      bindung: () => bindung,
    });

    const bezug = await adapter.melde();
    expect(bezug).toMatchObject({
      art: "office-bezug",
      kennung: `office:word:${bindung.dokument}#1`,
      pruefstand: "ungeprueft",
    });
    expect(await adapter.pruefeZiel()).toMatchObject({
      gueltig: true,
      bestaetigung: "zweiter-klick",
    });

    lage.text = "Ein anderer Absatz";
    expect(await adapter.pruefeZiel()).toEqual({
      gueltig: false,
      grund: "ziel_abweichend",
      aktion: "aktualisieren",
    });
    expect(adapter.zustand()).toBe("veraltet");

    expect(await adapter.melde()).toMatchObject({ sequenz: 2 });
    expect(await adapter.pruefeZiel()).toMatchObject({ gueltig: true, sequenz: 2 });
  });

  // KLARA-OFFICE-02 · Nacharbeit 9 (Ben office-host-word.js:82): der STANDARDTRANSPORT selbst —
  // kein eingespeister `abruf`. `fetch` reicht Methode, Köpfe und Rumpf UNVERÄNDERT an den echten
  // HTTP-Parser der Kompositionswurzel weiter; ergänzt werden nur Anmeldung (statt Sitzungscookie)
  // und Herkunft (die der Browser setzt).
  it("Standardtransport: Abmeldung (DELETE ohne Rumpf) ohne Rumpftyp — der Server nimmt sie an", async () => {
    const app = buildApp(buildServices());
    offen.push(app);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Ada Admin", email: "ada@word-adapter.test", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "ada@word-adapter.test", password: "secret123" },
    });
    const authorization = `Bearer ${login.json().token as string}`;
    const start = await app.inject({
      method: "POST",
      url: "/api/klara/sessions",
      headers: { authorization },
      payload: {
        addinInstanceId: "inst-standard",
        documentDescriptor: { kind: "saved", canonicalUrl: "https://fiktiv/angebot" },
      },
    });
    expect(start.statusCode, start.body).toBe(201);
    const bindung: Bindung = {
      sessionId: start.json().sessionId,
      instanz: "inst-standard",
      dokument: start.json().documentContextId,
    };
    const gesendet: {
      methode: string;
      kopf: Record<string, string>;
      rumpf: string | undefined;
      status: number;
      json: unknown;
    }[] = [];
    vi.stubGlobal(
      "fetch",
      async (
        pfad: string,
        init: { method: string; headers: Record<string, string>; body?: string },
      ) => {
        const res = await app.inject({
          method: init.method as "POST" | "DELETE",
          url: pfad,
          headers: { ...init.headers, authorization, origin: "http://localhost" },
          ...(init.body === undefined ? {} : { payload: init.body }),
        });
        const json = res.body ? JSON.parse(res.body) : null;
        gesendet.push({
          methode: init.method,
          kopf: { ...init.headers },
          rumpf: init.body,
          status: res.statusCode,
          json,
        });
        return { status: res.statusCode, json: async () => json };
      },
    );
    try {
      const { word, office } = attrappe();
      const adapter = lade().erstelleWordAdapter({
        office,
        word,
        crypto: webcrypto,
        bindung: () => bindung,
      });
      expect(await adapter.melde()).toMatchObject({ art: "office-bezug" });
      const meldung = gesendet.find((g) => g.methode === "POST");
      // Gegenprobe: MIT Rumpf trägt der Standardtransport seinen Rumpftyp weiter.
      expect(meldung?.kopf["content-type"]).toBe("application/json");
      expect(meldung?.status).toBe(200);
      const marke = (meldung?.json as { marke?: unknown } | null)?.marke;
      expect(marke).toBeTruthy();

      expect(await adapter.verwerfe()).toMatchObject({
        status: 200,
        json: { verbindung: "getrennt" },
      });
      const abmeldung = gesendet.find((g) => g.methode === "DELETE");
      expect(abmeldung?.rumpf).toBeUndefined();
      expect(abmeldung?.kopf["content-type"]).toBeUndefined();
      expect(abmeldung?.kopf["x-klara-session"]).toBe(bindung.sessionId);

      // Die Abmeldung hat am Server tatsächlich gewirkt: die alte Marke gilt nicht mehr.
      const danach = await app.inject({
        method: "POST",
        url: `/api/klara/sessions/${bindung.sessionId}/office-kontext/ziel`,
        headers: {
          authorization,
          origin: "http://localhost",
          "x-klara-session": bindung.sessionId,
          "x-klara-instance": bindung.instanz,
          "x-klara-document": bindung.dokument,
        },
        payload: {
          marke,
          ziel: { pruefsumme: createHash("sha256").update(AUSWAHL).digest("hex") },
        },
      });
      expect(danach.json()).toMatchObject({ gueltig: false, grund: "auswahl_veraltet" });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
