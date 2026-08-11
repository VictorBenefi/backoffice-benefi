"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DocumentUploadCard from "@/components/documents/DocumentUploadCard";
import OtherDocumentsUploader from "@/components/documents/OtherDocumentsUploader";
import DocumentProgress from "@/components/documents/DocumentProgress";

import {
  calculateMerchantDocumentProgress,
  type ProgressDocument,
} from "@/lib/merchant-document-progress";

type UserRole =
  | "admin"
  | "supervisor"
  | "operaciones"
  | "vendedor"
  | "soporte"
  | null;

type Vendor = {
  id: string;
  name: string | null;
  auth_user_id?: string | null;
};

type Merchant = {
  id: string;
  name: string | null;
  legal_name: string | null;
  email: string | null;
  cuit: string | null;
  phone: string | null;
  address: string | null;
  zone: string | null;

  activity: string | null;
  tax_condition: string | null;
  street: string | null;
  street_number: string | null;
  floor: string | null;
  apartment: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;

  entity_type: string | null;
  representative_name: string | null;
  representative_first_name: string | null;
  representative_last_name: string | null;
  representative_phone: string | null;
  representative_document: string | null;
  representative_cuit: string | null;
  representative_birth_date: string | null;
  representative_email: string | null;
  representative_role: string | null;
  bank_name: string | null;
  bank_account_holder: string | null;
  bank_account_type: string | null;
  bank_cbu: string | null;
  bank_alias: string | null;

  contracted_services: string[] | null;
  assumes_installment_financial_cost: boolean | null;
debit_settlement_days: number | null;

  documentation_status: string | null;
  onboarding_status: string | null;

  vendor_id: string | null;
  created_at: string;
};

type FileType = {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  allows_multiple: boolean;
};

type DocumentRequirement = {
  id: string;
  entity_type: string;
  file_type_id: string;
  is_required: boolean;
  allows_multiple: boolean;
  instructions: string | null;
  sort_order: number;
  file_type: FileType | null;
};

type FormData = {
  name: string;
  legal_name: string;
  email: string;
  cuit: string;
  phone: string;
  address: string;
  zone: string;

  activity: string;
  tax_condition: string;
  street: string;
  street_number: string;
  floor: string;
  apartment: string;
  postal_code: string;
  city: string;
  province: string;

  entity_type: string;
  representative_name: string;
  representative_first_name: string;
  representative_last_name: string;
  representative_phone: string;
  representative_cuit: string;
  representative_birth_date: string;
  representative_email: string;
  representative_role: string;
  bank_name: string;
  bank_account_holder: string;
  bank_account_type: string;
  bank_cbu: string;
  bank_alias: string;

  contracted_services: string[];
  assumes_installment_financial_cost: string;
debit_settlement_days: string;

  vendor_id: string;
};

const emptyForm: FormData = {
  name: "",
  legal_name: "",
  email: "",
  cuit: "",
  phone: "",
  address: "",
  zone: "",

  activity: "",
  tax_condition: "",
  street: "",
  street_number: "",
  floor: "",
  apartment: "",
  postal_code: "",
  city: "",
  province: "",

  entity_type: "",
  representative_name: "",
  representative_first_name: "",
  representative_last_name: "",
  representative_phone: "",
    representative_cuit: "",
  representative_birth_date: "",
  representative_email: "",
  representative_role: "",

  bank_name: "",
  bank_account_holder: "",
  bank_cbu: "",
  bank_alias: "",
  bank_account_type: "",

  contracted_services: [],
  assumes_installment_financial_cost: "",
debit_settlement_days: "",

  vendor_id: "",
};

const managementRoles: UserRole[] = [
  "admin",
  "supervisor",
  "operaciones",
];

const serviceOptions = [
  {
    value: "payment_processing",
    label: "Procesamiento de pagos",
    description:
      "Cobros con tarjeta, QR y otros medios de pago desde el POS BENEFI.",
  },
  {
    value: "benefits_program",
    label: "Programa de beneficios",
    description:
      "Programa de puntos, descuentos, promociones o cupones para clientes.",
  },
  {
    value: "white_label_app",
    label: "App marca blanca",
    description:
      "Aplicación móvil personalizada con la identidad del comercio o marca.",
  },
  {
    value: "white_label_web",
    label: "App marca blanca web",
    description:
      "Portal web personalizado para clientes, beneficios y promociones.",
  },
];


const provinceOptions = [
  "Buenos Aires",
  "Ciudad Autónoma de Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];

const taxConditionOptions = [
  "Responsable inscripto",
  "Monotributista",
  "Exento",
  "Consumidor final",
  "No responsable",
];

const categoryLabels: Record<string, string> = {
  legal: "Documentación legal",
  identification: "Identificación",
  tax: "Documentación impositiva",
  banking: "Documentación bancaria",
  affidavit: "Declaraciones juradas",
  commercial: "Documentación comercial",
  installation: "Instalación",
  other: "Otros",
};

const documentationStatusLabels: Record<string, string> = {
  incomplete: "Incompleta",
  pending_review: "En revisión",
  complete: "Completa",
  observed: "Observada",
  expired: "Vencida",
};

const onboardingStatusLabels: Record<string, string> = {
  draft: "Borrador",
  documentation_pending: "Documentación pendiente",
  under_review: "En revisión",
  ready_for_installation: "Listo para instalación",
  active: "Activo",
  inactive: "Inactivo",
};

function nullableText(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

export default function ComerciosPage() {
  const supabase = useMemo(() => createClient(), []);

  const [formData, setFormData] = useState<FormData>(emptyForm);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [currentMerchantFiles, setCurrentMerchantFiles] = useState<ProgressDocument[]>([]);

  const [currentRole, setCurrentRole] = useState<UserRole>(null);
  const [currentVendor, setCurrentVendor] = useState<Vendor | null>(null);

  const [loadingInitialData, setLoadingInitialData] = useState(true);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedMerchantId, setSavedMerchantId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [showInstallmentPlansModal, setShowInstallmentPlansModal] =
  useState(false);

  const [merchantToDelete, setMerchantToDelete] =
  useState<string | null>(null);

  const isVendorUser = currentRole === "vendedor";
  const canSelectVendor = managementRoles.includes(currentRole);

  const [activeInstallmentSettingId, setActiveInstallmentSettingId] =
  useState<string | null>(null);

  const [activeInstallmentPeriod, setActiveInstallmentPeriod] =
    useState("");

  const [activeInstallmentRates, setActiveInstallmentRates] =
    useState<
      {
        installments: number;
        financial_cost_rate: number;
        is_enabled: boolean;
      }[]
    >([]);

  const getInitialForm = (vendor?: Vendor | null): FormData => ({
    ...emptyForm,
    vendor_id: vendor?.id || "",
  });

  const loadSessionAndRole = async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("No se pudo identificar al usuario autenticado.");
    }

    const { data: appUser, error: appUserError } = await supabase
      .from("app_users")
      .select("role, is_active, auth_user_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (appUserError) {
      throw new Error(
        `No se pudo obtener el rol del usuario: ${appUserError.message}`
      );
    }

    if (!appUser || !appUser.is_active) {
      throw new Error("El usuario no está habilitado.");
    }

    const role = String(appUser.role || "")
      .trim()
      .toLowerCase() as UserRole;

    setCurrentRole(role);

    if (role === "vendedor") {
      const { data: vendor, error: vendorError } = await supabase
        .from("vendors")
        .select("id, name, auth_user_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (vendorError) {
        throw new Error(
          `No se pudo identificar al vendedor: ${vendorError.message}`
        );
      }

      if (!vendor) {
        throw new Error(
          "Tu usuario no está vinculado a un vendedor. Revisá la configuración en el módulo Vendedores."
        );
      }

      setCurrentVendor(vendor);
      setFormData(getInitialForm(vendor));
    }
  };

  const loadVendors = async () => {
    const { data, error } = await supabase
      .from("vendors")
      .select("id, name, auth_user_id")
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`Error al cargar vendedores: ${error.message}`);
    }

    setVendors(data || []);
  };

  const loadMerchants = async () => {
    const { data, error } = await supabase
      .from("merchants")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Error al cargar comercios: ${error.message}`);
    }

    setMerchants((data || []) as Merchant[]);
  };

  const loadRequirements = async () => {
    const { data, error } = await supabase
      .from("merchant_document_requirements")
      .select(`
        id,
        entity_type,
        file_type_id,
        is_required,
        allows_multiple,
        instructions,
        sort_order,
        file_type:merchant_file_types (
          id,
          code,
          name,
          category,
          description,
          allows_multiple
        )
      `)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      throw new Error(
        `Error al cargar requisitos documentales: ${error.message}`
      );
    }

    const normalized = (data || []).map((item: any) => ({
      ...item,
      file_type: Array.isArray(item.file_type)
        ? item.file_type[0] || null
        : item.file_type || null,
    }));

    setRequirements(normalized);
  };

  const loadCurrentMerchantFiles = async () => {
    const { data, error } = await supabase
      .from("merchant_files")
      .select(
        "merchant_id, file_type_id, is_current, review_status"
      )
      .eq("is_current", true);

    if (error) {
      throw new Error(
        `Error al cargar el progreso documental: ${error.message}`
      );
    }

    const files = (data || []) as ProgressDocument[];

    setCurrentMerchantFiles(files);

    return files;
  };

  const loadActiveInstallmentPlans = async () => {
  const { data: setting, error: settingError } =
    await supabase
      .from("installment_plan_settings")
      .select("id, provider, year, month")
      .eq("provider", "PRISMA")
      .eq("is_active", true)
      .maybeSingle();

  if (settingError) {
    throw new Error(
      `Error al cargar la configuración de cuotas: ${settingError.message}`
    );
  }

  if (!setting) {
    setActiveInstallmentSettingId(null);
    setActiveInstallmentPeriod("");
    setActiveInstallmentRates([]);
    return;
  }

  const { data: rates, error: ratesError } =
    await supabase
      .from("installment_plan_rates")
      .select(
        "installments, financial_cost_rate, is_enabled"
      )
      .eq("setting_id", setting.id)
      .eq("is_enabled", true)
      .order("installments", {
        ascending: true,
      });

  if (ratesError) {
    throw new Error(
      `Error al cargar los porcentajes de cuotas: ${ratesError.message}`
    );
  }

  const monthName = new Intl.DateTimeFormat(
    "es-AR",
    { month: "long" }
  ).format(
    new Date(setting.year, setting.month - 1, 1)
  );

  setActiveInstallmentSettingId(setting.id);

  setActiveInstallmentPeriod(
    `${setting.provider} · ${
      monthName.charAt(0).toUpperCase() +
      monthName.slice(1)
    } ${setting.year}`
  );

  setActiveInstallmentRates(
    (rates || []).map((rate) => ({
      installments: Number(rate.installments),
      financial_cost_rate: Number(
        rate.financial_cost_rate
      ),
      is_enabled: Boolean(rate.is_enabled),
    }))
  );
};

  const syncMerchantDocumentationStatus = async (
  merchantId: string
) => {
  const merchant = merchants.find(
    (item) => item.id === merchantId
  );

  if (!merchant) {
    return;
  }

  const { data: currentFiles, error: filesError } =
    await supabase
      .from("merchant_files")
      .select("merchant_id, file_type_id, is_current")
      .eq("merchant_id", merchantId)
      .eq("is_current", true);

  if (filesError) {
    throw new Error(
      `No se pudo verificar el legajo documental: ${filesError.message}`
    );
  }

  const progress = calculateMerchantDocumentProgress({
      merchantId,
      entityType: merchant.entity_type,
      requirements,
      documents: (currentFiles || []) as ProgressDocument[],
    });

    const documentationStatus =
      progress.totalRequired > 0 && progress.isComplete
        ? "complete"
        : "incomplete";

    const { error: updateError } = await supabase
      .from("merchants")
      .update({
        documentation_status: documentationStatus,
      })
      .eq("id", merchantId);

    if (updateError) {
      throw new Error(
        `No se pudo actualizar el estado documental: ${updateError.message}`
      );
    }
  };

const refreshMerchantDocumentation = async (
  merchantId: string
) => {
  try {
    const currentFiles =
      await loadCurrentMerchantFiles();

    const currentMerchant = merchants.find(
      (merchant) => merchant.id === merchantId
    );

    if (!currentMerchant) {
      return;
    }

    const progress =
      calculateMerchantDocumentProgress({
        merchantId,
        entityType: currentMerchant.entity_type,
        requirements: visibleRequirements,
        documents: currentFiles,
      });

    const merchantCurrentFiles =
      currentFiles.filter(
        (file) =>
          file.merchant_id === merchantId &&
          file.is_current
      );

    const requiredFileTypeIds = new Set(
      visibleRequirements
        .filter(
          (requirement) =>
            requirement.is_required
        )
        .map(
          (requirement) =>
            requirement.file_type_id
        )
    );

    const approvedRequiredFileTypeIds =
      new Set(
        merchantCurrentFiles
          .filter(
            (file) =>
              file.review_status ===
                "approved" &&
              requiredFileTypeIds.has(
                file.file_type_id
              )
          )
          .map(
            (file) => file.file_type_id
          )
      );

    const allRequiredDocumentsApproved =
      requiredFileTypeIds.size > 0 &&
      approvedRequiredFileTypeIds.size ===
        requiredFileTypeIds.size;

    const nextDocumentationStatus =
      progress.isComplete
        ? "complete"
        : "incomplete";

    let nextOnboardingStatus:
      | "documentation_pending"
      | "under_review"
      | "ready_for_installation";

    if (!progress.isComplete) {
      nextOnboardingStatus =
        "documentation_pending";
    } else if (
      allRequiredDocumentsApproved
    ) {
      nextOnboardingStatus =
        "ready_for_installation";
    } else {
      nextOnboardingStatus =
        "under_review";
    }

    const { error } = await supabase
      .from("merchants")
      .update({
        documentation_status:
          nextDocumentationStatus,
        onboarding_status:
          nextOnboardingStatus,
      })
      .eq("id", merchantId);

    if (error) {
      throw error;
    }

    await Promise.all([
      loadMerchants(),
      loadCurrentMerchantFiles(),
    ]);
  } catch (error) {
    console.error(
      "Error actualizando el estado documental:",
      error
    );

    setMessage(
      error instanceof Error
        ? error.message
        : "No se pudo actualizar el estado documental."
    );
  }
};

  const loadInitialData = async () => {
    setLoadingInitialData(true);
    setMessage("");

    try {
      await loadSessionAndRole();

      await Promise.all([
        loadVendors(),
        loadMerchants(),
        loadRequirements(),
        loadCurrentMerchantFiles(),
        loadActiveInstallmentPlans(),
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Ocurrió un error al cargar la pantalla.";

      console.error(error);
      setMessage(errorMessage);
    } finally {
      setLoadingInitialData(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const visibleRequirements = useMemo(() => {
    if (!formData.entity_type) return [];

    return requirements.filter(
      (requirement) =>
        requirement.entity_type === formData.entity_type
    );
  }, [requirements, formData.entity_type]);

  const merchantProgressMap = useMemo(() => {
    const progressMap = new Map<
      string,
      ReturnType<typeof calculateMerchantDocumentProgress>
    >();

    merchants.forEach((merchant) => {
      progressMap.set(
        merchant.id,
        calculateMerchantDocumentProgress({
          merchantId: merchant.id,
          entityType: merchant.entity_type,
          requirements,
          documents: currentMerchantFiles,
        })
      );
    });

    return progressMap;
  }, [
    merchants,
    requirements,
    currentMerchantFiles,
  ]);

  const selectedMerchantProgress = useMemo(() => {
    if (!savedMerchantId) {
      return {
        uploaded: 0,
        totalRequired: 0,
        pending: 0,
        percentage: 0,
        isComplete: false,
      };
    }

    return calculateMerchantDocumentProgress({
      merchantId: savedMerchantId,
      entityType: formData.entity_type || null,
      requirements,
      documents: currentMerchantFiles,
    });
  }, [
    savedMerchantId,
    formData.entity_type,
    requirements,
    currentMerchantFiles,
  ]);

  const handleChange = (
    field: Exclude<keyof FormData, "contracted_services">,
    value: string
  ) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const toggleService = (service: string) => {
    setFormData((previous) => {
      const alreadySelected =
        previous.contracted_services.includes(service);

      return {
        ...previous,
        contracted_services: alreadySelected
          ? previous.contracted_services.filter(
              (item) => item !== service
            )
          : [...previous.contracted_services, service],
      };
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setSavedMerchantId(null);
    setMessage("");
    setFormData(getInitialForm(currentVendor));
  };

  const getVendorName = (vendorId: string | null) => {
    if (!vendorId) return "Sin asignar";

    const vendor = vendors.find((item) => item.id === vendorId);
    return vendor?.name || "Sin asignar";
  };

  const getServiceLabel = (service: string) => {
    return (
      serviceOptions.find((option) => option.value === service)?.label ||
      service
    );
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      return "Debés ingresar el nombre de fantasía.";
    }

    if (!formData.cuit.trim()) {
      return "Debés ingresar el CUIT.";
    }

    if (!formData.entity_type) {
      return "Debés seleccionar el tipo de entidad.";
    }

    if (
      canSelectVendor &&
      !formData.vendor_id
    ) {
      return "Debés seleccionar un vendedor.";
    }

    if (
      isVendorUser &&
      !currentVendor?.id
    ) {
      return "El usuario vendedor no tiene un vendedor vinculado.";
    }

    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setLoading(true);
    setMessage("");

    const effectiveVendorId = isVendorUser
      ? currentVendor?.id || null
      : formData.vendor_id || null;

    const fullAddress = [
      [formData.street.trim(), formData.street_number.trim()]
        .filter(Boolean)
        .join(" "),
      formData.floor.trim() ? `Piso ${formData.floor.trim()}` : "",
      formData.apartment.trim()
        ? `Dpto. ${formData.apartment.trim()}`
        : "",
      formData.city.trim(),
      formData.province.trim(),
    ]
      .filter(Boolean)
      .join(", ");

    const payload = {
      name: formData.name.trim(),
      legal_name: nullableText(formData.legal_name),
      email: nullableText(formData.email)?.toLowerCase() || null,
      cuit: formData.cuit.trim(),
      phone: nullableText(formData.phone),
      address: nullableText(fullAddress || formData.address),
      zone: nullableText(formData.zone),

      activity: nullableText(formData.activity),
      tax_condition: nullableText(formData.tax_condition),
      street: nullableText(formData.street),
      street_number: nullableText(formData.street_number),
      floor: nullableText(formData.floor),
      apartment: nullableText(formData.apartment),
      postal_code: nullableText(formData.postal_code),
      city: nullableText(formData.city),
      province: nullableText(formData.province),

      entity_type: formData.entity_type,
      representative_name: nullableText(
        [
          formData.representative_first_name.trim(),
          formData.representative_last_name.trim(),
        ]
          .filter(Boolean)
          .join(" ")
      ),

      representative_first_name: nullableText(
        formData.representative_first_name
      ),

      representative_last_name: nullableText(
        formData.representative_last_name
      ),

      representative_phone: nullableText(
        formData.representative_phone
      ),
      representative_document: nullableText(
        formData.representative_cuit
      ),
      representative_cuit: nullableText(
        formData.representative_cuit
      ),
      representative_birth_date:
        formData.representative_birth_date || null,
      representative_email:
        nullableText(formData.representative_email)?.toLowerCase() || null,
      
      representative_role: nullableText(
        formData.representative_role
      ),

      bank_name: nullableText(formData.bank_name),

      bank_account_holder: nullableText(
        formData.bank_account_holder
      ),

      bank_account_type: nullableText(
        formData.bank_account_type
      ),

      bank_cbu: nullableText(formData.bank_cbu),

      bank_alias: nullableText(formData.bank_alias),

      contracted_services: formData.contracted_services,

      assumes_installment_financial_cost:
        formData.assumes_installment_financial_cost === ""
          ? null
          : formData.assumes_installment_financial_cost === "yes",

      debit_settlement_days:
        formData.debit_settlement_days === ""
          ? null
          : Number(formData.debit_settlement_days),

      vendor_id: effectiveVendorId,
          };

    try {
      if (editingId) {
        const { error } = await supabase
          .from("merchants")
          .update(payload)
          .eq("id", editingId);

        if (error) {
          throw new Error(error.message);
        }

        setMessage("Comercio actualizado correctamente.");
      } else {
        const { data: existingMerchant, error: duplicateError } =
          await supabase
            .from("merchants")
            .select("id")
            .eq("cuit", formData.cuit.trim())
            .maybeSingle();

        if (duplicateError) {
          throw new Error(duplicateError.message);
        }

        if (existingMerchant) {
          throw new Error(
            "Ya existe un comercio registrado con ese CUIT."
          );
        }

        const { data: createdMerchant, error } = await supabase
          .from("merchants")
          .insert({
            ...payload,
            documentation_status: "incomplete",
            onboarding_status: "documentation_pending",
          })
          .select("id")
          .single();

        if (error) {
          throw new Error(error.message);
        }

        if (!createdMerchant?.id) {
          throw new Error(
            "El comercio se creó, pero no se pudo obtener su identificador."
          );
        }

        setEditingId(createdMerchant.id);
        setSavedMerchantId(createdMerchant.id);

        setMessage(
          "Comercio creado correctamente. Ya podés completar su legajo documental."
        );

        setTimeout(() => {
        document
          .getElementById("merchant-documentation")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 150);
      }

      if (editingId) {
        setSavedMerchantId(editingId);
      }

      await loadMerchants();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Ocurrió un error al guardar el comercio.";

      console.error(error);
      setMessage(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (merchant: Merchant) => {
    setEditingId(merchant.id);
    setSavedMerchantId(merchant.id);
    setMessage("");

    setFormData({
      name: merchant.name || "",
      legal_name: merchant.legal_name || "",
      email: merchant.email || "",
      cuit: merchant.cuit || "",
      phone: merchant.phone || "",
      address: merchant.address || "",
      zone: merchant.zone || "",

      activity: merchant.activity || "",
      tax_condition: merchant.tax_condition || "",
      street: merchant.street || "",
      street_number: merchant.street_number || "",
      floor: merchant.floor || "",
      apartment: merchant.apartment || "",
      postal_code: merchant.postal_code || "",
      city: merchant.city || "",
      province: merchant.province || "",

      entity_type: merchant.entity_type || "",
      representative_name:
        merchant.representative_name || "",

      representative_first_name:
        merchant.representative_first_name || "",

      representative_last_name:
        merchant.representative_last_name || "",

      representative_phone:
        merchant.representative_phone || "",
      representative_cuit:
        merchant.representative_cuit ||
        merchant.representative_document ||
        "",
      representative_birth_date:
        merchant.representative_birth_date || "",
      representative_email: merchant.representative_email || "",
      representative_role:
      merchant.representative_role || "",

      bank_name: merchant.bank_name || "",
      bank_account_holder:
        merchant.bank_account_holder || "",
      bank_account_type:
        merchant.bank_account_type || "",
      bank_cbu: merchant.bank_cbu || "",
      bank_alias: merchant.bank_alias || "",

      contracted_services:
        merchant.contracted_services || [],

      assumes_installment_financial_cost:
        merchant.assumes_installment_financial_cost === null ||
        merchant.assumes_installment_financial_cost === undefined
          ? ""
          : merchant.assumes_installment_financial_cost
            ? "yes"
            : "no",

      debit_settlement_days:
        merchant.debit_settlement_days
          ? String(merchant.debit_settlement_days)
          : "",

      vendor_id: isVendorUser
        ? currentVendor?.id || ""
        : merchant.vendor_id || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleDelete = (id: string) => {
  setMerchantToDelete(id);
};

const confirmDelete = async () => {
  if (!merchantToDelete) return;

  const id = merchantToDelete;

  setMessage("");

  const { error } = await supabase
    .from("merchants")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    setMessage(
      `Error al eliminar comercio: ${error.message}`
    );
    return;
  }

  if (editingId === id) {
    resetForm();
  }

  setMerchantToDelete(null);
  setMessage("Comercio eliminado correctamente.");

  await loadMerchants();
};

  const filteredMerchants = useMemo(() => {
    const text = search.trim().toLowerCase();

    return merchants.filter((merchant) => {
      if (!text) return true;

      const services = (merchant.contracted_services || [])
        .map(getServiceLabel)
        .join(" ");

      return (
        (merchant.name || "").toLowerCase().includes(text) ||
        (merchant.legal_name || "").toLowerCase().includes(text) ||
        (merchant.email || "").toLowerCase().includes(text) ||
        (merchant.cuit || "").toLowerCase().includes(text) ||
        (merchant.phone || "").toLowerCase().includes(text) ||
        (merchant.address || "").toLowerCase().includes(text) ||
        (merchant.street || "").toLowerCase().includes(text) ||
        (merchant.city || "").toLowerCase().includes(text) ||
        (merchant.province || "").toLowerCase().includes(text) ||
        (merchant.activity || "").toLowerCase().includes(text) ||
        (merchant.zone || "").toLowerCase().includes(text) ||
        (merchant.representative_name || "")
          .toLowerCase()
          .includes(text) ||
        services.toLowerCase().includes(text) ||
        getVendorName(merchant.vendor_id)
          .toLowerCase()
          .includes(text)
      );
    });
  }, [merchants, search, vendors]);

  if (loadingInitialData) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="rounded-2xl border bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-500">
            Cargando comercios y configuración...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-slate-50 p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">
          Comercios
        </h1>

        <p className="mt-1 text-sm leading-6 text-slate-500 md:leading-normal">
          Alta, asignación comercial y gestión del legajo de cada comercio.
        </p>
      </div>

      {message && (
        <div
          className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
            message.startsWith("Error") ||
            message.startsWith("Debés") ||
            message.startsWith("El usuario")
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(380px,0.8fr)]">
        {/* FORMULARIO */}
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-4 md:px-7 md:py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold md:text-xl">
                  {editingId
                    ? `Ficha del comercio: ${formData.name || "Sin nombre"}`
                    : "Nuevo comercio"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {editingId
                    ? "Actualizá los datos y completá el legajo documental del comercio."
                    : "Completá la información comercial, legal y contractual."}
                </p>
              </div>

              {editingId && (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  Modo edición
                </span>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* DATOS COMERCIALES */}
            <FormSection
              number="1"
              title="Datos comerciales"
              description="Información principal, fiscal y de domicilio del comercio."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nombre de fantasía" required className="md:col-span-2">
                  <input type="text" className={inputClass} value={formData.name} onChange={(event) => handleChange("name", event.target.value)} placeholder="Ej: Farmacia Centro" />
                </Field>

                <Field label="Email">
                  <input type="email" className={inputClass} value={formData.email} onChange={(event) => handleChange("email", event.target.value)} placeholder="comercio@email.com" />
                </Field>

                <Field label="CUIT" required>
                  <input type="text" className={inputClass} value={formData.cuit} onChange={(event) => handleChange("cuit", event.target.value)} placeholder="30-12345678-9" />
                </Field>

                <Field label="Teléfono">
                  <input type="text" className={inputClass} value={formData.phone} onChange={(event) => handleChange("phone", event.target.value)} placeholder="387..." />
                </Field>

                <Field label="Actividad comercial">
                  <input type="text" className={inputClass} value={formData.activity} onChange={(event) => handleChange("activity", event.target.value)} placeholder="Ej: Venta minorista de combustibles" />
                </Field>

                <Field label="Condición fiscal">
                  <select className={inputClass} value={formData.tax_condition} onChange={(event) => handleChange("tax_condition", event.target.value)}>
                    <option value="">Seleccionar condición fiscal</option>
                    {taxConditionOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Calle">
                  <input type="text" className={inputClass} value={formData.street} onChange={(event) => handleChange("street", event.target.value)} placeholder="Ej: Av. San Martín" />
                </Field>

                <Field label="Número">
                  <input type="text" className={inputClass} value={formData.street_number} onChange={(event) => handleChange("street_number", event.target.value)} placeholder="1463" />
                </Field>

                <Field label="Piso">
                  <input type="text" className={inputClass} value={formData.floor} onChange={(event) => handleChange("floor", event.target.value)} placeholder="Ej: 2" />
                </Field>

                <Field label="Departamento">
                  <input type="text" className={inputClass} value={formData.apartment} onChange={(event) => handleChange("apartment", event.target.value)} placeholder="Ej: B" />
                </Field>

                <Field label="Código postal (CPA)">
                  <input type="text" className={inputClass} value={formData.postal_code} onChange={(event) => handleChange("postal_code", event.target.value)} placeholder="Ej: 4400" />
                </Field>

                <Field label="Localidad">
                  <input type="text" className={inputClass} value={formData.city} onChange={(event) => handleChange("city", event.target.value)} placeholder="Ej: Salta" />
                </Field>

                <Field label="Provincia">
                  <select className={inputClass} value={formData.province} onChange={(event) => handleChange("province", event.target.value)}>
                    <option value="">Seleccionar provincia</option>
                    {provinceOptions.map((province) => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Zona">
                  <input type="text" className={inputClass} value={formData.zone} onChange={(event) => handleChange("zone", event.target.value)} placeholder="Ej: Salta Centro" />
                </Field>
              </div>
            </FormSection>

            {/* DATOS LEGALES */}
            <FormSection
              number="2"
              title="Datos legales"
              description="Información societaria y del representante legal."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Razón social" className="md:col-span-2">
                  <input type="text" className={inputClass} value={formData.legal_name} onChange={(event) => handleChange("legal_name", event.target.value)} placeholder="Ej: Farmacia Centro S.R.L." />
                </Field>

                <Field label="Tipo de entidad" required className="md:col-span-2">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <EntityOption title="Persona humana" description="Titular individual, monotributista o responsable inscripto." selected={formData.entity_type === "individual"} onClick={() => handleChange("entity_type", "individual")} />
                    <EntityOption title="Empresa" description="SA, SAS, SRL, cooperativa u otra persona jurídica." selected={formData.entity_type === "company"} onClick={() => handleChange("entity_type", "company")} />
                  </div>
                </Field>

                <Field label="Nombre del representante">
                  <input
                    type="text"
                    className={inputClass}
                    value={formData.representative_first_name}
                    onChange={(event) =>
                      handleChange(
                        "representative_first_name",
                        event.target.value
                      )
                    }
                    placeholder="Nombre"
                  />
                </Field>

                <Field label="Apellido del representante">
                  <input
                    type="text"
                    className={inputClass}
                    value={formData.representative_last_name}
                    onChange={(event) =>
                      handleChange(
                        "representative_last_name",
                        event.target.value
                      )
                    }
                    placeholder="Apellido"
                  />
                </Field>

                <Field label="Carácter del representante">
                  <select
                    className={inputClass}
                    value={formData.representative_role}
                    onChange={(event) =>
                      handleChange(
                        "representative_role",
                        event.target.value
                      )
                    }
                  >
                    <option value="">Seleccionar carácter</option>
                    <option value="Presidente">Presidente</option>
                    <option value="Socio gerente">Socio gerente</option>
                    <option value="Apoderado">Apoderado</option>
                    <option value="Titular">Titular</option>
                    <option value="Otro">Otro</option>
                  </select>
                </Field>

                <Field label="CUIT/CUIL del representante">
                  <input type="text" className={inputClass} value={formData.representative_cuit} onChange={(event) => handleChange("representative_cuit", event.target.value)} placeholder="20-25123456-7" />
                </Field>

                <Field label="Fecha de nacimiento">
                  <input type="date" className={inputClass} value={formData.representative_birth_date} onChange={(event) => handleChange("representative_birth_date", event.target.value)} />
                </Field>

                <Field label="Email del representante">
                  <input type="email" className={inputClass} value={formData.representative_email} onChange={(event) => handleChange("representative_email", event.target.value)} placeholder="representante@email.com" />
                </Field>

                <Field label="Teléfono del representante">
                  <input
                    type="tel"
                    className={inputClass}
                    value={formData.representative_phone}
                    onChange={(event) =>
                      handleChange(
                        "representative_phone",
                        event.target.value
                      )
                    }
                    placeholder="Ej: 387 4567890"
                  />
                </Field>
              </div>
            </FormSection>

            {/* SERVICIOS */}
            <FormSection
              number="3"
              title="Servicios contratados"
              description="Podés seleccionar uno o varios productos BENEFI y configurar las condiciones de procesamiento."
             >
              <div className="grid gap-3 md:grid-cols-2">
                {serviceOptions.map((service) => {
                  const selected =
                    formData.contracted_services.includes(
                      service.value
                    );

                  return (
                    <button
                      key={service.value}
                      type="button"
                      onClick={() =>
                        toggleService(service.value)
                      }
                      className={`rounded-xl border p-3 text-left transition md:p-4 ${
                        selected
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-slate-900 hover:border-slate-400"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
                            selected
                              ? "border-white bg-white text-slate-950"
                              : "border-slate-300"
                          }`}
                        >
                          {selected ? "✓" : ""}
                        </span>

                        <div>
                          <p className="font-medium">
                            {service.label}
                          </p>

                          <p
                            className={`mt-1 text-xs leading-5 ${
                              selected
                                ? "text-slate-300"
                                : "text-slate-500"
                            }`}
                          >
                            {service.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {formData.contracted_services.includes(
                "payment_processing"
              ) && (
                <div className="mt-5 space-y-4">
                  {/* PLANES DE CUOTAS */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          Planes de cuotas
                        </p>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Definí si el comercio asume los costos
                          financieros de las ventas en cuotas.
                        </p>
                      </div>

                      {activeInstallmentPeriod && (
                        <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-700 shadow-sm">
                          {activeInstallmentPeriod}
                        </span>
                      )}
                    </div>

                    <div className="mt-4">
                      <p className="mb-2 text-sm font-medium text-slate-700">
                        ¿El comercio asume los costos financieros?
                      </p>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleChange(
                              "assumes_installment_financial_cost",
                              "yes"
                            )
                          }
                          className={`rounded-xl border p-3 text-left transition ${
                            formData.assumes_installment_financial_cost ===
                            "yes"
                              ? "border-emerald-600 bg-emerald-50"
                              : "border-slate-200 bg-white hover:border-slate-400"
                          }`}
                        >
                          <p className="font-medium text-slate-950">
                            Sí, los asume
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            El costo financiero correspondiente al
                            plan seleccionado será asumido por el
                            comercio.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleChange(
                              "assumes_installment_financial_cost",
                              "no"
                            )
                          }
                          className={`rounded-xl border p-3 text-left transition ${
                            formData.assumes_installment_financial_cost ===
                            "no"
                              ? "border-blue-600 bg-blue-50"
                              : "border-slate-200 bg-white hover:border-slate-400"
                          }`}
                        >
                          <p className="font-medium text-slate-950">
                            No los asume
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            El comercio no asumirá los costos
                            financieros de los planes de cuotas.
                          </p>
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Configuración vigente
                        </p>

                        <p className="mt-1 text-sm font-medium text-slate-700">
                          {activeInstallmentPeriod ||
                            "Sin configuración activa"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setShowInstallmentPlansModal(true)
                        }
                        disabled={
                          activeInstallmentRates.length === 0
                        }
                        className="w-full rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                      >
                        Ver detalle de planes
                      </button>
                    </div>
                  </div>

                  {/* ACREDITACIÓN DÉBITO */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-950">
                      Acreditación con tarjeta de débito
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Seleccioná cuándo desea recibir el comercio
                      los fondos correspondientes a ventas con
                      tarjeta de débito.
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleChange(
                            "debit_settlement_days",
                            "1"
                          )
                        }
                        className={`rounded-xl border p-4 text-left transition ${
                          formData.debit_settlement_days === "1"
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-slate-200 bg-white text-slate-950 hover:border-slate-400"
                        }`}
                      >
                        <p className="text-lg font-semibold">
                          1 día
                        </p>

                        <p
                          className={`mt-1 text-xs leading-5 ${
                            formData.debit_settlement_days === "1"
                              ? "text-slate-300"
                              : "text-slate-500"
                          }`}
                        >
                          Acreditación de fondos al siguiente día
                          según las condiciones operativas.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleChange(
                            "debit_settlement_days",
                            "2"
                          )
                        }
                        className={`rounded-xl border p-4 text-left transition ${
                          formData.debit_settlement_days === "2"
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-slate-200 bg-white text-slate-950 hover:border-slate-400"
                        }`}
                      >
                        <p className="text-lg font-semibold">
                          2 días
                        </p>

                        <p
                          className={`mt-1 text-xs leading-5 ${
                            formData.debit_settlement_days === "2"
                              ? "text-slate-300"
                              : "text-slate-500"
                          }`}
                        >
                          Acreditación de fondos a los dos días
                          según las condiciones operativas.
                        </p>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </FormSection>

            {/* DATOS BANCARIOS */}
            <FormSection
              number="4"
              title="Datos bancarios"
              description="Cuenta declarada por el comercio para recibir liquidaciones."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Banco">
                  <input type="text" className={inputClass} value={formData.bank_name} onChange={(event) => handleChange("bank_name", event.target.value)} placeholder="Ej: Banco Macro" />
                </Field>

                <Field label="Titular de la cuenta">
                  <input type="text" className={inputClass} value={formData.bank_account_holder} onChange={(event) => handleChange("bank_account_holder", event.target.value)} placeholder="Nombre o razón social" />
                </Field>

                <Field label="Tipo de cuenta">
                  <select
                    className={inputClass}
                    value={formData.bank_account_type}
                    onChange={(event) =>
                      handleChange(
                        "bank_account_type",
                        event.target.value
                      )
                    }
                  >
                    <option value="">Seleccionar tipo de cuenta</option>
                    <option value="Cuenta corriente">
                      Cuenta corriente
                    </option>
                    <option value="Caja de ahorro">
                      Caja de ahorro
                    </option>
                  </select>
                </Field>

                <Field label="CBU">
                  <input type="text" inputMode="numeric" maxLength={22} className={inputClass} value={formData.bank_cbu} onChange={(event) => handleChange("bank_cbu", event.target.value.replace(/\D/g, "").slice(0, 22))} placeholder="22 dígitos" />
                </Field>

                <Field label="Alias">
                  <input type="text" className={inputClass} value={formData.bank_alias} onChange={(event) => handleChange("bank_alias", event.target.value)} placeholder="Ej: COMERCIO.BENEFI" />
                </Field>
              </div>
            </FormSection>

            {/* DOCUMENTACIÓN */}
            <div id="merchant-documentation">
              <FormSection
                number="5"
                title="Documentación requerida"
                description="Los requisitos se cargan automáticamente según el tipo de entidad."
              >
                {!savedMerchantId ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
                    <p className="font-medium text-slate-800">
                      Guardá primero el comercio
                    </p>

                    <p className="mt-2 text-sm text-slate-500">
                      Una vez creado el comercio se habilitará automáticamente el Legajo
                      Documental para cargar todos los archivos requeridos.
                    </p>
                  </div>
                ) : !formData.entity_type ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                    Seleccioná primero si el comercio corresponde a una
                    persona humana o a una empresa.
                  </div>
                ) : visibleRequirements.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                    No existen requisitos documentales configurados para
                    este tipo de entidad.
                  </div>
                ) : (
                    <div className="space-y-4">
                      <DocumentProgress
                        uploaded={selectedMerchantProgress.uploaded}
                        totalRequired={
                          selectedMerchantProgress.totalRequired
                        }
                        percentage={
                          selectedMerchantProgress.percentage
                        }
                      />

                      <div className="space-y-3">
                        {visibleRequirements.map((requirement) => (
                          <DocumentUploadCard
                            key={requirement.id}
                            supabase={supabase}
                            merchantId={savedMerchantId}
                            requirement={requirement}
                            canReview={
                              currentRole === "admin" ||
                              currentRole === "supervisor" ||
                              currentRole === "operaciones"
                            }
                            onDocumentChanged={async () => {
                              await refreshMerchantDocumentation(savedMerchantId);
                            }}
                          />
                        ))}

                        <OtherDocumentsUploader
                          supabase={supabase}
                          merchantId={savedMerchantId}
                          onDocumentChanged={async () => {
                            await refreshMerchantDocumentation(savedMerchantId);
                          }}
                        />
                      </div>
                    </div>
                  )}
              </FormSection>
            </div>

            {/* ASIGNACIÓN */}
            <FormSection
              number="6"
              title="Asignación comercial"
              description="Define qué vendedor será responsable del comercio."
              last
            >
              {isVendorUser ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                    Asignación automática
                  </p>

                  <p className="mt-1 font-semibold text-emerald-950">
                    {currentVendor?.name ||
                      "Vendedor sin nombre"}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-emerald-800">
                    El comercio quedará asignado automáticamente al
                    vendedor que está realizando el alta.
                  </p>
                </div>
              ) : (
                <Field label="Vendedor asignado" required>
                  <select
                    className={inputClass}
                    value={formData.vendor_id}
                    onChange={(event) =>
                      handleChange(
                        "vendor_id",
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Seleccionar vendedor
                    </option>

                    {vendors.map((vendor) => (
                      <option
                        key={vendor.id}
                        value={vendor.id}
                      >
                        {vendor.name || "Sin nombre"}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </FormSection>

            <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-7 md:py-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {loading
                    ? "Guardando..."
                    : editingId
                    ? "Actualizar comercio"
                    : "Guardar comercio"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={loading}
                    className="w-full rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                  >
                    Nuevo comercio
                  </button>
                )}
              </div>
            </div>
          </form>
        </section>

        {/* LISTADO */}
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-6">
          <div className="border-b border-slate-200 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold md:text-xl"> 
                  Comercios registrados
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {filteredMerchants.length} de{" "}
                  {merchants.length} comercios
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                Rol: {currentRole || "-"}
              </span>
            </div>

            <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row">
              <input
                type="text"
                className={`${inputClass} min-w-0`}
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Buscar por nombre, CUIT, vendedor o servicio..."
              />

              <button
                type="button"
                onClick={() => setSearch("")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
              >
                Limpiar
              </button>
            </div>
          </div>

          <div className="max-h-[calc(100vh-240px)] overflow-y-auto p-4">
            {filteredMerchants.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
                <p className="text-sm text-slate-500">
                  {merchants.length === 0
                    ? "No hay comercios cargados."
                    : "No se encontraron comercios con esa búsqueda."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMerchants.map((merchant) => {
                  const progress =
                    merchantProgressMap.get(merchant.id) || {
                      uploaded: 0,
                      totalRequired: 0,
                      pending: 0,
                      percentage: 0,
                      isComplete: false,
                    };

                  return (
                    <article
                    key={merchant.id}
                    className="rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-slate-950">
                          {merchant.name || "Sin nombre"}
                        </h3>

                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {merchant.legal_name ||
                            "Sin razón social"}
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleEdit(merchant)
                          }
                          className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(merchant.id)
                          }
                          className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusBadge
                        label={
                          documentationStatusLabels[
                            merchant.documentation_status ||
                              ""
                          ] || "Sin estado"
                        }
                        value={
                          merchant.documentation_status
                        }
                      />

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                        {merchant.entity_type === "company"
                          ? "Empresa"
                          : merchant.entity_type ===
                            "individual"
                          ? "Persona humana"
                          : "Tipo no definido"}
                      </span>
                    </div>

                    <div className="mt-4">
                      <DocumentProgress
                        uploaded={progress.uploaded}
                        totalRequired={progress.totalRequired}
                        percentage={progress.percentage}
                        compact
                      />
                    </div>

                    <dl className="mt-4 grid gap-2 text-xs text-slate-600">
                      <MerchantDetail
                        label="CUIT"
                        value={merchant.cuit || "-"}
                      />

                      <MerchantDetail
                        label="Email"
                        value={merchant.email || "-"}
                      />

                      <MerchantDetail
                        label="Teléfono"
                        value={merchant.phone || "-"}
                      />

                      <MerchantDetail
                        label="Actividad"
                        value={merchant.activity || "-"}
                      />

                      <MerchantDetail
                        label="Localidad"
                        value={merchant.city || "-"}
                      />

                      <MerchantDetail
                        label="Provincia"
                        value={merchant.province || "-"}
                      />

                      <MerchantDetail
                        label="Zona"
                        value={merchant.zone || "-"}
                      />

                      <MerchantDetail
                        label="Vendedor"
                        value={getVendorName(
                          merchant.vendor_id
                        )}
                      />

                      <MerchantDetail
                        label="Onboarding"
                        value={
                          onboardingStatusLabels[
                            merchant.onboarding_status || ""
                          ] || "Sin estado"
                        }
                      />
                    </dl>

                    {(merchant.contracted_services || []).length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Sin servicios seleccionados
                      </p>
                    ) : (
                      <>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(merchant.contracted_services || []).map(
                            (service) => (
                              <span
                                key={service}
                                className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700"
                              >
                                {getServiceLabel(service)}
                              </span>
                            )
                          )}
                        </div>

                        {(merchant.contracted_services || []).includes(
                          "payment_processing"
                        ) && (
                          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                              Condiciones de procesamiento
                            </p>

                            <div className="mt-3 space-y-2 text-xs">
                              <MerchantDetail
                                label="Costos financieros"
                                value={
                                  merchant.assumes_installment_financial_cost ===
                                  null
                                    ? "Sin definir"
                                    : merchant.assumes_installment_financial_cost
                                      ? "Asume el comercio"
                                      : "No asume el comercio"
                                }
                              />

                              <MerchantDetail
                                label="Acreditación débito"
                                value={
                                  merchant.debit_settlement_days
                                    ? `${merchant.debit_settlement_days} ${
                                        merchant.debit_settlement_days === 1
                                          ? "día"
                                          : "días"
                                      }`
                                    : "Sin definir"
                                }
                              />

                              <MerchantDetail
                                label="Planes vigentes"
                                value={
                                  activeInstallmentPeriod ||
                                  "Sin configuración activa"
                                }
                              />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </article>
                );
              })}
              </div>
            )}
          </div>
        </section>
      </div>

      {showInstallmentPlansModal && (
        <InstallmentPlansModal
          period={activeInstallmentPeriod}
          rates={activeInstallmentRates}
          onClose={() =>
            setShowInstallmentPlansModal(false)
          }
        />
      )}
      {merchantToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <h3 className="text-lg font-semibold text-slate-900">
                Eliminar comercio
              </h3>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm leading-6 text-slate-600">
                ¿Querés eliminar este comercio?
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                También se eliminará el legajo documental asociado.
                Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setMerchantToDelete(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Eliminar comercio
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 md:py-2.5";

function FormSection({
  number,
  title,
  description,
  children,
  last = false,
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section
        className={`px-4 py-5 md:px-7 md:py-6 ${
        !last ? "border-b border-slate-200" : ""
      }`}
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white md:h-8 md:w-8 md:text-sm">
          {number}
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-950 md:text-lg">
            {title}
          </h3>

          <p className="mt-1 text-xs leading-5 text-slate-500 md:text-sm">
            {description}
          </p>
        </div>
      </div>

      {children}
    </section>
  );
}

function Field({
  label,
  required = false,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </label>

      {children}
    </div>
  );
}

function EntityOption({
  title,
  description,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 md:p-4 text-left transition ${
        selected
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white hover:border-slate-400"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-1 h-4 w-4 shrink-0 rounded-full border-4 ${
            selected
              ? "border-white bg-slate-950"
              : "border-slate-300 bg-white"
          }`}
        />

        <div>
          <p className="font-medium">{title}</p>

          <p
            className={`mt-1 text-xs leading-5 ${
              selected
                ? "text-slate-300"
                : "text-slate-500"
            }`}
          >
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}

function StatusBadge({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  const styles: Record<string, string> = {
    complete:
      "bg-emerald-50 text-emerald-700",
    pending_review:
      "bg-amber-50 text-amber-700",
    incomplete:
      "bg-red-50 text-red-700",
    observed:
      "bg-purple-50 text-purple-700",
    expired:
      "bg-slate-200 text-slate-700",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
        styles[value || ""] ||
        "bg-slate-100 text-slate-700"
      }`}
    >
      Doc.: {label}
    </span>
  );
}

function MerchantDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-400">{label}</dt>

      <dd className="max-w-[65%] text-right font-medium text-slate-700">
        {value}
      </dd>
    </div>
  );
}
function InstallmentPlansModal({
  period,
  rates,
  onClose,
}: {
  period: string;
  rates: {
    installments: number;
    financial_cost_rate: number;
    is_enabled: boolean;
  }[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">
                Detalle de planes de cuotas
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {period ||
                  "Configuración vigente"}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-lg text-slate-600 transition hover:bg-slate-50"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 md:p-5">
          <div className="grid gap-2 sm:grid-cols-2">
            {rates.map((rate) => (
              <div
                key={rate.installments}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-slate-950">
                    {rate.installments} cuotas
                  </p>

                  <p className="mt-0.5 text-xs text-slate-500">
                    Costo financiero
                  </p>
                </div>

                <p className="text-lg font-bold text-blue-700">
                  {Number(
                    rate.financial_cost_rate
                  ).toLocaleString("es-AR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  %
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 sm:w-auto"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
