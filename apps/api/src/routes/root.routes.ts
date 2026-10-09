import { Router } from 'express';

import { myAttendanceRouter } from '~/routes/attendance.routes';
import auditRouter from '~/routes/audit.routes';
import authRouter from '~/routes/auth.routes';
import bankTransactionRouter from '~/routes/bankTransaction.routes';
import { bookingRouter, myBookingRouter } from '~/routes/booking.routes';
import { checkinRouter, myCheckinRouter } from '~/routes/checkin.routes';
import checkoutRouter from '~/routes/checkout.routes';
import { classRouter, coachClassRouter, coachRegistrationRouter } from '~/routes/class.routes';
import couponRouter from '~/routes/coupon.routes';
import courseRouter from '~/routes/course.routes';
import cronRouter from '~/routes/cron.routes';
import { enrollmentRouter, myEnrollmentRouter } from '~/routes/enrollment.routes';
import facilityRouter from '~/routes/facility.routes';
import { facilityPackageRouter, myFacilityPackageRouter } from '~/routes/facilityPackage.routes';
import { invoiceRouter, myInvoiceRouter } from '~/routes/invoice.routes';
import maintenanceRouter from '~/routes/maintenance.routes';
import { myMembershipRouter } from '~/routes/memberMembership.routes';
import membershipRouter from '~/routes/membership.routes';
import notificationRouter from '~/routes/notification.routes';
import { myOrderRouter, orderRouter } from '~/routes/order.routes';
import paymentRouter from '~/routes/payment.routes';
import { coachScheduleRouter, memberScheduleRouter } from '~/routes/personalSchedule.routes';
import reportRouter from '~/routes/report.routes';
import sessionRouter from '~/routes/session.routes';
import settingRouter from '~/routes/setting.routes';
import { coachSpecializationRouter, managerSpecializationRouter } from '~/routes/specialization.routes';
import sportRouter from '~/routes/sport.routes';
import { mySupportRouter, supportRouter } from '~/routes/support.routes';
import { evaluationRouter, myEvaluationRouter } from '~/routes/training.routes';
import uploadRouter from '~/routes/upload.routes';
import userRouter from '~/routes/user.routes';
import { myWalletRouter, walletRouter } from '~/routes/wallet.routes';
import { ResponseClient } from '~/rules/response';

const rootRouter = Router();

rootRouter.get('/health', (_req, res) => {
  res.json(new ResponseClient({ message: 'OK' }));
});

export const apiRoutes: [string, Router][] = [
  ['/audit-logs', auditRouter],
  ['/auth', authRouter],
  ['/bank-transactions', bankTransactionRouter],
  ['/bookings', bookingRouter],
  ['/checkins', checkinRouter],
  ['/checkout', checkoutRouter],
  ['/coach/classes', coachClassRouter],
  ['/coach/registrations', coachRegistrationRouter],
  ['/coach/specializations', coachSpecializationRouter],
  ['/coach/schedule', coachScheduleRouter],
  ['/classes', classRouter],
  ['/coupons', couponRouter],
  ['/courses', courseRouter],
  ['/cron', cronRouter],
  ['/enrollments', enrollmentRouter],
  ['/evaluations', evaluationRouter],
  ['/facilities', facilityRouter],
  ['/facility-packages', facilityPackageRouter],
  ['/invoices', invoiceRouter],
  ['/maintenances', maintenanceRouter],
  ['/memberships', membershipRouter],
  ['/me/bookings', myBookingRouter],
  ['/me/checkins', myCheckinRouter],
  ['/me/enrollments', myEnrollmentRouter],
  ['/me/evaluations', myEvaluationRouter],
  ['/me/facility-packages', myFacilityPackageRouter],
  ['/me/invoices', myInvoiceRouter],
  ['/me/attendance', myAttendanceRouter],
  ['/me/memberships', myMembershipRouter],
  ['/me/orders', myOrderRouter],
  ['/me/notifications', notificationRouter],
  ['/me/schedule', memberScheduleRouter],
  ['/me/wallet', myWalletRouter],
  ['/me/support-requests', mySupportRouter],
  ['/orders', orderRouter],
  ['/payments', paymentRouter],
  ['/reports', reportRouter],
  ['/settings', settingRouter],
  ['/sessions', sessionRouter],
  ['/specializations', managerSpecializationRouter],
  ['/sports', sportRouter],
  ['/support-requests', supportRouter],
  ['/uploads', uploadRouter],
  ['/users', userRouter],
  ['/wallet', walletRouter],
];

for (const [path, router] of apiRoutes) rootRouter.use(path, router);

export default rootRouter;
