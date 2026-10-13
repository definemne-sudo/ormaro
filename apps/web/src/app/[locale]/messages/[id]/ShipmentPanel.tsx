import { cities, cityName, couriers, type Locale, type ShippingOption } from "@ormaro/shared";
import { getTranslations } from "next-intl/server";
import { formatPrice, formatRelative } from "@/lib/format";
import type { Shipment } from "@/lib/shipments";
import {
  cancelShipmentAction,
  markDeliveredAction,
  markShippedAction,
  requestShipmentAction,
} from "../shippingActions";

type Prefill = { n?: string; p?: string; c?: string; a?: string; o?: string };

const field =
  "h-12 w-full rounded-xl border border-field bg-white px-3.5 text-[15px] text-ink focus:border-brand-strong focus:outline-none";
const card = "flex flex-col gap-3 rounded-2xl border-[1.5px] border-brand-strong bg-white p-4";

/**
 * Sohbetteki kargo kutusu. Alıcı adresini girer, satıcı paketi kapıda ödemeli
 * gönderip takip numarasını yazar, alıcı teslim alınca onaylar.
 */
export async function ShipmentPanel(props: {
  locale: string;
  conversationId: string;
  role: "buyer" | "seller";
  listing: { status: "active" | "sold" | "removed"; shipping: ShippingOption; priceEuro: number };
  acceptedOffer: number | null;
  shipment: Shipment | null;
  blocked: boolean;
  open: boolean;
  error?: string;
  prefill: Prefill;
  defaults: { name: string; cityKey: string };
}) {
  const t = await getTranslations("shipping");
  const loc = props.locale as Locale;
  const s = props.shipment;
  const hidden = (
    <>
      <input type="hidden" name="locale" value={props.locale} />
      <input type="hidden" name="conversationId" value={props.conversationId} />
      {s && <input type="hidden" name="shipmentId" value={s.id} />}
    </>
  );
  const errorBox = props.error ? (
    <p role="alert" className="rounded-xl bg-[#FDF0EC] p-3 text-sm font-semibold text-[#9A2B12]">
      {t(`errors.${["notAllowed", "exists", "name", "phone", "city", "address", "courier", "tracking"].includes(props.error) ? props.error : "generic"}`)}
    </p>
  ) : null;
  const payerLine = (payer: ShippingOption) => (payer === "seller" ? t("feeSeller") : t("feeBuyer"));

  // Aktif bir gönderi yoksa: alıcıya kargo isteme formu.
  if (!s || s.status === "cancelled") {
    if (props.role !== "buyer" || props.blocked || props.listing.status !== "active" || props.listing.shipping === "none") {
      return s?.status === "cancelled" ? (
        <p className="rounded-xl bg-surface p-3 text-center text-[13px] text-muted">{t("cancelledNote")}</p>
      ) : null;
    }
    const amount = props.acceptedOffer ?? props.listing.priceEuro;
    const pf = props.prefill;
    return (
      <section aria-labelledby="ship-title" className="flex flex-col gap-2">
        {s?.status === "cancelled" && (
          <p className="rounded-xl bg-surface p-3 text-center text-[13px] text-muted">{t("cancelledNote")}</p>
        )}
        <details open={props.open} className="group rounded-2xl border border-line bg-white">
          <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="flex flex-col">
              <span id="ship-title" className="text-[15px] font-bold">
                {t("requestTitle")}
              </span>
              <span className="text-[13px] text-muted">
                {t("requestSummary", { amount: formatPrice(amount, loc) })} · {payerLine(props.listing.shipping)}
              </span>
            </span>
            <span aria-hidden="true" className="text-xl text-brand-strong transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <form action={requestShipmentAction} className="flex flex-col gap-3 border-t border-line px-4 pt-3 pb-4">
            {hidden}
            <p className="text-[13px] leading-relaxed text-muted">{t("requestExplain")}</p>
            {errorBox}
            <div className="flex flex-col gap-1">
              <label htmlFor="recipientName" className="text-sm font-bold">
                {t("recipientName")}
              </label>
              <input id="recipientName" name="recipientName" required minLength={3} maxLength={80} autoComplete="name" defaultValue={pf.n ?? props.defaults.name} className={field} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="phone" className="text-sm font-bold">
                {t("phone")}
              </label>
              <input id="phone" name="phone" type="tel" required autoComplete="tel" placeholder="+382 6x xxx xxx" defaultValue={pf.p} className={field} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="shipCity" className="text-sm font-bold">
                {t("city")}
              </label>
              <select id="shipCity" name="cityKey" required defaultValue={pf.c ?? props.defaults.cityKey} className={field}>
                <option value="" disabled>
                  {t("choose")}
                </option>
                {[...cities]
                  .sort((a, b) => cityName(a.key, loc).localeCompare(cityName(b.key, loc)))
                  .map((c) => (
                    <option key={c.key} value={c.key}>
                      {cityName(c.key, loc)}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="address" className="text-sm font-bold">
                {t("address")}
              </label>
              <textarea
                id="address"
                name="address"
                required
                minLength={5}
                maxLength={200}
                rows={2}
                autoComplete="street-address"
                defaultValue={pf.a}
                className="rounded-xl border border-field px-3.5 py-2.5 text-[15px] focus:border-brand-strong focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="note" className="text-sm font-bold">
                {t("note")} <span className="font-normal text-muted">{t("optional")}</span>
              </label>
              <input id="note" name="note" maxLength={300} defaultValue={pf.o} placeholder={t("notePlaceholder")} className={field} />
            </div>
            <p className="text-[13px] text-muted">{t("privacy")}</p>
            <button type="submit" className="min-h-12 rounded-xl bg-brand font-bold text-ink">
              {t("requestSubmit")}
            </button>
          </form>
        </details>
      </section>
    );
  }

  const amount = formatPrice(s.amountEuro, loc);
  const address = (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-surface p-3 text-sm">
      <dt className="text-muted">{t("recipientName")}</dt>
      <dd className="font-semibold">{s.recipientName}</dd>
      <dt className="text-muted">{t("phone")}</dt>
      <dd>
        <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} className="font-semibold text-brand-strong underline">
          {s.phone}
        </a>
      </dd>
      <dt className="text-muted">{t("city")}</dt>
      <dd>{cityName(s.cityKey, loc)}</dd>
      <dt className="text-muted">{t("address")}</dt>
      <dd className="whitespace-pre-line">{s.address}</dd>
      {s.note && (
        <>
          <dt className="text-muted">{t("note")}</dt>
          <dd className="whitespace-pre-line">{s.note}</dd>
        </>
      )}
    </dl>
  );
  const cancelButton = (label: string) => (
    <form action={cancelShipmentAction}>
      {hidden}
      <button type="submit" className="min-h-11 w-full text-sm font-semibold text-muted underline">
        {label}
      </button>
    </form>
  );

  if (s.status === "requested") {
    if (props.role === "seller") {
      return (
        <section aria-labelledby="ship-title" className={card}>
          <h2 id="ship-title" className="text-base font-bold">
            {t("sellerRequestedTitle")}
          </h2>
          {errorBox}
          {address}
          <div className="flex flex-col gap-1.5 rounded-xl border border-line p-3 text-sm leading-relaxed">
            <p className="font-bold">{t("howTitle")}</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>{t("how1")}</li>
              <li>{t.rich("how2", { amount, b: (c) => <strong>{c}</strong> })}</li>
              <li>{s.shippingPayer === "seller" ? t("how3seller") : t("how3buyer")}</li>
              <li>{t("how4")}</li>
            </ol>
          </div>
          <details className="rounded-xl border border-line">
            <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold">{t("couriers")}</summary>
            <ul className="flex flex-col divide-y divide-line px-3 pb-2 text-sm">
              {couriers
                .filter((c) => c.key !== "other")
                .map((c) => (
                  <li key={c.key} className="flex flex-col py-2">
                    <span className="font-semibold">{c.name}</span>
                    <span className="flex flex-wrap gap-x-3 text-muted">
                      {c.phone && (
                        <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="underline">
                          {c.phone}
                        </a>
                      )}
                      {c.url && (
                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline">
                          {c.url.replace(/^https:\/\/(www\.)?/, "")}
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              <li className="py-2 text-[13px] text-muted">{t("couriersNote")}</li>
            </ul>
          </details>
          <form action={markShippedAction} className="flex flex-col gap-3">
            {hidden}
            <div className="flex flex-col gap-1">
              <label htmlFor="courierKey" className="text-sm font-bold">
                {t("courier")}
              </label>
              <select id="courierKey" name="courierKey" required defaultValue="" className={field}>
                <option value="" disabled>
                  {t("choose")}
                </option>
                {couriers.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name ?? t("otherCourier")}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="courierName" className="text-sm font-bold">
                {t("courierName")} <span className="font-normal text-muted">{t("onlyOther")}</span>
              </label>
              <input id="courierName" name="courierName" maxLength={60} className={field} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="trackingNumber" className="text-sm font-bold">
                {t("tracking")}
              </label>
              <input id="trackingNumber" name="trackingNumber" required minLength={3} maxLength={60} autoComplete="off" className={field} />
            </div>
            <button type="submit" className="min-h-12 rounded-xl bg-brand font-bold text-ink">
              {t("markShipped")}
            </button>
          </form>
          {cancelButton(t("sellerCancel"))}
        </section>
      );
    }
    return (
      <section aria-labelledby="ship-title" className={card}>
        <h2 id="ship-title" className="text-base font-bold">
          {t("buyerRequestedTitle")}
        </h2>
        <p className="text-sm text-muted">{t("buyerRequestedBody", { amount })}</p>
        {address}
        {cancelButton(t("buyerCancel"))}
      </section>
    );
  }

  const courier = couriers.find((c) => c.key === s.courierKey);
  const trackingBox = (
    <div className="flex flex-col gap-1 rounded-xl bg-surface p-3 text-sm">
      <span className="text-muted">{s.courierName}</span>
      <span className="font-mono text-base font-bold tracking-wide select-all">{s.trackingNumber}</span>
      {courier?.url && (
        <a href={courier.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-strong underline">
          {t("trackOnSite")}
        </a>
      )}
    </div>
  );

  if (s.status === "shipped") {
    return (
      <section aria-labelledby="ship-title" className={card}>
        <h2 id="ship-title" className="text-base font-bold">
          {t("shippedTitle")}
        </h2>
        {trackingBox}
        {props.role === "buyer" ? (
          <>
            <p className="text-sm leading-relaxed">
              {t.rich("payOnDelivery", { amount, b: (c) => <strong>{c}</strong> })}{" "}
              {s.shippingPayer === "buyer" ? t("plusFee") : t("feePaid")}
            </p>
            <form action={markDeliveredAction}>
              {hidden}
              <button type="submit" className="min-h-12 w-full rounded-xl bg-brand font-bold text-ink">
                {t("markDelivered")}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">{t("sellerShippedBody", { amount })}</p>
            {cancelButton(t("returned"))}
          </>
        )}
      </section>
    );
  }

  // Teslim edildi
  return (
    <section aria-labelledby="ship-title" className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-4">
      <h2 id="ship-title" className="text-base font-bold text-[#166534]">
        ✓ {t("deliveredTitle")}
      </h2>
      <p className="text-sm text-muted">
        {s.courierName} · {s.trackingNumber} · {s.deliveredAt ? formatRelative(s.deliveredAt, loc) : ""}
      </p>
    </section>
  );
}
