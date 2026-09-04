export interface JournalArticle {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  author: string;
  date: string;
  readingTimeMinutes: number;
  heroImage: string;
  heroAlt: string;
  body: string[];
  relatedProductSlugs: string[];
}

export const articles: JournalArticle[] = [
  {
    slug: "hieu-sat-ky-thuat-medium-format",
    title: "Hiểu Đúng Sức Mạnh Medium Format: Khi 16-bit Màu Gặp 100MP",
    category: "Camera Guides",
    excerpt:
      "Tại sao medium format không chỉ là 'độ phân giải lớn hơn' — cách cảm biến 53.4 × 40mm thay đổi cách bạn ánh xạ vùng sáng và tái tạo làn da người.",
    author: "Biên tập Lumina Journal",
    date: "2025-08-15T00:00:00Z",
    readingTimeMinutes: 8,
    heroImage:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCHAq9npCXMqLiR_9HJO-xG1MG66_0NzIyiGYCTrWP0mLsfk6gNFwl_M9bBA1WdRMtlo7Q8VmY55_Arg3QPPms5pUdYu4scsV-t3yjX8U0XQacUj6MMaCNYaeLvo4tahmlTRitsPh7KF_1jA5DV93XNyJoemTLH2FqgQsU8Uf2XsnM6F_RSFVEollsNHPyeAxGJBFFvuhHnUYcERqLyj4yMklyrDuJ2YF5N06Vx5uYFkapeWLJJHUHP",
    heroAlt: "Hasselblad X2D 100C trên đế thép tối",
    body: [
      "Medium format không đơn thuần là một cuộc đua độ phân giải. Với kích thước cảm biến 53.4 × 40mm, mỗi photosite thu nhận nhiều photon hơn ở cùng exposure — dẫn tới chuyển màu 16-bit mượt mà mà full-frame khó chạm tới.",
      "Trong thực tế phòng chụp, điều đó nghĩa là gradient da người từ bóng sang sáng không còn bậc thang. Với Hasselblad Natural Colour Solution, tông da được tái tạo theo chuẩn hues hỗ trợ hậu kỳ ít can thiệp nhất.",
      "Bù lại, medium format đòi hỏi kỷ luật ánh sáng và kỹ thuật: burst rate thấp, độ sâu trường ảnh mỏng hơn ở cùng khẩu, và trọng lượng hệ thống lớn hơn. Nếu bạn làm fine-art, quảng cáo in ấn — nó xứng đáng từng gram.",
    ],
    relatedProductSlugs: ["hasselblad-x2d-100c", "hasselblad-907x-cfv-100c"],
  },
  {
    slug: "anamorphic-la-gi",
    title: "Anamorphic 2x: Vị Chát Điện Ảnh Bạn Không Thể Tái Tạo Trong Post",
    category: "Lens Reviews",
    excerpt:
      "Vệt sáng xanh oval, bokeh dọc, nhịp 2.39:1 — mổ xẻ vì sao ống kính anamorphic vẫn là công cụ không thể thay thế của đạo diễn hình ảnh.",
    author: "Elena Rostova — DoP khách mời",
    date: "2025-07-02T00:00:00Z",
    readingTimeMinutes: 6,
    heroImage:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAGWXovwotRWSvX7wDseSNLmkB1M1y5TdvdBiZdqqRYfOt8qylUazjOSRYEV1G8AXiYgjZ0b4EfhbH6-ABaW3SyOlJmpAVGLMa9w3JN652pwJYfiPtZn0d_lIuw1oLeHUl7b107D6tp0zyksXeIVr3rNPY6qoqPeVZe9pa6X8DvVfX2-yS5u79efr3pqmvVfcW-Wvs5Yn4pE7XVmSQWA5dlsj4Kaub-SG1ToI-Gn5rPqNXy2XkLZByl",
    heroAlt: "Ống kính Cooke Anamorphic với ngàm PL và vỏ titan",
    body: [
      "Anamorphic nén chiều rộng hình ảnh 2x lên cảm biến, rồi giãn ngược khi chiếu — cho ra khung 2.39:1 với cùng số photosites. Kết quả: độ nét ngang cao hơn và character quang học độc đáo.",
      "Bokeh oval, flare kéo dài theo trục ngang và 'Cooke Look' — sự chuyển màu ấm áp ở vùng highlight — là ba tính chất khó mô phỏng hoàn hảo bằng plugin. Chúng nằm trong cấu trúc thấu kính trụ và lớp phủ.",
      "Với Cooke Anamorphic /i FF+, dòng full-frame mới cho phép dùng trên cả thân máy mirrorless hiện đại qua PL mount, mở cửa anamorphic cho đoàn phim ngân sách vừa.",
    ],
    relatedProductSlugs: ["cooke-anamorphic-i-ff-plus-50mm", "lumina-cine-8k-pl"],
  },
  {
    slug: "chon-may-anh-du-lich",
    title: "Máy Ảnh Cho Hành Trình: Kinh Nguyện Cân Nặng & Độ Bền",
    category: "Buying Guides",
    excerpt:
      "540g trên vai cả 20km đường mòn có nghĩa gì. Cách chọn hệ thống du lịch giữa kín đáo, bền bỉ và chất lượng ảnh.",
    author: "Biên tập Lumina Journal",
    date: "2025-05-20T00:00:00Z",
    readingTimeMinutes: 5,
    heroImage:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAPQnEMKCYvdQ_tutzyVyJgotl_NHAs_6Ws5rb_ynIrErXDvILyCjpr7GW55UHvQbf4xRY_lTeDSov7Zcmlvjrps-kH5D6aMPx9iodqDNkb9RAWI4Mtcmyj3xDeripCavW6hgiYYKIRtjpfzjj3VZ2mZILnHAySjLfpXQpAfGXPii98AySzzAWAXDxKywX3Yt-Hage8HmmYD8VvbY-5PTGM706aFRb-Iz-9tHOZTf5ldmedQ8bM3jSR",
    heroAlt: "Rangefinder patina đồng trên hành trình đường phố",
    body: [
      "Trọng lượng là quyết định quan trọng nhất cho hệ thống du lịch — mọi gram nhân theo kilomet. Một thân máy 540g với lens 320g sẽ theo bạn mỗi ngày; một combo 2kg sẽ ở khách sạn.",
      "Kín đáo đổi lấy tiếp cận: rangefinder không gây chú ý, không tiếng màn gương, cho phép chụp ở nơi máy lớn bị từ chối.",
      "Cuối cùng, độ bền: khung hợp kim chống thời tiết và pin lạnh giá là khác biệt giữa lưu được khoảnh khắc và bỏ lỡ nó. Camera Finder của Lumina lọc cả ba tiêu chí này chỉ trong vài câu hỏi.",
    ],
    relatedProductSlugs: ["leica-m11-monochrom", "lumina-carbon-air-travel-tripod"],
  },
];
