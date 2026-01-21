import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async getUserProfile(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('-password -refreshToken')
      .lean();

    if (!user) {
      throw new NotFoundException('User nicht gefunden');
    }

    return user;
  }

  async updateProfileImage(userId: string, filename: string) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User nicht gefunden');
    }

    // Delete old image if exists
    if (user.profileImage) {
      const oldImagePath = path.join(process.cwd(), 'uploads', user.profileImage);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    user.profileImage = filename;
    await user.save();

    return {
      profileImage: filename,
      profileImageUrl: `/uploads/${filename}`,
    };
  }

  async deleteProfileImage(userId: string) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User nicht gefunden');
    }

    if (user.profileImage) {
      const imagePath = path.join(process.cwd(), 'uploads', user.profileImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
      user.profileImage = undefined;
      await user.save();
    }

    return { message: 'Profilbild gelöscht' };
  }
}
