/**
 * Validators dùng chung cho form checkout / auth / newsletter.
 * Trả về message lỗi tiếng Việt hoặc undefined nếu hợp lệ.
 */

export const required = (label: string) => (value: string): string | undefined =>
  value.trim().length === 0 ? `${label} là bắt buộc.` : undefined;

export const email = (value: string): string | undefined =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? undefined : "Email không hợp lệ.";

/** Số điện thoại Việt Nam: 0xxxxxxxxx hoặc +84xxxxxxxxx, 9–11 chữ số. */
export const phoneVN = (value: string): string | undefined => {
  const cleaned = value.replace(/[\s.-]/g, "");
  return /^(0|\+84)\d{8,10}$/.test(cleaned) ? undefined : "Số điện thoại không hợp lệ (VD: 0901234567).";
};

export const minLength = (label: string, n: number) => (value: string): string | undefined =>
  value.length < n ? `${label} cần tối thiểu ${n} ký tự.` : undefined;

export function validateAll<T extends Record<string, string>>(
  values: T,
  rules: Partial<Record<keyof T, ((v: string) => string | undefined)[]>>,
): Partial<Record<keyof T, string>> {
  const errors: Partial<Record<keyof T, string>> = {};
  for (const key of Object.keys(rules) as (keyof T)[]) {
    for (const rule of rules[key] ?? []) {
      const message = rule(values[key] ?? "");
      if (message) {
        errors[key] = message;
        break;
      }
    }
  }
  return errors;
}
