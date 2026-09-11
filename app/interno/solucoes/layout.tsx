import { requireInternalSession } from "../../../lib/blinko/internal-auth";

export default async function SolutionsLayout({ children }: { children: React.ReactNode }) {
  await requireInternalSession("solutions.view");
  return children;
}
