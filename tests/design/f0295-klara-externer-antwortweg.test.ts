// @vitest-environment jsdom
// ================================================================================================
// JOB 2948 · D1 · F-0295 — DER ABNAHMETEST ZUM UX-DESIGNARTEFAKT „gesperrter externer Antwortweg".
// ================================================================================================
//
// WORUM ES GEHT. Pedi hat am 27.08. in Word Text markiert, eine Frage getippt, „Klara fragen"
// gedrueckt — und es passierte nichts. Seine Lesart steht im Funktionsregister F-0295:
// „ich als admin gebe es frei und eine ki verweigert mir das?" Der Sanierer musste richtigstellen,
// dass der Schalter „einen NIE FERTIG GEBAUTEN Weg" markiert und „kein Veto gegen den Admin" ist.
//
// Der Dienst kennt den Grund seit langem (`services/reasoner/src/klara-policy.ts`,
// `blockedReason = "external_not_migrated"`). Was fehlte, war ein ENTWURF, wie die Oberflaeche
// diesen Grund so zeigt, dass niemand mehr eine Verweigerung hineinliest — und wie eine
// Einwilligung aussieht, die Pedis Massstab vom 18.08. erfuellt: „ja, aber nie still".
//
// WAS DIESER TEST PRUEFT — und was er ausdruecklich NICHT tut. Er misst das Artefakt, nicht das
// Produkt. Er stellt keine Aussage darueber auf, ob der externe Weg funktioniert; er haelt fest,
// dass der ENTWURF die drei Zustaende zeigt, sie unterscheidbar macht, den Datenabfluss beim Namen
// nennt und nirgends vorgibt, den Schalter umzulegen.
//
// ER FUEHRT DAS ARTEFAKT WIRKLICH AUS. Die Datei wird in jsdom aufgebaut und ihr eingebettetes
// Skript ausgefuehrt; die Zustaende werden ueber die echten Bedienelemente durchgeschaltet und die
// Sichtbarkeit danach gemessen. Eine reine Textsuche im Quelltext haette ein Artefakt bestanden,
// das die richtigen Woerter enthaelt und beim Klicken nichts tut.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const ARTEFAKT = resolve(process.cwd(), "docs/design/F-0295-klara-externer-antwortweg/index.html");
const DA = existsSync(ARTEFAKT);
const HTML = DA ? readFileSync(ARTEFAKT, "utf8") : "";

// ------------------------------------------------------------------------------------------------
// DER ZUGRIFF AUFS DOM — OHNE DOM-BIBLIOTHEK.
// ------------------------------------------------------------------------------------------------
// Der Wurzel-Typprüfer (`tools/build`) ist Node-rein: `tsconfig.json:6` setzt `lib: ["ES2022"]`, und
// die Grenze zur DOM-Welt verläuft an `.tsx` (`:26`, `exclude`). Eine `.ts`-Datei, die `document`
// global anspricht, fällt dort mit TS2584 durch — auch wenn sie in jsdom einwandfrei läuft.
// Das Haus löst das mit eigenen, schmalen Schnittstellen und einem Zugriff über `globalThis`
// (`tests/app/klara-panel-fixture.ts:31-54`, `:228`). Genau dieselbe Form steht hier: nur die
// Handvoll Eigenschaften, die dieser Test wirklich benutzt.
interface Knoten {
  nodeType: number;
  textContent: string | null;
}
interface El extends Knoten {
  hasAttribute(name: string): boolean;
  classList: { contains(name: string): boolean };
  parentElement: El | null;
  childNodes: ArrayLike<Knoten>;
  querySelectorAll(auswahl: string): ArrayLike<El>;
  closest(auswahl: string): El | null;
  click(): void;
  disabled?: boolean;
}
interface Dok {
  documentElement: { innerHTML: string };
  getElementById(id: string): El | null;
  querySelectorAll(auswahl: string): ArrayLike<El>;
}
const dok = (globalThis as unknown as { document: Dok }).document;

/** Der sichtbare Text eines Elements — verborgene Teilbaeume zaehlen nicht mit. */
function sichtbarerText(wurzel: El | null): string {
  if (!wurzel) return "";
  const teile: string[] = [];
  const lauf = (el: El) => {
    if (el.hasAttribute("hidden") || el.classList.contains("weg")) return;
    for (const kind of Array.from(el.childNodes)) {
      if (kind.nodeType === 3) teile.push((kind.textContent ?? "").trim());
      else if (kind.nodeType === 1) lauf(kind as El);
    }
  };
  lauf(wurzel);
  return teile.filter(Boolean).join(" ").replace(/\s+/g, " ");
}

function sichtbar(id: string): boolean {
  const el = dok.getElementById(id);
  if (!el) return false;
  for (let e: El | null = el; e; e = e.parentElement) {
    if (e.hasAttribute("hidden") || e.classList.contains("weg")) return false;
  }
  return true;
}

function zustand(taste: "a" | "b" | "c"): void {
  const knopf = dok.getElementById(`wahl-${taste}`);
  if (!knopf) throw new Error(`Zustandswahl #wahl-${taste} fehlt`);
  knopf.click();
}

describe("JOB 2948 · D1 · F-0295 · das Designartefakt zum gesperrten externen Antwortweg", () => {
  beforeAll(() => {
    if (!DA) return;
    // Erst das Markup ohne Skripte aufbauen, dann die eingebetteten Skripte ausfuehren — jsdom
    // fuehrt Skripte aus `innerHTML` nicht von selbst aus.
    dok.documentElement.innerHTML = HTML.replace(/<script>[\s\S]*?<\/script>/g, "")
      .replace(/^[\s\S]*?<html[^>]*>/i, "")
      .replace(/<\/html>[\s\S]*$/i, "");
    for (const treffer of HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      new Function(treffer[1] ?? "")();
    }
  });

  it("A0 · das Artefakt liegt am vereinbarten Pfad und ist eine HTML-Datei", () => {
    expect(DA, `fehlt: ${ARTEFAKT}`).toBe(true);
    expect(HTML).toMatch(/<!doctype html>/i);
    expect(HTML.length).toBeGreaterThan(4000);
  });

  // ---- In sich geschlossen: ohne Server lauffaehig, keine Netzaufrufe -----------------------------
  it("G1 · kein Verweis nach aussen — kein externes Skript, kein externes Stylesheet, kein http-Ziel", () => {
    expect(DA).toBe(true);
    expect(HTML).not.toMatch(/<script[^>]+src=/i);
    expect(HTML).not.toMatch(/<link[^>]+rel=["']?stylesheet/i);
    // Zaehlt nur als Verweis, was geladen wird — nicht ein Pfad, der im Belegtext genannt wird.
    const verweise = [...HTML.matchAll(/(?:src|href|action)\s*=\s*["']([^"']+)["']/gi)].map(
      (m) => m[1] ?? "",
    );
    const nachAussen = verweise.filter((v) => /^(https?:|\/\/)/i.test(v));
    expect(nachAussen, `externe Ziele: ${nachAussen.join(", ")}`).toHaveLength(0);
  });

  it("G2 · kein Netzaufruf und kein Import aus dem Produktcode", () => {
    expect(DA).toBe(true);
    expect(HTML).not.toMatch(/\bfetch\s*\(/);
    expect(HTML).not.toMatch(/XMLHttpRequest|EventSource|WebSocket|navigator\.sendBeacon/);
    expect(HTML).not.toMatch(/\bimport\s+[^;]*from\s*["'][^"']*(apps|services)\//);
    expect(HTML).not.toMatch(/\brequire\s*\(\s*["'][^"']*(apps|services)\//);
  });

  it("G3 · CSS und JavaScript stecken in der Datei selbst", () => {
    expect(DA).toBe(true);
    expect(HTML).toMatch(/<style>/);
    expect(HTML).toMatch(/<script>/);
  });

  // ---- Die drei Zustaende ------------------------------------------------------------------------
  it("Z1 · Zustand A (external_not_migrated) sagt ohne Fachjargon, dass der Weg NICHT GEBAUT ist — und ausdruecklich, dass es keine Verweigerung ist", () => {
    expect(DA).toBe(true);
    zustand("a");
    expect(dok.getElementById("panel-code")?.textContent).toContain("external_not_migrated");
    const text = sichtbarerText(dok.getElementById("panel"));
    // „nie gebaut" statt „gesperrt": genau der Unterschied, den Pedi nicht lesen konnte.
    expect(text).toMatch(/nicht gebaut|nie gebaut|existiert (noch )?nicht|gibt es (noch )?nicht/i);
    // Der Satz, der den Fehlschluss ausschliesst — er muss dastehen, nicht bloss gemeint sein.
    expect(text).toMatch(/kein(e)? (Verweigerung|Veto)|verweigert dir nichts|niemand verweigert/i);
    // Und er darf nicht als Rechtefrage erscheinen.
    expect(text).not.toMatch(/keine Berechtigung|nicht berechtigt|fehlende Rechte/i);
  });

  it("Z2 · Zustand B (external_consent_missing) ist SICHTBAR anders als A und zeigt die Einwilligung samt Widerruf", () => {
    expect(DA).toBe(true);
    zustand("a");
    const textA = sichtbarerText(dok.getElementById("panel"));
    zustand("b");
    expect(dok.getElementById("panel-code")?.textContent).toContain("external_consent_missing");
    const textB = sichtbarerText(dok.getElementById("panel"));
    expect(textB).not.toBe(textA);
    expect(sichtbar("panel-einwilligung"), "der Einwilligungskasten fehlt in B").toBe(true);
    // Behebbar — und der Unterschied zu A wird benannt, nicht nur anders gefaerbt.
    expect(textB).toMatch(/du kannst|entscheidest du|deine Entscheidung|deine Erlaubnis/i);
    expect(textB).toMatch(/widerruf/i);
  });

  it("Z3 · Zustand C zeigt WAEHREND und NACH der Antwort, dass sie extern entsteht", () => {
    expect(DA).toBe(true);
    zustand("c");
    const text = sichtbarerText(dok.getElementById("panel"));
    expect(sichtbar("panel-lauf"), "die Laufanzeige des externen Wegs fehlt in C").toBe(true);
    expect(text).toMatch(/extern/i);
    // Eine externe Antwort, die aussieht wie eine hausgemachte, ist genau das „still", das
    // ausgeschlossen wurde: die Antwort selbst traegt ein Kennzeichen.
    expect(sichtbar("panel-antwort-herkunft"), "die Herkunftszeile an der Antwort fehlt").toBe(
      true,
    );
    expect(sichtbarerText(dok.getElementById("panel-antwort-herkunft"))).toMatch(/extern/i);
  });

  it("Z4 · die drei Zustaende sind paarweise unterscheidbar — drei verschiedene Panel-Texte, drei verschiedene Grundcodes", () => {
    expect(DA).toBe(true);
    const gelesen: string[] = [];
    const codes: string[] = [];
    for (const z of ["a", "b", "c"] as const) {
      zustand(z);
      gelesen.push(sichtbarerText(dok.getElementById("panel")));
      codes.push(dok.getElementById("panel-code")?.textContent ?? "");
    }
    expect(new Set(gelesen).size, "zwei Zustaende sehen gleich aus").toBe(3);
    expect(new Set(codes).size, "zwei Zustaende nennen denselben Grund").toBe(3);
  });

  // ---- Der Datenabfluss beim Namen ---------------------------------------------------------------
  it("E1 · der Entwurf nennt ausdruecklich, WELCHE Daten das Haus verlassen — nicht nur, DASS etwas gesendet wird", () => {
    expect(DA).toBe(true);
    zustand("b");
    const umfang = sichtbarerText(dok.getElementById("panel-umfang"));
    expect(umfang, "die Umfangszeile ist leer").not.toBe("");
    // Der markierte Dokumenttext ist die Nutzlast (taskpane.html:984-993: die Markierung WIRD die
    // Frage), gekappt bei 2000 Zeichen (WORD_ADDIN_ASK_MAX_CHARS).
    expect(umfang).toMatch(/markiert/i);
    expect(umfang).toMatch(/2000|2\.000/);
    // Und der Empfaenger wird genannt, nicht umschrieben.
    expect(umfang).toMatch(/Anbieter|Empfänger|geht an/i);
  });

  it("E2 · der Entwurf zeigt den echten Text, der hinausginge — nicht nur eine Klassenbezeichnung", () => {
    expect(DA).toBe(true);
    zustand("b");
    const probe = dok.getElementById("panel-umfang-probe");
    expect(probe, "die Textprobe des Abflusses fehlt").toBeTruthy();
    expect((probe?.textContent ?? "").trim().length).toBeGreaterThan(40);
  });

  // ---- Der Weg, der heute wirklich funktioniert ---------------------------------------------------
  it("D1 · der deterministische Weg ist in ALLEN drei Zustaenden erreichbar und nicht als zweite Wahl dargestellt", () => {
    expect(DA).toBe(true);
    for (const z of ["a", "b", "c"] as const) {
      zustand(z);
      expect(sichtbar("panel-det"), `der deterministische Weg fehlt in Zustand ${z}`).toBe(true);
      const knopf = dok.getElementById("panel-det-knopf");
      expect(knopf, `der Knopf zum deterministischen Weg fehlt in Zustand ${z}`).toBeTruthy();
      expect(knopf?.disabled, `im Zustand ${z} ist der einzige funktionierende Weg gesperrt`).toBe(
        false,
      );
      const text = sichtbarerText(dok.getElementById("panel-det"));
      // Kein Trostpflaster-Wortschatz: „nur", „immerhin", „ersatzweise", „stattdessen wenigstens".
      expect(text).not.toMatch(/immerhin|notfalls|wenigstens|ersatzweise|zweite Wahl|Krücke/i);
    }
  });

  // ---- Die harte Grenze: nichts hier legt den Schalter um -----------------------------------------
  // ============================================================================================
  // K1 · NACHGEFUEHRT AM 03.09.2026 (JOB 3033) — VOM WERTPIN ZUM STRUKTURPIN.
  // ============================================================================================
  //
  // Bis hierher verlangte dieser Fall, dass jede Fundstelle mit Gleichheitszeichen den Wert
  // `false` traegt. Das war ein Pin auf den BESTANDSWERT — und ein Wertpin faellt in dem Moment
  // um, in dem der Eigentuemer den Wert aendert, ohne dass am Artefakt etwas falsch waere.
  //
  // WAS DER FALL WIRKLICH SCHUETZEN MUSS, gilt unabhaengig vom Wert: Das Artefakt ist ein ENTWURF
  // und darf den Schalter nicht anfassen. Deshalb wird jetzt die BAUFORM geprueft — jede
  // Fundstelle steht in einem `<code>`-Element, ist also ANGEZEIGTER Text und keine ausfuehrbare
  // Zuweisung; eine Deklaration gibt es nirgends. Das ist schaerfer als der alte Pin: er haette
  // eine echte Zuweisung `= false` im Skript durchgelassen.
  //
  // EHRLICH ZUM ARTEFAKT: der dort zitierte Wert ist der Entwurfsstand vom 27.08.2026. Er stimmt
  // heute noch, weil die Konstante weiter auf `false` steht; er ist aber ein DATIERTES Zitat und
  // keine Quelle der Wahrheit ueber den Code. Faellt die Freischaltung, muss das Artefakt
  // nachgefuehrt werden — es liegt ausserhalb der Zielpfade von JOB 3033.
  it("K1 · die Freischaltkonstante wird zitiert, aber nirgends gesetzt", () => {
    expect(DA).toBe(true);
    // Als Beleg genannt zu werden ist erwuenscht — ausgefuehrt zu werden nicht.
    expect(HTML).toContain("KLARA_EXTERNAL_EXECUTION_MIGRATED");
    // Jede Fundstelle steht in einem `<code>`-Element: nimmt man die Anzeigetexte heraus, kommt der
    // Name im Artefakt gar nicht mehr vor.
    const ohneAnzeigetexte = HTML.replace(/<code>[\s\S]*?<\/code>/g, "");
    expect(
      ohneAnzeigetexte,
      "die Konstante steht ausserhalb eines Anzeigetextes — also moeglicherweise als Code",
    ).not.toContain("KLARA_EXTERNAL_EXECUTION_MIGRATED");
    // Und keine Deklaration, unter keinem Schluesselwort.
    expect(HTML).not.toMatch(/(const|let|var|function)\s+KLARA_EXTERNAL_EXECUTION_MIGRATED/);
  });

  it("K2 · kein Bedienelement IM PANEL bringt den Zustand A zum Verschwinden — der Entwurf schaltet nichts frei", () => {
    expect(DA).toBe(true);
    zustand("a");
    const vorher = dok.getElementById("panel-code")?.textContent ?? "";
    expect(vorher).toContain("external_not_migrated");
    const knoepfe = Array.from(dok.querySelectorAll("#panel button"));
    expect(knoepfe.length, "das Panel hat gar keine Bedienelemente").toBeGreaterThan(0);
    for (const k of knoepfe) {
      k.click();
      expect(
        dok.getElementById("panel-code")?.textContent ?? "",
        `„${(k.textContent ?? "").trim()}" hat den Sperrgrund veraendert`,
      ).toBe(vorher);
    }
  });

  it("K3 · die Zustandswahl ist als Ansichtsschalter des Entwurfs gekennzeichnet, nicht als Freischaltung", () => {
    expect(DA).toBe(true);
    const schalter = dok.getElementById("zustandswahl");
    expect(schalter, "die Zustandswahl fehlt").toBeTruthy();
    expect(schalter?.closest("#panel"), "die Zustandswahl steht IM Panel").toBeNull();
    expect(sichtbarerText(schalter)).toMatch(/Entwurf|Ansicht|schaltet nichts/i);
  });
});
