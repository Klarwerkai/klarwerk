// ================================================================================================
// R-0347 · FRAGEN AN EIN HOCHGELADENES DOKUMENT — die Fläche `/fragen/dokument`.
// ================================================================================================
//
// Ein Dokument wählen, eine Frage stellen, eine Antwort aus wörtlichen Stellen bekommen — jede mit
// einer Marke, die zur Fundstelle im gegliederten Dokument darunter springt und sie hervorhebt.
// Die Logik steht im DOM-freien Kern `lib/dokumentFragen.ts`; diese Datei liest die Datei mit den
// vorhandenen Lesern der Erfassung (`lib/files.ts`, `lib/docx.ts`) und zeigt an.
//
// WAS DIESE FLÄCHE BEWUSST NICHT TUT: nichts speichern, nichts an den Server oder ein Modell
// senden, nichts in den Wissensbestand übernehmen. Das Dokument ist Arbeitsmaterial (EF-6,
// „Grenze zum Bestand"); wer daraus Wissen machen will, geht den normalen Erfassungsweg.
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button, Card, PageHeader, SectionLabel, cx } from "../components/ui";
import { extractDocxRich } from "../lib/docx";
import {
  type DokumentAntwort,
  type DokumentBaustein,
  type Fundstelle,
  bausteineAusHtml,
  bausteineAusSeiten,
  bausteineAusText,
  beantworte,
  gliedere,
} from "../lib/dokumentFragen";
import { detectFileKind } from "../lib/extract";
import { readPdfFile, readTextFile } from "../lib/files";

/** Größte lesbare Datei. Dieselbe Größenordnung wie die PPTX-Kante der Erfassung (`files.ts`). */
const MAX_DATEI_MB = 50;
const MAX_DATEI_BYTES = MAX_DATEI_MB * 1024 * 1024;
const ACCEPT = ".pdf,.docx,.txt,.md,.markdown,text/plain,text/markdown,application/pdf";

interface GelesenesDokument {
  readonly name: string;
  readonly stellen: readonly Fundstelle[];
  /** Gesetzt, wenn das PDF mehr Seiten hatte als gelesen wurden: die Zahl der gelesenen Seiten. */
  readonly seitenGekuerzt: number | null;
}

interface Gefragt {
  readonly frage: string;
  readonly ergebnis: DokumentAntwort;
}

type Lage =
  | { readonly art: "leer" }
  | { readonly art: "liest"; readonly name: string }
  | { readonly art: "fehler"; readonly text: string }
  | { readonly art: "bereit"; readonly dokument: GelesenesDokument };

async function liesDokument(
  datei: File,
): Promise<{ bausteine: DokumentBaustein[]; seitenGekuerzt: number | null } | "format"> {
  switch (detectFileKind({ name: datei.name, type: datei.type })) {
    case "pdf": {
      const pdf = await readPdfFile(datei, { maxBytes: MAX_DATEI_BYTES });
      return {
        bausteine: pdf.pages ? bausteineAusSeiten(pdf.pages) : bausteineAusText(pdf.text),
        seitenGekuerzt: pdf.truncated ? pdf.pageCount : null,
      };
    }
    case "docx": {
      const word = await extractDocxRich(await datei.arrayBuffer());
      return { bausteine: bausteineAusHtml(word.html), seitenGekuerzt: null };
    }
    case "text":
      return { bausteine: bausteineAusText(await readTextFile(datei)), seitenGekuerzt: null };
    default:
      return "format";
  }
}

function stellenId(nummer: number): string {
  return `dokumentfragen-stelle-${nummer}`;
}

export function Dokumentfragen(): JSX.Element {
  const { t } = useTranslation();
  const [lage, setLage] = useState<Lage>({ art: "leer" });
  const [frage, setFrage] = useState("");
  const [antwort, setAntwort] = useState<Gefragt | null>(null);
  const [markiert, setMarkiert] = useState<number | null>(null);
  const dateiRef = useRef<HTMLInputElement>(null);
  const frageRef = useRef<HTMLInputElement>(null);

  // Ist das Dokument gelesen, steht das Fragefeld erst NACH diesem Rendern — deshalb hier.
  useEffect(() => {
    if (lage.art === "bereit") {
      frageRef.current?.focus();
    }
  }, [lage]);

  const ort = (s: Fundstelle): string =>
    s.seite !== null
      ? t("dokumentfragen.ortSeite", { seite: s.seite, absatz: s.absatz })
      : s.abschnitt !== null
        ? t("dokumentfragen.ortAbschnitt", { abschnitt: s.abschnitt, absatz: s.absatz })
        : t("dokumentfragen.ortAbsatz", { absatz: s.absatz });

  const dateiGewaehlt = async (datei: File | undefined): Promise<void> => {
    if (!datei) {
      return;
    }
    setAntwort(null);
    setMarkiert(null);
    if (datei.size > MAX_DATEI_BYTES) {
      setLage({
        art: "fehler",
        text: t("dokumentfragen.fehlerGroesse", {
          name: datei.name,
          mb: Math.ceil(datei.size / (1024 * 1024)),
          grenze: MAX_DATEI_MB,
        }),
      });
      return;
    }
    setLage({ art: "liest", name: datei.name });
    try {
      const gelesen = await liesDokument(datei);
      if (gelesen === "format") {
        setLage({ art: "fehler", text: t("dokumentfragen.fehlerFormat") });
        return;
      }
      const stellen = gliedere(gelesen.bausteine);
      if (stellen.length === 0) {
        setLage({ art: "fehler", text: t("dokumentfragen.fehlerLeer", { name: datei.name }) });
        return;
      }
      setLage({
        art: "bereit",
        dokument: { name: datei.name, stellen, seitenGekuerzt: gelesen.seitenGekuerzt },
      });
    } catch {
      setLage({ art: "fehler", text: t("dokumentfragen.fehlerLesen", { name: datei.name }) });
    }
  };

  const absenden = (e: FormEvent): void => {
    e.preventDefault();
    if (lage.art !== "bereit" || frage.trim().length === 0) {
      return;
    }
    setMarkiert(null);
    setAntwort({ frage: frage.trim(), ergebnis: beantworte(frage, lage.dokument.stellen) });
  };

  const zurFundstelle = (nummer: number): void => {
    setMarkiert(nummer);
    const ziel = document.getElementById(stellenId(nummer));
    ziel?.scrollIntoView({ block: "center", behavior: "smooth" });
    ziel?.focus({ preventScroll: true });
  };

  const anderesDokument = (): void => {
    setLage({ art: "leer" });
    setAntwort(null);
    setMarkiert(null);
    setFrage("");
    if (dateiRef.current) {
      dateiRef.current.value = "";
      dateiRef.current.click();
    }
  };

  const dokument = lage.art === "bereit" ? lage.dokument : null;

  return (
    <div className="mx-auto w-[800px] max-w-full pb-8 pt-9">
      <PageHeader
        kicker={t("dokumentfragen.kicker")}
        title={t("dokumentfragen.titel")}
        lead={t("dokumentfragen.lead")}
        pageKey="dokumentfragen"
        actions={
          <Link
            to="/fragen"
            className="text-[12.5px] font-semibold text-brand-text underline-offset-2 hover:underline"
          >
            {t("dokumentfragen.zurueck")}
          </Link>
        }
      />
      <p
        data-testid="dokumentfragen-datenschutz"
        className="mb-4 rounded-btn bg-page px-3 py-2 text-[12.5px] text-muted"
      >
        {t("dokumentfragen.datenschutz")}
      </p>

      <Card interactive={false} className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center rounded-btn border border-hairline px-4 py-2 text-sm font-semibold text-text hover:bg-hairline-soft focus-within:ring-2 focus-within:ring-ink/20">
            {t("dokumentfragen.dateiWaehlen")}
            <input
              ref={dateiRef}
              type="file"
              accept={ACCEPT}
              data-testid="dokumentfragen-datei"
              className="sr-only"
              onChange={(e) => void dateiGewaehlt(e.target.files?.[0])}
            />
          </label>
          <span className="text-[12.5px] text-muted-2">{t("dokumentfragen.formate")}</span>
        </div>
        <div aria-live="polite" className="mt-3 text-[13px]">
          {lage.art === "liest" ? (
            <p data-testid="dokumentfragen-liest" className="text-muted">
              {t("dokumentfragen.liest", { name: lage.name })}
            </p>
          ) : null}
          {lage.art === "fehler" ? (
            <p data-testid="dokumentfragen-fehler" role="alert" className="text-trust-crit-text">
              {lage.text}
            </p>
          ) : null}
          {dokument ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p data-testid="dokumentfragen-geladen" className="font-semibold text-text">
                {t("dokumentfragen.geladen", {
                  name: dokument.name,
                  anzahl: dokument.stellen.length,
                })}
              </p>
              <button
                type="button"
                onClick={anderesDokument}
                className="text-[12.5px] font-semibold text-brand-text underline-offset-2 hover:underline"
              >
                {t("dokumentfragen.anderesDokument")}
              </button>
            </div>
          ) : null}
          {dokument?.seitenGekuerzt ? (
            <p data-testid="dokumentfragen-gekuerzt" className="mt-1 text-trust-warn-text">
              {t("dokumentfragen.gekuerzt", { seiten: dokument.seitenGekuerzt })}
            </p>
          ) : null}
        </div>
      </Card>

      {dokument ? (
        <form onSubmit={absenden} className="mb-4 flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 block text-[12.5px] font-medium text-muted">
              {t("dokumentfragen.frageLabel")}
            </span>
            {/* Natives Feld statt `TextInput`: dieses reicht unter React 18 keinen `ref` durch,
                und nach dem Einlesen springt der Fokus hierher. Klassen wie `TextInput`. */}
            <input
              ref={frageRef}
              data-testid="dokumentfragen-frage"
              value={frage}
              placeholder={t("dokumentfragen.fragePlatzhalter")}
              onChange={(e) => setFrage(e.target.value)}
              className="h-10 w-full rounded-input border border-hairline bg-surface px-3 text-sm text-text outline-none transition-colors placeholder:text-muted-2 focus:border-ink/30"
            />
          </label>
          <Button
            type="submit"
            variant="primary"
            data-testid="dokumentfragen-senden"
            disabled={frage.trim().length === 0}
            className="h-10"
          >
            {t("dokumentfragen.fragen")}
          </Button>
        </form>
      ) : null}

      {antwort ? (
        <Card interactive={false} className="mb-6" data-testid="dokumentfragen-antwort">
          <p data-testid="dokumentfragen-gestellt" className="mb-2 text-[14px] text-muted-2">
            {antwort.frage}
          </p>
          {antwort.ergebnis.beantwortet ? (
            <>
              <p
                data-testid="dokumentfragen-etikett"
                className="mb-1 font-mono text-micro uppercase tracking-wider text-ai"
              >
                {t("dokumentfragen.antwortEtikett")}
              </p>
              <p className="mb-3 text-[13px] text-muted">
                {antwort.ergebnis.aussagen.length > 1
                  ? t("dokumentfragen.antwortVerknuepft", {
                      anzahl: antwort.ergebnis.aussagen.length,
                    })
                  : t("dokumentfragen.antwortEineStelle")}
              </p>
              <ol className="space-y-3">
                {antwort.ergebnis.aussagen.map((a) => (
                  <li
                    key={a.fundstelle.nummer}
                    data-testid="dokumentfragen-aussage"
                    data-fundstelle={a.fundstelle.nummer}
                    className="text-[15px] leading-relaxed text-text"
                  >
                    <blockquote className="inline">„{a.zitat}“</blockquote>{" "}
                    <button
                      type="button"
                      data-testid="dokumentfragen-marke"
                      aria-label={t("dokumentfragen.zurFundstelle", {
                        nummer: a.fundstelle.nummer,
                        ort: ort(a.fundstelle),
                      })}
                      onClick={() => zurFundstelle(a.fundstelle.nummer)}
                      className="ml-1 inline-flex items-center gap-1 rounded-[8px] border border-hairline bg-page px-2 py-0.5 align-baseline text-[12px] font-semibold text-text hover:bg-hairline-soft"
                    >
                      <span className="text-brand-text">{a.fundstelle.nummer}</span>
                      <span>· {ort(a.fundstelle)}</span>
                    </button>
                    <span className="mt-0.5 block text-[12px] text-muted-2">
                      {t("dokumentfragen.traegt", { begriffe: a.begriffe.join(", ") })}
                      {a.gekuerzt ? ` · ${t("dokumentfragen.zitatGekuerzt")}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 border-t border-hairline pt-3 text-[12.5px] text-muted">
                {t("dokumentfragen.antwortHinweis")}
              </p>
            </>
          ) : (
            <div data-testid="dokumentfragen-luecke">
              <p className="font-semibold text-text">{t("dokumentfragen.lueckeTitel")}</p>
              <p className="mt-1 text-[13px] text-muted">
                {antwort.ergebnis.grund === "frage-ohne-begriffe"
                  ? t("dokumentfragen.lueckeOhneBegriffe")
                  : t("dokumentfragen.lueckeText")}
              </p>
            </div>
          )}
          {antwort.ergebnis.nichtGefunden.length > 0 ? (
            <p
              data-testid="dokumentfragen-nicht-gefunden"
              className="mt-2 text-[12.5px] text-muted"
            >
              {t("dokumentfragen.nichtGefunden", {
                begriffe: antwort.ergebnis.nichtGefunden.join(", "),
              })}
            </p>
          ) : null}
        </Card>
      ) : null}

      {dokument ? (
        <section aria-labelledby="dokumentfragen-dokument-titel">
          <SectionLabel>
            <span id="dokumentfragen-dokument-titel">{t("dokumentfragen.dokumentTitel")}</span>
          </SectionLabel>
          <ol
            data-testid="dokumentfragen-dokument"
            className="max-h-[520px] space-y-2 overflow-auto rounded-card border border-hairline bg-surface p-3"
          >
            {dokument.stellen.map((s) => (
              <li
                key={s.nummer}
                id={stellenId(s.nummer)}
                tabIndex={-1}
                data-testid="dokumentfragen-stelle"
                data-nummer={s.nummer}
                data-markiert={markiert === s.nummer ? "true" : undefined}
                className={cx(
                  "rounded-btn px-2 py-1.5 text-[13.5px] leading-relaxed text-text outline-none",
                  markiert === s.nummer && "bg-trust-warn-bg ring-2 ring-trust-warn-text",
                )}
              >
                <span className="mb-0.5 block font-mono text-micro text-muted-2">
                  {s.nummer} · {ort(s)}
                </span>
                {s.text}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
