import { afterEach, describe, expect, it } from "vitest";
// @vitest-environment jsdom
// ================================================================================================
// JOB 1186 / I50-3 — DER DUBLETTENFALL AN DER *GLOBALEN* SUCHE, NICHT AN DEN HILFSFUNKTIONEN
// ================================================================================================
//
// ben zu JOB 1186 D1, woertlich: „Ein erneuter Test nur von `imageForCaption` oder
// `captionForImage` erfuellt diese Pflicht nicht." Und das trifft: der D1-Fall belegte den
// Ersttreffer in `editorFigures.ts` (`knotenMitKennung`), nicht in der SPAETEREN globalen
// Kennungssuche des Editors. Der Unterschied ist kein Detail — es sind zwei verschiedene Stellen
// mit zwei verschiedenen Mechaniken, und nur die zweite ist hier gemeint.
//
// DIE STELLE, UM DIE ES GEHT — `RichTextEditor.tsx:764-766`:
//     const image = Array.from(el.querySelectorAll("img[data-image-id]")).find(
//       (img) => img.getAttribute("data-image-id") === captionFormRequest.imageId,
//     );
// `Array.prototype.find` nimmt den ERSTEN Treffer. Bei doppelter `data-image-id` entscheidet damit
// die Dokumentreihenfolge, welches Bild das Formular bekommt.
//
// WARUM DIESE DATEI GEMOUNTET IST: `captionFormRequest` ist ein Prop (die Bitte der Galerie,
// mega69 Block A) und nur ueber einen echten Mount erreichbar. Das ist der Preis dafuer, an der
// richtigen Stelle zu messen statt daneben.
//
// WARUM SIE `.tsx` IST UND NICHT `.ts`: der Wurzel-Typpruefer ist Node-rein (`tsconfig.json`:
// `lib: ["ES2022"]`, kein `jsx`, `exclude: [… "tests/**/*.tsx" …]`). Gemountete React-Tests laufen
// durch `tsconfig.tests-tsx.json`, das `tests/**/*.tsx` einschliesst und `DOM` + `jsx` mitbringt.
// Diese Datei liegt deshalb in genau dem Pfad, den diese Konfiguration abdeckt.
//
// Muster und Werkzeug sind unveraendert die des Bestands (`editor-figure-caption-mounted.test.tsx`):
// react/react-dom relativ aus apps/web/node_modules, `createElement` statt JSX-Syntax, kein
// @testing-library — gebraucht werden nur mount/act/dispatch.
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
// i18n VOR dem Editor importieren: initialisiert react-i18next global (useTranslation ohne Provider).
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import {
  beschreibungsText,
  beschreibungsfeldOffen,
  mitBildbeschreibung,
} from "./bildbeschreibung-naht";

// React 18: act ausserhalb eines Test-Renderers verlangt dieses Flag.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ZWEI Bilder mit DERSELBEN Kennung — bens Fall. Unterschiedliche Quellen und unterschiedliche
// Fussnoten, damit ueberhaupt UNTERSCHEIDBAR ist, welches der beiden adressiert wurde.
//
// WARUM DIE FUSSNOTEN EIGENE KENNUNGEN TRAGEN — das ist kein Kunstgriff, sondern noetig, und es ist
// nachgemessen: `ensureImageAnchors` (editorFigures.ts) schreibt die Bildkennung auf eine einzelne
// kennungslose Fussnote. Traegen beide Fussnoten danach `kw-img-dup-1`, liefert `captionForImage`
// fuer BEIDE Bilder dieselbe (erste) Fussnote — der Test koennte dann nicht mehr unterscheiden,
// welches Bild die globale Suche gewaehlt hat, und waere ein Scheinbeleg. Mit je eigener
// Fussnotenkennung greift `gemeinsameKennung` nicht, es wird NICHTS ueberschrieben, und die Auswahl
// an `:764-766` schlaegt sichtbar bis ins Formular durch. Genau das ist der Fall
// „widerspruechliches oder fremdes Markup", um den es in I50 ohnehin geht.
const DUBLETTE =
  '<figure><img src="/api/objects/erstes/raw" data-image-id="kw-img-dup-1">' +
  '<figcaption data-image-id="kw-cap-erste">Erste</figcaption></figure>' +
  '<figure><img src="/api/objects/zweites/raw" data-image-id="kw-img-dup-1">' +
  '<figcaption data-image-id="kw-cap-zweite">Zweite</figcaption></figure>';

interface Bitte {
  imageId: string;
  src: string;
  index: number;
  nonce: number;
}

function DublettenHost({ anfrage }: { anfrage?: Bitte | undefined }) {
  const [wert, setWert] = useState(DUBLETTE);
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value: wert,
      documentTitle: "Dublettenprobe",
      onChange: (html: string) => setWert(html),
      ...(anfrage ? { captionFormRequest: anfrage } : {}),
    }),
  );
}

let behaelter: HTMLDivElement | null = null;
let wurzel: ReturnType<typeof createRoot> | null = null;

function montiere(anfrage?: Bitte): void {
  behaelter = document.createElement("div");
  document.body.appendChild(behaelter);
  wurzel = createRoot(behaelter);
  act(() => {
    wurzel?.render(createElement(DublettenHost, { anfrage }));
  });
}

/**
 * Die Bitte NACHTRAEGLICH stellen, in DERSELBEN Montage.
 *
 * GEMESSEN, und deshalb steht es hier: die frische Kennung, die die Entdublettierung vergibt, wird
 * je Verankerungslauf neu gezogen (`newImageRunToken`). Wer sie in einem Mount abliest und in einem
 * ZWEITEN verwendet, erbittet eine Kennung, die es dort nicht mehr gibt — das Formular bliebe zu,
 * und der Fall waere rot, ohne dass am Produkt etwas falsch ist. Dieselbe Wurzel neu zu rendern
 * haelt Zustand und Editor-DOM: `wert` aendert sich nicht, der Ladeeffekt haengt an
 * `[value, mode]` und laeuft nicht erneut — nur die Bitte ist neu.
 */
function bitteStellen(anfrage: Bitte): void {
  act(() => {
    wurzel?.render(createElement(DublettenHost, { anfrage }));
  });
}

// ACHTUNG, gemessene Falle: die Komponente traegt ZWEI Elemente mit `role="textbox"` — den
// Editor-Body und das Feld des Bildbeschreibungs-Formulars (`id="caption-form-text"`). Im JSX steht
// das Formular VOR dem Editor, ein blankes `querySelector('[role="textbox"]')` liefert also das
// FELD. Der Editor wird deshalb ueber seine eigene Klasse adressiert — sonst misst der Test die
// falsche Flaeche und wird gruen, ohne etwas zu belegen.
function editorFlaeche(): Element | null {
  return behaelter?.querySelector('div.prose-kw[role="textbox"]') ?? null;
}

// Das Vorschaubild DES FORMULARS: das einzige <img> ausserhalb der Editorflaeche.
function formularBild(): HTMLImageElement | null {
  const flaeche = editorFlaeche();
  for (const bild of Array.from(document.querySelectorAll("img"))) {
    if (flaeche === null || !flaeche.contains(bild)) {
      return bild;
    }
  }
  return null;
}

/** Die Bilder der Editorflaeche in Dokumentreihenfolge. */
function bilder(): HTMLImageElement[] {
  return [...(editorFlaeche()?.querySelectorAll("img") ?? [])] as HTMLImageElement[];
}

// ================================================================================================
// JOB 2084 · D1 (23.08.2026) — DIE ZUSAGE DIESER DATEI IST ABGELOEST. HIER STEHT WARUM.
// ================================================================================================
//
// BIS HIERHER STAND ALS ZUSAGE, im Titel des describe und im Namen des zweiten Falls:
//
//     „JOB 1186 / I50-3: die GLOBALE Kennungssuche liefert den ersten Treffer"
//     „BELEG AN DER ECHTEN STELLE: die Bitte adressiert das ERSTE Bild, nicht das zweite"
//     expect(bilder).toHaveLength(2);                                  // beide teilen die Kennung
//     expect(formularBild()?.getAttribute("src")).toBe("/api/objects/erstes/raw");
//
// DAS WAR KEINE GEWOLLTE EIGENSCHAFT, SONDERN DIE GEMESSENE FOLGE EINER LUECKE. Die Datei sagt es
// im eigenen Kopf: „`Array.prototype.find` nimmt den ERSTEN Treffer. Bei doppelter
// `data-image-id` entscheidet damit die Dokumentreihenfolge, welches Bild das Formular bekommt."
// Genau das ist der dritte Punkt aus bens Register I50 — der Nutzer beschreibt das falsche Bild.
//
// EIN PIN, DER EINE LUECKE FESTHAELT, IST MIT DEM SCHLIESSEN DER LUECKE ERFUELLT, NICHT VERLETZT.
// Er wird deshalb nicht geloescht, sondern umgeschrieben: dieselbe Datei, derselbe Aufbau,
// dieselbe Dublette, dieselbe gemessene Stelle — neue Zusage.
//
// GESCHLOSSEN WURDE SIE IN ZWEI HAELFTEN, und beide werden hier gemessen:
//   1. `ensureImageAnchors` laesst eine bereits beanspruchte Kennung kein zweites Mal fuehren —
//      dieselbe Regel, die `anchorFigures` im Sanitizer seit SHIP 12 fuehrt.
//   2. Die Bitte der Galerie traegt die OCCURRENCE (`src` und `index` des geoeffneten Eintrags),
//      und der Editor loest sie ueber `extractBodyImages` auf — dieselbe Ableitung, aus der die
//      Galerie ihre Liste bildet.
//
// Ohne (1) waere (2) wirkungslos: die Suche nach der Kennung des gewaehlten Eintrags traefe wieder
// zwei Bilder. Die beiden sind zwei Haelften EINES Vertrags.
describe("JOB 2084 / I50-3: die Bitte trifft das Bild, das der Nutzer gewaehlt hat", () => {
  afterEach(() => {
    act(() => {
      wurzel?.unmount();
    });
    behaelter?.remove();
    behaelter = null;
    wurzel = null;
  });

  it("KALIBRIERUNG: ohne captionFormRequest oeffnet der Editor kein Formular", () => {
    montiere(undefined);
    // Ohne diese Gegenprobe waere ein Formular, das sich aus irgendeinem anderen Grund oeffnet, in
    // den Faellen darunter ununterscheidbar von einem Treffer der Aufloesung.
    expect(beschreibungsfeldOffen()).toBe(false);
    expect(formularBild()).toBeNull();
  });

  it("HAELFTE 1: die Dublette ueberlebt das Verankern NICHT — jedes Bild traegt eine eigene Kennung", () => {
    montiere(undefined);
    const beide = bilder();

    // Vorbedingung: der Stand stellt wirklich diese zwei Bilder.
    expect(beide).toHaveLength(2);
    expect(beide[0]?.getAttribute("src")).toBe("/api/objects/erstes/raw");
    expect(beide[1]?.getAttribute("src")).toBe("/api/objects/zweites/raw");

    const erste = beide[0]?.getAttribute("data-image-id") ?? "";
    const zweite = beide[1]?.getAttribute("data-image-id") ?? "";
    expect(erste.length, "Das erste Bild hat gar keine Kennung").toBeGreaterThan(0);
    expect(zweite.length, "Das zweite Bild hat gar keine Kennung").toBeGreaterThan(0);
    expect(zweite, "Beide Bilder tragen weiterhin dieselbe Kennung").not.toBe(erste);

    // STABILITAET: das ERSTE behaelt seine — umbenannt wird nur, was die Kennung ein zweites Mal
    // beansprucht. Sonst waere die Reparatur selbst eine Quelle wechselnder Identitaeten.
    expect(erste, "Das erste Bild wurde umbenannt, obwohl es die Kennung zuerst hatte").toBe(
      "kw-img-dup-1",
    );
  });

  it("die Fussnoten bleiben bei IHREN Bildern — die Reparatur erzeugt keinen Zuordnungsschaden", () => {
    montiere(undefined);
    const fussnoten = [...(editorFlaeche()?.querySelectorAll("figcaption") ?? [])];
    expect(fussnoten).toHaveLength(2);
    expect(fussnoten[0]?.textContent).toBe("Erste");
    expect(fussnoten[1]?.textContent).toBe("Zweite");
    // Unangetastet: keine der beiden trug die alte Bildkennung, also wird an keiner geschrieben.
    expect(fussnoten[0]?.getAttribute("data-image-id")).toBe("kw-cap-erste");
    expect(fussnoten[1]?.getAttribute("data-image-id")).toBe("kw-cap-zweite");
  });

  it("HAELFTE 2, DIE KERNAUSSAGE: die Bitte fuer den ZWEITEN Eintrag oeffnet das ZWEITE Bild", () => {
    // Das ist der Fall, um den es in I50-3 geht. Vor diesem Bau oeffnete er das ERSTE Bild —
    // der Nutzer schrieb eine Beschreibung an ein Bild, das er nicht gewaehlt hatte.
    montiere(undefined);
    const zweiteKennung = bilder()[1]?.getAttribute("data-image-id") ?? "";

    // Die Galerie leitet aus dem UNVERANKERTEN Koerper ab: dort tragen beide noch `kw-img-dup-1`.
    // Genau diese (mehrdeutige) Kennung reist mit — zusammen mit der Occurrence, die sie eindeutig
    // macht: zweiter Eintrag, Quelle des zweiten Bildes.
    bitteStellen({
      imageId: "kw-img-dup-1",
      src: "/api/objects/zweites/raw",
      index: 1,
      nonce: 1,
    });

    expect(beschreibungsfeldOffen()).toBe(true);
    expect(
      formularBild()?.getAttribute("src"),
      "Die Bitte um das zweite Bild hat das erste geoeffnet",
    ).toBe("/api/objects/zweites/raw");
    expect(beschreibungsText(), "Das Formular zeigt die Beschreibung des falschen Bildes").toBe(
      "Zweite",
    );
    // Und es ist wirklich das zweite Bild des Editors, nicht ein zufaellig passendes.
    expect(zweiteKennung.length).toBeGreaterThan(0);
    expect(zweiteKennung).not.toBe("kw-img-dup-1");
  });

  it("und der ERSTE Eintrag bleibt erreichbar — der Bau darf ihn nicht verlieren", () => {
    montiere(undefined);
    bitteStellen({
      imageId: "kw-img-dup-1",
      src: "/api/objects/erstes/raw",
      index: 0,
      nonce: 2,
    });

    expect(beschreibungsfeldOffen()).toBe(true);
    expect(formularBild()?.getAttribute("src")).toBe("/api/objects/erstes/raw");
    expect(beschreibungsText()).toBe("Erste");
  });

  it("KEIN RATEN: eine Bitte, deren Occurrence und Quelle niemanden treffen, oeffnet NICHTS", () => {
    // Der Bestandsweg (Stufe 3) traegt nur bei GENAU EINEM Kennungstreffer. Hier gibt es die
    // Kennung `kw-img-dup-1` im DOM zwar noch (das erste Bild), aber die Bitte nennt eine Quelle,
    // die es nicht gibt, und eine Position ausserhalb der Liste. Ein stilles Oeffnen des ersten
    // Bildes waere genau der Schaden, den dieser Bau beendet.
    montiere(undefined);
    bitteStellen({
      imageId: "kw-img-nicht-vorhanden",
      src: "/api/objects/gibtsnicht/raw",
      index: 99,
      nonce: 3,
    });

    expect(beschreibungsfeldOffen(), "Es wurde auf Verdacht ein Formular geoeffnet").toBe(false);
    expect(formularBild()).toBeNull();
  });
});
