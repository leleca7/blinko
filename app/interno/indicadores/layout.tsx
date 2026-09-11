import { requireInternalSession } from "../../../lib/blinko/internal-auth";

export default async function IndicatorsLayout({ children }: { children: React.ReactNode }) {
  await requireInternalSession("indicators.view");
  return children;
}
