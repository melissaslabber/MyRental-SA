import crypto from "node:crypto";

export const PAYFAST_AMOUNT = "89.00";

function formEncode(value, trim = true) {
  return encodeURIComponent(trim ? String(value).trim() : String(value))
    .replace(/%20/g, "+")
    .replace(/[!'()~]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function parameterString(fields, passphrase = "") {
  const parts = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === "signature" || value === undefined || value === null || String(value).trim() === "") continue;
    parts.push(`${key}=${formEncode(value)}`);
  }
  if (passphrase) parts.push(`passphrase=${formEncode(passphrase)}`);
  return parts.join("&");
}

export function signature(fields, passphrase = "") {
  return crypto.createHash("md5").update(parameterString(fields, passphrase)).digest("hex");
}

export function safeEqual(left, right) {
  const a = Buffer.from(String(left || "").toLowerCase());
  const b = Buffer.from(String(right || "").toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function payfastUrl() {
  return String(process.env.PAYFAST_SANDBOX || "").toLowerCase() === "true"
    ? "https://sandbox.payfast.co.za/eng/process"
    : "https://www.payfast.co.za/eng/process";
}

export function validateUrl() {
  return String(process.env.PAYFAST_SANDBOX || "").toLowerCase() === "true"
    ? "https://sandbox.payfast.co.za/eng/query/validate"
    : "https://www.payfast.co.za/eng/query/validate";
}


// ITNs include empty fields and preserve whitespace, unlike checkout forms.
export function notificationParameterString(fields, passphrase = "") {
  const parts = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === "signature") break;
    if (value !== null && typeof value === "object") throw new Error("Invalid notification field");
    parts.push(`${key}=${formEncode(value ?? "", false)}`);
  }
  if (passphrase) parts.push(`passphrase=${formEncode(passphrase, false)}`);
  return parts.join("&");
}
export function notificationSignature(fields, passphrase = "") {
  return crypto.createHash("md5").update(notificationParameterString(fields, passphrase)).digest("hex");
}
