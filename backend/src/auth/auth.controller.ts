import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Neuen User registrieren' })
  @ApiResponse({ status: 201, description: 'User erfolgreich erstellt', type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'Username oder E-Mail bereits vergeben' })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User anmelden' })
  @ApiResponse({ status: 200, description: 'Erfolgreich angemeldet', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Ungültige Anmeldedaten' })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Access Token erneuern' })
  @ApiResponse({ status: 200, description: 'Token erfolgreich erneuert', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Ungültiger Refresh Token' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User abmelden' })
  @ApiResponse({ status: 200, description: 'Erfolgreich abgemeldet' })
  async logout(@CurrentUser() user: any): Promise<{ message: string }> {
    await this.authService.logout(user.userId);
    return { message: 'Erfolgreich abgemeldet' };
  }
}
