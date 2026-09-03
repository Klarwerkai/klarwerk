// @vitest-environment jsdom
// ================================================================================================
// JOB 3041 · F/G/H — DER TASTATURWEG, DER SPRACHWECHSEL UND DER HARTE FALL, AM GEMOUNTETEN EDITOR
// ================================================================================================
//
// WARUM GEMOUNTET: `kennzeichnung.test.ts` misst, was die Verankerung an die Knoten schreibt. Ob
// daraus ein WEG wird, entscheidet der Editor — sein `onKeyDown` hängt an `captionAtNode`, und ohne
// `tabindex` wäre die Fußnote gar nicht erst fokussierbar: der Tastaturweg endete, bevor er
// beginnt. Das ist kein Attributbefund, sondern ein Verhalten.
//
// RUNDE 2: dazu kommt der Fall, den ben an Runde 1 am MONTIERTEN Editor reproduziert hat — die
// verwaiste Fußnote aus JOB 3035 FALL C2, die dieselbe Kennung trägt wie eine vollständige Einheit
// und deshalb rückwärts zugeordnet AUSSAH. Sie wird hier über ihren Text ausgewählt, nicht über
// eine Paarungsfunktion und nicht über das Attribut, das der Test gerade prüft.
//
// WAS JSDOM NICHT KANN, ausdrücklich benannt: es simuliert die Tabulator-TRAVERSIERUNG des Browsers
// nicht — ein `Tab`-Tastendruck bewegt dort keinen Fokus. Gemessen wird deshalb, was jsdom ehrlich
// hergibt und woran die Traversierung im Browser hängt: `tabindex="0"`, kein `hidden`/`inert` im
// Pfad, und ein `focus()`, das den Knoten wirklich zum `activeElement` macht. Was hier nicht
// gemessen werden kann, wird nicht behauptet.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
// Die Schlüssel kommen aus derselben Tabelle wie im Produkt — keine abgeschriebene Zweitliste.
import { CAPTION_AI_TEXT } from "../../apps/web/src/lib/captionAiSuggest";
// Die EINE Naht für isoliert gemountete Editor-Tests (mega50 Block A) — nicht eine zweite bauen.
import { mitBildbeschreibung } from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Derselbe Stufe-3-Körper wie in `kennzeichnung.test.ts`: die zweite Fußnote trägt eine Kennung, zu
// der es kein Bild gibt — Stufe 2 nimmt nur unmarkierte, also bleibt sie übrig.
const VERWAIST_OHNE_BILD = "Gehört keinem Bild in diesem Text";
const INHALT = [
  "<p>Ein Satz, der stehen bleibt.</p>",
  "<figure>",
  '<img src="data:image/png;base64,AAAA" data-image-id="kw-img-eins">',
  '<img src="data:image/png;base64,BBBB" data-image-id="kw-img-zwei">',
  '<figcaption data-image-id="kw-img-eins">Zu Bild eins</figcaption>',
  `<figcaption data-image-id="kw-img-fremd">${VERWAIST_OHNE_BILD}</figcaption>`,
  "</figure>",
].join("");

// JOB 3035 FALL C2, wörtlich: die verwaiste Fußnote trägt DIESELBE Kennung wie Bild und innere
// Fußnote der vollständigen Einheit. Genau der Körper, an dem ben Runde 1 rot gemessen hat.
const DOPPELKENNUNG =
  "<p>Ein Satz, der stehen bleibt.</p>" +
  '<figcaption data-image-id="kw-x">Verwaist</figcaption>' +
  '<figure data-image-id="kw-x"><img src="/api/objects/echtes/raw" data-image-id="kw-x">' +
  '<figcaption data-image-id="kw-x">Echte</figcaption></figure>';

// RUNDE 4, bens Korrekturpflicht 1 — DIE MENGENLAGE aus `tests/capture/huelle4-nachnormalisierung
// .test.ts` (Probe 2), wörtlich: EIN Bild, ZWEI direkte Fußnoten, die erste LEER, die zweite mit
// einer widersprechenden Kennung. `ensureImageAnchors` schreibt hier bewusst nichts („es gibt keine
// Antwort auf die Frage, welche zum Bild gehört"). Genau hier fand ben an Runde 3 die zweite
// Fußnote unmarkiert und ihr Formular mit `/api/objects/bild-b/raw`.
const MENGENLAGE = [
  "<p>Ein Satz, der stehen bleibt.</p>",
  '<figure><img src="/api/objects/bild-b/raw" data-image-id="kw-img-bild-7">',
  "<figcaption></figcaption>",
  '<figcaption data-image-id="kw-img-zweite-3">Zweite Beschreibung</figcaption></figure>',
].join("");

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let gesetzterWert = INHALT;
let wertwechsel = 0;
let inhalt = INHALT;
/**
 * RUNDE 3: der EGRESS-ZÄHLER. Der Auftrag verlangt, dass nichts erfunden wird — und bens
 * Korrekturpflicht 2 verlangt den Beleg, dass für eine Fußnote ohne Bild gar kein Bild zur
 * Beschreibung ANGEBOTEN wird. Gezählt wird deshalb der echte Weg (`ImageDescribeContext`), nicht
 * eine Nacherzählung. Der Zähler wird bei jedem `mount()` zurückgesetzt.
 */
let describeAufrufe: string[] = [];

function Host(): JSX.Element {
  const [value, setValue] = useState(inhalt);
  gesetzterWert = value;
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      documentTitle: "Wartungsnotiz",
      onChange: (html: string) => {
        wertwechsel += 1;
        setValue(html);
      },
    }),
    async (dataUrl: string) => {
      describeAufrufe.push(dataUrl);
      return { text: "Vorschlag", demo: false };
    },
  );
}

function mount(start: string = INHALT): void {
  inhalt = start;
  describeAufrufe = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Host));
  });
}

function abbauen(): void {
  act(() => root.unmount());
  container.remove();
}

function fussnoten(): HTMLElement[] {
  return Array.from(container.querySelectorAll("figcaption")) as HTMLElement[];
}

/**
 * DER KONKRETE KNOTEN, über seinen sichtbaren Text. Bewusst NICHT über
 * `figcaption[data-kw-nicht-zugeordnet]` und nicht über `imageForCaption`: ein Test, der sein Ziel
 * über den Prüfgegenstand auswählt, kann dessen Irrtum nicht sehen (bens Befund an Runde 1).
 */
function fussnoteMitText(text: string): HTMLElement {
  const treffer = fussnoten().filter((f) => (f.textContent ?? "").trim() === text);
  const eine = treffer[0];
  if (treffer.length !== 1 || eine === undefined) {
    throw new Error(`${treffer.length} Fußnoten mit dem Text „${text}" statt genau einer`);
  }
  return eine;
}

function formulare(): Element[] {
  return Array.from(document.querySelectorAll("#caption-form-text"));
}

function formularText(): string {
  return (document.querySelector("#caption-form-text")?.textContent ?? "").trim();
}

/**
 * Das Bild IM Formular — erkannt an seiner eigenen Beschriftung („Bild, das beschrieben wird"),
 * nicht an einem Selektor, der auch den Editor-Inhalt treffen könnte. Genau dieses Element hat ben
 * an Runde 2 vorgefunden, obwohl die Fußnote daneben sagte, sie gehöre keinem Bild.
 */
function formularBild(): Element | null {
  const alt = i18n.t(CAPTION_AI_TEXT.formImageAlt);
  return document.querySelector(`img[alt="${alt}"]`);
}

function knopf(testid: string): HTMLElement {
  const el = document.querySelector(`[data-testid="${testid}"]`);
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Der Knopf ${testid} ist nicht da`);
  }
  return el;
}

async function spracheWechseln(lng: string): Promise<void> {
  await act(async () => {
    await i18n.changeLanguage(lng);
  });
}

beforeEach(async () => {
  wertwechsel = 0;
  await i18n.changeLanguage("de");
  mount();
});

afterEach(async () => {
  abbauen();
  await i18n.changeLanguage("de");
});

describe("JOB 3041 · F — die Fußnote ohne Bild ist mit der Tastatur bedienbar", () => {
  it("F1 · sie ist fokussierbar und nichts im Pfad nimmt sie aus der Tabulator-Reihenfolge", () => {
    const cap = fussnoteMitText(VERWAIST_OHNE_BILD);
    expect(cap.getAttribute("tabindex")).toBe("0");
    expect(cap.getAttribute("role")).toBe("button");
    // Kein Vorfahre bis zum Editor entzieht sie der Reihenfolge. jsdom traversiert nicht selbst —
    // das hier sind die Bedingungen, an denen die Traversierung im Browser hängt.
    for (let el: HTMLElement | null = cap; el && el !== document.body; el = el.parentElement) {
      expect(el.hasAttribute("hidden"), `hidden an ${el.tagName}`).toBe(false);
      expect(el.hasAttribute("inert"), `inert an ${el.tagName}`).toBe(false);
    }
    // Und der Fokus kommt wirklich an.
    act(() => cap.focus());
    expect(document.activeElement).toBe(cap);
  });

  it("F2 · die Eingabetaste öffnet dasselbe Formular wie der Mausklick — genau EINES", () => {
    expect(formulare().length, "vor der Taste ist kein Formular offen").toBe(0);
    const cap = fussnoteMitText(VERWAIST_OHNE_BILD);
    act(() => cap.focus());
    act(() => {
      cap.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    });
    expect(formulare().length, "die Eingabetaste öffnet GENAU EIN Formular").toBe(1);
    const ueberTaste = document.querySelector("#caption-form-text")?.textContent;
    expect(ueberTaste).toContain("Gehört keinem Bild");

    // Derselbe Weg mit der Maus, an einer frisch montierten Fläche: dasselbe eine Formular.
    abbauen();
    mount();
    act(() => {
      fussnoteMitText(VERWAIST_OHNE_BILD).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(formulare().length, "der Mausklick öffnet GENAU EIN Formular").toBe(1);
    expect(document.querySelector("#caption-form-text")?.textContent).toBe(ueberTaste);
  });

  it("F3 · die Kennzeichnung steht nur an ihr — die zugeordneten Fußnoten bleiben unmarkiert", () => {
    expect(fussnoteMitText(VERWAIST_OHNE_BILD).getAttribute("data-kw-nicht-zugeordnet")).toBe(
      i18n.t("editor.captionUnassigned"),
    );
    // ZWEI zugeordnete: die vorhandene Fußnote von Bild eins und die leere, die die Verankerung
    // für Bild zwei anlegt (`ensureImageAnchors` — eine figure ohne Fußnote bekommt eine).
    const unmarkiert = fussnoten().filter(
      (f) => f.getAttribute("data-kw-nicht-zugeordnet") === null,
    );
    expect(unmarkiert.length, "Vorbedingung: es gibt zugeordnete Fußnoten").toBe(2);
    for (const f of unmarkiert) {
      expect(f.getAttribute("aria-label")).toBe(i18n.t(CAPTION_AI_TEXT.captionOpenLabel));
    }
  });
});

describe("JOB 3041 · H — der harte Fall am montierten Editor (JOB 3035 C2)", () => {
  // BENS GEGENPROBE AN RUNDE 1, jetzt als Pflichtfall: verwaiste äußere Fußnote und gültige direkte
  // Fußnote tragen BEIDE die Kennung `kw-x`. Rückwärts findet die verwaiste genau ein Bild und sah
  // damit zugeordnet aus; vorwärts gehört dem Bild die innere. Nur die äußere darf markiert sein.
  it("H4 · nur die verwaiste äußere Fußnote wird gekennzeichnet und eigens angekündigt", () => {
    abbauen();
    mount(DOPPELKENNUNG);

    const verwaist = fussnoteMitText("Verwaist");
    const echte = fussnoteMitText("Echte");

    expect(
      verwaist.getAttribute("data-kw-nicht-zugeordnet"),
      "die verwaiste Fußnote steht unmarkiert im Text — genau bens Befund an Runde 1",
    ).toBe(i18n.t("editor.captionUnassigned"));
    expect(verwaist.getAttribute("aria-label")).toBe(i18n.t("editor.captionUnassignedLabel"));

    // Die echte Fußnote des Bildes bleibt, was sie war.
    expect(echte.getAttribute("data-kw-nicht-zugeordnet")).toBeNull();
    expect(echte.getAttribute("aria-label")).toBe(i18n.t(CAPTION_AI_TEXT.captionOpenLabel));

    // Und genau EINE Kennzeichnung im ganzen Editor — nicht beide, nicht keine.
    const markiert = fussnoten().filter((f) => f.getAttribute("data-kw-nicht-zugeordnet") !== null);
    expect(markiert.map((f) => (f.textContent ?? "").trim())).toEqual(["Verwaist"]);
  });

  it("H5 · auch sie öffnet über die Tastatur GENAU EIN Formular, mit ihrem eigenen Text", () => {
    abbauen();
    mount(DOPPELKENNUNG);

    const verwaist = fussnoteMitText("Verwaist");
    expect(verwaist.getAttribute("tabindex")).toBe("0");
    act(() => verwaist.focus());
    expect(document.activeElement).toBe(verwaist);
    act(() => {
      verwaist.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    });
    expect(formulare().length).toBe(1);
    expect(document.querySelector("#caption-form-text")?.textContent).toBe("Verwaist");
  });

  // RUNDE 3, bens Korrekturpflicht 2 — DAS FORMULAR MUSS DASSELBE SAGEN WIE DIE FUSSNOTE.
  //
  // In Runde 2 stand die Kennzeichnung „noch keinem Bild zugeordnet" an der Fußnote, und ein Klick
  // darauf öffnete ein Formular, das das FREMDE Bild zeigte — beschriftet mit „Bild, das beschrieben
  // wird". Zwei Aussagen über denselben Sachverhalt, und die lautere war die falsche. Seit die
  // Symmetrie in `imageForCaption` selbst wohnt, sagen beide dasselbe; hier wird das an der
  // Oberfläche gemessen, nicht am Quelltext.
  it("H6 · das Formular der verwaisten Fußnote zeigt KEIN Bild und bietet keines zur KI an", () => {
    abbauen();
    mount(DOPPELKENNUNG);
    act(() => {
      fussnoteMitText("Verwaist").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(formulare().length, "genau ein Formular").toBe(1);
    expect(formularText()).toBe("Verwaist");
    expect(
      formularBild(),
      "das Formular zeigt ein Bild, obwohl die Fußnote sagt, sie gehöre keinem — genau bens Befund",
    ).toBeNull();
    // Und der Weg zur KI führt zu keinem Aufruf: ohne Bild gibt es nichts zu beschreiben. Der
    // Knopf sagt den Grund, statt still nichts zu tun oder ein fremdes Bild zu senden.
    act(() => knopf("caption-form-suggest").click());
    expect(describeAufrufe, "ein Describe-Aufruf für eine Fußnote ohne Bild").toEqual([]);
    expect(document.querySelector('[data-testid="caption-form-fallback"]')?.textContent).toBe(
      i18n.t(CAPTION_AI_TEXT.imageUnreadable),
    );
  });

  // RUNDE 4, bens Korrekturpflicht 1 — DIESELBE ZUSAGE AN DER MENGENLAGE.
  //
  // In H4/H6 steht die verwaiste Fußnote AUSSERHALB jeder figure; ihr `:scope > img`-Zweig läuft
  // deshalb ohnehin ins Leere. Hier steht sie IN der figure, neben dem Bild — der Zweig hat also
  // etwas zu liefern, und in Runde 3 lieferte er es ungeprüft. Das ist der Fall, den bens Messung
  // gefunden hat, und ohne ihn wäre die Symmetrie nur für die halbe Funktion belegt.
  it("J4 · die Fußnote ohne Paarung IN der figure: markiert, Formular ohne Bild, Describe nullmal", () => {
    abbauen();
    mount(MENGENLAGE);

    const zweite = fussnoteMitText("Zweite Beschreibung");
    expect(
      zweite.getAttribute("data-kw-nicht-zugeordnet"),
      "die zweite Fußnote steht unmarkiert neben dem Bild — genau bens Befund an Runde 3",
    ).toBe(i18n.t("editor.captionUnassigned"));
    expect(zweite.getAttribute("aria-label")).toBe(i18n.t("editor.captionUnassignedLabel"));

    act(() => zweite.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(formulare().length).toBe(1);
    expect(formularText()).toBe("Zweite Beschreibung");
    expect(
      formularBild(),
      "das Formular zeigt das Bild der figure, obwohl die Zuordnung unbelegt ist",
    ).toBeNull();

    act(() => knopf("caption-form-suggest").click());
    expect(describeAufrufe, "ein Describe-Aufruf für eine unbelegte Zuordnung").toEqual([]);
    expect(document.querySelector('[data-testid="caption-form-fallback"]')?.textContent).toBe(
      i18n.t(CAPTION_AI_TEXT.imageUnreadable),
    );
  });

  it("J5 · der Gegenfall in derselben figure: die gepaarte (leere) Fußnote behält ihr Bild", () => {
    // Ohne diesen Fall wäre J4 auch dann grün, wenn die Korrektur JEDER Fußnote das Bild nähme.
    // Ausgewählt über die Leere, nicht über den Marker: die einzige Fußnote ohne Text.
    abbauen();
    mount(MENGENLAGE);

    const leere = fussnoten().filter((f) => (f.textContent ?? "").trim() === "");
    expect(leere.length, "Vorbedingung: genau eine leere Fußnote").toBe(1);
    const eine = leere[0];
    if (eine === undefined) {
      throw new Error("unerreichbar");
    }
    expect(eine.getAttribute("data-kw-nicht-zugeordnet")).toBeNull();
    expect(eine.getAttribute("aria-label")).toBe(i18n.t(CAPTION_AI_TEXT.captionOpenLabel));

    act(() => eine.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(formulare().length).toBe(1);
    expect(formularBild()?.getAttribute("src"), "die gepaarte Fußnote hat ihr Bild verloren").toBe(
      "/api/objects/bild-b/raw",
    );
  });

  it("H7 · der Gegenfall: die echte Fußnote bekommt weiterhin ihr Bild", () => {
    abbauen();
    mount(DOPPELKENNUNG);
    act(() => {
      fussnoteMitText("Echte").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(formulare().length).toBe(1);
    expect(formularText()).toBe("Echte");
    // Ohne diesen Fall wäre H6 auch dann grün, wenn die Korrektur JEDER Fußnote ihr Bild nähme.
    expect(formularBild()?.getAttribute("src"), "die echte Fußnote hat ihr Bild verloren").toBe(
      "/api/objects/echtes/raw",
    );
  });
});

describe("JOB 3041 · G — der Sprachwechsel am offenen Editor nimmt beide Texte mit", () => {
  it("G1 · Kennzeichnung und Beschriftung folgen DE → EN → NL sofort", async () => {
    // Kalibrierung: der Ausgangszustand ist der deutsche, sonst prüft der Test nichts.
    expect(fussnoteMitText(VERWAIST_OHNE_BILD).getAttribute("data-kw-nicht-zugeordnet")).toBe(
      i18n.getFixedT("de")("editor.captionUnassigned"),
    );

    for (const lng of ["en", "nl", "de"]) {
      await spracheWechseln(lng);
      const t = i18n.getFixedT(lng);
      const cap = fussnoteMitText(VERWAIST_OHNE_BILD);
      expect(
        cap.getAttribute("data-kw-nicht-zugeordnet"),
        `Nach dem Wechsel auf ${lng} steht die Kennzeichnung noch in der alten Sprache.`,
      ).toBe(t("editor.captionUnassigned"));
      expect(cap.getAttribute("aria-label")).toBe(t("editor.captionUnassignedLabel"));
    }
  });

  it("G2 · und der Inhalt wird dabei NICHT neu geschrieben", async () => {
    const knotenVorher = fussnoteMitText(VERWAIST_OHNE_BILD);
    const textVorher = knotenVorher.textContent;
    const ankerVorher = Array.from(container.querySelectorAll("[data-image-id]")).map((n) =>
      n.getAttribute("data-image-id"),
    );

    await spracheWechseln("nl");

    // Derselbe KNOTEN, nicht nur derselbe Text: ein Neuschreiben löste jedes offene Formular vom
    // DOM ab (die Begründung steht in editor-language-refresh-mounted.test.tsx, S-4).
    expect(fussnoteMitText(VERWAIST_OHNE_BILD)).toBe(knotenVorher);
    expect(fussnoteMitText(VERWAIST_OHNE_BILD).textContent).toBe(textVorher);
    expect(
      Array.from(container.querySelectorAll("[data-image-id]")).map((n) =>
        n.getAttribute("data-image-id"),
      ),
    ).toEqual(ankerVorher);
    expect(wertwechsel, "Der Sprachwechsel hat einen Wertwechsel ausgelöst.").toBe(0);
    expect(gesetzterWert).toBe(INHALT);
  });
});
