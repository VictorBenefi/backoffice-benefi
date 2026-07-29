"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { updateDocumentReview } from "@/lib/merchant-documents";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10";

type ReviewStatus =
  | "pending"
  | "approved"
  | "observed";

type ReviewerCommentProps = {
  supabase: SupabaseClient;
  documentId: string;
  comment: string | null;
  reviewStatus: ReviewStatus;
  reviewedAt?: string | null;
  canReview: boolean;
  onSaved?: () => Promise<void> | void;
};

const reviewStatusLabels: Record<
  ReviewStatus,
  string
> = {
  pending: "Pendiente",
  approved: "Aprobado",
  observed: "Observado",
};

const reviewStatusClasses: Record<
  ReviewStatus,
  string
> = {
  pending:
    "border-amber-200 bg-amber-50 text-amber-700",
  approved:
    "border-emerald-200 bg-emerald-50 text-emerald-700",
  observed:
    "border-red-200 bg-red-50 text-red-700",
};

export default function ReviewerComment({
  supabase,
  documentId,
  comment,
  reviewStatus,
  reviewedAt,
  canReview,
  onSaved,
}: ReviewerCommentProps) {
  const [value, setValue] = useState(comment || "");
  const [savingStatus, setSavingStatus] =
    useState<"approved" | "observed" | null>(
      null
    );
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    setValue(comment || "");
  }, [comment]);

  const saveReview = async (
    status: "approved" | "observed"
  ) => {
    setMessage("");
    setIsError(false);

    if (
      status === "observed" &&
      !value.trim()
    ) {
      setIsError(true);
      setMessage(
        "Ingresá un comentario antes de observar el documento."
      );
      return;
    }

    setSavingStatus(status);

    try {
      await updateDocumentReview({
        supabase,
        documentId,
        status,
        comment: value,
      });

      if (status === "approved") {
        setValue("");
        }

      setMessage(
        status === "approved"
          ? "Documento aprobado correctamente."
          : "Documento observado correctamente."
      );

      await onSaved?.();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la revisión."
      );
    } finally {
      setSavingStatus(null);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Revisión del documento
        </p>

        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            reviewStatusClasses[reviewStatus]
          }`}
        >
          {reviewStatusLabels[reviewStatus]}
        </span>
      </div>

      {canReview ? (
        <>
          <label className="mt-4 block text-xs font-medium text-slate-700">
            Comentario del analista
          </label>

          <textarea
            value={value}
            onChange={(event) =>
              setValue(event.target.value)
            }
            className={`${inputClass} mt-2 min-h-24 resize-y`}
            placeholder="Ingresar comentario..."
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                saveReview("approved")
              }
              disabled={
                savingStatus !== null ||
                reviewStatus === "approved"
                }
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {savingStatus === "approved"
                ? "Aprobando..."
                : "Aprobar"}
            </button>

            <button
                type="button"
                onClick={() => saveReview("observed")}
                disabled={
                    savingStatus !== null ||
                    reviewStatus === "observed"
                }
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                {savingStatus === "observed"
                    ? "Observando..."
                    : reviewStatus === "observed"
                    ? "Observado"
                    : "Observar"}
            </button>
          </div>
        </>
      ) : (
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-500">
            Comentario del analista
          </p>

          <p className="mt-2 text-sm text-slate-700">
            {comment || "Sin comentarios."}
          </p>
        </div>
      )}

      {reviewedAt && (
        <p className="mt-3 text-xs text-slate-500">
          Última revisión:{" "}
          {new Date(reviewedAt).toLocaleString(
            "es-AR"
          )}
        </p>
      )}

      {message && (
        <p
          className={`mt-3 text-sm ${
            isError
              ? "text-red-600"
              : "text-emerald-700"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}