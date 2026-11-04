import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * 把 Prisma 的约束错误翻译成可读的 4xx，避免接口直接抛 500。
 * 无法识别的一律 500，但会把原始错误写进日志便于排查。
 */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Prisma');

  catch(exception: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof Prisma.PrismaClientValidationError) {
      this.logger.error(`参数与模型不匹配: ${exception.message.split('\n').slice(-3).join(' ')}`);
      return res.status(400).json({
        statusCode: 400,
        message: '请求参数与数据模型不匹配，请检查必填项与字段类型',
      });
    }

    const code: string = exception.code;
    const target = Array.isArray(exception.meta?.target)
      ? exception.meta.target.join('、')
      : exception.meta?.target;

    const table: Record<string, [number, string]> = {
      P2002: [409, `数据重复：${target || '唯一字段'} 已存在`],
      P2003: [400, '关联的数据不存在，请检查上级组织或引用对象'],
      P2011: [400, '必填字段不能为空'],
      P2014: [400, '存在关联数据，无法完成该操作'],
      P2025: [404, '目标记录不存在，可能已被删除'],
    };

    const [status, message] = table[code] || [500, '数据库操作失败，请联系管理员'];
    this.logger.error(`[${code}] ${message} | ${exception.message.split('\n').slice(-1)[0]}`);

    res.status(status).json({ statusCode: status, message, code });
  }
}
