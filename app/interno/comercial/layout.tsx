import { requireInternalSession } from "../../../lib/blinko/internal-auth";

export default async function CommercialLayout({ children }: { children: React.ReactNode }) {
  await requireInternalSession("commercial.view");
  return children;
}
