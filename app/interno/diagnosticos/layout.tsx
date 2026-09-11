import { requireInternalSession } from "../../../lib/blinko/internal-auth";

export default async function DiagnosticsLayout({ children }: { children: React.ReactNode }) {
  await requireInternalSession("diagnostics.view");
  return children;
}
