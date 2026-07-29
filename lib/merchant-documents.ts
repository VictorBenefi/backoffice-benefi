import type { SupabaseClient } from "@supabase/supabase-js";

export const MERCHANT_DOCUMENTS_BUCKET = "merchant-documents";
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export type MerchantDocument = {
  id: string;
  merchant_id: string;
  file_type_id: string;

  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;

  related_person_name: string | null;
  related_person_document: string | null;

  issue_date: string | null;
  expiration_date: string | null;

  status: string;
  observations: string | null;

  version_number: number;
  is_current: boolean;

  uploaded_by: string | null;
  uploaded_at: string;

  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_comment: string | null;
  review_status:
  | "pending"
  | "approved"
  | "observed";

  created_at: string;
  updated_at: string;
};

export type UploadMerchantDocumentParams = {
  supabase: SupabaseClient;
  merchantId: string;
  fileTypeId: string;
  documentCode: string;
  file: File;

  allowsMultiple?: boolean;

  relatedPersonName?: string;
  relatedPersonDocument?: string;

  issueDate?: string;
  expirationDate?: string;
  observations?: string;
};

export type UploadMerchantDocumentResult = {
  document: MerchantDocument;
  versionNumber: number;
};

function normalizeNullableText(value?: string) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function sanitizePathSegment(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function sanitizeFileName(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");

  const baseName =
    lastDotIndex >= 0
      ? fileName.slice(0, lastDotIndex)
      : fileName;

  const extension =
    lastDotIndex >= 0
      ? fileName.slice(lastDotIndex + 1)
      : "";

  const safeBase =
    sanitizePathSegment(baseName) || "documento";

  const safeExtension = sanitizePathSegment(extension);

  return safeExtension
    ? `${safeBase}.${safeExtension}`
    : safeBase;
}

function validateUuid(value: string, fieldName: string) {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(value)) {
    throw new Error(`${fieldName} no es válido.`);
  }
}

export function validateMerchantDocumentFile(file: File) {
  if (!file) {
    throw new Error("Debés seleccionar un archivo.");
  }

  if (file.size <= 0) {
    throw new Error("El archivo seleccionado está vacío.");
  }

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error(
      "El archivo supera el tamaño máximo permitido de 10 MB."
    );
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(
      "Formato no permitido. Solo se aceptan PDF, JPG, PNG o WEBP."
    );
  }
}

export async function getCurrentDocuments(
  supabase: SupabaseClient,
  merchantId: string
): Promise<MerchantDocument[]> {
  validateUuid(merchantId, "El comercio");

  const { data, error } = await supabase
    .from("merchant_files")
    .select("*")
    .eq("merchant_id", merchantId)
    .eq("is_current", true)
    .order("uploaded_at", { ascending: false });

  if (error) {
    throw new Error(
      `No se pudieron cargar los documentos: ${error.message}`
    );
  }

  return (data || []) as MerchantDocument[];
}

export async function getCurrentDocument(
  supabase: SupabaseClient,
  merchantId: string,
  fileTypeId: string
): Promise<MerchantDocument | null> {
  validateUuid(merchantId, "El comercio");
  validateUuid(fileTypeId, "El tipo de documento");

  const { data, error } = await supabase
    .from("merchant_files")
    .select("*")
    .eq("merchant_id", merchantId)
    .eq("file_type_id", fileTypeId)
    .eq("is_current", true)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudo obtener el documento vigente: ${error.message}`
    );
  }

  return (data as MerchantDocument | null) || null;
}

export async function getDocumentHistory(
  supabase: SupabaseClient,
  merchantId: string,
  fileTypeId: string
): Promise<MerchantDocument[]> {
  validateUuid(merchantId, "El comercio");
  validateUuid(fileTypeId, "El tipo de documento");

  const { data, error } = await supabase
    .from("merchant_files")
    .select("*")
    .eq("merchant_id", merchantId)
    .eq("file_type_id", fileTypeId)
    .order("version_number", { ascending: false });

  if (error) {
    throw new Error(
      `No se pudo cargar el historial: ${error.message}`
    );
  }

  return (data || []) as MerchantDocument[];
}

export async function uploadMerchantDocument({
  supabase,
  merchantId,
  fileTypeId,
  documentCode,
  file,
  allowsMultiple = false,
  relatedPersonName,
  relatedPersonDocument,
  issueDate,
  expirationDate,
  observations,
}: UploadMerchantDocumentParams): Promise<UploadMerchantDocumentResult> {
  validateUuid(merchantId, "El comercio");
  validateUuid(fileTypeId, "El tipo de documento");
  validateMerchantDocumentFile(file);

  const safeDocumentCode =
    sanitizePathSegment(documentCode) || "documento";

  const normalizedRelatedPersonName =
    normalizeNullableText(relatedPersonName);

  const normalizedRelatedPersonDocument =
    normalizeNullableText(relatedPersonDocument);

  if (
    allowsMultiple &&
    !normalizedRelatedPersonName &&
    !normalizedRelatedPersonDocument
  ) {
    throw new Error(
      "Para este documento debés indicar la persona relacionada o su documento."
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error(
      "La sesión no es válida. Volvé a iniciar sesión."
    );
  }

  let versionQuery = supabase
    .from("merchant_files")
    .select("id, version_number, is_current")
    .eq("merchant_id", merchantId)
    .eq("file_type_id", fileTypeId)
    .order("version_number", { ascending: false })
    .limit(1);

  if (allowsMultiple) {
    if (normalizedRelatedPersonDocument) {
      versionQuery = versionQuery.eq(
        "related_person_document",
        normalizedRelatedPersonDocument
      );
    } else {
      versionQuery = versionQuery.eq(
        "related_person_name",
        normalizedRelatedPersonName
      );
    }
  }

  const {
    data: latestVersion,
    error: latestVersionError,
  } = await versionQuery.maybeSingle();

  if (latestVersionError) {
    throw new Error(
      `No se pudo determinar la versión del documento: ${latestVersionError.message}`
    );
  }

  const nextVersion =
    Number(latestVersion?.version_number || 0) + 1;

  const safeOriginalFileName = sanitizeFileName(file.name);
  const timestamp = Date.now();

  const personFolder = allowsMultiple
    ? sanitizePathSegment(
        normalizedRelatedPersonDocument ||
          normalizedRelatedPersonName ||
          "persona"
      )
    : null;

  const storageFolder = personFolder
    ? `${merchantId}/${safeDocumentCode}/${personFolder}`
    : `${merchantId}/${safeDocumentCode}`;

  const storagePath =
    `${storageFolder}/v${nextVersion}-${timestamp}-${safeOriginalFileName}`;

  const { error: storageError } = await supabase.storage
    .from(MERCHANT_DOCUMENTS_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (storageError) {
    throw new Error(
      `No se pudo subir el archivo: ${storageError.message}`
    );
  }

  const insertPayload = {
  merchant_id: merchantId,
  file_type_id: fileTypeId,

  file_name: file.name,
  file_path: storagePath,
  mime_type: file.type || null,
  file_size: file.size,

  related_person_name: normalizedRelatedPersonName,
  related_person_document:
    normalizedRelatedPersonDocument,

  issue_date: issueDate || null,
  expiration_date: expirationDate || null,

  observations: normalizeNullableText(observations),

  status: "pending",
  review_status: "pending",
  reviewer_comment: null,
  reviewed_by: null,
  reviewed_at: null,

  version_number: nextVersion,
  is_current: false,

  uploaded_by: user.id,
};

  const { data: insertedDocument, error: insertError } =
    await supabase
      .from("merchant_files")
      .insert(insertPayload)
      .select("*")
      .single();

  if (insertError || !insertedDocument) {
    throw new Error(
      `El archivo se subió, pero no pudo registrarse en el legajo: ${
        insertError?.message || "Error desconocido"
      }`
    );
  }

  let deactivateQuery = supabase
    .from("merchant_files")
    .update({
      is_current: false,
      updated_at: new Date().toISOString(),
    })
    .eq("merchant_id", merchantId)
    .eq("file_type_id", fileTypeId)
    .neq("id", insertedDocument.id)
    .eq("is_current", true);

  if (allowsMultiple) {
    if (normalizedRelatedPersonDocument) {
      deactivateQuery = deactivateQuery.eq(
        "related_person_document",
        normalizedRelatedPersonDocument
      );
    } else {
      deactivateQuery = deactivateQuery.eq(
        "related_person_name",
        normalizedRelatedPersonName
      );
    }
  }

  const { error: deactivateError } = await deactivateQuery;

  if (deactivateError) {
    throw new Error(
      `El documento fue cargado, pero no se pudo actualizar el historial: ${deactivateError.message}`
    );
  }

  const { data: currentDocument, error: currentError } =
    await supabase
      .from("merchant_files")
      .update({
        is_current: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", insertedDocument.id)
      .select("*")
      .single();

  if (currentError || !currentDocument) {
    if (latestVersion?.id) {
      await supabase
        .from("merchant_files")
        .update({
          is_current: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", latestVersion.id);
    }

    throw new Error(
      `El documento se registró, pero no pudo marcarse como vigente: ${
        currentError?.message || "Error desconocido"
      }`
    );
  }

  return {
    document: currentDocument as MerchantDocument,
    versionNumber: nextVersion,
  };
}

export async function createMerchantDocumentSignedUrl(
  supabase: SupabaseClient,
  filePath: string,
  expiresInSeconds = 300
): Promise<string> {
  if (!filePath.trim()) {
    throw new Error("La ruta del documento no es válida.");
  }

  const { data, error } = await supabase.storage
    .from(MERCHANT_DOCUMENTS_BUCKET)
    .createSignedUrl(filePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(
      `No se pudo abrir el documento: ${
        error?.message || "Error desconocido"
      }`
    );
  }

  return data.signedUrl;
}

export async function openMerchantDocument(
  supabase: SupabaseClient,
  filePath: string
) {
  const signedUrl =
    await createMerchantDocumentSignedUrl(
      supabase,
      filePath,
      300
    );

  window.open(
    signedUrl,
    "_blank",
    "noopener,noreferrer"
  );
}

export function formatDocumentSize(
  bytes: number | null
) {
  if (!bytes || bytes <= 0) return "-";

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDocumentDate(
  value: string | null
) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export async function updateReviewerComment({
  supabase,
  documentId,
  comment,
}: {
  supabase: SupabaseClient;
  documentId: string;
  comment: string;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Sesión inválida.");
  }

  const { error } = await supabase
    .from("merchant_files")
    .update({
      review_status: status,
      reviewer_comment:
        status === "observed"
          ? comment.trim()
          : null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateDocumentReview({
  supabase,
  documentId,
  status,
  comment,
}: {
  supabase: SupabaseClient;
  documentId: string;
  status: "approved" | "observed";
  comment: string;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Sesión inválida.");
  }

  if (
    status === "observed" &&
    !comment.trim()
  ) {
    throw new Error(
      "Debés ingresar un comentario para observar el documento."
    );
  }

  const { error } = await supabase
    .from("merchant_files")
    .update({
      review_status: status,
      reviewer_comment:
        comment.trim() || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  if (error) {
    throw new Error(error.message);
  }
}