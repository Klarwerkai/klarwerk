// ================================================================================================
// WORD WEB · SHAREPOINT-HERKUNFT DES EINGETRAGENEN MICROSOFT-365-MANDANTEN (E1–E5)
// ================================================================================================
//
// Live belegt (1.0.0-beta.1.609, 26.09.2026): Word im Browser lädt Klara in der Rahmenkette
// `https://klarwerktest4711-my.sharepoint.com` (TOP) → `https://dec-word-edit.officeapps.live.com`
// → Klara. Der SharePoint-Top-Rahmen fehlte in `frame-ancestors`, Chrome blockierte das Taskpane.
//
// Diese Datei misst die Antwort darauf — KLARWERK_M365_MANDANTEN — am ECHTEN Server: eine
// Fastify-Instanz mit der Produktionsregistrierung `registerSecurityHeaders`, gestartet auf einem
// freien Port und über HTTP (fetch) abgefragt. Gemessen wird die Kopfzeile, die wirklich rausgeht.
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  ERLAUBTE_EINBETTUNGS_HOSTS,
  NICHT_FREIGEGEBENE_PLATTFORMFAMILIEN,
  istErlaubterEinbettungsHost,
  leseM365Mandanten,
  sharepointHerkuenfte,
  wordAddinFrameAncestors,
} from "../../services/app/src/office-host";
import { registerSecurityHeaders } from "../../services/app/src/security-headers";

const TASKPANE = "/word-addin/taskpane.html";
const ANMELDUNG = "/word-addin/anmeldung.html";

/** Die Direktive, wie sie OHNE Eintrag heute ausgeliefert wird — wörtlich, nicht abgeleitet. */
const HEUTE = "frame-ancestors 'self' https://*.office.com https://*.officeapps.live.com";

interface LaufenderServer {
  readonly basis: string;
  readonly protokoll: string[];
  readonly app: FastifyInstance;
}

const offen: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(offen.splice(0).map((app) => app.close()));
});

/**
 * Startet einen echten Server mit der Produktionsregistrierung und dem gegebenen Umgebungssatz.
 * Das Protokoll wird mitgeschrieben, damit E3 die Startmeldung mit Grund lesen kann.
 */
async function starte(env: NodeJS.ProcessEnv): Promise<LaufenderServer> {
  const protokoll: string[] = [];
  const app = Fastify({
    logger: { level: "info", stream: { write: (zeile: string) => protokoll.push(zeile) } },
  });
  offen.push(app);
  await registerSecurityHeaders(app, env);
  for (const pfad of [TASKPANE, ANMELDUNG, "/", "/api/health", "/word-addin/icon-32.png"]) {
    app.get(pfad, async (_request, reply) => reply.type("text/html").send("ok"));
  }
  const basis = await app.listen({ port: 0, host: "127.0.0.1" });
  return { basis, protokoll, app };
}

async function kopf(basis: string, pfad: string): Promise<Headers> {
  const antwort = await fetch(`${basis}${pfad}`);
  expect(antwort.status, pfad).toBe(200);
  return antwort.headers;
}

function frameAncestors(csp: string | null): string | undefined {
  return (csp ?? "")
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith("frame-ancestors "));
}

describe("E1 · mit eingetragenem Mandanten — am Draht gemessen", () => {
  it("die Taskpane-Antwort trägt GENAU die zwei SharePoint-Herkünfte zusätzlich", async () => {
    const { basis } = await starte({ KLARWERK_M365_MANDANTEN: "klarwerktest4711" });
    const kopfzeilen = await kopf(basis, TASKPANE);
    expect(frameAncestors(kopfzeilen.get("content-security-policy"))).toBe(
      "frame-ancestors 'self' https://*.office.com https://*.officeapps.live.com " +
        "https://klarwerktest4711.sharepoint.com https://klarwerktest4711-my.sharepoint.com",
    );
    expect(kopfzeilen.get("x-frame-options")).toBeNull();
    // Query ändert den Scope nicht (dieselbe exakte Pfadregel wie bisher).
    const mitQuery = await kopf(basis, `${TASKPANE}?_host_Info=Word$Win32$16.01$de-DE`);
    expect(frameAncestors(mitQuery.get("content-security-policy"))).toBe(
      frameAncestors(kopfzeilen.get("content-security-policy")),
    );
  });
});

describe("E2 · ohne Eintrag zeichengleich; mehrere, doppelte und großgeschriebene Namen", () => {
  it("fehlt die Variable oder ist sie leer, ist die Direktive zeichengleich mit heute", async () => {
    for (const env of [{}, { KLARWERK_M365_MANDANTEN: "" }, { KLARWERK_M365_MANDANTEN: "  " }]) {
      const { basis, protokoll } = await starte(env);
      const kopfzeilen = await kopf(basis, TASKPANE);
      expect(frameAncestors(kopfzeilen.get("content-security-policy")), JSON.stringify(env)).toBe(
        HEUTE,
      );
      expect(protokoll.join("")).not.toContain("KLARWERK_M365_MANDANTEN");
    }
    expect(wordAddinFrameAncestors()).toBe(HEUTE);
    expect(wordAddinFrameAncestors([])).toBe(HEUTE);
  });

  it("a,b → je zwei Herkünfte in fester Reihenfolge; Dubletten einmal; Groß → klein", async () => {
    const { basis } = await starte({ KLARWERK_M365_MANDANTEN: "a, B ,b,A,a" });
    const kopfzeilen = await kopf(basis, TASKPANE);
    expect(frameAncestors(kopfzeilen.get("content-security-policy"))).toBe(
      [
        HEUTE,
        "https://a.sharepoint.com https://a-my.sharepoint.com",
        "https://b.sharepoint.com https://b-my.sharepoint.com",
      ].join(" "),
    );
    expect(leseM365Mandanten("Kunde-B,kunde-a,KUNDE-B")).toEqual({
      mandanten: ["kunde-b", "kunde-a"],
      verworfen: [],
    });
  });
});

describe("E3 · ungültige Namen werden verworfen, mit Grund protokolliert, nie ausgeliefert", () => {
  const LANG = "a".repeat(64);
  const UNGUELTIG = [
    "kunde.sharepoint.com",
    "*",
    "*.sharepoint.com",
    "kun de",
    "kunde/pfad",
    "kunde:8443",
    "nutzer@kunde",
    "https://kunde",
    LANG,
    "",
    "kündé",
    // Bens Befund E4 (Runde 1): diese drei kamen durch, ihre Herkünfte standen in der Direktive,
    // die Hostregel lehnte sie aber ab — Regel und Header liefen auseinander.
    "-",
    "-kunde",
    "kunde-",
  ];

  it("jede Form hat einen benannten Grund; gültige Namen daneben wirken weiter", () => {
    const { mandanten, verworfen } = leseM365Mandanten(
      ["gut", ...UNGUELTIG, "auch-gut", "a".repeat(63)].join(","),
    );
    expect(mandanten).toEqual(["gut", "auch-gut", "a".repeat(63)]);
    expect(verworfen.map((v) => v.eintrag)).toEqual(UNGUELTIG);
    const gruende = Object.fromEntries(verworfen.map((v) => [v.eintrag, v.grund]));
    expect(gruende["kunde.sharepoint.com"]).toContain("Punkt");
    expect(gruende["*"]).toContain("Platzhalter");
    expect(gruende["*.sharepoint.com"]).toContain("Platzhalter");
    expect(gruende["kun de"]).toContain("Leerraum");
    expect(gruende["kunde/pfad"]).toContain("Schrägstrich");
    expect(gruende["kunde:8443"]).toContain("Port");
    expect(gruende["nutzer@kunde"]).toContain("@");
    expect(gruende["https://kunde"]).toContain("Schema");
    expect(gruende[LANG]).toContain("63");
    expect(gruende[""]).toContain("leer");
    expect(gruende.kündé).toContain("Zeichen");
    for (const bindestrich of ["-", "-kunde", "kunde-"]) {
      expect(gruende[bindestrich], bindestrich).toContain("Bindestrich");
      expect(sharepointHerkuenfte([bindestrich]), bindestrich).toEqual([]);
    }
  });

  it("am Draht: nur der gültige Name erscheint; das Startprotokoll nennt jeden Verworfenen", async () => {
    const roh = ["klarwerktest4711", ...UNGUELTIG].join(",");
    const { basis, protokoll } = await starte({ KLARWERK_M365_MANDANTEN: roh });
    const direktive = frameAncestors((await kopf(basis, TASKPANE)).get("content-security-policy"));
    expect(direktive).toBe(
      `${HEUTE} https://klarwerktest4711.sharepoint.com https://klarwerktest4711-my.sharepoint.com`,
    );
    const warnungen = protokoll
      .map((zeile) => JSON.parse(zeile) as { level: number; msg: string })
      .filter((eintrag) => eintrag.level === 40)
      .map((eintrag) => eintrag.msg);
    expect(warnungen).toHaveLength(UNGUELTIG.length);
    for (const eintrag of UNGUELTIG) {
      expect(
        warnungen.some((w) => w.includes(`Eintrag ${JSON.stringify(eintrag)} verworfen — `)),
        eintrag,
      ).toBe(true);
    }
  });

  it("sharepointHerkuenfte lässt ungeprüfte Werte nicht durch (zweiter Riegel)", () => {
    expect(sharepointHerkuenfte(["*", "a.b", "x,y", "evil.tld/", "gut"])).toEqual([
      "https://gut.sharepoint.com",
      "https://gut-my.sharepoint.com",
    ]);
  });
});

describe("E4 · Regel = Header, auch mit Mandanten", () => {
  const MANDANTEN = ["klarwerktest4711"];

  it("WAHR genau für die zwei Herkünfte des eingetragenen Mandanten", () => {
    expect(
      istErlaubterEinbettungsHost("https://klarwerktest4711-my.sharepoint.com", MANDANTEN),
    ).toBe(true);
    expect(istErlaubterEinbettungsHost("https://klarwerktest4711.sharepoint.com", MANDANTEN)).toBe(
      true,
    );
    for (const boese of [
      "https://sharepoint.com",
      "https://fremd-my.sharepoint.com",
      "https://fremd.sharepoint.com",
      "https://klarwerktest4711-my.sharepoint.com.angreifer.tld",
      "https://xklarwerktest4711-my.sharepoint.com",
      "http://klarwerktest4711-my.sharepoint.com",
      "https://klarwerktest4711-my.sharepoint.com/",
      "https://klarwerktest4711-my.sharepoint.com:443",
      "https://www.klarwerktest4711.sharepoint.com",
    ]) {
      expect(istErlaubterEinbettungsHost(boese, MANDANTEN), boese).toBe(false);
    }
  });

  it("ohne Eintrag FALSCH für alle SharePoint-Herkünfte", () => {
    for (const herkunft of [
      "https://klarwerktest4711-my.sharepoint.com",
      "https://klarwerktest4711.sharepoint.com",
      "https://beliebig-my.sharepoint.com",
      "https://sharepoint.com",
    ]) {
      expect(istErlaubterEinbettungsHost(herkunft), herkunft).toBe(false);
      expect(istErlaubterEinbettungsHost(herkunft, []), herkunft).toBe(false);
    }
  });

  it("bestehende Fälle bleiben: office.com / officeapps.live.com WAHR, Familien FALSCH", () => {
    for (const mandanten of [[], MANDANTEN]) {
      expect(istErlaubterEinbettungsHost("https://word-edit.office.com", mandanten)).toBe(true);
      expect(
        istErlaubterEinbettungsHost("https://dec-word-edit.officeapps.live.com", mandanten),
      ).toBe(true);
      expect(istErlaubterEinbettungsHost("https://office.com", mandanten)).toBe(false);
      for (const familie of NICHT_FREIGEGEBENE_PLATTFORMFAMILIEN) {
        expect(istErlaubterEinbettungsHost(familie.beispiel, mandanten), familie.beispiel).toBe(
          false,
        );
      }
    }
    expect(NICHT_FREIGEGEBENE_PLATTFORMFAMILIEN.map((f) => f.familie)).toContain("sharepoint.com");
  });

  it("D3 mit Mandanten: jede Herkunft der AUSGELIEFERTEN Direktive beantwortet die Regel gleich", async () => {
    // Neben dem belegten Mandanten die ANGENOMMENEN Randfälle (ein Zeichen, Ziffer, Bindestrich
    // innen, doppelter Bindestrich, 63 Zeichen) und die VERWORFENEN Bindestrich-Randfälle aus
    // Bens Befund E4 — die Direktive darf nur die angenommenen tragen, und für jede ihrer
    // Herkünfte muss die Regel WAHR sagen.
    const angenommen = ["klarwerktest4711", "zweiter", "a", "0", "a-b", "a--b", "a".repeat(63)];
    const env = [...angenommen, "-", "-kunde", "kunde-"].join(",");
    const { basis } = await starte({ KLARWERK_M365_MANDANTEN: env });
    const mandanten = leseM365Mandanten(env).mandanten;
    expect(mandanten).toEqual(angenommen);
    const direktive = frameAncestors((await kopf(basis, TASKPANE)).get("content-security-policy"));
    const teile = (direktive ?? "").split(" ").filter((t) => t.startsWith("https://"));
    const platzhalter = teile.filter((t) => t.startsWith("https://*."));
    const exakt = teile.filter((t) => !t.includes("*"));
    // Kalibrierung: beide Arten sind wirklich da, und keine Herkunft bleibt ungemessen.
    expect(platzhalter.length).toBe(ERLAUBTE_EINBETTUNGS_HOSTS.length);
    expect(exakt).toEqual(sharepointHerkuenfte(angenommen));
    expect(exakt.length).toBe(2 * angenommen.length);
    expect(direktive).not.toContain("https://-");
    expect(direktive).not.toContain("--my.");
    expect(platzhalter.length + exakt.length).toBe(teile.length);
    for (const quelle of platzhalter) {
      const basisName = quelle.slice("https://*.".length);
      expect(istErlaubterEinbettungsHost(`https://${basisName}`, mandanten), quelle).toBe(false);
      expect(istErlaubterEinbettungsHost(`https://pruef.${basisName}`, mandanten), quelle).toBe(
        true,
      );
    }
    for (const herkunft of exakt) {
      // Exakte Herkunft: sie selbst WAHR, ein Vorsatz davor oder ein Suffix dahinter FALSCH.
      expect(istErlaubterEinbettungsHost(herkunft, mandanten), herkunft).toBe(true);
      const host = herkunft.slice("https://".length);
      expect(istErlaubterEinbettungsHost(`https://x${host}`, mandanten), host).toBe(false);
      expect(istErlaubterEinbettungsHost(`https://pruef.${host}`, mandanten), host).toBe(false);
      expect(istErlaubterEinbettungsHost(`${herkunft}.angreifer.tld`, mandanten), host).toBe(false);
    }
    // Jede exakte Herkunft gilt NUR mit ihrem eigenen Mandanten, nicht ohne Eintrag.
    for (const herkunft of exakt) {
      expect(istErlaubterEinbettungsHost(herkunft), herkunft).toBe(false);
    }
    // Und keine ausgeschlossene Familie steht als Platzhalter im Header.
    for (const familie of NICHT_FREIGEGEBENE_PLATTFORMFAMILIEN) {
      expect(direktive, familie.familie).not.toContain(`*.${familie.familie}`);
    }
  });
});

describe("E4 · Regel = Header für JEDEN Namen — angenommen heißt: jede Herkunft WAHR", () => {
  it("für jeden Kandidaten gilt: verworfen ⇒ keine Herkunft; angenommen ⇒ beide Herkünfte WAHR", () => {
    // Die Matrix, die Bens Befund E4 gefunden hätte: sie läuft über Randformen aller Art und
    // verlangt für JEDEN Namen dieselbe Antwort von Mandantenprüfung, Direktive und Hostregel.
    const kandidaten = [
      "a",
      "0",
      "ab",
      "a-b",
      "a--b",
      "xn--abc",
      "a".repeat(63),
      "a".repeat(64),
      "-",
      "--",
      "-a",
      "a-",
      "-a-",
      "a.b",
      "a_b",
      "A-B",
      " a ",
      "",
    ];
    for (const kandidat of kandidaten) {
      const { mandanten, verworfen } = leseM365Mandanten(kandidat);
      const herkuenfte = sharepointHerkuenfte([kandidat]);
      const direktive = wordAddinFrameAncestors([kandidat]);
      if (mandanten.length === 0) {
        expect(herkuenfte, kandidat).toEqual([]);
        expect(direktive, kandidat).toBe(HEUTE);
        // Leer heißt „kein Eintrag" und wird nicht als verworfen gemeldet; alles andere schon.
        expect(verworfen.length > 0 || kandidat === "", kandidat).toBe(true);
      } else {
        expect(herkuenfte, kandidat).toHaveLength(2);
        expect(direktive, kandidat).toBe(`${HEUTE} ${herkuenfte.join(" ")}`);
        for (const herkunft of herkuenfte) {
          expect(istErlaubterEinbettungsHost(herkunft, [kandidat]), herkunft).toBe(true);
        }
      }
    }
    // Kalibrierung: beide Zweige kommen wirklich vor — angenommen sind genau diese neun.
    expect(kandidaten.filter((k) => sharepointHerkuenfte([k]).length > 0)).toEqual([
      "a",
      "0",
      "ab",
      "a-b",
      "a--b",
      "xn--abc",
      "a".repeat(63),
      "A-B",
      " a ",
    ]);
  });
});

describe("E5 · nur der Taskpane-Pfad ändert sich — gemessen", () => {
  it("alle anderen Antworten behalten frame-ancestors 'none' und X-Frame-Options SAMEORIGIN", async () => {
    const { basis } = await starte({ KLARWERK_M365_MANDANTEN: "klarwerktest4711" });
    for (const pfad of ["/", "/api/health", "/word-addin/icon-32.png"]) {
      const kopfzeilen = await kopf(basis, pfad);
      const csp = kopfzeilen.get("content-security-policy") ?? "";
      expect(frameAncestors(csp), pfad).toBe("frame-ancestors 'none'");
      expect(csp, pfad).not.toContain("sharepoint");
      expect(kopfzeilen.get("x-frame-options"), pfad).toBe("SAMEORIGIN");
    }
    // Die Dialogseite ist top-level: sie behält ihre Ersatz-CSP OHNE Mandanten, zeichengleich.
    const dialog = await kopf(basis, ANMELDUNG);
    expect(frameAncestors(dialog.get("content-security-policy"))).toBe(HEUTE);
  });
});
