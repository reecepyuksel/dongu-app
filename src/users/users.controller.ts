import {
  Controller,
  Get,
  UseGuards,
  Request,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Giriş yapmış kullanıcının profil bilgisi + karma
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getProfile(@Request() req) {
    const user = await this.usersService.findOne(req.user.userId);
    if (!user) return null;
    const { password, ...result } = user;
    const karma = await this.usersService.getKarmaScore(req.user.userId);
    const successfulTradesCount =
      await this.usersService.getSuccessfulTradesCount(req.user.userId);
    return { ...result, karma, successfulTradesCount };
  }

  // Kullanıcının paylaştığı eşyalar
  @UseGuards(AuthGuard('jwt'))
  @Get('me/items')
  async getMyItems(@Request() req) {
    return this.usersService.findUserItems(req.user.userId);
  }

  // Kullanıcının katıldığı çekilişler
  @UseGuards(AuthGuard('jwt'))
  @Get('me/applications')
  async getMyApplications(@Request() req) {
    return this.usersService.findUserApplications(req.user.userId);
  }

  // Herkesin erişebileceği profil sayfası
  @Get('profile/:id')
  async getPublicProfile(@Param('id') id: string) {
    const profile = await this.usersService.getPublicProfile(id);
    if (!profile) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }
    return profile;
  }

  // Profil Sayfası Modal Listeleri: Bağışlar
  @Get('profile/:id/donations')
  async getProfileDonations(@Param('id') id: string) {
    return this.usersService.getDonatedItems(id);
  }

  // Profil Sayfası Modal Listeleri: Alınan Eşyalar
  @Get('profile/:id/winnings')
  async getProfileReceivedItems(@Param('id') id: string) {
    return this.usersService.getReceivedItems(id);
  }
}
