// Authentication Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface Token {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface TokenData {
  email?: string;
  user_id?: number;
  role?: string;
}

// User Types
export type UserRole = 'client' | 'manager' | 'admin';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  inn?: string;
  company_name?: string;
  phone?: string;
  address?: string;
  notes?: string;
  telegram_id?: string;
  telegram_username?: string;
  first_name?: string;
  last_name?: string;
  registration_code?: string;
  code_expires_at?: string;
  notification_days: string;
  notifications_enabled: boolean;
  is_active: boolean;
  registered_at: string;
  last_interaction?: string;
  created_at: string;
  updated_at: string;
}

export interface UserCreate {
  email: string;
  full_name: string;
  role?: UserRole;
  password?: string;
  inn?: string;
  company_name?: string;
  phone?: string;
  address?: string;
  notes?: string;
  notification_days?: string;
  notifications_enabled?: boolean;
}

export interface UserUpdate {
  email?: string;
  full_name?: string;
  role?: UserRole;
  password?: string;
  inn?: string;
  company_name?: string;
  phone?: string;
  address?: string;
  notes?: string;
  notification_days?: string;
  notifications_enabled?: boolean;
  is_active?: boolean;
}

export interface UserListResponse {
  total: number;
  page: number;
  limit: number;
  users: User[];
}

// Deadline Types
export interface DeadlineType {
  id: number;
  type_name: string;
  description?: string;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
}

export interface DeadlineTypeCreate {
  type_name: string;
  description?: string;
}

// Deadline
export type DeadlineStatus = 'active' | 'expired' | 'renewed';
export type StatusColor = 'green' | 'yellow' | 'red' | 'expired' | 'unknown';

export interface Deadline {
  id: number;
  user_id?: number;
  client_id?: number;
  deadline_type_id: number;
  expiration_date: string;
  notes?: string;
  status: DeadlineStatus;
  created_at: string;
  updated_at: string;
  days_until_expiration?: number;
  status_color?: StatusColor;
  notification_enabled?: boolean;
  // Nested objects from API
  client?: {
    id: number;
    company_name?: string;
    full_name?: string;
    inn?: string;
  };
  deadline_type?: {
    id: number;
    type_name: string;
  };
  cash_register_id?: number;
  cash_register_name?: string;
  installation_address?: string;
  // Legacy flat fields
  user_name?: string;
  company_name?: string;
  deadline_type_name?: string;
  client_name?: string;
}

export interface DeadlineCreate {
  user_id: number;
  deadline_type_id: number;
  cash_register_id?: number;
  expiration_date: string;
  notes?: string;
}

export interface DeadlineUpdate {
  user_id?: number;
  deadline_type_id?: number;
  cash_register_id?: number;
  expiration_date?: string;
  status?: DeadlineStatus;
  notes?: string;
}

export interface DeadlineListResponse {
  total: number;
  page: number;
  limit: number;
  deadlines: Deadline[];
}

// Dashboard Types
export interface StatusBreakdown {
  green: number;
  yellow: number;
  red: number;
  expired: number;
}

export interface DashboardStats {
  total_clients: number;
  active_clients: number;
  total_deadlines: number;
  total_cash_registers: number;
  status_green: number;
  status_yellow: number;
  status_red: number;
  status_expired: number;
}

// API Response Types
export interface MessageResponse {
  message: string;
  id?: number;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Array<{
      field: string;
      message: string;
    }>;
  };
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
}

// Filter Params
export interface UserFilterParams extends PaginationParams {
  role?: UserRole;
  search?: string;
  active_only?: boolean;
}

export interface DeadlineFilterParams extends PaginationParams {
  client_id?: number;
  deadline_type_id?: number;
  status?: StatusColor;
  sort_by?: string;
  order?: 'asc' | 'desc';
}
