import { toCanvas, toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import * as jspdfModule from "jspdf";

/**
 * Resolves the jsPDF constructor reliably across different bundler environments (Vite, Rollup, ESM, CJS).
 */
const resolveJsPDF = () => {
  if (typeof jsPDF === "function") return jsPDF;
  if (typeof jspdfModule?.jsPDF === "function") return jspdfModule.jsPDF;
  if (typeof jspdfModule?.default === "function") return jspdfModule.default;
  if (typeof jspdfModule?.default?.jsPDF === "function") return jspdfModule.default.jsPDF;
  return window?.jspdf?.jsPDF || window?.jsPDF;
};

/**
 * Generates and triggers direct client-side download of an authentic 80mm POS thermal receipt PDF.
 * Applies a 2.5mm paper roll margin so content is perfectly centered without any right-edge clipping.
 * Excludes web-only interactive elements marked with `.pdf-hide`.
 *
 * @param {HTMLElement} element - The DOM element containing the thermal receipt.
 * @param {string} orderNumber - Order number or ID to use in the file name.
 * @returns {Promise<string>} - Resolves with the saved filename.
 */
export const downloadThermalReceiptPdf = async (element, orderNumber = "order") => {
  if (!element) {
    throw new Error("Receipt element reference is not provided.");
  }

  const PDFConstructor = resolveJsPDF();
  if (!PDFConstructor) {
    throw new Error("jsPDF library failed to initialize.");
  }

  // Clean filename: receipt-ORD-202610020934.pdf
  const sanitized = String(orderNumber)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "");
  const filename = `receipt-${sanitized || "receipt"}.pdf`;

  // Get physical element dimensions
  const elementWidth = element.scrollWidth || element.offsetWidth || 360;
  const elementHeight = element.scrollHeight || element.offsetHeight || 600;

  const renderOptions = {
    pixelRatio: 3, // 3x scale for ultra-crisp 300+ DPI print resolution
    backgroundColor: "#ffffff",
    cacheBust: true,
    width: elementWidth,
    height: elementHeight,
    filter: (node) => {
      // Exclude interactive web-only buttons (copy buttons, collapse button)
      if (node?.classList?.contains("pdf-hide")) return false;
      return true;
    },
    style: {
      opacity: "1",
      visibility: "visible",
      display: "block",
      transform: "none",
      margin: "0",
    },
  };

  let imgData = null;
  let canvasWidth = 0;
  let canvasHeight = 0;

  try {
    const canvas = await toCanvas(element, renderOptions);
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;
    imgData = canvas.toDataURL("image/png");
  } catch (canvasErr) {
    console.warn("toCanvas encountered error, attempting toPng fallback:", canvasErr);
    imgData = await toPng(element, renderOptions);
    const img = new Image();
    img.src = imgData;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    canvasWidth = img.naturalWidth || img.width;
    canvasHeight = img.naturalHeight || img.height;
  }

  if (!canvasWidth || !canvasHeight || !imgData) {
    throw new Error("Failed to capture receipt dimensions.");
  }

  // Standard POS receipt roll is 80mm wide
  const pdfRollWidth = 80;
  // Apply a 2.5mm physical margin so content never touches or clips the paper edge
  const margin = 2.5;
  const printWidth = pdfRollWidth - margin * 2; // 75mm printable width
  const printHeight = (canvasHeight * printWidth) / canvasWidth;
  const pdfRollHeight = printHeight + margin * 2;

  if (!pdfRollHeight || isNaN(pdfRollHeight)) {
    throw new Error("Invalid receipt height calculated.");
  }

  // Create jsPDF with custom receipt roll dimensions
  const pdf = new PDFConstructor({
    orientation: "portrait",
    unit: "mm",
    format: [pdfRollWidth, pdfRollHeight],
    compress: true,
  });

  pdf.addImage(imgData, "PNG", margin, margin, printWidth, printHeight, undefined, "FAST");
  pdf.save(filename);

  return filename;
};
