"use client";

import { MAX_PHOTOS_PER_LISTING } from "@ormaro/shared";
import { useTranslations } from "next-intl";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { CameraIcon, CloseIcon } from "@/components/icons";
import { compress, upload } from "@/lib/imageUpload";
import { createListingAction, type SellState, updateListingAction } from "./actions";

type Option = { value: string; label: string };
type Photo = { id: string; preview: string; key?: string; status: "uploading" | "done" | "error" };

const field =
  "h-12 w-full rounded-xl border border-field bg-white px-3.5 text-[15px] text-ink focus:border-brand-strong focus:outline-none";
const labelCls = "text-[15px] font-bold";

export function SellForm(props: {
  locale: string;
  defaultCity: string;
  categories: Option[];
  conditions: Option[];
  cities: Option[];
  languages: Option[];
  /** Düzenleme modunda ilanın mevcut değerleri ve fotoğrafları. */
  edit?: { listingId: string; values: Record<string, string>; photos: { key: string; src: string }[] };
}) {
  const t = useTranslations("sell");
  const editing = Boolean(props.edit);
  const [state, formAction, pending] = useActionState<SellState, FormData>(
    editing ? updateListingAction : createListingAction,
    {},
  );
  const [photos, setPhotos] = useState<Photo[]>(() =>
    (props.edit?.photos ?? []).map((p) => ({ id: p.key, preview: p.src, key: p.key, status: "done" as const })),
  );
  const [uploadError, setUploadError] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const f = state.fields ?? props.edit?.values ?? {};

  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state]);

  async function onFiles(files: FileList | null) {
    if (!files) return;
    setUploadError(false);
    const room = MAX_PHOTOS_PER_LISTING - photos.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    const added: Photo[] = picked.map((file) => ({
      id: crypto.randomUUID(),
      preview: URL.createObjectURL(file),
      status: "uploading",
    }));
    setPhotos((p) => [...p, ...added]);
    await Promise.all(
      picked.map(async (file, i) => {
        const id = added[i]!.id;
        try {
          const key = await upload(await compress(file));
          setPhotos((p) => p.map((x) => (x.id === id ? { ...x, key, status: "done" } : x)));
        } catch {
          setUploadError(true);
          setPhotos((p) => p.map((x) => (x.id === id ? { ...x, status: "error" } : x)));
        }
      }),
    );
    if (fileInput.current) fileInput.current.value = "";
  }

  function removePhoto(id: string) {
    setPhotos((p) => {
      const gone = p.find((x) => x.id === id);
      if (gone?.preview.startsWith("blob:")) URL.revokeObjectURL(gone.preview);
      return p.filter((x) => x.id !== id);
    });
  }

  function makeCover(id: string) {
    setPhotos((p) => {
      const chosen = p.find((x) => x.id === id);
      return chosen ? [chosen, ...p.filter((x) => x.id !== id)] : p;
    });
  }

  const uploading = photos.some((p) => p.status === "uploading");
  const keys = photos.filter((p) => p.status === "done" && p.key).map((p) => p.key!);

  return (
    <form
      // React, action'lı formları gönderimden sonra sıfırlar; hata durumunda kullanıcı
      // yazdıklarını kaybetmesin diye gönderimi elle yapıyoruz.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="flex flex-col gap-5 bg-white px-4 py-5"
    >
      <h1 className="text-xl font-bold">{editing ? t("editTitle") : t("title")}</h1>
      <input type="hidden" name="locale" value={props.locale} />
      {props.edit && <input type="hidden" name="listingId" value={props.edit.listingId} />}
      <input type="hidden" name="photos" value={JSON.stringify(keys)} />

      {state.error && (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-xl border border-[#F3B8A8] bg-[#FDF0EC] p-3 text-[15px] font-semibold text-[#9A2B12]"
        >
          {t(`errors.${state.error}`)}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className={labelCls}>{t("photos")}</h2>
          <span className="text-[13px] text-muted">
            {photos.length} / {MAX_PHOTOS_PER_LISTING}
          </span>
        </div>
        <p className="text-[13px] text-muted">{t("photosHint")}</p>
        <ul className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <li key={p.id} className="relative h-20 w-20 overflow-hidden rounded-xl bg-placeholder">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.preview}
                alt={i === 0 ? t("coverPhoto") : t("photoN", { n: i + 1 })}
                className={"h-full w-full object-cover " + (p.status === "done" ? "" : "opacity-50")}
              />
              {p.status === "uploading" && (
                <span className="absolute inset-x-0 bottom-0 bg-ink/70 py-0.5 text-center text-[11px] text-white">
                  {t("uploading")}
                </span>
              )}
              {p.status === "error" && (
                <span className="absolute inset-x-0 bottom-0 bg-[#9A2B12] py-0.5 text-center text-[11px] text-white">
                  {t("uploadFailedShort")}
                </span>
              )}
              {i === 0 && p.status === "done" && (
                <span className="absolute top-1 left-1 rounded bg-ink/75 px-1.5 text-[11px] font-semibold text-white">
                  {t("cover")}
                </span>
              )}
              {i > 0 && p.status === "done" && (
                <button
                  type="button"
                  onClick={() => makeCover(p.id)}
                  className="absolute inset-x-0 bottom-0 bg-ink/70 py-1 text-center text-[11px] font-semibold text-white"
                >
                  {t("makeCover")}
                </button>
              )}
              <button
                type="button"
                onClick={() => removePhoto(p.id)}
                aria-label={t("removePhoto")}
                className="absolute top-0 right-0 flex h-8 w-8 items-center justify-center rounded-bl-lg bg-white/90 text-ink"
              >
                <CloseIcon width={16} height={16} />
              </button>
            </li>
          ))}
          {photos.length < MAX_PHOTOS_PER_LISTING && (
            <li>
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-dashed border-brand-strong bg-brand-tint text-[11px] font-semibold text-brand-deep">
                <CameraIcon />
                {t("addPhoto")}
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => onFiles(e.currentTarget.files)}
                />
              </label>
            </li>
          )}
        </ul>
        {uploadError && <p className="text-[13px] font-semibold text-[#9A2B12]">{t("errors.uploadFailed")}</p>}
      </section>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className={labelCls}>
          {t("titleLabel")}
        </label>
        <input id="title" name="title" required minLength={3} maxLength={120} defaultValue={f.title} className={field} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="categoryKey" className={labelCls}>
          {t("categoryLabel")}
        </label>
        <select id="categoryKey" name="categoryKey" required defaultValue={f.categoryKey ?? ""} className={field}>
          <option value="" disabled>
            {t("choose")}
          </option>
          {props.categories.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${labelCls} mb-2`}>{t("conditionLabel")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {props.conditions.map((o) => (
            <label
              key={o.value}
              className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-field px-2 text-center text-sm font-semibold has-[:checked]:border-[1.5px] has-[:checked]:border-brand-strong has-[:checked]:bg-brand-tint has-[:checked]:text-brand-deep"
            >
              <input
                type="radio"
                name="condition"
                value={o.value}
                required
                defaultChecked={f.condition === o.value}
                className="sr-only"
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className={labelCls}>
          {t("descriptionLabel")} <span className="font-normal text-muted">{t("optional")}</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          maxLength={4000}
          defaultValue={f.description}
          className="rounded-xl border border-field px-3.5 py-3 text-[15px] leading-relaxed focus:border-brand-strong focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="price" className={labelCls}>
            {t("priceLabel")}
          </label>
          <input
            id="price"
            name="price"
            required
            inputMode="numeric"
            pattern="[0-9 .]*"
            defaultValue={f.price}
            className={field}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cityKey" className={labelCls}>
            {t("cityLabel")}
          </label>
          <select id="cityKey" name="cityKey" required defaultValue={f.cityKey ?? props.defaultCity} className={field}>
            <option value="" disabled>
              {t("choose")}
            </option>
            {props.cities.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${labelCls} mb-2`}>{t("shippingLabel")}</legend>
        {(["none", "buyer", "seller"] as const).map((o) => (
          <label
            key={o}
            className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-field px-3.5 py-3 has-[:checked]:border-[1.5px] has-[:checked]:border-brand-strong has-[:checked]:bg-brand-tint"
          >
            <input
              type="radio"
              name="shipping"
              value={o}
              defaultChecked={(f.shipping ?? "none") === o}
              className="mt-0.5 h-5 w-5 flex-none accent-[#c2410c]"
            />
            <span className="flex flex-col">
              <span className="text-[15px] font-semibold">{t(`shipping.${o}`)}</span>
              <span className="text-[13px] text-muted">{t(`shippingHint.${o}`)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="language" className={labelCls}>
          {t("languageLabel")}
        </label>
        <select id="language" name="language" defaultValue={f.language ?? props.locale} className={field}>
          {props.languages.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-[13px] text-muted">{t("languageHint")}</p>
      </div>

      <button
        type="submit"
        disabled={pending || uploading}
        className="min-h-13 rounded-xl bg-brand text-base font-bold text-ink disabled:opacity-60"
      >
        {pending ? t("submitting") : uploading ? t("waitUploads") : editing ? t("save") : t("submit")}
      </button>
    </form>
  );
}
