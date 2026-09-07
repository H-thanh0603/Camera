import { IMG } from "@/lib/data/images";
import { AppImage } from "@/components/ui/app-image";

const TESTIMONIALS = [
  {
    quote:
      "Khi chụp báo ảnh tại nhiệt độ -38°C ở Greenland, hầu hết các hệ thống lấy nét điện tử đều tê liệt. Lumina X-1 hoạt động hoàn toàn chính xác, bộ đệm ghi file 16-bit không một lần trễ nhịp. Đây không chỉ là một chiếc máy ảnh, mà là công cụ sinh tồn quang học.",
    name: "Marcus Van Der Berg",
    role: "Nhiếp ảnh gia Magnum Photos / 3 Lần Đoạt World Press Photo",
    avatar: IMG.photographerPortrait,
    avatarAlt: "Chân dung nhiếp ảnh gia tài liệu trong trang phục thám hiểm giá lạnh",
  },
  {
    quote:
      "Trong các cảnh quay phim tài liệu thiên nhiên hoang dã của National Geographic, ánh sáng thay đổi chỉ trong vài giây. Dải tương phản động 15+ stops cùng khả năng tái hiện chi tiết vùng tối của ống kính anamorphic Lumina đã cứu trọn vẹn những khung hình không thể tái hiện lần hai.",
    name: "Elena Rostova",
    role: "Đạo Diễn Hình Ảnh (DoP) • National Geographic Explorer",
    avatar: IMG.dopPortrait,
    avatarAlt: "Chân dung đạo diễn hình ảnh nữ với ống nhòm trên savanna",
  },
];

const PRIVILEGES = [
  { icon: "verified_user", title: "Bảo Hành 5 Năm Tận Nơi", desc: "Chuyên viên Lumina đến tận studio thẩm định và xử lý thiết bị thay thế trong 24 giờ." },
  { icon: "cleaning_services", title: "Vệ Sinh Sensor Trọn Đời", desc: "Buồng áp suất âm chuyên dụng chuẩn ISO Class 5 khử sạch bụi vi mô không chạm." },
  { icon: "change_circle", title: "Đổi Mới 30 Ngày", desc: "Không cần lý do, trải nghiệm thẩm âm và độ nét. Đổi sang phân hệ khác theo giá trị hóa đơn." },
  { icon: "apartment", title: "Studio Test Riêng Biệt", desc: "Phòng trải nghiệm ánh sáng chuẩn Aputure và Arri tại trung tâm Quận 1 & Hoàn Kiếm." },
];

/** Section 6 — Social Proof & Privilege Concierge (port nguyên vẹn). */
export function Testimonials() {
  return (
    <section id="concierge" className="relative w-full scroll-mt-24 overflow-hidden bg-surface-container-lowest py-space-4xl lg:scroll-mt-[132px]">
      <div className="mx-auto flex w-full max-w-container-max flex-col gap-space-3xl px-gutter-mobile lg:px-gutter-desktop">
        <div className="mx-auto flex max-w-2xl flex-col gap-space-xs">
          <p className="font-telemetry-xs text-telemetry-xs uppercase tracking-widest text-on-surface-variant/70">
            Bảo chứng từ những bậc thầy hình ảnh
          </p>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Được Tin Dùng Tại Những Vùng Đất Khắc Nghiệt Nhất</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">Từ băng giá Bắc Cực tới miệng núi lửa Nam Thái Bình Dương, Lumina Optics đồng hành trong từng khung hình lịch sử.</p>
        </div>

        <div className="grid grid-cols-1 gap-space-xl md:grid-cols-2">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="relative flex flex-col justify-between gap-space-lg overflow-hidden rounded-xl bg-surface-container p-space-xl shadow-xl">
              <div className="flex flex-col gap-space-md">
                <span className="material-symbols-outlined text-[40px] text-primary/40" aria-hidden="true">format_quote</span>
                <blockquote className="font-body-lg text-body-lg italic leading-relaxed text-on-surface">{t.quote}</blockquote>
              </div>
              <figcaption className="flex items-center gap-space-md border-t border-surface-container-high pt-space-md">
                <div className="h-12 w-12 overflow-hidden rounded-full bg-surface-container-high">
                  <AppImage className="h-full w-full object-cover" width={48} height={48} src={t.avatar} alt={t.avatarAlt} />
                </div>
                <div className="flex flex-col">
                  <span className="font-headline-sm text-headline-sm text-on-surface">{t.name}</span>
                  <span className="font-telemetry-xs text-telemetry-xs uppercase text-primary">{t.role}</span>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="rounded-xl bg-surface-container-low p-space-xl shadow-2xl">
          <div className="flex flex-wrap items-end justify-between gap-space-sm pb-space-md">
            <h3 className="font-headline-md text-headline-md text-on-surface">Đặc Quyền Vượt Xa Chuẩn Mực Bán Lẻ</h3>
            <span className="font-telemetry-xs text-telemetry-xs uppercase tracking-widest text-primary">Lumina Privilege Concierge</span>
          </div>
          <ul className="flex flex-col">
            {PRIVILEGES.map((p) => (
              <li key={p.title} className="flex items-baseline gap-space-md border-t border-surface-container-high py-space-md last:border-b">
                <span className="material-symbols-outlined shrink-0 text-[22px] text-primary" aria-hidden="true">{p.icon}</span>
                <div className="flex flex-col gap-space-3xs sm:flex-row sm:items-baseline sm:gap-space-md">
                  <span className="shrink-0 font-headline-sm text-headline-sm text-on-surface sm:w-64">{p.title}</span>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{p.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
