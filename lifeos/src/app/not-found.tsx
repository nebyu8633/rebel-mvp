import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto mt-24 max-w-sm text-center">
      <h1 className="mb-2 text-xl font-bold">העמוד לא נמצא</h1>
      <Link href="/" className="text-accent-700">
        חזרה להיום שלי
      </Link>
    </div>
  );
}
