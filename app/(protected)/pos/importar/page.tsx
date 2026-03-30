"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";

type PosRow = {
  code: string;
  brand: string;
  model: string;
  serial: string;
  imei: string;
  imei_2?: string;
};

type PreviewRow = PosRow & {
  valid: boolean;
  error?: string;
};

type AppUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
};

export default function ImportarPosPage() {
  const supabase = createClient();

  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");

  const normalize = (value: unknown) =>
    String(value || "").trim().toLowerCase();

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
      .eq("email", user.email)
      .maybeSingle();

    if (error) {
      console.error("Error al obtener usuario auditoría:", error.message);
      return {
        id: user.id,
        name: user.email,
        email: user.email,
        role: null,
      };
    }

    if (!data) {
      return {
        id: user.id,
        name: user.email,
        email: user.email,
        role: null,
      };
    }

    return data;
  };

  const validateRow = (row: any): PreviewRow => {
    const normalized: PosRow = {
      code: String(row.code || "").trim(),
      brand: String(row.brand || "").trim(),
      model: String(row.model || "").trim(),
      serial: String(row.serial || "").trim(),
      imei: String(row.imei || "").trim(),
      imei_2: String(row.imei_2 || "").trim(),
    };

    if (!normalized.code) {
      return { ...normalized, valid: false, error: "Falta code" };
    }

    if (!normalized.brand) {
      return { ...normalized, valid: false, error: "Falta brand" };
    }

    if (!normalized.model) {
      return { ...normalized, valid: false, error: "Falta model" };
    }

    if (!normalized.serial) {
      return { ...normalized, valid: false, error: "Falta serial" };
    }

    if (!normalized.imei) {
      return { ...normalized, valid: false, error: "Falta imei" };
    }

    return {
      ...normalized,
      valid: true,
    };
  };

  const markInternalDuplicates = (validatedRows: PreviewRow[]): PreviewRow[] => {
    const codeMap = new Map<string, number>();
    const serialMap = new Map<string, number>();
    const imeiMap = new Map<string, number>();

    for (const row of validatedRows) {
      const code = normalize(row.code);
      const serial = normalize(row.serial);
      const imei = normalize(row.imei);
      const imei2 = normalize(row.imei_2);

      if (code) codeMap.set(code, (codeMap.get(code) || 0) + 1);
      if (serial) serialMap.set(serial, (serialMap.get(serial) || 0) + 1);
      if (imei) imeiMap.set(imei, (imeiMap.get(imei) || 0) + 1);
      if (imei2) imeiMap.set(imei2, (imeiMap.get(imei2) || 0) + 1);
    }

    return validatedRows.map((row) => {
      if (!row.valid) return row;

      const code = normalize(row.code);
      const serial = normalize(row.serial);
      const imei = normalize(row.imei);
      const imei2 = normalize(row.imei_2);

      if (code && (codeMap.get(code) || 0) > 1) {
        return {
          ...row,
          valid: false,
          error: `Code duplicado en el Excel: ${row.code}`,
        };
      }

      if (serial && (serialMap.get(serial) || 0) > 1) {
        return {
          ...row,
          valid: false,
          error: `Serial duplicado en el Excel: ${row.serial}`,
        };
      }

      if (imei && (imeiMap.get(imei) || 0) > 1) {
        return {
          ...row,
          valid: false,
          error: `IMEI duplicado en el Excel: ${row.imei}`,
        };
      }

      if (imei2 && (imeiMap.get(imei2) || 0) > 1) {
        return {
          ...row,
          valid: false,
          error: `IMEI 2 duplicado en el Excel: ${row.imei_2}`,
        };
      }

      return row;
    });
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        code: "POS001",
        brand: "UROVO",
        model: "i9100",
        serial: "SRL001",
        imei: "111111111111111",
        imei_2: "222222222222222",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla POS");
    XLSX.writeFile(workbook, "plantilla_importacion_pos.xlsx");
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    const validatedRows = jsonData.map(validateRow);
    const rowsWithInternalChecks = markInternalDuplicates(validatedRows);

    setRows(rowsWithInternalChecks);
  };

  const handleImport = async () => {
    const validRows = rows.filter((row) => row.valid);

    if (validRows.length === 0) {
      alert("No hay filas válidas para importar.");
      return;
    }

    setLoading(true);

    const auditUser = await getCurrentAuditUser();

    let importedCount = 0;
    let movementErrorCount = 0;

    const duplicatedCodes: string[] = [];
    const duplicatedSerials: string[] = [];
    const duplicatedImeis: string[] = [];
    const otherErrors: string[] = [];

    try {
      for (const row of validRows) {
        const { data, error } = await supabase
          .from("pos_devices")
          .insert([
            {
              code: row.code,
              brand: row.brand,
              model: row.model,
              serial: row.serial,
              imei: row.imei,
              imei_2: row.imei_2 || null,
              status: "in_stock",
              vendor_id: null,
              merchant_id: null,
            },
          ])
          .select()
          .single();

        if (error) {
          const message = (error.message || "").toLowerCase();

          if (message.includes("pos_devices_code_unique")) {
            duplicatedCodes.push(row.code);
          } else if (message.includes("pos_devices_serial_unique")) {
            duplicatedSerials.push(row.serial);
          } else if (message.includes("pos_devices_imei_unique")) {
            duplicatedImeis.push(row.imei);
          } else if (message.includes("pos_devices_imei_2_unique")) {
            duplicatedImeis.push(row.imei_2 || row.imei);
          } else {
            otherErrors.push(`${row.code}: ${error.message}`);
          }

          console.error("Error insertando POS:", row.code, error.message);
          continue;
        }

        importedCount++;

        const { error: movementError } = await supabase
          .from("pos_movements")
          .insert([
            {
              pos_id: data.id,
              pos_code: row.code,
              type: "ingreso_stock",
              vendor_id: null,
              vendor_name: null,
              merchant_id: null,
              merchant_name: null,
              user_id: auditUser?.id || null,
              user_name: auditUser?.name || null,
              user_email: auditUser?.email || null,
              user_role: auditUser?.role || null,
              notes: "Importación masiva desde Excel",
            },
          ]);

        if (movementError) {
          movementErrorCount++;
          console.error(
            "Error creando movimiento:",
            row.code,
            movementError.message
          );
        }
      }

      const summary: string[] = [];
      summary.push(`Importación finalizada.`);
      summary.push(`Importados correctamente: ${importedCount}.`);

      const totalDuplicates =
        duplicatedCodes.length +
        duplicatedSerials.length +
        duplicatedImeis.length;

      if (totalDuplicates > 0) {
        summary.push(`Duplicados omitidos: ${totalDuplicates}.`);
      }

      if (duplicatedCodes.length > 0) {
        summary.push(`Códigos duplicados: ${duplicatedCodes.join(", ")}.`);
      }

      if (duplicatedSerials.length > 0) {
        summary.push(`Seriales duplicados: ${duplicatedSerials.join(", ")}.`);
      }

      if (duplicatedImeis.length > 0) {
        summary.push(`IMEI duplicados: ${duplicatedImeis.join(", ")}.`);
      }

      if (movementErrorCount > 0) {
        summary.push(
          `Movimientos no registrados: ${movementErrorCount}. Los POS igualmente fueron importados.`
        );
      }

      if (otherErrors.length > 0) {
        summary.push(`Otros errores: ${otherErrors.length}.`);
        summary.push(otherErrors.slice(0, 5).join(" | "));
      }

      alert(summary.join("\n"));

      setRows([]);
      setFileName("");
    } catch (err) {
      console.error(err);
      alert("Ocurrió un error durante la importación.");
    } finally {
      setLoading(false);
    }
  };

  const validCount = rows.filter((r) => r.valid).length;
  const invalidCount = rows.filter((r) => !r.valid).length;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-6">Importar POS desde Excel</h1>

      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-white text-sm font-medium hover:bg-emerald-700 transition"
            >
              Descargar plantilla de ejemplo
            </button>
          </div>

          <div className="text-sm text-slate-500 space-y-2">
            <p>Usá esta plantilla para cargar el stock inicial de POS.</p>
            <p>
              El estado <strong>no se carga en el Excel</strong>: todos los
              equipos importados ingresan automáticamente como{" "}
              <strong>En stock</strong>.
            </p>
            <p>
              Después, desde el módulo de <strong>Asignaciones</strong>, podés
              cambiar el estado a vendedor, comercio, mantenimiento o retorno a
              stock.
            </p>
          </div>

          <div>
            <p className="block text-sm font-medium mb-2">
              Seleccionar archivo Excel
            </p>

            <label className="inline-block">
              <span className="cursor-pointer inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700 transition">
                📂 Seleccionar archivo
              </span>

              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {fileName && (
              <p className="mt-2 text-sm text-slate-600">
                Archivo cargado: <strong>{fileName}</strong>
              </p>
            )}
          </div>

          {rows.length > 0 && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-slate-500">Total filas</p>
                  <p className="text-2xl font-bold">{rows.length}</p>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="text-sm text-slate-500">Válidas</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {validCount}
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="text-sm text-slate-500">Con error</p>
                  <p className="text-2xl font-bold text-rose-600">
                    {invalidCount}
                  </p>
                </div>
              </div>

              <div className="overflow-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-3 text-left">Code</th>
                      <th className="p-3 text-left">Brand</th>
                      <th className="p-3 text-left">Model</th>
                      <th className="p-3 text-left">Serial</th>
                      <th className="p-3 text-left">IMEI</th>
                      <th className="p-3 text-left">IMEI 2</th>
                      <th className="p-3 text-left">Estado inicial</th>
                      <th className="p-3 text-left">Validación</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-3">{row.code}</td>
                        <td className="p-3">{row.brand}</td>
                        <td className="p-3">{row.model}</td>
                        <td className="p-3">{row.serial}</td>
                        <td className="p-3">{row.imei}</td>
                        <td className="p-3">{row.imei_2 || "-"}</td>
                        <td className="p-3">En stock</td>
                        <td className="p-3">
                          {row.valid ? (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                              OK
                            </span>
                          ) : (
                            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                              {row.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={handleImport}
                disabled={loading || validCount === 0}
                className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
              >
                {loading ? "Importando..." : "Confirmar importación"}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}