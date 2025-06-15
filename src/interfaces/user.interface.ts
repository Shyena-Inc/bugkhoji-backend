export type UserRole = "RESEARCHER" | "ADMIN" | "ORGANIZATION";

export interface IUserInput {
  username: string;
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface IUserOutput {
  sessionId: string | undefined;
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserUpdate {
  username?: string;
  fullName?: string;
  email?: string;
  password?: string;
  role?: UserRole;
}
