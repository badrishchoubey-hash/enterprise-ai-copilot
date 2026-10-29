"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "icon";
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}
const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[#5146e5] text-white shadow-lg shadow-[#5146e5]/20 hover:bg-[#453bd0]",
  secondary:
    "border border-[#e4e7ee] bg-white text-[#687386] hover:border-[#8b85ed] hover:text-[#5146e5]",
  ghost: "text-[#6e7a8d] hover:bg-[#f6f7fa]",
  icon: "p-2 text-[#6e7a8d] hover:bg-[#f6f7fa]",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className = "", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    />
  ),
);
Button.displayName = "Button";
export default Button;
