const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request(method: string, url: string, data?: any, headers?: Record<string, string>) {
    const token = localStorage.getItem('authToken');
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      defaultHeaders.Authorization = `Bearer ${token}`;
    }

    const finalHeaders = { ...defaultHeaders, ...headers };

    const config: RequestInit = {
      method,
      headers: finalHeaders,
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(`${this.baseURL}${url}`, config);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  get(url: string, headers?: Record<string, string>) {
    return this.request('GET', url, undefined, headers);
  }

  post(url: string, data?: any, headers?: Record<string, string>) {
    return this.request('POST', url, data, headers);
  }

  put(url: string, data?: any, headers?: Record<string, string>) {
    return this.request('PUT', url, data, headers);
  }

  delete(url: string, headers?: Record<string, string>) {
    return this.request('DELETE', url, undefined, headers);
  }
}

const apiClient = new ApiClient(`${API_BASE_URL}/api`);

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  
  register: (email: string, password: string, displayName?: string) =>
    apiClient.post('/auth/register', { email, password, displayName }),
  
  verifyToken: () =>
    apiClient.get('/auth/verify'),
  
  logout: () =>
    apiClient.post('/auth/logout')
};

export const messageApi = {
  getChatRooms: () =>
    apiClient.get('/messages/rooms'),
  
  createChatRoom: (name: string, description?: string, isPrivate = false) =>
    apiClient.post('/messages/rooms', { name, description, isPrivate }),
  
  getMessages: (roomId: string, limit = 50, skip = 0) =>
    apiClient.get(`/messages/rooms/${roomId}/messages?limit=${limit}&skip=${skip}`),
  
  sendMessage: (roomId: string, content: string, messageType = 'text', replyTo?: string) =>
    apiClient.post(`/messages/rooms/${roomId}/messages`, { content, messageType, replyTo }),
  
  editMessage: (messageId: string, content: string) =>
    apiClient.put(`/messages/messages/${messageId}`, { content }),
  
  deleteMessage: (messageId: string) =>
    apiClient.delete(`/messages/messages/${messageId}`)
};

export const userApi = {
  getProfile: () =>
    apiClient.get('/users/profile'),
  
  updateProfile: (data: any) =>
    apiClient.put('/users/profile', data),
  
  getAllUsers: (page = 1, limit = 50) =>
    apiClient.get(`/users?page=${page}&limit=${limit}`)
};

export const monitoringApi = {
  getHealthStatus: () =>
    apiClient.get('/monitoring/health'),
  
  getSystemMetrics: () =>
    apiClient.get('/monitoring/metrics'),
  
  getAccessLogs: (page = 1, limit = 100) =>
    apiClient.get(`/monitoring/logs?page=${page}&limit=${limit}`),
  
  getPerformanceMetrics: (range = '24h') =>
    apiClient.get(`/monitoring/performance?range=${range}`),
  
  performHealthCheck: () =>
    apiClient.post('/monitoring/health-check')
};