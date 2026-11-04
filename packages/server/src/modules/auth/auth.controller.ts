import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class LoginDto {
  @IsString()
  @IsNotEmpty({ message: '请输入账号' })
  account: string;

  @IsString()
  @IsNotEmpty({ message: '请输入密码' })
  password: string;
}

class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @IsString()
  @MinLength(6, { message: '新密码至少 6 位' })
  newPassword: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.account, dto.password);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  profile(@CurrentUser('id') userId: string) {
    return this.auth.profile(userId);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: { name?: string; phone?: string; title?: string },
  ) {
    return this.auth.updateProfile(userId, dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(@CurrentUser('id') userId: string, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(userId, dto.oldPassword, dto.newPassword);
  }
}
