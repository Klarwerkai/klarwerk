// ================================================================================================
// BILDSCHIRMABLÄUFE (produkt:wettbewerb:20261003:bildschirmablaeufe) — `/erfassen/ablauf`.
// ================================================================================================
//
// DER WEG: Datei wählen → Schritte ansehen, korrigieren, verschieben, entfernen, Bilder ersetzen
// und Angaben schwärzen → als Entwurf speichern → über den VORHANDENEN Einreichweg
// (`POST /api/drafts/:id/promote`) zur Prüfung nach Kontoregel geben. Keine eigene Freigabe, kein
// eigener Speicher: Entwurf, Einreichen, Prüfung und Fassungen sind die Bestandswege.
//
// WAS DIESE SEITE AUSDRÜCKLICH NICHT IST: kein Rekorder. Sie zeichnet nichts auf und beobachtet
// keinen Bildschirm; sie liest eine Datei, die der Mensch bewusst wählt. Begründung der Wahl und
// Datenflüsse: `docs/aufnahme/bildschirmablauf-uebernahme.md`.
//
// WIEDERHOLSICHER: Der Übernahmeschlüssel (Dateiinhalt + Konto) geht als `operationId` an die
// Entwurfsanlage und — abgeleitet — an das Einreichen. Dieselbe Datei noch einmal öffnet denselben
// Entwurf; nach dem Einreichen entsteht aus ihr kein zweites Wissensobjekt. Eine neue Fassung legt
// der Mensch BEWUSST am bestehenden Objekt an (`revise`, unten).
//
// NICHTS GEHT STILL VERLOREN: Ein abgelehnter Import, ein gescheitertes Speichern oder Einreichen
// lässt den Bearbeitungsstand stehen und sagt, was passiert ist. Ungespeicherte Änderungen meldet
// die vorhandene Wache (`NavGuardContext`) vor jedem Seitenwechsel und beim Neuladen.

import {
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { Ablauf, Confidentiality, DraftPayload, KnowledgeType } from "../api/types";
import { useSession } from "../app/AuthContext";
import { useNavGuard, useUnloadGuard } from "../app/NavGuardContext";
import { KNOWLEDGE_TYPES } from "../components/trust/types";
import { schwaerzeBild } from "../lib/ablaufBild";
import {
  ABLAUF_DATEI_MAX_BYTES,
  type AblaufFehler,
  type AblaufFormulierung,
  ablaufZuRumpf,
  einreichSchluessel,
  leseAblaufDatei,
  pruefeSchritte,
  schrittBildSetzen,
  schrittEntfernen,
  schrittTextAendern,
  schrittVerschieben,
  schwaerzeInSchritten,
  schwaerzeText,
  uebernahmeSchluessel,
} from "../lib/ablaufImport";
import type { Rechteck } from "../lib/ablaufSchwaerzen";
import { CONFIDENTIALITY_LEVELS } from "../lib/confidentiality";

interface Meta {
  title: string;
  statement: string;
  type: KnowledgeType | "";
  category: string;
  confidentiality: Confidentiality | "";
}

const LEERE_META: Meta = { title: "", statement: "", type: "", category: "", confidentiality: "" };

type Meldung = { art: "ok" | "fehler"; text: string };

function grundAus(e: unknown, ersatz: string): string {
  return e instanceof Error && e.message ? e.message : ersatz;
}

/** Nimmt eine Kennung oder eine Adresse wie `/wissen/<id>` und liefert die Kennung. */
function koKennung(eingabe: string): string {
  const teile = eingabe.trim().split(/[/?#]/).filter(Boolean);
  const wissen = teile.indexOf("wissen");
  const kandidat = wissen >= 0 ? teile[wissen + 1] : teile[teile.length - 1];
  return kandidat && /^[\w-]{1,128}$/.test(kandidat) ? kandidat : "";
}

function dateiAlsDataUrl(datei: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("lesefehler"));
    r.readAsDataURL(datei);
  });
}

export function AblaufUebernahme(): JSX.Element {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const entwurfParam = params.get("entwurf");
  const { user } = useSession();
  const { setGuard } = useNavGuard();

  const [ablauf, setAblauf] = useState<Ablauf | null>(null);
  const [meta, setMeta] = useState<Meta>(LEERE_META);
  const [entwurf, setEntwurf] = useState<{ id: string; updatedAt: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [importFehler, setImportFehler] = useState<AblaufFehler | null>(null);
  const [meldung, setMeldung] = useState<Meldung | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  const [eingereicht, setEingereicht] = useState<string | null>(null);
  const [bereitsEingereicht, setBereitsEingereicht] = useState(false);
  const [zielKo, setZielKo] = useState("");
  const [begriff, setBegriff] = useState("");

  const formulierung: AblaufFormulierung = {
    oeffnen: (adresse) => t("ablauf.formulierung.oeffnen", { adresse }),
    klicken: (ziel) => t("ablauf.formulierung.klicken", { ziel }),
    eingeben: (wert, ziel) => t("ablauf.formulierung.eingeben", { wert, ziel }),
    taste: (taste) => t("ablauf.formulierung.taste", { taste }),
  };

  // ---------------------------------------------------------------------------------------------
  // LADEN: `?entwurf=<id>` öffnet einen gespeicherten Ablauf-Entwurf — auch nach dem Neuladen.
  // ---------------------------------------------------------------------------------------------
  const geladenFuer = useRef<string | null>(null);
  useEffect(() => {
    if (!entwurfParam || geladenFuer.current === entwurfParam) {
      return;
    }
    geladenFuer.current = entwurfParam;
    setLaedt(true);
    endpoints.drafts
      .get(entwurfParam)
      .then((d) => {
        if (!d.payload.ablauf) {
          setMeldung({ art: "fehler", text: t("ablauf.laden.keinAblauf") });
          return;
        }
        const p = d.payload;
        setAblauf(p.ablauf ?? null);
        setMeta({
          title: p.title ?? "",
          statement: p.statement ?? "",
          type: p.type ?? "",
          category: p.category ?? "",
          confidentiality: p.confidentiality ?? "",
        });
        setEntwurf({ id: d.id, updatedAt: d.updatedAt });
        setDirty(false);
      })
      .catch(() => setMeldung({ art: "fehler", text: t("ablauf.laden.fehler") }))
      .finally(() => setLaedt(false));
  }, [entwurfParam, t]);

  // ---------------------------------------------------------------------------------------------
  // DER RUMPF: aus Herkunft und Schritten — er wird mit jedem Speichern neu erzeugt.
  // ---------------------------------------------------------------------------------------------
  const herkunftZeilen = (a: Ablauf): string[] => [
    t("ablauf.herkunft.extern", { werkzeug: a.quelle.werkzeug }),
    t("ablauf.herkunft.format", { format: a.quelle.format }),
    ...(a.quelle.datei ? [t("ablauf.herkunft.datei", { datei: a.quelle.datei })] : []),
    ...(a.quelle.aufgezeichnetAm
      ? [t("ablauf.herkunft.zeit", { zeit: a.quelle.aufgezeichnetAm })]
      : []),
    ...(a.quelle.anwendung
      ? [t("ablauf.herkunft.anwendung", { anwendung: a.quelle.anwendung })]
      : []),
  ];

  const rumpf = (a: Ablauf): string => {
    const zusatz = [
      a.quelle.datei ? `, ${t("ablauf.herkunft.datei", { datei: a.quelle.datei })}` : "",
      a.quelle.aufgezeichnetAm
        ? `, ${t("ablauf.herkunft.zeit", { zeit: a.quelle.aufgezeichnetAm })}`
        : "",
      a.quelle.anwendung
        ? `, ${t("ablauf.herkunft.anwendung", { anwendung: a.quelle.anwendung })}`
        : "",
    ].join("");
    return ablaufZuRumpf(a, {
      schritt: (nummer) => t("ablauf.schritt.titel", { nummer }),
      herkunft: t("ablauf.rumpf.herkunft", {
        werkzeug: a.quelle.werkzeug,
        format: a.quelle.format,
        zusatz,
      }),
      hinweis: t("ablauf.rumpf.hinweis"),
    });
  };

  const nutzlast = (a: Ablauf, m: Meta): DraftPayload => ({
    title: m.title,
    statement: m.statement,
    category: m.category,
    ...(m.type ? { type: m.type } : {}),
    ...(m.confidentiality ? { confidentiality: m.confidentiality } : {}),
    ablauf: a,
    bodyHtml: rumpf(a),
  });

  // ---------------------------------------------------------------------------------------------
  // IMPORT
  // ---------------------------------------------------------------------------------------------
  const onDatei = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const datei = e.target.files?.[0];
    e.target.value = "";
    if (!datei) {
      return;
    }
    setMeldung(null);
    if (datei.size > ABLAUF_DATEI_MAX_BYTES) {
      setImportFehler({ code: "datei_zu_gross" });
      return;
    }
    const inhalt = await datei.text();
    const ergebnis = leseAblaufDatei(inhalt, datei.name, formulierung);
    if (!ergebnis.ok) {
      // Der bisherige Stand bleibt unangetastet — nur der Fehler wird gezeigt.
      setImportFehler(ergebnis.fehler);
      return;
    }
    setImportFehler(null);
    setBeschaeftigt(true);
    // Ein gültiger neuer Import ersetzt die Fläche. Ungespeicherte Bearbeitung des offenen Ablaufs
    // wird VORHER gesichert; scheitert das, bleibt alles stehen und nichts wird übernommen.
    if (ablauf && entwurf && dirty) {
      try {
        await speichern();
      } catch (fehler) {
        setMeldung({
          art: "fehler",
          text: t("ablauf.speichernFehler", { grund: grundAus(fehler, t("state.error")) }),
        });
        setBeschaeftigt(false);
        return;
      }
    }
    try {
      const schluessel = await uebernahmeSchluessel(inhalt, user?.id ?? "");
      const titel = ergebnis.titel || datei.name.replace(/\.json$/i, "");
      // Die Anlage trägt NUR den unveränderten Import (ohne Dateinamen, ohne Rumpf): derselbe Inhalt
      // ergibt denselben Abdruck, und die Wiederholung findet den vorhandenen Entwurf.
      const { datei: dateiname, ...quelleOhneDatei } = ergebnis.ablauf.quelle;
      const anlage: Ablauf = {
        quelle: { ...quelleOhneDatei, schluessel },
        schritte: ergebnis.ablauf.schritte,
      };
      const d = await endpoints.drafts.create(
        { title: titel, ablauf: anlage },
        schluessel,
        user?.id,
      );
      const vorhanden = d.payload.ablauf;
      const frisch = d.createdAt === d.updatedAt;
      const lokal: Ablauf =
        vorhanden && !frisch
          ? vorhanden
          : {
              quelle: { ...anlage.quelle, ...(dateiname ? { datei: dateiname } : {}) },
              schritte: anlage.schritte,
            };
      setAblauf(lokal);
      setMeta({
        title: d.payload.title ?? titel,
        statement: d.payload.statement ?? "",
        type: d.payload.type ?? "",
        category: d.payload.category ?? "",
        confidentiality: d.payload.confidentiality ?? "",
      });
      setEntwurf({ id: d.id, updatedAt: d.updatedAt });
      setEingereicht(null);
      setBereitsEingereicht(false);
      // Ein frischer Entwurf trägt den Dateinamen und den Rumpf erst nach dem ersten Speichern.
      setDirty(frisch);
      geladenFuer.current = d.id;
      setParams({ entwurf: d.id }, { replace: true });
    } catch (fehler) {
      setMeldung({
        art: "fehler",
        text: t("ablauf.speichernFehler", { grund: grundAus(fehler, t("state.error")) }),
      });
    } finally {
      setBeschaeftigt(false);
    }
  };

  // ---------------------------------------------------------------------------------------------
  // BEARBEITEN
  // ---------------------------------------------------------------------------------------------
  const aendern = (neu: Ablauf): void => {
    setAblauf(neu);
    setDirty(true);
    setMeldung(null);
  };
  const metaAendern = (teil: Partial<Meta>): void => {
    setMeta((m) => ({ ...m, ...teil }));
    setDirty(true);
  };

  const textSchwaerzen = (): void => {
    if (!ablauf || !begriff.trim()) {
      return;
    }
    const { ablauf: neu, treffer } = schwaerzeInSchritten(ablauf, begriff);
    const imTitel = meta.title.toLowerCase().includes(begriff.trim().toLowerCase());
    const inAussage = meta.statement.toLowerCase().includes(begriff.trim().toLowerCase());
    aendern(neu);
    setMeta((m) => ({
      ...m,
      title: schwaerzeText(m.title, begriff),
      statement: schwaerzeText(m.statement, begriff),
    }));
    setMeldung({
      art: "ok",
      text: t("ablauf.schwaerzen.ergebnis", {
        anzahl: treffer + (imTitel ? 1 : 0) + (inAussage ? 1 : 0),
      }),
    });
    setBegriff("");
  };

  const bildSchwaerzen = async (id: string, src: string, bereich: Rechteck): Promise<void> => {
    if (!ablauf) {
      return;
    }
    try {
      const neu = await schwaerzeBild(src, [bereich]);
      const kandidat = schrittBildSetzen(ablauf, id, neu);
      const fehler = pruefeSchritte(kandidat.schritte);
      if (fehler) {
        setImportFehler(fehler);
        return;
      }
      aendern(kandidat);
      setMeldung({ art: "ok", text: t("ablauf.bild.geschwaerzt") });
    } catch {
      setMeldung({ art: "fehler", text: t("ablauf.bild.fehler") });
    }
  };

  const bildSetzen = async (id: string, datei: File | undefined): Promise<void> => {
    if (!ablauf || !datei) {
      return;
    }
    try {
      const kandidat = schrittBildSetzen(ablauf, id, await dateiAlsDataUrl(datei));
      const fehler = pruefeSchritte(kandidat.schritte);
      if (fehler) {
        setImportFehler(fehler);
        return;
      }
      setImportFehler(null);
      aendern(kandidat);
    } catch {
      setMeldung({ art: "fehler", text: t("ablauf.bild.fehler") });
    }
  };

  // ---------------------------------------------------------------------------------------------
  // SPEICHERN — der vorhandene Entwurfsweg mit Standvergleich.
  // ---------------------------------------------------------------------------------------------
  const speichern = async (): Promise<{ id: string; updatedAt: string } | null> => {
    if (!ablauf || !entwurf) {
      return null;
    }
    const fehler = pruefeSchritte(ablauf.schritte);
    if (fehler) {
      setImportFehler(fehler);
      throw new Error(t(`ablauf.fehler.${fehler.code}`, { schritt: fehler.schritt, detail: "" }));
    }
    const d = await endpoints.drafts.update(entwurf.id, nutzlast(ablauf, meta), {
      expectedUpdatedAt: entwurf.updatedAt,
    });
    const stand = { id: d.id, updatedAt: d.updatedAt };
    setEntwurf(stand);
    setDirty(false);
    return stand;
  };

  const onSpeichern = async (): Promise<void> => {
    setBeschaeftigt(true);
    setMeldung(null);
    try {
      await speichern();
      setMeldung({ art: "ok", text: t("ablauf.gespeichert") });
    } catch (fehler) {
      setMeldung({
        art: "fehler",
        text: t("ablauf.speichernFehler", { grund: grundAus(fehler, t("state.error")) }),
      });
    } finally {
      setBeschaeftigt(false);
    }
  };

  // Die vorhandene Ungespeichert-Wache: vor jedem Seitenwechsel fragen, beim Neuladen warnen.
  const speichernRef = useRef(speichern);
  speichernRef.current = speichern;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    setGuard({
      isDirty: () => dirtyRef.current,
      save: async () => {
        await speichernRef.current();
      },
    });
    return () => setGuard(null);
  }, [setGuard]);
  useUnloadGuard(dirty);

  // ---------------------------------------------------------------------------------------------
  // EINREICHEN — der vorhandene Promote-Weg, wiederholsicher über den abgeleiteten Schlüssel.
  // ---------------------------------------------------------------------------------------------
  const fehlendeFelder = (): string[] => [
    ...(meta.title.trim() ? [] : [t("ablauf.meta.titel")]),
    ...(meta.statement.trim() ? [] : [t("ablauf.meta.aussage")]),
    ...(meta.type ? [] : [t("ablauf.meta.art")]),
    ...(meta.category.trim() ? [] : [t("ablauf.meta.kategorie")]),
    ...(meta.confidentiality ? [] : [t("ablauf.meta.stufe")]),
  ];

  const onEinreichen = async (): Promise<void> => {
    if (!ablauf || !entwurf) {
      return;
    }
    const fehlt = fehlendeFelder();
    if (fehlt.length > 0) {
      setMeldung({
        art: "fehler",
        text: t("ablauf.einreichenFehlt", { felder: fehlt.join(", ") }),
      });
      return;
    }
    setBeschaeftigt(true);
    setMeldung(null);
    try {
      const stand = (await speichern()) ?? entwurf;
      const schluessel = ablauf.quelle.schluessel;
      const ko = await endpoints.drafts.promote(stand.id, {
        ...(schluessel ? { operationId: einreichSchluessel(schluessel) } : {}),
        expectedUpdatedAt: stand.updatedAt,
      });
      setEingereicht(ko.id);
      setDirty(false);
    } catch (fehler) {
      if (fehler instanceof ApiError && fehler.code === "IDEMPOTENCY_PAYLOAD_MISMATCH") {
        setBereitsEingereicht(true);
      } else {
        setMeldung({
          art: "fehler",
          text: t("ablauf.einreichenFehler", { grund: grundAus(fehler, t("state.error")) }),
        });
      }
    } finally {
      setBeschaeftigt(false);
    }
  };

  // Die BEWUSSTE neue Fassung: dieselbe Revision wie im Wissensobjekt, mit Standvergleich.
  const onNeueFassung = async (): Promise<void> => {
    const id = koKennung(zielKo);
    if (!ablauf || !id) {
      return;
    }
    setBeschaeftigt(true);
    setMeldung(null);
    try {
      const vorher = await endpoints.ko.get(id);
      const neu = await endpoints.ko.act(id, {
        action: "revise",
        changes: { title: meta.title, statement: meta.statement, bodyHtml: rumpf(ablauf) },
        expectedVersion: vorher.version,
      });
      // Der Entwurf ist jetzt in der neuen Fassung aufgegangen; er wandert in den Papierkorb
      // (wiederherstellbar), statt als zweiter Stand daneben zu stehen.
      if (entwurf) {
        await endpoints.drafts.remove(entwurf.id).catch(() => undefined);
      }
      setDirty(false);
      setEingereicht(neu.id);
      setBereitsEingereicht(false);
      setMeldung({ art: "ok", text: t("ablauf.fassung.erfolg", { version: neu.version }) });
    } catch (fehler) {
      setMeldung({
        art: "fehler",
        text: t("ablauf.fassung.fehler", { grund: grundAus(fehler, t("state.error")) }),
      });
    } finally {
      setBeschaeftigt(false);
    }
  };

  const fehlerText = (f: AblaufFehler): string =>
    t(`ablauf.fehler.${f.code}`, {
      schritt: f.schritt,
      detail: f.detail ? ` (${f.detail})` : "",
    });

  const eingabeKlasse =
    "w-full rounded-btn border border-hairline bg-surface px-2.5 py-1.5 text-[13px] text-text";
  const knopfKlasse =
    "inline-flex items-center gap-1 rounded-btn border border-hairline px-2.5 py-1 text-[12.5px] font-semibold text-text hover:bg-hairline-soft disabled:opacity-50";

  return (
    <div data-testid="page-ablauf" className="mx-auto max-w-3xl space-y-4 pt-6">
      <header className="space-y-1">
        <h1 className="text-[20px] font-semibold text-ink">{t("ablauf.titel")}</h1>
        <p className="text-[13px] text-muted">{t("ablauf.einleitung")}</p>
        <p data-testid="ablauf-datenfluss" className="text-[12px] text-muted">
          {t("ablauf.datenfluss")}
        </p>
      </header>

      {laedt ? <p className="text-[12.5px] text-muted">{t("ablauf.laedt")}</p> : null}

      <label className="block text-[13px] font-semibold text-text">
        {ablauf ? t("ablauf.datei.neu") : t("ablauf.datei.waehlen")}
        <input
          data-testid="ablauf-datei"
          type="file"
          accept=".json,application/json"
          disabled={beschaeftigt}
          onChange={(e) => {
            void onDatei(e);
          }}
          className="mt-1 block text-[12.5px]"
        />
      </label>

      {importFehler ? (
        <div
          data-testid="ablauf-fehler"
          role="alert"
          className="rounded-card border border-trust-crit-fill/50 bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
        >
          <p className="font-semibold">{t("ablauf.fehler.titel")}</p>
          <p>{fehlerText(importFehler)}</p>
          {ablauf ? <p>{t("ablauf.fehler.bestandBleibt")}</p> : null}
        </div>
      ) : null}

      {meldung ? (
        <p
          data-testid="ablauf-meldung"
          role={meldung.art === "fehler" ? "alert" : "status"}
          className={
            meldung.art === "fehler"
              ? "text-[12.5px] text-trust-crit-text"
              : "text-[12.5px] text-trust-ok-text"
          }
        >
          {meldung.text}
        </p>
      ) : null}

      {ablauf ? (
        <>
          <section
            data-testid="ablauf-herkunft"
            className="rounded-card border border-dashed border-hairline bg-page px-3 py-2 text-[12.5px] text-muted"
          >
            {herkunftZeilen(ablauf).map((zeile) => (
              <p key={zeile}>{zeile}</p>
            ))}
            <p className="mt-1 italic">{t("ablauf.rumpf.hinweis")}</p>
          </section>

          <section className="grid gap-2 sm:grid-cols-2">
            <label className="text-[12.5px] font-semibold sm:col-span-2">
              {t("ablauf.meta.titel")}
              <input
                data-testid="ablauf-meta-titel"
                className={eingabeKlasse}
                value={meta.title}
                onChange={(e) => metaAendern({ title: e.target.value })}
              />
            </label>
            <label className="text-[12.5px] font-semibold sm:col-span-2">
              {t("ablauf.meta.aussage")}
              <textarea
                data-testid="ablauf-meta-aussage"
                className={eingabeKlasse}
                rows={2}
                value={meta.statement}
                onChange={(e) => metaAendern({ statement: e.target.value })}
              />
            </label>
            <label className="text-[12.5px] font-semibold">
              {t("ablauf.meta.art")}
              <select
                data-testid="ablauf-meta-art"
                className={eingabeKlasse}
                value={meta.type}
                onChange={(e) => metaAendern({ type: e.target.value as KnowledgeType | "" })}
              >
                <option value="">{t("ablauf.meta.waehlen")}</option>
                {KNOWLEDGE_TYPES.map((k) => (
                  <option key={k} value={k}>
                    {t(`ktype.${k}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12.5px] font-semibold">
              {t("ablauf.meta.kategorie")}
              <input
                data-testid="ablauf-meta-kategorie"
                className={eingabeKlasse}
                value={meta.category}
                onChange={(e) => metaAendern({ category: e.target.value })}
              />
            </label>
            <label className="text-[12.5px] font-semibold">
              {t("ablauf.meta.stufe")}
              <select
                data-testid="ablauf-meta-stufe"
                className={eingabeKlasse}
                value={meta.confidentiality}
                onChange={(e) =>
                  metaAendern({ confidentiality: e.target.value as Confidentiality | "" })
                }
              >
                <option value="">{t("ablauf.meta.waehlen")}</option>
                {CONFIDENTIALITY_LEVELS.map((c) => (
                  <option key={c} value={c}>
                    {t(`conf.level.${c}`)}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="flex flex-wrap items-end gap-2">
            <label className="text-[12.5px] font-semibold">
              {t("ablauf.schwaerzen.titel")}
              <input
                data-testid="ablauf-schwaerzen-feld"
                aria-label={t("ablauf.schwaerzen.feld")}
                className={eingabeKlasse}
                value={begriff}
                onChange={(e) => setBegriff(e.target.value)}
              />
            </label>
            <button
              type="button"
              data-testid="ablauf-schwaerzen-knopf"
              className={knopfKlasse}
              disabled={!begriff.trim()}
              onClick={textSchwaerzen}
            >
              {t("ablauf.schwaerzen.knopf")}
            </button>
          </section>

          <p className="text-[12px] text-muted">
            {t("ablauf.schritte.anzahl", { anzahl: ablauf.schritte.length })} ·{" "}
            {t("ablauf.bild.schwaerzenHilfe")}
          </p>

          <ol className="space-y-3">
            {ablauf.schritte.map((s, i) => {
              const nummer = i + 1;
              return (
                <li
                  key={s.id}
                  data-testid="ablauf-schritt"
                  data-schritt-id={s.id}
                  className="space-y-2 rounded-card border border-hairline bg-surface p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-[13.5px] font-semibold text-ink">
                      {t("ablauf.schritt.titel", { nummer })}
                    </h2>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        data-testid="ablauf-hoch"
                        className={knopfKlasse}
                        disabled={i === 0}
                        onClick={() => aendern(schrittVerschieben(ablauf, s.id, -1))}
                      >
                        {t("ablauf.schritt.hoch")}
                      </button>
                      <button
                        type="button"
                        data-testid="ablauf-runter"
                        className={knopfKlasse}
                        disabled={i === ablauf.schritte.length - 1}
                        onClick={() => aendern(schrittVerschieben(ablauf, s.id, 1))}
                      >
                        {t("ablauf.schritt.runter")}
                      </button>
                      <button
                        type="button"
                        data-testid="ablauf-entfernen"
                        className={knopfKlasse}
                        disabled={ablauf.schritte.length === 1}
                        onClick={() => aendern(schrittEntfernen(ablauf, s.id))}
                      >
                        {t("ablauf.schritt.entfernen")}
                      </button>
                    </div>
                  </div>
                  <textarea
                    data-testid="ablauf-schritt-text"
                    aria-label={t("ablauf.schritt.textLabel", { nummer })}
                    className={eingabeKlasse}
                    rows={2}
                    value={s.text}
                    onChange={(e) => aendern(schrittTextAendern(ablauf, s.id, e.target.value))}
                  />
                  {s.bild ? (
                    <BildSchwaerzer
                      src={s.bild}
                      alt={t("ablauf.bild.alt", { nummer })}
                      knopf={t("ablauf.bild.schwaerzen")}
                      onSchwaerzen={(bereich) => {
                        void bildSchwaerzen(s.id, s.bild as string, bereich);
                      }}
                    />
                  ) : (
                    <p className="text-[12px] text-muted">{t("ablauf.schritt.ohneBild")}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-[12px]">
                    <label className="font-semibold">
                      {t("ablauf.bild.setzen")}
                      <input
                        data-testid="ablauf-bild-datei"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="ml-1"
                        onChange={(e) => {
                          const datei = e.target.files?.[0];
                          e.target.value = "";
                          void bildSetzen(s.id, datei);
                        }}
                      />
                    </label>
                    {s.bild ? (
                      <button
                        type="button"
                        data-testid="ablauf-bild-entfernen"
                        className={knopfKlasse}
                        onClick={() => aendern(schrittBildSetzen(ablauf, s.id, undefined))}
                      >
                        {t("ablauf.bild.entfernen")}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>

          <section className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="ablauf-speichern"
              className={knopfKlasse}
              disabled={beschaeftigt || !entwurf}
              onClick={() => {
                void onSpeichern();
              }}
            >
              {t("ablauf.speichern")}
            </button>
            <button
              type="button"
              data-testid="ablauf-einreichen"
              className={knopfKlasse}
              disabled={beschaeftigt || !entwurf || eingereicht !== null}
              onClick={() => {
                void onEinreichen();
              }}
            >
              {t("ablauf.einreichen")}
            </button>
            {dirty ? (
              <span data-testid="ablauf-ungespeichert" className="text-[12px] text-muted">
                {t("ablauf.ungespeichert")}
              </span>
            ) : null}
          </section>

          {eingereicht ? (
            <output data-testid="ablauf-eingereicht" className="block text-[12.5px]">
              {t("ablauf.eingereicht")}{" "}
              <Link to={`/wissen/${eingereicht}`} className="font-semibold underline">
                {t("ablauf.zumObjekt")}
              </Link>
            </output>
          ) : null}

          {bereitsEingereicht ? (
            <section
              data-testid="ablauf-bereits"
              className="space-y-2 rounded-card border border-hairline bg-page p-3 text-[12.5px]"
            >
              <p>{t("ablauf.bereitsEingereicht")}</p>
              <p className="font-semibold">{t("ablauf.fassung.titel")}</p>
              <input
                data-testid="ablauf-fassung-feld"
                aria-label={t("ablauf.fassung.feld")}
                className={eingabeKlasse}
                value={zielKo}
                onChange={(e) => setZielKo(e.target.value)}
              />
              <button
                type="button"
                data-testid="ablauf-fassung-knopf"
                className={knopfKlasse}
                disabled={beschaeftigt || !koKennung(zielKo)}
                onClick={() => {
                  void onNeueFassung();
                }}
              >
                {t("ablauf.fassung.knopf")}
              </button>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// BILD MIT SCHWÄRZRAHMEN — Rahmen ziehen, dann „Bereich schwärzen". Die Pixel ändert erst
// `schwaerzeBild`; der Rahmen hier ist nur die Auswahl, kein Ergebnis.
// ------------------------------------------------------------------------------------------------
function BildSchwaerzer({
  src,
  alt,
  knopf,
  onSchwaerzen,
}: {
  src: string;
  alt: string;
  knopf: string;
  onSchwaerzen: (bereich: Rechteck) => void;
}): JSX.Element {
  const bildRef = useRef<HTMLImageElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [auswahl, setAuswahl] = useState<Rechteck | null>(null);

  const punkt = (e: ReactPointerEvent<HTMLDivElement>): { x: number; y: number } => {
    const box = bildRef.current?.getBoundingClientRect();
    return box ? { x: e.clientX - box.left, y: e.clientY - box.top } : { x: 0, y: 0 };
  };

  const anwenden = (): void => {
    const img = bildRef.current;
    if (!img || !auswahl || img.clientWidth === 0 || img.clientHeight === 0) {
      return;
    }
    const fx = img.naturalWidth / img.clientWidth;
    const fy = img.naturalHeight / img.clientHeight;
    onSchwaerzen({
      x: auswahl.x * fx,
      y: auswahl.y * fy,
      breite: auswahl.breite * fx,
      hoehe: auswahl.hoehe * fy,
    });
    setAuswahl(null);
  };

  return (
    <div className="space-y-1">
      <div
        data-testid="ablauf-bild-flaeche"
        className="relative inline-block max-w-full cursor-crosshair touch-none select-none"
        onPointerDown={(e) => {
          start.current = punkt(e);
          setAuswahl({ ...start.current, breite: 0, hoehe: 0 });
        }}
        onPointerMove={(e) => {
          if (!start.current) {
            return;
          }
          const p = punkt(e);
          setAuswahl({
            x: Math.min(start.current.x, p.x),
            y: Math.min(start.current.y, p.y),
            breite: Math.abs(p.x - start.current.x),
            hoehe: Math.abs(p.y - start.current.y),
          });
        }}
        onPointerUp={() => {
          start.current = null;
        }}
      >
        <img
          ref={bildRef}
          data-testid="ablauf-bild"
          src={src}
          alt={alt}
          draggable={false}
          className="block max-h-[360px] max-w-full rounded border border-hairline"
        />
        {auswahl && auswahl.breite > 0 && auswahl.hoehe > 0 ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute border-2 border-dashed border-trust-crit-fill bg-black/30"
            style={{
              left: auswahl.x,
              top: auswahl.y,
              width: auswahl.breite,
              height: auswahl.hoehe,
            }}
          />
        ) : null}
      </div>
      <button
        type="button"
        data-testid="ablauf-bild-schwaerzen"
        className="inline-flex items-center gap-1 rounded-btn border border-hairline px-2.5 py-1 text-[12.5px] font-semibold text-text hover:bg-hairline-soft disabled:opacity-50"
        disabled={!auswahl || auswahl.breite < 2 || auswahl.hoehe < 2}
        onClick={anwenden}
      >
        {knopf}
      </button>
    </div>
  );
}
