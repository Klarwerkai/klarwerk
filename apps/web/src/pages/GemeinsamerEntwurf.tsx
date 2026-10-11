// ================================================================================================
// GEMEINSAM AN DERSELBEN ARTIKELFASSUNG ARBEITEN — `/wissen/:id/gemeinsam`
// (produkt:20261007:artikel-gemeinsam).
// ================================================================================================
//
// EINE SEITE, ZWEI WEGE HINEIN: das Artikelgespräch im Chat (`pages/Chat.tsx`) und der Artikel in
// der Bibliothek (`BibliothekLesen.tsx`). Wer sie öffnet, sieht DENSELBEN Entwurf wie alle anderen
// Berechtigten — es gibt je Artikel höchstens einen offenen (`gemeinsamer-entwurf.ts`).
//
// WAS DIE SEITE ZEIGT, KOMMT VOM SERVER:
//   · die gültige Lesefassung (Fassung, Prüfstand) — getrennt vom Entwurf, den nur Bearbeitende
//     sehen;
//   · wer gerade dabei ist — der VORHANDENE Bearbeitungshinweis (`Bearbeitungshinweis.tsx`), kein
//     zweiter Präsenzweg;
//   · der gespeicherte Arbeitsstand mit Zeit und Person; „gespeichert" steht erst nach der Antwort.
//
// WAS NIE VERLOREN GEHT: die eigene Eingabe. Sie steht im Feld, bis der Server sie angenommen hat,
// und zusätzlich im `sessionStorage` dieses Fensters — ein Neuladen nach einem Verbindungsabbruch
// stellt sie wieder her. Ein Konflikt schreibt nichts; die Seite zeigt je Stelle beide Fassungen
// und lässt wählen. Ein Rechteentzug beendet das Speichern, nicht die Eingabe.
//
// DIE ÜBERNAHME läuft über den bestehenden Schreibweg des Artikels (`PUT /api/kos/:id`): `revise`
// mit `expectedVersion` oder — bei einem freigegebenen Artikel ohne Freigaberecht — `propose`.
//
// NACHARBEIT 5 (Ben):
//   · Der Inhalt wird im EINHEITLICHEN Editor (`RichTextEditor`) bearbeitet — derselbe wie am
//     Artikel; Bilder, Listen, Tabellen und Formatierung bleiben erhalten.
//   · Jeder Speichervorgang nennt die Entwurfskennung; ein abgeschlossener oder ersetzter Entwurf
//     nimmt nichts mehr an, und die Eingabe bleibt stehen.
//   · Was WÄHREND eines Speichervorgangs getippt wird, wird von der späteren Antwort nicht
//     überschrieben: quittiert wird nur der gesendete Stand. Spätere Eingaben bleiben samt Sicherung
//     und werden beim nächsten Speichern gegen den gesendeten Stand zusammengeführt (`basisStand`).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import {
  type EntwurfsSchritt,
  type EntwurfsStand,
  type GemeinsamLage,
  type GemeinsamerEntwurf,
  type KonfliktDetails,
  type KonfliktTeil,
  eingereichterVorschlag,
  gemeinsamApi,
} from "../api/gemeinsam";
import { ImageDescribeProvider } from "../app/ImageDescribeContext";
import { RichTextEditor } from "../components/RichTextEditor";
import { SanitizedHtml } from "../components/SanitizedHtml";
import {
  Bearbeitungshinweis,
  useEigeneBearbeitung,
} from "../components/bibliothek/Bearbeitungshinweis";
import { Button, Card, PageHeader, SectionLabel, TextInput } from "../components/ui";
import { formatKoTimestamp } from "../lib/koDates";
import { draftProvenance } from "../lib/reasonerProvenance";
import { sanitizeHtml } from "../lib/richText";

/** So oft fragt die Seite nach dem gespeicherten Stand — fremdes Speichern kommt zeitnah an. */
const ABRUF_MS = 5_000;

const KNOPF_LINK = "text-[12.5px] font-semibold text-brand-text hover:underline";

const lageSchluessel = (koId: string): readonly unknown[] => ["gemeinsam", koId];
const lokalSchluessel = (koId: string): string => `klarwerk.gemeinsam.${koId}`;

/**
 * Worauf die Eingabe beruht: der Entwurf, sein Arbeitsstand und — nur nach einem gesendeten,
 * inzwischen zusammengeführten Stand mit späteren Eingaben — dieser gesendete Stand.
 */
interface Basis {
  entwurfId: string;
  revision: number;
  stand?: EntwurfsStand;
}

/** Die ungespeicherte Eingabe, wie sie dieses Fenster festhält. */
interface LokaleEingabe extends EntwurfsStand {
  basis: Basis;
}

function leseLokal(koId: string): LokaleEingabe | null {
  try {
    const roh = window.sessionStorage.getItem(lokalSchluessel(koId));
    if (!roh) {
      return null;
    }
    const wert = JSON.parse(roh) as Partial<LokaleEingabe>;
    return typeof wert.basis?.entwurfId === "string" &&
      typeof wert.basis.revision === "number" &&
      typeof wert.titel === "string" &&
      typeof wert.rumpf === "string"
      ? (wert as LokaleEingabe)
      : null;
  } catch {
    return null;
  }
}

function schreibeLokal(koId: string, eingabe: LokaleEingabe | null): void {
  try {
    if (eingabe === null) {
      window.sessionStorage.removeItem(lokalSchluessel(koId));
    } else {
      window.sessionStorage.setItem(lokalSchluessel(koId), JSON.stringify(eingabe));
    }
  } catch {
    // Ein voller oder gesperrter Speicher nimmt nichts weg: die Eingabe steht weiter im Feld.
  }
}

type Speicherlage =
  | "ruhe"
  | "laeuft"
  | "unterbrochen"
  | "ohneRecht"
  | "konflikt"
  | "konfliktErneut"
  | "ersetzt"
  | "fehler";
type Wahl = "meine" | "deren" | "beide";

interface OffenerKonflikt {
  /** `speichern`: zwei Arbeitsstände; `angleich`: Entwurf gegen neue Lesefassung. */
  art: "speichern" | "angleich";
  details: KonfliktDetails;
  wahl: Record<number, Wahl>;
  titelWahl: Wahl | null;
}

/** Wer seit einem Arbeitsstand gespeichert hat — ohne die eigenen Schritte. */
function fremdeSeit(e: GemeinsamerEntwurf, revision: number): string[] {
  return e.verlauf
    .filter((s) => s.revision > revision && !s.eigen)
    .map((s) => s.name)
    .filter((name, i, alle) => alle.indexOf(name) === i);
}

function gewaehlt(wahl: Wahl, meine: string[], deren: string[]): string[] {
  if (wahl === "meine") {
    return meine;
  }
  if (wahl === "deren") {
    return deren;
  }
  // Beide: erst die schon gespeicherte, dann die eigene Fassung — doppelte Abschnitte einmal.
  return [...deren, ...meine.filter((a) => !deren.includes(a))];
}

/** Baut aus Konflikt und Entscheidungen den Inhalt — `null`, solange eine Stelle offen ist. */
function aufgeloest(k: OffenerKonflikt): { titel: string | null; rumpf: string } | null {
  const stellen = k.details.teile.filter((t) => t.art === "konflikt").length;
  if (Object.keys(k.wahl).length < stellen || (k.details.titel !== null && k.titelWahl === null)) {
    return null;
  }
  let nr = 0;
  const abschnitte = k.details.teile.flatMap((teil: KonfliktTeil) => {
    if (teil.art === "geloest") {
      return teil.abschnitte;
    }
    const wahl = k.wahl[nr] ?? "beide";
    nr += 1;
    return gewaehlt(wahl, teil.meine, teil.deren);
  });
  const titel =
    k.details.titel === null || k.titelWahl === null
      ? null
      : k.titelWahl === "deren"
        ? k.details.titel.deren
        : k.titelWahl === "meine"
          ? k.details.titel.meine
          : `${k.details.titel.meine} / ${k.details.titel.deren}`;
  return { titel, rumpf: abschnitte.join("") };
}

/** Gleicher Stand? Titel und Inhalt Zeichen für Zeichen. */
const gleicherStand = (a: EntwurfsStand, b: EntwurfsStand): boolean =>
  a.titel === b.titel && a.rumpf === b.rumpf;

/**
 * Stabile React-Schlüssel aus dem Inhalt: gleiche Texte bekommen ihre Vorkommensnummer dazu, damit
 * auch wiederholte Absätze eindeutig bleiben. `nr` ist die Stelle in der Eingabeliste.
 */
function mitSchluessel(texte: readonly string[]): { schluessel: string; nr: number }[] {
  const gezaehlt = new Map<string, number>();
  return texte.map((text, nr) => {
    const vorher = gezaehlt.get(text) ?? 0;
    gezaehlt.set(text, vorher + 1);
    return { schluessel: `${text}\u0000${vorher}`, nr };
  });
}

/** Der Inhalt einer Konfliktstelle als ein Text — Grundlage ihres Schlüssels. */
function stelleText(stelle: Extract<KonfliktTeil, { art: "konflikt" }>): string {
  return [stelle.basis, stelle.meine, stelle.deren].map((t) => t.join("\n")).join("\u0001");
}

function Abschnitte({ liste, leer }: { liste: string[]; leer: string }): JSX.Element {
  if (liste.length === 0) {
    return <p className="text-[12.5px] italic text-muted">{leer}</p>;
  }
  return (
    <div className="space-y-1">
      {mitSchluessel(liste).map(({ schluessel, nr }) => (
        <SanitizedHtml
          key={schluessel}
          html={liste[nr] ?? ""}
          className="prose-kw text-[12.5px] text-text"
        />
      ))}
    </div>
  );
}

function WahlKnoepfe({
  wahl,
  onWahl,
  testId,
}: {
  wahl: Wahl | undefined | null;
  onWahl: (w: Wahl) => void;
  testId: string;
}): JSX.Element {
  const { t } = useTranslation();
  const knopf = (w: Wahl, text: string): JSX.Element => (
    <Button
      type="button"
      data-testid={`${testId}-${w}`}
      aria-pressed={wahl === w}
      variant={wahl === w ? "primary" : "outline"}
      onClick={() => onWahl(w)}
      className="h-8 px-2.5 text-[12px]"
    >
      {text}
    </Button>
  );
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {knopf("meine", t("gemeinsam.konflikt.nimmMeine"))}
      {knopf("deren", t("gemeinsam.konflikt.nimmDeren"))}
      {knopf("beide", t("gemeinsam.konflikt.beide"))}
    </div>
  );
}

/** Der Konflikt: je Stelle Vorher, eigene und andere Fassung — und die Wahl. */
function KonfliktFlaeche({
  konflikt,
  onWahl,
  onTitelWahl,
  onUebernehmen,
  knopfText,
}: {
  konflikt: OffenerKonflikt;
  onWahl: (nr: number, w: Wahl) => void;
  onTitelWahl: (w: Wahl) => void;
  onUebernehmen: () => void;
  knopfText: string;
}): JSX.Element {
  const { t } = useTranslation();
  const titelId = useId();
  const namen = konflikt.details.seitherVon ?? [];
  const derenLabel =
    konflikt.art === "angleich"
      ? t("gemeinsam.konflikt.lesefassung")
      : namen.length > 0
        ? t("gemeinsam.konflikt.deren", { namen: namen.join(", ") })
        : t("gemeinsam.konflikt.derenOhneName");
  const leer = t("gemeinsam.konflikt.leer");
  const stellen = konflikt.details.teile.filter(
    (teil): teil is Extract<KonfliktTeil, { art: "konflikt" }> => teil.art === "konflikt",
  );
  const offen =
    stellen.length -
    Object.keys(konflikt.wahl).length +
    (konflikt.details.titel !== null && konflikt.titelWahl === null ? 1 : 0);
  const spalten = (basis: string[], meine: string[], deren: string[]): JSX.Element => (
    <div className="mt-2 grid gap-2 md:grid-cols-3">
      <div>
        <SectionLabel>{t("gemeinsam.konflikt.basis")}</SectionLabel>
        <Abschnitte liste={basis} leer={leer} />
      </div>
      <div data-testid="gemeinsam-konflikt-meine">
        <SectionLabel>{t("gemeinsam.konflikt.meine")}</SectionLabel>
        <Abschnitte liste={meine} leer={leer} />
      </div>
      <div data-testid="gemeinsam-konflikt-deren">
        <SectionLabel>{derenLabel}</SectionLabel>
        <Abschnitte liste={deren} leer={leer} />
      </div>
    </div>
  );
  return (
    <section
      data-testid="gemeinsam-konflikt"
      data-art={konflikt.art}
      aria-labelledby={titelId}
      className="rounded-btn border border-trust-warn-fill/30 bg-trust-warn-bg px-3 py-3"
    >
      <h3 id={titelId} className="text-[13.5px] font-semibold text-trust-warn-text">
        {konflikt.art === "angleich"
          ? t("gemeinsam.angleich.konflikt")
          : t("gemeinsam.konflikt.titel")}
      </h3>
      <p className="mt-1 text-[12.5px] text-trust-warn-text">
        {t("gemeinsam.konflikt.erklaerung")}
      </p>
      {konflikt.details.titel !== null ? (
        <div data-testid="gemeinsam-konflikt-titel" className="mt-3 rounded-btn bg-surface p-2">
          <SectionLabel>{t("gemeinsam.konflikt.titelStelle")}</SectionLabel>
          {spalten(
            [konflikt.details.titel.basis],
            [konflikt.details.titel.meine],
            [konflikt.details.titel.deren],
          )}
          <WahlKnoepfe
            wahl={konflikt.titelWahl}
            onWahl={onTitelWahl}
            testId="gemeinsam-titelwahl"
          />
        </div>
      ) : null}
      {mitSchluessel(stellen.map(stelleText)).map(({ schluessel, nr }) => {
        const stelle = stellen[nr] as Extract<KonfliktTeil, { art: "konflikt" }>;
        return (
          <div
            key={schluessel}
            data-testid="gemeinsam-konflikt-stelle"
            data-nr={nr + 1}
            className="mt-3 rounded-btn bg-surface p-2"
          >
            <SectionLabel>{t("gemeinsam.konflikt.stelle", { nr: nr + 1 })}</SectionLabel>
            {spalten(stelle.basis, stelle.meine, stelle.deren)}
            <WahlKnoepfe
              wahl={konflikt.wahl[nr]}
              onWahl={(w) => onWahl(nr, w)}
              testId="gemeinsam-wahl"
            />
          </div>
        );
      })}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="primary"
          data-testid="gemeinsam-konflikt-uebernehmen"
          disabled={offen > 0}
          onClick={onUebernehmen}
        >
          {knopfText}
        </Button>
        {offen > 0 ? (
          <span className="text-[12px] text-trust-warn-text">
            {t("gemeinsam.konflikt.offen", { anzahl: offen })}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function Verlauf({ e }: { e: GemeinsamerEntwurf }): JSX.Element {
  const { t, i18n } = useTranslation();
  const was = (s: EntwurfsSchritt): string =>
    t(`gemeinsam.verlauf.${s.art}`, {
      name: s.eigen ? t("gemeinsam.anwesend.du") : s.name,
      fassung: s.fassung ?? "",
    });
  return (
    <div>
      <SectionLabel>{t("gemeinsam.verlauf.titel")}</SectionLabel>
      <p data-testid="gemeinsam-beteiligte" className="mb-1 text-[12.5px] text-muted">
        {t("gemeinsam.beteiligte", { namen: e.beteiligte.join(", ") })}
      </p>
      <ol data-testid="gemeinsam-verlauf" className="space-y-0.5 text-[12.5px] text-text">
        {[...e.verlauf].reverse().map((s) => (
          <li key={`${s.revision}-${s.art}-${s.am}`} data-art={s.art}>
            {t("gemeinsam.verlauf.zeile", {
              revision: s.revision,
              zeit: formatKoTimestamp(s.am, i18n.language) ?? "",
              was: was(s),
            })}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function GemeinsamerEntwurfSeite(): JSX.Element {
  const { id: koId = "" } = useParams();
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const titelFeld = useId();
  const abfrage = useQuery({
    queryKey: lageSchluessel(koId),
    queryFn: () => gemeinsamApi.lage(koId),
    refetchInterval: ABRUF_MS,
    staleTime: 0,
    retry: false,
  });
  const lage: GemeinsamLage | undefined = abfrage.data;
  const entwurf = lage?.entwurf ?? null;

  const [basis, setBasis] = useState<Basis | null>(null);
  const [titel, setTitel] = useState("");
  const [rumpf, setRumpf] = useState("");
  const [geaendert, setGeaendert] = useState(false);
  // Die Eingabe JETZT — gelesen, wenn eine Speicherantwort ankommt (die Closure kennt nur den
  // Stand beim Absenden).
  const eingabeRef = useRef<EntwurfsStand>({ titel, rumpf });
  eingabeRef.current = { titel, rumpf };
  const [speicherlage, setSpeicherlage] = useState<Speicherlage>("ruhe");
  const [fehlergrund, setFehlergrund] = useState("");
  const [zusammengefuehrt, setZusammengefuehrt] = useState<string[] | null>(null);
  const [wiederhergestellt, setWiederhergestellt] = useState<number | null>(null);
  const [konflikt, setKonflikt] = useState<OffenerKonflikt | null>(null);
  const [oeffnet, setOeffnet] = useState(false);
  const [oeffnenFehler, setOeffnenFehler] = useState<string | null>(null);
  const [uebernahme, setUebernahme] = useState<"ruhe" | "laeuft">("ruhe");
  const [uebernahmeFehler, setUebernahmeFehler] = useState<string | null>(null);
  const [uebernahmeWeiter, setUebernahmeWeiter] = useState<number | null>(null);
  const [kopiert, setKopiert] = useState(false);

  const ohneRecht =
    speicherlage === "ohneRecht" ||
    (abfrage.error instanceof ApiError && [401, 403, 404].includes(abfrage.error.status));

  // Der Bearbeitungshinweis: solange ein Entwurf offen ist und das Recht besteht, ist man „dabei".
  const eigene = useEigeneBearbeitung(koId, entwurf !== null && !ohneRecht, async () => {
    const neu = await abfrage.refetch();
    return neu.isSuccess;
  });
  const anwesend = useQuery({
    queryKey: ["bearbeitungen", koId],
    queryFn: () => endpoints.ko.bearbeitungen(koId),
    refetchInterval: ABRUF_MS,
    staleTime: 0,
    retry: false,
    enabled: entwurf !== null,
  });

  const uebernimm = (e: GemeinsamerEntwurf): void => {
    setBasis({ entwurfId: e.id, revision: e.revision });
    setTitel(e.titel);
    setRumpf(e.rumpf);
    setGeaendert(false);
  };

  // Ein neuer Stand vom Server: ohne eigene Änderung wird er übernommen; mit eigener Änderung
  // bleibt die Eingabe stehen und wird beim Speichern zusammengeführt. Beim ersten Stand eines
  // Entwurfs wird eine ungespeicherte Eingabe dieses Fensters wiederhergestellt. Ist der Entwurf,
  // auf dem die Eingabe beruht, inzwischen ersetzt, bleibt sie stehen und die Fläche sagt es.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Auslöser ist der neue Stand.
  useEffect(() => {
    if (!entwurf) {
      return;
    }
    if (basis === null) {
      const lokal = leseLokal(koId);
      if (lokal !== null && lokal.basis.entwurfId !== entwurf.id) {
        // Die gesicherte Eingabe gehört zu einem früheren Entwurf: sie bleibt sichtbar erhalten.
        setBasis(lokal.basis);
        setTitel(lokal.titel);
        setRumpf(lokal.rumpf);
        setGeaendert(true);
        setSpeicherlage("ersetzt");
        return;
      }
      if (
        lokal !== null &&
        lokal.basis.revision <= entwurf.revision &&
        !gleicherStand(lokal, { titel: entwurf.titel, rumpf: entwurf.rumpf })
      ) {
        setBasis(lokal.basis);
        setTitel(lokal.titel);
        setRumpf(lokal.rumpf);
        setGeaendert(true);
        setWiederhergestellt(lokal.basis.revision);
        return;
      }
      schreibeLokal(koId, null);
      uebernimm(entwurf);
      return;
    }
    if (basis.entwurfId !== entwurf.id) {
      if (geaendert) {
        setSpeicherlage("ersetzt");
      } else {
        uebernimm(entwurf);
      }
      return;
    }
    if (
      !geaendert &&
      entwurf.revision !== basis.revision &&
      konflikt === null &&
      speicherlage !== "laeuft"
    ) {
      uebernimm(entwurf);
    }
  }, [entwurf?.id, entwurf?.revision]);

  // Jede ungespeicherte Eingabe steht zusätzlich in diesem Fenster — samt dem, worauf sie beruht.
  useEffect(() => {
    if (basis !== null && geaendert) {
      schreibeLokal(koId, { basis, titel, rumpf });
    }
  }, [koId, basis, geaendert, titel, rumpf]);

  /** Eine Eingabe im Editor zählt nur, wenn sie den Inhalt wirklich ändert. */
  const inhaltGeaendert = (html: string): void => {
    if (sanitizeHtml(html) !== sanitizeHtml(rumpf)) {
      setRumpf(html);
      setGeaendert(true);
    }
  };

  const neueLage = (l: GemeinsamLage): void => {
    qc.setQueryData(lageSchluessel(koId), l);
  };

  const fehlerText = (e: unknown): string =>
    e instanceof ApiError
      ? e.status === 408 || e.status >= 500
        ? t("gemeinsam.speicher.netz")
        : e.message
      : t("gemeinsam.speicher.netz");

  const oeffnen = async (): Promise<void> => {
    setOeffnet(true);
    setOeffnenFehler(null);
    try {
      neueLage(await gemeinsamApi.oeffnen(koId));
    } catch (e) {
      setOeffnenFehler(fehlerText(e));
    } finally {
      setOeffnet(false);
    }
  };

  const speichern = async (): Promise<void> => {
    if (basis === null || speicherlage === "laeuft") {
      return;
    }
    // Der GESENDETE Stand — getrennt von allem, was während der Anfrage noch getippt wird.
    const gesendet: EntwurfsStand = { titel, rumpf };
    const seit = basis.revision;
    setSpeicherlage("laeuft");
    setZusammengefuehrt(null);
    try {
      const antwort = await gemeinsamApi.speichern(koId, {
        entwurfId: basis.entwurfId,
        basisRevision: seit,
        ...gesendet,
        ...(basis.stand === undefined ? {} : { basisStand: basis.stand }),
      });
      neueLage(antwort);
      const e = antwort.entwurf;
      if (e) {
        setZusammengefuehrt(antwort.zusammengefuehrt ? fremdeSeit(e, seit) : null);
        if (gleicherStand(eingabeRef.current, gesendet)) {
          // Nichts mehr getippt: der bestätigte Stand ist der ganze Stand.
          uebernimm(e);
          schreibeLokal(koId, null);
        } else {
          // Während der Anfrage weitergeschrieben: quittiert ist nur der gesendete Stand. Die
          // spätere Eingabe bleibt stehen (samt Sicherung) und beruht jetzt auf dem neuen
          // Arbeitsstand; hat der Server dabei Fremdes hinzugeführt, ist der gesendete Stand die
          // Basis des nächsten Zusammenführens.
          const bestaetigt: EntwurfsStand = { titel: e.titel, rumpf: e.rumpf };
          setBasis({
            entwurfId: e.id,
            revision: e.revision,
            ...(gleicherStand(bestaetigt, gesendet) ? {} : { stand: gesendet }),
          });
        }
      }
      setWiederhergestellt(null);
      setKonflikt(null);
      setSpeicherlage("ruhe");
    } catch (e) {
      if (e instanceof ApiError && e.code === "ENTWURF_KONFLIKT") {
        if (!gleicherStand(eingabeRef.current, gesendet)) {
          // Die Konfliktstellen gelten für den gesendeten Stand, nicht für die spätere Eingabe —
          // sie werden beim nächsten Speichern für den jetzigen Stand neu bestimmt.
          setSpeicherlage("konfliktErneut");
          return;
        }
        setKonflikt({
          art: "speichern",
          details: e.details as unknown as KonfliktDetails,
          wahl: {},
          titelWahl: null,
        });
        setSpeicherlage("konflikt");
        return;
      }
      if (e instanceof ApiError && e.code === "ENTWURF_ERSETZT") {
        setSpeicherlage("ersetzt");
        return;
      }
      if (e instanceof ApiError && [401, 403].includes(e.status)) {
        setSpeicherlage("ohneRecht");
        return;
      }
      if (e instanceof ApiError && e.status === 404 && e.code !== "ENTWURF_FEHLT") {
        setSpeicherlage("ohneRecht");
        return;
      }
      if (!(e instanceof ApiError) || e.status === 408 || e.status >= 500) {
        setSpeicherlage("unterbrochen");
        return;
      }
      setFehlergrund(e.message);
      setSpeicherlage("fehler");
    }
  };

  // Ist die Verbindung wieder da, darf ein unterbrochener Speichervorgang erneut laufen.
  useEffect(() => {
    const wiederDa = (): void => {
      if (speicherlage === "unterbrochen") {
        setSpeicherlage("ruhe");
      }
    };
    window.addEventListener("online", wiederDa);
    return () => window.removeEventListener("online", wiederDa);
  }, [speicherlage]);

  const konfliktAufloesen = async (): Promise<void> => {
    if (konflikt === null) {
      return;
    }
    const loesung = aufgeloest(konflikt);
    if (loesung === null) {
      return;
    }
    if (konflikt.art === "speichern") {
      // Die Lösung steht danach im Feld und beruht auf dem jetzt gespeicherten Stand.
      setBasis((b) =>
        b === null ? b : { entwurfId: b.entwurfId, revision: konflikt.details.aktuell.revision },
      );
      if (loesung.titel !== null) {
        setTitel(loesung.titel);
      }
      setRumpf(loesung.rumpf);
      setGeaendert(true);
      setKonflikt(null);
      setSpeicherlage("ruhe");
      return;
    }
    if (!entwurf) {
      return;
    }
    try {
      neueLage(
        await gemeinsamApi.angleichen(koId, entwurf.id, konflikt.details.aktuell.revision, {
          titel: loesung.titel ?? entwurf.titel,
          rumpf: loesung.rumpf,
        }),
      );
      setKonflikt(null);
    } catch (e) {
      setUebernahmeFehler(t("gemeinsam.uebernahme.fehler", { grund: fehlerText(e) }));
    }
  };

  const angleichen = async (): Promise<void> => {
    if (!entwurf || geaendert) {
      return;
    }
    setUebernahmeFehler(null);
    try {
      neueLage(await gemeinsamApi.angleichen(koId, entwurf.id, entwurf.revision));
    } catch (e) {
      if (e instanceof ApiError && e.code === "ENTWURF_ANGLEICH_KONFLIKT") {
        setKonflikt({
          art: "angleich",
          details: e.details as unknown as KonfliktDetails,
          wahl: {},
          titelWahl: null,
        });
        return;
      }
      setUebernahmeFehler(t("gemeinsam.uebernahme.fehler", { grund: fehlerText(e) }));
      void abfrage.refetch();
    }
  };

  const uebernehmen = async (): Promise<void> => {
    const u = lage?.uebernahme;
    if (!lage || !u || !entwurf || geaendert || !u.aktuell || !u.titelGeht) {
      return;
    }
    const entwurfId = entwurf.id;
    setUebernahme("laeuft");
    setUebernahmeFehler(null);
    setUebernahmeWeiter(null);
    try {
      let ergebnis: GemeinsamLage;
      if (lage.weg === "direkt") {
        const ko = await gemeinsamApi.uebernehmen(koId, u);
        ergebnis = await gemeinsamApi.abschluss(koId, {
          entwurfId,
          revision: u.revision,
          fassung: ko.version,
        });
      } else {
        const ko = await gemeinsamApi.einreichen(koId, u);
        const vorschlagId = eingereichterVorschlag(ko, u);
        if (vorschlagId === undefined) {
          throw new ApiError(409, "VORSCHLAG_FEHLT", t("gemeinsam.seite.fehler"));
        }
        ergebnis = await gemeinsamApi.abschluss(koId, {
          entwurfId,
          revision: u.revision,
          vorschlagId,
        });
      }
      neueLage(ergebnis);
      if (ergebnis.entwurf !== null) {
        setUebernahmeWeiter(u.revision);
      }
      // Der Artikel selbst hat sich (bei der Übernahme) bewegt — seine Ansichten lesen neu.
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "gemeinsam" });
    } catch (e) {
      setUebernahmeFehler(
        e instanceof ApiError && e.code === "KO_STALE"
          ? t("gemeinsam.uebernahme.veraltet")
          : t("gemeinsam.uebernahme.fehler", { grund: fehlerText(e) }),
      );
      void abfrage.refetch();
    } finally {
      setUebernahme("ruhe");
    }
  };

  const kopieren = (): void => {
    const klartext = new DOMParser().parseFromString(rumpf, "text/html").body.textContent ?? "";
    void navigator.clipboard?.writeText(`${titel}\n\n${klartext}`).then(
      () => setKopiert(true),
      () => setKopiert(false),
    );
  };

  const zumArtikel = (
    <Link
      data-testid="gemeinsam-zum-artikel"
      to={`/wissen/${encodeURIComponent(koId)}`}
      className={KNOPF_LINK}
    >
      {t("gemeinsam.zumArtikel")}
    </Link>
  );

  if (abfrage.isPending) {
    return <p className="text-sm text-muted">{t("gemeinsam.seite.laedt")}</p>;
  }
  if (abfrage.isError && !lage) {
    const gesperrt =
      abfrage.error instanceof ApiError && [401, 403, 404].includes(abfrage.error.status);
    return (
      <div data-testid="gemeinsam-seite" data-lage={gesperrt ? "kein-zugang" : "fehler"}>
        <PageHeader title={t("gemeinsam.seite.titel")} />
        <p role="alert" className="text-sm text-muted">
          {gesperrt ? t("gemeinsam.seite.keinZugang") : t("gemeinsam.seite.fehler")}
        </p>
        <div className="mt-2">{zumArtikel}</div>
      </div>
    );
  }
  if (!lage) {
    return <p className="text-sm text-muted">{t("gemeinsam.seite.laedt")}</p>;
  }

  const lesefassung = lage.lesefassung;
  const fremdNeu =
    entwurf !== null && basis !== null && geaendert && entwurf.revision > basis.revision
      ? entwurf.verlauf.filter((s) => s.revision > basis.revision && !s.eigen).pop()
      : undefined;
  const leute = anwesend.data?.bearbeitungen ?? [];
  const andere = leute
    .filter((b) => !b.eigen)
    .map((b) => b.name)
    .filter((name, i, alle) => alle.indexOf(name) === i);
  const u = lage.uebernahme;

  const speichersatz = ((): string => {
    switch (speicherlage) {
      case "laeuft":
        return t("gemeinsam.speicher.laeuft");
      case "unterbrochen":
        return t("gemeinsam.speicher.unterbrochen");
      case "ohneRecht":
        return t("gemeinsam.speicher.ohneRecht");
      case "konflikt":
        return t("gemeinsam.speicher.konflikt");
      case "konfliktErneut":
        return t("gemeinsam.speicher.konfliktErneut");
      case "ersetzt":
        return t("gemeinsam.speicher.ersetzt");
      case "fehler":
        return t("gemeinsam.speicher.fehler", { grund: fehlergrund });
      default:
        if (geaendert || entwurf === null) {
          return t("gemeinsam.speicher.ungespeichert");
        }
        if (zusammengefuehrt !== null && zusammengefuehrt.length > 0) {
          return t("gemeinsam.speicher.zusammengefuehrt", {
            namen: zusammengefuehrt.join(", "),
            revision: entwurf.revision,
          });
        }
        return t("gemeinsam.speicher.gespeichert", {
          revision: entwurf.revision,
          zeit: formatKoTimestamp(entwurf.geaendertAm, i18n.language) ?? "",
          name: entwurf.verlauf[entwurf.verlauf.length - 1]?.eigen
            ? t("gemeinsam.anwesend.du")
            : entwurf.geaendertVon,
        });
    }
  })();
  const speicherzustand =
    speicherlage !== "ruhe" ? speicherlage : geaendert ? "ungespeichert" : "gespeichert";

  return (
    <div data-testid="gemeinsam-seite" data-ko={koId} className="space-y-4">
      <PageHeader title={t("gemeinsam.seite.titel")} lead={t("gemeinsam.seite.lead")} />

      <Card interactive={false} data-testid="gemeinsam-lesefassung">
        <SectionLabel>{t("gemeinsam.lesefassung.titel")}</SectionLabel>
        <p className="text-[14px] font-semibold text-ink" data-testid="gemeinsam-lesefassung-titel">
          {lesefassung.titel}
        </p>
        <p
          className="mt-1 text-[12.5px] text-muted"
          data-testid="gemeinsam-lesefassung-satz"
          data-version={lesefassung.version}
          data-status={lesefassung.status}
        >
          {t("gemeinsam.lesefassung.satz", {
            version: lesefassung.version,
            status:
              lesefassung.status === "validiert"
                ? t("gemeinsam.status.validiert")
                : t("gemeinsam.status.sonst"),
          })}
        </p>
        {lage.weg === "vorschlag" ? (
          <p data-testid="gemeinsam-weg-vorschlag" className="mt-1 text-[12.5px] text-muted">
            {t("gemeinsam.lesefassung.vorschlag")}
          </p>
        ) : null}
        <div className="mt-2">{zumArtikel}</div>
      </Card>

      {entwurf === null ? (
        <Card interactive={false} data-testid="gemeinsam-kein-entwurf">
          {lage.abgeschlossen ? (
            <AbgeschlossenSatz e={lage.abgeschlossen} />
          ) : (
            <p className="text-[13px] text-muted">{t("gemeinsam.entwurf.keiner")}</p>
          )}
          {geaendert ? (
            // Die Eingabe gehörte zu einem Entwurf, der inzwischen abgeschlossen ist: sie bleibt.
            <div data-testid="gemeinsam-ersetzt" className="mt-2 space-y-2">
              <p role="alert" className="text-[12.5px] text-text">
                {t("gemeinsam.speicher.ersetzt")}
              </p>
              <Button type="button" data-testid="gemeinsam-kopieren" onClick={kopieren}>
                {t("gemeinsam.kopieren")}
              </Button>
            </div>
          ) : null}
          <Button
            type="button"
            variant="primary"
            data-testid="gemeinsam-oeffnen"
            className="mt-3"
            disabled={oeffnet}
            onClick={() => void oeffnen()}
          >
            {lage.abgeschlossen ? t("gemeinsam.abgeschlossen.neu") : t("gemeinsam.entwurf.oeffnen")}
          </Button>
          {oeffnenFehler !== null ? (
            <p role="alert" className="mt-2 text-[12.5px] text-trust-crit-text">
              {oeffnenFehler}
            </p>
          ) : null}
        </Card>
      ) : (
        <>
          <Card interactive={false} data-testid="gemeinsam-anwesend">
            <SectionLabel>{t("gemeinsam.anwesend.titel")}</SectionLabel>
            <p className="text-[12.5px] text-text" data-testid="gemeinsam-anwesend-satz">
              {anwesend.isError && anwesend.data === undefined
                ? t("gemeinsam.anwesend.unbekannt")
                : andere.length === 0
                  ? t("gemeinsam.anwesend.niemand")
                  : [t("gemeinsam.anwesend.du"), ...andere].join(", ")}
            </p>
            <div className="mt-2">
              <Bearbeitungshinweis
                koId={koId}
                eigeneSitzung={eigene.sitzung}
                eigeneLage={eigene.lage}
                eigenerLesestand={eigene.lesestand}
                onEigenesNachlesen={eigene.nochmalLesen}
                ablaufSekunden={eigene.ablaufSekunden}
                onFremdesEnde={async () => (await abfrage.refetch()).isSuccess}
              />
            </div>
          </Card>

          <Card interactive={false} data-testid="gemeinsam-entwurf" data-entwurf={entwurf.id}>
            <SectionLabel>{t("gemeinsam.entwurf.titel")}</SectionLabel>
            <p
              className="mb-2 text-[12.5px] text-muted"
              data-testid="gemeinsam-entwurf-stand"
              data-revision={entwurf.revision}
              data-basis={entwurf.basisVersion}
            >
              {t("gemeinsam.entwurf.stand", {
                revision: entwurf.revision,
                version: entwurf.basisVersion,
              })}
            </p>
            {wiederhergestellt !== null ? (
              <p
                data-testid="gemeinsam-wiederhergestellt"
                className="mb-2 rounded-btn bg-hairline-soft px-3 py-2 text-[12.5px] text-text"
              >
                {t("gemeinsam.wiederhergestellt", { revision: wiederhergestellt })}
              </p>
            ) : null}
            {fremdNeu !== undefined && entwurf !== null ? (
              <p
                data-testid="gemeinsam-fremd"
                aria-live="polite"
                className="mb-2 rounded-btn bg-hairline-soft px-3 py-2 text-[12.5px] text-text"
              >
                {t("gemeinsam.fremd.neu", { name: fremdNeu.name, revision: entwurf.revision })}
              </p>
            ) : null}
            <label htmlFor={titelFeld} className="block text-[12.5px] font-semibold text-text">
              {t("gemeinsam.feld.titel")}
            </label>
            <TextInput
              id={titelFeld}
              data-testid="gemeinsam-titel"
              value={titel}
              onChange={(e) => {
                setTitel(e.target.value);
                setGeaendert(true);
              }}
            />
            <p className="mt-3 block text-[12.5px] font-semibold text-text">
              {t("gemeinsam.feld.text")}
            </p>
            <p className="text-[12px] text-muted">{t("gemeinsam.feld.hinweis")}</p>
            {/* Derselbe einheitliche Editor wie am Artikel — Bilder, Listen, Tabellen und
                Formatierung bleiben erhalten. */}
            {/* Wie am Artikeleditor (`BibliothekLesen`): die Bildbeschreibung des Editors läuft mit
                der Stufe und Kennung DIESES Artikels — fehlt die Stufe, fail-safe „vertraulich". */}
            <ImageDescribeProvider
              provenance={draftProvenance(lesefassung.vertraulichkeit ?? undefined, koId)}
            >
              <div data-testid="gemeinsam-editor" className="mt-1">
                <RichTextEditor value={rumpf} onChange={inhaltGeaendert} documentTitle={titel} />
              </div>
            </ImageDescribeProvider>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="primary"
                data-testid="gemeinsam-speichern"
                disabled={speicherlage === "laeuft" || konflikt !== null}
                onClick={() => void speichern()}
              >
                {t("gemeinsam.speichern")}
              </Button>
              <p
                data-testid="gemeinsam-speicherstand"
                data-zustand={speicherzustand}
                aria-live="polite"
                className="text-[12.5px] text-text"
              >
                {speichersatz}
              </p>
            </div>
            {speicherlage === "ohneRecht" ||
            speicherlage === "unterbrochen" ||
            speicherlage === "ersetzt" ? (
              <div className="mt-2 flex items-center gap-3">
                <Button type="button" data-testid="gemeinsam-kopieren" onClick={kopieren}>
                  {t("gemeinsam.kopieren")}
                </Button>
                {kopiert ? (
                  <span className="text-[12px] text-muted">{t("gemeinsam.kopiert")}</span>
                ) : null}
              </div>
            ) : null}
          </Card>

          {konflikt !== null ? (
            <KonfliktFlaeche
              konflikt={konflikt}
              onWahl={(nr, w) =>
                setKonflikt((k) => (k === null ? k : { ...k, wahl: { ...k.wahl, [nr]: w } }))
              }
              onTitelWahl={(w) => setKonflikt((k) => (k === null ? k : { ...k, titelWahl: w }))}
              onUebernehmen={() => void konfliktAufloesen()}
              knopfText={
                konflikt.art === "angleich"
                  ? t("gemeinsam.angleich.loesung", { version: lesefassung.version })
                  : t("gemeinsam.konflikt.uebernehmen")
              }
            />
          ) : null}

          {u !== null && !u.aktuell ? (
            <Card interactive={false} data-testid="gemeinsam-angleich">
              <SectionLabel>{t("gemeinsam.angleich.titel")}</SectionLabel>
              <p className="text-[12.5px] text-text">
                {t("gemeinsam.angleich.satz", {
                  version: lesefassung.version,
                  basis: u.basisVersion,
                })}
              </p>
              <Button
                type="button"
                className="mt-2"
                data-testid="gemeinsam-angleichen"
                disabled={geaendert || konflikt !== null}
                onClick={() => void angleichen()}
              >
                {t("gemeinsam.angleich.knopf", { version: lesefassung.version })}
              </Button>
            </Card>
          ) : null}

          {u !== null ? (
            <Card interactive={false} data-testid="gemeinsam-uebernahme" data-weg={lage.weg}>
              <SectionLabel>{t("gemeinsam.uebernahme.titel")}</SectionLabel>
              <p className="text-[12.5px] text-muted">
                {lage.weg === "direkt"
                  ? t("gemeinsam.uebernahme.direktSatz")
                  : t("gemeinsam.uebernahme.vorschlagSatz")}
              </p>
              {geaendert ? (
                <p className="mt-1 text-[12.5px] text-text">
                  {t("gemeinsam.uebernahme.erstSpeichern")}
                </p>
              ) : null}
              {!u.titelGeht ? (
                <p data-testid="gemeinsam-titel-nicht" className="mt-1 text-[12.5px] text-text">
                  {t("gemeinsam.uebernahme.titelNicht")}
                </p>
              ) : null}
              <Button
                type="button"
                variant="primary"
                className="mt-2"
                data-testid="gemeinsam-uebernehmen"
                disabled={
                  geaendert ||
                  !u.aktuell ||
                  !u.titelGeht ||
                  uebernahme === "laeuft" ||
                  konflikt !== null
                }
                onClick={() => void uebernehmen()}
              >
                {uebernahme === "laeuft"
                  ? t("gemeinsam.uebernahme.laeuft")
                  : lage.weg === "direkt"
                    ? t("gemeinsam.uebernahme.direkt")
                    : t("gemeinsam.uebernahme.vorschlag")}
              </Button>
              {uebernahmeWeiter !== null ? (
                <p
                  data-testid="gemeinsam-uebernahme-weiter"
                  className="mt-2 text-[12.5px] text-text"
                >
                  {t("gemeinsam.uebernahme.weiter", { revision: uebernahmeWeiter })}
                </p>
              ) : null}
            </Card>
          ) : null}

          <Card interactive={false}>
            <Verlauf e={entwurf} />
          </Card>
        </>
      )}
      {uebernahmeFehler !== null ? (
        <p
          role="alert"
          data-testid="gemeinsam-uebernahme-fehler"
          className="text-[12.5px] text-trust-crit-text"
        >
          {uebernahmeFehler}
        </p>
      ) : null}
    </div>
  );
}

function AbgeschlossenSatz({ e }: { e: GemeinsamerEntwurf }): JSX.Element {
  const { t, i18n } = useTranslation();
  const letzter = e.verlauf[e.verlauf.length - 1];
  const name = letzter?.eigen ? t("gemeinsam.anwesend.du") : (letzter?.name ?? "");
  const zeit = formatKoTimestamp(letzter?.am, i18n.language) ?? "";
  return (
    <p
      data-testid="gemeinsam-abgeschlossen"
      data-zustand={e.zustand}
      className="text-[13px] text-text"
    >
      {e.zustand === "uebernommen"
        ? t("gemeinsam.abgeschlossen.uebernommen", { fassung: letzter?.fassung ?? "", name, zeit })
        : t("gemeinsam.abgeschlossen.eingereicht", { name, zeit })}
    </p>
  );
}
