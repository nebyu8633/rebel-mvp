import { getDictionary } from "@/lib/i18n";

export default function HomePage() {
  const dict = getDictionary();
  return (
    <main className="flex min-h-dvh items-center justify-center p-8">
      <h1 className="text-4xl font-bold">{dict.home.title}</h1>
    </main>
  );
}
