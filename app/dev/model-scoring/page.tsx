import { notFound } from "next/navigation";
import { ModelScoringWorkbench } from "@/components/dev/ModelScoringWorkbench";

export default function ModelScoringPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ModelScoringWorkbench />;
}
