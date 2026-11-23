import { redirect } from "next/navigation";

/**
 * Link antigo do Instagram. Mantemos o caminho funcionando, mas
 * apresentamos a Blinko na home única em vez de duplicar o site.
 */
export default function BioPage() {
  redirect("/");
}
