import { Button as HeadlessButton, Description, Field, Input, Label, Select } from "@headlessui/react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const controlClassName =
  "rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-[--accent] focus:ring-2 focus:ring-[--accent]/15 disabled:bg-surface-muted disabled:text-ink-subtle";

type SettingFieldProps = {
  label: string;
  description?: string;
  error?: string;
  wide?: boolean;
  children: ReactNode;
};

export function SettingField({ label, description, error, wide = false, children }: SettingFieldProps) {
  return (
    <Field
      className={
        wide
          ? "grid gap-2"
          : "grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] sm:items-start sm:gap-4"
      }
    >
      <div className="min-w-0">
        <Label className="text-sm font-medium text-ink">{label}</Label>
        {description ? <Description className="mt-1 text-xs leading-relaxed text-ink-subtle">{description}</Description> : null}
      </div>
      <div className="min-w-0">
        {children}
        {error ? <div className="mt-1 text-xs leading-relaxed text-danger">{error}</div> : null}
      </div>
    </Field>
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export function TextInput({ className, ...props }: TextInputProps) {
  return <Input {...props} className={cn(controlClassName, className)} />;
}

type SelectInputProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export function SelectInput({ className, ...props }: SelectInputProps) {
  return <Select {...props} className={cn(controlClassName, className)} />;
}

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const buttonClassName: Record<NonNullable<ActionButtonProps["variant"]>, string> = {
  primary: "bg-[--accent] text-white hover:brightness-95 disabled:opacity-40",
  secondary: "border border-border-strong bg-surface text-ink hover:bg-surface-muted disabled:opacity-40",
  ghost: "text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-40",
  danger: "text-danger-strong hover:bg-danger-soft disabled:opacity-40",
};

export function ActionButton({ variant = "secondary", className, type = "button", ...props }: ActionButtonProps) {
  return (
    <HeadlessButton
      {...props}
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium outline-none transition focus:ring-2 focus:ring-[--accent]/20",
        buttonClassName[variant],
        className,
      )}
    />
  );
}
