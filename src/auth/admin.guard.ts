import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

interface AuthenticatedUser {
  email: string;
  sub?: string;
  username?: string;
}

interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const user = request.user;

    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];

    if (!user || !adminEmails.includes(user.email)) {
      throw new ForbiddenException('สิทธิ์การเข้าถึงจำกัดเฉพาะผู้ดูแลระบบ');
    }

    return true;
  }
}
