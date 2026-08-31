import type { Metadata } from "next";
import ResultsClient from "./ResultsClient";

export const metadata: Metadata = {
  title: "תוצאות ניתוח | Restaurant Purchasing Intelligence",
};

export default function ResultsPage() {
  return <ResultsClient />;
}
