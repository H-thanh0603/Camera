/**
 * CSV import catalogue — parser thuần (không dep), validate từng dòng.
 * Cột: slug,name,brand,category,price + optional:
 * compareAtPrice,stock,availability,subcategory,shortDescription,description,tags
 * (tags cách nhau `;`). Hỗ trợ quote "..." (kể cả xuống dòng + "" escape).
 */

export const CSV_MAX_ROWS = 500;

export interface CsvRow {
  line: number;
  slug: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  availability: string;
  subcategory: string;
  shortDescription: string;
  description: string;
  tags: string[];
}

export interface CsvIssue {
  line: number;
  message: string;
}

const REQUIRED = ["slug", "name", "brand", "category", "price"] as const;
const KNOWN = [...REQUIRED, "compareAtPrice", "stock", "availability", "subcategory", "shortDescription", "description", "tags"] as const;
const AVAILABILITY = ["in_stock", "low_stock", "pre_order", "out_of_stock", "contact"];
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Tách CSV thành ma trận cells (RFC-4180 tối giản). */
export function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const push = () => {
    row.push(cell);
    cell = "";
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      push();
    } else if (c === "\n") {
      push();
      rows.push(row);
      row = [];
    } else if (c === "\r") {
      // bỏ qua, \n xử lý xuống dòng
    } else {
      cell += c;
    }
  }
  push();
  rows.push(row);
  // Bỏ dòng trống cuối file
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c.trim() === "")) rows.pop();
  return rows;
}

export function parseCsvProducts(text: string): { rows: CsvRow[]; issues: CsvIssue[] } {
  const rows: CsvRow[] = [];
  const issues: CsvIssue[] = [];
  if (!text.trim()) return { rows, issues: [{ line: 0, message: "File CSV trống." }] };
  const matrix = splitCsv(text.replace(/^\uFEFF/, ""));
  const header = matrix[0].map((h) => h.trim());
  const seen = new Set<string>();
  for (const col of REQUIRED) {
    if (!header.includes(col)) {
      return { rows, issues: [{ line: 1, message: `Thiếu cột bắt buộc: ${col}.` }] };
    }
  }
  const idx = (name: string) => header.indexOf(name);
  const unknown = header.filter((h) => h && !(KNOWN as readonly string[]).includes(h));
  if (unknown.length > 0) {
    return { rows, issues: [{ line: 1, message: `Cột lạ: ${unknown.join(", ")}.` }] };
  }
  const dataRows = matrix.slice(1);
  if (dataRows.length > CSV_MAX_ROWS) {
    return { rows, issues: [{ line: 0, message: `Quá ${CSV_MAX_ROWS} dòng (nhận ${dataRows.length}). Chia nhỏ file.` }] };
  }
  dataRows.forEach((cells, i) => {
    const line = i + 2;
    if (cells.every((c) => c.trim() === "")) return; // bỏ dòng trống
    const get = (name: string) => (cells[idx(name)] ?? "").trim();
    const slug = get("slug");
    const name = get("name");
    const brand = get("brand");
    const category = get("category");
    const price = Number(get("price"));
    const fail = (message: string) => issues.push({ line, message });
    if (!SLUG_RE.test(slug)) return fail(`Slug sai định dạng: "${slug}".`);
    if (seen.has(slug)) return fail(`Slug trùng trong file: "${slug}".`);
    seen.add(slug);
    if (name.length < 2) return fail(`Thiếu tên sản phẩm (dòng ${line}).`);
    if (!brand) return fail(`Thiếu thương hiệu (dòng ${line}).`);
    if (!category) return fail(`Thiếu danh mục (dòng ${line}).`);
    if (!Number.isInteger(price) || price <= 0) return fail(`Giá phải là số nguyên dương (dòng ${line}).`);
    const compareRaw = get("compareAtPrice");
    const compareAtPrice = compareRaw ? Number(compareRaw) : null;
    if (compareRaw && (!Number.isInteger(compareAtPrice!) || compareAtPrice! <= 0)) {
      return fail(`Giá trước giảm chưa hợp lệ (dòng ${line}).`);
    }
    const stockRaw = get("stock");
    const stock = stockRaw === "" ? 0 : Number(stockRaw);
    if (!Number.isInteger(stock) || stock < 0) return fail(`Tồn kho phải là số nguyên ≥ 0 (dòng ${line}).`);
    const availability = get("availability") || "in_stock";
    if (!AVAILABILITY.includes(availability)) return fail(`Tình trạng chưa hợp lệ (dòng ${line}).`);
    rows.push({
      line,
      slug,
      name,
      brand,
      category,
      price,
      compareAtPrice,
      stock,
      availability,
      subcategory: get("subcategory") || "Khác",
      shortDescription: get("shortDescription") || name.slice(0, 140),
      description: get("description"),
      tags: get("tags").split(";").map((t) => t.trim()).filter(Boolean).slice(0, 20),
    });
  });
  return { rows, issues };
}
