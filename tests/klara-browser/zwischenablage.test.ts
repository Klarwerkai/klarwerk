// ================================================================================================
// JOB 3280 · CHR-06/07 — DIE ZWISCHENABLAGE AUF KLICK, UND DERSELBE ENTWURF IN KLARWERK.
// ================================================================================================
//
// WAS HIER GEMESSEN WIRD, und woran es scheitern soll (Red-first-Vertrag §6 des Auftrags):
//
//   A  Die Leiste liest die Zwischenablage GENAU EINMAL und NUR auf Klick. Kein Lesen beim
//      Aufbau, keins beim Sprachwechsel, keins nebenher.
//   B  Der eingefügte Text steht in einem bearbeitbaren Feld; die Vorschau zieht mit, und die
//      Herkunft ist bei einem ChatGPT-Tab mit dessen NAMEN vorbelegt — aber nur vorgeschlagen.
//   B2 Auf einer normalen Seite gibt es keinen Vorschlag, und ohne Herkunftsangabe wird nicht
//      gespeichert (Knopf gesperrt, Worker verweigert).
//   C  Sichern legt GENAU EINEN Entwurf an; „In Klarwerk öffnen" führt auf dieselbe Kennung. Der
//      gespeicherte Körper nennt die Herkunft als ANGABE und den offenen Tab als Tab — die
//      Quellenliste trägt keine erfundene Adresse.
//   D  Eine Änderung NACH dem Sichern geht per PUT in denselben Entwurf: der Zähler bleibt 1, die
//      Kennung im Link bleibt dieselbe, und zwischen Änderung und Speichern steht statt eines
//      Links auf den überholten Stand die Rückfrage.
//   E  Eine gescheiterte Übergabe (verweigerte Zwischenablage, 403 beim Speichern) wird benannt,
//      und der eingefügte Text bleibt vollständig in der Leiste stehen.
//   F  DE↔EN wechselt live, ohne Text und Herkunft zu verlieren; der Öffnen-Link trägt die
//      aktuelle Sprache.
//   G  Die Linkprüfung der Leiste bleibt eng: `draft` und `lang=de|en` — jeder andere Host, Pfad,
//      Schlüssel oder Sprachwert bekommt KEIN href (Codex-Nachführung 08.09. 21:19).
//   H  Eine Erfassung, die WÄHREND eines laufenden Vorgangs eintrifft, wird nicht mehr still
//      verworfen, sondern danach verarbeitet (Codex-Nachführung 08.09. 21:08, Rest aus 3279 R3).
//   I  Ändert jemand denselben Entwurf in Klarwerk, während die Leiste ihn offen hat, gibt es 409
//      statt eines stillen Überschreibens — der fremde Stand bleibt, der eigene Text bleibt in der
//      Leiste, und es entsteht KEIN zweiter Entwurf (Codex-Nachführung 09.09. 00:21). In Runde 1
//      war dieser Weg gebaut, aber nur über den Serververtrag belegt; hier wird er gemessen.
//   J  Geht die Antwort des ERSTEN Speicherns verloren, entsteht auch nach einer Änderung kein
//      zweiter Entwurf: der unklare Vorgang wird zuerst geklärt (dieselbe Fassung, derselbe
//      Schlüssel), erst danach geht die Änderung per PUT hinein (bens Korrekturpflicht, Runde 2).
//
// DIE UMGEBUNG WIRD GESTELLT, NIE DER PRÜFLING: jsdom hat keine Zwischenablage, also bekommt das
// Fenster eine echte `navigator.clipboard.readText`. `worker.js`, `panel.js` und `i18n.js` laufen
// unverändert; hinter den Speicherwegen steht in C/D/E das echte Fastify.
import { afterEach, describe, expect, it } from "vitest";
import type { View } from "../../extensions/klara-browser/types";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { harness, read, verfahren } from "./harness";
import { type Knoten, mount, schliesseFenster } from "./panel-dom";

const CHATGPT = "https://chatgpt.com/c/2f0c-antwort";
const ANTWORT =
  "Ein Verbesserungsvorschlag aus dem Chat.\n\nZweiter Absatz mit Umlauten: Größe äöü.\nZeile im selben Absatz.";

// Dieselbe Aufräumregel wie in den Nachbardateien: jedes gemountete Fenster wird geschlossen.
afterEach(schliesseFenster);
/** Ein Durchlauf der Ereignisschleife — der Prüfstand wartet nie auf eine Uhr, nur auf Arbeit. */
const runde = () => new Promise<void>((done) => setTimeout(done, 0));

/** Das echte Klarwerk mit angemeldetem Konto — dieselbe Bauform wie in `package.test.ts`. */
async function echteApp() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Browser 3280", email: "b3280@example.test", password: "test-password-3280" },
  });
  const calls: { url: string; method: string; body: Record<string, unknown> | undefined }[] = [];
  let erzwungen = 0;
  let verlieren = false;
  const fetcher: typeof fetch = async (input, options) => {
    const url = String(input);
    // Das Verfahren wird durchgereicht, nicht umgeschrieben: seit CHR-07 gibt es `PUT`, und ein
    // Prüfstand, der ihn als GET absetzt, misst den Aktualisierungsweg gar nicht.
    const method = verfahren(options);
    calls.push({
      url,
      method,
      body: options?.body ? JSON.parse(String(options.body)) : undefined,
    });
    if (erzwungen && !url.endsWith("/login")) return new Response("{}", { status: erzwungen });
    const response = await app.inject({
      method,
      url: new URL(url).pathname,
      headers: options?.headers as Record<string, string>,
      ...(options?.body !== undefined ? { payload: String(options.body) } : {}),
    });
    // JOB 3280 R3: DER SERVER HAT GESCHRIEBEN, DIE ANTWORT KOMMT NICHT ZURÜCK. Genau dieser
    // Augenblick — Netz weg zwischen Schreiben und Antwort — ist der Fall, den bens Gegenprobe
    // aus Runde 2 gefunden hat. Er wird deshalb ECHT gestellt: die Route läuft vollständig, nur
    // ihre Antwort erreicht den Worker nie.
    if (verlieren && method === "POST" && url.endsWith("/api/drafts")) {
      verlieren = false;
      throw new Error("Antwort verloren");
    }
    return new Response(response.statusCode === 204 ? null : response.body, {
      status: response.statusCode,
    });
  };
  return {
    app,
    calls,
    fetcher,
    erzwinge: (status: number) => {
      erzwungen = status;
    },
    verliere: () => {
      verlieren = true;
    },
  };
}

type Bestand = { id: string; payload: Record<string, unknown> }[];

/** Die Leiste, gemountet vor einer ChatGPT-Seite, mit einer Zwischenablage im Fenster. */
async function leiste(
  optionen: { url?: string; text?: string; fehler?: boolean; echt?: boolean } = {},
) {
  const echt = optionen.echt ? await echteApp() : null;
  const h = harness(
    echt?.fetcher ??
      (async () => {
        throw new Error("kein Netz");
      }),
  );
  h.setSelected({ ...h.selected, url: optionen.url ?? CHATGPT, title: "ChatGPT" });
  const view = await mount({
    an: h,
    ...(optionen.fehler
      ? { zwischenablage: { fehler: true } }
      : { zwischenablage: { text: optionen.text ?? ANTWORT } }),
  });
  return { ...view, echt };
}

/** Anmelden am echten Klarwerk, direkt über den Worker (die Leiste hat dafür ihr eigenes Formular). */
async function anmelden(h: { send: (m: unknown) => Promise<View>; settle: () => Promise<void> }) {
  await h.send({
    type: "login",
    email: "b3280@example.test",
    password: "test-password-3280",
  });
  await h.settle();
}

/** Einfügen: der Klick, den Pflichtlieferung 1 verlangt. */
async function einfuegen(view: Awaited<ReturnType<typeof leiste>>) {
  view.el("paste").click();
  await view.settle();
  await view.settle();
}

async function bestaetigenUndSpeichern(view: Awaited<ReturnType<typeof leiste>>) {
  view.el("confirm").checked = true;
  view.el("confirm").dispatchEvent(new view.win.Event("change"));
  view.el("save").click();
  await view.settle();
}

const kennungVon = (knoten: Knoten) =>
  new URL(String(knoten.getAttribute("href"))).searchParams.get("draft");

describe("JOB 3280 · CHR-06 — die Zwischenablage wird nur auf Klick gelesen", () => {
  it("A · beim Aufbau und beim Sprachwechsel liest niemand; ein Klick liest GENAU einmal", async () => {
    const view = await leiste();
    // Der gefährlichste Augenblick zuerst: die Leiste ist fertig aufgebaut, hat gerendert, den
    // Zustand geholt und die gespeicherte Sprache gelesen. Bis hierher darf NICHTS gelesen sein.
    expect(view.leseZaehler(), "die Leiste hat beim Aufbau in die Zwischenablage gesehen").toBe(0);
    view.sprache("en");
    view.sprache("de");
    await view.settle();
    expect(view.leseZaehler(), "ein Sprachwechsel hat gelesen").toBe(0);

    await einfuegen(view);
    expect(view.leseZaehler(), "ein Klick liest nicht genau einmal").toBe(1);
    expect(view.el("clipboard").value).toBe(ANTWORT);
    expect(view.el("mode-clipboard").checked).toBe(true);
    expect(view.plain("content")).toContain("Ein Verbesserungsvorschlag aus dem Chat.");
    expect(view.plain("content")).toContain("Zeile im selben Absatz.");
  });

  it("A2 · `readText` steht in der ganzen Leiste GENAU EINMAL, und zwar in einem Klickzuhörer", () => {
    // Der Zähler oben misst EINEN Lauf. Dieser Pin misst die Bauform: ein zweiter Aufrufer
    // (Fokuswechsel, Zeitgeber, Aufbau) wäre ein Dauerleser fremder Zwischenablagen.
    // Gezählt wird der CODE, nicht die Erklärung: die Kommentare dieser Stelle benennen die
    // Zusage ausdrücklich und dürfen es weiter tun. Wörter aus einem Kommentar zu streichen, um
    // einem Sensor auszuweichen, wäre die schlechtere Antwort.
    const panelJs = read("panel.js");
    const code = panelJs.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|\s)\/\/[^\n]*/g, "$1");
    expect([...code.matchAll(/clipboard\.readText/g)]).toHaveLength(1);
    const stelle = code.indexOf("clipboard.readText");
    const davor = code.slice(0, stelle);
    expect(davor.slice(davor.lastIndexOf('addEventListener("'))).toContain(
      'addEventListener("click"',
    );
    // Kein Dauerrecht im Manifest: ohne `clipboardRead` fragt Chrome bei jedem neuen Konto nach.
    expect(JSON.parse(read("manifest.json")).permissions).not.toContain("clipboardRead");
  });

  it("B · der Text ist bearbeitbar, und bei einem ChatGPT-Tab ist die Herkunft vorbelegt", async () => {
    const view = await leiste();
    await einfuegen(view);
    expect(view.el("origin-box").hidden, "die Herkunftswahl ist nicht sichtbar").toBe(false);
    expect(view.el("origin").value).toBe("ki_chat");
    // Der Name kommt vom HOST des erfassten Tabs, nicht aus einer Liste im Kopf.
    expect(view.el("origin-ki").textContent).toBe("KI-Chat, ungeprüft (chatgpt.com)");

    // Bearbeiten: die Vorschau ist danach der NEUE Text, nicht der eingefügte.
    view.input("clipboard", "Von Hand gekürzt.\n\nUnd ein zweiter Absatz.");
    await view.settle();
    expect(view.plain("content")).toContain("Von Hand gekürzt.");
    expect(view.plain("content")).not.toContain("Ein Verbesserungsvorschlag aus dem Chat.");
    expect(view.leseZaehler(), "das Bearbeiten hat erneut gelesen").toBe(1);
  });

  it("B2 · auf einer normalen Seite gibt es keinen Vorschlag, und ohne Herkunft wird nichts gespeichert", async () => {
    const view = await leiste({ url: "https://docs.example.test/handbuch", echt: true });
    await anmelden(view);
    await einfuegen(view);
    expect(view.el("origin").value, "eine Herkunft wurde ohne Beleg vorbelegt").toBe("");
    expect(view.el("origin-ki").textContent).toBe("KI-Chat, ungeprüft");
    view.input("title", "Aus der Ablage");
    await view.settle();
    view.el("confirm").checked = true;
    view.el("confirm").dispatchEvent(new view.win.Event("change"));
    expect(view.el("save").disabled, "Speichern ohne Herkunftsangabe war möglich").toBe(true);

    // Und der Worker verlässt sich nicht auf die Fläche: dieselbe Grenze gilt an der Nachricht.
    const antwort = await view.send({
      type: "save",
      form: { title: "Aus der Ablage", context: "", confidentiality: "", origin: "" },
    });
    expect(antwort.status).toBe("origin_missing");
    expect(view.echt?.calls.filter((c) => c.url.endsWith("/api/drafts"))).toEqual([]);
    await view.echt?.app.close();
  });
});

describe("JOB 3280 · CHR-07 — ein Vorgang, ein Entwurf, derselbe Link", () => {
  it("C · Sichern legt genau einen Entwurf an; der Link führt auf dessen Kennung", async () => {
    const view = await leiste({ echt: true });
    await anmelden(view);
    await einfuegen(view);
    view.input("title", "Vorschlag aus dem Chat");
    await view.settle();
    await bestaetigenUndSpeichern(view);

    expect(view.el("status").textContent).toContain("Als ungeprüfter Entwurf gespeichert");
    expect(view.el("open").hidden).toBe(false);
    const kennung = kennungVon(view.el("open"));
    expect(view.el("open").getAttribute("href")).toBe(
      `https://app.klarwerk.ai/capture/frontdoor?draft=${kennung}&lang=de`,
    );

    const kopf = { authorization: `Bearer ${(view.data.auth as { token: string }).token}` };
    const bestand = (
      await view.echt!.app.inject({ method: "GET", url: "/api/drafts", headers: kopf })
    ).json() as Bestand;
    expect(bestand.map((d) => d.id)).toEqual([kennung]);
    const koerper = String(bestand[0]?.payload.bodyHtml);
    // DIE HERKUNFT IST EINE ANGABE, und sie steht als solche da — mit dem Namen des Chats.
    expect(koerper).toContain(
      "Herkunft (Angabe der Person) / Origin (stated by the person): KI-Chat, ungeprüft / AI chat, unverified (chatgpt.com)",
    );
    // Der Tab heisst „Tab", nicht „Quelle" — er ist nicht die Herkunft des Textes. Und er ist auf
    // den Augenblick datiert, den die Leiste WIRKLICH gemessen hat: die Erfassung. „beim Einfügen"
    // stand hier bis R2 und war beim Tabwechsel eine ungemessene Behauptung (Codex 3683da57).
    expect(koerper).toContain(
      `Bei der Erfassung verwendeter Tab / Tab used at capture: ${CHATGPT}`,
    );
    expect(koerper).not.toContain("beim Einfügen");
    expect(koerper).not.toContain("Ursprüngliche Quelle");
    expect(koerper).toContain("Umfang / Scope: Zwischenablage / Clipboard");
    expect(koerper).toContain("Ein Verbesserungsvorschlag aus dem Chat.");
    // Und in der Quellenliste steht KEINE erfundene Adresse.
    const quellen = bestand[0]?.payload.pendingSources as { label: string; url?: string }[];
    expect(quellen[0]?.label).toBe("Zwischenablage / Clipboard");
    expect(quellen[0]?.url).toBeUndefined();
    await view.echt!.app.close();
  });

  it("D · eine Änderung nach dem Sichern geht per PUT in denselben Entwurf; dazwischen steht die Rückfrage", async () => {
    const view = await leiste({ echt: true });
    await anmelden(view);
    await einfuegen(view);
    view.input("title", "Vorschlag aus dem Chat");
    await view.settle();
    await bestaetigenUndSpeichern(view);
    const kennung = kennungVon(view.el("open"));

    // Die Änderung. Solange sie ungesichert ist, gibt es KEINEN Link auf den überholten Stand.
    view.input("title", "Vorschlag, überarbeitet");
    await view.settle();
    expect(view.el("status").textContent).toContain(
      "Änderungen gehen beim Speichern in denselben Entwurf",
    );
    expect(view.el("open").hidden, "der Link zeigte auf den überholten Stand").toBe(true);
    expect(view.el("open-stale").hidden, "die Rückfrage fehlt").toBe(false);

    await bestaetigenUndSpeichern(view);
    expect(view.el("status").textContent).toContain("Änderungen im selben Entwurf gespeichert");
    expect(view.el("open").hidden).toBe(false);
    expect(kennungVon(view.el("open")), "die zweite Fassung bekam eine andere Kennung").toBe(
      kennung,
    );

    // DER ZÄHLER: ein Entwurf, nicht zwei — mit dem NEUEN Titel.
    const kopf = { authorization: `Bearer ${(view.data.auth as { token: string }).token}` };
    const bestand = (
      await view.echt!.app.inject({ method: "GET", url: "/api/drafts", headers: kopf })
    ).json() as Bestand;
    expect(bestand.map((d) => d.id)).toEqual([kennung]);
    expect(bestand[0]?.payload.title).toBe("Vorschlag, überarbeitet");
    // Genau ein POST auf `/api/drafts`, danach nur noch PUT auf die eine Kennung.
    const anlagen = view.echt!.calls.filter((c) => c.url.endsWith("/api/drafts"));
    expect(anlagen.map((c) => c.method)).toEqual(["POST"]);
    const fassungen = view.echt!.calls.filter(
      (c) => c.method === "PUT" && c.url.endsWith(`/api/drafts/${kennung}`),
    );
    expect(fassungen).toHaveLength(1);
    expect("operationId" in (fassungen[0]?.body ?? {})).toBe(false);
    await view.echt!.app.close();
  });

  it("E · verweigerte Zwischenablage und abgelehnte Übergabe werden benannt — der Text bleibt", async () => {
    const verweigert = await leiste({ fehler: true });
    verweigert.el("paste").click();
    await verweigert.settle();
    expect(verweigert.el("status").textContent).toContain(
      "Die Zwischenablage wurde nicht freigegeben",
    );
    expect(verweigert.el("status").className).toBe("crit");

    const view = await leiste({ echt: true });
    await anmelden(view);
    await einfuegen(view);
    view.input("title", "Vorschlag aus dem Chat");
    await view.settle();
    view.echt!.erzwinge(403);
    await bestaetigenUndSpeichern(view);
    expect(view.el("status").textContent).toContain("Zugriff abgelehnt (403)");
    // DER TEXT BLEIBT — im Feld und in der Vorschau, vollständig.
    expect(view.el("clipboard").value).toBe(ANTWORT);
    expect(view.plain("content")).toContain("Ein Verbesserungsvorschlag aus dem Chat.");
    expect(view.el("origin").value).toBe("ki_chat");
    await view.echt!.app.close();
  });

  it("F · DE↔EN wechselt live; Text, Herkunft und Vorschau bleiben, der Link trägt die Sprache", async () => {
    const view = await leiste({ echt: true });
    await anmelden(view);
    await einfuegen(view);
    view.input("title", "Vorschlag aus dem Chat");
    await view.settle();
    await bestaetigenUndSpeichern(view);
    const kennung = kennungVon(view.el("open"));

    for (const sprache of ["en", "de", "en"]) {
      view.sprache(sprache);
      expect(view.win.document.documentElement.lang).toBe(sprache);
      expect(view.el("clipboard").value, `${sprache}: der eingefügte Text ging verloren`).toBe(
        ANTWORT,
      );
      expect(view.el("origin").value, `${sprache}: die Herkunftsangabe ging verloren`).toBe(
        "ki_chat",
      );
      expect(view.plain("content")).toContain("Ein Verbesserungsvorschlag aus dem Chat.");
      expect(view.el("paste").textContent).toBe(
        sprache === "de" ? "Aus Zwischenablage einfügen" : "Paste from clipboard",
      );
      expect(view.el("open").getAttribute("href")).toBe(
        `https://app.klarwerk.ai/capture/frontdoor?draft=${kennung}&lang=${sprache}`,
      );
    }
    await view.echt!.app.close();
  });
});

describe("JOB 3280 · CHR-07 — die Linkprüfung der Leiste bleibt eng", () => {
  const sicht = (link: string): View => ({
    status: "saved",
    captureId: "c-1",
    draftId: "d-1",
    link,
    selection: {
      text: "Text",
      title: "ChatGPT",
      url: CHATGPT,
      capturedAt: "2026-09-08T12:00:00.000Z",
      tabId: 7,
    },
    mode: "clipboard",
    form: { title: "T", context: "", confidentiality: "", origin: "ki_chat" },
    user: { id: "person-a", email: "a@example.test" },
  });

  it.each([
    ["fremder Host", "https://evil.test/capture/frontdoor?draft=d-1"],
    ["fremder Pfad", "https://app.klarwerk.ai/erfassen?draft=d-1"],
    ["zusätzlicher Schlüssel", "https://app.klarwerk.ai/capture/frontdoor?draft=d-1&next=%2Fweg"],
    ["fremde Sprache", "https://app.klarwerk.ai/capture/frontdoor?draft=d-1&lang=fr"],
    ["Fragment", "https://app.klarwerk.ai/capture/frontdoor?draft=d-1#dort"],
    ["leere Kennung", "https://app.klarwerk.ai/capture/frontdoor?draft="],
    ["Kennung mit Sonderzeichen", "https://app.klarwerk.ai/capture/frontdoor?draft=a%2Fb"],
    [
      "doppelter Schlüssel",
      "https://app.klarwerk.ai/capture/frontdoor?draft=d-1&draft=d-2&lang=de",
    ],
  ])("G · %s bekommt kein href", async (_name, link) => {
    const view = await mount({ antwortet: async () => sicht(link) });
    expect(view.el("open").hasAttribute("href")).toBe(false);
    expect(view.el("open").hidden).toBe(true);
    // Es gibt einen Entwurf — also steht die Rückfrage da, nicht Schweigen.
    expect(view.el("open-stale").hidden).toBe(false);
  });

  it("G2 · `draft` mit `lang=en` ist erlaubt und wird auf die Sprache der Leiste gesetzt", async () => {
    const view = await mount({
      antwortet: async () => sicht("https://app.klarwerk.ai/capture/frontdoor?draft=d-1&lang=en"),
    });
    expect(view.el("open").getAttribute("href")).toBe(
      "https://app.klarwerk.ai/capture/frontdoor?draft=d-1&lang=de",
    );
    view.sprache("en");
    expect(view.el("open").getAttribute("href")).toBe(
      "https://app.klarwerk.ai/capture/frontdoor?draft=d-1&lang=en",
    );
  });
});

describe("JOB 3280 — eine Erfassung während eines laufenden Vorgangs geht nicht verloren", () => {
  it("H · die Übernahme trifft ein, während der Worker arbeitet, und erscheint danach", async () => {
    // Der Vorgang wird ANGEHALTEN, nicht simuliert: die Anmeldung hängt an einer Antwort, die
    // erst der Fall selbst freigibt. Genau in diesem Fenster kommt der Rechtsklick.
    let frei = () => {};
    const gehalten = new Promise<void>((los) => {
      frei = los;
    });
    const h = harness(async (input) => {
      if (String(input).endsWith("/login")) {
        await gehalten;
        return Response.json({
          token: "fixture-session-secret",
          user: { id: "person-a", email: "a@example.test" },
        });
      }
      throw new Error("kein Netz");
    });
    const laeuft = h.send({ type: "login", email: "a@example.test", password: "x" });
    // Der Worker sitzt jetzt an der Anmeldung. Die Erfassung trifft mitten hinein.
    await runde();
    await h.capture();
    expect(h.data.work, "die Erfassung lief, obwohl der Worker gesperrt war").toBeUndefined();

    frei();
    expect((await laeuft).status).toBe("no_selection");
    // Und JETZT wird sie nachgeholt — ohne dass jemand ein zweites Mal klicken musste.
    await runde();
    await runde();
    const zustand = await h.send({ type: "state" });
    expect(zustand.status, "die Erfassung wurde still verworfen").toBe("preview");
    expect(zustand.selection?.text).toBe(h.selected.text);
  });
});

describe("JOB 3280 · CHR-07 — derselbe Entwurf, gleichzeitig in Klarwerk geändert", () => {
  it("I · der fremde Stand gewinnt nicht still: 409, fremder Inhalt bleibt, eigener Text bleibt", async () => {
    const view = await leiste({ echt: true });
    await anmelden(view);
    await einfuegen(view);
    view.input("title", "Vorschlag aus dem Chat");
    await view.settle();
    await bestaetigenUndSpeichern(view);
    const kennung = kennungVon(view.el("open"));
    const kopf = { authorization: `Bearer ${(view.data.auth as { token: string }).token}` };

    // DIE FREMDE ÄNDERUNG — nicht erfunden, sondern über die echte Route, so wie Klarwerk selbst
    // sie schreibt: derselbe Entwurf, anderes Fenster, ohne dass die Leiste davon erfährt.
    const fremd = await view.echt!.app.inject({
      method: "PUT",
      url: `/api/drafts/${kennung}`,
      headers: kopf,
      payload: { title: "In Klarwerk umbenannt", context: "Dort ergänzt." },
    });
    expect(fremd.statusCode, "die fremde Änderung ging gar nicht durch").toBe(200);

    // Und jetzt speichert die Leiste ihre eigene Fassung — auf einem Stand, den es nicht mehr gibt.
    view.input("clipboard", "Von Hand gekürzt, nur in der Leiste.");
    await view.settle();
    await bestaetigenUndSpeichern(view);

    expect(view.el("status").textContent).toContain("Konflikt (409)");
    expect(view.el("status").className).toBe("crit");
    // Kein Link auf einen Stand, den die Leiste nicht geschrieben hat — dafür die Rückfrage.
    expect(view.el("open").hidden, "ein Link behauptete einen gespeicherten Stand").toBe(true);
    expect(view.el("open-stale").hidden).toBe(false);

    // NICHTS ÜBERSCHRIEBEN: der fremde Stand steht unverändert im Bestand.
    const bestand = (
      await view.echt!.app.inject({ method: "GET", url: "/api/drafts", headers: kopf })
    ).json() as Bestand;
    expect(
      bestand.map((d) => d.id),
      "es entstand ein zweiter Entwurf",
    ).toEqual([kennung]);
    expect(bestand[0]?.payload.title).toBe("In Klarwerk umbenannt");
    expect(String(bestand[0]?.payload.bodyHtml)).not.toContain("Von Hand gekürzt");

    // UND DER EIGENE TEXT IST NICHT WEG: er steht vollständig in der Leiste, samt Herkunft.
    expect(view.el("clipboard").value).toBe("Von Hand gekürzt, nur in der Leiste.");
    expect(view.plain("content")).toContain("Von Hand gekürzt, nur in der Leiste.");
    expect(view.el("title").value).toBe("Vorschlag aus dem Chat");
    expect(view.el("origin").value).toBe("ki_chat");

    // KEIN AUSWEICHEN AUF EINEN NEUEN POST: genau eine Anlage, danach nur PUT auf dieselbe Kennung.
    const gesendet = view.echt!.calls.filter((c) => c.url.includes("/api/drafts"));
    expect(gesendet.map((c) => `${c.method} ${new URL(c.url).pathname}`)).toEqual([
      "POST /api/drafts",
      `PUT /api/drafts/${kennung}`,
    ]);
    // Der Stand, den die Leiste zuletzt gesehen hatte, reiste mit — sonst hätte der Server gar
    // nicht prüfen können und der spätere Schreiber hätte still gewonnen.
    expect(typeof gesendet[1]?.body?.expectedUpdatedAt).toBe("string");
    await view.echt!.app.close();
  });
});

// ==================================================================================================
// JOB 3280 · RUNDE 3 — DIE VERLORENE ANTWORT DES ERSTEN SPEICHERNS.
// ==================================================================================================
//
// DER BEFUND AUS RUNDE 2 (ben, eigene Gegenprobe): der Schutz „ein Vorgang, ein Entwurf" hing an
// einer Antwort. Kam sie nicht an, blieb die Entwurfskennung leer — und die nächste Bearbeitung
// erzeugte einen neuen Abdruck, einen neuen Vorgangsschlüssel und einen ZWEITEN Entwurf im
// Bestand (`to have a length of 1 but got 2`). Genau dieser Weg wird hier gemessen, an der
// gemounteten Leiste und am echten Klarwerk dahinter.
describe("JOB 3280 · CHR-07 — eine verlorene Antwort erzeugt keinen zweiten Entwurf", () => {
  it("J · der unklare Vorgang wird zuerst geklärt, die Änderung geht danach in denselben Entwurf", async () => {
    const view = await leiste({ echt: true });
    await anmelden(view);
    await einfuegen(view);
    view.input("title", "Vorschlag aus dem Chat");
    await view.settle();

    // Der Server legt an; die Antwort erreicht die Leiste nie.
    view.echt!.verliere();
    await bestaetigenUndSpeichern(view);
    expect(view.el("status").textContent).toContain("Offline oder Antwort unklar");
    // DER TEXT BLEIBT — vollständig, samt Herkunft. Bis der Vorgang geklärt ist, ist der INHALT
    // aber nicht änderbar: eine andere Fassung liesse sich nicht mehr als derselbe Vorgang
    // wiederholen, und der Ausweg wäre wieder ein zweiter Entwurf.
    expect(view.el("clipboard").value).toBe(ANTWORT);
    expect(view.el("origin").value).toBe("ki_chat");
    expect(view.el("clipboard").disabled, "der Inhalt blieb änderbar").toBe(true);
    expect(view.el("paste").disabled, "ein zweites Einfügen war möglich").toBe(true);

    // Die Angaben bleiben bearbeitbar — und die Zeile sagt, was das nächste Sichern tun wird.
    view.input("title", "Vorschlag, nach dem Aussetzer");
    await view.settle();
    expect(view.el("status").textContent).toContain("unbestätigt");
    // Der Weg zur Klärung steht offen: bestätigen, speichern — kein Verwerfen nötig.
    view.el("confirm").checked = true;
    view.el("confirm").dispatchEvent(new view.win.Event("change"));
    expect(view.el("save").disabled, "das Klären war gar nicht möglich").toBe(false);
    view.el("save").click();
    await view.settle();
    expect(view.el("status").textContent).toContain("Änderungen im selben Entwurf gespeichert");
    const kennung = kennungVon(view.el("open"));

    // DER ZÄHLER: ein Entwurf, mit dem NEUEN Titel.
    const kopf = { authorization: `Bearer ${(view.data.auth as { token: string }).token}` };
    const bestand = (
      await view.echt!.app.inject({ method: "GET", url: "/api/drafts", headers: kopf })
    ).json() as Bestand;
    expect(
      bestand.map((d) => d.id),
      "es entstand ein zweiter Entwurf",
    ).toEqual([kennung]);
    expect(bestand[0]?.payload.title).toBe("Vorschlag, nach dem Aussetzer");

    // Die Wiederholung war ZEICHENGLEICH die verlorene Sendung — nur so antwortet der Server mit
    // demselben Entwurf statt mit einem zweiten. Danach genau ein PUT auf dieselbe Kennung.
    const anlagen = view.echt!.calls.filter(
      (c) => c.method === "POST" && c.url.endsWith("/api/drafts"),
    );
    expect(anlagen).toHaveLength(2);
    expect(anlagen[1]?.body).toEqual(anlagen[0]?.body);
    const fassungen = view.echt!.calls.filter(
      (c) => c.method === "PUT" && c.url.endsWith(`/api/drafts/${kennung}`),
    );
    expect(fassungen).toHaveLength(1);
    expect(fassungen[0]?.body?.title).toBe("Vorschlag, nach dem Aussetzer");
    await view.echt!.app.close();
  });
});
