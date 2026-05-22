import api from './axios';
import { AUTH } from './routes';
import type { User, ApiResponse } from '@/types';

export const authApi = {
  signup: (data: {
    username: string;
    email: string;
    password: string;
    phone?: string;
    role: 'customer' | 'seller';
  }) => api.post<ApiResponse<User>>(AUTH.SIGNUP, data),

  login: (data: { email: string; password: string }) =>
    api.post<ApiResponse<User>>(AUTH.LOGIN, data),

  logout: () =>
    api.post<ApiResponse>(AUTH.LOGOUT),

  // GET /api/auth/profile
  profile: () =>
    api.get<ApiResponse<User>>(AUTH.PROFILE),

  // PUT /api/auth/profile  { username?, phone? }
  updateProfile: (data: { username?: string; phone?: string }) =>
    api.put<ApiResponse<User>>(AUTH.UPDATE_PROFILE, data),

  // POST /api/auth/profile/photo  multipart/form-data { photo: File }
  uploadProfilePhoto: (file: File) => {
    const fd = new FormData();
    fd.append('photo', file);
    return api.post<ApiResponse<{ profile_photo: string }>>(
      AUTH.PROFILE_PHOTO,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },

  refresh: () =>
    api.post<ApiResponse>(AUTH.REFRESH_TOKEN),

  forgotPassword: (email: string) =>
    api.post<ApiResponse>(AUTH.FORGOT_PASSWORD, { email }),

  resetPassword: (data: { email: string; otp_code: string; new_password: string }) =>
    api.post<ApiResponse>(AUTH.RESET_PASSWORD, data),

  deleteAccount: () =>
    api.delete<ApiResponse>(AUTH.DELETE_ACCOUNT),
};
