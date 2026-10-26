import type {
  Account,
  ActivateAccountBody,
  ActivationInfo,
  ApiResponse,
  ChangePasswordBody,
  FirstPasswordBody,
  LoginBody,
  LoginStartResult,
  RegisterBody,
  ResetPasswordBody,
  SendOtpBody,
  SetPasswordBody,
  SwitchRoleBody,
  VerifyOtpBody,
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

  loginStart: async (email: string) => {
    const { data } = await publicApi.post<ApiResponse<LoginStartResult>>('/auth/login/start', { email });
    return data.result;
  },

  verifyOtp: async (payload: VerifyOtpBody) => {
    await publicApi.post('/auth/verify-otp', payload);
  },

  setPassword: async (payload: SetPasswordBody) => {
    const { data } = await publicApi.post<ApiResponse<Account>>('/auth/set-password', payload);
    return data.result;
  },

  setFirstPassword: async (payload: FirstPasswordBody) => {
    const { data } = await privateApi.post<ApiResponse<Account>>('/auth/first-password', payload);
    return data.result;
  },

  checkActivation: async (token: string) => {
    const { data } = await publicApi.post<ApiResponse<ActivationInfo>>('/auth/activation', { token });
    return data.result;
  },

  activate: async (payload: ActivateAccountBody) => {
    const { data } = await publicApi.post<ApiResponse<Account>>('/auth/activate', payload);
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

  switchRole: async (payload: SwitchRoleBody) => {
    const { data } = await privateApi.post<ApiResponse<Account>>('/auth/me/role', payload);
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
