import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { klaraAufgabeApi } from "../../api/klaraAufgabe";
import { klaraNotizApi } from "../../api/klaraNotiz";
import type { FolienDatenLage } from "../../api/praesentationDaten";
import {
  type NachbereitungsEintrag,
  type VortragsAufgabe,
  type VortragsAuftrag,
  type VortragsErgebnis,
  type VortragsNotiz,
  praesentationVortrag,
} from "../../api/praesentationVortrag";

// Eingaben bleiben beim Zuklappen erhalten. Kein lokaler Quellcache, keine zweite Notizablage.
// Nur ausdrücklich bestätigte, selbst bereitgestellte Nachbereitung gelangt als eigene Notiz
// und daraus als persönliche Aufgabe in die bestehenden Dienste. Quellenwerte werden nicht kopiert.
export function VortragVorbereitung({
  lage,
  oeffne,
}: {
  lage: FolienDatenLage;
  oeffne: (id: string, ausloeser?: HTMLButtonElement) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const id = useId();
  const [basis, setBasis] = useState(lage.dateiFassung);
  const [ziel, setZiel] = useState(720);
  const [notizen, setNotizen] = useState<VortragsNotiz[]>([]);
  const [folieId, setFolieId] = useState(lage.folien[0]?.sldId ?? "");
  const [frage, setFrage] = useState("");
  const [auswahl, setAuswahl] = useState("");
  const [probeText, setProbeText] = useState("");
  const [nachText, setNachText] = useState("");
  const [nachQuelle, setNachQuelle] = useState("");
  const [nachArt, setNachArt] = useState<NachbereitungsEintrag["art"]>("rueckfrage");
  const [nachbereitung, setNachbereitung] = useState<NachbereitungsEintrag[]>([]);
  const [ergebnis, setErgebnis] = useState<VortragsErgebnis | null>(null);
  const [belegPort, setBelegPort] = useState<{
    basis: string;
    belege: VortragsErgebnis["belegfolien"];
  } | null>(null);
  const [fehler, setFehler] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [gespeichert, setGespeichert] = useState<Record<string, string>>({});
  // Stabile Vorgänge pro expliziter Übernahme: auch Antwortverlust erzeugt keine zweite Notiz/Aufgabe.
  const vorgaenge = useRef(new Map<string, { notiz: string; aufgabe: string }>());
  const epoche = useRef(0);
  const edit = () => {
    epoche.current++;
    setErgebnis(null);
    setFehler("");
  };
  const folie = lage.folien.find((f) => f.sldId === folieId);
  const notiz = notizen.find((n) => n.sldId === folieId);
  const aktuelleBindung = (d: FolienDatenLage["datenpunkte"][number], sldId: string) =>
    d.bindungen.some(
      (b) =>
        b.koId === lage.koId &&
        b.anhangId === lage.anhangId &&
        b.sldId === sldId &&
        (b.lage === "aktuell" || b.lage === "bestaetigt_in_neuer_fassung"),
    );
  const belegBindung = (d: FolienDatenLage["datenpunkte"][number], sldId: string) =>
    belegPort?.basis === lage.dateiFassung &&
    belegPort.belege.some(
      (b) => b.aussage.id === d.id && b.aussage.fassung === d.fassung && b.sldIds.includes(sldId),
    );
  const punkte = lage.datenpunkte.filter(
    (d) => aktuelleBindung(d, folieId) || belegBindung(d, folieId),
  );
  const punkt = punkte.find((d) => d.id === auswahl);
  const veraltet =
    basis !== lage.dateiFassung ||
    notizen.some(
      (n) =>
        !lage.folien.some((f) => f.sldId === n.sldId) ||
        n.aussagen.some(
          (b) =>
            !lage.datenpunkte.some(
              (d) =>
                d.id === b.id &&
                d.fassung === b.fassung &&
                (aktuelleBindung(d, n.sldId) || belegBindung(d, n.sldId)),
            ),
        ),
    ) ||
    nachbereitung.some(
      (n) =>
        !lage.datenpunkte.some(
          (d) =>
            d.id === n.aussage.id &&
            d.fassung === n.aussage.fassung &&
            (aktuelleBindung(d, n.sldId) || belegBindung(d, n.sldId)),
        ),
    );
  function aendereNotiz(patch: Partial<VortragsNotiz>) {
    edit();
    setNotizen((liste) => {
      const alt = liste.find((n) => n.sldId === folieId) ?? {
        sldId: folieId,
        text: "",
        uebergang: "",
        sekunden: 0,
        aussagen: [],
        detailSldIds: [],
      };
      return liste.some((n) => n.sldId === folieId)
        ? liste.map((n) => (n.sldId === folieId ? { ...n, ...patch } : n))
        : [...liste, { ...alt, ...patch }];
    });
  }
  const auftrag = (modus: VortragsAuftrag["modus"]): VortragsAuftrag => ({
    basis,
    modus,
    zielSekunden: ziel,
    notizen,
    nachbereitung,
    ...(modus === "probe"
      ? { probe: { ausdruecklichGestartet: true, sldId: folieId, text: probeText } }
      : {}),
    ...(modus === "frage"
      ? {
          frage: {
            text: frage,
            sldId: folieId,
            ...(punkt ? { aussage: { id: punkt.id, fassung: punkt.fassung } } : {}),
          },
        }
      : {}),
  });
  async function auswerten(modus: VortragsAuftrag["modus"]) {
    const e = ++epoche.current;
    setLaeuft(true);
    setFehler("");
    setErgebnis(null);
    try {
      const r = await praesentationVortrag.auswerten(lage.koId, lage.anhangId, auftrag(modus));
      if (e === epoche.current) {
        setErgebnis(r);
        setBelegPort({ basis: r.basis, belege: r.belegfolien });
      }
    } catch (f) {
      if (e === epoche.current)
        setFehler(f instanceof Error ? f.message : "Vortrag konnte nicht geprüft werden.");
    } finally {
      setLaeuft(false);
    }
  }
  async function speichern(a: VortragsAufgabe) {
    if (a.herkunft.art !== "nachbereitung" || !a.aussage) return;
    setLaeuft(true);
    setFehler("");
    try {
      // Vor dem Speichern Quelle und Datenfassung frisch prüfen; keine Quell-/Prüfkopie speichern.
      const frisch = await praesentationVortrag.auswerten(
        lage.koId,
        lage.anhangId,
        auftrag("nachbereitung"),
      );
      if (
        !frisch.aufgaben.some(
          (x) =>
            x.schluessel === a.schluessel &&
            x.arbeit === a.arbeit &&
            x.herkunft.quelle === a.herkunft.quelle,
        )
      )
        throw new Error("Zuordnung erneut prüfen.");
      const schluessel = JSON.stringify([basis, a.sldId, a.aussage, a.herkunft]);
      let v = vorgaenge.current.get(schluessel);
      if (!v) {
        v = { notiz: crypto.randomUUID(), aufgabe: crypto.randomUUID() };
        vorgaenge.current.set(schluessel, v);
      }
      const { notiz: n } = await klaraNotizApi.lege(v.notiz, {
        weg: "geschrieben",
        art: "arbeitszettel",
        titel: a.titel,
        inhalt: `${a.herkunft.text}\n\nBereitgestellt: ${a.herkunft.quelle}\nBezug: Anhang ${lage.anhangId}; Dateifassung ${basis}; Folie ${a.sldId}; Aussage ${a.aussage.id}, Fassung ${a.aussage.fassung}.`,
        objektbezug: {
          pfad: `/wissen/${encodeURIComponent(lage.koId)}`,
          seitenName: "PowerPoint-Vortrag",
          objekt: "Bereitgestellte Nachbereitung",
          koId: lage.koId,
          fassung: lage.artikelFassung,
          bezug: "seite",
        },
      });
      const { aufgabe: gespeichert } = await klaraAufgabeApi.lege(v.aufgabe, {
        weg: "notiz",
        quelle: { notizId: n.id },
      });
      setGespeichert((alt) => ({ ...alt, [schluessel]: gespeichert.id }));
    } catch (f) {
      setFehler(
        f instanceof Error ? f.message : "Persönliche Aufgabe konnte nicht gespeichert werden.",
      );
    } finally {
      setLaeuft(false);
    }
  }
  const aufgabenKey = (a: VortragsAufgabe) =>
    JSON.stringify([basis, a.sldId, a.aussage, a.herkunft]);
  const feld = "w-full rounded-btn border border-hairline bg-surface px-2 py-1 text-text";
  const knopf = "rounded-btn border border-hairline px-2 py-1 disabled:opacity-50";
  return (
    <details data-vortrag="" className="my-2 border-y border-hairline py-2">
      <summary className="cursor-pointer font-semibold"> {t("vortrag.text0")} </summary>
      <fieldset disabled={laeuft} className="mt-2 min-w-0 space-y-3 text-[12.5px]">
        <p>
          {lage.anhangName} {t("vortrag.text1")}{" "}
        </p>
        <label className="block">
          {" "}
          {t("vortrag.text2")}{" "}
          <input
            type="number"
            min={0}
            max={28800}
            value={ziel}
            onChange={(e) => {
              edit();
              setZiel(Number(e.target.value));
            }}
            className={feld}
          />
        </label>
        <label className="block">
          {" "}
          {t("vortrag.text3")}{" "}
          <select
            value={folieId}
            onChange={(e) => {
              edit();
              setFolieId(e.target.value);
              setAuswahl("");
            }}
            className={feld}
          >
            {lage.folien.map((f) => (
              <option key={f.sldId} value={f.sldId}>
                {f.position}. {f.titel}
                {f.ausgeblendet ? t("vortrag.text4") : ""}
              </option>
            ))}
          </select>
        </label>
        {folie ? (
          <fieldset className="space-y-2">
            <legend className="font-semibold">{folie.titel}</legend>
            <label className="block">
              {" "}
              {t("vortrag.text6")}{" "}
              <textarea
                maxLength={6000}
                value={notiz?.text ?? ""}
                onChange={(e) => aendereNotiz({ text: e.target.value })}
                className={feld}
              />
            </label>
            <label className="block">
              {" "}
              {t("vortrag.text7")}{" "}
              <input
                maxLength={2000}
                value={notiz?.uebergang ?? ""}
                onChange={(e) => aendereNotiz({ uebergang: e.target.value })}
                className={feld}
              />
            </label>
            <label className="block">
              {" "}
              {t("vortrag.text8")}{" "}
              <input
                type="number"
                min={0}
                max={28800}
                value={notiz?.sekunden ?? 0}
                onChange={(e) => aendereNotiz({ sekunden: Number(e.target.value) })}
                className={feld}
              />
            </label>
            <fieldset>
              <legend> {t("vortrag.text9")} </legend>
              {punkte.map((d) => (
                <label key={d.id} className="block">
                  <input
                    type="checkbox"
                    checked={notiz?.aussagen.some((b) => b.id === d.id) ?? false}
                    onChange={(e) =>
                      aendereNotiz({
                        aussagen: e.target.checked
                          ? [...(notiz?.aussagen ?? []), { id: d.id, fassung: d.fassung }]
                          : (notiz?.aussagen ?? []).filter((b) => b.id !== d.id),
                        detailSldIds: [],
                      })
                    }
                  />{" "}
                  {d.wert} {t("vortrag.text10")} {d.fassung}
                </label>
              ))}
              {!punkte.length ? <p> {t("vortrag.text11")} </p> : null}
            </fieldset>
            <fieldset>
              <legend> {t("vortrag.text12")} </legend>
              {lage.folien
                .filter(
                  (f) =>
                    f.sldId !== folieId &&
                    punkte.some(
                      (d) =>
                        notiz?.aussagen.some((b) => b.id === d.id) &&
                        (aktuelleBindung(d, f.sldId) || belegBindung(d, f.sldId)),
                    ),
                )
                .map((f) => (
                  <label key={f.sldId} className="block">
                    <input
                      type="checkbox"
                      checked={notiz?.detailSldIds.includes(f.sldId) ?? false}
                      onChange={(e) =>
                        aendereNotiz({
                          detailSldIds: e.target.checked
                            ? [...(notiz?.detailSldIds ?? []), f.sldId]
                            : (notiz?.detailSldIds ?? []).filter((s) => s !== f.sldId),
                        })
                      }
                    />{" "}
                    {f.position}. {f.titel}
                  </label>
                ))}
            </fieldset>
          </fieldset>
        ) : null}
        {notizen
          .filter((n) => !lage.folien.some((f) => f.sldId === n.sldId))
          .map((n) => (
            <div key={n.sldId}>
              <p>
                {" "}
                {t("vortrag.text13")} {n.text} {t("vortrag.text14")} {n.uebergang}
              </p>
              <button
                type="button"
                className={knopf}
                disabled={notizen.some((x) => x.sldId === folieId)}
                onClick={() => {
                  edit();
                  setNotizen((alt) =>
                    alt.map((x) =>
                      x.sldId === n.sldId
                        ? { ...x, sldId: folieId, aussagen: [], detailSldIds: [] }
                        : x,
                    ),
                  );
                }}
              >
                {" "}
                {t("vortrag.text15")}{" "}
              </button>
              <button
                type="button"
                className={knopf}
                onClick={() => {
                  edit();
                  setNotizen((alt) => alt.filter((x) => x.sldId !== n.sldId));
                }}
              >
                {" "}
                {t("vortrag.text16")}{" "}
              </button>
            </div>
          ))}
        {veraltet ? <p role="alert"> {t("vortrag.text17")} </p> : null}
        {veraltet ? (
          <button
            type="button"
            className={knopf}
            onClick={() => {
              edit();
              setBasis(lage.dateiFassung);
              setNotizen((alt) => alt.map((n) => ({ ...n, aussagen: [], detailSldIds: [] })));
              // Bereitgestellte Nachbereitung bleibt erhalten; jede veraltete Aussage muss neu zugeordnet werden.
            }}
          >
            {" "}
            {t("vortrag.text18")}{" "}
          </button>
        ) : null}
        <button
          type="button"
          className={knopf}
          disabled={laeuft || veraltet}
          onClick={() => void auswerten("vorbereiten")}
        >
          {" "}
          {t("vortrag.text19")}{" "}
        </button>
        <fieldset className="space-y-2">
          <legend className="font-semibold"> {t("vortrag.text20")} </legend>
          <label className="block" htmlFor={`${id}-probe`}>
            {" "}
            {t("vortrag.text21")}{" "}
          </label>
          <textarea
            id={`${id}-probe`}
            maxLength={60000}
            value={probeText}
            onChange={(e) => {
              edit();
              setProbeText(e.target.value);
            }}
            className={feld}
          />
          <button
            type="button"
            className={knopf}
            disabled={laeuft || veraltet || !probeText.trim()}
            onClick={() => void auswerten("probe")}
          >
            {" "}
            {t("vortrag.text22")}{" "}
          </button>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="font-semibold"> {t("vortrag.text23")} </legend>
          <label className="block">
            {" "}
            {t("vortrag.text24")}{" "}
            <select
              value={auswahl}
              onChange={(e) => {
                edit();
                setAuswahl(e.target.value);
              }}
              className={feld}
            >
              <option value=""> {t("vortrag.text25")} </option>
              {punkte.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.wert} {t("vortrag.text10")} {d.fassung}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            {" "}
            {t("vortrag.text27")}{" "}
            <input
              maxLength={2000}
              value={frage}
              onChange={(e) => {
                edit();
                setFrage(e.target.value);
              }}
              className={feld}
            />
          </label>
          <button
            type="button"
            className={knopf}
            disabled={laeuft || veraltet || !frage.trim()}
            onClick={() => void auswerten("frage")}
          >
            {" "}
            {t("vortrag.text28")}{" "}
          </button>
          <label className="block">
            {" "}
            {t("vortrag.text29")}{" "}
            <textarea
              maxLength={6000}
              value={nachText}
              onChange={(e) => {
                edit();
                setNachText(e.target.value);
              }}
              className={feld}
            />
          </label>
          <label className="block">
            {" "}
            {t("vortrag.text30")}{" "}
            <input
              maxLength={1000}
              value={nachQuelle}
              onChange={(e) => {
                edit();
                setNachQuelle(e.target.value);
              }}
              className={feld}
            />
          </label>
          <label className="block">
            {" "}
            {t("vortrag.text31")}{" "}
            <select
              value={nachArt}
              onChange={(e) => {
                edit();
                setNachArt(e.target.value as NachbereitungsEintrag["art"]);
              }}
              className={feld}
            >
              <option value="rueckfrage"> {t("vortrag.text32")} </option>
              <option value="erklaerung"> {t("vortrag.text33")} </option>
              <option value="zusage"> {t("vortrag.text34")} </option>
              <option value="korrektur"> {t("vortrag.text35")} </option>
            </select>
          </label>
          <button
            type="button"
            className={knopf}
            disabled={laeuft || veraltet || !punkt || !nachText.trim() || !nachQuelle.trim()}
            onClick={() => {
              if (!punkt) return;
              edit();
              setNachbereitung((alt) => [
                ...alt,
                {
                  sldId: folieId,
                  aussage: { id: punkt.id, fassung: punkt.fassung },
                  art: nachArt,
                  text: nachText,
                  quelle: nachQuelle,
                },
              ]);
              setNachText("");
            }}
          >
            {" "}
            {t("vortrag.text36")}{" "}
          </button>
          {nachbereitung.map((n, index) => (
            <p key={`${n.sldId}-${index}`}>
              {n.text} · {n.quelle}{" "}
              <label>
                {" "}
                {t("vortrag.text37")}{" "}
                <select
                  className={feld}
                  value={
                    lage.datenpunkte.some(
                      (d) =>
                        d.id === n.aussage.id &&
                        d.fassung === n.aussage.fassung &&
                        (aktuelleBindung(d, n.sldId) || belegBindung(d, n.sldId)),
                    )
                      ? n.aussage.id
                      : ""
                  }
                  onChange={(e) => {
                    const d = lage.datenpunkte.find((d) => d.id === e.target.value);
                    if (d) {
                      edit();
                      setNachbereitung((alt) =>
                        alt.map((eintrag, i) =>
                          i === index
                            ? {
                                ...eintrag,
                                sldId: folieId,
                                aussage: { id: d.id, fassung: d.fassung },
                              }
                            : eintrag,
                        ),
                      );
                    }
                  }}
                >
                  <option value=""> {t("vortrag.text39")} </option>
                  {punkte.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.wert} {t("vortrag.text10")} {d.fassung}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={knopf}
                onClick={() => {
                  edit();
                  setNachbereitung((alt) => alt.filter((_, i) => i !== index));
                }}
              >
                {" "}
                {t("vortrag.text41")}{" "}
              </button>
            </p>
          ))}
          <button
            type="button"
            className={knopf}
            disabled={laeuft || veraltet || !nachbereitung.length}
            onClick={() => void auswerten("nachbereitung")}
          >
            {" "}
            {t("vortrag.text42")}{" "}
          </button>
        </fieldset>
        <div aria-live="polite">
          {laeuft ? <p> {t("vortrag.text43")} </p> : null}
          {fehler ? <p role="alert">{fehler}</p> : null}
        </div>
        {ergebnis && !veraltet ? (
          <section aria-label={t("vortrag.text44")} className="space-y-2">
            {ergebnis.sprechhilfen
              .filter((n) => n.sldId === folieId)
              .map((n) => (
                <div key={n.sldId}>
                  <p>
                    {t("vortrag.sprechhilfe")}: {n.text}
                  </p>
                  <p>
                    {n.uebergang} · {t("vortrag.sprechzeit", { sekunden: n.sekunden })}
                  </p>
                  <button
                    type="button"
                    className={knopf}
                    disabled={!!notiz?.text || !!notiz?.uebergang}
                    onClick={() => {
                      edit();
                      setNotizen((alt) => [...alt.filter((x) => x.sldId !== folieId), n]);
                    }}
                  >
                    {t("vortrag.sprechhilfeNutzen")}
                  </button>
                </div>
              ))}
            <p>
              {" "}
              {t("vortrag.text45")} {ergebnis.zeit.geplant} {t("vortrag.text46")}{" "}
              {ergebnis.zeit.ziel} {t("vortrag.text47")} {ergebnis.zeit.abweichung} s
            </p>
            {ergebnis.probe ? (
              <p>
                {ergebnis.probe.woerter} {t("vortrag.text49")}{" "}
                {ergebnis.probe.schaetzungSekunden.von}–{ergebnis.probe.schaetzungSekunden.bis} s ·{" "}
                {ergebnis.probe.langeSaetze} {t("vortrag.text51")} {ergebnis.probe.grundlage}
              </p>
            ) : null}
            {ergebnis.antwort ? (
              <div>
                <p>{ergebnis.antwort.grund}</p>
                {ergebnis.antwort.kandidaten.map((b) => (
                  <button
                    type="button"
                    key={b.id}
                    className={knopf}
                    data-datenpunkt={b.id}
                    onClick={(e) => oeffne(b.id, e.currentTarget)}
                  >
                    {" "}
                    {t("vortrag.text52")} {lage.datenpunkte.find((d) => d.id === b.id)?.wert}
                  </button>
                ))}
                {ergebnis.antwort.sldIds.map((s) => (
                  <p key={s}>
                    {" "}
                    {t("vortrag.text53")} {lage.folien.find((f) => f.sldId === s)?.titel}
                  </p>
                ))}
              </div>
            ) : null}
            <details>
              <summary> {t("vortrag.text54")} </summary>
              {ergebnis.leitfragen.map((f) => (
                <p key={`${f.sldId}-${f.aussage.id}`}>
                  {f.text}{" "}
                  <button
                    type="button"
                    className={knopf}
                    data-datenpunkt={f.aussage.id}
                    onClick={(e) => oeffne(f.aussage.id, e.currentTarget)}
                  >
                    {" "}
                    {t("vortrag.text55")}{" "}
                  </button>
                </p>
              ))}
            </details>
            <ul className="space-y-2">
              {ergebnis.aufgaben.map((a) => (
                <li key={a.schluessel}>
                  <strong>{a.titel}</strong>: {a.arbeit}
                  <p>
                    {" "}
                    {t("vortrag.text3")} {lage.folien.find((f) => f.sldId === a.sldId)?.position} ·{" "}
                    {a.herkunft.quelle}
                  </p>
                  {a.aussage ? (
                    <button
                      type="button"
                      className={knopf}
                      data-datenpunkt={a.aussage.id}
                      onClick={(e) => oeffne(a.aussage?.id ?? "", e.currentTarget)}
                    >
                      {" "}
                      {t("vortrag.text57")}{" "}
                    </button>
                  ) : null}
                  {a.herkunft.art === "nachbereitung" ? (
                    <button
                      type="button"
                      className={knopf}
                      disabled={laeuft || !!gespeichert[aufgabenKey(a)]}
                      onClick={() => void speichern(a)}
                    >
                      {gespeichert[aufgabenKey(a)] ? t("vortrag.text58") : t("vortrag.text59")}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </fieldset>
    </details>
  );
}
