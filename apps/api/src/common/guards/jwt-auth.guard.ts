import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser extends { iat?: number }>(err: Error | null, user: TUser): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }

    if (user.iat) {
      const issuedDate = new Date(user.iat * 1000);
      const today = new Date();

      const issuedDay = issuedDate.toISOString().slice(0, 10);
      const currentDay = today.toISOString().slice(0, 10);

      if (issuedDay !== currentDay) {
        throw new UnauthorizedException('세션이 만료되었습니다. 다시 로그인해주세요.');
      }
    }

    return user;
  }
}
