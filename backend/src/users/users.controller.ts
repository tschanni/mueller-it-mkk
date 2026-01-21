import { 
  Controller, 
  Get, 
  Post, 
  Delete, 
  UseGuards, 
  UseInterceptors, 
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Eigenes Profil abrufen' })
  @ApiResponse({ status: 200, description: 'Profil-Daten' })
  async getProfile(@CurrentUser() user: any) {
    return this.usersService.getUserProfile(user.userId);
  }

  @Post('profile/image')
  @ApiOperation({ summary: 'Profilbild hochladen' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Bild erfolgreich hochgeladen' })
  @ApiResponse({ status: 400, description: 'Ungültiges Dateiformat' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `profile-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          return callback(new BadRequestException('Nur Bilddateien erlaubt (jpg, jpeg, png, gif)'), false);
        }
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadProfileImage(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Keine Datei hochgeladen');
    }

    return this.usersService.updateProfileImage(user.userId, file.filename);
  }

  @Delete('profile/image')
  @ApiOperation({ summary: 'Profilbild löschen' })
  @ApiResponse({ status: 200, description: 'Profilbild gelöscht' })
  async deleteProfileImage(@CurrentUser() user: any) {
    return this.usersService.deleteProfileImage(user.userId);
  }
}
