"use client";

import { useState } from "react";
import { useField } from "formik";
import { Check, Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div>
      <div className="field">
        <label className="field-label" htmlFor={name}>
          {label}
          {required ? " *" : ""}
        </label>
        <div className={isPassword ? "relative" : undefined}>
          <input
            id={name}
            name={field.name}
            className="field-value input"
            type={isPassword && showPassword ? "text" : type}
            placeholder={placeholder}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            disabled={disabled}
            style={isPassword ? { paddingRight: 40 } : undefined}
          />
          {isPassword ? (
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 4,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "#6c7a93",
              }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          ) : null}
        </div>
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
