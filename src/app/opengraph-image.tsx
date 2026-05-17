import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "fileaway — save what matters";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#f3f0e8",
          padding: "80px",
          position: "relative",
        }}
      >
        {/* Category color stripes — the brand signature */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "40px" }}>
          <div style={{ width: "60px", height: "8px", background: "#b85c3a" }} />
          <div style={{ width: "60px", height: "8px", background: "#6b8e23" }} />
          <div style={{ width: "60px", height: "8px", background: "#3949ab" }} />
          <div style={{ width: "60px", height: "8px", background: "#7e3f6b" }} />
          <div style={{ width: "60px", height: "8px", background: "#3d6b5c" }} />
          <div style={{ width: "60px", height: "8px", background: "#c08442" }} />
        </div>

        {/* Logo lockup */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "60px" }}>
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none">
            <path d="M8 4 H4 V20 H8" stroke="#c2410c" strokeWidth="2" strokeLinecap="square" />
            <path d="M16 4 H20 V20 H16" stroke="#c2410c" strokeWidth="2" strokeLinecap="square" />
            <circle cx="12" cy="12" r="2.75" fill="#c2410c" />
          </svg>
          <span
            style={{
              fontSize: "60px",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "#14110c",
            }}
          >
            file<span style={{ color: "#7a7468" }}>away</span>
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            fontSize: "84px",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: "#14110c",
            lineHeight: 1.04,
            maxWidth: "1000px",
          }}
        >
          Save links.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "84px",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            lineHeight: 1.04,
            maxWidth: "1000px",
          }}
        >
          <span style={{ color: "#14110c" }}>Extract&nbsp;</span>
          <span style={{ color: "#c2410c" }}>what matters.</span>
        </div>

        {/* Footer mono caption */}
        <div
          style={{
            position: "absolute",
            bottom: "80px",
            left: "80px",
            display: "flex",
            fontSize: "22px",
            color: "#6b655b",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          fileaway.app · ai-filed
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
