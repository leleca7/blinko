import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  const petal = {
    position: "absolute" as const,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "#ef3b7f",
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#01301e",
          borderRadius: 14,
        }}
      >
        <div style={{ width: 42, height: 42, position: "relative", display: "flex" }}>
          <div style={{ ...petal, left: 12, top: 2 }} />
          <div style={{ ...petal, left: 22, top: 12 }} />
          <div style={{ ...petal, left: 12, top: 22 }} />
          <div style={{ ...petal, left: 2, top: 12 }} />
          <div style={{ position: "absolute", left: 16, top: 16, width: 10, height: 10, borderRadius: "50%", background: "#f3efeb" }} />
        </div>
      </div>
    ),
    size,
  );
}
