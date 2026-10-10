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

interface Meldung {
  art: "erfolg" | "fehler" | "hinweis";
  text: string;
}

export function OfficeImArtikel({ ko }: { ko: KnowledgeObject }): JSX.Element | null {
  const { t } = useTranslation();
  const [offen, setOffen] = useState<string | null>(null);
  const anhaenge = (ko.attachments ?? []).filter((a) => a.objectId && istOfficeAnhang(a.name));
  if (anhaenge.length === 0) {
    return null;
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
              onClick={() => setOffen(offen === a.id ? null : a.id)}
              className="rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
            >
              {offen === a.id ? t("officeartikel.zuklappen") : t("officeartikel.oeffnen")}
            </button>
          </li>
        ))}
      </ul>
      {offen ? (
        <OfficeAnhangFlaeche
          key={offen}
          ko={ko}
          anhangId={offen}
          name={anhaenge.find((a) => a.id === offen)?.name ?? ""}
          schliessen={() => setOffen(null)}
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
}: {
  ko: KnowledgeObject;
  anhangId: string;
  name: string;
  schliessen: () => void;
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

  const neuLaden = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["ko", ko.id] });
    void qc.invalidateQueries({ queryKey: ["kos"] });
    void qc.invalidateQueries({ queryKey: ["library"] });
  }, [qc, ko.id]);

  const fehlerText = (fehler: unknown) => t(officeFehlerSchluessel(fehler));
  const datum = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, { dateStyle: "medium", timeStyle: "short" });

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
}: {
  sitzung: OfficeSitzung;
  phase: EditorPhase;
  setPhase: (p: EditorPhase) => void;
  meldung: (m: Meldung | null) => void;
  beenden: (ergebnis: "abgebrochen" | "geschlossen") => void;
  uebernehmen: () => Promise<{ fassung: number }>;
  fehlerText: (fehler: unknown) => string;
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

  /** Speichern lassen und als Fassung übernehmen. `true`, wenn nichts verloren und alles gesagt ist. */
  async function speichernUndUebernehmen(): Promise<boolean> {
    setPhase("speichert");
    if (!(await speichern())) {
      setPhase("bereit");
      meldung({ art: "fehler", text: t("officeartikel.fehler.speichern") });
      return false;
    }
    setPhase("uebernimmt");
    try {
      const ergebnis = await uebernehmen();
      meldung({
        art: "erfolg",
        text: t("officeartikel.uebernommen", { fassung: ergebnis.fassung }),
      });
      setPhase("bereit");
      return true;
    } catch (fehler) {
      const code = (fehler as { code?: string }).code;
      // Nichts geändert seit der letzten Übernahme: kein Fehler, nichts zu tun.
      if (code === "OFFICE_NICHTS_GESPEICHERT") {
        setPhase("bereit");
        return true;
      }
      meldung({ art: "fehler", text: fehlerText(fehler) });
      setPhase("bereit");
      return false;
    }
  }

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
            if (schreiben && bereit && !(await speichernUndUebernehmen())) {
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
            meldung({
              art: "hinweis",
              text: schreiben
                ? t("officeartikel.abgebrochenSchreiben")
                : t("officeartikel.abgebrochen"),
            });
            beenden("abgebrochen");
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
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
