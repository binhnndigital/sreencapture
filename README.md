# Full Page Screen Capture

Chrome extension (Manifest V3) chụp ảnh **toàn bộ trang web** — kể cả phần nằm ngoài khung nhìn phải cuộn mới thấy — rồi lưu về dưới dạng PNG.

Khác với các addon chỉ chụp vùng hiển thị (viewport), extension này tự động cuộn trang, chụp từng khung bằng `chrome.tabs.captureVisibleTab`, rồi ghép các ảnh lại bằng canvas trong một offscreen document.

## Cài đặt (developer mode)

1. Mở `chrome://extensions`
2. Bật **Developer mode**
3. Chọn **Load unpacked** → trỏ tới thư mục repo này

## Cách dùng

Mở trang web bất kỳ → bấm icon extension trên toolbar. Extension sẽ tự cuộn trang, chụp và ghép ảnh, sau đó hiện hộp thoại lưu file `fullpage-<tên-trang>-<timestamp>.png`.

Nếu trang quá dài (vượt giới hạn canvas ~16000px), ảnh sẽ được tách thành nhiều file `...-part1.png`, `...-part2.png`, ...

## Giới hạn

- Không chụp được trang `chrome://`, Chrome Web Store, hoặc PDF viewer.
- Phần tử `position: fixed` có thể bị lặp lại trong ảnh ghép (giới hạn của cơ chế scroll-and-stitch).
- Chỉ hỗ trợ cuộn dọc toàn trang; nội dung cuộn ngang được cắt theo chiều rộng viewport.

## Cấu trúc

- `manifest.json` — manifest V3, quyền `activeTab`, `tabs`, `scripting`, `downloads`, `offscreen`
- `background.js` — service worker: điều khiển cuộn trang + `captureVisibleTab`, gọi offscreen để ghép, tải file về
- `content.js` — content script: báo kích thước trang, xử lý scroll, khôi phục vị trí cuộn
- `offscreen/` — offscreen document ghép ảnh bằng canvas, xuất PNG dạng data URL
