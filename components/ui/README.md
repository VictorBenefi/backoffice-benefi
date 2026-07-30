# BENEFI Design System — Primera base

Copiar los archivos de:

`src/components/ui/`

a la misma carpeta del proyecto BackOffice BENEFI.

No reemplazar:

- `NotificationBanner.tsx`
- `ConfirmModal.tsx`

Los componentes nuevos no modifican lógica de negocio. Solo estandarizan:

- encabezados
- tarjetas
- campos
- botones
- badges
- buscadores
- estados vacíos

## Uso recomendado

```tsx
import {
  PageHeader,
  FormCard,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  fieldClassName,
  labelClassName,
} from "@/components/ui";
```

Si el proyecto no admite imports desde el archivo `index.ts`, importar cada componente directamente.
