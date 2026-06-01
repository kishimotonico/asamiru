import { Button as HeadlessButton, Description, Field, Input, Label, Select } from "@headlessui/react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

const controlClassName =
  "rounded-md border border-[#d4d1c9] bg-white px-3 py-2 text-sm text-[#1f2024] outline-none transition focus:border-[--accent] focus:ring-2 focus:ring-[--accent]/15 disabled:bg-[#f5f3ee] disabled:text-[#9aa0aa]";

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
        <Label className="text-sm font-medium text-[#1f2024]">{label}</Label>
        {description ? <Description className="mt-1 text-xs leading-relaxed text-[#9aa0aa]">{description}</Description> : null}
      </div>
      <div className="min-w-0">
        {children}
        {error ? <div className="mt-1 text-xs leading-relaxed text-[#c14b3a]">{error}</div> : null}
      </div>
    </Field>
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export function TextInput({ className = "", ...props }: TextInputProps) {
  return <Input {...props} className={`${controlClassName} ${className}`} />;
}

type SelectInputProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export function SelectInput({ className = "", ...props }: SelectInputProps) {
  return <Select {...props} className={`${controlClassName} ${className}`} />;
}

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const buttonClassName: Record<NonNullable<ActionButtonProps["variant"]>, string> = {
  primary: "bg-[--accent] text-white hover:brightness-95 disabled:opacity-40",
  secondary: "border border-[#d4d1c9] bg-white text-[#1f2024] hover:bg-[#f5f3ee] disabled:opacity-40",
  ghost: "text-[#6e7480] hover:bg-[#f5f3ee] hover:text-[#1f2024] disabled:opacity-40",
  danger: "text-[#9a3d30] hover:bg-[#f8ebe8] disabled:opacity-40",
};

export function ActionButton({ variant = "secondary", className = "", type = "button", ...props }: ActionButtonProps) {
  return (
    <HeadlessButton
      {...props}
      type={type}
      className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium outline-none transition focus:ring-2 focus:ring-[--accent]/20 ${buttonClassName[variant]} ${className}`}
    />
  );
}
