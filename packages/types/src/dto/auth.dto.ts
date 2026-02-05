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
  };
}

export interface TokenPayloadDto {
  sub: string;
  phone: string;
  role: string;
  iat: number;
  exp: number;
}
