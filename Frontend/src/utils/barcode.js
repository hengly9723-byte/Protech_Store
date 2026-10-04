/**
 * Utility functions for GS1 EAN-13 barcode generation, validation, and SVG encoding.
 */

// Left-hand odd parity (L-code)
const L_PATTERNS = [
  "0001101", "0011001", "0010011", "0111101", "0100011",
  "0110001", "0101111", "0111011", "0110111", "0001011"
];

// Left-hand even parity (G-code)
const G_PATTERNS = [
  "0100111", "0110011", "0011011", "0100001", "0011101",
  "0111001", "0000101", "0010001", "0001001", "0010111"
];

// Right-hand parity (R-code)
const R_PATTERNS = [
  "1110010", "1100110", "1101100", "1000010", "1011100",
  "1001100", "1010000", "1000100", "1001000", "1110100"
];

// Parity assignment based on 1st digit (determines L/G pattern for digits 1-6)
const PARITY_MAP = [
  "LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
  "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"
];

/**
 * Calculates GS1 Modulo-10 checksum for a 12-digit string.
 */
export const calculateEAN13Checksum = (digits12) => {
  const str = String(digits12).replace(/\D/g, "").slice(0, 12);
  if (str.length < 12) return "";
  let total = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(str[i], 10);
    total += digit * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (total % 10)) % 10);
};

/**
 * Validates whether a barcode is a syntactically valid 13-digit EAN-13 code with matching checksum.
 */
export const isValidEAN13 = (barcode) => {
  const clean = String(barcode || "").trim();
  if (!/^\d{13}$/.test(clean)) return false;
  const expectedCheck = calculateEAN13Checksum(clean.slice(0, 12));
  return clean[12] === expectedCheck;
};

/**
 * Generates a unique, valid 13-digit EAN-13 barcode using the 200 prefix (internal store merchandise).
 */
export const generateEAN13Barcode = (prefix = "200") => {
  // 3-digit prefix + 9 random digits = 12 digits
  const randomNine = Math.floor(100000000 + Math.random() * 900000000).toString();
  const base12 = `${prefix}${randomNine}`;
  const checkDigit = calculateEAN13Checksum(base12);
  return `${base12}${checkDigit}`;
};

/**
 * Encodes an EAN-13 barcode into binary string of 95 bar modules (1 = black, 0 = white).
 * Returns null if the code is not a valid 13-digit number.
 */
export const encodeEAN13ToBars = (barcode) => {
  const code = String(barcode || "").replace(/\D/g, "");
  if (code.length !== 13) return null;

  const first = parseInt(code[0], 10);
  const pattern = PARITY_MAP[first];

  // Start guard: 101
  let bits = "101";

  // Left 6 digits
  for (let i = 0; i < 6; i++) {
    const digit = parseInt(code[i + 1], 10);
    bits += pattern[i] === "L" ? L_PATTERNS[digit] : G_PATTERNS[digit];
  }

  // Center guard: 01010
  bits += "01010";

  // Right 6 digits (including checksum digit)
  for (let i = 0; i < 6; i++) {
    const digit = parseInt(code[i + 7], 10);
    bits += R_PATTERNS[digit];
  }

  // End guard: 101
  bits += "101";

  return bits; // Exactly 95 bits
};
