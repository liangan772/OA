import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OrgService } from './org.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

class CreateOrgDto {
  @IsString() @IsNotEmpty() code: string;
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() type: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsInt() sort?: number;
}

class CreatePositionDto {
  @IsString() @IsNotEmpty() orgId: string;
  @IsString() @IsNotEmpty() code: string;
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() duty?: string;
  @IsOptional() @IsString() rank?: string;
  @IsOptional() @IsBoolean() isLeader?: boolean;
  @IsOptional() @IsBoolean() isDeputy?: boolean;
  @IsOptional() @IsInt() headcount?: number;
  @IsOptional() @IsInt() sort?: number;
}

class AssignPostDto {
  @IsString() @IsNotEmpty() userId: string;
  @IsString() @IsNotEmpty() positionId: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

class CreateUserDto {
  @IsString() @IsNotEmpty() account: string;
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() role?: string;
}

@Controller('org')
@UseGuards(JwtAuthGuard)
export class OrgController {
  constructor(private readonly org: OrgService) {}

  @Get('tree')
  tree() {
    return this.org.tree();
  }

  @Get('list')
  list(@Query('keyword') keyword?: string) {
    return this.org.list(keyword);
  }

  @Get('ledger')
  ledger(@Query('rootUnitId') rootUnitId?: string) {
    return this.org.ledger(rootUnitId);
  }

  @Post()
  create(@Body() dto: CreateOrgDto) {
    return this.org.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.org.update(id, dto);
  }

  @Post(':id/move')
  move(@Param('id') id: string, @Body('parentId') parentId: string | null) {
    return this.org.move(id, parentId ?? null);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('force') force?: string) {
    return this.org.remove(id, force === 'true' || force === '1');
  }

  // ---------------- 组织类型字典 ----------------

  @Get('types')
  listTypes() {
    return this.org.listTypes();
  }

  @Post('types')
  createType(@Body() dto: { code: string; name: string; isUnit?: boolean; sort?: number }) {
    return this.org.createType(dto);
  }

  @Patch('types/:id')
  updateType(
    @Param('id') id: string,
    @Body() dto: { name?: string; isUnit?: boolean; sort?: number; status?: string },
  ) {
    return this.org.updateType(id, dto);
  }

  @Delete('types/:id')
  removeType(@Param('id') id: string) {
    return this.org.removeType(id);
  }

  // 编制位
  @Post('position')
  createPosition(@Body() dto: CreatePositionDto) {
    return this.org.createPosition(dto);
  }

  @Patch('position/:id')
  updatePosition(@Param('id') id: string, @Body() dto: any) {
    return this.org.updatePosition(id, dto);
  }

  @Delete('position/:id')
  removePosition(@Param('id') id: string, @Query('force') force?: string) {
    return this.org.removePosition(id, force === 'true' || force === '1');
  }

  // 任职
  @Post('post')
  assignPost(@Body() dto: AssignPostDto) {
    return this.org.assignPost(dto.userId, dto.positionId, dto.isPrimary ?? true);
  }

  @Delete('post/:id')
  removePost(@Param('id') id: string) {
    return this.org.removePost(id);
  }

  // 人员
  @Get('users')
  users(@Query('keyword') keyword?: string) {
    return this.org.users(keyword);
  }

  @Post('user')
  @UseGuards(AdminGuard)
  createUser(@Body() dto: CreateUserDto) {
    return this.org.createUser(dto);
  }

  @Patch('user/:id')
  @UseGuards(AdminGuard)
  updateUser(@Param('id') id: string, @Body() dto: any) {
    return this.org.updateUser(id, dto);
  }
}
