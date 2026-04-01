"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";

type Vendor = {
  id: string;
  name: string | null;
};

type Merchant = {
  id: string;
  name: string | null;
  vendor_id: string | null;
};

type AppUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
};

type PosDevice = {
  id: string;
  code: string | null;
  brand: string | null;
  model: string | null;
  serial: string | null;
  imei: string | null;
  imei_2: string | null;
  status: string | null;
  vendor_id: string | null;
  merchant_id: string | null;
  created_at: string;
};

const initialForm = {
  code: "",
  brand: "",
  model: "",
  serial: "",
  imei: "",
  imei_2: "",
  status: "in_stock",
  vendor_id: "",
  merchant_id: "",
};

export default function PosClient({
  canDeletePos,
}: {
  canDeletePos: boolean;
}) {
  const supabase = createClient();

  const [formData, setFormData] = useState(initialForm);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [posDevices, setPosDevices] = useState<PosDevice[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [merchantFilter, setMerchantFilter] = useState("");

  // 🔥 NUEVA FUNCIÓN FILTRADA
  const loadPosDevices = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      setPosDevices([]);
      return;
    }

    const { data: appUser } = await supabase
      .from("app_users")
      .select("role")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    // 👉 SI ES VENDEDOR
    if (appUser?.role === "vendedor") {
      const { data: vendor } = await supabase
        .from("vendors")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!vendor?.id) {
        setPosDevices([]);
        return;
      }

      const { data: merchantRows } = await supabase
        .from("merchants")
        .select("id")
        .eq("vendor_id", vendor.id);

      const merchantIds = merchantRows?.map((m) => m.id) || [];

      if (merchantIds.length === 0) {
        setPosDevices([]);
        return;
      }

      const { data, error } = await supabase
        .from("pos_devices")
        .select("*")
        .in("merchant_id", merchantIds)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error POS vendedor:", error.message);
        setPosDevices([]);
        return;
      }

      setPosDevices(data || []);
      return;
    }

    // 👉 ADMIN / OTROS
    const { data, error } = await supabase
      .from("pos_devices")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error POS:", error.message);
      return;
    }

    setPosDevices(data || []);
  };

  const loadVendors = async () => {
    const { data } = await supabase
      .from("vendors")
      .select("id, name")
      .order("name");

    setVendors(data || []);
  };

  const loadMerchants = async () => {
    const { data } = await supabase
      .from("merchants")
      .select("id, name, vendor_id")
      .order("name");

    setMerchants(data || []);
  };

  useEffect(() => {
    loadVendors();
    loadMerchants();
    loadPosDevices();
  }, []);

  const getVendorName = (id: string | null) =>
    vendors.find((v) => v.id === id)?.name || "-";

  const getMerchantName = (id: string | null) =>
    merchants.find((m) => m.id === id)?.name || "-";

  const filteredPosDevices = useMemo(() => {
    const text = search.toLowerCase();

    return posDevices.filter((pos) => {
      const matchesSearch =
        !text ||
        (pos.code || "").toLowerCase().includes(text) ||
        (pos.serial || "").toLowerCase().includes(text);

      const matchesStatus = !statusFilter || pos.status === statusFilter;
      const matchesVendor = !vendorFilter || pos.vendor_id === vendorFilter;
      const matchesMerchant =
        !merchantFilter || pos.merchant_id === merchantFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesVendor &&
        matchesMerchant
      );
    });
  }, [posDevices, search, statusFilter, vendorFilter, merchantFilter]);

  const handleExportExcel = () => {
    const data = filteredPosDevices.map((p) => ({
      Codigo: p.code,
      Serial: p.serial,
      Estado: p.status,
      Vendedor: getVendorName(p.vendor_id),
      Comercio: getMerchantName(p.merchant_id),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "POS");
    XLSX.writeFile(wb, "pos.xlsx");
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-6">POS</h1>

      <button
        onClick={handleExportExcel}
        className="mb-4 bg-green-600 text-white px-4 py-2 rounded"
      >
        Exportar Excel
      </button>

      <div className="bg-white p-4 rounded shadow">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th>Código</th>
              <th>Serial</th>
              <th>Estado</th>
              <th>Vendedor</th>
              <th>Comercio</th>
            </tr>
          </thead>
          <tbody>
            {filteredPosDevices.map((pos) => (
              <tr key={pos.id}>
                <td>{pos.code}</td>
                <td>{pos.serial}</td>
                <td>{pos.status}</td>
                <td>{getVendorName(pos.vendor_id)}</td>
                <td>{getMerchantName(pos.merchant_id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}