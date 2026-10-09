# Issue #166 — Lịch cá nhân Member & Coach

**Source of truth:** `api.design` (Booking § `/me/schedule`; Class § `/coach/schedule`), Prisma schema and project source on `main`, read 2026-10-09.

## Thay đổi

- Shared query schema: bắt buộc `from`, `to` kiểu `YYYY-MM-DD` và `from <= to` (validation 422).
- Shared response types cho booking, member session và coach session, đúng `api.design`.
- Repository truy vấn booking theo `accountId`, class session qua enrollment, coach session theo `Class.coachId`, không loại buổi `CANCELLED`.
- Mapper chuyển `@db.Date`, `@db.Time` thành `YYYY-MM-DD`, `HH:mm`, trả facility/class/coach refs; service gộp, sắp xếp ngày-giờ tăng dần.
- Route có `auth`, `isRole`, `validate`; đăng ký ở `root.routes.ts`.
- Integration test dùng test DB với isolation và RBAC.

## Lưu ý nghiệp vụ

Class cancellation của repo hủy enrollment. Để vẫn hiển thị lớp đã hủy, truy vấn chấp nhận enrollment `CANCELLED` nếu lớp `CANCELLED`. Trường hợp member đã chủ động hủy enrollment trước khi lớp hủy có thể vẫn xuất hiện; schema hiện tại thiếu `cancelReason`/`source` ở enrollment để phân biệt nguyên nhân. Cần làm rõ rule trước khi release nếu muốn loại trừ chính xác.

Coach chuyển giao lớp chỉ giữ `Class.coachId` hiện tại, không có coach lịch sử theo session: endpoint phản ánh coach hiện tại. Không thêm bảng hoặc migration.

## 5 commit đề xuất, chỉ commit sau khi test đạt

1. `feat(schedule): define personal schedule query and response contracts` — 2 file shared schema/types và 2 index exports.
2. `feat(schedule): query member bookings and class sessions` — repository (1 file).
3. `feat(schedule): map and assemble personal schedules` — mapper, service (2 files).
4. `feat(schedule): expose member and coach schedule endpoints` — controller, routes, root routes (3 files).
5. `test(schedule): cover cancellation visibility and access rules` — test và README (2 files).

## Kiểm tra tự động (bắt buộc trước commit)

```bash
# từ root, sau khi cài dependencies, generate Prisma, chuẩn bị sports_center_test
bun --filter @sports-center/api typecheck
bun --filter @sports-center/api lint
cd apps/api
NODE_ENV=test bun test tests/personalSchedule.test.ts
NODE_ENV=test bun test tests/openapi.test.ts
```

Không được chạy integration test lên database thật: helper resetDatabase TRUNCATE bảng, chỉ cho DB có hậu tố `_test`.

## Swagger manual QA

Server chạy tại http://localhost:8000, Swagger: http://localhost:8000/api/v1/docs/ . Login bằng account thực tế để browser nhận cookie `access_token`.

1. Member: `GET /api/v1/me/schedule?from=2026-10-19&to=2026-10-21` → 200; `result` là **mảng**, có `BOOKING` và `CLASS_SESSION` nếu có dữ liệu tương ứng; sắp theo date + startTime.
2. Coach: `GET /api/v1/coach/schedule?from=2026-10-19&to=2026-10-21` → 200; mỗi item có `class: {id,name}` và session fields.
3. Hủy một buổi/lớp qua các API hợp lệ, gọi lại GET: buổi bị hủy còn trong mảng với `status: CANCELLED`.
4. Đăng nhập Coach gọi `/me/schedule`, Member gọi `/coach/schedule` → 403.
5. Thiếu from/to hoặc `from > to` → 422 `VALIDATION_ERROR`; không đăng nhập → 401.
6. Không có dữ liệu → 200, `result: []`; kiểm tra member khác không nhìn thấy lịch của nhau.

**Trạng thái xác minh:** Chưa thể thực hiện Swagger manual QA: môi trường tạo artifact không có server dự án hay DB người dùng, và clone GitHub trực tiếp không khả dụng. Không được ghi PASS hoặc commit trước khi hoàn thành các bước này.
