import React, { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className = "", ...props }: InputProps) {
  return (
    <label className="block space-y-2 text-[10px] uppercase tracking-[0.25em] text-white/60 sm:text-xs sm:tracking-[0.3em]">
      {label}
      <input
        className={`w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-base text-white focus:border-[#caa468]/50 focus:outline-none focus:ring-1 focus:ring-[#caa468]/50 sm:py-2 sm:text-sm ${className}`}
        {...props}
      />
    </label>
  );
}
