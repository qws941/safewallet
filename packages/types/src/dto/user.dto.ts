import type { UserRole } from "../enums";

export interface UserDto {
  id: string;
  phone: string;
  nameMasked: string | null;
  role: UserRole;
  createdAt: string;
}

export interface UserProfileDto {
  id: string;
  phone: string;
  nameMasked: string | null;
  role: UserRole;
  piiViewFull: boolean;
  canAwardPoints: boolean;
  canManageUsers: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileDto {
  nameMasked?: string;
}
