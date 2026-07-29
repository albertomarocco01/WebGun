import { contenutoPubblico } from "@/modules/contenuti/query";

export default async function Home() {
  const hero = await contenutoPubblico("home-hero");

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-semibold">{hero?.title ?? "Bottega Nord"}</h1>
      <p className="mt-4">{hero?.corpo ?? ""}</p>
    </main>
  );
}
