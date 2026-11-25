import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { teamSprache } from "../../api/teamassistenten";
import {
  type Aktion,
  type Lauf,
  type Workflow,
  workflowFehler,
  workflows,
} from "../../api/teamworkflows";
import { useSession } from "../../app/AuthContext";
import { zitatFragment } from "../../lib/belegstelle";
import { gespeicherteFassungHref } from "../../lib/objektbezug";
import { eingabestil, kartenstil } from "../teamassistenten/teamKontext";
import { Button, Field } from "../ui";
import { schrittIcon } from "./SchrittEditor";

const abfrage = { gcTime: 0, retry: false, refetchOnWindowFocus: "always" as const };
const listeKey = (kontext: string, id: string) => ["workflows", kontext, id, "laeufe"];
const laufKey = (kontext: string, id: string, lauf: string) => [
  "workflows",
  kontext,
  id,
  "laeufe",
  lauf,
];
function zeit(iso: string, lang: string) {
  return new Date(iso).toLocaleString(lang, { dateStyle: "short", timeStyle: "short" });
}

export function WorkflowLaeufe({
  workflow: w,
  kontext,
  oeffnen,
}: { workflow: Workflow; kontext: string; oeffnen: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const cache = useQueryClient();
  const [fall, setFall] = useState("");
  const versuche = useRef(new Map<string, string>());
  const liste = useQuery({
    ...abfrage,
    queryKey: listeKey(kontext, w.id),
    queryFn: () => workflows.laeufe(w.id),
  });
  const start = useMutation({
    mutationFn: async () => {
      if (w.aktiv === null) throw new Error();
      const sprache = teamSprache(i18n.language);
      const text = fall.trim();
      const hash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify([kontext, w.id, w.aktiv, sprache, text])),
      );
      const key = `kw.workflowstart.${Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("")}`;
      let vorgang = versuche.current.get(key);
      if (!vorgang) {
        try {
          vorgang = sessionStorage.getItem(key) ?? undefined;
        } catch {
          /* Optional persistence. */
        }
        vorgang ??= crypto.randomUUID();
        versuche.current.set(key, vorgang);
        try {
          sessionStorage.setItem(key, vorgang);
        } catch {
          /* In-memory retry still works. */
        }
      }
      const l = await workflows.starten(w.id, w.aktiv, vorgang, sprache, text);
      return { l, key };
    },
    onSuccess: async ({ l, key }) => {
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* Optional persistence. */
      }
      versuche.current.delete(key);
      cache.setQueryData(laufKey(kontext, w.id, l.id), l);
      await cache.invalidateQueries({ queryKey: listeKey(kontext, w.id) });
      oeffnen(l.id);
    },
  });
  return (
    <div className="space-y-5">
      <section className={kartenstil}>
        <h2 className="text-xl font-semibold">{w.aktivName || w.name}</h2>
        {w.veroeffentlicht ? (
          <>
            <p className="text-sm">
              <span className="font-medium">{t("workflows.ausloeser")}</span> ·{" "}
              {w.veroeffentlicht.ausloeser}
            </p>
            <ol className="flex flex-wrap items-center gap-2 text-sm">
              {w.veroeffentlicht.schritte.map((s, i) => {
                const Icon = schrittIcon[s.typ];
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: The ordinal identifies a step within this immutable released version.
                  <li key={i} className="flex items-center gap-2">
                    {i > 0 ? <ChevronRight aria-hidden size={14} /> : null}
                    <Icon aria-hidden size={15} />
                    {s.titel}
                  </li>
                );
              })}
            </ol>
          </>
        ) : null}
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!start.isPending && (!w.veroeffentlicht?.brauchtFall || fall.trim()))
              start.mutate();
          }}
        >
          <Field
            label={t(
              w.veroeffentlicht?.brauchtFall ? "workflows.fallPflicht" : "workflows.fallOptional",
            )}
          >
            <textarea
              data-testid="workflow-fall"
              aria-describedby="workflow-fall-sichtbarkeit"
              disabled={start.isPending}
              className={eingabestil}
              required={w.veroeffentlicht?.brauchtFall === true}
              maxLength={500}
              rows={2}
              value={fall}
              onChange={(e) => setFall(e.target.value)}
            />
          </Field>
          <p className="text-sm text-muted" id="workflow-fall-sichtbarkeit">
            {t("workflows.fallSichtbar")}
          </p>
          <Button
            type="submit"
            data-testid="workflow-starten"
            variant="primary"
            disabled={
              start.isPending ||
              w.aktiv === null ||
              Boolean(w.veroeffentlicht?.brauchtFall && !fall.trim())
            }
          >
            {t("workflows.starten", { v: w.aktiv })}
          </Button>
        </form>
        {start.isError ? <p role="alert">{t(workflowFehler(start.error))}</p> : null}
      </section>
      <section className={kartenstil}>
        <h2 className="font-semibold">{t("workflows.laeufe")}</h2>
        {liste.isError ? (
          <p role="alert">{t(workflowFehler(liste.error))}</p>
        ) : !liste.data ? (
          <output>{t("workflows.laden")}</output>
        ) : liste.data.laeufe.length ? (
          <ul className="divide-y divide-hairline">
            {liste.data.laeufe.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 py-3 text-left"
                  onClick={() => oeffnen(l.id)}
                >
                  <span>
                    <span className="block font-medium">
                      {t(`workflows.stand.${l.stand}`)} · {t("workflows.version", { v: l.version })}
                    </span>
                    <span className="text-sm text-muted">
                      {zeit(l.aktualisiertAm, i18n.language)}
                    </span>
                  </span>
                  <ChevronRight size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("workflows.keinLauf")}</p>
        )}
      </section>
    </div>
  );
}

export function WorkflowVorgang({
  kontext,
  workflow: w,
  laufId,
}: { kontext: string; workflow: Workflow; laufId: string }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const { user } = useSession();
  const key = laufKey(kontext, w.id, laufId);
  const q = useQuery({
    ...abfrage,
    queryKey: key,
    refetchInterval: 15_000,
    queryFn: () => workflows.lauf(w.id, laufId),
  });
  const [notizEntwurf, setNotizEntwurf] = useState({ revision: 0, text: "" });
  const notiz = notizEntwurf.revision === q.data?.revision ? notizEntwurf.text : "";
  const ops = useMutation({
    mutationFn: async ({ a, r }: { a: Aktion; r: number }) =>
      workflows.weiter(w.id, laufId, r, a, notiz),
    onSuccess: async (l) => {
      setNotizEntwurf({ revision: 0, text: "" });
      cache.setQueryData(key, l);
      await cache.invalidateQueries({ queryKey: listeKey(kontext, w.id), exact: true });
    },
    onError: async () => {
      await q.refetch();
    },
  });
  if (q.isError) return <p role="alert">{t(workflowFehler(q.error))}</p>;
  const l = q.data;
  if (!l) return <output>{t("workflows.laden")}</output>;
  const person = (id: string) =>
    id === user?.id
      ? user.name || t("workflows.du")
      : l.namen?.[id] || t("workflows.rolle.mitglied");
  const ent = l.schritt?.typ === "entscheidung";
  return (
    <div className="min-w-0 space-y-5 break-words" data-testid="workflow-vorgang">
      <section className={kartenstil}>
        <h2 className="text-xl font-semibold">{l.workflowName ?? w.aktivName ?? w.name}</h2>
        <p className="text-sm text-muted">
          {t("workflows.version", { v: l.version })} ·{" "}
          {t("workflows.von", { name: person(l.gestartetVon) })}
        </p>
        {l.ausloeser ? (
          <p className="text-sm">
            <strong>{t("workflows.startanlass")}</strong> · {l.ausloeser}
          </p>
        ) : null}
        {l.fall ? <p className="break-words whitespace-pre-line text-sm">{l.fall}</p> : null}
        <h3 className="flex items-center gap-2 font-semibold" data-testid="workflow-stand">
          <CalendarClock size={17} aria-hidden />
          {t(`workflows.stand.${l.stand}`)}
        </h3>
        {l.grund ? (
          <p aria-live="polite">
            {t(`workflows.grund.${l.grund}`, { defaultValue: t("workflows.grundlage") })}
          </p>
        ) : null}
        {l.schritt ? (
          <div className="space-y-1 border-l-2 border-hairline pl-3">
            <p className="text-sm text-muted">
              {t("workflows.schrittTyp", {
                n: l.index + 1,
                typ: t(`workflows.typ.${l.schritt.typ}`),
              })}
            </p>
            <p className="font-semibold">{l.schritt.titel}</p>
            {l.schritt.typ === "assistent" ? (
              <p className="text-sm text-muted">
                {t("workflows.assistentVersion", { v: l.schritt.version })}
              </p>
            ) : null}
            {l.zustaendig ? (
              <p className="text-sm">{t("workflows.zustaendig", { name: person(l.zustaendig) })}</p>
            ) : ent && l.schritt.typ === "entscheidung" ? (
              <p className="text-sm">
                {t("workflows.zustaendig", { name: t(`workflows.rolle.${l.schritt.rolle}`) })}
              </p>
            ) : null}
          </div>
        ) : null}
        {ent && l.stand === "laeuft" ? (
          <div className="space-y-2 rounded-input border border-hairline p-3 text-sm">
            {l.naechsteWirkung ? (
              <p>
                <strong>{t("workflows.naechsteWirkung")}</strong> · {l.naechsteWirkung.titel}
              </p>
            ) : null}
            {l.verlauf
              .filter((v) => v.antwort?.quellen.length)
              .flatMap((v) =>
                (v.antwort?.quellen ?? []).map((qu) => (
                  <a
                    key={v.index + qu.id}
                    className="block text-brand-text underline"
                    href={gespeicherteFassungHref(qu.id, qu.version) + zitatFragment(qu.auszug)}
                  >
                    {t("workflows.nameVersion", { name: qu.titel, v: qu.version })}
                  </a>
                )),
              )}
            {l.naechsteWirkung || l.verlauf.some((v) => v.antwort?.quellen.length) ? null : (
              <span>{t("workflows.entscheidungOhneQuelle")}</span>
            )}
          </div>
        ) : null}
        {l.stand === "laeuft" && l.schritt?.typ === "aktion" && !l.aktionen.length ? (
          <p className="text-sm text-muted">{t("workflows.aktionWartet")}</p>
        ) : null}
        {l.aktionen.length ? (
          <div className="space-y-3">
            {l.aktionen.some((a) => a !== "weiter") ? (
              <Field label={t("workflows.notiz")}>
                <textarea
                  className={eingabestil}
                  data-testid="workflow-notiz"
                  maxLength={1000}
                  rows={2}
                  value={notiz}
                  onChange={(e) => setNotizEntwurf({ revision: l.revision, text: e.target.value })}
                />
              </Field>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {l.aktionen.map((a) => (
                <Button
                  key={a}
                  data-testid={`workflow-${a}`}
                  disabled={
                    ops.isPending || ((a === "antworten" || a === "rueckfrage") && !notiz.trim())
                  }
                  variant={
                    a === "weiter" || a === "annehmen" || a === "antworten" ? "primary" : "outline"
                  }
                  onClick={() => ops.mutate({ a, r: l.revision })}
                >
                  {t(`workflows.tun.${a}`)}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        {ops.isError ? <p role="alert">{t(workflowFehler(ops.error))}</p> : null}
        <Button
          variant="ghost"
          onClick={() => void q.refetch()}
          disabled={q.isFetching || ops.isPending}
        >
          {t("workflows.aktualisieren")}
        </Button>
      </section>
      <Verlauf l={l} person={person} />
    </div>
  );
}
function Verlauf({ l, person }: { l: Lauf; person: (id: string) => string }) {
  const { t, i18n } = useTranslation();
  return (
    <>
      <section className={kartenstil}>
        <h3 className="font-semibold">{t("workflows.verlauf")}</h3>
        <ol className="divide-y divide-hairline">
          {l.verlauf.map((v, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: The append-only run log assigns events a stable position.
            <li key={i} className="space-y-2 break-words py-3">
              <p className="font-medium">{v.schrittTitel ?? t(`workflows.ereignis.${v.typ}`)}</p>
              <p className="text-xs text-muted">
                {v.schrittTitel ? `${t(`workflows.ereignis.${v.typ}`)} · ` : null}
                {zeit(v.am, i18n.language)} · {person(v.akteur)}
                {v.typ !== "start" ? ` · ${t("workflows.nummer", { n: v.index + 1 })}` : null}
              </p>
              {v.notiz ? <p className="whitespace-pre-line text-sm">{v.notiz}</p> : null}
              {v.version ? (
                <p className="text-sm">{t("workflows.assistentVersion", { v: v.version })}</p>
              ) : null}
              {v.antwort ? (
                <div className="space-y-2 text-sm">
                  <strong>{t(`teamassistenten.${v.antwort.stand}`)}</strong>
                  <p>{v.antwort.text}</p>
                  {v.antwort.quellen.map((qu) => (
                    <div key={qu.id} className="border-l-2 border-hairline pl-3">
                      <a
                        className="font-medium text-brand-text underline"
                        href={gespeicherteFassungHref(qu.id, qu.version) + zitatFragment(qu.auszug)}
                      >
                        {t("workflows.nameVersion", { name: qu.titel, v: qu.version })}
                      </a>
                      <blockquote>{qu.auszug}</blockquote>
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
      {l.ergebnisse?.length ? (
        <section className={kartenstil}>
          <h3 className="font-semibold">{t("workflows.ergebnisse")}</h3>
          {l.ergebnisse.map((e) => (
            <div className="text-sm" key={e.id}>
              <p className="font-medium">{e.titel}</p>
              <p>
                {t("workflows.version", { v: e.workflowVersion })} · {person(e.erstelltVon)} ·{" "}
                {zeit(e.erstelltAm, i18n.language)}
              </p>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
