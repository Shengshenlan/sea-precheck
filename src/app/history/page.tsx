import { Suspense } from "react";
import { HistoryView } from "./HistoryView";
export const metadata = { title: "历史记录" };
export default function HistoryPage() {
  return <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10"><Suspense><HistoryView /></Suspense></main>;
}
