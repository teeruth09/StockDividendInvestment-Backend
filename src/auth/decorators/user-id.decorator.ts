// src/auth/decorators/user-id.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface RequestWithUser {
  user?: {
    user_id: string;
  };
}

// 💡 Custom Decorator สำหรับดึง userId จาก Request Object
export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();

    // 🚨 สมมติว่า JWT Strategy ของคุณแนบ Payload ไว้ที่ request.user
    // และ user object มี field ชื่อ user_id
    // ถ้าคุณใช้ 'userId' ใน Guard, ให้เปลี่ยนเป็น request.user.userId
    const userId = request.user?.user_id;

    if (!userId) {
      throw new Error('User ID not found in token payload.');
    }

    return userId;
  },
);
