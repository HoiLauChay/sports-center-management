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

import {
  clearMockSession,
  findMockAccount,
  getMockSession,
  MOCK_DEMO_ACCOUNTS,
  setMockSession,
} from '../mocks/auth.mock';

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
    try {
      const { data } = await publicApi.post<ApiResponse<Account>>('/auth/login', payload);
      clearMockSession();
      return data.result;
    } catch (err) {
      if (import.meta.env.DEV) {
        const mock = findMockAccount(payload.email) ?? {
          ...MOCK_DEMO_ACCOUNTS[0]!,
          email: payload.email,
        };
        setMockSession(mock);
        return mock;
      }
      throw err;
    }
  },

  me: async () => {
    try {
      const { data } = await privateApi.get<ApiResponse<Account>>('/auth/me');
      return data.result;
    } catch (err) {
      if (import.meta.env.DEV) {
        const mock = getMockSession();
        if (mock) return mock;
      }
      throw err;
    }
  },

  logout: async () => {
    clearMockSession();
    await publicApi.post('/auth/logout').catch(() => undefined);
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
