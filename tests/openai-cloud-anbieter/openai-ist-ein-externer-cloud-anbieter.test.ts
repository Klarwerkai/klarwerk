// ================================================================================================
// JOB 3090 — CHATGPT (OPENAI) IST EIN EIGENER CLOUD-ANBIETER, EHRLICH ALS EXTERN AUSGEWIESEN.
// ================================================================================================
//
// Pedis Entscheidung 24 (05.09., 19:23): „Als KI werden wir ChatGPT nehmen … neuer Token für
// KLARWERK und Klara". Vor diesem Auftrag gab es dafür keinen ehrlichen Weg: der einzige Client,
// der `/chat/completions` sprechen konnte, hieß per Konstruktion `local:${model}`
// (`model-client.ts`), und die Admin-Übersicht wies ihn in der Zeile „lokaler LLM-Server" aus. Wer
// ChatGPT so verdrahtet hätte, hätte einen Anbieter in den USA als „eigenen lokalen Server"
// angezeigt bekommen — der Egress-Riegel hätte gehalten, die AUSKUNFT nicht.
//
// GEMESSEN WIRD DER ECHTE WEG: die Umgebungsfabrik `createCappedCloudClientFromEnv` — nach außen
// gibt es keinen anderen Cloud-Client (SCRUM-502 R8). Eine Probe am rohen Client wäre grün, während
// der Wrapper (Egress-Wächter + In-Flight-Cap) fehlt oder etwas verliert.
//
// HERMETIK: kein Netz, kein echter Schlüssel. `fetch` ist global durch einen Spion ersetzt, der
// jede Anfrage mitschreibt; der Schlüsselbund ist ausdrücklich stillgelegt.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { aiAccessRows, anbieterUndModell } from "../../apps/web/src/lib/aiOverview";
// SCRUM-502 R8: die Umgebungsfabriken sind bewusst nicht aus dem Paket-Index exportiert; der Zugriff
// erfolgt relativ auf das Modul — dasselbe Muster wie in `tests/ki-lauf-modell/lauf-nennt-modell.test.ts`.
import {
  createCappedCloudClientFromEnv,
  createCappedLocalClientFromEnv,
} from "../../services/reasoner/src/model-client";
import {
  ConfidentialEgressError,
  type ModellAufrufSpur,
  mitModellAufrufSpur,
} from "../../services/reasoner/src/model-concurrency";
import { type ModelClient, ModelProvider } from "../../services/reasoner/src/provider-model";

const OPENAI_ENV = {
  OPENAI_API_KEY: "test-schluessel-nur-hier",
  REASONER_MODEL: "gpt-4o-mini",
};

// JOB 3100: der eigene lokale LLM-Server, so verdrahtet wie im Betrieb (Loopback = bestätigt on-prem).
const LOKAL_ENV = {
  KLARWERK_LOCAL_LLM_URL: "http://127.0.0.1:8000/v1",
  KLARWERK_LOCAL_LLM_MODEL: "Qwen3-32B-AWQ",
};

// JOB 3100: ein formal gültiges Bild (png, base64) — der Inhalt spielt keine Rolle, die FORM schon.
const BILD = "data:image/png;base64,iVBORw0KGgo=";

const ANTHROPIC_ENV = {
  ANTHROPIC_API_KEY: "test-schluessel-nur-hier",
  REASONER_MODEL: "claude-sonnet-4-6",
};

// Der Schlüsselbund wird nie befragt (der Schlüssel steht in der Env) — beide Zugriffe sind
// trotzdem ausdrücklich stillgelegt, damit der Lauf auf jedem Rechner gleich ist.
const KEIN_SCHLUESSELBUND = (): undefined => undefined;
const KEIN_SPEICHERN = (): boolean => false;

interface Anfrage {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/** Ersetzt `fetch` global und schreibt jede Anfrage mit. Antwortet in der /chat/completions-Form. */
function fetchSpion(antwort: unknown = { choices: [{ message: { content: "OK" } }] }): Anfrage[] {
  const anfragen: Anfrage[] = [];
  vi.stubGlobal("fetch", (async (url: unknown, init: unknown) => {
    const opts = (init ?? {}) as { headers?: Record<string, string>; body?: string };
    anfragen.push({
      url: String(url),
      headers: opts.headers ?? {},
      body: JSON.parse(opts.body ?? "{}") as Record<string, unknown>,
    });
    return { ok: true, status: 200, json: async () => antwort } as unknown as Response;
  }) as unknown as typeof fetch);
  return anfragen;
}

// JOB 3134: die Fabrik liefert BEIDE Anbieter unter ihrem Namen (die Vorzugsregel ist durch Pedis
// Wahl ersetzt). Für die Fälle hier zählt der Client, der OHNE Wahl zuerst arbeitet — die
// Reihenfolge von `REASONER_CLOUD_ANBIETER` (openai, anthropic).
function cloudClient(env: Record<string, string | undefined>) {
  const clients = createCappedCloudClientFromEnv(env, KEIN_SCHLUESSELBUND, KEIN_SPEICHERN);
  return clients.openai ?? clients.anthropic;
}

/**
 * JOB 3100: der Bildweg des gereichten Clients — oder ein SPRECHENDES Rot. Ohne diese Klammer läge
 * das Rot vor dem Bau an einer Nebenaussage („expected [] to have a length of 1"); so nennt es den
 * Befund selbst. Gebunden wird an den GECAPPTEN Client, damit Egress-Wächter und In-Flight-Cap im
 * Weg bleiben (eine Probe am rohen Client wäre grün, während der Riegel fehlt).
 */
function bildweg(client: ModelClient | undefined): NonNullable<ModelClient["completeVision"]> {
  const fn = client?.completeVision;
  if (!client || typeof fn !== "function") {
    throw new Error("Der gereichte Client hat keinen Bildweg (completeVision).");
  }
  return fn.bind(client);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("JOB 3090 F1–F7: der Weg nach OpenAI", () => {
  it("F1: OPENAI_API_KEY + REASONER_MODEL → ein Cloud-Client, der den Anbieter nennt", () => {
    const client = cloudClient(OPENAI_ENV);
    expect(client).toBeDefined();
    // Der Name trägt „cloud" UND „openai" UND das Modell — und ist von beiden Bestandsformen
    // (`local:…`, `anthropic:…`) eindeutig unterscheidbar.
    expect(client?.name).toBe("cloud:openai:gpt-4o-mini");
    expect(client?.name.startsWith("local:")).toBe(false);
    expect(client?.name.startsWith("anthropic:")).toBe(false);
    // JOB 3036: `model` bleibt der REINE Bezeichner ohne Anbieter-Präfix (Laufprotokoll).
    expect(client?.model).toBe("gpt-4o-mini");
  });

  it("F2: complete() postet auf /chat/completions mit Bearer und dem Modell aus REASONER_MODEL", async () => {
    const anfragen = fetchSpion();
    const client = cloudClient(OPENAI_ENV);
    await client?.complete("system", "nutzer", false);
    expect(anfragen).toHaveLength(1);
    const anfrage = anfragen[0] as Anfrage;
    expect(anfrage.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(anfrage.headers.authorization).toBe("Bearer test-schluessel-nur-hier");
    expect(anfrage.body.model).toBe("gpt-4o-mini");
    expect(anfrage.body.messages).toEqual([
      { role: "system", content: "system" },
      { role: "user", content: "nutzer" },
    ]);
  });

  it("F2b: OPENAI_BASE_URL verlegt den Endpunkt (Azure/Proxy) — der Pfad bleibt /chat/completions", async () => {
    const anfragen = fetchSpion();
    const client = cloudClient({ ...OPENAI_ENV, OPENAI_BASE_URL: "https://proxy.example/v1/" });
    await client?.complete("s", "u", false);
    expect(anfragen[0]?.url).toBe("https://proxy.example/v1/chat/completions");
  });

  it("F3: vertraulicher Text wird abgelehnt, BEVOR fetch gerufen wird (null Aufrufe)", async () => {
    const anfragen = fetchSpion();
    const client = cloudClient(OPENAI_ENV);
    // Die WIRKUNG zuerst, die sichtbare Marke danach: fiele der Riegel, stünde hier die Anfrage im
    // Spion — ein Fehler NACH dem Fetch wäre bereits Egress, deshalb zählt nur die Null.
    await expect(client?.complete("system", "vertraulicher Paartext", true)).rejects.toBeInstanceOf(
      ConfidentialEgressError,
    );
    expect(anfragen).toHaveLength(0);
    // Die Egress-Politik ist am gereichten Client zusätzlich SICHTBAR — der Reasoner liest sie, um
    // die Kante bei vertraulichen Paaren VOR jedem Aufruf aus der Kette zu nehmen.
    expect(client?.rejectsConfidential).toBe(true);
  });

  it("F3b: auch hinter einem Proxy bleibt OpenAI extern — kein Weg lockert den Riegel", async () => {
    // Der lokale Weg entscheidet über `isConfirmedLocalOrigin`; eine Loopback-Adresse gälte dort als
    // on-prem. Für OpenAI gilt das ausdrücklich NICHT: die Marke hängt am Anbieter, nicht an der URL.
    const anfragen = fetchSpion();
    const client = cloudClient({ ...OPENAI_ENV, OPENAI_BASE_URL: "http://127.0.0.1:8080/v1" });
    expect(client?.rejectsConfidential).toBe(true);
    await expect(client?.complete("s", "u", true)).rejects.toBeInstanceOf(ConfidentialEgressError);
    expect(anfragen).toHaveLength(0);
  });

  it("F4: ohne OPENAI_API_KEY entsteht nichts — kein Wurf, keine Ausgabe", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    expect(cloudClient({})).toBeUndefined();
    expect(cloudClient({ REASONER_MODEL: "gpt-4o-mini" })).toBeUndefined();
    expect(stderr).not.toHaveBeenCalled();
  });

  it("F5: ein Schlüssel ohne REASONER_MODEL ist keine Konfiguration", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    expect(cloudClient({ OPENAI_API_KEY: "test-schluessel-nur-hier" })).toBeUndefined();
    expect(stderr).not.toHaveBeenCalled();
  });

  it("F6: nur ANTHROPIC_API_KEY → der Bestandsweg unverändert (/v1/messages, x-api-key)", async () => {
    const anfragen = fetchSpion({ content: [{ type: "text", text: "OK" }] });
    const client = cloudClient(ANTHROPIC_ENV);
    expect(client?.name).toBe("anthropic:claude-sonnet-4-6");
    expect(client?.rejectsConfidential).toBe(true);
    // Der Bildpfad (completeVision) gehört weiterhin zu Anthropic und ist unangetastet.
    expect(typeof client?.completeVision).toBe("function");
    await client?.complete("system", "nutzer", false);
    expect(anfragen[0]?.url).toBe("https://api.anthropic.com/v1/messages");
    expect(anfragen[0]?.headers["x-api-key"]).toBe("test-schluessel-nur-hier");
    expect(anfragen[0]?.headers["anthropic-version"]).toBe("2023-06-01");
  });

  // JOB 3134: „OpenAI hat Vorrang" gilt nicht mehr — beide Schlüssel ergeben BEIDE Clients, und
  // welcher arbeitet, entscheidet die gespeicherte Wahl (tests/ki-anbieterwahl). Was hier bleibt:
  // der OpenAI-Client entsteht mit dem Modell aus REASONER_MODEL, der Anthropic-Client daneben mit
  // seinem Vorgabewert (kein anbieterfremder Name), und der Schlüsselbund wird nicht gefragt, weil
  // der Anthropic-Schlüssel in der Env liegt.
  it("F7: beide Schlüssel gesetzt → beide Clients entstehen, der Schlüsselbund wird nicht einmal gefragt", async () => {
    const anfragen = fetchSpion();
    let schluesselbundGefragt = 0;
    const clients = createCappedCloudClientFromEnv(
      { ...ANTHROPIC_ENV, ...OPENAI_ENV, REASONER_MODEL: "gpt-4o-mini" },
      () => {
        schluesselbundGefragt += 1;
        return undefined;
      },
      KEIN_SPEICHERN,
    );
    expect(clients.openai?.name).toBe("cloud:openai:gpt-4o-mini");
    expect(clients.anthropic?.name).toBe("anthropic:claude-sonnet-4-6");
    expect(clients.gruende).toEqual({});
    await clients.openai?.complete("s", "u", false);
    expect(anfragen[0]?.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(schluesselbundGefragt).toBe(0);
  });
});

describe("JOB 3090 F8/F9: die Admin-Übersicht nennt den Anbieter ehrlich", () => {
  it("F8: mit OpenAI-Cloud steht der Anbieter lesbar in der Cloud-Zeile", () => {
    const rows = aiAccessRows({
      configured: true,
      cloudConfigured: true,
      provider: "cloud:openai:gpt-4o-mini",
      model: "cloud:openai:gpt-4o-mini",
      mode: "model",
    });
    // JOB 3134: je Anbieter eine eigene Zeile — ChatGPT (OpenAI) ist die erste, Claude die zweite.
    expect(rows[0]).toEqual({
      id: "openai",
      state: "active",
      detail: "ChatGPT (OpenAI) · gpt-4o-mini",
    });
    // Ein Mensch erkennt den Anbieter, ohne den Modellnamen deuten zu müssen — und er liest ihn
    // NICHT in der Zeile des eigenen lokalen Servers.
    expect(rows[0]?.detail).toContain("OpenAI");
    expect(rows[3]).toEqual({ id: "local", state: "planned", detail: null });
  });

  it("F8b: Anthropic ist in seiner eigenen Zeile davon unterscheidbar", () => {
    const rows = aiAccessRows({
      configured: true,
      cloudConfigured: true,
      provider: "anthropic:claude-sonnet-4-6",
      model: "anthropic:claude-sonnet-4-6",
      mode: "model",
    });
    expect(rows[1]?.detail).toBe("Claude (Anthropic) · claude-sonnet-4-6");
    expect(rows[1]?.detail).not.toContain("OpenAI");
    expect(rows[0]?.state).toBe("missing");
  });

  it("F8c: eine unbekannte Kennung wird wörtlich gezeigt, nicht geraten", () => {
    expect(anbieterUndModell("irgendwas:modell-x")).toBe("irgendwas:modell-x");
    // Auch der lokale Name bleibt, was er ist — diese Ableitung gilt der Cloud-Zeile.
    expect(anbieterUndModell("local:Qwen3-32B-AWQ")).toBe("local:Qwen3-32B-AWQ");
  });

  it("F9: ohne Cloud-Konfiguration bleibt die Zeile leer — und die lokale Zeile unverändert", () => {
    const rows = aiAccessRows({
      configured: true,
      cloudConfigured: false,
      provider: "local:Qwen3-32B-AWQ",
      model: "local:Qwen3-32B-AWQ",
      mode: "model",
      localConfigured: true,
      localProvider: "local:Qwen3-32B-AWQ",
    });
    // Kein Modellname ohne Schlüssel: das wäre eine Aussage über eine Verbindung, die es nicht gibt.
    expect(rows[0]).toEqual({ id: "openai", state: "missing", detail: null });
    expect(rows[1]).toEqual({ id: "anthropic", state: "missing", detail: null });
    expect(rows[3]).toEqual({ id: "local", state: "available", detail: "local:Qwen3-32B-AWQ" });
    expect(rows.map((r) => r.id)).toEqual(["openai", "anthropic", "fallback", "local"]);
  });
});

describe("JOB 3090 F10–F12: die ausgewiesenen Grenzen", () => {
  // F10 IST ABGELÖST, NICHT ERGÄNZT (JOB 3100, Lieferpunkt 6). Seine ALTE Erwartung war wörtlich:
  //   „F10: der OpenAI-Client kann keine Bilder — das Feld fehlt, statt etwas zu erfinden"
  //   expect(client?.completeVision).toBeUndefined();
  //   expect("completeVision" in (client ?? {})).toBe(false);
  // Sie pinnte die Lücke, die Pedis Entscheidung 6 („hundert Prozent auf ChatGPT") widerspricht: eine
  // reine OpenAI-Installation war für Bilder blind und die Reasoner-Kette wich auf einen Weg aus, der
  // gar nicht mehr benutzt werden soll. Die Erwartung steht jetzt in ihr Gegenteil verkehrt hier —
  // NICHT zusätzlich woanders. Die Grenze, die bleibt, ist F14 (der eigene lokale LLM).
  it("F10: der OpenAI-Client kann Bilder — der Bildweg ist am gereichten Client vorhanden", () => {
    const client = cloudClient(OPENAI_ENV);
    expect(typeof client?.completeVision).toBe("function");
    expect("completeVision" in (client ?? {})).toBe(true);
  });

  it("F11: der von OpenAI gemeldete Verbrauch kommt an — genau einmal je Aufruf", async () => {
    fetchSpion({
      choices: [{ message: { content: "OK" } }],
      usage: { prompt_tokens: 11, completion_tokens: 7 },
    });
    const client = cloudClient(OPENAI_ENV);
    const spur: ModellAufrufSpur = { gerufen: false };
    await mitModellAufrufSpur(spur, async () => {
      await client?.complete("s", "u", false);
    });
    expect(spur.gerufen).toBe(true);
    // Ein Aufruf, eine Meldung: `gemeldeteAufrufe: 1` schließt die Doppelzählung aus (JOB 3074 R1).
    expect(spur.verbrauch).toEqual({ eingabeToken: 11, ausgabeToken: 7, gemeldeteAufrufe: 1 });
  });

  // F12 IST EINE STRUKTURPRÜFUNG UND SONST NICHTS — und das steht hier, weil Runde 1 in der
  // Rückgabe mehr behauptet hat, als dieser Test kann (BEN, Korrekturpflicht 1): F12 liest den
  // QUELLTEXT und zählt Muster. Er sieht deshalb NICHT, WELCHER Anbieter gewählt wird; wird die
  // OpenAI-Wahl wieder ausgebaut (Probe M2), bleibt er GRÜN — gemessen, nicht vermutet. Was er
  // leistet: er fängt eine ZWEITE Kopie des HTTP-Wegs und eine ZWEITE Cloud-Egress-Regel. Den
  // Nachweis der Anbieterwahl führen F1/F2/F7 und der Verbindungstest
  // (`cloud-wahl-verbindungstest.test.tsx`, V1–V4), die unter M2 rot werden.
  it("F12: es gibt genau EINEN /chat/completions-Weg und EINE Cloud-Egress-Regel", () => {
    const quelle = readFileSync(
      join(process.cwd(), "services/reasoner/src/model-client.ts"),
      "utf8",
    );
    // Kein zweiter HTTP-Weg (Lieferpunkt 7): der Pfad wird an genau EINER Stelle gefetcht.
    // JOB 3100, BERICHTIGT: hier stand „nicht die Erwähnung in einem Kommentar" — das war falsch und
    // ist gemessen (der Bildweg-Kommentar in `model-client.ts` ließ diese Zeile rot werden, bevor die
    // Zeichenform dort verschwand). Gezählt wird die ZEICHENFORM in der ganzen Datei, Kommentare
    // eingeschlossen. Der Wächter ist dadurch strenger, nicht schwächer: wer den Weg zitiert, muss ihn
    // umschreiben; wer ihn kopiert, wird rot.
    expect(quelle.match(/\$\{base\}\/chat\/completions/g) ?? []).toHaveLength(1);
    // Keine zweite Egress-Regel: die Marke wird für die Cloud an genau einer Stelle gesetzt — in der
    // einen Fabrik, für BEIDE Anbieter.
    expect(quelle.match(/\{ rejectsConfidential: true \}/g) ?? []).toHaveLength(1);
  });
});

// ================================================================================================
// JOB 3100 F13–F18 — AUCH BILDAUFTRÄGE LAUFEN ÜBER CHATGPT.
// ================================================================================================
//
// Pedis Entscheidung 6 (POC-UMSETZUNG-20260905-1: „hundert Prozent auf ChatGPT") gilt auch für
// Bilder. Vor diesem Auftrag war eine reine OpenAI-Installation für die KI-Bildbeschreibung blind:
// `describeImage` fand kein `completeVision` (`provider-model.ts:1281-1283`) und die Reasoner-Kette
// wich auf den nächsten Anbieter aus — in der Vorführung also auf einen Weg, der laut Entscheidung 6
// gar nicht mehr benutzt werden soll.
//
// GEMESSEN WIRD WIEDER DER ECHTE WEG (wie F1–F12): der gecappte Client aus
// `createCappedCloudClientFromEnv`. F13b geht eine Ebene höher und misst den Punkt, an dem der
// Rückfall entstand — `ModelProvider.describeImage`.
describe("JOB 3100 F13–F18: der Bildweg von ChatGPT (OpenAI)", () => {
  it("F13: completeVision postet GENAU EINEN Aufruf auf /chat/completions — mit Bearer und der data:-URL", async () => {
    const anfragen = fetchSpion({ choices: [{ message: { content: "Ein Manometer." } }] });
    const client = cloudClient(OPENAI_ENV);
    const text = await bildweg(client)("system", BILD, "beschreibe das Bild", false);
    expect(text).toBe("Ein Manometer.");
    expect(anfragen).toHaveLength(1);
    const anfrage = anfragen[0] as Anfrage;
    expect(anfrage.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(anfrage.headers.authorization).toBe("Bearer test-schluessel-nur-hier");
    expect(anfrage.body.model).toBe("gpt-4o-mini");
    // Der OpenAI-Vertrag: die data:-URL reist UNZERLEGT als `image_url.url` — kein zweiter Parser,
    // keine getrennten base64-/Medientyp-Felder wie auf der Anthropic-Kante.
    expect(anfrage.body.messages).toEqual([
      { role: "system", content: "system" },
      {
        role: "user",
        content: [
          { type: "text", text: "beschreibe das Bild" },
          { type: "image_url", image_url: { url: BILD } },
        ],
      },
    ]);
  });

  it("F13b: ModelProvider.describeImage erreicht ChatGPT — der Wurf über den fehlenden Bild-Eingang entfällt", async () => {
    const anfragen = fetchSpion({
      choices: [{ message: { content: "Ein Manometer am Kesselzulauf." } }],
    });
    // Genau die Verdrahtung des Produkts: gecappter Cloud-Client → ModelProvider (build-app.ts:422).
    const provider = new ModelProvider(cloudClient(OPENAI_ENV));
    const ergebnis = await provider.describeImage(BILD, "de", false);
    // Vor JOB 3100 warf diese Zeile „Dieses Modell hat keinen Bild-Eingang (Vision)."
    // (provider-model.ts:1281-1283) und die Reasoner-Kette wich auf den nächsten Anbieter aus.
    expect(ergebnis).toEqual({ text: "Ein Manometer am Kesselzulauf.", demo: false });
    expect(anfragen).toHaveLength(1);
    expect(anfragen[0]?.url).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("F14: der EIGENE lokale LLM bekommt den Bildweg NICHT — die Grenze bleibt, wo sie war", () => {
    const lokal = createCappedLocalClientFromEnv(LOKAL_ENV);
    expect(lokal).toBeDefined();
    // Ob ein selbst betriebener Server Bilder kann, hat niemand zugesagt. `describeImage` prüft
    // `typeof client.completeVision !== "function"` — eine stets vorhandene Methode würde die Kette
    // an einen Anbieter schicken, der es womöglich gar nicht kann, statt ehrlich zu scheitern.
    expect(typeof lokal?.completeVision).not.toBe("function");
    expect(lokal?.completeVision).toBeUndefined();
    expect("completeVision" in (lokal ?? {})).toBe(false);
    // Und die Bestandszusage des lokalen Wegs ist unberührt: Loopback gilt weiter als on-prem.
    expect(lokal?.rejectsConfidential).toBe(false);
  });

  it("F15: ein vertrauliches Bild wird abgelehnt, BEVOR fetch gerufen wird (null Aufrufe)", async () => {
    const anfragen = fetchSpion();
    const client = cloudClient(OPENAI_ENV);
    // Wie F3: die WIRKUNG zuerst. Ein Fehler NACH dem Fetch wäre bereits Egress — es zählt die Null.
    await expect(bildweg(client)("system", BILD, "beschreibe", true)).rejects.toBeInstanceOf(
      ConfidentialEgressError,
    );
    expect(anfragen).toHaveLength(0);
  });

  it("F16: auch der Bildlauf hinterlässt die Spur — gerufen und der gemeldete Verbrauch", async () => {
    fetchSpion({
      choices: [{ message: { content: "Ein Manometer." } }],
      usage: { prompt_tokens: 11, completion_tokens: 7 },
    });
    const client = cloudClient(OPENAI_ENV);
    const spur: ModellAufrufSpur = { gerufen: false };
    await mitModellAufrufSpur(spur, async () => {
      await bildweg(client)("system", BILD, "beschreibe", false);
    });
    expect(spur.gerufen).toBe(true);
    // Ein Aufruf, eine Meldung — `gemeldeteAufrufe: 1` schließt die Doppelzählung aus (JOB 3074 R1).
    expect(spur.verbrauch).toEqual({ eingabeToken: 11, ausgabeToken: 7, gemeldeteAufrufe: 1 });
  });

  it("F17: ungültige Bild-Daten werfen VOR dem Fetch — null Aufrufe, nichts wird geraten", async () => {
    const anfragen = fetchSpion();
    const client = cloudClient(OPENAI_ENV);
    // SVG ist bewusst NICHT in der Allowlist (aktive Inhalte); Klartext ist gar kein Bild.
    await expect(
      bildweg(client)("system", "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=", "beschreibe", false),
    ).rejects.toThrow("Bild-Daten sind keine gültige data:image-URL (png/jpeg/gif/webp).");
    await expect(
      bildweg(client)("system", "kein Bild, nur ein Satz", "beschreibe", false),
    ).rejects.toThrow("Bild-Daten sind keine gültige data:image-URL (png/jpeg/gif/webp).");
    expect(anfragen).toHaveLength(0);
  });

  it("F18a: lehnt ChatGPT das Bild ab, steht das ehrlich da — mit dem Anbieternamen", async () => {
    vi.stubGlobal(
      "fetch",
      (async () =>
        ({
          ok: false,
          status: 400,
          json: async () => ({}),
        }) as unknown as Response) as typeof fetch,
    );
    const client = cloudClient(OPENAI_ENV);
    // „Lokaler LLM antwortete mit 400" wäre über einen Anbieter in den USA schlicht falsch.
    await expect(bildweg(client)("system", BILD, "beschreibe", false)).rejects.toThrow(
      "ChatGPT (OpenAI) antwortete mit 400",
    );
  });

  it("F18b: eine leere Bild-Antwort wird ein typisierter Fehler, nie ein stiller Leerstring", async () => {
    fetchSpion({ choices: [{ message: { content: "" }, finish_reason: "length" }] });
    const client = cloudClient(OPENAI_ENV);
    // Derselbe Antwort-Vertrag wie auf dem Textweg (requireChatContent) — kein zweiter Kern.
    await expect(bildweg(client)("system", BILD, "beschreibe", false)).rejects.toThrow(
      "ChatGPT (OpenAI): Antwort wurde am Token-Limit abgeschnitten",
    );
  });
});
