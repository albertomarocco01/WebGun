import type { ReactNode } from "react";

export function Bottone({
  children,
  tipo = "submit",
  tono = "primario",
}: {
  children: ReactNode;
  tipo?: "submit" | "button";
  tono?: "primario" | "secondario";
}) {
  const classi =
    tono === "primario"
      ? "bg-slate-900 text-white hover:bg-slate-700"
      : "border border-slate-400 hover:bg-slate-100";

  return (
    <button type={tipo} className={`rounded px-3 py-1 text-sm ${classi}`}>
      {children}
    </button>
  );
}
