import { ImageResponse } from "next/og";

export const alt = "Blinko | Diagnóstico + Execução + Acompanhamento";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "68px 76px",
          background: "#f3efeb",
          color: "#01301e",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: "-90px",
            top: "-100px",
            width: "430px",
            height: "430px",
            borderRadius: "50%",
            background: "#ddb5da",
            opacity: 0.58,
          }}
        />
        <div
          style={{
            position: "absolute",
            right: "125px",
            bottom: "-120px",
            width: "310px",
            height: "310px",
            borderRadius: "50%",
            background: "#ef3b7f",
            opacity: 0.9,
          }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 2 }}>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "0.12em" }}>BLINKO</div>
          <div style={{ fontSize: 20, letterSpacing: "0.12em", textTransform: "uppercase" }}>Diagnóstico + Execução</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 890, zIndex: 2 }}>
          <div style={{ fontFamily: "serif", fontSize: 76, lineHeight: 0.96, letterSpacing: "-0.045em" }}>
            Inovação aplicada ao problema real da empresa.
          </div>
          <div style={{ fontSize: 27, lineHeight: 1.35, maxWidth: 790 }}>
            Organizamos sinais, investigamos hipóteses, validamos prioridades e acompanhamos a execução.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 18, letterSpacing: "0.08em", zIndex: 2 }}>
          blinko-wine.vercel.app
        </div>
      </div>
    ),
    size,
  );
}
