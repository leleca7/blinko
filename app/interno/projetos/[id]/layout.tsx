import { requireInternalProjectSession } from "../../../../lib/blinko/internal-auth";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireInternalProjectSession(id, "projects.view");
  return children;
}
