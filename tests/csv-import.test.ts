import { describe, expect, it } from "vitest";
import { parseCsvProducts, splitCsv } from "@/lib/server/csv-import";

describe("splitCsv", () => {
  it("quote chứa phẩy + xuống dòng + escape", () => {
    const rows = splitCsv('a,b\n"x, y","p""q"\n"l1\nl2",z');
    expect(rows).toEqual([
      ["a", "b"],
      ["x, y", 'p"q'],
      ["l1\nl2", "z"],
    ]);
  });
});

describe("parseCsvProducts", () => {
  const header = "slug,name,brand,category,price,stock,tags";
  it("dòng chuẩn + tags ;", () => {
    const { rows, issues } = parseCsvProducts(`${header}\nlum-x1,Lumina X-1,Lumina,camera,185000000,5,flagship;mirrorless`);
    expect(issues).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ slug: "lum-x1", price: 185000000, stock: 5, tags: ["flagship", "mirrorless"] });
  });
  it("thiếu cột bắt buộc / slug sai / trùng / giá sai", () => {
    const missing = parseCsvProducts("slug,name\nlum-x1,X");
    expect(missing.issues[0].message).toContain("brand");
    const bad = parseCsvProducts(
      `${header}\nBad Slug,Máy X,Lumina,camera,100\nlum-x1,Máy X,Lumina,camera,100\nlum-x1,Máy Y,Lumina,camera,-5`,
    );
    expect(bad.rows).toHaveLength(1);
    expect(bad.issues).toHaveLength(2);
  });
  it("cột lạ + quá 500 dòng", () => {
    const weird = parseCsvProducts(`${header},hack\nlum-x1,X,Lumina,camera,100,1`);
    expect(weird.issues[0].message).toContain("Cột lạ");
    const big = parseCsvProducts(`${header}\n${Array.from({ length: 501 }, (_, i) => `s-${i},X,Lumina,camera,100`).join("\n")}`);
    expect(big.rows).toHaveLength(0);
    expect(big.issues[0].message).toContain("500");
  });
});
