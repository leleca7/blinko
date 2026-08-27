import Link from "next/link";

export default function InternalBrand({ href = "/interno" }: { href?: string }) {
  return (
    <Link href={href} aria-label="Blinko OS" style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "inherit", textDecoration: "none", minWidth: 0 }}>
      <img src="/brand/logo-blinko-branca.png" alt="Blinko" width={400} height={200} style={{ display: "block", width: 108, maxWidth: "30vw", height: "auto" }} />
      <span aria-hidden="true" style={{ padding: "5px 7px", border: "1px solid rgba(255,255,255,.24)", borderRadius: 999, fontSize: 9, lineHeight: 1, fontWeight: 800, letterSpacing: ".12em" }}>OS</span>
    </Link>
  );
}
