import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // ข้อมูลที่ได้จาก JwtGuard ก่อนหน้า

    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];

    if (!user || !adminEmails.includes(user.email)) {
      throw new ForbiddenException('สิทธิ์การเข้าถึงจำกัดเฉพาะผู้ดูแลระบบ');
    }

    return true;
  }
}
