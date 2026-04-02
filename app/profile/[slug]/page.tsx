import { permanentRedirect } from "next/navigation";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function LegacySharedProfileRedirect({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug.trim().toLowerCase();
  permanentRedirect(`/u/${encodeURIComponent(slug)}`);
}
