"use client";
import { forwardRef, type SelectHTMLAttributes } from "react";
export interface DropdownOption {
  readonly label: string;
  readonly value: string;
}
interface DropdownProps extends SelectHTMLAttributes<HTMLSelectElement> {
  readonly options: readonly DropdownOption[];
  readonly error?: string;
}
const Dropdown = forwardRef<HTMLSelectElement, DropdownProps>(
  ({ options, error, className = "", ...props }, ref) => (
    <div className="w-full">
      <select
        ref={ref}
        className={`h-11 w-full rounded-xl border border-[#e1e5ed] bg-white px-4 text-sm text-[#526074] outline-none transition focus:border-[#716be8] focus:ring-2 focus:ring-[#716be8]/10 ${className}`}
        {...props}
      >
        <option value="">Select a role</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  ),
);
Dropdown.displayName = "Dropdown";
export default Dropdown;
