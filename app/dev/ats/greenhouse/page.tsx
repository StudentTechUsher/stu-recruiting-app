import { notFound } from "next/navigation";
import { GreenhouseExplorer } from "@/components/dev/GreenhouseExplorer";

export default function GreenhouseExplorerPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <GreenhouseExplorer />;
}
