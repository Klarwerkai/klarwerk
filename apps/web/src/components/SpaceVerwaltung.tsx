// Spaces verwalten (produkt:20261007:spaces:admin-20261009, ADMIN-07): wer hat Zugriff und woher,
// was das Archivieren bewirkt, wie ein archivierter Space wiederaufgenommen wird, und wie vorhandene
// Artikel ohne Space einen führenden Space bekommen.
//
// Alle Entscheidungen trifft der Server (`spaces-routes.ts`, `space-verwaltung.ts`). Diese Flächen
// zeigen seine Vorschau und schicken nur mit deren Grundlage ab; ändert sich die Lage dazwischen,
// kommt die neue Vorschau zurück (VORSCHAU_VERALTET) und wird statt der alten gezeigt.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import {
  type ArchivFolgen,
  type BestandsErgebnis,
  type BestandsPlan,
  type BestandsRegel,
  type SpaceSicht,
  spaceFehlerSchluessel,
  spacesApi,
} from "../api/spaces";
import { Button, Card, Field, SectionLabel, TextInput } from "./ui";

const FELD =
  "w-full rounded-input border border-hairline bg-surface px-3 py-2 text-sm text-text outline-none focus:border-ink/30";

/** Fokus auf die Überschrift, sobald eine Vorschau erscheint — gelesen wird, was sich ändert. */
function useFokusBeiErscheinen<T extends HTMLElement>(sichtbar: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (sichtbar) {
      ref.current?.focus();
    }
  }, [sichtbar]);
  return ref;
}

// ------------------------------------------------------------------------------------------------
// K2 · Zugriff: Herkunft (zuständig, direkt, je Team, offen) und Wirkung je Person.
// ------------------------------------------------------------------------------------------------

export function SpaceZugriff({ space }: { space: SpaceSicht }): JSX.Element {
  const { t } = useTranslation();
  const zugriff = useQuery({
    queryKey: ["space", space.id, "zugriff", space.version],
    queryFn: () => spacesApi.zugriff(space.id),
  });
  return (
    <Card className="mb-4" data-testid="space-zugriff">
      <SectionLabel>{t("spaces.zugriff.titel")}</SectionLabel>
      <p className="mb-2 text-[12px] text-muted-2">{t("spaces.zugriff.erklaerung")}</p>
      {zugriff.isError ? (
        <p role="alert" className="text-[12.5px] text-trust-crit-text">
          {t(spaceFehlerSchluessel(zugriff.error))}
        </p>
      ) : null}
      {zugriff.isSuccess ? (
        <>
          {zugriff.data.personen.length === 0 ? (
            <p className="text-[12.5px] text-muted">{t("spaces.zugriff.niemand")}</p>
          ) : (
            <ul className="space-y-2">
              {zugriff.data.personen.map((p) => (
                <li
                  key={p.nutzer}
                  data-testid="space-zugriff-person"
                  data-konto={p.nutzer}
                  data-wirksam={p.wirksam}
                  className="rounded-btn border border-hairline px-3 py-2"
                >
                  <p className="text-[13px] font-semibold text-ink">
                    {p.name}{" "}
                    <span className="font-normal text-muted-2">
                      · {t(`spaces.eigenesRechtKurz.${p.wirksam}`)}
                    </span>
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {p.wege.map((w) => (
                      <li
                        key={`${w.art}-${w.team ?? ""}`}
                        data-testid="space-zugriff-weg"
                        data-art={w.art}
                        className="rounded-btn border border-hairline px-2 py-0.5 text-[12px] text-text"
                      >
                        {t(`spaces.zugriff.weg.${w.art}`, { team: w.teamName ?? w.team ?? "" })}
                        {" · "}
                        {t(`spaces.recht.${w.recht}`)}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          {zugriff.data.zugang === "alle" ? (
            <p className="mt-2 text-[12px] text-muted-2" data-testid="space-zugriff-offen">
              {t("spaces.zugriff.offenWeitere", { anzahl: zugriff.data.offenWeitere })}
            </p>
          ) : null}
          <p className="mt-2 text-[12px] text-muted-2">{t("spaces.zugriff.keinAdminDurchgriff")}</p>
        </>
      ) : null}
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------
// K5 · Archivieren mit Folgenvorschau und Begründung; Wiederaufnahme mit Begründung.
// ------------------------------------------------------------------------------------------------

function Folgen({ f }: { f: ArchivFolgen }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5 text-[12.5px]">
      <p data-testid="space-archiv-lesen" className="text-text">
        {t("spaces.archiv.lesen", { anzahl: f.leserBleiben })}
      </p>
      <p data-testid="space-archiv-schreiben" className="text-trust-crit-text">
        {t("spaces.archiv.schreiben", { anzahl: f.schreibenEntfaellt.length })}
        {f.schreibenEntfaellt.length > 0
          ? `: ${f.schreibenEntfaellt.map((p) => p.name).join(", ")}`
          : ""}
      </p>
      <p data-testid="space-archiv-aufgaben" className="text-text">
        {t("spaces.archiv.aufgaben", { offen: f.artikel.offen, gesamt: f.artikel.gesamt })}
      </p>
      {f.artikel.offenSichtbar.length > 0 ? (
        <ul className="ml-4 list-disc text-[12px] text-muted">
          {f.artikel.offenSichtbar.map((a) => (
            <li key={a.id}>
              <Link to={`/wissen/${encodeURIComponent(a.id)}`} className="hover:underline">
                {a.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {f.artikel.offen > f.artikel.offenSichtbar.length ? (
        <p className="text-[12px] text-muted-2">
          {t("spaces.archiv.aufgabenVerborgen", {
            anzahl: f.artikel.offen - f.artikel.offenSichtbar.length,
          })}
        </p>
      ) : null}
      {f.verantwortungsfragen.length > 0 ? (
        <div role="alert" data-testid="space-archiv-fragen" className="text-trust-crit-text">
          <p className="font-semibold">{t("spaces.archiv.fragenTitel")}</p>
          <ul className="ml-4 list-disc">
            {f.verantwortungsfragen.map((q) => (
              <li key={q.art} data-testid="space-archiv-frage" data-art={q.art}>
                {t(`spaces.archiv.frage.${q.art}`, { anzahl: q.anzahl })}
                {q.artikel.length > 0 ? `: ${q.artikel.map((a) => a.title).join(", ")}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-[12px] text-muted-2">{t("spaces.archiv.bleibt")}</p>
    </div>
  );
}

export function SpaceArchiv({ space }: { space: SpaceSicht }): JSX.Element | null {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [folgen, setFolgen] = useState<ArchivFolgen | null>(null);
  const [begruendung, setBegruendung] = useState("");
  const [meldung, setMeldung] = useState<string | null>(null);
  const titelRef = useFokusBeiErscheinen<HTMLHeadingElement>(folgen !== null);
  const fertig = async () => {
    setFolgen(null);
    setBegruendung("");
    await qc.invalidateQueries({ queryKey: ["spaces"] });
    await qc.invalidateQueries({ queryKey: ["space", space.id] });
  };
  const pruefen = useMutation({
    mutationFn: () => spacesApi.archivVorschau(space.id),
    onSuccess: (f) => {
      setFolgen(f);
      setMeldung(null);
    },
    onError: (e) => setMeldung(spaceFehlerSchluessel(e)),
  });
  const archivieren = useMutation({
    mutationFn: (f: ArchivFolgen) => spacesApi.archivieren(space.id, f, begruendung),
    onSuccess: async () => {
      setMeldung("spaces.archiv.erfolg");
      await fertig();
    },
    onError: (e) => {
      if (
        e instanceof ApiError &&
        (e.code === "VORSCHAU_VERALTET" || e.code === "OFFENE_VERANTWORTUNG")
      ) {
        setFolgen((e.details.vorschau as ArchivFolgen | undefined) ?? null);
      }
      setMeldung(spaceFehlerSchluessel(e));
    },
  });
  const wiederaufnehmen = useMutation({
    mutationFn: () => spacesApi.wiederaufnehmen(space.id, space.version, begruendung),
    onSuccess: async () => {
      setMeldung("spaces.archiv.wiederErfolg");
      await fertig();
    },
    onError: (e) => setMeldung(spaceFehlerSchluessel(e)),
  });

  if (!space.darfBearbeiten) {
    return null;
  }
  const begruendungFeld = (
    <Field label={t("spaces.archiv.begruendung")}>
      <textarea
        data-testid="space-archiv-begruendung"
        rows={2}
        className={FELD}
        value={begruendung}
        onChange={(e) => setBegruendung(e.target.value)}
      />
    </Field>
  );

  return (
    <Card className="mb-4" data-testid="space-archiv">
      <SectionLabel>
        {space.archiviert ? t("spaces.archiv.wiederTitel") : t("spaces.archiv.titel")}
      </SectionLabel>
      {space.archiviert ? (
        <div className="space-y-2">
          <p className="text-[12.5px] text-text">{t("spaces.archiv.wiederErklaerung")}</p>
          {begruendungFeld}
          <Button
            variant="primary"
            data-testid="space-wiederaufnehmen"
            disabled={!begruendung.trim() || wiederaufnehmen.isPending}
            onClick={() => wiederaufnehmen.mutate()}
          >
            {t("spaces.archiv.wiederaufnehmen")}
          </Button>
        </div>
      ) : folgen ? (
        <div className="space-y-2" data-testid="space-archiv-folgen">
          <h3
            id="space-archiv-titel"
            ref={titelRef}
            tabIndex={-1}
            className="text-[13.5px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
          >
            {t("spaces.archiv.folgenTitel", { name: folgen.name })}
          </h3>
          <Folgen f={folgen} />
          {folgen.darfArchivieren ? begruendungFeld : null}
          {folgen.grund ? (
            <p className="text-[12.5px] text-trust-crit-text" data-testid="space-archiv-grund">
              {folgen.grund}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              data-testid="space-archiv-bestaetigen"
              disabled={!folgen.darfArchivieren || !begruendung.trim() || archivieren.isPending}
              onClick={() => archivieren.mutate(folgen)}
            >
              {t("spaces.archiv.bestaetigen")}
            </Button>
            <Button data-testid="space-archiv-abbrechen" onClick={() => setFolgen(null)}>
              {t("spaces.vorschau.abbrechen")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[12.5px] text-text">{t("spaces.archiv.erklaerung")}</p>
          <Button
            data-testid="space-archivieren"
            disabled={pruefen.isPending}
            onClick={() => pruefen.mutate()}
          >
            {t("spaces.archiv.pruefen")}
          </Button>
        </div>
      )}
      {meldung ? (
        <output data-testid="space-archiv-meldung" className="mt-2 block text-[12.5px] text-text">
          {t(meldung)}
        </output>
      ) : null}
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------
// K6 · Bestandszuordnung: Regel „Tag → Zielspace", Bilanz vorher, dokumentierte Übernahme.
// ------------------------------------------------------------------------------------------------

export function SpaceBestand({ spaces }: { spaces: SpaceSicht[] }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const aktive = spaces.filter((s) => !s.archiviert);
  const [regeln, setRegeln] = useState<BestandsRegel[]>([{ tag: "", zielSpaceId: "" }]);
  const [plan, setPlan] = useState<BestandsPlan | null>(null);
  const [ergebnis, setErgebnis] = useState<BestandsErgebnis | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const titelRef = useFokusBeiErscheinen<HTMLHeadingElement>(plan !== null);
  const protokoll = useQuery({
    queryKey: ["spaces", "bestand", "protokoll"],
    queryFn: spacesApi.bestandProtokoll,
  });
  const gueltig = regeln.filter((r) => r.tag.trim() && r.zielSpaceId);
  const pruefen = useMutation({
    mutationFn: () => spacesApi.bestandVorschau(gueltig),
    onSuccess: (p) => {
      setPlan(p);
      setErgebnis(null);
      setMeldung(null);
    },
    onError: (e) => setMeldung(spaceFehlerSchluessel(e)),
  });
  const zuordnen = useMutation({
    mutationFn: (p: BestandsPlan) => spacesApi.bestandZuordnen(gueltig, p),
    onSuccess: async (e) => {
      setErgebnis(e);
      setPlan(null);
      setMeldung("spaces.bestand.erfolg");
      await qc.invalidateQueries({ queryKey: ["spaces"] });
      await qc.invalidateQueries({ queryKey: ["space"] });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "VORSCHAU_VERALTET") {
        setPlan((e.details.vorschau as BestandsPlan | undefined) ?? null);
      }
      setMeldung(spaceFehlerSchluessel(e));
    },
  });
  const titel = (x: { koId: string; title: string | null }) =>
    x.title ?? t("spaces.bestand.nichtEinsehbar", { id: x.koId });

  return (
    <Card className="mt-6" data-testid="space-bestand">
      <SectionLabel>{t("spaces.bestand.titel")}</SectionLabel>
      <p className="mb-2 text-[12px] text-muted-2">{t("spaces.bestand.erklaerung")}</p>
      <div className="space-y-2">
        {regeln.map((r, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: neue Regeln haben noch keine Kennung.
          <div key={i} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <TextInput
              aria-label={t("spaces.bestand.tag")}
              placeholder={t("spaces.bestand.tag")}
              data-testid="space-bestand-tag"
              value={r.tag}
              onChange={(e) => {
                setRegeln(regeln.map((x, j) => (j === i ? { ...x, tag: e.target.value } : x)));
                setPlan(null);
              }}
            />
            <select
              aria-label={t("spaces.bestand.ziel")}
              data-testid="space-bestand-ziel"
              className={FELD}
              value={r.zielSpaceId}
              onChange={(e) => {
                setRegeln(
                  regeln.map((x, j) => (j === i ? { ...x, zielSpaceId: e.target.value } : x)),
                );
                setPlan(null);
              }}
            >
              <option value="">{t("spaces.bestand.ziel")}</option>
              {aktive.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button
              disabled={regeln.length === 1}
              onClick={() => {
                setRegeln(regeln.filter((_, j) => j !== i));
                setPlan(null);
              }}
            >
              {t("spaces.feld.entfernen")}
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setRegeln([...regeln, { tag: "", zielSpaceId: "" }])}>
            {t("spaces.bestand.regelHinzu")}
          </Button>
          <Button
            data-testid="space-bestand-pruefen"
            disabled={gueltig.length === 0 || pruefen.isPending}
            onClick={() => pruefen.mutate()}
          >
            {t("spaces.bestand.pruefen")}
          </Button>
        </div>
      </div>
      {plan ? (
        <div
          className="mt-3 space-y-2 rounded-btn border border-hairline p-3"
          data-testid="space-bestand-plan"
        >
          <h3
            id="space-bestand-titel"
            ref={titelRef}
            tabIndex={-1}
            className="text-[13.5px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
          >
            {t("spaces.bestand.bilanzTitel")}
          </h3>
          <p data-testid="space-bestand-bilanz" className="text-[12.5px] text-text">
            {t("spaces.bestand.bilanz", plan.bilanz)}
          </p>
          {plan.zuordnungen.length > 0 ? (
            <ul className="ml-4 list-disc text-[12px] text-text">
              {plan.zuordnungen.map((z) => (
                <li key={z.koId} data-testid="space-bestand-zuordnung" data-ko={z.koId}>
                  {t("spaces.bestand.zuordnung", {
                    titel: titel(z),
                    ziel: z.zielName,
                    anzahl: z.verlieren,
                  })}
                </li>
              ))}
            </ul>
          ) : null}
          {plan.ausnahmen.length > 0 ? (
            <ul className="ml-4 list-disc text-[12px] text-trust-crit-text">
              {plan.ausnahmen.map((a) => (
                <li
                  key={a.koId}
                  data-testid="space-bestand-ausnahme"
                  data-ko={a.koId}
                  data-art={a.art}
                >
                  {titel(a)} — {t(`spaces.bestand.ausnahme.${a.art}`)}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-[12px] text-muted-2">{t("spaces.bestand.bleibt")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              data-testid="space-bestand-uebernehmen"
              disabled={plan.zuordnungen.length === 0 || zuordnen.isPending}
              onClick={() => zuordnen.mutate(plan)}
            >
              {t("spaces.bestand.uebernehmen", { anzahl: plan.zuordnungen.length })}
            </Button>
            <Button onClick={() => setPlan(null)}>{t("spaces.vorschau.abbrechen")}</Button>
          </div>
        </div>
      ) : null}
      {ergebnis ? (
        <p data-testid="space-bestand-ergebnis" className="mt-2 text-[12.5px] text-text">
          {t("spaces.bestand.ergebnis", {
            zugeordnet: ergebnis.bilanz.zugeordnet,
            ausnahmen: ergebnis.bilanz.ausnahmen,
            fehlgeschlagen: ergebnis.bilanz.fehlgeschlagen,
          })}
        </p>
      ) : null}
      {meldung ? (
        <output data-testid="space-bestand-meldung" className="mt-2 block text-[12.5px] text-text">
          {t(meldung)}
        </output>
      ) : null}
      {protokoll.isSuccess && protokoll.data.laeufe.length > 0 ? (
        <div className="mt-3 border-t border-hairline pt-2">
          <SectionLabel>{t("spaces.bestand.protokoll")}</SectionLabel>
          <ol data-testid="space-bestand-protokoll" className="space-y-1 text-[12px] text-muted-2">
            {[...protokoll.data.laeufe].reverse().map((l) => (
              <li key={`${l.am}-${l.wer}`} data-testid="space-bestand-lauf">
                {t("spaces.bestand.lauf", {
                  zeit: new Date(l.am).toLocaleString(),
                  zugeordnet: l.bilanz.zugeordnet,
                  ausnahmen: l.bilanz.ausnahmen,
                  ohneRegel: l.bilanz.ohneRegel,
                })}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </Card>
  );
}
