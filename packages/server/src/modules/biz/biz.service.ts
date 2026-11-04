import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';

@Injectable()
export class BizService {
  constructor(private readonly prisma: PrismaService) {}

  private async primaryPost(userId: string) {
    const posts = await this.prisma.post.findMany({
      where: { userId, endAt: null },
      include: { position: { include: { org: true } } },
      orderBy: { isPrimary: 'desc' },
    });
    return posts[0] || null;
  }

  private async ctx(userId: string) {
    const post = await this.primaryPost(userId);
    if (!post) throw new BadRequestException('你尚未在编制中任职');
    return { orgId: post.position.orgId, rootUnitId: post.position.org.rootUnitId };
  }

  // ==================== 协调文档 ====================

  async docs(userId: string, keyword?: string) {
    const post = await this.primaryPost(userId);
    const list = await this.prisma.document.findMany({
      where: {
        AND: [
          keyword ? { title: { contains: keyword } } : {},
          {
            OR: [
              { creatorId: userId },
              ...(post ? [{ ownerOrgId: post.position.orgId }] : []),
              { collaborators: { contains: userId } },
            ],
          },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    const orgs = await this.prisma.org.findMany({
      where: { id: { in: list.map((d) => d.ownerOrgId) } },
      select: { id: true, name: true },
    });
    const orgMap = new Map(orgs.map((o) => [o.id, o.name]));

    return list.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      ownerOrgName: orgMap.get(d.ownerOrgId) || '',
      flowInstanceId: d.flowInstanceId,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  }

  async createDoc(userId: string, dto: { title: string; content?: string }) {
    const c = await this.ctx(userId);
    if (!dto.title?.trim()) throw new BadRequestException('请填写文档标题');
    const doc = await this.prisma.document.create({
      data: {
        title: dto.title,
        content: dto.content ?? '',
        ownerOrgId: c.orgId,
        rootUnitId: c.rootUnitId,
        creatorId: userId,
      },
    });
    await this.prisma.docVersion.create({
      data: { docId: doc.id, version: 1, content: dto.content ?? '', authorId: userId, remark: '创建' },
    });
    return doc;
  }

  async docDetail(id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
    if (!doc) throw new NotFoundException('文档不存在');
    const org = await this.prisma.org.findUnique({ where: { id: doc.ownerOrgId } });
    return { ...doc, ownerOrgName: org?.name || '' };
  }

  async updateDoc(id: string, userId: string, dto: { title?: string; content?: string; remark?: string }) {
    const doc = await this.prisma.document.findUnique({ where: { id }, include: { versions: true } });
    if (!doc) throw new NotFoundException('文档不存在');

    const nextVersion = (doc.versions[0]?.version || 0) + 1;

    if (dto.content !== undefined && dto.content !== doc.content) {
      await this.prisma.docVersion.create({
        data: {
          docId: id,
          version: nextVersion,
          content: dto.content,
          authorId: userId,
          remark: dto.remark || '',
        },
      });
    }

    return this.prisma.document.update({
      where: { id },
      data: { title: dto.title ?? doc.title, content: dto.content ?? doc.content },
    });
  }

  async attachFlow(id: string, flowInstanceId: string) {
    return this.prisma.document.update({ where: { id }, data: { flowInstanceId } });
  }

  // ==================== 邮件 ====================

  async inbox(userId: string) {
    const rows = await this.prisma.mailRecipient.findMany({
      where: { userId },
      include: { mail: true },
      orderBy: { id: 'desc' },
      take: 100,
    });
    const senders = await this.prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.mail.senderId) } },
      select: { id: true, name: true },
    });
    const senderMap = new Map(senders.map((s) => [s.id, s.name]));

    return rows
      .sort((a, b) => +b.mail.createdAt - +a.mail.createdAt)
      .map((r) => ({
        mailId: r.mail.id,
        subject: r.mail.subject,
        body: r.mail.body,
        senderName: senderMap.get(r.mail.senderId) || '',
        type: r.type,
        read: !!r.readAt,
        createdAt: r.mail.createdAt,
      }));
  }

  async sent(userId: string) {
    const list = await this.prisma.mail.findMany({
      where: { senderId: userId },
      include: { recipients: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: list.flatMap((m) => m.recipients.map((r) => r.userId)) } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    return list.map((m) => ({
      mailId: m.id,
      subject: m.subject,
      body: m.body,
      recipients: m.recipients.map((r) => ({ name: userMap.get(r.userId) || '', read: !!r.readAt })),
      createdAt: m.createdAt,
    }));
  }

  async sendMail(userId: string, dto: { subject: string; body?: string; to: string[]; cc?: string[] }) {
    const c = await this.ctx(userId);
    if (!dto.subject?.trim()) throw new BadRequestException('请填写邮件主题');
    if (!dto.to?.length) throw new BadRequestException('请选择收件人');

    return this.prisma.mail.create({
      data: {
        subject: dto.subject,
        body: dto.body ?? '',
        senderId: userId,
        senderOrgId: c.orgId,
        rootUnitId: c.rootUnitId,
        recipients: {
          create: [
            ...dto.to.map((u) => ({ userId: u, type: 'TO' })),
            ...(dto.cc || []).map((u) => ({ userId: u, type: 'CC' })),
          ],
        },
      },
    });
  }

  async readMail(userId: string, mailId: string) {
    await this.prisma.mailRecipient.updateMany({
      where: { mailId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  // ==================== 收集表 ====================

  async collects(userId: string) {
    const list = await this.prisma.collectForm.findMany({
      where: { status: { in: ['PUBLISHED', 'CLOSED'] } },
      include: { responses: { select: { id: true, userId: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((f) => ({
      id: f.id,
      title: f.title,
      description: f.description,
      status: f.status,
      deadline: f.deadline,
      total: f.responses.length,
      responded: f.responses.some((r) => r.userId === userId),
      createdAt: f.createdAt,
    }));
  }

  async createCollect(userId: string, dto: any) {
    const c = await this.ctx(userId);
    return this.prisma.collectForm.create({
      data: {
        title: dto.title,
        description: dto.description,
        schema: dto.schema ?? { fields: [] },
        scope: dto.scope ? JSON.stringify(dto.scope) : null,
        rootUnitId: c.rootUnitId,
        creatorId: userId,
        status: 'PUBLISHED',
        deadline: dto.deadline ? new Date(dto.deadline) : null,
      },
    });
  }

  async collectDetail(id: string, userId: string) {
    const form = await this.prisma.collectForm.findUnique({
      where: { id },
      include: { responses: { orderBy: { submittedAt: 'desc' } } },
    });
    if (!form) throw new NotFoundException('收集表不存在');

    const users = await this.prisma.user.findMany({
      where: { id: { in: form.responses.map((r) => r.userId) } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    return {
      ...form,
      mine: form.responses.find((r) => r.userId === userId) || null,
      responses: form.responses.map((r) => ({ ...r, userName: userMap.get(r.userId) || '' })),
    };
  }

  async submitResponse(id: string, userId: string, data: any) {
    const form = await this.prisma.collectForm.findUnique({ where: { id } });
    if (!form) throw new NotFoundException('收集表不存在');
    if (form.status !== 'PUBLISHED') throw new BadRequestException('该收集表已关闭');
    if (form.deadline && form.deadline < new Date()) throw new BadRequestException('已过填报截止时间');

    const c = await this.ctx(userId);
    const existing = await this.prisma.collectResponse.findFirst({ where: { formId: id, userId } });

    if (existing) {
      return this.prisma.collectResponse.update({
        where: { id: existing.id },
        data: { data, submittedAt: new Date() },
      });
    }
    return this.prisma.collectResponse.create({
      data: { formId: id, orgId: c.orgId, userId, data },
    });
  }

  async closeCollect(id: string) {
    return this.prisma.collectForm.update({ where: { id }, data: { status: 'CLOSED' } });
  }

  async users() {
    return this.prisma.user.findMany({
      select: { id: true, name: true, account: true },
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
  }
}
