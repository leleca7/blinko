import { requireInternalSession } from "../../../lib/blinko/internal-auth";

export default async function ContactsLayout({ children }: { children: React.ReactNode }) {
  await requireInternalSession("contacts.view");
  return children;
}
