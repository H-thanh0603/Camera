import { describe, expect, it } from "vitest";
import { escapeEmailHtml, orderConfirmationHtml, passwordResetHtml } from "@/lib/server/email";

describe("email templates", () => {
  it("order confirmation: brand + lines + totals + CTA, escape HTML", () => {
    const html = orderConfirmationHtml("LUM-1", 185_000_000, 'An <script>alert("x")</script>', null, [
      { name: "Lumina X-1", variantName: "Body", quantity: 1, unitPrice: 185_000_000 },
    ]);
    expect(html).toContain("LUMINA OPTICS");
    expect(html).toContain("LUM-1");
    expect(html).toContain("185.000.000");
    expect(html).toContain("THEO DÕI ĐƠN HÀNG");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("password reset: CTA + link, không lộ nội dung thừa", () => {
    const html = passwordResetHtml("https://shop/reset?token=abc");
    expect(html).toContain("https://shop/reset?token=abc");
    expect(html).toContain("ĐẶT MẬT KHẨU MỚI");
  });

  it("escapeEmailHtml", () => {
    expect(escapeEmailHtml('a&b<"c">')).toBe("a&amp;b&lt;&quot;c&quot;&gt;");
  });
});
