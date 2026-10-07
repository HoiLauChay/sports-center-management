import type {
  Account,
  ApiResponse,
  ChangePasswordBody,
  LoginBody,
  RegisterBody,
  ResetPasswordBody,
  SendOtpBody,
} from '@sports-center/shared';
import { privateApi, publicApi } from '~/lib/http';

export const authService = {
  sendOtp: async (payload: SendOtpBody) => {
    const { data } = await publicApi.post<ApiResponse>('/auth/send-otp', payload);
    return data.message;
  },

  register: async (payload: RegisterBody) => {
    const { data } = await publicApi.post<ApiResponse<Account>>('/auth/register', payload);
    return data.result;
  },

  login: async (payload: LoginBody) => {
    const { data } = await publicApi.post<ApiResponse<Account>>('/auth/login', payload);
    return data.result;
  },

  me: async () => {
    const { data } = await privateApi.get<ApiResponse<Account>>('/auth/me');
    return data.result;
  },

  logout: async () => {
    await publicApi.post('/auth/logout');
  },

  logoutAll: async () => {
    await privateApi.post('/auth/logout-all');
  },

  changePassword: async (payload: ChangePasswordBody) => {
    const { data } = await privateApi.post<ApiResponse>('/auth/change-password', payload);
    return data.message;
  },

  resetPassword: async (payload: ResetPasswordBody) => {
    const { data } = await publicApi.post<ApiResponse>('/auth/reset-password', payload);
    return data.message;
  },
};
