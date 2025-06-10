export interface Session {
  sessionId: string;
  userId: string;
  ip: string;
  userAgent: string;
  location?: string;
  createdAt: Date;
  lastSeen: Date;
  isActive: boolean;
  deviceInfo?: {
    browser: string;
    os: string;
    device: string;
  };
}