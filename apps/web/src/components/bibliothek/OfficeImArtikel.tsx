// ================================================================================================
// OFFICE IM ARTIKEL · Word, Excel und PowerPoint direkt am Artikel bearbeiten.
// ================================================================================================
//
// Auftrag `produkt:20261007:office-artikel-editor`. Der Weg: Artikel → „Im Artikel öffnen" →
// eingebetteter Editor (Formular-POST mit Zugangsmarke in ein iframe, Plan 3.1) → „Als neue Fassung
// übernehmen" bzw. „Speichern und zum Artikel" → Artikel → erneut öffnen.
//
// WAS DIE FLÄCHE ZEIGT, auch ohne laufenden Editor: den Schreibweg (bearbeiten / nur ansehen /
// freigegeben), jeden Dokumentstand mit seiner Fassung (Rückholen als neue Fassung), die Belegstellen
// des Artikels und an welchem Dokumentstand sie hängen, eine laufende gemeinsame Bearbeitung und
// Stände, die wegen eines Konflikts NICHT übernommen, aber gesichert wurden.
//
// WAS SIE NIE TUT: den Artikel freigeben. Jede Dokumentänderung setzt ihn auf „offen" (Server).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type OfficeAnhangLage,
  type OfficeSitzung,
  istOfficeAnhang,
  officeArtikel,
  officeFehlerSchluessel,
} from "../../api/officeArtikel";
import type { KnowledgeObject } from "../../api/types";
import { formatKoTimestamp } from "../../lib/koDates";
import {
  type EditorPhase,
  LADE_FRIST_MS,
  SPEICHER_FRIST_MS,
  bereitNachricht,
  deuteNachricht,
  istVomEditor,
  leseEditorNachricht,
  speicherNachricht,
} from "../../lib/officeEditor";
import { ExterneQuelleKennung } from "../ko/ExterneQuelleKennung";

interface Meldung {
  art: "erfolg" | "fehler" | "hinweis";
  text: string;
}

/** Ein gewünschter Wechsel (anderer Anhang) oder ein Zuklappen (`ziel: null`) bei offenem Editor. */
interface Wechselwunsch {
  ziel: string | null;
  nonce: number;
}

export function OfficeImArtikel({ ko }: { ko: KnowledgeObject }): JSX.Element | null {
  const { t } = useTranslation();
  const [offen, setOffen] = useState<string | null>(null);
  const [editorAktiv, setEditorAktiv] = useState(false);
  const [wunsch, setWunsch] = useState<Wechselwunsch | null>(null);
  // Die Meldung einer Fläche, die beim Wechsel verschwindet — sie bleibt hier sichtbar stehen.
  const [letzteMeldung, setLetzteMeldung] = useState<Meldung | null>(null);
  const anhaenge = (ko.attachments ?? []).filter((a) => a.objectId && istOfficeAnhang(a.name));
  if (anhaenge.length === 0) {
    return null;
  }

  // Nacharbeit 2 (bens Befund): bei laufendem Editor wechselt NICHTS sofort. Der Wunsch geht an den
  // Editor, der denselben Weg nimmt wie „Speichern und zurück" bzw. „Abbrechen"; erst wenn er
  // ohne Verlust geschlossen ist, wird gewechselt. Scheitert Speichern oder Übernahme, bleibt er offen.
  function waehle(ziel: string | null) {
    if (wunsch) {
      return;
    }
    if (!editorAktiv) {
      setLetzteMeldung(null);
      setOffen(ziel);
      return;
    }
    setWunsch({ ziel, nonce: Date.now() });
  }

  return (
    <section data-office-im-artikel="" className="mt-4 space-y-3">
      <h4 className="text-[13px] font-semibold text-text">{t("officeartikel.titel")}</h4>
      <ul className="space-y-1.5">
        {anhaenge.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[12.5px] text-text" title={a.name}>
              {a.name}
            </span>
            <button
              type="button"
              data-office-oeffnen={a.id}
              aria-expanded={offen === a.id}
              aria-disabled={wunsch !== null}
              onClick={() => waehle(offen === a.id ? null : a.id)}
              className="rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
            >
              {offen === a.id ? t("officeartikel.zuklappen") : t("officeartikel.oeffnen")}
            </button>
          </li>
        ))}
      </ul>
      {letzteMeldung ? (
        <output data-office-letzte-meldung={letzteMeldung.art} className="block text-[12.5px]">
          {letzteMeldung.text}
        </output>
      ) : null}
      {offen ? (
        <OfficeAnhangFlaeche
          key={offen}
          ko={ko}
          anhangId={offen}
          name={anhaenge.find((a) => a.id === offen)?.name ?? ""}
          schliessen={() => setOffen(null)}
          meldeEditorAktiv={setEditorAktiv}
          schliessAnfrage={wunsch?.nonce ?? 0}
          angefragtGeschlossen={(ok, meldung) => {
            const ziel = wunsch?.ziel ?? null;
            setWunsch(null);
            if (ok) {
              setEditorAktiv(false);
              setLetzteMeldung(meldung);
              setOffen(ziel);
            }
          }}
        />
      ) : null}
    </section>
  );
}

function OfficeAnhangFlaeche({
  ko,
  anhangId,
  name,
  schliessen,
  meldeEditorAktiv,
  schliessAnfrage,
  angefragtGeschlossen,
}: {
  ko: KnowledgeObject;
  anhangId: string;
  name: string;
  schliessen: () => void;
  meldeEditorAktiv: (aktiv: boolean) => void;
  schliessAnfrage: number;
  angefragtGeschlossen: (ok: boolean, meldung: Meldung | null) => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const lage = useQuery({
    queryKey: ["ko", ko.id, "office", anhangId],
    queryFn: () => officeArtikel.lage(ko.id, anhangId),
  });
  const [sitzung, setSitzung] = useState<OfficeSitzung | null>(null);
  const [phase, setPhase] = useState<EditorPhase>("geschlossen");
  const [meldung, setMeldung] = useState<Meldung | null>(null);
  const [beschaeftigt, setBeschaeftigt] = useState(false);

  useEffect(() => {
    meldeEditorAktiv(sitzung !== null);
  }, [sitzung, meldeEditorAktiv]);

  const neuLaden = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["ko", ko.id] });
    void qc.invalidateQueries({ queryKey: ["kos"] });
    void qc.invalidateQueries({ queryKey: ["library"] });
  }, [qc, ko.id]);

  const fehlerText = (fehler: unknown) => t(officeFehlerSchluessel(fehler));
  // R-1010: dieselbe Zeitregel wie überall (`formatKoTimestamp`), in der Sprache der Oberfläche.
  const datum = (iso: string) => formatKoTimestamp(iso, i18n.language) ?? "—";

  async function starten() {
    setMeldung(null);
    setBeschaeftigt(true);
    try {
      const neu = await officeArtikel.sitzung(ko.id, anhangId);
      setSitzung(neu);
      setPhase("laedt");
    } catch (fehler) {
      setMeldung({ art: "fehler", text: fehlerText(fehler) });
    } finally {
      setBeschaeftigt(false);
    }
  }

  async function nachUebernahme(aufgabe: () => Promise<{ fassung: number }>) {
    setBeschaeftigt(true);
    try {
      const ergebnis = await aufgabe();
      setMeldung({
        art: "erfolg",
        text: t("officeartikel.uebernommen", { fassung: ergebnis.fassung }),
      });
      neuLaden();
    } catch (fehler) {
      setMeldung({ art: "fehler", text: fehlerText(fehler) });
      void lage.refetch();
    } finally {
      setBeschaeftigt(false);
    }
  }

  const d = lage.data;
  const direkt = d?.schreibweg === "direkt";
  const ohneSitzung = !sitzung && d?.sitzung.laeuft !== true;

  return (
    <div
      data-office-flaeche={anhangId}
      className="rounded-card border border-hairline p-3"
      aria-busy={beschaeftigt || lage.isLoading}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] font-semibold text-text">{name}</span>
        {d ? (
          <span data-office-fassung="" className="text-[12px] text-muted">
            {t("officeartikel.fassungStatus", { fassung: d.fassung, status: d.status })}
          </span>
        ) : null}
      </div>

      {lage.isError ? (
        <p role="alert" className="mt-2 text-[12.5px] text-danger">
          {fehlerText(lage.error)}
        </p>
      ) : null}

      {d ? (
        <>
          <p data-office-schreibweg={d.schreibweg} className="mt-2 text-[12.5px] text-muted">
            {t(`officeartikel.weg.${d.schreibweg}`)}
          </p>
          <p className="mt-1 text-[12px] text-muted">{t("officeartikel.statusRegel")}</p>
          {/* <output> trägt implizit role="status" (biome useSemanticElements). */}
          {!d.editorEingerichtet ? (
            <output data-office-nicht-eingerichtet="" className="mt-2 block text-[12.5px]">
              {t("officeartikel.fehler.nichtEingerichtet")}
            </output>
          ) : null}
          {d.sitzung.laeuft && !sitzung ? (
            <output data-office-gemeinsam="" className="mt-2 block text-[12.5px]">
              {t("officeartikel.gemeinsam", { fassung: d.sitzung.basisFassung })}
            </output>
          ) : null}
          {d.gesichert.map((g) => (
            <div
              key={g.objectId}
              data-office-gesichert={g.objectId}
              className="mt-2 rounded-btn border border-hairline p-2 text-[12.5px]"
            >
              <p>{t("officeartikel.gesichert", { zeit: datum(g.at) })}</p>
              {direkt && ohneSitzung ? (
                <button
                  type="button"
                  aria-disabled={beschaeftigt}
                  onClick={() =>
                    !beschaeftigt &&
                    void nachUebernahme(() =>
                      officeArtikel.gesichert(ko.id, anhangId, g.objectId, d.fassung),
                    )
                  }
                  className="mt-1.5 rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold"
                >
                  {t("officeartikel.gesichertUebernehmen")}
                </button>
              ) : null}
            </div>
          ))}
        </>
      ) : null}

      {meldung?.art === "fehler" ? (
        <p data-office-meldung="fehler" role="alert" className="mt-2 text-[12.5px] text-danger">
          {meldung.text}
        </p>
      ) : meldung ? (
        <output data-office-meldung={meldung.art} className="mt-2 block text-[12.5px] text-text">
          {meldung.text}
        </output>
      ) : null}

      {d && !sitzung ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {d.schreibweg !== "kein-zugang" ? (
            <button
              type="button"
              data-office-starten=""
              aria-disabled={beschaeftigt || !d.editorEingerichtet}
              onClick={() => !beschaeftigt && d.editorEingerichtet && void starten()}
              className="rounded-btn bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white"
            >
              {direkt ? t("officeartikel.bearbeiten") : t("officeartikel.ansehen")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={schliessen}
            className="rounded-btn border border-hairline px-3 py-1.5 text-[12.5px] font-semibold text-muted"
          >
            {t("officeartikel.zurueckZumArtikel")}
          </button>
        </div>
      ) : null}

      {sitzung ? (
        <EditorRahmen
          sitzung={sitzung}
          phase={phase}
          setPhase={setPhase}
          meldung={setMeldung}
          beenden={(ergebnis) => {
            setSitzung(null);
            setPhase(ergebnis);
            neuLaden();
            void lage.refetch();
          }}
          uebernehmen={() => officeArtikel.uebernahme(ko.id, anhangId)}
          fehlerText={fehlerText}
          schliessAnfrage={schliessAnfrage}
          angefragtGeschlossen={angefragtGeschlossen}
        />
      ) : null}

      {d ? <Verlauf lage={d} datum={datum} /> : null}

      {d && direkt && ohneSitzung ? (
        <Rueckholen
          lage={d}
          aktiv={!beschaeftigt}
          holen={(ausFassung) =>
            void nachUebernahme(() =>
              officeArtikel.zurueckholen(ko.id, anhangId, ausFassung, d.fassung),
            )
          }
        />
      ) : null}

      {d ? <Belegstellen lage={d} /> : null}
    </div>
  );
}

function EditorRahmen({
  sitzung,
  phase,
  setPhase,
  meldung,
  beenden,
  uebernehmen,
  fehlerText,
  schliessAnfrage,
  angefragtGeschlossen,
}: {
  sitzung: OfficeSitzung;
  phase: EditorPhase;
  setPhase: (p: EditorPhase) => void;
  meldung: (m: Meldung | null) => void;
  beenden: (ergebnis: "abgebrochen" | "geschlossen") => void;
  uebernehmen: () => Promise<{ fassung: number }>;
  fehlerText: (fehler: unknown) => string;
  /** Wechselt der Wert, möchte die Seite zuklappen oder einen anderen Anhang öffnen. */
  schliessAnfrage: number;
  angefragtGeschlossen: (ok: boolean, meldung: Meldung | null) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const rahmenName = `office-editor-${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const formular = useRef<HTMLFormElement>(null);
  const rahmen = useRef<HTMLIFrameElement>(null);
  const speicherWarten = useRef<((erfolg: boolean) => void) | null>(null);
  const schreiben = sitzung.schreibweg === "direkt";

  useEffect(() => {
    formular.current?.submit();
  }, []);

  useEffect(() => {
    const hoeren = (e: MessageEvent) => {
      if (!istVomEditor(e.origin, sitzung.editorHerkunft)) {
        return;
      }
      const n = leseEditorNachricht(e.data);
      if (!n) {
        return;
      }
      const ereignis = deuteNachricht(n);
      if (ereignis.art === "rahmen-bereit") {
        rahmen.current?.contentWindow?.postMessage(bereitNachricht(), sitzung.editorHerkunft);
      } else if (ereignis.art === "geladen") {
        setPhase("bereit");
      } else if (ereignis.art === "ladefehler") {
        setPhase("fehler");
        meldung({ art: "fehler", text: t("officeartikel.fehler.laden") });
      } else if (ereignis.art === "gespeichert") {
        speicherWarten.current?.(ereignis.erfolg);
        speicherWarten.current = null;
      } else if (ereignis.art === "geschlossen") {
        meldung({ art: "hinweis", text: t("officeartikel.editorGeschlossen") });
        beenden("geschlossen");
      }
    };
    window.addEventListener("message", hoeren);
    return () => window.removeEventListener("message", hoeren);
  }, [sitzung.editorHerkunft, setPhase, meldung, beenden, t]);

  useEffect(() => {
    if (phase !== "laedt") {
      return;
    }
    const frist = window.setTimeout(() => {
      setPhase("fehler");
      meldung({ art: "fehler", text: t("officeartikel.fehler.laden") });
    }, LADE_FRIST_MS);
    return () => window.clearTimeout(frist);
  }, [phase, setPhase, meldung, t]);

  function speichern(): Promise<boolean> {
    return new Promise((fertig) => {
      const frist = window.setTimeout(() => {
        speicherWarten.current = null;
        fertig(false);
      }, SPEICHER_FRIST_MS);
      speicherWarten.current = (erfolg) => {
        window.clearTimeout(frist);
        fertig(erfolg);
      };
      rahmen.current?.contentWindow?.postMessage(speicherNachricht(), sitzung.editorHerkunft);
    });
  }

  /**
   * Speichern lassen und als Fassung übernehmen. Gibt die Meldung des Erfolgs zurück; `null` heißt:
   * gescheitert — die Fehlermeldung steht da, und der Editor bleibt offen, damit nichts verloren geht.
   */
  async function speichernUndUebernehmen(): Promise<Meldung | null> {
    setPhase("speichert");
    if (!(await speichern())) {
      setPhase("bereit");
      meldung({ art: "fehler", text: t("officeartikel.fehler.speichern") });
      return null;
    }
    setPhase("uebernimmt");
    try {
      const ergebnis = await uebernehmen();
      const erfolg: Meldung = {
        art: "erfolg",
        text: t("officeartikel.uebernommen", { fassung: ergebnis.fassung }),
      };
      meldung(erfolg);
      setPhase("bereit");
      return erfolg;
    } catch (fehler) {
      const code = (fehler as { code?: string }).code;
      // Nichts geändert seit der letzten Übernahme: kein Fehler, nichts zu tun.
      if (code === "OFFICE_NICHTS_GESPEICHERT") {
        setPhase("bereit");
        return { art: "hinweis", text: t("officeartikel.editorGeschlossen") };
      }
      meldung({ art: "fehler", text: fehlerText(fehler) });
      setPhase("bereit");
      return null;
    }
  }

  /** Sichtbar abbrechen: der Editor schließt; Automatisch Gespeichertes übernimmt bzw. sichert der Server. */
  function abbrechen(): Meldung {
    const hinweis: Meldung = {
      art: "hinweis",
      text: schreiben ? t("officeartikel.abgebrochenSchreiben") : t("officeartikel.abgebrochen"),
    };
    meldung(hinweis);
    beenden("abgebrochen");
    return hinweis;
  }

  /**
   * Der EINE kontrollierte Schließweg für Zuklappen und Anhangswechsel (Nacharbeit 2): bereit und
   * schreibend → speichern und übernehmen (scheitert das, bleibt der Editor offen); sonst sichtbar
   * abbrechen. Während eines laufenden Speicherns wird nicht geschlossen.
   */
  async function kontrolliertSchliessen(): Promise<{ ok: boolean; meldung: Meldung | null }> {
    if (phase === "speichert" || phase === "uebernimmt") {
      return { ok: false, meldung: null };
    }
    if (schreiben && phase === "bereit") {
      const erfolg = await speichernUndUebernehmen();
      if (!erfolg) {
        return { ok: false, meldung: null };
      }
      beenden("geschlossen");
      return { ok: true, meldung: erfolg };
    }
    return { ok: true, meldung: abbrechen() };
  }

  // Die jüngste Fassung des Schließwegs; der Effekt unten hängt so nur an der Anfrage selbst.
  const schliessWeg = useRef(kontrolliertSchliessen);
  schliessWeg.current = kontrolliertSchliessen;
  const antwortWeg = useRef(angefragtGeschlossen);
  antwortWeg.current = angefragtGeschlossen;
  const letzteAnfrage = useRef(schliessAnfrage);
  useEffect(() => {
    if (schliessAnfrage === letzteAnfrage.current) {
      return;
    }
    letzteAnfrage.current = schliessAnfrage;
    void schliessWeg.current().then(({ ok, meldung: m }) => antwortWeg.current(ok, m));
  }, [schliessAnfrage]);

  const bereit = phase === "bereit";
  return (
    <div className="mt-3" data-office-editor={phase}>
      <form
        ref={formular}
        action={sitzung.editorUrl}
        method="post"
        target={rahmenName}
        className="hidden"
      >
        <input type="hidden" name="access_token" value={sitzung.accessToken} />
        <input type="hidden" name="access_token_ttl" value={String(sitzung.accessTokenTtl)} />
      </form>
      <output data-office-phase={phase} className="mb-2 block text-[12.5px] text-muted">
        {t(`officeartikel.phase.${phase}`)}
      </output>
      <p data-office-klara="" className="mb-2 text-[12px] text-muted">
        {t("officeartikel.klaraOhneAuswahl")}
      </p>
      <iframe
        ref={rahmen}
        name={rahmenName}
        title={t("officeartikel.editorTitel")}
        className="h-[70vh] w-full rounded-btn border border-hairline"
        allow="clipboard-read; clipboard-write; fullscreen"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {schreiben ? (
          <button
            type="button"
            data-office-uebernehmen=""
            aria-disabled={!bereit}
            onClick={() => bereit && void speichernUndUebernehmen()}
            className="rounded-btn bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white"
          >
            {t("officeartikel.alsFassung")}
          </button>
        ) : null}
        <button
          type="button"
          data-office-schliessen=""
          aria-disabled={phase === "speichert" || phase === "uebernimmt"}
          onClick={async () => {
            if (phase === "speichert" || phase === "uebernimmt") {
              return;
            }
            if (schreiben && bereit && (await speichernUndUebernehmen()) === null) {
              // Gescheitert: der Editor bleibt offen, damit nichts verloren geht.
              return;
            }
            beenden("geschlossen");
          }}
          className="rounded-btn border border-hairline px-3 py-1.5 text-[12.5px] font-semibold"
        >
          {schreiben ? t("officeartikel.speichernZurueck") : t("officeartikel.zurueckZumArtikel")}
        </button>
        <button
          type="button"
          data-office-abbrechen=""
          onClick={() => {
            abbrechen();
          }}
          className="rounded-btn border border-hairline px-3 py-1.5 text-[12.5px] font-semibold text-muted"
        >
          {t("officeartikel.abbrechen")}
        </button>
      </div>
    </div>
  );
}

function Verlauf({
  lage,
  datum,
}: {
  lage: OfficeAnhangLage;
  datum: (iso: string) => string;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="mt-3">
      <h5 className="text-[12.5px] font-semibold text-text">{t("officeartikel.verlauf")}</h5>
      <ol data-office-verlauf="" className="mt-1 space-y-0.5 text-[12px] text-muted">
        {[...lage.verlauf].reverse().map((z) => (
          <li key={`${z.version}-${z.objectId}`} data-office-stand={z.version}>
            {t("officeartikel.stand", { fassung: z.version, zeit: datum(z.at) })}
            {z.restoredFrom !== undefined
              ? ` · ${t("officeartikel.zurueckgeholtAus", { fassung: z.restoredFrom })}`
              : ""}
            {z.aktuell ? ` · ${t("officeartikel.aktuell")}` : ""}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Rueckholen({
  lage,
  aktiv,
  holen,
}: {
  lage: OfficeAnhangLage;
  aktiv: boolean;
  holen: (ausFassung: number) => void;
}): JSX.Element | null {
  const { t } = useTranslation();
  const fruehere = lage.verlauf.filter((z) => !z.aktuell);
  if (fruehere.length === 0) {
    return null;
  }
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {[...fruehere].reverse().map((z) => (
        <button
          key={`${z.version}-${z.objectId}`}
          type="button"
          data-office-zurueckholen={z.version}
          aria-disabled={!aktiv}
          onClick={() => aktiv && holen(z.version)}
          className="rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
        >
          {t("officeartikel.zurueckholen", { fassung: z.version })}
        </button>
      ))}
    </div>
  );
}

function Belegstellen({ lage }: { lage: OfficeAnhangLage }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="mt-3">
      <h5 className="text-[12.5px] font-semibold text-text">{t("officeartikel.belegstellen")}</h5>
      {lage.belegstellen.length === 0 ? (
        <p className="mt-1 text-[12px] text-muted">{t("officeartikel.keineBelegstellen")}</p>
      ) : (
        <ul data-office-belegstellen="" className="mt-1 space-y-1 text-[12px]">
          {lage.belegstellen.map((b) => (
            <li key={b.quelleId} data-office-beleg={b.stand}>
              <span className="text-text">{b.label}</span>
              {" — "}
              <span className={b.stand === "frueher" ? "text-danger" : "text-muted"}>
                {b.stand === "aktuell"
                  ? t("officeartikel.belegAktuell")
                  : t("officeartikel.belegFrueher", { fassung: b.ausFassung ?? "?" })}
              </span>{" "}
              {/* R-0205: der Prüfstand der Quelle, unabhängig vom Dokumentstand — „Stufe 2" und
                  „Extern · ungeprüft" an jeder nicht peer-validierten Belegstelle. */}
              <span data-office-beleg-kennung="" className="inline-flex gap-1.5">
                <ExterneQuelleKennung source={{ peerValidated: b.peerValidated === true }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
