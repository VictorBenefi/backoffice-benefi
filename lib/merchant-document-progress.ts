export type ProgressRequirement = {
  id: string;
  entity_type: string;
  file_type_id: string;
  is_required: boolean;
  file_type?: {
    code?: string | null;
  } | null;
};

export type ProgressDocument = {
  merchant_id: string;
  file_type_id: string;
  is_current: boolean;
  review_status:
    | "pending"
    | "approved"
    | "observed"
    | null;
};

export type MerchantDocumentProgress = {
  uploaded: number;
  totalRequired: number;
  pending: number;
  percentage: number;
  isComplete: boolean;
};

export function calculateMerchantDocumentProgress({
  merchantId,
  entityType,
  requirements,
  documents,
}: {
  merchantId: string;
  entityType: string | null;
  requirements: ProgressRequirement[];
  documents: ProgressDocument[];
}): MerchantDocumentProgress {
  if (!entityType) {
    return {
      uploaded: 0,
      totalRequired: 0,
      pending: 0,
      percentage: 0,
      isComplete: false,
    };
  }

  const requiredRequirements = requirements.filter(
    (requirement) =>
      requirement.entity_type === entityType &&
      requirement.is_required &&
      requirement.file_type?.code !== "other"
  );

  const totalRequired = requiredRequirements.length;

  if (totalRequired === 0) {
    return {
      uploaded: 0,
      totalRequired: 0,
      pending: 0,
      percentage: 0,
      isComplete: false,
    };
  }

  const currentFileTypeIds = new Set(
    documents
      .filter(
        (document) =>
          document.merchant_id === merchantId &&
          document.is_current
      )
      .map((document) => document.file_type_id)
  );

  const uploaded = requiredRequirements.filter((requirement) =>
    currentFileTypeIds.has(requirement.file_type_id)
  ).length;

  const pending = Math.max(totalRequired - uploaded, 0);

  const percentage = Math.round(
    (uploaded / totalRequired) * 100
  );

  return {
    uploaded,
    totalRequired,
    pending,
    percentage,
    isComplete: uploaded === totalRequired,
  };
}