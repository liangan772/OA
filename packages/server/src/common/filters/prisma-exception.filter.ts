import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * 把 Prisma 的错误翻译成可读的 4xx，避免接口直接抛 500。
 * 覆盖 Client 侧全部错误类型，未识别的记完整日志后返回 500。
 */
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientValidationError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientRustPanicError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Prisma');

  catch(exception: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const brief = String(exception?.message || '').split('\n').slice(-2).join(' ');

    if (exception instanceof Prisma.PrismaClientValidationError) {
      this.logger.error(`参数与模型不匹配: ${brief}`);
      return res.status(400).json({
        statusCode: 400,
        message: '请求参数与数据模型不匹配，请检查必填项与字段类型',
      });
    }

    const code: string | undefined = exception.code;
    const target = Array.isArray(exception.meta?.target)
      ? exception.meta.target.join('、')
      : exception.meta?.target;

    const table: Record<string, [number, string]> = {
      P2002: [409, `数据重复：${target || '唯一字段'} 已存在`],
      P2003: [400, '关联的数据不存在，请检查上级组织或引用对象'],
      P2011: [400, '必填字段不能为空'],
      P2014: [400, '存在关联数据，无法完成该操作'],
      P2025: [404, '目标记录不存在，可能已被删除'],
      P1001: [503, '无法连接数据库'],
    };

    const [status, message] = (code && table[code]) || [500, '数据库操作失败，请联系管理员'];
    this.logger.error(`[${code || 'NO_CODE'}] ${message} | ${brief}`);

    res.status(status).json({ statusCode: status, message, code });
  }
}
