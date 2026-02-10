import axios from "axios";
import type { 
  Token, 
  MessageResponse, 
  User, 
  Deadline, 
  DeadlineType,
  DashboardStats,
  UserCreate
} from "../types";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRedirecting = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("auth-storage");
      if (!isRedirecting && window.location.pathname !== "/login") {
        isRedirecting = true;
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (username: string, password: string): Promise<Token> => {
    const response = await api.post<Token>("/auth/login", { email: username, password });
    return response.data;
  },
  logout: async (): Promise<MessageResponse> => {
    const response = await api.post<MessageResponse>("/auth/logout");
    return response.data;
  },
  me: async (): Promise<User> => {
    const response = await api.get<User>("/auth/me");
    return response.data;
  },
};

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const response = await api.get<DashboardStats>("/dashboard/stats");
    return response.data;
  },
};

export const usersApi = {
  list: async (): Promise<User[]> => {
    const response = await api.get<any>("/users");
    return response.data.users || response.data;
  },
  getAll: async (): Promise<User[]> => {
    const response = await api.get<any>("/users");
    return response.data.users || response.data;
  },
  getById: async (id: number): Promise<User> => {
    const response = await api.get<User>(`/users/${id}`);
    return response.data;
  },
  create: async (data: UserCreate): Promise<User> => {
    const response = await api.post<User>("/users", data);
    return response.data;
  },
  update: async (id: number, data: Partial<User>): Promise<User> => {
    const response = await api.put<User>(`/users/${id}`, data);
    return response.data;
  },
  delete: async (id: number): Promise<MessageResponse> => {
    const response = await api.delete<MessageResponse>(`/users/${id}`);
    return response.data;
  },
  generateCode: async (id: number): Promise<{ code: string; expires_at: string }> => {
    const response = await api.post<{ code: string; expires_at: string }>(`/users/${id}/generate-code`);
    return response.data;
  },
};

export const deadlinesApi = {
  list: async (params?: { client_id?: number; type_id?: number; status?: string }): Promise<Deadline[]> => {
    const response = await api.get<any>("/deadlines", { params });
    return response.data.deadlines || response.data;
  },
  getAll: async (params?: { client_id?: number; type_id?: number; status?: string }): Promise<Deadline[]> => {
    const response = await api.get<any>("/deadlines", { params });
    return response.data.deadlines || response.data;
  },
  urgent: async (_days?: number): Promise<Deadline[]> => {
    const response = await api.get<any>("/deadlines", { params: { status: "red" } });
    return response.data.deadlines || response.data;
  },
  getById: async (id: number): Promise<Deadline> => {
    const response = await api.get<Deadline>(`/deadlines/${id}`);
    return response.data;
  },
  create: async (data: Partial<Deadline>): Promise<Deadline> => {
    const response = await api.post<Deadline>("/deadlines", data);
    return response.data;
  },
  update: async (id: number, data: Partial<Deadline>): Promise<Deadline> => {
    const response = await api.put<Deadline>(`/deadlines/${id}`, data);
    return response.data;
  },
  delete: async (id: number): Promise<MessageResponse> => {
    const response = await api.delete<MessageResponse>(`/deadlines/${id}`);
    return response.data;
  },
  markComplete: async (id: number): Promise<Deadline> => {
    const response = await api.post<Deadline>(`/deadlines/${id}/complete`);
    return response.data;
  },
};

export const deadlineTypesApi = {
  list: async (): Promise<DeadlineType[]> => {
    const response = await api.get<DeadlineType[]>("/deadline-types");
    return response.data;
  },
  getAll: async (): Promise<DeadlineType[]> => {
    const response = await api.get<DeadlineType[]>("/deadline-types");
    return response.data;
  },
  getById: async (id: number): Promise<DeadlineType> => {
    const response = await api.get<DeadlineType>(`/deadline-types/${id}`);
    return response.data;
  },
  create: async (data: Partial<DeadlineType>): Promise<DeadlineType> => {
    const response = await api.post<DeadlineType>("/deadline-types", data);
    return response.data;
  },
  update: async (id: number, data: Partial<DeadlineType>): Promise<DeadlineType> => {
    const response = await api.put<DeadlineType>(`/deadline-types/${id}`, data);
    return response.data;
  },
  delete: async (id: number): Promise<MessageResponse> => {
    const response = await api.delete<MessageResponse>(`/deadline-types/${id}`);
    return response.data;
  },
};


// Setup API (first-run configuration + public settings)
export const setupApi = {
  getStatus: async (): Promise<{ needs_setup: boolean }> => {
    const response = await axios.get<{ needs_setup: boolean }>("/api/setup/status");
    return response.data;
  },
  getSettings: async (): Promise<{ company_name: string }> => {
    const response = await axios.get<{ company_name: string }>("/api/setup/settings");
    return response.data;
  },
  createAdmin: async (data: { email: string; password: string; full_name: string; company_name?: string }): Promise<{ message: string; email: string }> => {
    const response = await axios.post<{ message: string; email: string }>("/api/setup", data);
    return response.data;
  },
};

export default api;

// Support Requests API
export interface SupportRequest {
  id: number;
  client_id: number;
  subject: string;
  message: string;
  contact_phone: string;
  status: "new" | "in_progress" | "resolved" | "closed";
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  client_name?: string;
  client_company?: string;
}

export const supportApi = {
  list: async (status?: string): Promise<SupportRequest[]> => {
    const params = status ? { status_filter: status } : {};
    const response = await api.get<SupportRequest[]>("/support-requests/", { params });
    return response.data;
  },
  update: async (id: number, data: { status?: string; resolution_notes?: string }): Promise<SupportRequest> => {
    const response = await api.patch<SupportRequest>(`/support-requests/${id}`, data);
    return response.data;
  },
  getStats: async (): Promise<{total: number; new: number; in_progress: number; resolved: number; closed: number}> => {
    const response = await api.get<any>("/support-requests/stats/summary");
    return response.data;
  },
};

// Database API
export const databaseApi = {
  getBackups: async (): Promise<any> => {
    const response = await api.get<any>("/database/backups");
    return response.data;
  },
  createBackup: async (description?: string): Promise<any> => {
    const response = await api.post<any>("/database/backup", { description });
    return response.data;
  },
  getStats: async (): Promise<any> => {
    const response = await api.get<any>("/database/stats");
    return response.data;
  },
  downloadBackup: (filename: string): string => {
    return `/api/database/backups/${encodeURIComponent(filename)}`;
  },
  uploadBackup: async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<any>("/database/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },
  restoreBackup: async (filename: string, password: string): Promise<any> => {
    const response = await api.post<any>("/database/restore", { filename, password });
    return response.data;
  },
};

// Cash Registers API
export interface CashRegister {
  id: number;
  client_id: number;
  factory_number?: string;
  registration_number?: string;
  model?: string;
  register_name?: string;
  installation_address?: string;
  fn_number?: string;
  ofd_provider_id?: number;
  ofd_expiry_date?: string;
  fn_expiry_date?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
}

export interface CashRegisterCreate {
  client_id: number;
  factory_number?: string;
  registration_number?: string;
  model?: string;
  register_name?: string;
  installation_address?: string;
  fn_number?: string;
  ofd_provider_id?: number;
  ofd_expiry_date?: string;
  fn_expiry_date?: string;
  notes?: string;
}

export interface CashRegisterUpdate {
  factory_number?: string;
  registration_number?: string;
  model?: string;
  register_name?: string;
  installation_address?: string;
  fn_number?: string;
  ofd_provider_id?: number;
  ofd_expiry_date?: string | null;
  fn_expiry_date?: string | null;
  notes?: string;
  is_active?: boolean;
}

export const cashRegistersApi = {
  getByClient: async (clientId: number): Promise<CashRegister[]> => {
    const response = await api.get<any>(`/cash-registers/client/${clientId}`);
    return response.data.cash_registers || response.data;
  },
  getAll: async (): Promise<CashRegister[]> => {
    const response = await api.get<any>("/cash-registers/");
    return response.data.cash_registers || response.data;
  },
  create: async (data: CashRegisterCreate): Promise<CashRegister> => {
    const response = await api.post<CashRegister>("/cash-registers", data);
    return response.data;
  },
  update: async (id: number, data: CashRegisterUpdate): Promise<CashRegister> => {
    const response = await api.put<CashRegister>(`/cash-registers/${id}`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/cash-registers/${id}`);
  },
};

// Client deadlines
export const clientApi = {
  getDeadlines: async (clientId: number): Promise<Deadline[]> => {
    const response = await api.get<any>("/deadlines", { params: { client_id: clientId, limit: 1000 } });
    return response.data.deadlines || response.data;
  },
};

// OFD Providers
export interface OFDProvider {
  id: number;
  name: string;
  website?: string;
  support_phone?: string;
  support_email?: string;
  is_active: boolean;
}

export const ofdProvidersApi = {
  list: async (): Promise<OFDProvider[]> => {
    const response = await api.get<OFDProvider[]>("/ofd-providers");
    return response.data;
  },
};
