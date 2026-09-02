// @vitest-environment jsdom
// ================================================================================================
// JOB 2974 D3/D4 · F-0040 — DIE VORDERTUER NACH EINER ABGELEHNTEN FREMDKENNUNG.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. D1 belegte den Draht (403, kein Feld im Koerper). BEN hat das zu
// Recht als unvollstaendig beurteilt: „`app.inject()` belegt nur den Draht." Diese Datei faehrt
// die ECHTE Vordertuer gemountet und misst den vollstaendigen Uebergang:
//
//   Bodo hat SEINEN Entwurf offen  →  die Adresse wechselt auf Annas Kennung  →  403
//     ⇒ nichts von Anna erscheint,                                        (D3, Fall A)
//     ⇒ Bodos Inhalt bleibt stehen,                                       (D3, Fall B)
//     ⇒ die Adresse wird auf Bodos Kennung zurueckkorrigiert,             (D3, Fall C)
//     ⇒ Speichern AKTUALISIERT Bodos Entwurf statt einen zweiten anzulegen (D3, Fall D)
//     ⇒ und Bodos HERKUNFTSZIEL ist danach wirklich fortsetzbar.          (D4, Fall E)
//
// WARUM FALL D DER HARTE BELEG IST — BENs Promptverbesserung zu D2 im Wortlaut: „Im
// Integrationstest genuegt sichtbarer alter Formularinhalt nicht als Erhalt des eigenen
// Entwurfs." Das trifft den Befund aus D2 genau: Der Fehlerzweig raeumte die KENNUNG, nicht das
// Formular. Auf dem Bildschirm stand weiter Bodos Text, und `save` verzweigt an eben dieser
// Kennung — ein Klick auf „Entwurf speichern" haette einen ZWEITEN Entwurf angelegt.
//
// WARUM FALL E DAZUKOMMT — BENs Korrekturpflicht zu D3: Das Herkunftsziel lag bis dahin nur im
// Ausgangszustand und im Mock-Payload; es wurde nie gerendert, ausgeloest und geprueft. Und BENs
// Korrekturpflicht zu D4: der Test rief die Zielentscheidung und die Navigation SELBST auf und
// belegte damit die Hilfsfunktion, nicht den Weg des Menschen.
//
// FALL E FAEHRT DESHALB NUR NOCH ECHTE BEDIENELEMENTE — gefunden ueber Rolle (button) und
// sichtbaren Namen, ausgeloest per Klick, Ziel vom PRODUKT bestimmt:
//     „Eingabe verwerfen" → „Entwürfe anzeigen" → „Fortsetzen" → „Entwurf speichern" →
//     (das Produkt navigiert selbst zurueck) → „Entwürfe anzeigen" → „Fortsetzen"
// Der Test ruft `resumeTargetForDraft` NICHT auf und fuehrt die Zielnavigation NICHT selbst aus.
// Die einzige Navigation im Test ist der Aufruf der FREMDEN Kennung — das ist die zu pruefende
// Nutzerhandlung („jemand oeffnet einen verschickten Link"), nicht das Ziel.
//
// WARUM `.tsx`: `tests/**/*.test.ts` wird ohne DOM und ohne JSX typgeprueft (in D3 gemessen —
// TS6142 „`--jsx` is not set", TS2584 „Cannot find name 'document'"). Die Trennung von der
// Draht-Schwesterdatei ist technisch erzwungen, nicht Geschmack.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "bodo", name: "Bodo", email: "bodo@x.de", role: "experte" })),
    logout: vi.fn(async () => ({})),
  },
}));
// JOB 2974 D5: Der Testaufbau traegt jetzt BEIDE Flaechen — die Vordertuer UND die Erfassen-Seite
// mit ihrer Entwurfsliste. Grund steht bei Fall E: das echte Fortsetzungs-Bedienelement liegt in
// der Liste (`CaptureDraftList.tsx:233-240`), nicht in der Vordertuer. Die Ergaenzungen unten sind
// genau die, die `Capture` zum Mounten braucht (Muster:
// `tests/capture/draft-limits-visible-mounted.test.tsx:26-62`).
const BODOS_LISTENEINTRAG = vi.hoisted(() => ({
  id: "bodo-entwurf",
  updatedAt: "2026-09-02T09:00:00.000Z",
  payload: {
    title: "Bodos Foerderband",
    bodyHtml: "<p>Das Foerderband laeuft mit halber Last an.</p>",
    confidentiality: "intern",
    origin: "frontdoor",
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      drafts: {
        get: vi.fn(),
        list: ok([BODOS_LISTENEINTRAG]),
        create: vi.fn(async () => ({ id: "d-neu", payload: {} })),
        update: vi.fn(async () => ({
          id: "bodo-entwurf",
          payload: {},
          updatedAt: "2026-09-02T10:00:00.000Z",
        })),
        remove: vi.fn(async () => {}),
        promote: vi.fn(async () => ({})),
      },
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ stage: "search_on_click" }), search: ok([]) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        assist: vi.fn(async () => ({})),
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "../../apps/web/node_modules/react-router-dom";
import "../../apps/web/src/i18n";
import { ApiError } from "../../apps/web/src/api/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { CAPTURE_FRONT_DOOR_ROUTE } from "../../apps/web/src/lib/captureFrontDoor";
import { Capture } from "../../apps/web/src/pages/Capture";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};
// Browser-Schnittstelle, die jsdom nicht bedient — s. `zurueckAufDieErfassenSeite`.
window.confirm = () => true;

const BODOS_KENNUNG = "bodo-entwurf";
const ANNAS_KENNUNG = "annas-entwurf";
const BODOS_TITEL = "Bodos Foerderband";
const BODOS_BODY = "<p>Das Foerderband laeuft mit halber Last an.</p>";
const BODOS_STAND = "2026-09-02T09:00:00.000Z";
/** Bodos Entwurf entstand in der Vordertuer — das ist sein Herkunftsziel. */
const BODOS_HERKUNFT = "frontdoor";
const ANNAS_TITEL_UI = "Annas Querstromventilhaube";
const ANNAS_BODY_UI = "<p>Annas vertraulicher Absatz.</p>";

const holen = endpoints.drafts.get as unknown as ReturnType<typeof vi.fn>;
const aktualisieren = endpoints.drafts.update as unknown as ReturnType<typeof vi.fn>;
const anlegen = endpoints.drafts.create as unknown as ReturnType<typeof vi.fn>;

/** Genau der Nutzlastteil, den der Server fuer Bodos Entwurf ausliefert. */
const BODOS_NUTZLAST = {
  title: BODOS_TITEL,
  bodyHtml: BODOS_BODY,
  confidentiality: "intern",
  origin: BODOS_HERKUNFT,
};

let behaelter: HTMLDivElement;
let wurzel: ReturnType<typeof createRoot> | null = null;
/** Vom Steuerbaustein gesetzt: erlaubt den Adresswechsel OHNE neu zu mounten. */
let navigiere: ((zu: string) => void) | null = null;
/** Die Adresse, die der Router GERADE fuehrt — inklusive Suchteil. */
let adresse = "";

function Steuerung(): null {
  navigiere = useNavigate();
  const ort = useLocation();
  adresse = `${ort.pathname}${ort.search}`;
  return null;
}

function mounten(start: string): void {
  behaelter = document.createElement("div");
  document.body.appendChild(behaelter);
  wurzel = createRoot(behaelter);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    wurzel?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                MemoryRouter,
                { initialEntries: [start] },
                createElement(
                  ImageDescribeProvider,
                  null,
                  createElement(
                    NavGuardProvider,
                    null,
                    createElement(Steuerung, null),
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: CAPTURE_FRONT_DOOR_ROUTE,
                        element: createElement(CaptureFrontDoor),
                      }),
                      // JOB 2974 D5: die Erfassen-Seite gehoert in denselben Router — nur so kann
                      // der Test die ECHTE Fortsetzung ueber ihr Bedienelement fahren, statt selbst
                      // zu navigieren.
                      createElement(Route, {
                        path: "/erfassen",
                        element: createElement(Capture),
                      }),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
}

async function beruhigen(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

/**
 * Der Ausgangszustand des Nutzerwegs: Bodo hat SEINEN Entwurf offen.
 *
 * Ohne diesen Schritt gaebe es keine „eigene aktive Kennung", die verloren gehen koennte — der
 * Fehler entsteht erst im UEBERGANG von der eigenen zur fremden Kennung.
 */
async function bodoHatSeinenEntwurfOffen(): Promise<void> {
  holen.mockImplementation(async (id: string) => {
    if (id === BODOS_KENNUNG) {
      return { id: BODOS_KENNUNG, updatedAt: BODOS_STAND, payload: { ...BODOS_NUTZLAST } };
    }
    // Genau die Antwort, die der Server laut D1 wirklich gibt (`requireVisibleDraft:88-90`).
    throw new ApiError(403, "FORBIDDEN", "Entwurf nicht verfuegbar.");
  });
  mounten(`${CAPTURE_FRONT_DOOR_ROUTE}?draft=${BODOS_KENNUNG}`);
  await beruhigen();
}

/** Der Adresswechsel auf die fremde Kennung — ohne Neumounten, wie im echten Router. */
async function wechselAufAnna(): Promise<void> {
  await act(async () => {
    navigiere?.(`${CAPTURE_FRONT_DOOR_ROUTE}?draft=${ANNAS_KENNUNG}`);
  });
  await beruhigen();
}

/**
 * Ein Bedienelement ueber Rolle (`button`) und sichtbaren Namen — so, wie ein Mensch es findet.
 *
 * Bewusst kein `data-testid`: der Auftrag verlangt Rolle und sichtbaren Namen. Faellt die
 * Beschriftung weg oder aendert sie sich, findet dieser Helfer nichts und der Fall wird rot —
 * das ist gewollt.
 */
function knopfMitNamen(name: string): HTMLButtonElement {
  const alle = [...behaelter.querySelectorAll("button")];
  const treffer = alle.filter((b) => (b.textContent ?? "").replace(/\s+/g, " ").includes(name));
  // Die Fehlermeldung nennt, was STATTDESSEN da ist. Ohne das sucht der naechste Leser blind.
  expect(
    treffer.length,
    `Kein sichtbarer Knopf „${name}" gefunden. Vorhanden: ${alle
      .map((b) => `„${(b.textContent ?? "").replace(/\s+/g, " ").trim()}"`)
      .join(", ")}`,
  ).toBeGreaterThan(0);
  return treffer[0] as HTMLButtonElement;
}

/** Ein echter Nutzerklick auf das gefundene Bedienelement — ueber seinen Produkt-Handler. */
async function klicken(knopf: HTMLButtonElement): Promise<void> {
  expect(knopf.disabled, "Das Bedienelement ist gesperrt").toBe(false);
  await act(async () => {
    knopf.click();
  });
  await beruhigen();
}

/**
 * Der Rueckweg der Vordertuer auf die Erfassen-Seite — ueber das ECHTE Bedienelement.
 *
 * ES HEISST „Eingabe verwerfen", NICHT „Zurück", und das ist gemessen, nicht geraten:
 * `CaptureFrontDoor.tsx:1599` beschriftet den Knopf mit
 * `hasDiscardRisk ? t("fd.discardInput") : t("fd.back")`, und `hasDiscardRisk` (`:297-303`) ist
 * wahr, sobald `activeDraftId !== null` — also genau dann, wenn Bodos Entwurf offen ist. Der
 * Rueckweg der Vordertuer ist mit offenem Entwurf IMMER der Verwerfen-Weg.
 *
 * `window.confirm` wird dafuer beantwortet: es ist eine Browser-Schnittstelle, die jsdom nicht
 * bedient (sie liefert `undefined`, der Handler braeche ab). Das Produkt selbst wird nicht
 * angefasst — der Handler `discardInputAndReturn` (`:375-385`) laeuft unveraendert.
 *
 * DASS DER WEG UEBER EIN VERWERFEN FUEHRT, SCHWAECHT DEN BELEG NICHT — er verschaerft ihn: die
 * Fluechtigen Formularinhalte sind danach weg, und was die Fortsetzung gleich findet, kann nur
 * vom SERVER kommen. Genau das soll `origin` ja ueberleben.
 */
async function zurueckAufDieErfassenSeite(): Promise<void> {
  await klicken(knopfMitNamen("Eingabe verwerfen"));
  expect(adresse, "Der Rueckweg der Vordertuer fuehrt nicht auf die Erfassen-Seite").toBe(
    "/erfassen",
  );
}

/**
 * Die Entwurfsliste aufklappen — auch das ist ein echtes Bedienelement des Nutzers.
 *
 * Sie startet zugeklappt (`Capture.tsx:797`, `useState(false)`), und der Umschalter traegt
 * „Entwürfe anzeigen ({count})" (`CaptureDraftList.tsx:114-121`, `capture.resumeExpand`).
 * Erst aufgeklappt rendert die Liste ihre Eintraege — und damit den Fortsetzen-Knopf.
 */
async function entwurfslisteAufklappen(): Promise<void> {
  await klicken(knopfMitNamen("Entwürfe anzeigen"));
}

/** Der Speichern-Knopf der Vordertuer, ueber seinen sichtbaren Text gefunden. */
function speichernKnopf(): HTMLButtonElement {
  return knopfMitNamen("Entwurf speichern");
}

afterEach(() => {
  if (wurzel) {
    const w = wurzel;
    act(() => {
      w.unmount();
    });
    behaelter.remove();
    wurzel = null;
  }
  navigiere = null;
  adresse = "";
  vi.clearAllMocks();
});

describe("JOB2974 D3/D4 · F-0040 — die Vordertuer nach einer abgelehnten Fremdkennung", () => {
  it("VORBEDINGUNG: Bodos eigener Entwurf ist wirklich offen", async () => {
    // Ohne diese Kalibrierung waeren alle Faelle darunter auch dann gruen, wenn gar nichts geladen
    // haette — „Annas Daten fehlen" ist trivial, wenn ueberhaupt nichts da ist.
    await bodoHatSeinenEntwurfOffen();

    expect(holen).toHaveBeenCalledWith(BODOS_KENNUNG);
    expect((behaelter.querySelector("input") as HTMLInputElement | null)?.value).toBe(BODOS_TITEL);
    expect(behaelter.querySelector("[contenteditable]")?.innerHTML).toContain("halber Last");
  });

  it("A · nach der 403 erscheint NICHTS von Anna", async () => {
    await bodoHatSeinenEntwurfOffen();
    await wechselAufAnna();

    const gesehen = behaelter.textContent ?? "";
    const roh = behaelter.innerHTML;
    expect(gesehen, "Annas Titel erscheint im UI").not.toContain(ANNAS_TITEL_UI);
    expect(roh, "Annas Body erscheint im UI").not.toContain(ANNAS_BODY_UI);
    expect(roh, "Annas Kennung erscheint im UI").not.toContain(ANNAS_KENNUNG);
  });

  it("B · Bodos Inhalt bleibt stehen", async () => {
    await bodoHatSeinenEntwurfOffen();
    await wechselAufAnna();

    expect(
      (behaelter.querySelector("input") as HTMLInputElement | null)?.value,
      "Bodos Titel ist aus dem Formular verschwunden",
    ).toBe(BODOS_TITEL);
    expect(behaelter.querySelector("[contenteditable]")?.innerHTML).toContain("halber Last");
  });

  it("C · VARIANTE A: die Adresse zeigt wieder Bodos Kennung", async () => {
    // Ownerentscheidung (Pedi-Kanal): die abgelehnte fremde Kennung darf nicht in der Adresse
    // stehen bleiben — sonst fragt ein Neuladen der Seite genau sie erneut an.
    await bodoHatSeinenEntwurfOffen();
    await wechselAufAnna();

    expect(adresse, "Die abgelehnte fremde Kennung steht noch in der Adresse").not.toContain(
      ANNAS_KENNUNG,
    );
    expect(adresse, "Die Adresse zeigt nicht wieder Bodos Kennung").toContain(
      `draft=${BODOS_KENNUNG}`,
    );
  });

  it("D · DER HARTE BELEG: Speichern aktualisiert Bodos Entwurf und legt keinen zweiten an", async () => {
    // Sichtbarer Text genuegt nicht (BENs Promptverbesserung). Erst hier zeigt sich, ob die
    // ZUGEHOERIGKEIT erhalten ist: `save` verzweigt an `activeDraftId`.
    await bodoHatSeinenEntwurfOffen();
    await wechselAufAnna();

    const knopf = speichernKnopf();
    expect(
      knopf.disabled,
      "Der Speichern-Knopf ist gesperrt — dann ist Bodos Entwurf nicht mehr sicherbar",
    ).toBe(false);

    await act(async () => {
      knopf.click();
    });
    await beruhigen();

    expect(
      anlegen,
      "Es wurde ein ZWEITER Entwurf angelegt — Bodos Entwurf bleibt auf dem alten Stand zurueck",
    ).not.toHaveBeenCalled();
    expect(aktualisieren, "Bodos Entwurf wurde nicht aktualisiert").toHaveBeenCalled();
    expect(
      (aktualisieren.mock.calls[0] as unknown[])[0],
      "Gespeichert wurde unter einer anderen Kennung als Bodos",
    ).toBe(BODOS_KENNUNG);
  });

  // ==============================================================================================
  // JOB 2974 D5 — DIE FORTSETZUNG UEBER DAS ECHTE BEDIENELEMENT, NICHT UEBER DEN TEST.
  // ==============================================================================================
  //
  // WAS D4 FALSCH MACHTE, und BEN hat recht: Der Fall rief `resumeTargetForDraft` selbst auf und
  // navigierte selbst. Damit war die HILFSFUNKTION belegt, nicht der Weg, den ein Mensch geht.
  //
  // WO DAS ECHTE BEDIENELEMENT LIEGT — in diesem Durchgang gemessen, nicht angenommen: NICHT in
  // der Vordertuer. Alle ihre Ausgaenge fuehren nach `/erfassen`
  // (`CaptureFrontDoor.tsx:375-385` `discardInputAndReturn`, dazu die Wege unter „Weitere Wege");
  // keiner fuehrt zu einem Entwurf. Das ist folgerichtig: Bodos Herkunftsziel IST die Vordertuer —
  // auf der Seite, auf der man schon steht, gibt es keinen Knopf „hierher zurueck".
  //
  // Das Fortsetzungs-Bedienelement steht in der Entwurfsliste der Erfassen-Seite:
  //     apps/web/src/components/CaptureDraftList.tsx:233-240   <button> „Fortsetzen" → onResume(d)
  //     apps/web/src/pages/Capture.tsx:4157                    onResume={loadDraft}
  //     apps/web/src/pages/Capture.tsx:1963-1987               loadDraft → target „frontdoor"
  //                                                            → guardedNavigate(…?draft=<id>)
  //
  // DESHALB FAEHRT DIESER FALL ZWEI ECHTE KLICKS und keine Testnavigation:
  //     „Zurück"      (Vordertuer)      → Produkt-Handler navigiert nach /erfassen
  //     „Fortsetzen"  (Entwurfsliste)   → Produkt-Handler navigiert zu Bodos Herkunftsziel
  // Der Test berechnet kein Ziel und ruft `resumeTargetForDraft` nicht auf.
  it("E · Bodos Herkunftsziel: echtes Bedienelement, echter Handler, echtes Ziel", async () => {
    await bodoHatSeinenEntwurfOffen();
    await wechselAufAnna();

    // (1) GERENDERT: Nach 403 und Adresskorrektur ist Bodos Entwurf wirklich wieder GELADEN —
    //     nicht nur eine Kennung im Zustand.
    expect(
      behaelter.textContent ?? "",
      "Die Vordertuer meldet keinen offenen Entwurf — dann ist Bodos Entwurf nicht wieder aktiv",
    ).toContain("Vordertür-Entwurf geöffnet");
    expect(
      holen.mock.calls.filter((c) => c[0] === BODOS_KENNUNG).length,
      "Bodos Entwurf wurde nach der Adresskorrektur nicht erneut geladen",
    ).toBeGreaterThanOrEqual(2);

    // (2) ERSTER ECHTER KLICK: der Rueckweg der Vordertuer. Sein Handler navigiert
    //     (`CaptureFrontDoor.tsx:375-385`) — der Test tut es nicht.
    await zurueckAufDieErfassenSeite();
    await entwurfslisteAufklappen();

    // (3) ZWEITER ECHTER KLICK: das Fortsetzen-Bedienelement der Entwurfsliste, ueber Rolle
    //     (button) und sichtbaren Namen gefunden. Sein Handler entscheidet das Ziel.
    await klicken(knopfMitNamen("Fortsetzen"));

    // (4) GELANDET: an BODOS Herkunftsziel mit BODOS Kennung — vom Produkt bestimmt, nicht vom
    //     Test. Annas Kennung kommt nirgends mehr vor.
    expect(adresse, "Die Fortsetzung fuehrt nicht an Bodos Herkunftsziel").toBe(
      `${CAPTURE_FRONT_DOOR_ROUTE}?draft=${BODOS_KENNUNG}`,
    );
    expect(adresse).not.toContain(ANNAS_KENNUNG);
    expect((behaelter.querySelector("input") as HTMLInputElement | null)?.value).toBe(BODOS_TITEL);
    expect(behaelter.textContent ?? "").toContain("Vordertür-Entwurf geöffnet");

    // (5) SPEICHERN: unter Bodos Kennung, mit Bodos Versionsstand.
    //     Danach bringt die Vordertuer den Menschen SELBST zurueck zur Entwurfsliste
    //     (`CaptureFrontDoor.tsx:712-719`, `navigate("/erfassen", { replace: true, state:
    //     { frontDoorDraftSaved … } })`) — in diesem Durchgang gemessen. Der Test navigiert also
    //     auch hier nicht; er stellt nur fest, wo das Produkt ihn hinbringt.
    await klicken(speichernKnopf());
    expect(
      adresse,
      "Nach dem Speichern bringt die Vordertuer den Nutzer nicht zur Entwurfsliste zurueck",
    ).toBe("/erfassen");

    expect(
      anlegen,
      "Nach der Fortsetzung wurde ein zweiter Entwurf angelegt",
    ).not.toHaveBeenCalled();
    const [kennung, rumpf, zusatz] = aktualisieren.mock.calls[0] as [
      string,
      Record<string, unknown>,
      { expectedUpdatedAt?: string } | undefined,
    ];
    expect(kennung, "Gespeichert wurde unter einer fremden Kennung").toBe(BODOS_KENNUNG);
    expect(
      zusatz?.expectedUpdatedAt,
      "Der gesehene Versionsstand reist nicht mit — der Standwaechter aus JOB 2684 liefe leer",
    ).toBe(BODOS_STAND);

    // DAS HERKUNFTSZIEL WIRD ERHALTEN, INDEM ES NICHT MITREIST — Absicht, kein Mangel.
    // `captureFrontDoor.ts:166-167` im Wortlaut: „`origin` REIST BEIM AENDERN NICHT MEHR MIT: Ein
    // Entwurf wechselt seine Herkunft nicht, weil ihn jemand einmal woanders geoeffnet hat."
    // Der Server behaelt den Altwert, wenn der Schluessel fehlt (`service.ts:371-372`). Wuerde die
    // Vordertuer `origin: "frontdoor"` mitschicken, wuerde ein STUDIO-Entwurf beim ersten Speichern
    // dauerhaft zum Vordertuer-Entwurf — genau der Verlustpfad, den `:143-146` beschreibt.
    expect(
      Object.hasOwn(rumpf, "origin"),
      "Der Aenderungsrumpf traegt `origin` — dann kann ein Entwurf seine Herkunft verlieren",
    ).toBe(false);

    // (6) ZUSTANDSBEHAFTETER NACHWEIS: dieselbe Aktion ein ZWEITES Mal, NACH dem Speichern.
    //     Nur so zeigt sich, dass `origin` das Update ueberlebt hat — haette es der Rumpf
    //     mitgenommen oder geloescht, fuehrte die Fortsetzung jetzt woandershin.
    await entwurfslisteAufklappen();
    await klicken(knopfMitNamen("Fortsetzen"));
    expect(
      adresse,
      "Nach dem Speichern fuehrt die Fortsetzung nicht mehr an Bodos Herkunftsziel — `origin` hat das Update nicht ueberlebt",
    ).toBe(`${CAPTURE_FRONT_DOOR_ROUTE}?draft=${BODOS_KENNUNG}`);
    expect((behaelter.querySelector("input") as HTMLInputElement | null)?.value).toBe(BODOS_TITEL);
  });
});
