// ================================================================================================
// FE-003 · DIE VORFÜHRUNG „FRAGEN“ — die echten Bausteine der Fragenfläche mit Demo-Zuständen.
// ================================================================================================
//
// WAS HIER GERENDERT WIRD, IST DIE ECHTE FLÄCHE IN KLEIN — NICHT EINE NACHZEICHNUNG:
//   · `FrageFeld`              — dasselbe Formular wie auf `/fragen` (Eingabe, Beispiele, Senden).
//   · `AntwortPlatzhalter`     — dieselben Wartezeilen.
//   · `AntwortText`            — derselbe Textsatz mit Fussnotenmarken.
//   · `AiGeneratedNotice`      — dieselbe KI-Kennzeichnung.
//   · `QuellenChipInhalt`      — derselbe Quellen-Chip an der Antwort (Punkt-Regel `chipPunkt`).
//   · `OverflowMenu`           — dasselbe Menü „…“ an der Antwortkarte (Drucken, Markdown, Mehr).
//   · `Seitenblatt`            — dasselbe Blatt „Mehr zu dieser Antwort“.
//   · `QuellenListe`           — dieselbe Quellenliste darin (Verwendung, Prüfstand, Nutzbarkeit,
//                                Kennzeichen und `AnswerSourceDetails` mit Kurzvorschau, Original
//                                und Auszug im Dokumentformat).
// DER QUELLENWEG IST DER DER SEITE (Bens Befund Runde 1): Chip an der Antwort, „…“ → „Mehr …“ →
// Quellenliste. Die Zeile der Demo-Quelle entsteht aus denselben Ableitungen wie auf der Seite
// (`conflictAwareSourceRefs`, `attributeSources`, `anzeigestatusAus`).
//   · `KiNichtVerfuegbar`      — derselbe Satz samt denselben rollenabhängigen Alternativen.
// Ändert sich einer dieser Bausteine, ändert sich die Vorführung mit (Kriterium 4; die gerenderte
// Änderungsprobe steht in `tests/fe003-tutorial-fragen/`).
//
// WAS HIER NICHT PASSIERT — die Demo-Grenze (Kriterium 5):
//   · Keine Mutation, kein Aufruf von `endpoints.ask`, keine Frage, kein Dokument, keine Freigabe.
//     Diese Datei importiert weder den API-Client noch einen Mutations-Haken. Das „Absenden“ in
//     der Demo ist ein Anzeigewechsel.
//   · Kein KI-Modell nötig: die Beispielantwort ist fester, übersetzter Text.
//   · Keine erfundene Live-Quelle: die Demo-Quelle ist ein fiktives Objekt OHNE Kennung im Bestand,
//     ohne Originaldatei und ohne Adresse. Auf der Seite führt der Chip zum Wissensobjekt; die
//     Demo-Quelle hat keines — ihr Chip sagt das, statt auf eine Seite zu zeigen, die es nicht
//     gibt. Die Quellenliste bekommt deshalb keinen Titel-Link und kein „Danke“ (`wissenHref`/
//     `dank` = `null`). „Drucken“/„Als Markdown“ im Menü bleiben stehen und sagen, dass die
//     Vorführung nichts druckt oder speichert. Verweise innerhalb der Demo fängt der Rahmen ab.
//   · Alles trägt sichtbar „Demo“ / „fiktiv“ — Antwort, Quelle, Übungsantwort.
//
// DIE LÜCKENKARTE wird hier aus denselben Texten und derselben Vertragsableitung
// (`answerContract("gap")`) gezeigt wie auf der Seite; ihr Kopf ist kein eigener Baustein (Begründung
// in `components/fragen/Antwortbausteine.tsx`).
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useReasonerStatus } from "../../api/hooks";
import type { KnowledgeObject } from "../../api/types";
import { AiGeneratedNotice } from "../../components/AiGeneratedNotice";
import { AntwortPlatzhalter, KiNichtVerfuegbar } from "../../components/fragen/Antwortbausteine";
import { FrageFeld } from "../../components/fragen/FrageFeld";
import { QuellenListe, type QuellenZeile } from "../../components/fragen/QuellenListe";
import {
  QUELLEN_CHIP_KLASSE,
  QuellenChipInhalt,
  chipPunkt,
} from "../../components/fragen/Quellenplaketten";
import { ANTWORT_MENUEPUNKTE } from "../../components/fragen/antwortMenue";
import { FRAGEN_ZIEL } from "../../components/fragen/ziele";
import { AntwortText } from "../../components/start/AntwortText";
import { OverflowMenu } from "../../components/start/OverflowMenu";
import { Seitenblatt } from "../../components/start/Seitenblatt";
import { Card } from "../../components/ui";
import { answerContract } from "../../lib/askAnswerContract";
import { attributeSources } from "../../lib/askCitedSources";
import { conflictAwareSourceRefs } from "../../lib/askView";
import { anzeigestatusAus } from "../../lib/displayStatus";
import { useAiAvailable } from "../../lib/useAiAvailable";
import type { TutorialDemoProps, TutorialUebergangProps } from "../typen";

/** Takt der Tippvorführung je Zeichen (ms). */
const TIPP_MS = 60;

/** So lange „wartet“ die Übung, bevor die Übungsantwort erscheint (ms). */
const UEBUNG_WARTEN_MS = 1500;

function html(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Die fiktive Demo-Quelle. Sie existiert NUR hier: ihre Kennung steht in keinem Bestand, sie hat
 * keine Datei und keine Adresse — `AnswerSourceDetails` zeigt deshalb, wie bei jeder solchen
 * Quelle, den ehrlichen Satz „kein Original“. `demoSeed` kennzeichnet sie wie jedes Demo-Wissen.
 */
function useDemoQuelle(status: KnowledgeObject["status"]): KnowledgeObject {
  const { t, i18n } = useTranslation();
  // biome-ignore lint/correctness/useExhaustiveDependencies: Sprache ist die Absichts-Abhängigkeit.
  return useMemo(
    () => ({
      id: "tutorial-demo-homeoffice",
      title: t("tutorial.fragen.demo.quelle.titel"),
      statement: t("tutorial.fragen.demo.quelle.kernaussage"),
      bodyHtml: `<h3>${html(t("tutorial.fragen.demo.quelle.abschnitt"))}</h3><p>${html(
        t("tutorial.fragen.demo.quelle.auszug"),
      )}</p>`,
      conditions: [],
      measures: [],
      type: "best_practice",
      category: t("tutorial.demo.kennzeichen"),
      tags: [],
      confidence: 90,
      trust: 90,
      status,
      version: 1,
      originalAuthor: "tutorial-demo",
      author: "tutorial-demo",
      neededValidations: 0,
      assignments: [],
      asset: null,
      createdAt: "2026-09-26T00:00:00.000Z",
      history: [],
      // Keine Datei, keine Adresse: `AnswerSourceDetails` sagt dann ehrlich „kein Original“.
      sources: [],
      demoSeed: true,
    }),
    [i18n.language, status],
  );
}

/**
 * Die Zeile der Demo-Quelle — aus DENSELBEN Ableitungen wie auf der Seite: Nutzbarkeit, Konflikt-
 * und Prüfstand-Auskunft (`conflictAwareSourceRefs`), Verwendung (`attributeSources`), Prüfstand
 * als Wort (`anzeigestatusAus`). „Unsicher“ ist der Fall ohne verwertbare Zuordnung.
 */
function demoZeile(
  ko: KnowledgeObject,
  unsicher: boolean,
  t: (k: string, o: Record<string, unknown>) => string,
): QuellenZeile & { validated: boolean | null } {
  const [ref] = attributeSources(
    conflictAwareSourceRefs([ko.id], [ko], []),
    unsicher ? [] : [ko.id],
  );
  if (!ref) {
    throw new Error("Demo-Quelle ohne Zeile");
  }
  const stand = anzeigestatusAus(ko, { konflikt: ref.conflictLimited }).status;
  const standWort = t(`status.${stand}`, {});
  return {
    ...ref,
    verwendung: unsicher ? "unbekannt" : "verwendet",
    pruefstand: stand,
    pruefstandWort: standWort,
    pruefstandHinweis: t("ask.pruefstand.hint", { stand: standWort }),
  };
}

/** Die gestellte Frage als gedämpfte Zeile — wie `ask-fragezeile` auf der Seite. */
function Fragezeile({ text }: { text: string }): JSX.Element {
  return <p className="min-w-0 text-[14px] text-muted-2">{text}</p>;
}

/** Was an der Antwortkarte der Vorführung offen ist — vom Aufrufer gehalten. */
interface KartenLage {
  /** Die Tutorial-Steuerung, die im Blatt „Mehr“ mitsteht (siehe `TutorialDemoProps`). */
  begleitung: ReactNode;
  chipOffen: boolean;
  onChip: () => void;
  mehrOffen: boolean;
  onMehr: (offen: boolean) => void;
}

/**
 * Die Antwortkarte der Vorführung. Die Hülle ist `Card` wie auf der Seite — ohne `print-area`:
 * eine Demoantwort darf nicht als echter Antwortauszug gedruckt werden. Rechts oben steht
 * dasselbe Menü „…“ wie an der echten Karte; „Mehr …“ öffnet dasselbe Blatt mit derselben
 * Quellenliste.
 */
function DemoAntwortKarte({
  lage,
  unsicher = false,
  uebung = false,
}: {
  lage: KartenLage;
  unsicher?: boolean;
  uebung?: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const quelle = useDemoQuelle(unsicher ? "offen" : "validiert");
  const zeile = demoZeile(quelle, unsicher, (k, o) => t(k, o));
  const hinweisId = useId();
  const griffRef = useRef<HTMLButtonElement | null>(null);
  const [menueHinweis, setMenueHinweis] = useState(false);
  return (
    <Card className="relative mt-0 flex flex-col gap-3 !rounded-[14px] border-hairline px-5 py-4 shadow-tile">
      <span className="self-start rounded-pill bg-ai-surface-1 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-ai">
        {uebung
          ? t("tutorial.fragen.demo.uebungsantwort")
          : t("tutorial.fragen.demo.beispielantwort")}
      </span>
      <div data-tutorial-ziel={FRAGEN_ZIEL.antworttext}>
        <AntwortText
          text={t("tutorial.fragen.demo.antwort")}
          quellen={1}
          tragend={unsicher ? undefined : [1]}
          className="ask-answer-body text-[15px] leading-[1.6] text-text"
        />
      </div>
      <p className="m-0" data-tutorial-ziel={FRAGEN_ZIEL.kiHinweis}>
        <AiGeneratedNotice />
      </p>
      <div className="flex flex-wrap gap-2 border-t border-hairline pt-3">
        <button
          type="button"
          data-tutorial-ziel={FRAGEN_ZIEL.quellenchip}
          data-testid="tutorial-demo-chip"
          aria-expanded={lage.chipOffen}
          aria-controls={hinweisId}
          onClick={lage.onChip}
          className={QUELLEN_CHIP_KLASSE}
        >
          <QuellenChipInhalt
            punkt={chipPunkt(zeile)}
            punktHinweis={zeile.pruefstandHinweis}
            pruefstand={zeile.pruefstand}
            nummer={1}
            label={zeile.label}
            verwendung={zeile.verwendung}
          />
        </button>
      </div>
      <div id={hinweisId}>
        {lage.chipOffen ? (
          <p
            data-testid="tutorial-demo-chip-hinweis"
            className="rounded-btn bg-ai-surface-2 px-2.5 py-2 text-[12px] leading-relaxed text-ai"
          >
            {t("tutorial.fragen.demo.chip", { mehr: t("ask.menu.mehr") })}
          </p>
        ) : null}
      </div>
      {menueHinweis ? (
        <p
          data-testid="tutorial-demo-menue-hinweis"
          className="rounded-btn bg-ai-surface-2 px-2.5 py-2 text-[12px] text-ai"
        >
          {t("tutorial.fragen.demo.menueNichts")}
        </p>
      ) : null}
      {/* Dasselbe „…“ wie an der echten Antwortkarte, mit denselben Punkten. */}
      <div className="absolute right-3 top-3" data-tutorial-ziel={FRAGEN_ZIEL.menue}>
        <OverflowMenu
          label={t("ask.menu.label")}
          testId="tutorial-demo-menue"
          griffRef={griffRef}
          punkte={ANTWORT_MENUEPUNKTE.map((p) => ({ id: p.id, label: t(p.labelKey) }))}
          onWahl={(id) => {
            if (id === "mehr") {
              setMenueHinweis(false);
              lage.onMehr(true);
              return;
            }
            setMenueHinweis(true);
          }}
        />
      </div>
      {lage.mehrOffen ? (
        <Seitenblatt
          titel={t("ask.menu.label")}
          testId="tutorial-demo-mehr"
          onSchliessen={() => lage.onMehr(false)}
          ausloeser={() => griffRef.current}
        >
          {/* Auch das Blatt ist Demo — gekennzeichnet und als Wurzel der Vorführung markiert, damit
              der Rahmen seine Ziele findet und seine Verweise abfängt. */}
          {lage.begleitung}
          <div data-tutorial-demo="fragen" className="tutorial-demo">
            <p className="mb-2 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-2">
              <span className="rounded-pill bg-ai-surface-1 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ai">
                {t("tutorial.demo.kennzeichen")}
              </span>
              {t("tutorial.fragen.demo.mehrHinweis")}
            </p>
            <QuellenListe
              quellen={[zeile]}
              zuordnungTragfaehig={!unsicher}
              wissenHref={null}
              bildfundstelle={() => false}
              koVon={(id) => (id === quelle.id ? quelle : undefined)}
              autorVon={() => t("tutorial.fragen.demo.quelle.autor")}
              standBestaetigt
              dank={null}
            />
          </div>
        </Seitenblatt>
      ) : null}
    </Card>
  );
}

/**
 * Der Zustand der Antwortkarte: Chip-Erklärung und Blatt „Mehr“ — schliessbar, wie er geöffnet wurde.
 * Mit `gefuehrt` gehört das Blatt nicht der Karte, sondern dem Aufrufer: es ist genau dann offen, wenn
 * er es sagt, gleich über welchen Weg es geöffnet wurde (Ben, Runde 3 von Lauf 1).
 *
 * Ohne `gefuehrt` (Antwort, Sonderfälle, Übung) liegt KEIN Ziel des Schritts im Blatt. Öffnet der
 * Nutzer es selbst, hält die Vorführung an (sie zeigte sonst hinter die Modalgrenze); wählt er in der
 * Begleitung einen Teil, schliesst das Blatt — das gewählte Ziel ist sofort bedienbar (Lauf 3, Bens
 * Befund d0496390 über das Kapitel „Quelle“ hinaus).
 */
function useKartenLage(
  begleitung: ReactNode,
  zuruecksetzen: unknown,
  teilWahl: number,
  anhalten: () => void,
  gefuehrt?: { offen: boolean; setzen: (offen: boolean) => void },
): KartenLage {
  const [chipOffen, setChipOffen] = useState(false);
  const [mehrNutzer, setMehrNutzer] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: der Zurücksetz-Schlüssel ist der Auslöser.
  useEffect(() => {
    setChipOffen(false);
    setMehrNutzer(false);
  }, [zuruecksetzen]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: jede Teilwahl ist der Auslöser.
  useEffect(() => {
    setMehrNutzer(false);
  }, [teilWahl]);
  return {
    begleitung,
    chipOffen,
    onChip: () => setChipOffen((v) => !v),
    mehrOffen: gefuehrt ? gefuehrt.offen : mehrNutzer,
    onMehr: gefuehrt
      ? gefuehrt.setzen
      : (offen) => {
          if (offen) {
            anhalten();
          }
          setMehrNutzer(offen);
        },
  };
}

/** Die Wissenslücke — dieselben Texte und derselbe nächste Schritt wie auf der Seite. */
function DemoLuecke(): JSX.Element {
  const { t } = useTranslation();
  const contract = answerContract("gap");
  return (
    <Card className="mt-0 border-dashed">
      <span
        data-tutorial-ziel={FRAGEN_ZIEL.luecke}
        className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase text-trust-warn-text"
      >
        {t("ask.gapBadge")}
      </span>
      <p className="mt-2 text-[15px] font-semibold text-text">{t("ask.noBasisTitle")}</p>
      <p className="mt-1 text-sm text-muted">{t("ask.noBasisBody")}</p>
      <p className="mt-2 text-[11.5px] text-muted-2">
        {t("tutorial.fragen.demo.mehrOrt", { menue: t("ask.menu.mehr") })}
      </p>
      <p className="mt-1 text-[12px] font-medium text-text">{t(contract.nextStepKey)}</p>
    </Card>
  );
}

/** Ein Leerbereich, der benennt, was hier später steht — die echte Seite ist dort noch leer. */
function DemoLeer({ text }: { text: string }): JSX.Element {
  return (
    <p className="rounded-card border border-dashed border-hairline px-3 py-6 text-center text-[12.5px] text-muted-2">
      {text}
    </p>
  );
}

/** Die Fläche in der Anordnung der Seite: oben die Frage, darunter das Ergebnis, unten das Feld. */
function Flaeche({
  frage,
  ergebnis,
  feld,
}: {
  frage?: string | undefined;
  ergebnis: JSX.Element | null;
  feld: JSX.Element;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      {frage ? <Fragezeile text={frage} /> : null}
      {ergebnis}
      {feld}
    </div>
  );
}

const OHNE = (): void => {};

function Uebung({
  teilIndex,
  lauf,
  reduziert,
  zuTeil,
  anhalten,
  teilWahl,
  begleitung,
}: {
  begleitung: ReactNode;
  teilIndex: number;
  lauf: number;
  reduziert: boolean;
  zuTeil: (index: number) => void;
  anhalten: () => void;
  teilWahl: number;
}): JSX.Element {
  const { t } = useTranslation();
  const [eingabe, setEingabe] = useState("");
  const [leerVersucht, setLeerVersucht] = useState(false);
  const [gestellt, setGestellt] = useState("");
  const [lage, setLage] = useState<"offen" | "wartet" | "beantwortet">("offen");
  const [beispiele, setBeispiele] = useState(false);
  // Chip und „…“ → „Mehr …“ wirken in der Übung genau wie in den Kapiteln davor. Eine neue
  // Übungsfrage oder „wiederholen“ schliesst beides.
  const karte = useKartenLage(begleitung, `${lauf}:${gestellt}`, teilWahl, anhalten);
  const frageOhneEingabe = t("tutorial.fragen.demo.frage");
  // „Schritt wiederholen“ setzt die Übung vollständig zurück.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `lauf` ist der Auslöser.
  useEffect(() => {
    setEingabe("");
    setLeerVersucht(false);
    setGestellt("");
    setLage("offen");
  }, [lauf]);
  useEffect(() => {
    if (lage !== "wartet") {
      return;
    }
    const fertig = window.setTimeout(
      () => {
        setLage("beantwortet");
        zuTeil(2);
      },
      reduziert ? 0 : UEBUNG_WARTEN_MS,
    );
    return () => window.clearTimeout(fertig);
  }, [lage, reduziert, zuTeil]);
  const absenden = (): void => {
    const frage = eingabe.trim();
    setLeerVersucht(frage.length === 0);
    if (frage.length === 0 || lage === "wartet") {
      return;
    }
    setGestellt(frage);
    setLage("wartet");
    zuTeil(1);
  };
  // Wählt der Nutzer den dritten Teil („Übungsantwort lesen“) selbst an, bevor er abgeschickt hat,
  // steht die Übungsantwort da — sonst zeigte die Erklärung auf einen Chip, den es nicht gibt.
  const sichtbar = teilIndex >= 2 ? "beantwortet" : lage;
  return (
    <Flaeche
      frage={sichtbar === "beantwortet" ? gestellt || frageOhneEingabe : gestellt}
      ergebnis={
        sichtbar === "offen" ? (
          <DemoLeer text={t("tutorial.fragen.demo.uebungLeer")} />
        ) : sichtbar === "wartet" ? (
          <AntwortPlatzhalter />
        ) : (
          <div className="flex flex-col gap-2">
            <p className="rounded-btn bg-ai-surface-2 px-2.5 py-2 text-[12px] text-ai">
              {t("tutorial.fragen.demo.uebungHinweis")}
            </p>
            <DemoAntwortKarte lage={karte} uebung />
          </div>
        )
      }
      feld={
        <div className="flex flex-col gap-1.5">
          <FrageFeld
            wert={eingabe}
            onWert={setEingabe}
            onAbsenden={absenden}
            ungueltig={leerVersucht && eingabe.trim().length === 0}
            beispieleOffen={beispiele}
            onBeispiele={() => setBeispiele((v) => !v)}
            diktat={null}
            wartet={lage === "wartet"}
            gesperrt={false}
          />
          {beispiele ? (
            <p className="text-[11.5px] text-muted-2">{t("tutorial.fragen.demo.beispiele")}</p>
          ) : null}
          {leerVersucht && eingabe.trim().length === 0 ? (
            <p className="text-[12px] text-muted">{t("ask.emptyHint")}</p>
          ) : null}
        </div>
      }
    />
  );
}

export function FragenDemo({
  schrittId,
  teilIndex,
  teilZeit,
  lauf,
  reduziert,
  zuTeil,
  anhalten,
  teilWahl,
  begleitung,
}: TutorialDemoProps): JSX.Element {
  const { t } = useTranslation();
  const frage = t("tutorial.fragen.demo.frage");
  const [beispiele, setBeispiele] = useState(false);
  // Ein neuer Schritt oder „wiederholen“ beginnt mit geschlossenem Chip-Hinweis und Blatt.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Schritt und Lauf sind die Auslöser.
  useEffect(() => {
    setBeispiele(false);
  }, [schrittId, lauf]);
  // Im Kapitel „Quelle“ gehören die Teile ab „Liste“ (Index 2) ins Blatt „Mehr“: das Blatt ist
  // GENAU DANN offen, wenn einer dieser Teile gewählt ist — gleich, ob der Nutzer es über „…“, über
  // die Teilliste oder die Vorführung geöffnet hat. Öffnet er es selbst, springt die Erklärung
  // dorthin; schliesst er es oder wählt er „Chip“/„…“, steht sie davor und das Blatt ist zu — die
  // gewählten Ziele ausserhalb des Blatts sind damit sofort bedienbar.
  const imQuellenKapitel = schrittId === "quelle";
  const karte = useKartenLage(
    begleitung,
    `${schrittId}:${lauf}`,
    teilWahl,
    anhalten,
    imQuellenKapitel
      ? {
          offen: teilIndex >= 2,
          setzen: (offen) => {
            if (offen && teilIndex < 2) {
              zuTeil(2);
            }
            if (!offen && teilIndex >= 2) {
              anhalten();
              zuTeil(1);
            }
          },
        }
      : undefined,
  );

  const nurLesendesFeld = (wert: string, extra?: { wartet?: boolean; gesperrt?: boolean }) => (
    <FrageFeld
      wert={wert}
      onWert={OHNE}
      onAbsenden={OHNE}
      ungueltig={false}
      beispieleOffen={beispiele}
      onBeispiele={() => setBeispiele((v) => !v)}
      diktat={null}
      wartet={extra?.wartet ?? false}
      gesperrt={extra?.gesperrt ?? false}
      sperrHinweis={extra?.gesperrt ? t("ai.unavailable.hint") : undefined}
      nurLesen
    />
  );

  if (schrittId === "verstehen") {
    return (
      <Flaeche
        ergebnis={<DemoLeer text={t("tutorial.fragen.demo.leer")} />}
        feld={
          <div className="flex flex-col gap-1.5">
            {nurLesendesFeld("")}
            {beispiele ? (
              <p className="text-[11.5px] text-muted-2">{t("tutorial.fragen.demo.beispiele")}</p>
            ) : null}
          </div>
        }
      />
    );
  }

  if (schrittId === "formulieren") {
    // Tippvorführung: Zeichen für Zeichen im Takt der Vorführzeit — steht still, solange pausiert
    // ist. Bei reduzierter Bewegung steht die ganze Frage sofort da (der Satz darunter sagt es).
    const zeichen = reduziert || teilIndex > 0 ? frage.length : Math.floor(teilZeit / TIPP_MS);
    return <Flaeche ergebnis={null} feld={nurLesendesFeld(frage.slice(0, zeichen))} />;
  }

  if (schrittId === "absenden") {
    const wartet = teilIndex >= 1;
    return (
      <Flaeche
        frage={wartet ? frage : undefined}
        ergebnis={wartet ? <AntwortPlatzhalter /> : null}
        feld={
          <FrageFeld
            wert={frage}
            onWert={OHNE}
            // Absenden in der Demo ist ein Anzeigewechsel zum Wartezustand — kein Netz.
            onAbsenden={() => zuTeil(1)}
            ungueltig={false}
            beispieleOffen={false}
            onBeispiele={OHNE}
            diktat={null}
            wartet={wartet}
            gesperrt={false}
            nurLesen
          />
        }
      />
    );
  }

  if (schrittId === "antwort" || schrittId === "quelle") {
    return (
      <Flaeche
        frage={frage}
        ergebnis={<DemoAntwortKarte lage={karte} />}
        feld={nurLesendesFeld(frage)}
      />
    );
  }

  if (schrittId === "sonderfaelle") {
    if (teilIndex === 0) {
      return (
        <Flaeche
          frage={t("tutorial.fragen.demo.lueckenfrage")}
          ergebnis={<DemoLuecke />}
          feld={nurLesendesFeld(t("tutorial.fragen.demo.lueckenfrage"))}
        />
      );
    }
    if (teilIndex === 1) {
      return (
        <Flaeche
          frage={frage}
          ergebnis={<DemoAntwortKarte lage={karte} unsicher />}
          feld={nurLesendesFeld(frage)}
        />
      );
    }
    return (
      <Flaeche
        ergebnis={null}
        feld={
          <div className="flex flex-col">
            {nurLesendesFeld(frage, { gesperrt: true })}
            <span className="block">
              <KiNichtVerfuegbar hinweisKey="ai.unavailable.hint" />
            </span>
          </div>
        }
      />
    );
  }

  return (
    <Uebung
      teilIndex={teilIndex}
      lauf={lauf}
      reduziert={reduziert}
      zuTeil={zuTeil}
      anhalten={anhalten}
      teilWahl={teilWahl}
      begleitung={begleitung}
    />
  );
}

/**
 * Der Übergang zur echten Seite — AUSSERHALB der Demo. „Eigene Frage stellen“ schliesst das
 * Tutorial und setzt den Fokus auf das echte Eingabefeld; es füllt nichts ein und sendet nichts.
 * Ist die echte Fragefunktion gerade nicht verfügbar, steht das hier ehrlich, mit den echten,
 * rollenabhängigen Alternativen.
 */
export function FragenUebergang({
  zurEchtenSeite,
  zielGefunden,
}: TutorialUebergangProps): JSX.Element {
  const { t } = useTranslation();
  const answerAi = useAiAvailable("answer");
  // D5: dieselbe Unterscheidung wie auf der Seite — eine Abschaltung durch den Administrator ist
  // keine Störung und wird nicht „nicht verfügbar“ genannt.
  const kiAbgeschaltet = useReasonerStatus().data?.kiAbgeschaltet === true;
  return (
    <div
      data-testid="tutorial-uebergang"
      className="flex flex-col gap-2 rounded-card border border-hairline bg-surface p-3"
    >
      <p className="text-[13px] leading-relaxed text-text">{t("tutorial.fragen.uebergang.text")}</p>
      <div>
        <button
          type="button"
          data-testid="tutorial-eigene-frage"
          onClick={zurEchtenSeite}
          className="inline-flex items-center gap-1.5 rounded-btn bg-ink px-3 py-1.5 text-[13px] font-semibold text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {t("tutorial.fragen.uebergang.knopf")}
        </button>
      </div>
      {zielGefunden ? null : (
        <output className="block text-[12px] text-trust-warn-text">
          {t("tutorial.fragen.uebergang.zielFehlt")}
        </output>
      )}
      {answerAi.available ? null : (
        <div data-testid="tutorial-uebergang-ki-aus">
          <p className="text-[12px] text-text">{t("tutorial.fragen.uebergang.kiAus")}</p>
          <KiNichtVerfuegbar
            hinweisKey={
              kiAbgeschaltet
                ? "d5kiaus.hinweis"
                : answerAi.statusUnknown
                  ? "ai.statusUnknown.hint"
                  : "ai.unavailable.hint"
            }
          />
        </div>
      )}
    </div>
  );
}
