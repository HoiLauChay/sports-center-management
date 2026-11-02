/**
 * The center's rules in plain words, for the assistant to quote (`get_policies`). Written from the business rules of
 * detail.v4.md; when a rule changes there, change it here. Amounts set by the manager stay out: they come from
 * `get_center_info`.
 */
export const POLICY_TOPICS = [
  'BOOKING',
  'CLASS',
  'MEMBERSHIP',
  'WALLET',
  'REFUND',
  'COUPON',
  'CHECKIN',
  'SUPPORT',
] as const;
export type PolicyTopic = (typeof POLICY_TOPICS)[number];

export const POLICIES: Record<PolicyTopic, string[]> = {
  BOOKING: [
    'Đặt sân lẻ chỉ được đặt trước trong số ngày tối đa của trung tâm (xem get_center_info).',
    'Giá mỗi sân như nhau ở mọi khung giờ. Giá cuối là giá gốc trừ quyền lợi gói thành viên, rồi trừ coupon.',
    'Sân đã thanh toán không hủy được, kể cả qua lễ tân. Không đến vẫn tính là đã dùng và không hoàn tiền.',
    'Sân bị bảo trì thì lượt đặt được chuyển sang sân khác, giá và giờ giữ nguyên.',
    'Slot có buổi học thì không đặt lẻ được. Một người không thể có hai lượt đặt hoặc buổi học trùng giờ.',
    'Khách không có tài khoản chỉ mua được sân lẻ tại quầy, không dùng ví, gói hay coupon và không được hoàn tiền.',
  ],
  CLASS: [
    'Chỉ đăng ký được lớp đang mở, chưa đến ngày bắt đầu, còn chỗ và không trùng lịch của mình.',
    'Hội viên tự hủy hoặc nhờ lễ tân hủy trước ngày khai giảng thì được hoàn trọn tiền lớp về ví. Từ ngày khai giảng trở đi không hủy được.',
    'Lớp bị trung tâm hủy, dù chưa bắt đầu hay đang học, thì được hoàn trọn tiền lớp về ví.',
    'Lớp không đủ sĩ số tối thiểu trước buổi đầu sẽ bị hủy và hoàn trọn tiền lớp.',
    'Không hủy riêng một buổi học. Buổi chưa diễn ra có thể được dời hoặc đổi phòng, không hoàn tiền.',
    'Mọi thay đổi lịch đều được thông báo tự động.',
  ],
  MEMBERSHIP: [
    'Mỗi người có tối đa một gói đang hiệu lực. Gói bắt đầu từ ngày mua, không mua trước kỳ sau.',
    'Quyền lợi gồm giảm giá đặt sân, giảm giá đăng ký lớp, vào phòng gym miễn phí và số slot miễn phí mỗi tháng, tùy gói. Quyền lợi giữ theo kỳ đã mua dù gói được sửa sau đó.',
    'Slot miễn phí tính theo tháng lịch của ngày đặt sân.',
    'Vào gym miễn phí vẫn cần có lượt đặt 0đ để giữ chỗ và không tính vào slot miễn phí.',
    'Gói tự gia hạn khi đến hạn nếu chưa hủy, gói còn bán và ví đủ tiền. Ví không đủ thì gói hết hạn.',
    'Hủy đăng ký gói không hoàn tiền, vẫn dùng được quyền lợi đến hết hạn và không bỏ hủy được.',
    'Đổi sang gói khác: gói cũ kết thúc ngay hôm nay, mất mọi quyền lợi còn lại, không hoàn và không bù tiền; gói mới có hiệu lực từ hôm nay.',
  ],
  WALLET: [
    'Mỗi hội viên có một ví, số dư không âm và không rút tiền ra được.',
    'Nạp ví bằng chuyển khoản theo hóa đơn, tối thiểu theo mức của trung tâm (xem get_center_info), hoặc nạp tại quầy.',
    'Chuyển khoản phải ghi đúng mã hóa đơn và đúng số tiền thì mới được cộng tự động. Tiền đến sau khi hóa đơn hết hạn vẫn được cộng.',
    'Sai mã hoặc sai số tiền thì giao dịch chờ quản lý đối soát; khi đó nên gửi yêu cầu hỗ trợ.',
  ],
  REFUND: [
    'Tiền hoàn luôn về ví, hoàn trọn từng dịch vụ và mỗi dịch vụ chỉ hoàn một lần.',
    'Được hoàn: đăng ký lớp hủy trước ngày khai giảng, và lớp bị trung tâm hủy.',
    'Không hoàn: gói thành viên, sân đã đặt, dịch vụ 0đ và đơn của khách không có tài khoản.',
    'Lượt coupon đã dùng không được trả lại khi hoàn tiền.',
  ],
  COUPON: [
    'Mỗi đơn dùng một mã, chỉ cho hội viên có tài khoản.',
    'Mã chỉ giảm các dịch vụ thuộc loại áp dụng, tính sau quyền lợi gói thành viên.',
    'Lượt dùng tính theo đơn và không được trả lại khi đơn đã hoàn tiền.',
  ],
  CHECKIN: [
    'Check-in cần có lượt đặt sân hôm đó hoặc buổi học hợp lệ hôm đó.',
    'Có quyền vào gym nhưng chưa đặt thì lễ tân tạo lượt đặt phòng gym 0đ cho slot hiện tại rồi check-in.',
    'Check-in vào trung tâm và điểm danh buổi học là hai việc riêng.',
    'Điểm danh mở từ 15 phút trước giờ học. HLV sửa được tới 7 ngày sau ngày học, sau đó chỉ quản lý sửa được.',
  ],
  SUPPORT: [
    'Yêu cầu hỗ trợ gồm các loại: tài khoản, gói thành viên, đặt sân, lớp học, thanh toán và khác.',
    'Trạng thái đi theo thứ tự: mới, đang xử lý, đã giải quyết, đã đóng.',
  ],
};
