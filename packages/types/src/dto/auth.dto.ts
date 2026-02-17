export interface OtpRequestDto {
  phone: string;
}

export interface OtpVerifyDto {
  phone: string;
  otpCode: string;
}

export interface TokenRefreshDto {
  refreshToken: string;
}

export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    phone: string;
    nameMasked: string | null;
    role: string;
    companyName?: string | null;
    tradeType?: string | null;
  };
}

export interface TokenPayloadDto {
  sub: string;
  phone: string;
  role: string;
  iat: number;
  exp: number;
}

export interface MeResponseDto {
  id: string;
  name: string;
  nameMasked: string | null;
  phone: string;
  role: string;
  siteId: string | null;
  siteName: string | null;
  permissions: string[];
  todayAttendance: {
    status: string;
    checkInAt: string;
  } | null;
}
