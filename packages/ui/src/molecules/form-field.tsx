import type { ReactNode } from "react";
import { Label } from "@pos-apps/ui/atoms/label";

export function FormField({
  id,
  label,
  hint,
  required,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export const formInputClass = "";

export { nativeSelectClassName as formSelectClass } from "@pos-apps/ui/atoms/native-select";

export const formTextareaClass = "";
