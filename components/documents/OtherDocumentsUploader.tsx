"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  formatDocumentDate,
  formatDocumentSize,
  getCurrentDocuments,
  openMerchantDocument,
  uploadMerchantDocument,
  validateMerchantDocumentFile,
  type MerchantDocument,
} from "@/lib/merchant-documents";

type OtherDocumentsUploaderProps = {
  supabase: SupabaseClient;
  merchantId: string;
  onDocumentChanged?: () => void | Promise<void>;
};

type OtherFileType = {
  id: string;
  code: string;
  name: string;
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10";

export default function OtherDocumentsUploader({
  supabase,
  merchantId,
  onDocumentChanged,
}: OtherDocumentsUploaderProps) {
  const [fileType, setFileType] = useState<OtherFileType | null>(null);
  const [documents, setDocuments] = useState<MerchantDocument[]>([]);

  const [title, setTitle] = useState("");
  const [observations, setObservations] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const { data: typeData, error: typeError } = await supabase
        .from("merchant_file_types")
        .select("id, code, name")
        .eq("code", "other")
        .eq("is_active", true)
        .maybeSingle();

      if (typeError) {
        throw new Error(
          `No se pudo obtener el tipo documental Otros: ${typeError.message}`
        );
      }

      if (!typeData) {
        throw new Error(
          'No existe un tipo documental activo con código "other".'
        );
      }

      setFileType(typeData);

      const currentDocuments = await getCurrentDocuments(
        supabase,
        merchantId
      );

      setDocuments(
        currentDocuments
          .filter(
            (document) =>
              document.file_type_id === typeData.id &&
              document.is_current
          )
          .sort(
            (a, b) =>
              new Date(b.uploaded_at).getTime() -
              new Date(a.uploaded_at).getTime()
          )
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los documentos adicionales.";

      setIsError(true);
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [merchantId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const clearForm = () => {
    setTitle("");
    setObservations("");
    setSelectedFile(null);

    const input = document.getElementById(
      "other-document-file"
    ) as HTMLInputElement | null;

    if (input) {
      input.value = "";
    }
  };

  const handleFileSelection = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setMessage("");
    setIsError(false);

    const file = event.target.files?.[0] || null;

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

    const normalizedTitle = title.trim();

    if (!normalizedTitle) {
      setIsError(true);
      setMessage("Debés ingresar el título del documento.");
      return;
    }

    if (!selectedFile) {
      setIsError(true);
      setMessage("Debés seleccionar un archivo.");
      return;
    }

    if (!fileType) {
      setIsError(true);
      setMessage("No se pudo identificar el tipo documental.");
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

        /*
         * El título funciona como identificador independiente.
         * Si se vuelve a cargar usando el mismo título,
         * se genera una nueva versión de ese documento.
         */
        allowsMultiple: true,
        relatedPersonName: normalizedTitle,
        observations,
      });

      setIsError(false);
      setMessage(
        `Documento cargado correctamente. Versión ${result.versionNumber}.`
      );

      clearForm();
      await loadData();
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

  const handleOpen = async (documentItem: MerchantDocument) => {
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

  return (
    <section className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
      <div>
        <h4 className="font-semibold text-slate-950">
          Otros documentos
        </h4>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Adjuntá documentación adicional que no corresponda a los
          requisitos obligatorios.
        </p>
      </div>

      {loading ? (
        <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
          Cargando documentos adicionales...
        </div>
      ) : (
        <>
          {documents.length > 0 && (
            <div className="mt-4 space-y-3">
              {documents.map((documentItem) => (
                <div
                  key={documentItem.id}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-emerald-950">
                        {documentItem.related_person_name ||
                          documentItem.file_name}
                      </p>

                      <p className="mt-1 break-all text-xs text-emerald-800">
                        Archivo: {documentItem.file_name}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-emerald-800">
                        <span>
                          Versión:{" "}
                          <strong>
                            {documentItem.version_number}
                          </strong>
                        </span>

                        <span>
                          Tamaño:{" "}
                          <strong>
                            {formatDocumentSize(
                              documentItem.file_size
                            )}
                          </strong>
                        </span>

                        <span>
                          Subido:{" "}
                          <strong>
                            {formatDocumentDate(
                              documentItem.uploaded_at
                            )}
                          </strong>
                        </span>
                      </div>

                      {documentItem.observations && (
                        <p className="mt-2 text-sm text-emerald-900">
                          {documentItem.observations}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpen(documentItem)}
                      disabled={openingId === documentItem.id}
                      className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                    >
                      {openingId === documentItem.id
                        ? "Abriendo..."
                        : "Ver documento"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Título del documento *
              </label>

              <input
                type="text"
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                className={inputClass}
                placeholder="Ej: Habilitación municipal"
              />
            </div>

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
                Archivo *
              </label>

              <input
                id="other-document-file"
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
                disabled={
                  uploading ||
                  !selectedFile ||
                  !title.trim()
                }
                className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 file:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading
                  ? "Subiendo..."
                  : "Subir documento"}
              </button>

              {(selectedFile || title || observations) && (
                <button
                  type="button"
                  onClick={clearForm}
                  disabled={uploading}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium file:cursor-pointer text-slate-700 hover:bg-white disabled:opacity-50"
                >
                  Limpiar
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
    </section>
  );
}