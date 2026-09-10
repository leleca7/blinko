import { requireInternalSession } from "../../../lib/blinko/internal-auth";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireInternalSession("settings.users.manage");
  return children;
}
