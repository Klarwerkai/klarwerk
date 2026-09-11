// ==================================================================================================
// JOB 3606 — KLARA IM BROWSER TRÄGT: die drei Befunde vom 11.09., als Prüfung.
// ==================================================================================================
//
// Pedi hat an diesem Tag zweimal selbst gefunden, was hier gemessen wird:
//   (a) Bildbeleg 14:23 — „Markierung · nicht vorhanden", obwohl Text markiert war.
//   (b) Bildbeleg 14:20 — Chrome stand auf `manageengine.com/…/configure-cisco-router.html`,
//       die Leiste zeigte den Inhalt eines ChatGPT-Verlaufs über `advisor.nl`.
//   (c) „Der Server hat abgelehnt. Angaben prüfen." — der Satz, der nicht sagt, WELCHE Angabe.
//
// (a) und (b) sind EIN Fehler: `capture()` kehrte bei vorhandenem `state.work` zurück, BEVOR die
// Seite gelesen wurde (`worker.js`, das stumme `return` vor `executeScript`). Die neue Markierung
// wurde also nie geholt, und der alte Stand blieb stehen. Die Fälle unten messen genau das — nicht
// die Symptome an der Oberfläche, sondern den Zustand, aus dem die Oberfläche entsteht.
//
// Der Prüfstand ist der bestehende Worker-Prüfstand aus `tests/klara-browser/harness.ts`: echter
// `worker.js` in einem eigenen Kontext, gestellter Chrome-Anschluss. Kein zweiter Prüfstand.
//
// SEINE EINE GRENZE, hier ausdrücklich genannt: `chrome.scripting.executeScript` ist gestellt und
// erwartet Tab 7. Ein Wechsel auf einen ANDEREN Tab lässt sich damit nicht fahren; die Fälle unten
// wechseln deshalb die SEITE (Adresse und Titel) im selben Tab. Für `capture()` ist das derselbe
// Weg — es liest `info?.frameUrl ?? info?.pageUrl ?? tab?.url` und den Titel aus dem Tab, nicht die
// Tabnummer. Was am ECHTEN Browser gemessen wurde, steht in der Rückgabe, nicht hier.
import { setImmediate } from "node:timers";
import { beforeEach, describe, expect, it } from "vitest";
import type { View } from "../../extensions/klara-browser/types";
import { harness, plainVariants } from "../klara-browser/harness";

type Sicht = View & {
  canCapture?: boolean;
  pendingSource?: { url: string; title: string };
  reason?: string;
};

const ADVISOR = {
  url: "https://chatgpt.com/c/advisor-nl",
  title: "advisor.nl — Verlauf",
  text: "Der alte Verlauf über advisor.nl.",
};
const CISCO = {
  url: "https://www.manageengine.com/network-configuration-manager/configure-cisco-router.html",
  title: "Configure Cisco router",
  text: "So wird ein Cisco-Router konfiguriert.",
};

/** Der Prüfstand mit einer bereits übernommenen Seite — der Ausgangspunkt beider Befunde. */
async function mitOffenerUebernahme() {
  const h = harness(async () => Response.json(null, { status: 200 }));
  h.setSelected({ ...ADVISOR, variants: plainVariants(ADVISOR.text) });
  await h.capture();
  return h;
}

/** Eine zweite Übernahme auf einer ANDEREN Seite, im selben Tab (s. Grenze oben). */
async function zweiteUebernahme(h: ReturnType<typeof harness>, seite = CISCO) {
  h.setSelected({ ...seite, variants: plainVariants(seite.text) });
  await h.listeners.action?.({ id: 7, url: seite.url, title: seite.title });
}

describe("JOB 3606 (a)+(b) · eine neue Übernahme verschwindet nicht mehr stumm", () => {
  let h: ReturnType<typeof harness>;
  beforeEach(async () => {
    h = await mitOffenerUebernahme();
  });

  it("hält die offene Übernahme — und NENNT die Seite, die wartet", async () => {
    const vorher = (await h.send({ type: "state" })) as Sicht;
    expect(vorher.selection?.url).toBe(ADVISOR.url);

    await zweiteUebernahme(h);
    const sicht = (await h.send({ type: "state" })) as Sicht;

    // Die Absicht der alten Zeile bleibt: die begonnene Übernahme wird NICHT überschrieben.
    expect(sicht.selection?.url).toBe(ADVISOR.url);
    expect(sicht.selection?.title).toBe(ADVISOR.title);
    // Neu und der Kern des Auftrags: der Mensch erfährt davon, und WELCHE Seite wartet. Ohne diese
    // Angabe stand in der Leiste ein Satz über nichts Greifbares.
    expect(sicht.pendingCapture).toBe(true);
    expect(sicht.pendingSource).toEqual({ url: CISCO.url, title: CISCO.title });
  });

  it("„übernehmen und ersetzen“ liest die WARTENDE Seite, nicht die alte", async () => {
    await zweiteUebernahme(h);
    const sicht = (await h.send({ type: "recapture" })) as Sicht;

    // Genau der Befund (b): vorher hätte `recapture` den Tab der ALTEN Übernahme gelesen und die
    // Leiste wäre auf advisor.nl stehengeblieben, während Chrome auf der Cisco-Seite stand.
    expect(sicht.selection?.url).toBe(CISCO.url);
    expect(sicht.selection?.title).toBe(CISCO.title);
    // Und der Befund (a): die Markierung dieser Seite ist da, nicht „nicht vorhanden".
    expect(sicht.variants?.selection.available).toBe(true);
    expect(sicht.variants?.selection.text).toBe(CISCO.text);
    expect(sicht.mode).toBe("selection");
    // Die Nachfrage ist beantwortet und steht nicht weiter herum.
    expect(sicht.pendingCapture).toBe(false);
    expect(sicht.pendingSource).toBeUndefined();
  });

  it("„offene Übernahme behalten“ legt nur die Nachfrage weg und sendet nichts", async () => {
    await zweiteUebernahme(h);
    const sicht = (await h.send({ type: "keep" })) as Sicht;

    expect(sicht.pendingCapture).toBe(false);
    expect(sicht.pendingSource).toBeUndefined();
    // Der offene Vorgang ist unangetastet — dasselbe Stück Arbeit, dieselbe Kennung.
    expect(sicht.selection?.url).toBe(ADVISOR.url);
    expect(sicht.captureId).toBe((h.data.work as { id: string }).id);
  });

  it("ein FERTIGER Vorgang blockiert die nächste Übernahme nicht mehr", async () => {
    // Fertig heisst: angelegt, frisch nachgelesen, bestätigt (`draftId` gesetzt, Status `saved`) —
    // der Entwurf lebt auf dem Server und wird von einer neuen Übernahme nicht angefasst. Genau
    // diese Lage zeigt Pedis Bildschirmfoto vom 10.09. 09.18.36, und sie hielt die Leiste fest.
    const work = h.data.work as Record<string, unknown>;
    work.status = "saved";
    work.draftId = "draft-test";
    work.pendingCreate = null;

    await zweiteUebernahme(h);
    const sicht = (await h.send({ type: "state" })) as Sicht;

    expect(sicht.pendingCapture).toBe(false);
    expect(sicht.selection?.url).toBe(CISCO.url);
    expect(sicht.variants?.selection.available).toBe(true);
  });
});

describe("JOB 3606 (b) · der Tabwechsel geht nicht mehr verloren", () => {
  it("meldet die fremde Herkunft auch, wenn der Wechsel WÄHREND eines Vorgangs geschah", async () => {
    // DER FALL, DEN DER ALTE MERKER NICHT FASSEN KONNTE. `changed()` stieg bei `busy` aus, OHNE
    // irgendetwas festzuhalten: wer den Tab wechselte, während die Leiste am Netz hing, dessen
    // Wechsel war danach nicht mehr nachweisbar — und die Leiste zeigte den fremden Inhalt weiter,
    // als gehörte er zur offenen Seite. Der Vorgang wird hier ECHT angehalten (eine Antwort, die
    // erst auf Zuruf kommt), nicht nachgestellt: nur so liegt die Sperre wirklich.
    const halt: { frei?: (antwort: Response) => void } = {};
    let erste = true;
    const h = harness(async () => {
      if (!erste) return Response.json(null, { status: 200 });
      erste = false;
      return new Promise<Response>((fertig) => {
        halt.frei = fertig;
      });
    });
    h.setSelected({ ...ADVISOR, variants: plainVariants(ADVISOR.text) });
    await h.capture();
    // Eine Quittung lässt `stateView` den Entwurf nachlesen — und genau dabei hält es `busy`.
    // Die Anmeldung steht direkt im Sitzungszustand: ein Anmeldeweg über das Netz würde die eine
    // angehaltene Antwort verbrauchen, um die es hier geht.
    h.data.auth = { token: "fixture-session-secret", id: "person-a", email: "a@example.test" };
    (h.data.work as Record<string, unknown>).receipt = "draft-test";
    const laeuft = h.send({ type: "state" });
    await new Promise((weiter) => setImmediate(weiter));

    // Genau JETZT wechselt Pedi den Tab.
    await h.listeners.activated?.({ tabId: 42 });
    // Ohne diese Zusicherung liefe der Fall auch dann grün, wenn gar nichts angehalten worden wäre.
    expect(typeof halt.frei).toBe("function");
    halt.frei?.(Response.json(null, { status: 200 }));
    await laeuft;

    const sicht = (await h.send({ type: "state" })) as Sicht;
    expect(sicht.selection?.url).toBe(ADVISOR.url);
    expect(sicht.sourceChanged).toBe(true);
  });

  it("meldet KEINE fremde Herkunft, solange der Tab der Übernahme aktiv ist", async () => {
    const h = await mitOffenerUebernahme();
    await h.listeners.activated?.({ tabId: 7 });
    const sicht = (await h.send({ type: "state" })) as Sicht;

    expect(sicht.sourceChanged).toBe(false);
  });
});

describe("JOB 3606 (c) · der Grund der Abweisung kommt beim Menschen an", () => {
  /** Ein Prüfstand, dessen Anlegeweg mit 400 und einer Meldung antwortet — wie die echte Route. */
  async function mitAbweisung(koerper: unknown, status = 400) {
    const h = harness(async (url, options) => {
      if (String(url).endsWith("/login"))
        return Response.json({
          token: "fixture-session-secret",
          user: { id: "person-a", email: "a@example.test" },
        });
      if (options?.method === "POST") return Response.json(koerper, { status });
      return Response.json(null, { status: 200 });
    });
    h.setSelected({ ...ADVISOR, variants: plainVariants(ADVISOR.text) });
    await h.capture();
    await h.send({ type: "login", email: "a@example.test", password: "x" });
    return h;
  }

  it("hängt die Meldung des Servers an die Zustandszeile", async () => {
    // Die Gestaltprüfung der Route antwortet mit `{ error: "BAD_REQUEST", message }`
    // (`services/app/src/routes/capture-routes.ts`, JOB 2690 D1). Bis hierher las niemand den
    // Rumpf, und der Mensch bekam nur den Sammelsatz „Der Server hat abgelehnt."
    const h = await mitAbweisung({ error: "BAD_REQUEST", message: "bodyHtml muss Text sein" });
    const sicht = (await h.send({
      type: "save",
      form: { title: "Titel", context: "", confidentiality: "intern", origin: "" },
    })) as Sicht;

    expect(sicht.status).toBe("rejected");
    expect(sicht.reason).toBe("bodyHtml muss Text sein");
    // Der Grund ERSETZT den Zustand nicht — beides steht nebeneinander, und die Auswahl bleibt.
    expect(sicht.selection?.url).toBe(ADVISOR.url);
  });

  it("behauptet keinen Grund, wenn die Antwort keinen trug", async () => {
    const h = await mitAbweisung({ error: "BAD_REQUEST" });
    const sicht = (await h.send({
      type: "save",
      form: { title: "Titel", context: "", confidentiality: "intern", origin: "" },
    })) as Sicht;

    expect(sicht.status).toBe("rejected");
    expect(sicht.reason).toBeUndefined();
  });

  it("kürzt einen überlangen Fremdtext und normalisiert ihn auf eine Zeile", async () => {
    const h = await mitAbweisung({
      error: "BAD_REQUEST",
      message: `erste Zeile\nzweite Zeile ${"x".repeat(400)}`,
    });
    const sicht = (await h.send({
      type: "save",
      form: { title: "Titel", context: "", confidentiality: "intern", origin: "" },
    })) as Sicht;

    expect(sicht.reason).toHaveLength(200);
    expect(sicht.reason?.endsWith("…")).toBe(true);
    expect(sicht.reason).not.toContain("\n");
    expect(sicht.reason?.startsWith("erste Zeile zweite Zeile ")).toBe(true);
  });
});
