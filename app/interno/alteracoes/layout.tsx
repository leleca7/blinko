import { requireInternalSession } from "../../../lib/blinko/internal-auth";

export default async function ChangesLayout({ children }: { children: React.ReactNode }) {
  await requireInternalSession("changes.view");
  return children;
}
