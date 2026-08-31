import type {
  AlertSeverity,
  AlertStatus,
  CaseStatus,
  TransactionStatus,
  UserRole,
} from './enums.js';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}

export interface SessionDto {
  user: UserDto;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CustomerDto {
  id: string;
  externalId: string;
  fullName: string;
  email: string | null;
  kycStatus: string;
  createdAt: string;
}

export interface TransactionDto {
  id: string;
  reference: string;
  amount: string;
  currency: string;
  status: TransactionStatus;
  customerId: string;
  occurredAt: string;
}

export interface AlertDto {
  id: string;
  title: string;
  severity: AlertSeverity;
  status: AlertStatus;
  source: string;
  transactionId: string | null;
  assignedToId: string | null;
  createdAt: string;
}

export interface CaseDto {
  id: string;
  title: string;
  status: CaseStatus;
  customerId: string | null;
  assignedToId: string | null;
  createdAt: string;
}
