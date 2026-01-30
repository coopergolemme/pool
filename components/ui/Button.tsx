import React, { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md";
}

export function Button({
  className = "",
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  const baseStyles =
    "rounded-2xl border uppercase tracking-[0.25em] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-70 active:translate-y-[0px] font-semibold";
  
  const variants = {
    primary:
      "border-[#caa468] bg-[#caa468] text-black hover:shadow-[0_12px_30px_rgba(202,164,104,0.45)]",
    secondary: "border-white/20 bg-white/10 text-white hover:border-white/40",
    outline: "border-white/10 bg-transparent text-white/70 hover:text-white hover:border-white/30",
  };

  const sizes = {
    sm: "px-4 py-2 text-[10px] sm:text-xs",
    md: "px-4 py-3 text-xs sm:text-sm sm:tracking-[0.35em]",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
