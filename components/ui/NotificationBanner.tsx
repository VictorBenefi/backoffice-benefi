"use client";

export type NotificationType =
  | "success"
  | "error"
  | "warning"
  | "info";

export type NotificationMessage = {
  type: NotificationType;
  text: string;
};

type NotificationBannerProps = {
  message: NotificationMessage | null;
  onClose?: () => void;
  className?: string;
};

const styles: Record<NotificationType, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700",
  error:
    "border-red-200 bg-red-50 text-red-700",
  warning:
    "border-amber-200 bg-amber-50 text-amber-800",
  info:
    "border-blue-200 bg-blue-50 text-blue-700",
};

const labels: Record<NotificationType, string> = {
  success: "Operación realizada",
  error: "No se pudo completar",
  warning: "Atención",
  info: "Información",
};

export default function NotificationBanner({
  message,
  onClose,
  className = "",
}: NotificationBannerProps) {
  if (!message) return null;

  return (
    <div
      role={message.type === "error" ? "alert" : "status"}
      aria-live={message.type === "error" ? "assertive" : "polite"}
      className={`rounded-xl border px-4 py-3 text-sm ${styles[message.type]} ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold">
            {labels[message.type]}
          </p>

          <p className="mt-1 leading-5">
            {message.text}
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold opacity-70 transition hover:bg-black/5 hover:opacity-100"
            aria-label="Cerrar mensaje"
          >
            Cerrar
          </button>
        )}
      </div>
    </div>
  );
}