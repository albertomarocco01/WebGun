import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contatti — Case di Langa",
  description: "Dove siamo, quando siamo aperti e come fissare una visita.",
  alternates: { canonical: "/contatti" },
};

export default function Contatti() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Contatti</h1>
      <p className="mt-4">Via Vittorio Emanuele 12, Alba (CN) — 0173 44 55 66</p>
      <p className="mt-2">Da martedì a sabato, 9–13 e 15–19.</p>
    </>
  );
}
