import { privateApi, publicApi } from '~/lib/http';
import type { ApiResponse } from '~/types/api';
import type {
  AuthUser,
  ChangePasswordPayload,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
  SendOtpPayload,
} from '../types';

export const authService = {
  sendOtp: async (payload: SendOtpPayload) => {
    const { data } = await publicApi.post<ApiResponse>('/auth/send-otp', payload);
    return data.message;
  },

  register: async (payload: RegisterPayload) => {
    const { data } = await publicApi.post<ApiResponse<AuthUser>>('/auth/register', payload);
    return data.result;
  },

  login: async (payload: LoginPayload) => {
    const { data } = await publicApi.post<ApiResponse<AuthUser>>('/auth/login', payload);
    return data.result;
  },

  me: async () => {
    const { data } = await privateApi.get<ApiResponse<AuthUser>>('/auth/me');
    return data.result;
  },

  logout: async () => {
    await publicApi.post('/auth/logout');
  },

  logoutAll: async () => {
    await privateApi.post('/auth/logout-all');
  },

  changePassword: async (payload: ChangePasswordPayload) => {
    const { data } = await privateApi.post<ApiResponse>('/auth/change-password', payload);
    return data.message;
  },

  resetPassword: async (payload: ResetPasswordPayload) => {
    const { data } = await publicApi.post<ApiResponse>('/auth/reset-password', payload);
    return data.message;
  },
};
