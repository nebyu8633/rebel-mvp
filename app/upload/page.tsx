import type { Metadata } from "next";
import UploadClient from "./UploadClient";

export const metadata: Metadata = {
  title: "העלאת חשבוניות | Restaurant Purchasing Intelligence",
};

export default function UploadPage() {
  return <UploadClient />;
}
