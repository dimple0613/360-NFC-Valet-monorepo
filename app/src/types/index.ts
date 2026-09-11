export type UserRole = "driver" | "admin";

export interface Driver {
  id: number;
  valetId: string;
  fullName: string;
  initials: string;
  avatarColor: string;
  email: string | null;
  phone: string | null;
  status: "on_shift" | "off_duty" | "on_break";
  propertyId: number;
  propertyName: string;
  shiftStartedAt: string | null;
  todayOrders?: number;
  avgReturnMin?: number;
}

export interface DriverLoginResponse {
  token: string;
  driver: Driver;
}

export interface Property {
  id: number;
  name: string;
  area: string;
  city: string;
  slug: string;
  driversOnShift: number;
}

export interface DashboardStats {
  parkedToday: number;
  returnsPending: number;
  avgReturnMin: number;
}

export interface QueueItem {
  id: number;
  plate: string;
  car: string;
  zone: string | null;
  slot: string | null;
  status: "active" | "parked" | "returning" | "retrieving" | "returned";
  isMine?: boolean;
  driverName?: string;
  guestEta: string | null;
  createdAt: string;
  droppedAt: string | null;
  returnedAt: string | null;
  cardUid: string | null;
}

export interface HistoryItem {
  id: number;
  plate: string;
  car: string;
  zone: string | null;
  slot: string | null;
  cardUid: string | null;
  createdAt: string;
  droppedAt: string | null;
  returnedAt: string | null;
  durationSeconds: number | null;
}

export interface DriverProfile {
  id: number;
  valetId: string;
  fullName: string;
  initials: string;
  avatarColor: string;
  email: string | null;
  phone: string | null;
  status: string;
  shiftStartedAt: string | null;
  propertyId: number;
  propertyName: string;
  todayOrders: number;
  avgReturnMin: number;
}
