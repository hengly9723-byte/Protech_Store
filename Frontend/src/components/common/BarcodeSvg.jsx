import React, { useState } from "react";
import { encodeEAN13ToBars, isValidEAN13 } from "../../utils/barcode";

/**
 * Universal Barcode SVG Renderer
 * Supports genuine GS1 EAN-13 encoding or clean universal barcode rendering with copy support.
 */
const BarcodeSvg = ({
  value,
  height = 56,
  showLabel = true,
  className = "",
  showCopy = false,
}) => {
  const [copied, setCopied] = useState(false);
  const cleanValue = String(value || "").trim();

  if (!cleanValue) {
    return null;
  }

  const isEan = cleanValue.length === 13 && /^\d+$/.test(cleanValue);
  const eanBits = isEan ? encodeEAN13ToBars(cleanValue) : null;

  // If valid EAN-13 bits are available, render standard 95 modules
  // Otherwise, render a clean synthetic bar pattern based on char codes
  let bitString = eanBits;
  if (!bitString) {
    // Universal fallback: convert characters into deterministic bar widths
    bitString = "101"; // start
    for (let i = 0; i < cleanValue.length; i++) {
      const code = cleanValue.charCodeAt(i);
      const bin = (code % 32).toString(2).padStart(5, "0");
      bitString += bin.replace(/0/g, "10").replace(/1/g, "110");
    }
    bitString += "101"; // end
  }

  const totalBits = bitString.length;
  const barWidth = 2;
  const svgWidth = totalBits * barWidth;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cleanValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`inline-flex flex-col items-center bg-white p-2.5 rounded-xl border border-gray-100 shadow-xs select-none ${className}`}
    >
      <svg
        viewBox={`0 0 ${svgWidth} ${height}`}
        className="w-full max-w-[220px] h-auto overflow-visible"
        aria-label={`Barcode for ${cleanValue}`}
      >
        {bitString.split("").map((bit, idx) => {
          if (bit !== "1") return null;

          // For EAN-13, start/center/end guards can extend slightly longer
          const isGuard =
            isEan &&
            (idx < 3 || (idx >= 45 && idx < 50) || idx >= 92);
          const barHeight = isGuard ? height : height - 8;

          return (
            <rect
              key={idx}
              x={idx * barWidth}
              y={0}
              width={barWidth}
              height={barHeight}
              fill="#111827"
            />
          );
        })}
      </svg>

      {showLabel && (
        <div className="flex items-center justify-between w-full mt-1.5 px-1 gap-2 text-gray-800">
          <span className="font-mono text-xs tracking-widest font-semibold">
            {cleanValue}
          </span>
          {showCopy && (
            <button
              type="button"
              onClick={handleCopy}
              title="Copy Barcode"
              className="text-gray-400 hover:text-sky-600 transition-colors p-0.5 cursor-pointer"
            >
              <i
                className={`bi ${copied ? "bi-check-lg text-emerald-500" : "bi-copy"} text-xs`}
              />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default BarcodeSvg;
