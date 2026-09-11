import { requireInternalSession } from "../../../lib/blinko/internal-auth";

export default async function PartnersLayout({ children }: { children: React.ReactNode }) {
  await requireInternalSession("partners.view");
  return children;
}
