// Die Spacezeile eines Artikels (produkt:20261007:spaces): führender Space, Spacezuständigkeit und
// — getrennt davon — Artikelverantwortung. Dazu der Spacewechsel mit Rechtevorschau: erst zeigt
// der Server, wer Zugang verliert oder gewinnt und was unverändert bleibt; übernommen wird nur mit
// genau dieser Vorschau als Grundlage (`spaces-routes.ts`, VORSCHAU_VERALTET).
//
// Ist der Artikel für dieses Konto nicht sichtbar, antwortet der Server 404 — dann zeichnet diese
// Zeile nichts (die Fläche darunter meldet den fehlenden Artikel selbst).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import {
  type ArtikelKontext,
  type Rechtevorschau,
  spaceFehlerSchluessel,
  spacesApi,
} from "../api/spaces";
import { Button, Card, SectionLabel } from "./ui";

const OHNE = "__ohne__";

function Namen({ liste }: { liste: { id: string; name: string }[] }): JSX.Element {
  const { t } = useTranslation();
  return (
    <>{liste.length > 0 ? liste.map((p) => p.name).join(", ") : t("spaces.vorschau.niemand")}</>
  );
}

function Vorschau({ v }: { v: Rechtevorschau }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div data-testid="space-vorschau" className="space-y-1 rounded-btn border border-hairline p-3">
      <SectionLabel>{t("spaces.vorschau.titel")}</SectionLabel>
      <p className="text-[12.5px] text-text">
        {t("spaces.vorschau.von", {
          quelle: v.quelle?.name ?? t("spaces.artikel.ohneSpace"),
          ziel: v.ziel?.name ?? t("spaces.artikel.ohneSpace"),
        })}
      </p>
      <p data-testid="space-vorschau-verlieren" className="text-[12.5px] text-trust-crit-text">
        {t("spaces.vorschau.verlieren", { anzahl: v.verlieren.length })}:{" "}
        <Namen liste={v.verlieren} />
      </p>
      <p data-testid="space-vorschau-erhalten" className="text-[12.5px] text-text">
        {t("spaces.vorschau.erhalten", { anzahl: v.erhalten.length })}: <Namen liste={v.erhalten} />
      </p>
      <p className="text-[12px] text-muted-2">
        {t("spaces.vorschau.unveraendert", { anzahl: v.unveraendertMitZugang })}
      </p>
      {v.autorBehaeltZugang ? null : (
        <p role="alert" className="text-[12.5px] text-trust-crit-text">
          {t("spaces.vorschau.autorVerliert")}
        </p>
      )}
      {v.verantwortlicheBehaeltZugang ? null : (
        <p role="alert" className="text-[12.5px] text-trust-crit-text">
          {t("spaces.vorschau.verantwortlicheVerliert")}
        </p>
      )}
      <p data-testid="space-vorschau-bleibt" className="text-[12px] text-muted-2">
        {t("spaces.vorschau.bleibt", {
          version: v.bleibt.version,
          autor: v.bleibt.authorName ?? v.bleibt.author,
          history: v.bleibt.historyEintraege,
          verantwortung: v.bleibt.artikelVerantwortungName ?? v.bleibt.artikelVerantwortung,
        })}
      </p>
      {v.regeln ? <Regeln v={v} /> : null}
      {v.grund ? <p className="text-[12.5px] text-trust-crit-text">{v.grund}</p> : null}
    </div>
  );
}

/** ADMIN-07 (K4): nach welchen Regeln der Artikel vorher und nachher steht. */
function Regeln({ v }: { v: Rechtevorschau }): JSX.Element {
  const { t } = useTranslation();
  const seiten = [
    ["quelle", v.regeln?.quelle ?? null],
    ["ziel", v.regeln?.ziel ?? null],
  ] as const;
  return (
    <div data-testid="space-vorschau-regeln" className="text-[12px] text-text">
      <p className="font-semibold">{t("spaces.vorschau.regelnTitel")}</p>
      {seiten.map(([seite, r]) => (
        <p key={seite} data-seite={seite}>
          {t(`spaces.vorschau.${seite}`)}:{" "}
          {r
            ? t("spaces.vorschau.regelnZeile", {
                zugang: t(`spaces.zugang.${r.zugang}`),
                zustaendig: r.verantwortlichName ?? r.verantwortlich,
              })
            : t("spaces.vorschau.ohneRegeln")}
          {r?.regeln ? ` — ${r.regeln}` : ""}
        </p>
      ))}
    </div>
  );
}

/**
 * LESEN-INHALT-ZUERST (nacharbeit-7): trägt die Antwort die Vertragsform? Seit die Zeile IN der
 * Lesefläche steht (`BibliothekLesen`, nach dem Inhalt), nähme ein Wurf beim Rendern die ganze
 * Eintragsansicht mit — gemessen in `KnowledgeDetail.owner-chain.test.tsx`, wo eine fremde
 * Gegenstelle `[]` statt des Kontexts lieferte (`reading 'name'`). Eine unlesbare Antwort wird wie
 * eine fehlende behandelt: die Zeile zeichnet nichts, der Artikel bleibt lesbar.
 */
function istKontext(daten: unknown): daten is ArtikelKontext {
  if (typeof daten !== "object" || daten === null || Array.isArray(daten)) {
    return false;
  }
  const k = daten as Partial<ArtikelKontext>;
  return (
    typeof k.artikelVerantwortung === "object" &&
    k.artikelVerantwortung !== null &&
    typeof k.autor === "object" &&
    k.autor !== null &&
    Array.isArray(k.ziele)
  );
}

export function SpaceZeile({ koId }: { koId: string }): JSX.Element | null {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const kontext = useQuery({
    queryKey: ["space-kontext", koId],
    queryFn: () => spacesApi.kontext(koId),
    retry: false,
  });
  const [ziel, setZiel] = useState("");
  const [vorschau, setVorschau] = useState<Rechtevorschau | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const zielId = ziel === OHNE ? null : ziel;
  // Nacharbeit 3 (Ben, K4): die AKTUELLE Auswahl, auch innerhalb verspäteter Antworten lesbar.
  // Eine Vorschau, die für ein inzwischen abgewähltes Ziel angefordert wurde, wird verworfen.
  const auswahlRef = useRef<string | null>(zielId);
  auswahlRef.current = zielId;
  const pruefen = useMutation({
    mutationFn: (fuer: string | null) => spacesApi.vorschau(koId, fuer),
    onSuccess: (v, fuer) => {
      if (fuer !== auswahlRef.current || (v.ziel?.id ?? null) !== fuer) {
        return;
      }
      setVorschau(v);
      setMeldung(null);
    },
  });
  // Die Übernahme ist nur möglich, solange die angezeigte Vorschau genau zum gewählten Ziel gehört;
  // Ziel und Grundlage kommen aus dieser Vorschau (`spacesApi.verschieben`).
  const vorschauPasst = vorschau !== null && (vorschau.ziel?.id ?? null) === zielId;
  const uebernehmen = useMutation({
    mutationFn: (v: Rechtevorschau) => spacesApi.verschieben(koId, v),
    onSuccess: async () => {
      setVorschau(null);
      setZiel("");
      setMeldung("spaces.vorschau.erfolg");
      await qc.invalidateQueries({ queryKey: ["space-kontext", koId] });
      await qc.invalidateQueries({ queryKey: ["spaces"] });
      await qc.invalidateQueries({ queryKey: ["space"] });
    },
    onError: (fehler) => {
      if (fehler instanceof ApiError && fehler.code === "VORSCHAU_VERALTET") {
        const neu = fehler.details.vorschau as Rechtevorschau | undefined;
        setVorschau(neu ?? null);
        setMeldung("spaces.vorschau.veraltet");
        return;
      }
      setMeldung(spaceFehlerSchluessel(fehler));
    },
  });

  if (!kontext.isSuccess || !istKontext(kontext.data)) {
    return null;
  }
  const k = kontext.data;
  const verantwortlich = k.artikelVerantwortung.name ?? k.artikelVerantwortung.person;
  const verantwortung =
    k.artikelVerantwortung.art === "owner"
      ? verantwortlich
      : `${verantwortlich} (${t("spaces.artikel.verantwortungErsatz")})`;
  const auswahl = [
    ...k.ziele.map((z) => ({ wert: z.id, name: z.name })),
    ...(k.space ? [{ wert: OHNE, name: t("spaces.artikel.ohneSpace") }] : []),
  ];

  return (
    <Card className="mb-3" data-testid="space-zeile" data-space={k.space?.id ?? ""}>
      <SectionLabel>{t("spaces.artikel.titel")}</SectionLabel>
      <dl className="grid gap-x-4 gap-y-1 text-[12.5px] md:grid-cols-[auto_1fr]">
        <dt className="text-muted">{t("spaces.artikel.fuehrend")}</dt>
        <dd data-testid="space-zeile-space" className="text-text">
          {k.space ? (
            <Link
              to={`/spaces/${encodeURIComponent(k.space.id)}`}
              className="font-semibold text-brand-text hover:underline"
            >
              {k.space.name}
            </Link>
          ) : (
            t("spaces.artikel.keiner")
          )}
        </dd>
        {k.space ? (
          <>
            <dt className="text-muted">{t("spaces.artikel.spaceZustaendig")}</dt>
            <dd data-testid="space-zeile-zustaendig" className="text-text">
              {k.space.verantwortlichName ?? k.space.verantwortlich}
            </dd>
          </>
        ) : null}
        <dt className="text-muted">{t("spaces.artikel.verantwortung")}</dt>
        <dd data-testid="space-zeile-verantwortung" className="text-text">
          {verantwortung}
        </dd>
        <dt className="text-muted">{t("spaces.artikel.autor")}</dt>
        <dd data-testid="space-zeile-autor" className="text-text">
          {k.autor.name ?? k.autor.person}
        </dd>
      </dl>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {k.darfVerschieben && auswahl.length > 0 ? (
          <>
            <select
              aria-label={t("spaces.artikel.ziel")}
              data-testid="space-zeile-ziel"
              className="rounded-input border border-hairline bg-surface px-2 py-1.5 text-[12.5px]"
              value={ziel}
              onChange={(e) => {
                setZiel(e.target.value);
                setVorschau(null);
                setMeldung(null);
              }}
            >
              <option value="">{t("spaces.artikel.ziel")}</option>
              {auswahl.map((z) => (
                <option key={z.wert} value={z.wert}>
                  {z.name}
                </option>
              ))}
            </select>
            <Button
              data-testid="space-zeile-vorschau"
              disabled={!ziel || pruefen.isPending}
              onClick={() => pruefen.mutate(zielId)}
            >
              {t("spaces.artikel.vorschau")}
            </Button>
          </>
        ) : null}
        <Link
          to="/spaces"
          className="text-[12px] font-semibold text-brand-text hover:underline"
          data-testid="space-zeile-alle"
        >
          {t("spaces.artikel.alleSpaces")}
        </Link>
      </div>
      {vorschau && vorschauPasst ? (
        <div className="mt-2 space-y-2">
          <Vorschau v={vorschau} />
          <div className="flex gap-2">
            <Button
              variant="primary"
              data-testid="space-zeile-uebernehmen"
              disabled={!vorschau.darfAusfuehren || uebernehmen.isPending}
              onClick={() => uebernehmen.mutate(vorschau)}
            >
              {t("spaces.vorschau.uebernehmen")}
            </Button>
            <Button onClick={() => setVorschau(null)}>{t("spaces.vorschau.abbrechen")}</Button>
          </div>
        </div>
      ) : null}
      {meldung ? (
        <output data-testid="space-zeile-meldung" className="mt-2 block text-[12.5px] text-text">
          {t(meldung)}
        </output>
      ) : null}
      {pruefen.isError ? (
        <p role="alert" className="mt-2 text-[12.5px] text-trust-crit-text">
          {t(spaceFehlerSchluessel(pruefen.error))}
        </p>
      ) : null}
    </Card>
  );
}
