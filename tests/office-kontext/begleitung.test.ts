import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { repoPfad } from "../support/repoPfad";

// ================================================================================================
// KLARA-OFFICE-01 · NACHARBEIT 2 — DER GEMEINSAME EINSTIEG DER BEGLEITAPP (`begleitung.html/.js`)
// ================================================================================================
//
// Ausgeführt werden die AUSGELIEFERTEN Skripte `office-host-word.js` und `begleitung.js`. Dahinter
// steht die ECHTE Kompositionswurzel: Anmeldung, Klara-Sitzung, Rebind, Office-Kanal, Zielprüfung
// und Klaras Ausführungszugang. office.js/Word sind Attrappen; nur dort, wo eine Antwort MIT Text
// gebraucht wird, liefert der Prüfstand für `…/execute` eine feste, fiktive Antwort — der leere
// Prüfbestand hat nichts, worauf eine belegte Antwort stehen könnte.
//
// NICHT BELEGT: echtes Word, echtes office.js, Sideload, Mac-App — das bleibt die Hostbedienprüfung.

const WURZEL = "apps/web/public/word-addin";
const ADAPTER = readFileSync(repoPfad(`${WURZEL}/office-host-word.js`), "utf8");
const SEITE = readFileSync(repoPfad(`${WURZEL}/begleitung.js`), "utf8");
const HTML = readFileSync(repoPfad(`${WURZEL}/begleitung.html`), "utf8");
const AUSWAHL = "Angebot Musterfirma";

interface Seite {
  starte(): Promise<unknown>;
  pruefeKonto(): Promise<unknown>;
  pruefeDokument(): Promise<unknown>;
  frage(text: string, optionen?: Record<string, unknown>): Promise<unknown>;
  verwendenVorbereiten(): boolean;
  verwendenBestaetigen(): Promise<Record<string, unknown>>;
  sitzung(): { sessionId: string; dokument: string } | null;
  antwort(): { text: string } | null;
  bestaetigungOffen(): boolean;
  adapter(): { zustand(): string; marke(): string | null } | null;
  begleiterVerbinden(): Promise<unknown>;
  begleiterTrennen(): void;
  begleiterMelden(): Promise<unknown>;
  begleiterLage(): string;
}

interface AuswahlAttrappe {
  text?: string;
  load(feld: string): void;
  insertText(text: string, ort: string): void;
}

interface Anfrage {
  method: string;
  headers: Record<string, string>;
  body?: string;
}

interface Aufruf {
  methode: string;
  pfad: string;
  kopf: Record<string, string>;
  koerper: Record<string, unknown> | null;
}

const offen: ReturnType<typeof buildApp>[] = [];
afterEach(async () => {
  for (const app of offen.splice(0)) {
    await app.close();
  }
});

async function anmelden(app: ReturnType<typeof buildApp>, name: string, email: string) {
  const reg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name, email, password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  const roh = reg.json() as { id?: string; user?: { id: string } };
  return { id: roh.id ?? roh.user?.id ?? "", token: login.json().token as string | undefined };
}

async function buehne(optionen: { url?: string; angemeldet?: boolean; gespeichertAm?: Date } = {}) {
  const app = buildApp(buildServices());
  offen.push(app);
  const ada = await anmelden(app, "Ada Admin", "ada@begleitung.test");
  const lage = {
    // Stellvertreter für das Sitzungscookie der Anwendung: wer „angemeldet" ist, trägt den Schlüssel.
    token: optionen.angemeldet === false ? null : (ada.token ?? null),
    text: AUSWAHL,
    eingefuegt: [] as string[],
    aufrufe: [] as Aufruf[],
    handler: [] as (() => void)[],
    texte: new Map<string, string>(),
    sichtbar: new Map<string, boolean>(),
    /** Feste Antwort für `…/execute` — oder `null` für den echten Weg. */
    ausfuehrung: null as null | (() => Promise<{ status: number; body: unknown }>),
    /** Zurückgehaltene verzögerte Neumeldungen der Seite (statt echter 300 ms). */
    zeitgeber: [] as (() => void)[],
    /** Welche Anfragen bis zur Freigabe angehalten werden — und ihre Freigaben. */
    halte: null as null | ((pfad: string) => boolean),
    gehalten: [] as (() => void)[],
    /** Welche Anfragen mit einem Netzfehler (Rejection) scheitern. */
    wirft: null as null | ((pfad: string) => boolean),
    /** Läuft beim Lesen der Auswahl in Word (`sync`) — ein Wechsel „während des Auswahllesens". */
    beimLesen: null as null | (() => void),
    /** Registrierungen des Auswahlereignisses bis zur Freigabe offen halten. */
    registrierungHalten: false,
    /** Der Host ruft den Registrierungsrückruf nie auf. */
    registrierungStumm: false,
    registrierungen: [] as (() => void)[],
  };
  const office = {
    context: {
      diagnostics: { platform: "Mac", version: "16.89" },
      document: {
        url: optionen.url ?? "https://fiktiv/angebot.docx",
        // Wie office.js: der Registrierungsrückruf kommt asynchron. Mit `registrierungHalten`
        // bleibt die Registrierung bis zur Freigabe offen; eine weitere Registrierung, die
        // währenddessen eintrifft, verdrängt die offene (Verhalten in Word für Mac 16.111,
        // QUELLEN-CHAT20-OFFICE-KERN-53971-BEGLEITUNG-20261017 D1/D2/A1).
        addHandlerAsync(_art: string, h: () => void, rueckruf?: (e: { status: string }) => void) {
          if (!lage.registrierungHalten) {
            lage.handler.push(h);
            if (!lage.registrierungStumm) {
              void Promise.resolve().then(() => rueckruf?.({ status: "succeeded" }));
            }
            return;
          }
          lage.registrierungen.splice(0);
          lage.registrierungen.push(() => {
            lage.handler.push(h);
            rueckruf?.({ status: "succeeded" });
          });
        },
      },
    },
    EventType: { DocumentSelectionChanged: "documentSelectionChanged" },
  };
  const word = {
    run<T>(rueckruf: (kontext: unknown) => Promise<T>): Promise<T> {
      const auswahl: AuswahlAttrappe = {
        load() {
          // Die Attrappe liefert `text` in `sync`.
        },
        insertText(t: string, o: string) {
          lage.eingefuegt.push(`${o}:${t}`);
        },
      };
      // `properties.lastSaveTime` (WordApi 1.3) gibt es nur, wenn der Fall es vorsieht — sonst
      // fehlt die Eigenschaft wie bei einem Host ohne diese Schnittstelle.
      const eigenschaften = optionen.gespeichertAm
        ? { lastSaveTime: optionen.gespeichertAm, load() {} }
        : undefined;
      return rueckruf({
        document: { getSelection: () => auswahl, properties: eigenschaften },
        sync: async () => {
          lage.beimLesen?.();
          auswahl.text = lage.text;
        },
      });
    },
  };
  const fetch = async (pfad: string, init: Anfrage) => {
    const koerper = init.body ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    lage.aufrufe.push({ methode: init.method, pfad, kopf: { ...init.headers }, koerper });
    let status: number;
    let body: unknown;
    if (lage.halte?.(pfad)) {
      await new Promise<void>((frei) => lage.gehalten.push(frei));
    }
    if (lage.wirft?.(pfad)) {
      throw new Error("netz");
    }
    if (lage.ausfuehrung && pfad.endsWith("/execute")) {
      ({ status, body } = await lage.ausfuehrung());
    } else {
      const kopf: Record<string, string> = { ...init.headers, origin: "http://localhost" };
      if (!kopf.authorization && lage.token) {
        kopf.authorization = `Bearer ${lage.token}`;
      }
      const res = await app.inject({
        method: init.method as "GET" | "POST" | "DELETE",
        url: pfad,
        headers: kopf,
        ...(init.body ? { payload: init.body } : {}),
      });
      status = res.statusCode;
      body = res.body ? JSON.parse(res.body) : null;
    }
    return { status, json: async () => body };
  };
  const wurzel: Record<string, unknown> = {};
  new Function("self", ADAPTER)(wurzel);
  new Function("self", SEITE)(wurzel);
  let id = 0;
  const modul = wurzel.KlarwerkBegleitung as { erstelle(u: unknown): Seite };
  const seite = modul.erstelle({
    office,
    word,
    crypto: webcrypto,
    fetch,
    adapterModul: wurzel.KlarwerkOfficeHostWord,
    herkunft: "http://localhost",
    setTimeout: (f: () => void) => lage.zeitgeber.push(f),
    clearTimeout: (n: number) => {
      lage.zeitgeber.splice(n - 1, 1, () => {});
    },
    neueId: (p: string) => `${p}-${++id}`,
    zeige: (k: string, t: string) => lage.texte.set(k, t),
    sichtbar: (k: string, an: boolean) => lage.sichtbar.set(k, an),
  });
  return { app, seite, lage, office };
}

function festeAntwort(text: string) {
  return async () => ({
    status: 200,
    body: { result: { answered: true, answer: text, sources: ["ko-fiktiv-1"] } },
  });
}

describe("Einstieg · begleitung.html lädt Adapter und Seite, taskpane.html bleibt unberührt", () => {
  it("lädt office.js, office-host-word.js und begleitung.js", () => {
    expect(HTML).toContain("https://appsforoffice.microsoft.com/lib/1/hosted/office.js");
    expect(HTML).toContain('<script src="office-host-word.js"></script>');
    expect(HTML).toContain('<script src="begleitung.js"></script>');
    const taskpane = readFileSync(repoPfad(`${WURZEL}/taskpane.html`), "utf8");
    expect(taskpane).not.toContain("begleitung.js");
    expect(taskpane).not.toContain("office-host-word.js");
  });

  it("Darstellung ohne HTML-Senke: kein innerHTML in der Seite", () => {
    expect(SEITE).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML/);
  });
});

describe("KO-01-02/03/05 · sichtbarer Arbeitskontext über vorhandene Anmeldung und Sitzung", () => {
  it("angemeldet: Sitzung über /api/klara/sessions, Kontext gemeldet und sichtbar", async () => {
    const { seite, lage } = await buehne();
    await seite.starte();
    expect(lage.texte.get("konto")).toBe("Angemeldet als Ada Admin");
    expect(lage.texte.get("verbindung")).toBe("Verbunden mit diesem Dokument");
    // Nacharbeit 4 (Ben begleitung.js:93): der Arbeitsort ist erkennbar — gebundenes Dokument und
    // sein Stand; Word-Version und Meldungsnummer stehen GETRENNT und gelten nicht als Fassung.
    expect(lage.texte.get("dokument")).toBe("Dokument: angebot.docx");
    expect(lage.texte.get("dokumentstand")).toBe("Dokumentstand: von Word nicht gemeldet");
    expect(lage.texte.get("kontext")).toBe("Word-Version: Mac 16.89");
    expect(lage.texte.get("auswahl")).toBe(`Markierung: ${AUSWAHL.length} Zeichen`);
    expect(lage.texte.get("meldung")).toBe("Kontextmeldung Nr. 1");
    const wege = lage.aufrufe.map(
      (a) => `${a.methode} ${a.pfad.replace(/sessions\/[^/]+/, "sessions/:id")}`,
    );
    expect(wege).toEqual([
      "GET /api/auth/me",
      "POST /api/klara/sessions",
      "POST /api/klara/sessions/:id/office-kontext",
    ]);
    // Der Kontext trägt keinen Text.
    expect(JSON.stringify(lage.aufrufe[2]?.koerper)).not.toContain(AUSWAHL);
  });

  it("nicht angemeldet: keine Sitzung, der vorhandene Anmeldeweg wird angeboten", async () => {
    const { seite, lage } = await buehne({ angemeldet: false });
    await seite.starte();
    expect(lage.texte.get("konto")).toBe("Nicht angemeldet");
    expect(lage.sichtbar.get("anmelden")).toBe(true);
    expect(seite.sitzung()).toBeNull();
    expect(lage.texte.get("verbindung")).toBe("Keine aktive Verbindung");
  });
});

describe("KO-01-05 · Fragen über Klaras vorhandenen Ausführungszugang", () => {
  it("ohne Markierung: Frage geht mit Sitzungsbindung an …/execute, getippt, ohne Dokumenttext", async () => {
    const { seite, lage } = await buehne();
    await seite.starte();
    await seite.frage("Was steht im Angebot?");
    const ausfuehrung = lage.aufrufe.find((a) => a.pfad.endsWith("/execute"));
    expect(ausfuehrung?.methode).toBe("POST");
    expect(ausfuehrung?.kopf["x-klara-session"]).toBe(seite.sitzung()?.sessionId);
    expect(ausfuehrung?.kopf["x-klara-document"]).toBe(seite.sitzung()?.dokument);
    expect(ausfuehrung?.koerper).toEqual({
      question: "Was steht im Angebot?",
      locale: "de",
      questionSource: "manual",
    });
    // Der leere Prüfbestand trägt keine belegte Antwort — das wird gesagt, nicht erfunden.
    expect(seite.antwort()).toBeNull();
    expect((lage.texte.get("hinweis") ?? "").length).toBeGreaterThan(0);
  });

  it.each([
    [undefined, "vertraulich"],
    ["intern", "intern"],
  ] as const)("Markierung mitsenden nur auf Wunsch, Einstufung %s ⇒ %s", async (wahl, gesendet) => {
    const { seite, lage } = await buehne();
    await seite.starte();
    await seite.frage("Prüfe das", { markierungMitsenden: true, vertraulichkeit: wahl });
    const ausfuehrung = lage.aufrufe.find((a) => a.pfad.endsWith("/execute"));
    expect(ausfuehrung?.koerper).toMatchObject({
      selection: AUSWAHL,
      selectionConfidentiality: gesendet,
    });
  });
});

describe("KO-01-06/07 · bewusst verwenden: zweiter Klick, richtiger Kontext", () => {
  it("erster Klick schreibt nichts; zweiter Klick fügt nach Zielprüfung an der Markierung ein", async () => {
    const { seite, lage } = await buehne();
    await seite.starte();
    lage.ausfuehrung = festeAntwort("Fiktive Antwort aus Belegen.");
    await seite.frage("Formuliere den Absatz");
    expect(lage.texte.get("antwort")).toBe("Fiktive Antwort aus Belegen.");
    expect(lage.texte.get("belege")).toBe("1 Beleg(e) aus KLARWERK");
    expect(seite.verwendenVorbereiten()).toBe(true);
    expect(lage.sichtbar.get("bestaetigung")).toBe(true);
    expect(lage.eingefuegt).toEqual([]);
    const ergebnis = await seite.verwendenBestaetigen();
    expect(ergebnis).toEqual({ gueltig: true, eingefuegt: true });
    expect(lage.eingefuegt).toEqual(["Replace:Fiktive Antwort aus Belegen."]);
    expect(lage.aufrufe.some((a) => a.pfad.endsWith("/office-kontext/ziel"))).toBe(true);
  });

  it("Dokumentwechsel (ungespeichert → gespeichert, vorhandener Rebind): Antwort verworfen, nichts eingefügt", async () => {
    const { seite, lage, office } = await buehne({ url: "" });
    await seite.starte();
    const vorher = seite.sitzung()?.dokument;
    lage.ausfuehrung = festeAntwort("Fiktive Antwort.");
    await seite.frage("Frage");
    expect(seite.antwort()).not.toBeNull();
    office.context.document.url = "https://fiktiv/gespeichert.docx";
    await seite.pruefeDokument();
    expect(seite.sitzung()?.dokument).not.toBe(vorher);
    expect(lage.aufrufe.some((a) => a.pfad.endsWith("/document-context"))).toBe(true);
    expect(seite.antwort()).toBeNull();
    expect(await seite.verwendenBestaetigen()).toMatchObject({ gueltig: false });
    expect(lage.eingefuegt).toEqual([]);
    expect(lage.texte.get("verbindung")).toBe("Verbunden mit diesem Dokument");
  });

  it("verspätete Antwort nach Dokumentwechsel wird verworfen", async () => {
    const { seite, lage, office } = await buehne({ url: "" });
    await seite.starte();
    let freigeben: () => void = () => {};
    const alt = { status: 200, body: { result: { answered: true, answer: "Alt" } } };
    lage.ausfuehrung = () =>
      new Promise((resolve) => {
        freigeben = () => resolve(alt);
      });
    const laeuft = seite.frage("Frage");
    await new Promise((r) => setTimeout(r, 20));
    office.context.document.url = "https://fiktiv/gespeichert.docx";
    await seite.pruefeDokument();
    freigeben();
    expect(await laeuft).toBeNull();
    expect(seite.antwort()).toBeNull();
    expect(lage.texte.get("hinweis")).toBe(
      "Die Antwort kam nach einem Wechsel und wurde verworfen.",
    );
  });

  it("Kontowechsel: neue Sitzung für das neue Konto, alte Antwort verworfen", async () => {
    const { app, seite, lage } = await buehne();
    await seite.starte();
    const alt = seite.sitzung()?.sessionId;
    lage.ausfuehrung = festeAntwort("Fiktive Antwort.");
    await seite.frage("Frage");
    lage.ausfuehrung = null;
    const bea = await anmelden(app, "Bea Beispiel", "bea@begleitung.test");
    const frei = await app.inject({
      method: "POST",
      url: `/api/auth/users/${bea.id}/approve`,
      headers: { authorization: `Bearer ${lage.token}` },
    });
    expect(frei.statusCode).toBe(200);
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "bea@begleitung.test", password: "secret123" },
    });
    lage.token = login.json().token as string;
    await seite.pruefeKonto();
    expect(lage.texte.get("konto")).toBe("Angemeldet als Bea Beispiel");
    expect(seite.sitzung()?.sessionId).not.toBe(alt);
    expect(seite.antwort()).toBeNull();
    expect(await seite.verwendenBestaetigen()).toMatchObject({ gueltig: false });
    expect(lage.eingefuegt).toEqual([]);
  });
});

// ================================================================================================
// NACHARBEIT 4 — Befunde Ben begleitung.js:309/233/93, Fälle der technischen Hilfe f77fc572
// ================================================================================================

type Lage = Awaited<ReturnType<typeof buehne>>["lage"];
const WARTEN = { timeout: 2000 };

/** Auswahl in Word ändern und JEDEN registrierten Auswahlhandler auslösen (Adapter und Seite). */
function auswahlWechsel(lage: Lage, text: string) {
  lage.text = text;
  for (const h of lage.handler) {
    h();
  }
}

/** Die verzögerte Neumeldung der Seite ausführen und abwarten, bis der neue Bezug aktiv ist. */
async function neumeldung(lage: Lage, seite: Seite) {
  for (const f of lage.zeitgeber.splice(0)) {
    f();
  }
  await vi.waitFor(() => expect(seite.adapter()?.zustand()).toBe("aktiv"), WARTEN);
}

/** Eine Frage, deren `…/execute`-Antwort der Test selbst freigibt. */
function zurueckgehalteneAntwort(lage: Lage, text: string) {
  let frei: () => void = () => {};
  lage.ausfuehrung = () =>
    new Promise((resolve) => {
      frei = () =>
        resolve({ status: 200, body: { result: { answered: true, answer: text, sources: [] } } });
    });
  return () => frei();
}

describe("KO-01-06 · Antwort und Bestätigung gehören zur Auswahl, zu der gefragt wurde", () => {
  it("Antwort A kommt nach Auswahlwechsel und Neumeldung B: nicht übernommen, kein Replace an B", async () => {
    const { seite, lage } = await buehne();
    await seite.starte();
    const freigeben = zurueckgehalteneAntwort(lage, "Antwort zu A");
    const laeuft = seite.frage("Frage zu A", { markierungMitsenden: true });
    await vi.waitFor(
      () => expect(lage.aufrufe.some((a) => a.pfad.endsWith("/execute"))).toBe(true),
      WARTEN,
    );
    auswahlWechsel(lage, "Absatz B");
    await neumeldung(lage, seite);
    freigeben();
    expect(await laeuft).toBeNull();
    expect(seite.antwort()).toBeNull();
    expect(seite.verwendenVorbereiten()).toBe(false);
    expect(await seite.verwendenBestaetigen()).toMatchObject({ gueltig: false });
    expect(lage.eingefuegt).toEqual([]);
  });

  it("Antwort A liegt vor, Auswahl B und Neumeldung: Antwort A verworfen, ersetzt B nicht", async () => {
    const { seite, lage } = await buehne();
    await seite.starte();
    lage.ausfuehrung = festeAntwort("Antwort zu A");
    await seite.frage("Frage zu A");
    expect(seite.antwort()).not.toBeNull();
    auswahlWechsel(lage, "Absatz B");
    expect(seite.antwort()).toBeNull();
    await neumeldung(lage, seite);
    expect(seite.verwendenVorbereiten()).toBe(false);
    expect(await seite.verwendenBestaetigen()).toMatchObject({ gueltig: false });
    expect(lage.eingefuegt).toEqual([]);
  });

  it("offene Bestätigung, dann Auswahlwechsel: Bestätigung sofort geschlossen, nichts geschrieben", async () => {
    const { seite, lage } = await buehne();
    await seite.starte();
    lage.ausfuehrung = festeAntwort("Antwort zu A");
    await seite.frage("Frage zu A");
    expect(seite.verwendenVorbereiten()).toBe(true);
    expect(seite.bestaetigungOffen()).toBe(true);
    auswahlWechsel(lage, "Absatz B");
    expect(seite.bestaetigungOffen()).toBe(false);
    expect(lage.sichtbar.get("bestaetigung")).toBe(false);
    await neumeldung(lage, seite);
    expect(await seite.verwendenBestaetigen()).toMatchObject({ gueltig: false });
    expect(lage.eingefuegt).toEqual([]);
  });

  it("A→B→A während der laufenden Antwort: gleicher Text überspringt den Wechsel nicht", async () => {
    const { seite, lage } = await buehne();
    await seite.starte();
    const freigeben = zurueckgehalteneAntwort(lage, "Antwort zu A");
    const laeuft = seite.frage("Frage zu A");
    await vi.waitFor(
      () => expect(lage.aufrufe.some((a) => a.pfad.endsWith("/execute"))).toBe(true),
      WARTEN,
    );
    auswahlWechsel(lage, "Absatz B");
    auswahlWechsel(lage, AUSWAHL);
    await neumeldung(lage, seite);
    freigeben();
    expect(await laeuft).toBeNull();
    expect(seite.antwort()).toBeNull();
    expect(lage.eingefuegt).toEqual([]);
  });

  it("Gegenprobe: ohne Wechsel bleibt die Antwort verwendbar und wird an ihrer Auswahl eingefügt", async () => {
    const { seite, lage } = await buehne();
    await seite.starte();
    lage.ausfuehrung = festeAntwort("Antwort zu A");
    await seite.frage("Frage zu A");
    expect(seite.verwendenVorbereiten()).toBe(true);
    expect(await seite.verwendenBestaetigen()).toEqual({ gueltig: true, eingefuegt: true });
    expect(lage.eingefuegt).toEqual(["Replace:Antwort zu A"]);
  });
});

describe("KO-01-06 · Dokumentidentität: vollständiger Beschreiber, Invalidierung vor dem Rebind", () => {
  it("gespeichert a.docx → b.docx: sofort invalidiert, Rebind, neuer Kontext und Zustimmungsstand", async () => {
    const { seite, lage, office } = await buehne({ url: "https://fiktiv/a.docx" });
    await seite.starte();
    const vorher = seite.sitzung();
    expect(lage.texte.get("dokument")).toBe("Dokument: a.docx");
    lage.ausfuehrung = festeAntwort("Antwort zu a");
    await seite.frage("Frage");
    expect(seite.verwendenVorbereiten()).toBe(true);
    lage.halte = (pfad) => pfad.endsWith("/document-context");
    office.context.document.url = "https://fiktiv/b.docx";
    const umbinden = seite.pruefeDokument();
    // VOR der Rebind-Antwort: nichts Altes mehr verwendbar, Zustimmung nicht als erteilt gezeigt.
    expect(seite.antwort()).toBeNull();
    expect(seite.bestaetigungOffen()).toBe(false);
    expect(seite.sitzung()).toBeNull();
    expect(lage.texte.get("zustimmung")).toBe("KI-Stand unbekannt");
    expect(await seite.verwendenBestaetigen()).toMatchObject({ gueltig: false });
    await vi.waitFor(() => expect(lage.gehalten).toHaveLength(1), WARTEN);
    lage.halte = null;
    lage.gehalten.splice(0)[0]?.();
    expect(await umbinden).toBe(true);
    expect(seite.sitzung()?.sessionId).toBe(vorher?.sessionId);
    expect(seite.sitzung()?.dokument).not.toBe(vorher?.dokument);
    expect(lage.texte.get("dokument")).toBe("Dokument: b.docx");
    expect(lage.texte.get("zustimmung")).not.toBe("KI-Stand unbekannt");
    expect(lage.texte.get("verbindung")).toBe("Verbunden mit diesem Dokument");
    expect(lage.eingefuegt).toEqual([]);
  });

  it("zurückgehaltener Rebind, dann Kontowechsel: der verspätete Rebind überschreibt nichts", async () => {
    const { app, seite, lage, office } = await buehne({ url: "https://fiktiv/a.docx" });
    await seite.starte();
    lage.halte = (pfad) => pfad.endsWith("/document-context");
    office.context.document.url = "https://fiktiv/b.docx";
    const umbinden = seite.pruefeDokument();
    await vi.waitFor(() => expect(lage.gehalten).toHaveLength(1), WARTEN);
    const bea = await anmelden(app, "Bea Beispiel", "bea@begleitung.test");
    await app.inject({
      method: "POST",
      url: `/api/auth/users/${bea.id}/approve`,
      headers: { authorization: `Bearer ${lage.token}` },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "bea@begleitung.test", password: "secret123" },
    });
    lage.token = login.json().token as string;
    await seite.pruefeKonto();
    const neu = seite.sitzung();
    expect(neu).not.toBeNull();
    lage.halte = null;
    lage.gehalten.splice(0)[0]?.();
    expect(await umbinden).toBe(false);
    expect(seite.sitzung()).toBe(neu);
    expect(lage.texte.get("konto")).toBe("Angemeldet als Bea Beispiel");
  });

  it("zurückgehaltener Rebind: ein Fokus-Kontoabgleich startet keine zweite Sitzung daneben", async () => {
    const { seite, lage, office } = await buehne({ url: "https://fiktiv/a.docx" });
    await seite.starte();
    lage.halte = (pfad) => pfad.endsWith("/document-context");
    office.context.document.url = "https://fiktiv/b.docx";
    const umbinden = seite.pruefeDokument();
    await vi.waitFor(() => expect(lage.gehalten).toHaveLength(1), WARTEN);
    await seite.pruefeKonto();
    const neueSitzungen = lage.aufrufe.filter(
      (a) => a.methode === "POST" && a.pfad === "/api/klara/sessions",
    );
    expect(neueSitzungen).toHaveLength(1);
    lage.halte = null;
    lage.gehalten.splice(0)[0]?.();
    expect(await umbinden).toBe(true);
    expect(lage.texte.get("dokument")).toBe("Dokument: b.docx");
  });

  it("unveränderter gespeicherter Beschreiber: keine Neuzuordnung", async () => {
    const { seite, lage } = await buehne({ url: "https://fiktiv/a.docx" });
    await seite.starte();
    expect(await seite.pruefeDokument()).toBe(false);
    expect(lage.aufrufe.some((a) => a.pfad.endsWith("/document-context"))).toBe(false);
  });
});

describe("KO-01-02 · erkennbarer Arbeitsort: Dokumentname und Dokumentstand", () => {
  it("meldet Word einen Speicherstand, wird er angezeigt", async () => {
    const { seite, lage } = await buehne({
      url: "https://fiktiv/Angebot%20Musterfirma.docx",
      gespeichertAm: new Date("2026-10-10T08:00:00.000Z"),
    });
    await seite.starte();
    expect(lage.texte.get("dokument")).toBe("Dokument: Angebot Musterfirma.docx");
    expect(lage.texte.get("dokumentstand")).toBe(
      "Dokumentstand: zuletzt gespeichert 2026-10-10T08:00:00.000Z",
    );
    expect(lage.texte.get("kontext")).toBe("Word-Version: Mac 16.89");
  });

  it("ungespeichertes Dokument: ausdrücklich so benannt", async () => {
    const { seite, lage } = await buehne({ url: "" });
    await seite.starte();
    expect(lage.texte.get("dokument")).toBe("Dokument: Ungespeichertes Dokument");
    expect(lage.texte.get("dokumentstand")).toBe("Dokumentstand: noch nicht gespeichert");
  });
});

// ================================================================================================
// NACHARBEIT 5 — Befunde Ben begleitung.js:442 (Senden ohne gültigen Bezug) und :305 (Sperre)
// ================================================================================================

function executeAufrufe(lage: Lage) {
  return lage.aufrufe.filter((a) => a.pfad.endsWith("/execute"));
}

describe("KO-01-05/06 · Auswahltext geht nur mit gültigem Auswahlbezug hinaus", () => {
  it("Auswahlwechsel WÄHREND des Auswahllesens: execute wird tatsächlich nicht aufgerufen", async () => {
    const { seite, lage } = await buehne();
    await seite.starte();
    lage.ausfuehrung = festeAntwort("darf nicht entstehen");
    lage.beimLesen = () => {
      lage.beimLesen = null;
      auswahlWechsel(lage, "Absatz B");
    };
    expect(await seite.frage("Prüfe das", { markierungMitsenden: true })).toBeNull();
    expect(executeAufrufe(lage)).toEqual([]);
    expect(seite.antwort()).toBeNull();
    expect(lage.texte.get("hinweis")).toBe(
      "Die Antwort kam nach einem Wechsel und wurde verworfen.",
    );
  });

  it("ohne gültige Marke (Auswahl gerade gewechselt): mit Markierung wird gar nicht gesendet", async () => {
    const { seite, lage } = await buehne();
    await seite.starte();
    auswahlWechsel(lage, "Absatz B");
    expect(seite.adapter()?.marke()).toBeNull();
    expect(await seite.frage("Prüfe das", { markierungMitsenden: true })).toBeNull();
    expect(executeAufrufe(lage)).toEqual([]);
    expect(lage.texte.get("hinweis")).toBe(
      "Markierung nicht gebunden — bitte kurz warten und neu fragen.",
    );
  });

  it("kontextlose Frage ohne Marke bleibt möglich — ohne selection", async () => {
    const { seite, lage } = await buehne();
    await seite.starte();
    auswahlWechsel(lage, "Absatz B");
    expect(seite.adapter()?.marke()).toBeNull();
    lage.ausfuehrung = festeAntwort("Antwort ohne Dokumentbezug");
    await seite.frage("Allgemeine Frage");
    const gesendet = executeAufrufe(lage);
    expect(gesendet).toHaveLength(1);
    expect(gesendet[0]?.koerper).toEqual({
      question: "Allgemeine Frage",
      locale: "de",
      questionSource: "manual",
    });
    expect(seite.antwort()?.text).toBe("Antwort ohne Dokumentbezug");
  });

  it("Bindungswechsel während des Auswahllesens (Dokumentwechsel): execute unterbleibt", async () => {
    const { seite, lage, office } = await buehne({ url: "https://fiktiv/a.docx" });
    await seite.starte();
    lage.ausfuehrung = festeAntwort("darf nicht entstehen");
    let umgebunden: Promise<unknown> = Promise.resolve();
    lage.beimLesen = () => {
      lage.beimLesen = null;
      office.context.document.url = "https://fiktiv/b.docx";
      // Der Dokumentwechsel invalidiert SYNCHRON, bevor das Umbinden antwortet.
      umgebunden = seite.pruefeDokument();
    };
    expect(await seite.frage("Prüfe das", { markierungMitsenden: true })).toBeNull();
    expect(executeAufrufe(lage)).toEqual([]);
    await umgebunden;
    expect(lage.texte.get("dokument")).toBe("Dokument: b.docx");
  });
});

describe("KO-01-06 · Ausfall beim Sitzungsstart/Rebind: Sperre gelöst, Neuaufbau möglich", () => {
  it("Netzfehler beim Sitzungsstart: getrennt angezeigt, nächster Kontoabgleich baut neu auf", async () => {
    const { seite, lage } = await buehne();
    lage.wirft = (pfad) => pfad === "/api/klara/sessions";
    expect(await seite.starte()).toBe(false);
    expect(seite.sitzung()).toBeNull();
    expect(lage.texte.get("verbindung")).toBe("Keine Klara-Sitzung — Verbindung getrennt.");
    lage.wirft = null;
    expect(await seite.pruefeKonto()).toBe(true);
    expect(seite.sitzung()).not.toBeNull();
    expect(lage.texte.get("verbindung")).toBe("Verbunden mit diesem Dokument");
  });

  it("Netzfehler beim Rebind: getrennt angezeigt, nächster Kontoabgleich baut neu auf", async () => {
    const { seite, lage, office } = await buehne({ url: "https://fiktiv/a.docx" });
    await seite.starte();
    const alt = seite.sitzung()?.sessionId;
    lage.wirft = (pfad) => pfad.endsWith("/document-context");
    office.context.document.url = "https://fiktiv/b.docx";
    expect(await seite.pruefeDokument()).toBe(false);
    expect(seite.sitzung()).toBeNull();
    expect(lage.texte.get("verbindung")).toBe(
      "Dokumentwechsel nicht bestätigt — Verbindung getrennt.",
    );
    lage.wirft = null;
    expect(await seite.pruefeKonto()).toBe(true);
    expect(seite.sitzung()?.sessionId).not.toBe(alt);
    expect(lage.texte.get("dokument")).toBe("Dokument: b.docx");
    expect(lage.texte.get("verbindung")).toBe("Verbunden mit diesem Dokument");
  });

  it("alter Rebind-Fehler entsperrt einen neueren, noch laufenden Sitzungsstart nicht", async () => {
    const { app, seite, lage, office } = await buehne({ url: "https://fiktiv/a.docx" });
    await seite.starte();
    lage.halte = (pfad) => pfad.endsWith("/document-context") || pfad === "/api/klara/sessions";
    lage.wirft = (pfad) => pfad.endsWith("/document-context");
    office.context.document.url = "https://fiktiv/b.docx";
    const umbinden = seite.pruefeDokument();
    await vi.waitFor(() => expect(lage.gehalten).toHaveLength(1), WARTEN);
    const bea = await anmelden(app, "Bea Beispiel", "bea@begleitung.test");
    await app.inject({
      method: "POST",
      url: `/api/auth/users/${bea.id}/approve`,
      headers: { authorization: `Bearer ${lage.token}` },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "bea@begleitung.test", password: "secret123" },
    });
    lage.token = login.json().token as string;
    const neuerStart = seite.pruefeKonto();
    await vi.waitFor(() => expect(lage.gehalten).toHaveLength(2), WARTEN);
    // Den ALTEN Rebind zuerst freigeben — er scheitert mit Netzfehler.
    lage.gehalten[0]?.();
    expect(await umbinden).toBe(false);
    // Der neue Start läuft noch: ein weiterer Kontoabgleich darf keinen zweiten beginnen.
    await seite.pruefeKonto();
    const starts = lage.aufrufe.filter(
      (a) => a.methode === "POST" && a.pfad === "/api/klara/sessions",
    );
    expect(starts).toHaveLength(2);
    lage.halte = null;
    lage.wirft = null;
    lage.gehalten[1]?.();
    expect(await neuerStart).toBe(true);
    expect(seite.sitzung()).not.toBeNull();
    expect(lage.texte.get("konto")).toBe("Angemeldet als Bea Beispiel");
    expect(lage.texte.get("verbindung")).toBe("Verbunden mit diesem Dokument");
  });
});

// ================================================================================================
// NACHARBEIT 6 — Befund Ben begleitung.js:306: DER GEMEINSAME DATENWEG BIS ZUR NATIVEN FIGUR
// ================================================================================================
//
// Die Figur wird hier über GENAU die Wege gespielt, die die native Begleitapp benutzt
// (`GET /api/me/klara/begleiter/kontext`, `POST …/adapter/:instanz/aktionen`, Kandidat 61748e3c,
// `apps/web/src/lib/begleiter.ts`), am echten Server mit dem übernommenen Kanal
// (`services/app/src/klara-begleiter.ts`). Die native App selbst läuft hier nicht.

interface FigurAdapter {
  instanz: string;
  host: string;
  hostFassung: string;
  aktiv: boolean;
  dokument: { titel: string; gespeichert: boolean };
  auswahl: { text: string; laenge: number; stand: number } | null;
  aktionen: {
    id: string;
    art: string;
    stand: string;
    ergebnis: string | null;
    grund: string | null;
  }[];
}

type AppT = Awaited<ReturnType<typeof buehne>>["app"];

async function figurSieht(app: AppT, token: string): Promise<FigurAdapter[]> {
  const res = await app.inject({
    method: "GET",
    url: "/api/me/klara/begleiter/kontext",
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { adapter: FigurAdapter[] }).adapter;
}

function figurBeauftragt(app: AppT, token: string, instanz: string, rumpf: object) {
  return app.inject({
    method: "POST",
    url: `/api/me/klara/begleiter/adapter/${instanz}/aktionen`,
    headers: { authorization: `Bearer ${token}` },
    payload: rumpf as Record<string, unknown>,
  });
}

function kanalAufrufe(lage: Lage) {
  return lage.aufrufe.filter((a) => a.pfad.startsWith("/api/me/klara/begleiter"));
}

async function verbunden(optionen: { url?: string } = {}) {
  const teile = await buehne(optionen);
  await teile.seite.starte();
  await teile.seite.begleiterVerbinden();
  const token = teile.lage.token as string;
  const [fenster] = await figurSieht(teile.app, token);
  if (!fenster) {
    throw new Error("Kalibrierung: das Word-Fenster muss bei der Figur angemeldet sein");
  }
  return { ...teile, token, fenster };
}

describe("KO-01-02/03/04 · Office-Kontext der Begleitseite erreicht die Figur über den vorhandenen Kanal", () => {
  it("ausgeschaltet geht nichts an den Kanal; die Figur sieht kein Fenster", async () => {
    const { app, seite, lage } = await buehne();
    await seite.starte();
    expect(kanalAufrufe(lage)).toEqual([]);
    expect(await figurSieht(app, lage.token as string)).toEqual([]);
    expect(lage.texte.get("begleiter")).toBeUndefined();
  });

  it("eingeschaltet: die Figur sieht Host, Fassung, gebundenes Dokument und die gültige Markierung", async () => {
    const { lage, fenster } = await verbunden();
    expect(lage.texte.get("begleiter")).toBe("Verbunden · die Begleitfigur sieht dieses Dokument.");
    expect(fenster).toMatchObject({
      host: "word-mac",
      hostFassung: "16.89",
      aktiv: true,
      dokument: { titel: "angebot.docx", gespeichert: true },
      auswahl: { text: AUSWAHL, laenge: AUSWAHL.length },
    });
    expect(fenster.instanz).toMatch(/^bgl-[0-9a-f]{32}$/);
    // Die Dokumentadresse verlässt Word nicht — nur ihre Prüfsumme und der Dateiname.
    expect(JSON.stringify(kanalAufrufe(lage))).not.toContain("https://fiktiv/angebot.docx");
  });

  it("ohne gültigen Bezug (Auswahl gerade gewechselt) sieht die Figur KEINE Auswahl — nicht die alte", async () => {
    const { app, seite, lage, token } = await verbunden();
    auswahlWechsel(lage, "Absatz B");
    await seite.begleiterMelden();
    const [fenster] = await figurSieht(app, token);
    expect(fenster?.auswahl).toBeNull();
  });
});

describe("KO-01-06/07 · Aktionen der Figur zurück zum richtigen Word-Ziel", () => {
  it("Einfügen für den gesehenen Stand: Zielprüfung, hinter die Auswahl, Ergebnis zurück an die Figur", async () => {
    const { app, seite, lage, token, fenster } = await verbunden();
    const stand = fenster.auswahl?.stand ?? 0;
    const auftrag = await figurBeauftragt(app, token, fenster.instanz, {
      art: "einfuegen",
      text: "Fiktiver Zusatz",
      auswahlStand: stand,
    });
    expect(auftrag.statusCode, auftrag.body).toBe(202);
    await seite.begleiterMelden();
    expect(lage.eingefuegt).toEqual(["After:Fiktiver Zusatz"]);
    expect(lage.aufrufe.some((a) => a.pfad.endsWith("/office-kontext/ziel"))).toBe(true);
    const [danach] = await figurSieht(app, token);
    expect(danach?.aktionen.at(-1)).toMatchObject({ art: "einfuegen", stand: "erledigt" });
  });

  it("Auswahl wechselt nach dem Auftrag: abgelehnt, nichts geschrieben, Grund an die Figur", async () => {
    const { app, seite, lage, token, fenster } = await verbunden();
    const auftrag = await figurBeauftragt(app, token, fenster.instanz, {
      art: "einfuegen",
      text: "Fiktiver Zusatz",
      auswahlStand: fenster.auswahl?.stand ?? 0,
    });
    expect(auftrag.statusCode).toBe(202);
    auswahlWechsel(lage, "Absatz B");
    await seite.begleiterMelden();
    expect(lage.eingefuegt).toEqual([]);
    const [danach] = await figurSieht(app, token);
    expect(danach?.aktionen.at(-1)).toMatchObject({
      stand: "abgelehnt",
      grund: "auswahl_geaendert",
    });
  });

  it("Frage der Figur: über Klaras Ausführungszugang dieser Seite, Antwort zurück an die Figur", async () => {
    const { app, seite, lage, token, fenster } = await verbunden();
    lage.ausfuehrung = festeAntwort("Fiktive Antwort aus Belegen.");
    const auftrag = await figurBeauftragt(app, token, fenster.instanz, {
      art: "frage",
      text: "Was gilt hier?",
      auswahlStand: 0,
    });
    expect(auftrag.statusCode).toBe(202);
    await seite.begleiterMelden();
    const ausfuehrung = lage.aufrufe.find((a) => a.pfad.endsWith("/execute"));
    expect(ausfuehrung?.kopf["x-klara-session"]).toBe(seite.sitzung()?.sessionId);
    const [danach] = await figurSieht(app, token);
    expect(danach?.aktionen.at(-1)).toMatchObject({
      art: "frage",
      stand: "erledigt",
      ergebnis: "Fiktive Antwort aus Belegen.",
    });
  });
});

describe("KO-01-06 · Wechsel und Ausfall auf dem gemeinsamen Weg", () => {
  it("Dokumentwechsel a→b: altes Fenster abgemeldet, neues mit b.docx; Auftrag ans alte geht ins Leere", async () => {
    const { app, seite, office, token, fenster } = await verbunden({
      url: "https://fiktiv/a.docx",
    });
    expect(fenster.dokument.titel).toBe("a.docx");
    office.context.document.url = "https://fiktiv/b.docx";
    await seite.pruefeDokument();
    await vi.waitFor(async () => {
      const liste = await figurSieht(app, token);
      expect(liste.map((f) => f.dokument.titel)).toEqual(["b.docx"]);
    }, WARTEN);
    const altAuftrag = await figurBeauftragt(app, token, fenster.instanz, {
      art: "einfuegen",
      text: "Fiktiv",
      auswahlStand: fenster.auswahl?.stand ?? 0,
    });
    expect(altAuftrag.statusCode).toBe(404);
  });

  it("Kontowechsel: das Fenster erscheint beim neuen Konto; die Figur des alten Kontos erreicht es nicht", async () => {
    const { app, seite, lage, token: ada } = await verbunden();
    const bea = await anmelden(app, "Bea Beispiel", "bea@begleitung.test");
    await app.inject({
      method: "POST",
      url: `/api/auth/users/${bea.id}/approve`,
      headers: { authorization: `Bearer ${ada}` },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "bea@begleitung.test", password: "secret123" },
    });
    const beaToken = login.json().token as string;
    lage.token = beaToken;
    await seite.pruefeKonto();
    const [beiBea] = await figurSieht(app, beaToken);
    expect(beiBea).toMatchObject({ aktiv: true, dokument: { titel: "angebot.docx" } });
    const fremd = await figurBeauftragt(app, ada, beiBea?.instanz ?? "", {
      art: "frage",
      text: "Fiktiv",
      auswahlStand: 0,
    });
    expect(fremd.statusCode).toBe(404);
  });

  it("Netzausfall beim Melden: „unterbrochen“ sichtbar; danach verbindet die nächste Meldung wieder", async () => {
    const { app, seite, lage, token } = await verbunden();
    lage.wirft = (pfad) => pfad.startsWith("/api/me/klara/begleiter/adapter/");
    expect(await seite.begleiterMelden()).toBe(false);
    expect(lage.texte.get("begleiter")).toBe(
      "Verbindung zur Begleitfigur unterbrochen — wird erneut versucht.",
    );
    lage.wirft = null;
    expect(await seite.begleiterMelden()).toBe(true);
    expect(lage.texte.get("begleiter")).toBe("Verbunden · die Begleitfigur sieht dieses Dokument.");
    const [fenster] = await figurSieht(app, token);
    expect(fenster?.aktiv).toBe(true);
  });

  it("Ausschalten meldet das Fenster ab: die Figur sieht es nicht mehr", async () => {
    const { app, seite, lage, token } = await verbunden();
    seite.begleiterTrennen();
    expect(seite.begleiterLage()).toBe("aus");
    await vi.waitFor(async () => expect(await figurSieht(app, token)).toEqual([]), WARTEN);
    expect(lage.texte.get("begleiter")).toBe("Begleitfigur nicht verbunden.");
  });

  // KLARA-OFFICE-02 · Nacharbeit 6: die Abmeldewege selbst.
  it("die Abmeldung geht OHNE Rumpftyp hinaus — der Server nimmt sie an", async () => {
    const { app, seite, lage, token, fenster } = await verbunden();
    seite.begleiterTrennen();
    await vi.waitFor(async () => expect(await figurSieht(app, token)).toEqual([]), WARTEN);
    const pfad = `/api/me/klara/begleiter/adapter/${fenster.instanz}`;
    const abmeldung = lage.aufrufe.find((a) => a.methode === "DELETE" && a.pfad === pfad);
    expect(abmeldung).toBeDefined();
    expect(abmeldung?.koerper).toBeNull();
    expect(abmeldung?.kopf["content-type"]).toBeUndefined();
    // Gegenprobe: Aufrufe MIT Rumpf tragen ihren Rumpftyp weiter.
    const anmeldung = lage.aufrufe.find(
      (a) => a.methode === "POST" && a.pfad === "/api/me/klara/begleiter/adapter",
    );
    expect(anmeldung?.kopf["content-type"]).toBe("application/json");
  });

  it("Trennen WÄHREND der laufenden Anmeldung: die verspätete Anmeldung wird wieder abgemeldet", async () => {
    const { app, seite, lage } = await buehne();
    await seite.starte();
    const token = lage.token as string;
    lage.halte = (pfad) => pfad === "/api/me/klara/begleiter/adapter";
    const verbinden = seite.begleiterVerbinden();
    await vi.waitFor(() => expect(lage.gehalten).toHaveLength(1), WARTEN);
    seite.begleiterTrennen();
    lage.halte = null;
    lage.gehalten[0]?.();
    await verbinden;
    await vi.waitFor(async () => expect(await figurSieht(app, token)).toEqual([]), WARTEN);
    expect(seite.begleiterLage()).toBe("aus");
  });

  it("Dokumentwechsel WÄHREND der laufenden Anmeldung: nur das neue Fenster bleibt bei der Figur", async () => {
    const { app, seite, lage, office } = await buehne({ url: "https://fiktiv/a.docx" });
    await seite.starte();
    const token = lage.token as string;
    lage.halte = (pfad) => pfad === "/api/me/klara/begleiter/adapter";
    const verbinden = seite.begleiterVerbinden();
    await vi.waitFor(() => expect(lage.gehalten).toHaveLength(1), WARTEN);
    office.context.document.url = "https://fiktiv/b.docx";
    lage.halte = null;
    const wechsel = seite.pruefeDokument();
    lage.gehalten[0]?.(); // die alte Anmeldung (a.docx) kommt erst jetzt an
    await verbinden;
    await wechsel;
    await seite.begleiterMelden();
    await vi.waitFor(async () => {
      const liste = await figurSieht(app, token);
      expect(liste.map((f) => f.dokument.titel)).toEqual(["b.docx"]);
    }, WARTEN);
  });
});

// ================================================================================================
// NACHARBEIT 8 — Befunde Ben begleitung.js:850 und :973
// ================================================================================================

function ausfuehrungen(lage: Lage) {
  return lage.aufrufe.filter((a) => a.pfad.endsWith("/execute"));
}

async function zweiFragenEmpfangen(optionen: { url?: string } = {}) {
  const teile = await verbunden(optionen);
  const { app, lage, token, fenster } = teile;
  lage.ausfuehrung = festeAntwort("Fiktive Antwort aus Belegen.");
  for (const text of ["Erste fiktive Frage?", "Zweite fiktive Frage?"]) {
    const auftrag = await figurBeauftragt(app, token, fenster.instanz, {
      art: "frage",
      text,
      auswahlStand: 0,
    });
    expect(auftrag.statusCode, auftrag.body).toBe(202);
  }
  // Die erste Ausführung wird angehalten — „während der ersten" geschieht der Wechsel.
  lage.halte = (pfad) => pfad.endsWith("/execute");
  const melden = teile.seite.begleiterMelden();
  await vi.waitFor(() => expect(lage.gehalten).toHaveLength(1), WARTEN);
  return { ...teile, melden };
}

describe("KO-02-05 · empfangene Aufträge der Figur gelten nur unter ihrer Empfangsbindung", () => {
  it("zwei Fragen empfangen, während der ersten getrennt: die zweite erreicht /execute nicht", async () => {
    const { seite, lage, melden } = await zweiFragenEmpfangen();
    seite.begleiterTrennen();
    lage.halte = null;
    lage.gehalten[0]?.();
    await melden;
    expect(ausfuehrungen(lage)).toHaveLength(1);
    expect(ausfuehrungen(lage)[0]?.koerper?.question).toBe("Erste fiktive Frage?");
    expect(seite.begleiterLage()).toBe("aus");
  });

  it("zwei Fragen empfangen, während der ersten Dokumentwechsel: die zweite bindet sich nicht an b.docx", async () => {
    const { seite, lage, office, melden } = await zweiFragenEmpfangen({
      url: "https://fiktiv/a.docx",
    });
    const vorher = seite.sitzung();
    office.context.document.url = "https://fiktiv/b.docx";
    await seite.pruefeDokument();
    expect(seite.sitzung()?.dokument).not.toBe(vorher?.dokument);
    lage.halte = null;
    lage.gehalten[0]?.();
    await melden;
    expect(ausfuehrungen(lage)).toHaveLength(1);
    expect(ausfuehrungen(lage)[0]?.koerper?.question).toBe("Erste fiktive Frage?");
  });

  it("Gegenprobe: ohne Wechsel laufen beide empfangenen Fragen nacheinander", async () => {
    const { app, lage, token, melden } = await zweiFragenEmpfangen();
    lage.halte = null;
    lage.gehalten[0]?.();
    await melden;
    expect(ausfuehrungen(lage).map((a) => a.koerper?.question)).toEqual([
      "Erste fiktive Frage?",
      "Zweite fiktive Frage?",
    ]);
    await vi.waitFor(async () => {
      const [danach] = await figurSieht(app, token);
      expect(danach?.aktionen.filter((a) => a.stand === "erledigt")).toHaveLength(2);
    }, WARTEN);
  });
});

describe("KO-02-05/07 · Ergebnisübermittlung scheitert: gepuffert, kein Sofort-Nachsenden", () => {
  it("dauerhafter Netzfehler nach ausgeführter Aktion: genau ein Übermittlungsversuch je Meldung", async () => {
    const { app, seite, lage, token, fenster } = await verbunden();
    lage.ausfuehrung = festeAntwort("Fiktive Antwort aus Belegen.");
    const auftrag = await figurBeauftragt(app, token, fenster.instanz, {
      art: "frage",
      text: "Was gilt hier?",
      auswahlStand: 0,
    });
    expect(auftrag.statusCode).toBe(202);
    const meldungen = () =>
      lage.aufrufe.filter(
        (a) =>
          a.methode === "PUT" && a.pfad === `/api/me/klara/begleiter/adapter/${fenster.instanz}`,
      ).length;
    // Ab der Ausführung scheitert jede Übermittlung an den Kanal.
    lage.wirft = (pfad) =>
      pfad.startsWith("/api/me/klara/begleiter/adapter/") && ausfuehrungen(lage).length > 0;
    const vorher = meldungen();
    await seite.begleiterMelden();
    // Ein Abruf der Aufträge, EIN gescheiterter Übermittlungsversuch — keine Schleife.
    expect(meldungen() - vorher).toBe(2);
    expect(lage.texte.get("begleiter")).toBe(
      "Verbindung zur Begleitfigur unterbrochen — wird erneut versucht.",
    );
    // Der nächste Takt versucht es genau einmal erneut; das Ergebnis bleibt erhalten.
    expect(await seite.begleiterMelden()).toBe(false);
    expect(meldungen() - vorher).toBe(3);
    lage.wirft = null;
    expect(await seite.begleiterMelden()).toBe(true);
    const [danach] = await figurSieht(app, token);
    expect(danach?.aktionen.at(-1)).toMatchObject({
      art: "frage",
      stand: "erledigt",
      ergebnis: "Fiktive Antwort aus Belegen.",
    });
  });
  // Gegenprobe „nach Erfolg sofort hinaus": vorhandener Fall „Frage der Figur …" oben.
});

// ================================================================================================
// NACHARBEIT 10 — Befund Ben begleitung.js:1083: Ereignisregistrierung VOR dem Sitzungsstart
// ================================================================================================

function sitzungsStarts(lage: Lage) {
  return lage.aufrufe.filter((a) => a.methode === "POST" && a.pfad === "/api/klara/sessions");
}

describe("KO-02-04/05 · Auswahlwechsel erreichen die Figur auch bei schon gültiger Anmeldung", () => {
  it("Start wartet den Registrierungsrückruf ab; danach sieht die Figur die neue Markierung", async () => {
    const { app, seite, lage } = await buehne();
    const token = lage.token as string;
    lage.registrierungHalten = true;
    const start = seite.starte();
    await vi.waitFor(() => expect(lage.registrierungen).toHaveLength(1), WARTEN);
    // Solange office.js die Registrierung nicht bestätigt hat, startet KEINE Sitzung.
    await new Promise((r) => setTimeout(r, 50));
    expect(sitzungsStarts(lage)).toHaveLength(0);
    lage.registrierungHalten = false;
    for (const frei of lage.registrierungen.splice(0)) {
      frei();
    }
    await start;
    expect(sitzungsStarts(lage)).toHaveLength(1);
    // Seite UND Adapter sind registriert — keine Registrierung wurde verdrängt.
    expect(lage.handler).toHaveLength(2);

    await seite.begleiterVerbinden();
    const [vorher] = await figurSieht(app, token);
    expect(vorher?.auswahl?.text).toBe(AUSWAHL);
    auswahlWechsel(lage, "Absatz B fiktiv");
    for (const f of lage.zeitgeber.splice(0)) {
      f();
    }
    await vi.waitFor(async () => {
      const [danach] = await figurSieht(app, token);
      expect(danach?.auswahl?.text).toBe("Absatz B fiktiv");
      expect(danach?.auswahl?.stand).toBeGreaterThan(vorher?.auswahl?.stand ?? 0);
    }, WARTEN);
  });

  it("ruft der Host den Registrierungsrückruf nie auf, startet die Sitzung nach der Frist", async () => {
    const { seite, lage } = await buehne();
    lage.registrierungStumm = true;
    const start = seite.starte();
    await new Promise((r) => setTimeout(r, 20));
    expect(sitzungsStarts(lage)).toHaveLength(0);
    // Die begrenzte Frist (1,5 s) läuft ab.
    for (const f of lage.zeitgeber.splice(0)) {
      f();
    }
    await start;
    expect(sitzungsStarts(lage)).toHaveLength(1);
    expect(seite.sitzung()).not.toBeNull();
  });
});
