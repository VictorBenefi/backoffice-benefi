"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import NotificationBanner, {
  type NotificationMessage,
} from "@/components/ui/NotificationBanner";
import ConfirmModal from "@/components/ui/ConfirmModal";
import {
  DangerButton,
  EmptyState,
  FormCard,
  InfoCard,
  InfoItem,
  PageHeader,
  PrimaryButton,
  SearchToolbar,
  SecondaryButton,
  StatusBadge,
  errorTextClassName,
  fieldClassName,
  helpTextClassName,
  labelClassName,
} from "@/components/ui";

type Merchant = {
  id: string;
  name: string | null;
  vendor_id: string | null;
};

type Vendor = {
  id: string;
  name: string | null;
};

type PosDevice = {
  id: string;
  code: string | null;
  merchant_id: string | null;
  vendor_id: string | null;
  status: string | null;
};

type Installation = {
  id: string;
  merchant_id: string;
  vendor_id: string | null;
  pos_id: string | null;
  status: string;
  install_date: string | null;
  notes: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
};

type AppUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  isAppUser: boolean;
};

const initialForm = {
  merchant_id: "",
  vendor_id: "",
  pos_id: "",
  status: "pending",
  install_date: "",
  notes: "",
};

export default function InstalacionesClient() {
  const supabase = createClient();

  const [formData, setFormData] = useState(initialForm);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [posDevices, setPosDevices] = useState<PosDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] =
    useState<NotificationMessage | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [installationToDelete, setInstallationToDelete] =
    useState<Installation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    const [installationsRes, merchantsRes, vendorsRes, posRes] =
      await Promise.all([
        supabase
          .from("installations")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("merchants")
          .select("id, name, vendor_id")
          .order("name"),
        supabase.from("vendors").select("id, name").order("name"),
        supabase
          .from("pos_devices")
          .select("id, code, merchant_id, vendor_id, status")
          .order("code"),
      ]);

    if (installationsRes.error) {
      console.error(
        "Error al cargar instalaciones:",
        installationsRes.error.message
      );
    } else {
      setInstallations((installationsRes.data as Installation[]) || []);
    }

    if (merchantsRes.error) {
      console.error("Error al cargar comercios:", merchantsRes.error.message);
    } else {
      setMerchants((merchantsRes.data as Merchant[]) || []);
    }

    if (vendorsRes.error) {
      console.error("Error al cargar vendedores:", vendorsRes.error.message);
    } else {
      setVendors((vendorsRes.data as Vendor[]) || []);
    }

    if (posRes.error) {
      console.error("Error al cargar POS:", posRes.error.message);
    } else {
      setPosDevices((posRes.data as PosDevice[]) || []);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getCurrentAuditUser = async (): Promise<AppUser | null> => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return null;
    }

    const { data, error } = await supabase
      .from("app_users")
      .select("id, name, email, role")
      .eq("email", user.email.trim().toLowerCase())
      .maybeSingle();

    if (error) {
      console.error("Error al obtener usuario auditoría:", error.message);
      return {
        id: user.id,
        name: user.email,
        email: user.email,
        role: null,
        isAppUser: false,
      };
    }

    if (!data) {
      return {
        id: user.id,
        name: user.email,
        email: user.email,
        role: null,
        isAppUser: false,
      };
    }

    return {
      ...data,
      isAppUser: true,
    };
  };

  const getMerchantName = (merchantId: string | null) => {
    if (!merchantId) return "-";
    return merchants.find((m) => m.id === merchantId)?.name || "-";
  };

  const getVendorName = (vendorId: string | null) => {
    if (!vendorId) return "-";
    return vendors.find((v) => v.id === vendorId)?.name || "-";
  };

  const getPosCode = (posId: string | null) => {
    if (!posId) return "-";
    return posDevices.find((p) => p.id === posId)?.code || "-";
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendiente";
      case "in_progress":
        return "En proceso";
      case "completed":
        return "Completada";
      case "cancelled":
        return "Cancelada";
      default:
        return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-100 text-amber-700";
      case "in_progress":
        return "bg-blue-100 text-blue-700";
      case "completed":
        return "bg-emerald-100 text-emerald-700";
      case "cancelled":
        return "bg-rose-100 text-rose-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getAssignedMerchantPosList = (merchantId: string) => {
    return posDevices.filter(
      (p) => p.merchant_id === merchantId && p.status === "assigned_merchant"
    );
  };

  const hasActiveInstallation = (posId: string) => {
    return installations.some(
      (i) => i.pos_id === posId && i.id !== editingId && i.status !== "cancelled"
    );
  };

  const getEligiblePosListForMerchant = (merchantId: string, vendorId: string) => {
    if (!merchantId || !vendorId) return [];

    return posDevices.filter((p) => {
      const sameVendor = p.vendor_id === vendorId;

      const assignedToVendor = p.status === "assigned_vendor" && sameVendor;

      const assignedToThisMerchant =
        p.status === "assigned_merchant" &&
        p.merchant_id === merchantId &&
        sameVendor;

      if (!assignedToVendor && !assignedToThisMerchant) return false;
      if (hasActiveInstallation(p.id)) return false;

      return true;
    });
  };

  const getSelectablePosList = () => {
    const eligible = getEligiblePosListForMerchant(
      formData.merchant_id,
      formData.vendor_id
    );

    if (!editingId || !formData.pos_id) {
      return eligible;
    }

    const currentPos = posDevices.find((p) => p.id === formData.pos_id);
    if (!currentPos) return eligible;

    const exists = eligible.some((p) => p.id === currentPos.id);
    if (exists) return eligible;

    return [currentPos, ...eligible];
  };

  const handleMerchantChange = (merchantId: string) => {
    const selectedMerchant = merchants.find((m) => m.id === merchantId);
    const resolvedVendorId = selectedMerchant?.vendor_id || "";

    setFormData((prev) => ({
      ...prev,
      merchant_id: merchantId,
      vendor_id: resolvedVendorId,
      pos_id: "",
    }));
  };

  const handleChange = (field: keyof typeof initialForm, value: string) => {
    if (field === "merchant_id" && !editingId) {
      handleMerchantChange(value);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setFormData(initialForm);
    setEditingId(null);
  };

  const insertMovement = async ({
    posId,
    posCode,
    type,
    vendorId,
    vendorName,
    merchantId,
    merchantName,
    notes,
    auditUser,
  }: {
    posId: string | null;
    posCode: string | null;
    type: string;
    vendorId: string | null;
    vendorName: string | null;
    merchantId: string | null;
    merchantName: string | null;
    notes: string;
    auditUser?: AppUser | null;
  }) => {
    const resolvedAuditUser =
      auditUser === undefined
        ? await getCurrentAuditUser()
        : auditUser;

    return supabase.from("pos_movements").insert([
      {
        pos_id: posId,
        pos_code: posCode,
        type,
        vendor_id: vendorId,
        vendor_name: vendorName,
        merchant_id: merchantId,
        merchant_name: merchantName,
        user_id: resolvedAuditUser?.id || null,
        user_name: resolvedAuditUser?.name || null,
        user_email: resolvedAuditUser?.email || null,
        user_role: resolvedAuditUser?.role || null,
        notes,
      },
    ]);
  };

  const insertInstallationEvent = async ({
    installationId,
    eventType,
    title,
    description,
    previousStatus,
    newStatus,
    appUserId,
  }: {
    installationId: string;
    eventType: string;
    title: string;
    description?: string | null;
    previousStatus?: string | null;
    newStatus?: string | null;
    appUserId?: string | null;
  }) => {
    return supabase.from("installation_events").insert({
      installation_id: installationId,
      event_type: eventType,
      title,
      description: description || null,
      previous_status: previousStatus || null,
      new_status: newStatus || null,
      created_by: appUserId || null,
    });
  };

  const insertInstallationStatusHistory = async ({
    installationId,
    previousStatus,
    newStatus,
    reason,
    appUserId,
  }: {
    installationId: string;
    previousStatus?: string | null;
    newStatus: string;
    reason?: string | null;
    appUserId?: string | null;
  }) => {
    return supabase.from("installation_status_history").insert({
      installation_id: installationId,
      previous_status: previousStatus || null,
      new_status: newStatus,
      reason: reason || null,
      changed_by: appUserId || null,
    });
  };

  const registerStatusChange = async ({
    installationId,
    previousStatus,
    newStatus,
    reason,
    appUserId,
  }: {
    installationId: string;
    previousStatus: string | null;
    newStatus: string;
    reason?: string | null;
    appUserId?: string | null;
  }) => {
    const { error: historyError } =
      await insertInstallationStatusHistory({
        installationId,
        previousStatus,
        newStatus,
        reason,
        appUserId,
      });

    if (historyError) {
      console.warn(
        "No se pudo registrar el historial de estado:",
        historyError.message
      );
    }

    const { error: eventError } =
      await insertInstallationEvent({
        installationId,
        eventType: "status_changed",
        title: `Estado actualizado a ${getStatusLabel(newStatus)}`,
        description: reason || null,
        previousStatus,
        newStatus,
        appUserId,
      });

    if (eventError) {
      console.warn(
        "No se pudo registrar el evento de cambio de estado:",
        eventError.message
      );
    }
  };

  const assignPosToMerchant = async ({
    pos,
    merchantId,
    vendorId,
    merchantName,
    vendorName,
    auditUser,
  }: {
    pos: PosDevice;
    merchantId: string;
    vendorId: string;
    merchantName: string | null;
    vendorName: string | null;
    auditUser: AppUser | null;
  }) => {
    const alreadyAssigned =
      pos.status === "assigned_merchant" &&
      pos.merchant_id === merchantId &&
      pos.vendor_id === vendorId;

    if (alreadyAssigned) {
      return;
    }

    const { error: posUpdateError } = await supabase
      .from("pos_devices")
      .update({
        status: "assigned_merchant",
        merchant_id: merchantId,
        vendor_id: vendorId,
      })
      .eq("id", pos.id);

    if (posUpdateError) {
      throw new Error(
        `La instalación se guardó, pero falló la asignación del POS: ${posUpdateError.message}`
      );
    }

    const { error: movementError } = await insertMovement({
      posId: pos.id,
      posCode: pos.code || null,
      type: "asignado_comercio",
      vendorId,
      vendorName,
      merchantId,
      merchantName,
      notes: "Asignación desde instalaciones",
      auditUser,
    });

    if (movementError) {
      throw new Error(
        `La instalación y el POS se guardaron, pero falló el movimiento: ${movementError.message}`
      );
    }
  };

  const cancelInstallation = async ({
    installation,
    auditUser,
  }: {
    installation: Installation;
    auditUser: AppUser | null;
  }) => {
    if (!installation.pos_id) {
      return;
    }

    const { error: posReleaseError } = await supabase
      .from("pos_devices")
      .update({
        status: "in_stock",
        merchant_id: null,
        vendor_id: null,
      })
      .eq("id", installation.pos_id);

    if (posReleaseError) {
      throw new Error(
        `La instalación se actualizó, pero falló la liberación del POS: ${posReleaseError.message}`
      );
    }

    const releasedPos = posDevices.find(
      (item) => item.id === installation.pos_id
    );

    const { error: movementError } = await insertMovement({
      posId: installation.pos_id,
      posCode: releasedPos?.code || null,
      type: "retorno_stock",
      vendorId: null,
      vendorName:
        vendors.find((item) => item.id === installation.vendor_id)?.name ||
        null,
      merchantId: null,
      merchantName:
        merchants.find((item) => item.id === installation.merchant_id)?.name ||
        null,
      notes: "POS liberado por cancelación de instalación",
      auditUser,
    });

    if (movementError) {
      throw new Error(
        `La instalación se canceló y el POS fue liberado, pero falló el movimiento: ${movementError.message}`
      );
    }
  };

  const completeInstallation = async ({
    installationId,
    merchantId,
    posId,
    vendorId,
    auditUser,
    movementNote,
  }: {
    installationId: string;
    merchantId: string;
    posId: string;
    vendorId: string | null;
    auditUser: AppUser | null;
    movementNote: string;
  }) => {
    const appUserId =
      auditUser?.isAppUser ? auditUser.id : null;

    const now = new Date().toISOString();

    const { error: installationError } = await supabase
      .from("installations")
      .update({
        completed_at: now,
        completed_by: appUserId,
        updated_at: now,
        updated_by: appUserId,
      })
      .eq("id", installationId);

    if (installationError) {
      throw new Error(
        `No se pudo registrar el cierre de la instalación: ${installationError.message}`
      );
    }

    const { error: merchantError } = await supabase
      .from("merchants")
      .update({
        onboarding_status: "active",
      })
      .eq("id", merchantId);

    if (merchantError) {
      throw new Error(
        `No se pudo activar el comercio: ${merchantError.message}`
      );
    }

    const { error: posError } = await supabase
      .from("pos_devices")
      .update({
        status: "installed",
        merchant_id: merchantId,
        vendor_id: vendorId,
      })
      .eq("id", posId);

    if (posError) {
      throw new Error(
        `No se pudo marcar el POS como instalado: ${posError.message}`
      );
    }

    const { error: movementError } = await insertMovement({
      posId,
      posCode: getPosCode(posId),
      type: "instalacion_completada",
      vendorId,
      vendorName: getVendorName(vendorId),
      merchantId,
      merchantName: getMerchantName(merchantId),
      notes: movementNote,
      auditUser,
    });

    if (movementError) {
      throw new Error(
        `La instalación se completó, pero falló el movimiento de auditoría: ${movementError.message}`
      );
    }

    const { error: eventError } = await insertInstallationEvent({
      installationId,
      eventType: "installation_completed",
      title: "Instalación completada",
      description:
        "El comercio fue activado y el POS quedó marcado como instalado.",
      previousStatus: null,
      newStatus: "completed",
      appUserId,
    });

    if (eventError) {
      console.warn(
        "La instalación se completó, pero no pudo registrarse el evento:",
        eventError.message
      );
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    if (!formData.merchant_id) {
      setMessage({
        type: "error",
        text: "Debés seleccionar un comercio.",
      });
      return;
    }

    if (!formData.vendor_id) {
      setMessage({
        type: "error",
        text: "No se encontró un vendedor asignado para ese comercio.",
      });
      return;
    }

    if (!formData.pos_id) {
      setMessage({
        type: "error",
        text: "Debés seleccionar un POS.",
      });
      return;
    }

    if (
      formData.status === "completed" &&
      !formData.install_date
    ) {
      setMessage({
        type: "error",
        text: "Si la instalación está completada, debés indicar la fecha de instalación.",
      });
      return;
    }

    const selectedPos = posDevices.find(
      (item) => item.id === formData.pos_id
    );

    if (!selectedPos) {
      setMessage({
        type: "error",
        text: "No se encontró el POS seleccionado.",
      });
      return;
    }

    if (!editingId) {
      const canUsePos =
        (selectedPos.status === "assigned_vendor" &&
          selectedPos.vendor_id === formData.vendor_id) ||
        (selectedPos.status === "assigned_merchant" &&
          selectedPos.merchant_id === formData.merchant_id &&
          selectedPos.vendor_id === formData.vendor_id);

      if (!canUsePos) {
        setMessage({
          type: "error",
          text: "El POS seleccionado debe estar previamente asignado al vendedor del comercio o al mismo comercio.",
        });
        return;
      }

      if (hasActiveInstallation(selectedPos.id)) {
        setMessage({
          type: "error",
          text: "El POS seleccionado ya tiene una instalación activa.",
        });
        return;
      }
    }

    setLoading(true);
    let successMessage: string | null = null;

    try {
      const auditUser = await getCurrentAuditUser();
      const appUserId =
        auditUser?.isAppUser ? auditUser.id : null;
      const now = new Date().toISOString();

      const payload = {
        merchant_id: formData.merchant_id,
        vendor_id: formData.vendor_id || null,
        pos_id: formData.pos_id || null,
        status: formData.status,
        install_date: formData.install_date || null,
        scheduled_date: formData.install_date || null,
        notes: formData.notes || null,
        updated_at: now,
        updated_by: appUserId,
      };

      const selectedMerchantName =
        merchants.find(
          (item) => item.id === formData.merchant_id
        )?.name || null;

      const selectedVendorName =
        vendors.find(
          (item) => item.id === formData.vendor_id
        )?.name || null;

      if (editingId) {
        const previousInstallation = installations.find(
          (item) => item.id === editingId
        );

        if (!previousInstallation) {
          throw new Error(
            "No se encontró la instalación que se está editando."
          );
        }

        const { error: updateError } = await supabase
          .from("installations")
          .update(payload)
          .eq("id", editingId);

        if (updateError) {
          throw new Error(
            `Error al editar instalación: ${updateError.message}`
          );
        }

        const statusChanged =
          previousInstallation.status !== formData.status;

        if (
          statusChanged &&
          formData.status === "cancelled"
        ) {
          await cancelInstallation({
            installation: previousInstallation,
            auditUser,
          });
        }

        if (
          statusChanged &&
          formData.status === "completed"
        ) {
          if (!previousInstallation.pos_id) {
            throw new Error(
              "La instalación no tiene un POS asociado."
            );
          }

          await completeInstallation({
            installationId: editingId,
            merchantId: previousInstallation.merchant_id,
            posId: previousInstallation.pos_id,
            vendorId: previousInstallation.vendor_id,
            auditUser,
            movementNote:
              "Instalación marcada como completada",
          });
        }

        if (statusChanged) {
          await registerStatusChange({
            installationId: editingId,
            previousStatus: previousInstallation.status,
            newStatus: formData.status,
            reason: formData.notes || null,
            appUserId,
          });
        }

        successMessage =
          formData.status === "completed"
            ? "La instalación se completó correctamente. El comercio quedó activo y el POS instalado."
            : formData.status === "cancelled"
            ? "La instalación se canceló correctamente y el POS volvió a stock."
            : "Instalación actualizada correctamente.";
        return;
      }

      const { data: createdInstallation, error: insertError } =
        await supabase
          .from("installations")
          .insert({
            ...payload,
            created_by: appUserId,
          })
          .select("id")
          .single();

      if (insertError || !createdInstallation?.id) {
        throw new Error(
          `Error al guardar instalación: ${
            insertError?.message ||
            "No se pudo obtener el identificador."
          }`
        );
      }

      await assignPosToMerchant({
        pos: selectedPos,
        merchantId: formData.merchant_id,
        vendorId: formData.vendor_id,
        merchantName: selectedMerchantName,
        vendorName: selectedVendorName,
        auditUser,
      });

      const { error: creationEventError } =
        await insertInstallationEvent({
          installationId: createdInstallation.id,
          eventType: "installation_created",
          title: "Instalación creada",
          description: formData.notes || null,
          newStatus: formData.status,
          appUserId,
        });

      if (creationEventError) {
        console.warn(
          "No se pudo registrar el evento de creación:",
          creationEventError.message
        );
      }

      const { error: initialHistoryError } =
        await insertInstallationStatusHistory({
          installationId: createdInstallation.id,
          previousStatus: null,
          newStatus: formData.status,
          reason: formData.notes || null,
          appUserId,
        });

      if (initialHistoryError) {
        console.warn(
          "No se pudo registrar el estado inicial:",
          initialHistoryError.message
        );
      }

      if (formData.status === "completed") {
        await completeInstallation({
          installationId: createdInstallation.id,
          merchantId: formData.merchant_id,
          posId: formData.pos_id,
          vendorId: formData.vendor_id,
          auditUser,
          movementNote:
            "Instalación creada directamente como completada",
        });
      }

      successMessage =
        formData.status === "completed"
          ? "La instalación se guardó como completada. El comercio quedó activo y el POS instalado."
          : "Instalación guardada correctamente.";
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "No se pudo guardar la instalación.";

      console.error(error);
      setMessage({
        type: "error",
        text: errorMessage,
      });
    } finally {
      setLoading(false);
      resetForm();
      await loadData();

      if (successMessage) {
        setMessage({
          type: "success",
          text: successMessage,
        });

        window.requestAnimationFrame(() => {
          window.scrollTo({
            top: 0,
            behavior: "smooth",
          });
        });
      }
    }
  };

  const handleEdit = (installation: Installation) => {
    setMessage(null);
    setEditingId(installation.id);
    setFormData({
      merchant_id: installation.merchant_id || "",
      vendor_id: installation.vendor_id || "",
      pos_id: installation.pos_id || "",
      status: installation.status || "pending",
      install_date: installation.install_date || "",
      notes: installation.notes || "",
    });

    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  };

  const requestDelete = (installation: Installation) => {
    setMessage(null);
    setInstallationToDelete(installation);
    setDeleteModalOpen(true);
  };

  const cancelDelete = () => {
    if (deleting) return;

    setDeleteModalOpen(false);
    setInstallationToDelete(null);
  };

  const confirmDelete = async () => {
    if (!installationToDelete) return;

    setDeleting(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from("installations")
        .delete()
        .eq("id", installationToDelete.id);

      if (error) {
        throw new Error(
          `Error al eliminar instalación: ${error.message}`
        );
      }

      if (editingId === installationToDelete.id) {
        resetForm();
      }

      await loadData();

      setDeleteModalOpen(false);
      setInstallationToDelete(null);
      setMessage({
        type: "success",
        text: "Instalación eliminada correctamente.",
      });
    } catch (error) {
      console.error(error);

      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "No se pudo eliminar la instalación.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const filteredInstallations = useMemo(() => {
    const text = search.trim().toLowerCase();

    return installations.filter((item) => {
      if (!text) return true;

      return (
        getMerchantName(item.merchant_id).toLowerCase().includes(text) ||
        getVendorName(item.vendor_id).toLowerCase().includes(text) ||
        getPosCode(item.pos_id).toLowerCase().includes(text) ||
        getStatusLabel(item.status).toLowerCase().includes(text) ||
        (item.notes || "").toLowerCase().includes(text) ||
        (item.install_date || "").toLowerCase().includes(text)
      );
    });
  }, [installations, search, merchants, vendors, posDevices]);

  const assignedMerchantPosList = formData.merchant_id
    ? getAssignedMerchantPosList(formData.merchant_id)
    : [];

  const eligiblePosList = getEligiblePosListForMerchant(
    formData.merchant_id,
    formData.vendor_id
  );
  const selectablePosList = getSelectablePosList();

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto px-6">
        <PageHeader
          title="Instalaciones"
          description="Gestioná la programación, ejecución y cierre de las instalaciones de equipos POS."
        />

        <NotificationBanner
          message={message}
          onClose={() => setMessage(null)}
          className="mb-5"
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(380px,0.85fr)]">
          <FormCard
            title={editingId ? "Editar instalación" : "Nueva instalación"}
            description={
              editingId
                ? "Actualizá el estado, la fecha o las notas sin modificar el comercio ni el POS."
                : "Seleccioná un comercio y uno de sus POS elegibles para programar la instalación."
            }
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className={labelClassName}>Comercio</label>
                <select
                  className={fieldClassName}
                  value={formData.merchant_id}
                  onChange={(event) =>
                    handleChange("merchant_id", event.target.value)
                  }
                  disabled={!!editingId || loading}
                >
                  <option value="">Seleccionar comercio</option>
                  {merchants.map((merchant) => (
                    <option key={merchant.id} value={merchant.id}>
                      {merchant.name || "Sin nombre"}
                    </option>
                  ))}
                </select>
              </div>

              {formData.merchant_id ? (
                <InfoCard
                  eyebrow="Comercio seleccionado"
                  title={getMerchantName(formData.merchant_id)}
                >
                  <div className="grid gap-3 sm:grid-cols-3">
                    <InfoItem
                      label="Vendedor asignado"
                      value={getVendorName(formData.vendor_id)}
                    />
                    <InfoItem
                      label="POS asignados"
                      value={assignedMerchantPosList.length}
                    />
                    <InfoItem
                      label="POS elegibles"
                      value={eligiblePosList.length}
                    />
                  </div>
                </InfoCard>
              ) : null}

              <div>
                <label className={labelClassName}>Vendedor</label>
                <select
                  className={fieldClassName}
                  value={formData.vendor_id}
                  onChange={(event) =>
                    handleChange("vendor_id", event.target.value)
                  }
                  disabled={!!editingId || loading}
                >
                  <option value="">Seleccionar vendedor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name || "Sin nombre"}
                    </option>
                  ))}
                </select>

                {!formData.vendor_id && formData.merchant_id ? (
                  <p className={errorTextClassName}>
                    Este comercio no tiene un vendedor asignado.
                  </p>
                ) : (
                  <p className={helpTextClassName}>
                    El vendedor se toma automáticamente del comercio.
                  </p>
                )}
              </div>

              <div>
                <label className={labelClassName}>
                  {editingId ? "POS de la instalación" : "POS elegible"}
                </label>
                <select
                  className={fieldClassName}
                  value={formData.pos_id}
                  onChange={(event) =>
                    handleChange("pos_id", event.target.value)
                  }
                  disabled={!!editingId || loading}
                >
                  <option value="">Seleccionar POS</option>
                  {selectablePosList.map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.code || "Sin código"}
                    </option>
                  ))}
                </select>

                {!editingId &&
                formData.merchant_id &&
                eligiblePosList.length === 0 ? (
                  <p className={errorTextClassName}>
                    No hay POS elegibles para este comercio. El POS debe estar
                    previamente asignado al vendedor del comercio o al mismo
                    comercio.
                  </p>
                ) : null}

                {!editingId &&
                formData.merchant_id &&
                eligiblePosList.length > 0 ? (
                  <p className={helpTextClassName}>
                    Se muestran solamente equipos del vendedor del comercio o
                    equipos ya asignados al comercio sin una instalación activa.
                  </p>
                ) : null}

                {editingId ? (
                  <p className={helpTextClassName}>
                    En edición podés actualizar estado, fecha y notas sin cambiar
                    el equipo asociado.
                  </p>
                ) : null}
              </div>

              {formData.pos_id ? (
                <InfoCard
                  eyebrow="POS seleccionado"
                  title={getPosCode(formData.pos_id)}
                  badge={
                    <StatusBadge
                      label={
                        posDevices.find(
                          (item) => item.id === formData.pos_id
                        )?.status === "assigned_merchant"
                          ? "Asignado al comercio"
                          : "Asignado al vendedor"
                      }
                      tone="info"
                    />
                  }
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoItem
                      label="Comercio"
                      value={getMerchantName(formData.merchant_id)}
                    />
                    <InfoItem
                      label="Vendedor"
                      value={getVendorName(formData.vendor_id)}
                    />
                  </div>
                </InfoCard>
              ) : null}

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClassName}>Estado</label>
                  <select
                    className={fieldClassName}
                    value={formData.status}
                    onChange={(event) =>
                      handleChange("status", event.target.value)
                    }
                    disabled={loading}
                  >
                    <option value="pending">Pendiente</option>
                    <option value="in_progress">En proceso</option>
                    <option value="completed">Completada</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                </div>

                <div>
                  <label className={labelClassName}>
                    Fecha de instalación
                    {formData.status === "completed" ? " *" : ""}
                  </label>
                  <input
                    type="date"
                    required={formData.status === "completed"}
                    className={fieldClassName}
                    value={formData.install_date}
                    onChange={(event) =>
                      handleChange("install_date", event.target.value)
                    }
                    disabled={loading}
                  />
                </div>
              </div>

              {formData.status === "completed" ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Al completar la instalación, el comercio quedará activo y el
                  POS pasará al estado instalado.
                </div>
              ) : null}

              {formData.status === "cancelled" ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Al cancelar la instalación, el POS asociado volverá a stock.
                </div>
              ) : null}

              <div>
                <label className={labelClassName}>Notas</label>
                <textarea
                  className={fieldClassName}
                  rows={4}
                  value={formData.notes}
                  onChange={(event) =>
                    handleChange("notes", event.target.value)
                  }
                  placeholder="Detalle de la puesta en marcha..."
                  disabled={loading}
                />
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row">
                <PrimaryButton
                  type="submit"
                  loading={loading}
                  loadingLabel="Guardando..."
                  disabled={
                    !editingId &&
                    (!formData.merchant_id ||
                      !formData.vendor_id ||
                      eligiblePosList.length === 0)
                  }
                >
                  {editingId
                    ? "Actualizar instalación"
                    : "Guardar instalación"}
                </PrimaryButton>

                {editingId ? (
                  <SecondaryButton
                    type="button"
                    onClick={resetForm}
                    disabled={loading}
                  >
                    Cancelar edición
                  </SecondaryButton>
                ) : null}
              </div>
            </form>
          </FormCard>

          <FormCard
            title="Listado de instalaciones"
            description={`${filteredInstallations.length} de ${installations.length} instalaciones`}
            className="flex min-h-[620px] flex-col"
          >
            <SearchToolbar
              value={search}
              onChange={setSearch}
              onClear={() => setSearch("")}
              placeholder="Buscar por comercio, vendedor, POS, estado, fecha o nota..."
            />

            <div className="mt-5 flex-1">
              {filteredInstallations.length === 0 ? (
                <EmptyState
                  title={
                    installations.length === 0
                      ? "No hay instalaciones cargadas"
                      : "No se encontraron resultados"
                  }
                  description={
                    installations.length === 0
                      ? "Las instalaciones que registres aparecerán en este listado."
                      : "Probá con otro comercio, vendedor, POS, estado, fecha o nota."
                  }
                />
              ) : (
                <div className="max-h-[680px] space-y-3 overflow-auto pr-1">
                  {filteredInstallations.map((item) => {
                    const statusTone =
                      item.status === "completed"
                        ? "success"
                        : item.status === "in_progress"
                          ? "info"
                          : item.status === "cancelled"
                            ? "danger"
                            : "warning";

                    return (
                      <article
                        key={item.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-slate-900">
                              {getMerchantName(item.merchant_id)}
                            </p>

                            <div className="mt-2">
                              <StatusBadge
                                label={getStatusLabel(item.status)}
                                tone={statusTone}
                              />
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-wrap gap-2">
                            <SecondaryButton
                              type="button"
                              onClick={() => handleEdit(item)}
                              className="px-3 py-2 text-xs"
                            >
                              Editar
                            </SecondaryButton>

                            <DangerButton
                              type="button"
                              onClick={() => requestDelete(item)}
                              className="px-3 py-2 text-xs"
                            >
                              Eliminar
                            </DangerButton>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <InfoItem
                            label="Vendedor"
                            value={getVendorName(item.vendor_id)}
                            className="border border-slate-100"
                          />
                          <InfoItem
                            label="POS"
                            value={getPosCode(item.pos_id)}
                            className="border border-slate-100"
                          />
                          <InfoItem
                            label="Fecha"
                            value={item.install_date || "-"}
                            className="border border-slate-100"
                          />
                          <InfoItem
                            label="Notas"
                            value={item.notes || "-"}
                            className="border border-slate-100"
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </FormCard>
        </div>
      </div>

      <ConfirmModal
        open={deleteModalOpen}
        title="Eliminar instalación"
        description={
          installationToDelete
            ? `¿Confirmás eliminar la instalación de ${getMerchantName(
                installationToDelete.merchant_id
              )}? Esta acción no se puede deshacer.`
            : "¿Confirmás eliminar esta instalación?"
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </main>
  );
}