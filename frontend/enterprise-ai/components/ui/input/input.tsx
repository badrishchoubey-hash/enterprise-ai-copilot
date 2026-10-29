"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error, ...props }, ref) => (
    <div className="w-full">
      <input
        ref={ref}
        className={`h-11 w-full rounded-xl border border-[#e1e5ed] px-4 text-sm outline-none transition placeholder:text-[#a6adba] focus:border-[#716be8] focus:ring-2 focus:ring-[#716be8]/10 ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  ),
);
Input.displayName = "Input";
export default Input;
