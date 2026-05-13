import { api } from './client';
import type { 
  AuctionListResponse, ApiResponse, Category, 
  AuctionDetail, Comment, AuctionStats, CreateAuctionRequest, 
  NotificationListResponse, LikeToggleResponse 
} from './types';

const getSafeImageFileName = (file: File) => {
  const extension = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return extension ? `image.${extension}` : 'image';
};

export const auctionApi = {
  /**
   * 4.2 전체 경매 목록 조회
   * GET /auctions
   */
  getAuctions: async (params: {
    page?: number;
    size?: number;
    category?: string;
    q?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
  }): Promise<AuctionListResponse> => {
    const filteredParams = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== '')
    );
    const { data } = await api.get<AuctionListResponse>('/auctions', { params: filteredParams });
    return data;
  },

  /**
   * 4.2 경매 상세 조회
   * GET /auctions/{id}
   */
  getAuctionDetail: async (id: string): Promise<ApiResponse<AuctionDetail>> => {
    const { data } = await api.get<ApiResponse<AuctionDetail>>(`/auctions/${id}`);
    return data;
  },

  /**
   * 4.2 카테고리 목록 조회
   * GET /categories
   */
  getCategories: async (): Promise<ApiResponse<Category[]>> => {
    const { data } = await api.get<ApiResponse<Category[]>>('/categories');
    return data;
  },

  /**
   * 4.2 경매 등록
   * POST /auctions
   */
  createAuction: async (payload: CreateAuctionRequest): Promise<ApiResponse<{ auctionId: number }>> => {
    const { data } = await api.post<ApiResponse<{ auctionId: number }>>('/auctions', payload);
    return data;
  },

  /**
   * 4.3 입찰하기
   * POST /auctions/{id}/bids
   */
  placeBid: async (id: string, amount: number): Promise<ApiResponse<{ bidId: string; currentPrice: number }>> => {
    const { data } = await api.post<ApiResponse<{ bidId: string; currentPrice: number }>>(`/auctions/${id}/bids`, { price: amount });
    return data;
  },

  /**
   * 4.3 결제하기
   * POST /payments
   */
  processPayment: async (auctionId: number): Promise<ApiResponse<void>> => {
    const { data } = await api.post<ApiResponse<void>>('/payments', { auctionId });
    return data;
  },

  /**
   * 4.3 배송 시작 (설계서 추가)
   * PATCH /auctions/{id}/shipping
   */
  startShipping: async (id: string): Promise<ApiResponse<void>> => {
    const { data } = await api.patch<ApiResponse<void>>(`/auctions/${id}/shipping`);
    return data;
  },

  /**
   * 4.3 거래 확정 (설계서 추가)
   * PATCH /auctions/{id}/complete
   */
  completeTransaction: async (id: string): Promise<ApiResponse<void>> => {
    const { data } = await api.patch<ApiResponse<void>>(`/auctions/${id}/complete`);
    return data;
  },

  /**
   * 4.7 좋아요(관심목록) 토글
   * POST /auctions/{id}/likes
   */
  toggleLike: async (id: number): Promise<ApiResponse<LikeToggleResponse>> => {
    const { data } = await api.post<ApiResponse<LikeToggleResponse>>(`/auctions/${id}/likes`);
    return data;
  },

  /**
   * 4.8 댓글 목록 조회
   * GET /auctions/{id}/comments
   */
  getComments: async (id: string): Promise<ApiResponse<Comment[]>> => {
    const { data } = await api.get<ApiResponse<Comment[]>>(`/auctions/${id}/comments`);
    return data;
  },

  /**
   * 4.8 댓글 등록
   * POST /auctions/{id}/comments
   */
  postComment: async (id: string, content: string): Promise<ApiResponse<{ id: number }>> => {
    const { data } = await api.post<ApiResponse<{ id: number }>>(`/auctions/${id}/comments`, { content });
    return data;
  },

  /**
   * 4.8 문의 답변 등록
   * POST /auctions/{id}/comments/{commentId}/answers
   */
  postAnswer: async (auctionId: string, commentId: number, content: string): Promise<ApiResponse<{ id: number }>> => {
    const { data } = await api.post<ApiResponse<{ id: number }>>(`/auctions/${auctionId}/comments/${commentId}/answers`, { content });
    return data;
  },

  /**
   * 이미지 업로드
   * POST /images
   */
  uploadImage: async (file: File): Promise<ApiResponse<{
    imageUrl?: string;
    image_url?: string;
    imageKey?: string;
    image_key?: string;
    presignedUrl?: string;
    presigned_url?: string;
  }>> => {
    const formData = new FormData();
    formData.append('file', file, getSafeImageFileName(file));
    const { data } = await api.post<ApiResponse<{
      imageUrl?: string;
      image_url?: string;
      imageKey?: string;
      image_key?: string;
      presignedUrl?: string;
      presigned_url?: string;
    }>>('/images', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },

  /**
   * 4.5 알림 목록 조회
   * GET /notifications
   */
  getNotifications: async (params: { page?: number; size?: number } = {}): Promise<NotificationListResponse> => {
    const { data } = await api.get<NotificationListResponse>('/notifications', { params });
    return data;
  },

  /**
   * 4.6 알림 읽음 처리
   * PATCH /notifications/{id}
   */
  markNotificationAsRead: async (id: number): Promise<ApiResponse<void>> => {
    const { data } = await api.patch<ApiResponse<void>>(`/notifications/${id}`);
    return data;
  },

  /**
   * 알림 삭제
   * DELETE /notifications/{id}
   */
  deleteNotification: async (id: number): Promise<ApiResponse<void>> => {
    const { data } = await api.delete<ApiResponse<void>>(`/notifications/${id}`);
    return data;
  },

  /**
   * 읽은 알림 모두 삭제
   * DELETE /notifications/read
   */
  deleteReadNotifications: async (): Promise<ApiResponse<void>> => {
    const { data } = await api.delete<ApiResponse<void>>('/notifications/read');
    return data;
  },

  /**
   * 모든 알림 읽음 처리
   * PATCH /notifications/read
   */
  markAllNotificationsAsRead: async (): Promise<ApiResponse<void>> => {
    const { data } = await api.patch<ApiResponse<void>>('/notifications/read');
    return data;
  },

  /**
   * 통계 정보 조회
   */
  getAuctionStats: async (): Promise<ApiResponse<AuctionStats>> => {
    const { data } = await api.get<ApiResponse<AuctionStats>>('/auctions/stats');
    return data;
  }
};
