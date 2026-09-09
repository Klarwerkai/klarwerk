// @vitest-environment jsdom
// ================================================================================================
// JOB 3323 R2 · DER PFLICHTGEGENFALL — EIN GESPEICHERTER ENTWURF, UNGESICHERT VERÄNDERT.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. Runde 1 hat den verlustfreien Wechsel an einem FRISCHEN Blatt gemessen
// (`wechsel-ohne-verlust.test.tsx`): getippter Titel, kein `?draft=` in der Adresse, also gar kein
// Ladeweg. Codex (3346e874) hat dagegen den Fall benannt, der im Vorführungsalltag der häufigere
// ist — Pedi öffnet einen GESPEICHERTEN Entwurf (`/erfassen?draft=<id>`, der Link aus Klara und aus
// „Entwürfe"), ändert Titel, Rumpf und Vertraulichkeit, und schaltet DANN die Sprache um.
//
// DIE KETTE, DIE DABEI ZUSCHLÄGT (im Quelltext nachgelesen, nicht vermutet):
//   · `Blatt.tsx` liest `t` aus `useTranslation()` (:193) und führt `t` in den Abhängigkeiten des
//     LADEEFFEKTS (:744). Ein Sprachwechsel erzeugt eine neue `t`-Identität — der Effekt läuft
//     also erneut, obwohl sich an der Entwurfskennung nichts geändert hat.
//   · Die Bewachung davor (`speicherAdresseRef`, :642) greift NUR nach eigenem Speichern (:886).
//     Beim ÖFFNEN steht sie auf `null` (:645) — sie kann diesen Lauf also nicht abfangen.
//   · Der zweite Lauf holt denselben Entwurf noch einmal (`endpoints.drafts.get`, :669) und setzt
//     Titel, Rumpf, Kategorie und Vertraulichkeit auf die SERVERWERTE zurück (:671–693).
// Folge: der Sprachwechsel wirft die ungesicherte Arbeit weg — genau die Zusage des Auftrags
// („ohne Verlust von Entwurf …"), und zwar auf dem Weg, den Pedi vor dem Kunden geht.
//
// WIE HIER GEMESSEN WIRD. `drafts.get` ist kein starrer Rückgabewert, sondern ein TOR: jeder Aufruf
// legt seinen Auflöser ab, `entwurfAusliefern()` löst alle offenen auf einmal auf. Das gibt zwei
// unabhängige Belege statt einem:
//   1. DIE ZAHL: nach dem Sprachwechsel darf kein WEITERER `drafts.get` dazugekommen sein.
//   2. DIE WIRKUNG: nach dem Wechsel wird noch einmal ausgeliefert. Gäbe es einen zweiten Abruf,
//      käme jetzt die Serverantwort an und überschriebe die ungesicherte Arbeit — der Fall wäre
//      auch dann rot, wenn jemand später nur die Zählung stillstellte.
// Ohne diesen zweiten Beleg wäre der Fall ein reiner Zählertest, und ein Zähler misst keine Folge.
//
// ROT VOR DER REPARATUR (in der RUECKGABE mit Laufkennung protokolliert): auf dem Stand der Runde 1
// meldet dieser Fall zwei `drafts.get` und den Serverstand in beiden Feldern.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia Klar", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Der gespeicherte Entwurf, wie ihn der Server ausliefert — OHNE `confidentiality`. Das ist kein
// Kunstgriff, sondern der Normalfall (`api/types.ts:692`, das Feld ist optional) und zugleich die
// Stelle, an der ein Neuladen am deutlichsten sichtbar wird: eine fehlende Stufe setzt die Wahl
// zurück auf „nicht gewählt" (`Blatt.tsx:676–693`), das Werkzeugwort fällt auf den Platzhalter.
const { TOR, SERVER_ENTWURF } = vi.hoisted(() => ({
  TOR: {
    rufe: [] as string[],
    // Jeder angehaltene Ladeversuch mit BEIDEN Ausgängen. Die Ablehnung braucht Runde 3 für den
    // Fehlersprachfall (bens Prüflücke 6): ein Ladeversuch, der ERST NACH dem Sprachwechsel
    // scheitert, muss seine Meldung in der DANN geltenden Sprache bringen.
    offen: [] as Array<{ aufloesen: (wert: unknown) => void; ablehnen: (grund: unknown) => void }>,
  },
  SERVER_ENTWURF: {
    id: "D-1",
    payload: {
      title: "SERVERTITEL — so liegt er gespeichert",
      bodyHtml: "<p>SERVERRUMPF</p>",
      category: "Anlage 1",
    },
    originalAuthor: "u1",
    lastEditor: "u1",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const make = (pfad: string): unknown =>
    new Proxy(
      vi.fn(async () => []),
      {
        get(target, prop, recv) {
          if (prop in target || typeof prop === "symbol") {
            return Reflect.get(target, prop, recv);
          }
          return make(pfad === "" ? String(prop) : `${pfad}.${String(prop)}`);
        },
        apply(target, self, args) {
          TOR.rufe.push(pfad);
          // NUR der Ladeweg wird angehalten. Jeder andere Endpunkt antwortet sofort mit einer
          // leeren Liste — diese Datei fragt nach dem Entwurf, nicht nach Seiteninhalten.
          if (pfad === "drafts.get") {
            return new Promise((aufloesen, ablehnen) => {
              TOR.offen.push({ aufloesen, ablehnen });
            });
          }
          return Reflect.apply(target as never, self, args);
        },
      },
    );
  return { endpoints: make("") };
});

import { QueryClient } from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import { Capture } from "../../apps/web/src/pages/Capture";
import {
  type Montage,
  breite,
  flush,
  klick,
  kontoMenueOeffnen,
  montiere,
  schreibeInRumpf,
  sprachKnopf,
} from "./huelle";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const DRAFT_ID = "D-1";
const UNGESICHERTER_TITEL = "UNGESICHERT — vor dem Kunden getippt";
const UNGESICHERTER_RUMPF = "UNGESICHERTER RUMPF";

let montage: Montage | null = null;

function neueQc(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** Wie oft der Ladeweg wirklich gerufen wurde. */
function ladeRufe(): number {
  return TOR.rufe.filter((p) => p === "drafts.get").length;
}

/** Löst JEDEN offenen Ladeversuch mit dem Serverstand auf. */
async function entwurfAusliefern(): Promise<void> {
  const offen = [...TOR.offen];
  TOR.offen.length = 0;
  await act(async () => {
    for (const { aufloesen } of offen) {
      aufloesen(SERVER_ENTWURF);
    }
    await flush();
  });
  await act(flush);
}

/** Lässt JEDEN offenen Ladeversuch scheitern — mit einem technischen Fehler ohne eigenen Wortlaut. */
async function ladenScheitern(): Promise<void> {
  const offen = [...TOR.offen];
  TOR.offen.length = 0;
  await act(async () => {
    for (const { ablehnen } of offen) {
      // BEWUSST „Failed to fetch": `ladeFehlerMeldung` (Blatt.tsx:198) lässt eine SERVERMELDUNG
      // gewinnen und greift nur bei einem technischen Fehler auf den übersetzten Satz zurück. Ein
      // Fehler mit eigenem Text prüfte also die Übersetzung gar nicht.
      ablehnen(new TypeError("Failed to fetch"));
    }
    await flush();
  });
  await act(flush);
}

/** Text wie ein Mensch setzen: nativer Value-Setter + input-Event (React-onChange). */
async function tippe(feld: HTMLInputElement, text: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

/** Sichtbarer Text in EINER Schreibweise. */
function text(el: Element | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Das Wort am Vertraulichkeits-Werkzeug — die sichtbare Markierung des Blattes.
 *
 * Gelesen werden NUR die eigenen Textknoten des Knopfes. Sein `textContent` trägt sonst auch den
 * Aufklapp-Pfeil mit, und dessen `<title>` ist wörtlich ein Mittelpunkt (`Menue.tsx:89`) — der
 * hinge an jedem Vergleich mit dran und hätte nichts mit der Markierung zu tun.
 */
function vertraulichkeitsWort(c: HTMLElement): string {
  const knopf = c.querySelector('[data-testid="blatt-werkzeug-vertraulichkeit"]');
  return [...(knopf?.childNodes ?? [])]
    .filter((n) => n.nodeType === 3 /* Textknoten */)
    .map((n) => n.textContent ?? "")
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** Der Wechsel, so wie Pedi ihn macht: Konto-Kreis, dann der Sprachknopf. */
async function wechsleAuf(c: HTMLElement, sprache: string): Promise<void> {
  await kontoMenueOeffnen(c);
  await klick(sprachKnopf(c, sprache));
  await act(flush);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
  breite(1280);
  TOR.rufe.length = 0;
  TOR.offen.length = 0;
});

afterEach(() => {
  montage?.abbauen();
  montage = null;
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("JOB 3323 R2 · gespeicherter Entwurf — der Sprachwechsel lädt ihn NICHT neu", () => {
  it("Titel, Rumpf und Vertraulichkeit bleiben ungesichert stehen; kein zweiter drafts.get", async () => {
    montage = await montiere(`/erfassen?draft=${DRAFT_ID}`, createElement(Capture), neueQc());
    const c = montage.container;

    // ---- 1. Der gespeicherte Entwurf wird geöffnet und ausgeliefert ----------------------------
    expect(ladeRufe(), "der Ladeweg wurde beim Öffnen nicht gerufen").toBe(1);
    await entwurfAusliefern();

    const titelfeld = c.querySelector<HTMLInputElement>('[data-testid="blatt-titel"]');
    expect(titelfeld, "Titelfeld des Blattes fehlt").toBeTruthy();
    expect(titelfeld?.value).toBe(SERVER_ENTWURF.payload.title);
    expect(c.querySelector('[data-testid="blatt-text"]')?.textContent).toContain("SERVERRUMPF");

    // ---- 2. Ungesichert ändern: Titel, Rumpf, Markierung ---------------------------------------
    await tippe(titelfeld as HTMLInputElement, UNGESICHERTER_TITEL);
    await schreibeInRumpf(c, UNGESICHERTER_RUMPF);

    // Die Vertraulichkeit ist am Serverstand NICHT gesetzt — hier wird sie bewusst gewählt.
    expect(vertraulichkeitsWort(c)).toBe(i18n.t("erfassen.werkzeug.vertraulichkeit"));
    await klick(c.querySelector('[data-testid="blatt-werkzeug-vertraulichkeit"]'));
    const stufen = [
      ...c.querySelectorAll<HTMLElement>('[data-testid="blatt-menue-vertraulichkeit"] button'),
    ];
    const gewaehlteStufe = stufen.find((b) => text(b) === i18n.t("conf.level.vertraulich"));
    expect(gewaehlteStufe, "Stufe „Vertraulich“ fehlt im Werkzeugmenü").toBeTruthy();
    await klick(gewaehlteStufe);
    expect(vertraulichkeitsWort(c)).toBe(i18n.t("conf.level.vertraulich"));

    const rufeVorWechsel = ladeRufe();
    expect(rufeVorWechsel).toBe(1);

    // ---- 3. Der Sprachwechsel mitten in der Szene ----------------------------------------------
    await wechsleAuf(c, "en");
    expect(i18n.language).toBe("en");

    // BELEG 1 — DIE ZAHL: der Wechsel hat den Ladeweg nicht noch einmal angestoßen.
    expect(
      ladeRufe(),
      `Der Sprachwechsel hat den gespeicherten Entwurf neu geladen (${ladeRufe()} statt ${rufeVorWechsel} Abrufe)`,
    ).toBe(rufeVorWechsel);

    // BELEG 2 — DIE WIRKUNG: was jetzt noch offen wäre, wird ausgeliefert. Nach der Reparatur ist
    // nichts offen und dieser Aufruf tut nichts; ohne sie käme hier der Serverstand an.
    await entwurfAusliefern();

    // ---- 4. Die ungesicherte Arbeit steht noch — im SELBEN Feld ---------------------------------
    expect(c.querySelector('[data-testid="blatt-titel"]')).toBe(titelfeld);
    expect(
      c.querySelector<HTMLInputElement>('[data-testid="blatt-titel"]')?.value,
      "der ungesicherte Titel wurde vom Serverstand überschrieben",
    ).toBe(UNGESICHERTER_TITEL);

    const rumpf = c.querySelector('[data-testid="blatt-text"]')?.textContent ?? "";
    expect(rumpf, "der ungesicherte Rumpf wurde vom Serverstand überschrieben").toContain(
      UNGESICHERTER_RUMPF,
    );
    expect(rumpf).not.toContain("SERVERRUMPF");

    // Die MARKIERUNG bleibt gewählt — sie steht jetzt nur auf Englisch da. Genau das ist der
    // Unterschied zwischen „Oberflächentext übersetzt" und „Wahl verloren": ein Neuladen setzte
    // sie auf den Platzhalter zurück, weil der Serverstand keine Stufe trägt.
    const enT = i18n.getFixedT("en");
    expect(vertraulichkeitsWort(c)).toBe(enT("conf.level.vertraulich"));
    expect(vertraulichkeitsWort(c)).not.toBe(enT("erfassen.werkzeug.vertraulichkeit"));
  });
});

// ==================================================================================================
// RUNDE 3 (bens Prüflücke 6) — DIE FEHLERMELDUNG SPRICHT DIE SPRACHE VON JETZT.
// ==================================================================================================
//
// Die Reparatur in `Blatt.tsx` nimmt `t` aus den Abhängigkeiten des Ladeeffekts und liest die
// Übersetzung stattdessen über ein Ref (`tRef`, Blatt.tsx:332). Dazu steht dort eine Begründung —
// „die Meldung soll in der Sprache stehen, die BEIM EINTREFFEN DES FEHLERS gilt, nicht in der vom
// Start des Ladevorgangs" — und die war bis hierher BEHAUPTET, nicht gemessen.
//
// Der Fall stellt genau diese Lage her: ein Ladeversuch hängt noch, mitten hinein wechselt die
// Sprache, DANN scheitert er. Ein `getFixedT("de")` hätte die Meldung auf Deutsch eingefroren —
// das ist die Gegenprobe zu diesem Fall und sie ist gefahren („expected 'Der Entwurf konnte nicht
// geladen werd…' to contain 'The draft could not be loaded…'").
//
// WAS DIESER FALL NICHT UNTERSCHEIDET, damit er nicht mehr behauptet, als er misst: ein einfach
// eingeschlossenes `t` statt `tRef.current` bliebe hier GRÜN — react-i18next reicht an die lebende
// Instanz durch, ein alter `t`-Wert übersetzt also ebenfalls aktuell (gemessen). Gegen ein `t`
// schützt nicht dieser Fall, sondern der darüber: es müsste in die Abhängigkeiten des Effekts und
// löste damit das Neuladen aus. Zusammen decken die beiden Fälle die Reparatur ganz ab.
describe("JOB 3323 R3 · ein Ladefehler NACH dem Sprachwechsel spricht die neue Sprache", () => {
  it("Wechsel bei hängendem Abruf, dann Ablehnung → englische Meldung, kein zweiter Abruf", async () => {
    montage = await montiere(`/erfassen?draft=${DRAFT_ID}`, createElement(Capture), neueQc());
    const c = montage.container;

    // Der Ladeversuch läuft und ist NOCH NICHT entschieden — genau das ist die Lage.
    expect(ladeRufe()).toBe(1);
    expect(TOR.offen).toHaveLength(1);

    // Mitten hinein der Sprachwechsel.
    await wechsleAuf(c, "en");
    expect(i18n.language).toBe("en");
    // Er hat den hängenden Abruf weder ersetzt noch einen zweiten angestossen.
    expect(ladeRufe(), "der Sprachwechsel hat einen zweiten Ladeversuch begonnen").toBe(1);
    expect(TOR.offen).toHaveLength(1);

    // Und JETZT scheitert er.
    await ladenScheitern();

    const enT = i18n.getFixedT("en");
    const deT = i18n.getFixedT("de");
    // `blatt-lage` trägt neben dem Satz auch den Wiederholen-Knopf — geprüft wird deshalb auf
    // ENTHALTEN und, als Gegenstück, auf das AUSBLEIBEN der deutschen Fassung. Ein `toBe` auf den
    // ganzen Textinhalt prüfte den Knopf mit und hätte mit der Sprache nichts zu tun.
    const lage = c.querySelector('[data-testid="blatt-lage"]')?.textContent ?? "";
    expect(lage, "keine Fehlermeldung am Blatt").not.toBe("");
    expect(lage, "die Meldung steht nicht auf Englisch").toContain(enT("fd.errLoadFailed"));
    expect(lage, "die Meldung steht in der Sprache von VOR dem Wechsel").not.toContain(
      deT("fd.errLoadFailed"),
    );
    // Und der Gegenbeweis in einem: die deutsche Fassung ist wirklich eine andere Zeichenkette,
    // der Vergleich oben also nicht zufällig grün.
    expect(deT("fd.errLoadFailed")).not.toBe(enT("fd.errLoadFailed"));
  });
});
