import type {
  ApiResponse,
  MemberMembership,
  MyMemberships,
  StaffMembershipResult,
  SubscribeMemberBody,
} from '@sports-center/shared';
import { privateApi } from '~/lib/http';

const pathOf = (memberId: string) => `/users/${encodeURIComponent(memberId)}/memberships`;

export const memberMembershipsService = {
  list: async (memberId: string) => {
    const { data } = await privateApi.get<ApiResponse<MyMemberships>>(pathOf(memberId));
    return data.result;
  },

  subscribe: async (memberId: string, body: SubscribeMemberBody) => {
    const { data } = await privateApi.post<ApiResponse<StaffMembershipResult>>(pathOf(memberId), body);
    return data.result;
  },

  cancel: async (memberId: string, membershipId: string) => {
    const { data } = await privateApi.post<ApiResponse<MemberMembership>>(
      `${pathOf(memberId)}/${encodeURIComponent(membershipId)}/cancel`,
    );
    return data.result;
  },

  terminate: async (memberId: string, membershipId: string, reason: string) => {
    const { data } = await privateApi.post<ApiResponse<MemberMembership>>(
      `${pathOf(memberId)}/${encodeURIComponent(membershipId)}/terminate`,
      { reason },
    );
    return data.result;
  },
};
