"use client";

import { useField } from "formik";
import { Check } from "lucide-react";
import { PasswordInput } from "@/components/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function FormField({
  name,
  label,
  placeholder,
  type = "text",
  required = false,
  disabled = false,
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const [field, meta] = useField(name);
  const isPassword = type === "password";
  return (
    <div>
      <div className="field">
        <label className="field-label" htmlFor={name}>
          {label}
          {required ? " *" : ""}
        </label>
        {isPassword ? (
          <PasswordInput
            id={name}
            name={field.name}
            className="field-value input"
            style={{ paddingRight: 40 }}
            placeholder={placeholder}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            disabled={disabled}
          />
        ) : (
          <input
            id={name}
            name={field.name}
            className="field-value input"
            type={type}
            placeholder={placeholder}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            disabled={disabled}
          />
        )}
      </div>
      {meta.touched && meta.error ? <div className="field-error">{meta.error}</div> : null}
    </div>
  );
}

export function FormTextareaField({
  name,
  label,
  placeholder,
  rows = 3,
  required = false,
  disabled = false,
}: {
  name: string;
  label: string;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  disabled?: boolean;
}) {
  const [field, meta] = useField(name);
  return (
    <div>
      <div className="field">
        <label className="field-label" htmlFor={name}>
          {label}
          {required ? " *" : ""}
        </label>
        <textarea
          id={name}
          name={field.name}
          className="field-value input"
          rows={rows}
          placeholder={placeholder}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          disabled={disabled}
        />
      </div>
      {meta.touched && meta.error ? <div className="field-error">{meta.error}</div> : null}
    </div>
  );
}

export function FormSelectField({
  name,
  label,
  options,
  placeholder,
  required = false,
  disabled = false,
}: {
  name: string;
  label?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const [field, meta, helpers] = useField(name);
  return (
    <div>
      <div className="field">
        {label ? (
          <label className="field-label" htmlFor={name}>
            {label}
            {required ? " *" : ""}
          </label>
        ) : null}
        <Select
          name={name}
          value={field.value ?? ""}
          onValueChange={(value) => helpers.setValue(value)}
          onOpenChange={() => helpers.setTouched(true)}
          items={options.map((o) => ({ value: o.value, label: o.label }))}
          disabled={disabled}
        >
          <SelectTrigger id={name} className="w-full bg-transparent">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {meta.touched && meta.error ? <div className="field-error">{meta.error}</div> : null}
    </div>
  );
}

export function FormCheckboxField({
  name,
  label,
  description,
  disabled = false,
}: {
  name: string;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const [field, meta, helpers] = useField({ name, type: "checkbox" });
  const checked = Boolean(field.value);
  return (
    <div>
      <label
        className="checkbox"
        style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 }}
      >
        <input
          type="checkbox"
          name={field.name}
          checked={checked}
          onChange={field.onChange}
          onBlur={field.onBlur}
          disabled={disabled}
          className="hidden"
        />
        <span
          className={`checkbox-box${checked ? " checked" : ""}`}
          onClick={() => helpers.setValue(!checked)}
        >
          <Check size={12} strokeWidth={3.5} color="#ffffff" />
        </span>
        <span className="checkbox-label">
          {label}
          {description ? (
            <span className="block font-normal text-[12px] font-medium text-[#6c7a93]" style={{ fontWeight: 500 }}>
              {description}
            </span>
          ) : null}
        </span>
      </label>
      {meta.touched && meta.error ? <div className="field-error">{meta.error}</div> : null}
    </div>
  );
}

export function FormToggleField({
  name,
  label,
  description,
  disabled = false,
}: {
  name: string;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const [field, meta, helpers] = useField({ name, type: "checkbox" });
  const on = Boolean(field.value);
  return (
    <div>
      <label className="checkbox" style={{ opacity: disabled ? 0.6 : 1 }}>
        <input
          type="checkbox"
          name={field.name}
          checked={on}
          onChange={field.onChange}
          onBlur={field.onBlur}
          disabled={disabled}
          className="hidden"
        />
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
          className={`toggle ${on ? "on" : "off"}`}
          onClick={() => helpers.setValue(!on)}
        >
          <div className="toggle-knob" />
        </button>
        <span className="checkbox-label">
          {label}
          {description ? (
            <span className="block font-normal text-[12px]" style={{ fontWeight: 500 }}>
              {description}
            </span>
          ) : null}
        </span>
      </label>
      {meta.touched && meta.error ? <div className="field-error">{meta.error}</div> : null}
    </div>
  );
}
