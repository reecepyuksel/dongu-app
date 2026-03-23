import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import {
  FileInterceptor,
  FileFieldsInterceptor,
} from '@nestjs/platform-express';
import { MessagesService } from './messages.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TradeStatus } from './entities/message.entity';

@ApiTags('messages')
@ApiBearerAuth()
@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // Toplam okunmamış mesaj sayısı
  @UseGuards(AuthGuard('jwt'))
  @Get('unread-count')
  getUnreadTotal(@Request() req) {
    return this.messagesService.getUnreadTotal(req.user.userId);
  }

  // Tüm konuşmalarım (Bu en üstte olmalı ki :itemId bunu ezmesin)
  @UseGuards(AuthGuard('jwt'))
  @Get('my-conversations')
  getMyConversations(@Request() req) {
    return this.messagesService.getMyConversations(req.user.userId);
  }

  // Takas tekliflerim
  @UseGuards(AuthGuard('jwt'))
  @Get('my-trade-offers')
  getMyTradeOffers(@Request() req) {
    return this.messagesService.getMyTradeOffers(req.user.userId);
  }

  // Direkt mesaj gönder (İlan bağımsız)
  @UseGuards(AuthGuard('jwt'))
  @Post('direct/:userId')
  sendDirectMessage(
    @Param('userId') targetUserId: string,
    @Body('content') content: string,
    @Request() req,
  ) {
    return this.messagesService.sendDirectMessage(
      req.user.userId,
      targetUserId,
      content,
    );
  }

  // İlan bazlı mesaj gönder
  @UseGuards(AuthGuard('jwt'))
  @Post(':itemId')
  sendMessage(
    @Param('itemId') itemId: string,
    @Body('content') content: string,
    @Body('targetUserId') targetUserId: string,
    @Request() req,
  ) {
    return this.messagesService.sendMessage(
      itemId,
      req.user.userId,
      content,
      targetUserId,
    );
  }

  // Takas teklifi gönder
  @UseGuards(AuthGuard('jwt'))
  @Post('trade-offer/send')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'photo', maxCount: 1 },
      { name: 'video', maxCount: 1 },
    ]),
  )
  async sendTradeOffer(
    @Body('targetItemId') targetItemId: string,
    @Body('offeredItemId') offeredItemId: string,
    @Body('manualOfferText') manualOfferText: string,
    @Request() req,
    @UploadedFiles()
    files?: { photo?: Express.Multer.File[]; video?: Express.Multer.File[] },
  ) {
    let tradeMediaUrl: string | undefined = undefined;
    let tradeVideoUrl: string | undefined = undefined;

    if (files?.photo?.[0]) {
      try {
        const result = await this.cloudinaryService.uploadImage(files.photo[0]);
        tradeMediaUrl = result.secure_url;
      } catch (err) {
        console.error('Error uploading photo for trade offer:', err);
        throw new BadRequestException(
          'Görsel yüklenirken bir hata oluştu. Lütfen tekrar deneyin.',
        );
      }
    }

    if (files?.video?.[0]) {
      try {
        const result = await this.cloudinaryService.uploadImage(files.video[0]);
        tradeVideoUrl = result.secure_url;
      } catch (err) {
        console.error('Error uploading video for trade offer:', err);
        throw new BadRequestException(
          'Video yüklenirken bir hata oluştu. Lütfen tekrar deneyin.',
        );
      }
    }

    return this.messagesService.sendTradeOffer(
      targetItemId,
      req.user.userId,
      offeredItemId,
      manualOfferText,
      tradeMediaUrl,
      tradeVideoUrl,
    );
  }

  // Takas teklifine yanıt ver (Kabul/Red)
  @UseGuards(AuthGuard('jwt'))
  @Post('trade-offer/:messageId/respond')
  respondToTradeOffer(
    @Param('messageId') messageId: string,
    @Body('status') status: 'accepted' | 'rejected',
    @Request() req,
  ) {
    return this.messagesService.respondToTradeOffer(
      messageId,
      req.user.userId,
      status,
    );
  }

  // Tek takas teklifi detayı
  @UseGuards(AuthGuard('jwt'))
  @Get('trade-offer/:id')
  getTradeOffer(@Param('id') id: string, @Request() req) {
    return this.messagesService.getTradeOffer(id, req.user.userId);
  }

  // Takasa özel mesajları getir
  @UseGuards(AuthGuard('jwt'))
  @Get('trade/:tradeId/messages')
  getTradeMessages(@Param('tradeId') tradeId: string, @Request() req) {
    return this.messagesService.getTradeMessages(tradeId, req.user.userId);
  }

  // Takasa özel mesaj gönder
  @UseGuards(AuthGuard('jwt'))
  @Post('trade/:tradeId/message')
  sendTradeMessage(
    @Param('tradeId') tradeId: string,
    @Body('content') content: string,
    @Request() req,
  ) {
    return this.messagesService.sendTradeMessage(
      tradeId,
      req.user.userId,
      content,
    );
  }

  // Mesajları okundu olarak işaretle
  @UseGuards(AuthGuard('jwt'))
  @Post(':itemId/read')
  markAsRead(@Param('itemId') itemId: string, @Request() req) {
    return this.messagesService.markAsRead(itemId, req.user.userId);
  }

  // Kişi ile mesajları okundu olarak işaretle
  @UseGuards(AuthGuard('jwt'))
  @Post('chat/:userId/read')
  markAsReadByChat(@Param('userId') otherUserId: string, @Request() req) {
    return this.messagesService.markAsReadByChat(req.user.userId, otherUserId);
  }

  // Kişi ile olan tüm mesaj geçmişi
  @UseGuards(AuthGuard('jwt'))
  @Get('chat/:userId')
  getChatWithUser(@Param('userId') otherUserId: string, @Request() req) {
    return this.messagesService.getChatWithUser(req.user.userId, otherUserId);
  }

  // İlan bazlı mesaj geçmişi
  @UseGuards(AuthGuard('jwt'))
  @Get(':itemId')
  getConversation(@Param('itemId') itemId: string, @Request() req) {
    return this.messagesService.getConversation(itemId, req.user.userId);
  }

  // Herkese Açık Takas Teklifleri (Belirli bir ilana gelenler)
  @Get('item/:itemId/trade-offers')
  getPublicTradeOffers(@Param('itemId') itemId: string) {
    return this.messagesService.getPublicTradeOffers(itemId);
  }

  // Konuşmayı sil
  @UseGuards(AuthGuard('jwt'))
  @Delete(':itemId')
  deleteConversation(@Param('itemId') itemId: string, @Request() req) {
    return this.messagesService.deleteConversation(itemId, req.user.userId);
  }

  // Kişi ile konuşmayı sil
  @UseGuards(AuthGuard('jwt'))
  @Delete('chat/:userId')
  deleteChatConversation(@Param('userId') otherUserId: string, @Request() req) {
    return this.messagesService.deleteChatConversation(
      req.user.userId,
      otherUserId,
    );
  }
}
