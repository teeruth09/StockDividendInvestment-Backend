// src/auth/decorators/user-id.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// 💡 Custom Decorator สำหรับดึง userId จาก Request Object
export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();

    // 🚨 สมมติว่า JWT Strategy ของคุณแนบ Payload ไว้ที่ request.user
    // และ user object มี field ชื่อ user_id
    // ถ้าคุณใช้ 'userId' ใน Guard, ให้เปลี่ยนเป็น request.user.userId
    const userId = request.user.user_id;

    if (!userId) {
      // สามารถโยน Error หรือ Return null ได้ตามการจัดการของ Guard
      throw new Error('User ID not found in token payload.');
    }

    return userId;
  },
);
