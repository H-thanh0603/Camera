/**
 * Fencing — sanitise text that the model reads as *data* so hostile strings in
 * product descriptions, reviews, or user input cannot masquerade as
 * instructions (prompt injection). Mirrors the Commerce Agents "fencing"
 * mechanism: data is bounded, neutralised and labelled, never trusted as
 * instructions.
 */

import type { Product, SlimProduct } from "@/lib/types";

/** Known role/instruction tokens that sneaky text may try to inject. */
const ROLE_TOKEN = /\b(user|assistant|system|tool|tool_result|function)\s*[:：]\s*/gi;
const HIERARCHY = /\b(ignore|override|forget|cancel|disregard|disregard all)\b[^\n]{0,40}\b(above|previous|earlier|prior|all|instructions|prompt|system)\b/gi;

/** Neutralise + bound arbitrary text before it reaches the model. */
export function fenceText(input: unknown, maxChars = 1200): string {
  if (input === null || input === undefined) return "";
  const raw = Array.isArray(input) ? input.join("\n") : String(input);
  const cleaned = raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007f]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(ROLE_TOKEN, "[neutralised]")
    .replace(HIERARCHY, "[neutralised]")
    .trim();
  return cleaned.length > maxChars ? `${cleaned.slice(0, maxChars)}…` : cleaned;
}

/** A product record with the descriptive fields fenced before embedding. */
export function fenceProduct(p: Product | SlimProduct): Record<string, unknown> {
  return {
    id: p.id,
    name: fenceText(p.name, 200),
    brand: fenceText(p.brand, 80),
    category: p.category,
    subcategory: p.subcategory,
    priceVND: p.price,
    currency: p.currency,
    compareAtPrice: p.compareAtPrice ?? undefined,
    stock: p.stock,
    availability: p.availability,
    rating: p.rating,
    reviewCount: p.reviewCount,
    shortDescription: "shortDescription" in p ? fenceText((p as Product).shortDescription ?? "", 400) : "",
    tags: (p.tags ?? []).map((t) => fenceText(t, 40)),
    badges: (p.badges ?? []).map((b) => fenceText(b, 40)),
    ...(p.variants?.length
      ? {
          variants: p.variants.map((v) => ({
            name: fenceText(v.name, 120),
            priceVND: v.price,
            stock: v.stock,
            availability: v.availability,
          })),
        }
      : {}),
  };
}

/**
 * Shrink a JSON string on element boundaries so the model always receives
 * well-formed JSON: drop trailing array elements / object keys until it fits.
 */
function shrinkJson(body: string, maxChars: number): string {
  if (body.length <= maxChars) return body;
  // Arrays: keep the longest prefix of complete elements.
  if (body.startsWith("[") && body.endsWith("]")) {
    const inner = body.slice(1, -1);
    // Fast path for arrays of objects/strings.
    const elements: string[] = [];
    let depth = 0;
    let inStr = false;
    let esc = false;
    let start = 0;
    for (let i = 0; i <= inner.length; i++) {
      const ch = inner[i] ?? ",";
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === "\\") esc = true;
      else if (ch === '"') inStr = !inStr;
      else if (!inStr) {
        if (ch === "{" || ch === "[") depth++;
        else if (ch === "}" || ch === "]") depth--;
        else if ((ch === "," || i === inner.length) && depth === 0) {
          if (i === inner.length && start === i) break;
          elements.push(inner.slice(start, i));
          start = i + 1;
        }
      }
    }
    const out: string[] = [];
    for (const el of elements) {
      const candidate = `[${out.concat(el).join(",")}]`;
      if (candidate.length + 20 > maxChars) break; // room for the truncation note
      out.push(el);
    }
    if (out.length > 0) return `[${out.join(",")}]`;
  }
  return `${body.slice(0, Math.max(0, maxChars - 1))}…`;
}

/** Wrap data in explicit inert markers so the model clearly reads it as data. */
export function fencedResult(label: string, value: unknown, maxChars = 6000): string {
  const body = JSON.stringify(value) ?? String(value);
  const cut = shrinkJson(body, maxChars);
  const note = cut.length < body.length ? `\n<!-- dữ liệu dài đã được rút gọn -->` : "";
  return `<${label}-data>\n${cut}${note}\n</${label}-data>`;
}