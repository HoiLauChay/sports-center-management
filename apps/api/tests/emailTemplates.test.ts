import { describe, expect, test } from 'bun:test';

import { activationTemplate } from '~/templates/activation.template';
import { notificationTemplate } from '~/templates/notification.template';
import { otpTemplate } from '~/templates/otp.template';

describe('email templates', () => {
  test('notification emails escape user data and keep a plain-text version', () => {
    const mail = notificationTemplate('<img src=x onerror=alert(1)>', {
      type: 'PAYMENT',
      title: 'Hoàn tiền <script>',
      message: 'Ví được hoàn 120.000đ cho "Sân 2" & <b>x</b>.',
      createdAt: new Date('2026-11-06T08:35:00Z'),
    });

    expect(mail.subject).toBe('[Sports Center] Hoàn tiền <script>');
    expect(mail.html).not.toContain('<img src=x');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(mail.html).toContain('<strong style="color:#14130f;white-space:nowrap">120.000đ</strong>');
    expect(mail.text).toContain('Ví được hoàn 120.000đ cho "Sân 2" & <b>x</b>.');
    expect(mail.text).toContain('Số tiền: 120.000đ');
    expect(mail.text).toContain('Thời gian: 06/11/2026 15:35');
  });

  test('only a single amount becomes its own detail row', () => {
    const mail = notificationTemplate('An', {
      type: 'MEMBERSHIP',
      title: 'Gia hạn gói không thành công',
      message: 'Cần 1.500.000đ, ví còn 320.000đ.',
      createdAt: new Date('2026-11-06T08:35:00Z'),
    });

    expect(mail.text).not.toContain('Số tiền:');
  });

  test('code and activation emails keep their subject and carry the code or link', () => {
    const otp = otpTemplate('PASSWORD_RESET', '107364');
    expect(otp.subject).toBe('[Sports Center] Mã xác nhận đặt lại mật khẩu');
    expect(otp.html).toContain('107364');
    expect(otp.text).toContain('Mã xác nhận: 107364');

    const url = 'https://app.example.com/activate?token=a&b=1';
    const activation = activationTemplate('Bình', url, 'CREATED');
    expect(activation.subject).toBe('[Sports Center] Kích hoạt tài khoản Sports Center');
    expect(activation.html).toContain('href="https://app.example.com/activate?token=a&amp;b=1"');
    expect(activation.text).toContain(url);
  });
});
