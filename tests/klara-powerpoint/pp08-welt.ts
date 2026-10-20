import JSZip from "jszip";
import { expect } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { VortragsAuftrag } from "../../services/app/src/praesentation-vortrag";
import { deck } from "./pp02-hostwelt";

// Nur fiktiver Speicherbestand; echte Produktdienste, Anmeldung, Routen und PPTX-Leser.
// Kein Browser, Office, Mikrofon, Provider oder Datenbanklauf.
process.env.KLARWERK_SKIP_KEYCHAIN = "1";
const MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
// biome-ignore lint/suspicious/noExplicitAny: Echte JSON-Drahtantworten werden in den Tests fachlich geprüft.
export type Antwort = any;
export async function vortragsWelt(
  vorBereit?: (app: ReturnType<typeof buildApp>) => Promise<void>,
  detailUmsatz = false,
) {
  const services = buildServices();
  const app = buildApp(services);
  if (vorBereit) await vorBereit(app);
  await app.ready();
  const person = { name: "Q Fiktiv", email: "q@vortrag.test", password: "fiktiv-pp08-1" };
  const reg = await app.inject({ method: "POST", url: "/api/auth/register", payload: person });
  expect(reg.statusCode, reg.body).toBe(201);
  const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: person });
  expect(login.statusCode, login.body).toBe(200);
  const cookie = `kw_session=${login.json().token}`;
  const konto = String(reg.json().id);
  const ruf = async (method: "GET" | "POST", url: string, payload?: unknown, mitCookie = true) => {
    const r = await app.inject({
      method,
      url,
      headers: mitCookie ? { cookie } : {},
      ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
    });
    return { status: r.statusCode, body: r.json() as Antwort, headers: r.headers };
  };
  expect((await ruf("POST", "/api/auth/notice")).status).toBe(200);
  let bytes = await deck();
  if (detailUmsatz) {
    const zip = await JSZip.loadAsync(bytes);
    const name = "ppt/slides/slide2.xml";
    const xml = await zip.file(name)?.async("string");
    if (!xml) throw new Error("Detailfolie fehlt");
    zip.file(name, xml.replace("Ergebnis 2026: 320 T€", "Umsatz Q4 2025: 1.500 T€"));
    bytes = await zip.generateAsync({ type: "nodebuffer" });
  }
  const obj = await services.objects.put({
    name: "Fiktiver Vortrag.pptx",
    mime: MIME,
    data: `data:${MIME};base64,${bytes.toString("base64")}`,
    purpose: "attachment",
  });
  const ko = await services.ko.create({
    title: "Fiktiver Q-Vortrag",
    statement: "Fiktive Kennzahlen",
    type: "best_practice",
    category: "Test",
    author: konto,
    confidentiality: "intern",
  });
  const mit = await services.ko.addAttachment(ko.id, konto, {
    name: "Fiktiver Vortrag.pptx",
    mime: MIME,
    objectId: obj.id,
    size: obj.size,
  });
  const anhangId = mit.attachments?.[0]?.id ?? "";
  const pfad = `/api/kos/${ko.id}/office/${anhangId}`;
  const erfasse = async (payload: Record<string, unknown>) => {
    const r = await ruf("POST", `/api/kos/${ko.id}/datenpunkte`, payload);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    return r.body;
  };
  const ort = { anhangId, sldId: "256", shapeId: "4", zeile: 2, spalte: 3 };
  const dp = await erfasse({
    art: "zahl",
    wert: "1.500 T€",
    einheit: "T€",
    zeitraum: "Q4 2025",
    bezugsgroesse: "Umsatz",
    erfassung: "direkt",
    ort,
  });
  const lage = (await ruf("GET", `${pfad}/folien-daten`)).body;
  const auftrag = (patch: Partial<VortragsAuftrag> = {}): VortragsAuftrag => ({
    basis: lage.dateiFassung,
    modus: "vorbereiten",
    zielSekunden: 120,
    notizen: [
      {
        sldId: "256",
        text: "",
        uebergang: "Im Anschluss folgt der Ausblick.",
        sekunden: 60,
        aussagen: [{ id: dp.id, fassung: dp.fassung }],
        detailSldIds: [],
      },
    ],
    nachbereitung: [],
    ...patch,
  });
  return {
    app,
    services,
    cookie,
    konto,
    koId: ko.id,
    anhangId,
    ort,
    pfad,
    ruf,
    erfasse,
    dp,
    lage,
    auftrag,
    auswerten: (a: unknown) => ruf("POST", `${pfad}/vortrag`, a),
  };
}
