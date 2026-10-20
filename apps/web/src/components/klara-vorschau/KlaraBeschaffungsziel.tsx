import { useState } from "react";
import { useTranslation } from "react-i18next";
import { fehlendeBeschaffungsangaben } from "../../lib/klaraBeschaffungsauftrag";
import {
  type AuftragsUmgebung,
  type Ausfuehrung,
  ergaenzeBeschaffung,
  korrigiereBeschaffung,
  offeneSchritte,
  waehleBeschaffungsquelle,
} from "./auftrag";

/** Kleine Rückfrage im bestehenden Auftrag; bekannte Angaben werden nicht noch einmal abgefragt. */
export function KlaraBeschaffungsziel({
  a,
  umgebung,
}: { a: Ausfuehrung; umgebung: () => AuftragsUmgebung }): JSX.Element | null {
  const { t } = useTranslation();
  const b = a.auftrag?.beschaffung ?? a.beschaffung;
  const [werte, setWerte] = useState({
    produkt: b?.produkt ?? "",
    bedarf: b?.bedarf ?? "",
    menge: b?.menge ?? "",
    termin: b?.termin ?? "",
  });
  const [aendern, setAendern] = useState(false);
  const [speichert, setSpeichert] = useState(false);
  if (!b) return null;
  const fehlt = fehlendeBeschaffungsangaben(b);
  const frage = !a.auftrag && a.phase === "rueckfrage" && fehlt.length > 0;
  const korrigierbar = Boolean(a.auftrag?.unterbrochenAm && !a.abbruch && offeneSchritte(a).length);
  return (
    <section data-testid="klara-bes-ziel" className="mt-1.5 space-y-1 text-[11.5px] text-text">
      <p className="font-semibold">{t("klaraauftrag.bes.umfang")}</p>
      <p data-testid="klara-bes-bekannt">
        {[b.produkt, b.bedarf, b.menge, b.termin].filter(Boolean).join(" · ")}
      </p>
      <p className="text-muted">{t("klaraauftrag.bes.aussenwirkung")}</p>
      {b.empfaengerVorschlaege.length ? (
        <p>{t("klaraauftrag.bes.empfaenger", { namen: b.empfaengerVorschlaege.join(", ") })}</p>
      ) : null}
      <details>
        <summary className="cursor-pointer text-muted">{t("klaraauftrag.bes.offen")}</summary>
        <ul className="list-disc pl-4">
          {["fachlich", "lieferanten", "versand", "vergleich"].map((k) => (
            <li key={k}>{t(`klaraauftrag.bes.rest.${k}`)}</li>
          ))}
        </ul>
        {b.quellen.map((q) => (
          <p key={q.id}>
            <a
              className="text-brand-text hover:underline"
              href={`/wissen/${encodeURIComponent(q.id)}`}
            >
              {t("klaraauftrag.bes.quelle", { fassung: q.fassung, status: q.status })}
            </a>
          </p>
        ))}
      </details>
      {a.beschaffungsKandidaten?.map((q, i) => (
        <button
          type="button"
          key={q.id}
          className="mr-1 rounded-btn border border-hairline px-2 py-1"
          onClick={() => waehleBeschaffungsquelle(a.lokalId, i, umgebung())}
        >
          {q.titel}
        </button>
      ))}
      {korrigierbar && !aendern ? (
        <button
          type="button"
          data-testid="klara-bes-korrigieren"
          className="rounded-btn border border-hairline px-2 py-1"
          onClick={() => {
            setWerte({ produkt: b.produkt, bedarf: b.bedarf, menge: b.menge, termin: b.termin });
            setAendern(true);
          }}
        >
          {t("klaraauftrag.bes.korrigieren")}
        </button>
      ) : null}
      {frage || (aendern && korrigierbar) ? (
        <form
          data-testid="klara-bes-rueckfrage"
          className="space-y-1 rounded-btn border border-hairline px-2 py-1.5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (speichert) return;
            setSpeichert(true);
            try {
              if (frage) ergaenzeBeschaffung(a.lokalId, werte, umgebung());
              else {
                await korrigiereBeschaffung(a.lokalId, werte.menge, werte.termin, umgebung());
                setAendern(false);
              }
            } finally {
              setSpeichert(false);
            }
          }}
        >
          <p>{t(frage ? "klaraauftrag.bes.frage" : "klaraauftrag.bes.korrekturHinweis")}</p>
          {(frage ? fehlt : (["menge", "termin"] as const)).map((k) => (
            <label key={k} className="block">
              {t(`klaraauftrag.bes.${k}`)}
              <input
                required
                data-testid={`klara-bes-${k}`}
                type={k === "termin" ? "date" : "text"}
                maxLength={200}
                value={werte[k]}
                onChange={(e) => setWerte((w) => ({ ...w, [k]: e.target.value }))}
                className="block w-full rounded-btn border border-hairline bg-surface px-2 py-1"
              />
            </label>
          ))}
          <button
            type="submit"
            data-testid="klara-bes-uebernehmen"
            disabled={speichert}
            className="rounded-btn border border-ai px-2 py-1"
          >
            {t(frage ? "klaraauftrag.bes.vorbereiten" : "klaraauftrag.bes.speichern")}
          </button>
        </form>
      ) : null}
    </section>
  );
}
