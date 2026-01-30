import React, { SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { label: string; value: string }[];
}

export function Select({ label, options, className = "", ...props }: SelectProps) {
  return (
    <label className="block space-y-2 text-[10px] uppercase tracking-[0.25em] text-white/60 sm:text-xs sm:tracking-[0.3em]">
      {label}
      <div className="relative">
        <select
          className={`w-full appearance-none rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-base text-white focus:border-[#caa468]/50 focus:outline-none focus:ring-1 focus:ring-[#caa468]/50 sm:py-2 sm:text-sm ${className}`}
          {...props}
        >
          <option value="" className="bg-[#122723]">
            Select...
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#122723]">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 opacity-50">
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor">
            <path d="M1 1L5 5L9 1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </label>
  );
}
