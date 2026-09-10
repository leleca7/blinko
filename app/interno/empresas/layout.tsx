import { requireInternalSession } from "../../../lib/blinko/internal-auth";

export default async function CompaniesLayout({ children }: { children: React.ReactNode }) {
  await requireInternalSession("companies.view");
  return children;
}
