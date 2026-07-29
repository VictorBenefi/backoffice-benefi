"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import ReviewerComment from "@/components/documents/ReviewerComment";

import {
  formatDocumentDate,
  formatDocumentSize,
  getCurrentDocuments,
  openMerchantDocument,
  uploadMerchantDocument,
  validateMerchantDocumentFile,
  type MerchantDocument,
} from "@/lib/merchant-documents";

const reviewStatusLabels = {
  pending: "Pendiente",
  approved: "Aprobado",
  observed: "Observado",
} as const;

type DocumentFileType = {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  allows_multiple: boolean;
};

export type MerchantDocumentRequirement = {
  id: string;
  entity_type: string;
  file_type_id: string;
  is_required: boolean;
  allows_multiple: boolean;
  instructions: string | null;
  sort_order: number;
  file_type: DocumentFileType | null;
};

type DocumentUploadCardProps = {
  supabase: SupabaseClient;
  merchantId: string;
  requirement: MerchantDocumentRequirement;

  canReview: boolean;

  onDocumentChanged?: () => void | Promise<void>;
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10";

export default function DocumentUploadCard({
  supabase,
  merchantId,
  requirement,
  canReview,
  onDocumentChanged,
}: DocumentUploadCardProps) {
  const [documents, setDocuments] = useState<MerchantDocument[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [relatedPersonName, setRelatedPersonName] = useState("");
  const [relatedPersonDocument, setRelatedPersonDocument] =
    useState("");

  const [observations, setObservations] = useState("");

  const [reviewerComments, setReviewerComments] = useState<
  Record<string, string>
>({});

const [savingCommentId, setSavingCommentId] =
  useState<string | null>(null);

  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const fileType = requirement.file_type;

  const allowsMultiple =
    requirement.allows_multiple ||
    Boolean(fileType?.allows_multiple);

  const currentDocuments = useMemo(() => {
    return documents
      .filter(
        (document) =>
          document.file_type_id === requirement.file_type_id &&
          document.is_current
      )
      .sort((a, b) => {
        const firstDate = new Date(a.uploaded_at).getTime();
        const secondDate = new Date(b.uploaded_at).getTime();

        return secondDate - firstDate;
      });
  }, [documents, requirement.file_type_id]);

  const loadDocuments = useCallback(async () => {
    setLoadingDocuments(true);

    try {
      const result = await getCurrentDocuments(
        supabase,
        merchantId
      );

      setDocuments(result);
      setReviewerComments(
        Object.fromEntries(
          result.map((documentItem) => [
            documentItem.id,
            documentItem.reviewer_comment || "",
          ])
        )
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "No se pudo cargar el documento.";

      setIsError(true);
      setMessage(errorMessage);
    } finally {
      setLoadingDocuments(false);
    }
  }, [merchantId, supabase]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const clearUploadForm = () => {
    setSelectedFile(null);
    setObservations("");

    if (!allowsMultiple) {
      setRelatedPersonName("");
      setRelatedPersonDocument("");
    }

    const input = document.getElementById(
      `document-file-${requirement.id}`
    ) as HTMLInputElement | null;

    if (input) {
      input.value = "";
    }
  };

  const handleFileSelection = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0] || null;

    setMessage("");
    setIsError(false);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    try {
      validateMerchantDocumentFile(file);
      setSelectedFile(file);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "El archivo seleccionado no es válido.";

      setSelectedFile(null);
      setIsError(true);
      setMessage(errorMessage);
      event.target.value = "";
    }
  };

  const handleUpload = async () => {
    setMessage("");
    setIsError(false);

    if (!selectedFile) {
      setIsError(true);
      setMessage("Debés seleccionar un archivo.");
      return;
    }

    if (!fileType?.id || !fileType.code) {
      setIsError(true);
      setMessage(
        "El requisito documental no tiene un tipo de archivo válido."
      );
      return;
    }

    setUploading(true);

    try {
      const result = await uploadMerchantDocument({
        supabase,
        merchantId,
        fileTypeId: fileType.id,
        documentCode: fileType.code,
        file: selectedFile,
        allowsMultiple,
        relatedPersonName,
        relatedPersonDocument,
        observations,
      });

      setIsError(false);
      setMessage(
        `Documento cargado correctamente. Versión ${result.versionNumber}.`
      );

      clearUploadForm();
      await loadDocuments();
      await onDocumentChanged?.();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "No se pudo subir el documento.";

      setIsError(true);
      setMessage(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleOpenDocument = async (
    documentItem: MerchantDocument
  ) => {
    setMessage("");
    setIsError(false);
    setOpeningId(documentItem.id);

    try {
      await openMerchantDocument(
        supabase,
        documentItem.file_path
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "No se pudo abrir el documento.";

      setIsError(true);
      setMessage(errorMessage);
    } finally {
      setOpeningId(null);
    }
  };

  const hasDocuments = currentDocuments.length > 0;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium text-slate-950">
              {fileType?.name || "Documento"}
            </h4>

            {requirement.is_required && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                Obligatorio
              </span>
            )}

            {allowsMultiple && (
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700">
                Admite varios
              </span>
            )}
          </div>

          {requirement.instructions && (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {requirement.instructions}
            </p>
          )}
        </div>

        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            hasDocuments
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          {hasDocuments ? "Cargado" : "Pendiente"}
        </span>
      </div>

      {loadingDocuments ? (
        <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
          Cargando documentación...
        </div>
      ) : (
        <>
          {hasDocuments && (
            <div className="mt-4 space-y-3">
              {currentDocuments.map((documentItem) => (
                <div
                  key={documentItem.id}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-emerald-950">
                        {documentItem.file_name}
                      </p>

                      <div className="mt-2 grid gap-1 text-xs text-emerald-800 sm:grid-cols-2">
                        <p>
                          Versión:{" "}
                          <strong>
                            {documentItem.version_number}
                          </strong>
                        </p>

                        <p>
                          Tamaño:{" "}
                          <strong>
                            {formatDocumentSize(
                              documentItem.file_size
                            )}
                          </strong>
                        </p>

                        <p>
                          Subido:{" "}
                          <strong>
                            {formatDocumentDate(
                              documentItem.uploaded_at
                            )}
                          </strong>
                        </p>

                        
                      </div>

                      {(documentItem.related_person_name ||
                        documentItem.related_person_document) && (
                        <div className="mt-2 text-xs text-emerald-800">
                          <p>
                            Persona:{" "}
                            <strong>
                              {documentItem.related_person_name ||
                                "-"}
                            </strong>
                          </p>

                          <p>
                            Documento:{" "}
                            <strong>
                              {documentItem.related_person_document ||
                                "-"}
                            </strong>
                          </p>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleOpenDocument(documentItem)
                      }
                      disabled={openingId === documentItem.id}
                      className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60"
                    >
                      {openingId === documentItem.id
                        ? "Abriendo..."
                        : "Ver documento"}
                    </button>
                  </div>
                  <ReviewerComment
                    supabase={supabase}
                    documentId={documentItem.id}
                    comment={documentItem.reviewer_comment}
                    reviewStatus={
                      documentItem.review_status
                    }
                    reviewedAt={
                      documentItem.reviewed_at
                    }
                    canReview={canReview}
                    onSaved={async () => {
                      await loadDocuments();
                      await onDocumentChanged?.();
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
            <div>
              <p className="text-sm font-medium text-slate-800">
                {hasDocuments && !allowsMultiple
                  ? "Cargar una nueva versión"
                  : "Adjuntar documento"}
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Se aceptan archivos PDF, JPG, PNG o WEBP de hasta
                10 MB. Las versiones anteriores se conservarán.
              </p>
            </div>

            {allowsMultiple && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Persona relacionada
                  </label>

                  <input
                    type="text"
                    value={relatedPersonName}
                    onChange={(event) =>
                      setRelatedPersonName(event.target.value)
                    }
                    className={inputClass}
                    placeholder="Nombre y apellido"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    DNI o documento
                  </label>

                  <input
                    type="text"
                    value={relatedPersonDocument}
                    onChange={(event) =>
                      setRelatedPersonDocument(
                        event.target.value
                      )
                    }
                    className={inputClass}
                    placeholder="Ej: 25.123.456"
                  />
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Observaciones
              </label>

              <textarea
                value={observations}
                onChange={(event) =>
                  setObservations(event.target.value)
                }
                className={`${inputClass} min-h-20 resize-y`}
                placeholder="Información adicional sobre el documento..."
              />
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Archivo
              </label>

              <input
                id={`document-file-${requirement.id}`}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                onChange={handleFileSelection}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white"
              />
            </div>

            {selectedFile && (
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                <p className="font-medium">
                  Archivo seleccionado
                </p>

                <p className="mt-1 break-all">
                  {selectedFile.name}
                </p>

                <p className="mt-1">
                  Tamaño:{" "}
                  {formatDocumentSize(selectedFile.size)}
                </p>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 file:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading
                  ? "Subiendo..."
                  : hasDocuments && !allowsMultiple
                  ? "Subir nueva versión"
                  : "Subir documento"}
              </button>

              {selectedFile && (
                <button
                  type="button"
                  onClick={clearUploadForm}
                  disabled={uploading}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white disabled:opacity-50"
                >
                  Cancelar selección
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {message && (
        <div
          className={`mt-4 rounded-lg border px-3 py-2.5 text-sm ${
            isError
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {message}
        </div>
      )}
    </article>
  );
}