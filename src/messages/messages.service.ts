import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, In } from 'typeorm';
import { Message, TradeStatus } from './entities/message.entity';
import { Item, ItemStatus } from '../items/entities/item.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { MessagesGateway } from './messages.gateway';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private messagesRepository: Repository<Message>,
    @InjectRepository(Item)
    private itemsRepository: Repository<Item>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
    private messagesGateway: MessagesGateway,
  ) {}

  async sendTradeOffer(
    targetItemId: string,
    senderId: string,
    offeredItemId?: string,
    manualOfferText?: string,
    tradeMediaUrls?: string[],
    tradeVideoUrl?: string,
  ): Promise<Message> {
    try {
      console.log('sendTradeOffer input:', {
        targetItemId,
        senderId,
        offeredItemId,
        hasManualOfferText: !!manualOfferText,
        tradeMediaUrls,
        tradeVideoUrl,
      });

      const targetItem = await this.itemsRepository.findOne({
        where: { id: targetItemId },
        relations: ['owner'],
      });
      if (!targetItem)
        throw new NotFoundException('İstenilen ilan bulunamadı.');
      if (targetItem.status !== ItemStatus.AVAILABLE)
        throw new BadRequestException('Bu ilan artık takasa açık değil.');

      let content = '';
      let finalOfferedItemId: string | null = null;
      let offeredItemImageUrl: string | null = null;

      if (offeredItemId) {
        const offeredItem = await this.itemsRepository.findOne({
          where: { id: offeredItemId },
          relations: ['owner'],
        });
        if (!offeredItem)
          throw new NotFoundException('Teklif edilen ilan bulunamadı.');
        if (offeredItem.owner.id !== senderId)
          throw new BadRequestException(
            'Sadece kendi ilanınızı teklif edebilirsiniz.',
          );
        if (offeredItem.status !== ItemStatus.AVAILABLE)
          throw new BadRequestException(
            'Teklif edilen ilan uygun durumda değil (AVAILABLE olmalı).',
          );
        content = `${offeredItem.title} ile takas teklifi`;
        finalOfferedItemId = offeredItem.id;
        offeredItemImageUrl =
          offeredItem.imageUrl ||
          (offeredItem.images && offeredItem.images[0]) ||
          null;
      } else if (manualOfferText) {
        content = manualOfferText;
        finalOfferedItemId = null;
      } else {
        throw new BadRequestException(
          'Lütfen bir eşya veya teklif metni girin.',
        );
      }

      const normalizedTradeMediaUrls = Array.isArray(tradeMediaUrls)
        ? tradeMediaUrls.filter(Boolean)
        : [];
      const finalTradeMediaUrls = normalizedTradeMediaUrls.length
        ? normalizedTradeMediaUrls
        : offeredItemImageUrl
          ? [offeredItemImageUrl]
          : [];
      const finalTradeMediaUrl =
        finalTradeMediaUrls[0] || offeredItemImageUrl || null;

      console.log('DB map edilecek alanlar:', {
        finalOfferedItemId,
        finalTradeMediaUrl,
        finalTradeMediaUrls,
        tradeVideoUrl: tradeVideoUrl || null,
      });

      const message = this.messagesRepository.create({
        item: { id: targetItem.id },
        sender: { id: senderId },
        receiver: { id: targetItem.owner.id },
        content,
        isRead: false,
        isTradeOffer: true,
        tradeOfferedItemId: finalOfferedItemId,
        tradeStatus: TradeStatus.PENDING,
        tradeMediaUrl: finalTradeMediaUrl,
        tradeMediaUrls: finalTradeMediaUrls.length ? finalTradeMediaUrls : null,
        tradeVideoUrl: tradeVideoUrl || null,
      });

      const savedMessage = await this.messagesRepository.save(message);

      console.log('DB kaydedilen trade offer:', {
        id: savedMessage.id,
        tradeMediaUrl: savedMessage.tradeMediaUrl,
        tradeMediaUrls: savedMessage.tradeMediaUrls,
        tradeVideoUrl: savedMessage.tradeVideoUrl,
        tradeOfferedItemId: savedMessage.tradeOfferedItemId,
      });

      const result = await this.messagesRepository.findOne({
        where: { id: savedMessage.id },
        relations: ['sender', 'receiver', 'item'],
      });

      if (result && result.receiver && result.sender) {
        this.messagesGateway.notifyNewMessage(result.receiver.id, result);
        await this.notificationsService.createNotification(
          result.receiver.id,
          '🔄 Yeni Takas Teklifi',
          `${result.sender.fullName} sana bir takas teklifi gönderdi!`,
          NotificationType.INFO,
          `${result.item?.id}?chatWith=${result.sender.id}`,
        );
      }

      return {
        ...(result as Message),
        photoUrl: result?.tradeMediaUrls?.[0] || result?.tradeMediaUrl || null,
        photos:
          result?.tradeMediaUrls ||
          (result?.tradeMediaUrl ? [result.tradeMediaUrl] : []),
      } as Message;
    } catch (error) {
      console.error('sendTradeOffer service error:', error);
      throw error;
    }
  }

  async respondToTradeOffer(
    messageId: string,
    userId: string,
    status: 'accepted' | 'rejected',
  ): Promise<Message> {
    const message = await this.messagesRepository.findOne({
      where: { id: messageId, isDeleted: false },
      relations: ['sender', 'receiver', 'item'],
    });

    if (!message) throw new NotFoundException('Mesaj bulunamadı.');
    if (!message.isTradeOffer)
      throw new BadRequestException('Bu mesaj bir takas teklifi değil.');
    if (message.receiver.id !== userId)
      throw new BadRequestException('Bu teklife sadece alıcı yanıt verebilir.');
    if (!message.sender)
      throw new BadRequestException('Bu mesajın göndericisi bulunamadı.');
    if (message.tradeStatus !== TradeStatus.PENDING)
      throw new BadRequestException('Bu teklif zaten yanıtlanmış.');

    if (status === 'rejected') {
      message.tradeStatus = TradeStatus.REJECTED;
      await this.messagesRepository.save(message);

      // System message for trade chat
      const rejectedSystem = this.messagesRepository.create({
        item: message.item ? { id: message.item.id } : null,
        sender: null,
        receiver: { id: message.sender!.id },
        content: '❌ Takas teklifi reddedildi.',
        isRead: false,
        isTradeOffer: false,
        tradeOfferId: message.id,
      });
      const savedRejected = await this.messagesRepository.save(rejectedSystem);
      const hydratedRejected = await this.messagesRepository.findOne({
        where: { id: savedRejected.id },
        relations: ['sender', 'receiver', 'item'],
      });
      if (hydratedRejected) {
        this.messagesGateway.notifyNewMessage(message.sender!.id, {
          ...hydratedRejected,
          tradeOfferId: message.id,
        });
        this.messagesGateway.notifyNewMessage(message.receiver.id, {
          ...hydratedRejected,
          tradeOfferId: message.id,
        });
      }

      await this.notificationsService.createNotification(
        message.sender.id,
        '❌ Takas Teklifi Reddedildi',
        `${message.receiver.fullName}, ${message.item?.title} için yaptığınız takas teklifini reddetti.`,
        NotificationType.INFO,
        message.item?.id,
      );
      return message;
    } else if (status === 'accepted') {
      if (!message.item)
        throw new BadRequestException('Mesaja ait hedef ilan bulunamadı.');

      const targetItem = await this.itemsRepository.findOne({
        where: { id: message.item.id },
        relations: ['owner'],
      });
      if (!targetItem) throw new NotFoundException('Hedef ilan bulunamadı.');
      if (targetItem.status !== ItemStatus.AVAILABLE) {
        message.tradeStatus = TradeStatus.REJECTED;
        await this.messagesRepository.save(message);
        throw new BadRequestException('İlan artık uygun değil.');
      }

      let offeredItem: Item | null = null;
      if (message.tradeOfferedItemId) {
        offeredItem = await this.itemsRepository.findOne({
          where: { id: message.tradeOfferedItemId },
          relations: ['owner'],
        });

        if (!offeredItem || offeredItem.status !== ItemStatus.AVAILABLE) {
          message.tradeStatus = TradeStatus.REJECTED;
          await this.messagesRepository.save(message);
          throw new BadRequestException(
            'Teklif edilen eşya artık uygun değil.',
          );
        }
      }

      // 1. Hedef eşyayı Takas Sürecine sok ve kazananı işaretle.
      targetItem.status = ItemStatus.IN_TRADE;
      targetItem.winner = message.sender;
      await this.itemsRepository.save(targetItem);

      // 2. Eğer fiziksel bir eşya sunulduysa onu da Takas Sürecine sok.
      if (offeredItem) {
        offeredItem.status = ItemStatus.IN_TRADE;
        offeredItem.winner = message.receiver;
        await this.itemsRepository.save(offeredItem);
      }

      message.tradeStatus = TradeStatus.ACCEPTED;
      await this.messagesRepository.save(message);

      await this.notificationsService.createNotification(
        message.sender.id,
        '🎉 Takas Teklifi Kabul Edildi!',
        `${message.receiver.fullName}, ${targetItem.title} için yaptığınız teklifi onayladı! Teslimat detaylarını sohbet üzerinden netleştirebilirsiniz.`,
        NotificationType.SUCCESS,
        `${targetItem.id}?chatWith=${message.receiver.id}`,
      );

      // Create a system message in the trade chat
      const systemMessage = this.messagesRepository.create({
        item: { id: targetItem.id },
        sender: null,
        receiver: { id: message.sender.id },
        content:
          '🎉 Takas iki tarafça onaylandı. Teslimat detaylarını konuşabilirsiniz.',
        isRead: false,
        isTradeOffer: false,
        tradeOfferId: message.id,
      });
      const savedSystemMessage =
        await this.messagesRepository.save(systemMessage);

      const hydratedSystemMessage = await this.messagesRepository.findOne({
        where: { id: savedSystemMessage.id },
        relations: ['sender', 'receiver', 'item'],
      });

      if (hydratedSystemMessage) {
        this.messagesGateway.notifyNewMessage(message.sender.id, {
          ...hydratedSystemMessage,
          tradeOfferId: message.id,
        });
        this.messagesGateway.notifyNewMessage(message.receiver.id, {
          ...hydratedSystemMessage,
          tradeOfferId: message.id,
        });
      }

      return message;
    }

    return message;
  }

  // Mesaj gönder — herhangi bir kullanıcı ↔ ilan sahibi
  async sendMessage(
    itemId: string,
    senderId: string,
    content: string,
    targetUserId?: string,
  ): Promise<Message> {
    const item = await this.itemsRepository.findOne({
      where: { id: itemId },
      relations: ['owner', 'winner'],
    });

    if (!item) throw new NotFoundException('İlan bulunamadı.');

    let receiverId: string;

    if (targetUserId) {
      // Eğer hedef kullanıcı belirtilmişse onu kullan (örn: İlan sahibi -> Kazanan)
      receiverId = targetUserId;
      // Validasyon: Sadece ilanın sahibi kazanana, veya kazanan sahibine atabilir gibi kısıtlar eklenebilir
      // Şimdilik esnek bırakıyoruz ama mantıksal kontrol:
      if (item.owner.id === senderId && item.winner?.id !== targetUserId) {
        // İlan sahibi, kazanan olmayan birine mesaj atıyor?
        // Belki eski konuşmaya dönüyordur, serbest bırakalım.
      }
    } else {
      // Hedef belirtilmemişse otomatik belirle
      // Kendi ilanına mesaj atamaz (iletişim her zaman karşı tarafla)
      if (item.owner.id === senderId) {
        // İlan sahibi cevap yazıyorsa: mevcut konuşmadan son mesajı bul
        const lastReceived = await this.messagesRepository.findOne({
          where: {
            item: { id: itemId },
            receiver: { id: senderId },
            sender: Not(IsNull()), // Ignore system messages
          },
          relations: ['sender'],
          order: { createdAt: 'DESC' },
        });

        if (!lastReceived || !lastReceived.sender) {
          throw new BadRequestException(
            'Bu ilana henüz mesaj gelmediği için cevap veremezsiniz. Lütfen "Kazanana Ulaş" butonunu kullanın.',
          );
        }
        receiverId = lastReceived.sender.id;
      } else {
        // Diğer kullanıcılar → ilan sahibine mesaj gönderir
        receiverId = item.owner.id;
      }
    }

    const message = this.messagesRepository.create({
      item: { id: itemId },
      sender: { id: senderId },
      receiver: { id: receiverId },
      content,
      isRead: false,
    });

    const savedMessage = await this.messagesRepository.save(message);

    const result = await this.messagesRepository.findOne({
      where: { id: savedMessage.id },
      relations: ['sender', 'receiver', 'item'],
    });

    if (!result) {
      throw new Error('Message saved but could not be retrieved');
    }

    // Notify receiver of new message via WebSocket
    if (result.receiver) {
      this.messagesGateway.notifyNewMessage(result.receiver.id, result);
    }

    // Notify receiver of new message
    if (result.receiver && result.sender) {
      const senderName = result.sender.fullName || 'Biri';
      await this.notificationsService.createNotification(
        result.receiver.id,
        '✉️ Yeni Mesaj',
        `${senderName} size bir mesaj gönderdi: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`,
        NotificationType.INFO,
        result.item ? result.item.id : undefined,
      );
    }

    return result;
  }

  // İlan bazlı mesaj geçmişi — konuşmada yer alan herkes görebilir
  async getConversation(itemId: string, userId: string): Promise<Message[]> {
    const item = await this.itemsRepository.findOne({
      where: { id: itemId },
      relations: ['owner'],
    });

    if (!item) throw new NotFoundException('İlan bulunamadı.');

    // Kullanıcı bu ilana ait mesajlarda yer alıyorsa gösterebiliriz
    return this.messagesRepository.find({
      where: [
        {
          item: { id: itemId },
          sender: { id: userId },
          tradeOfferId: IsNull(),
          isDeleted: false,
        },
        {
          item: { id: itemId },
          receiver: { id: userId },
          tradeOfferId: IsNull(),
          isDeleted: false,
        },
      ],
      relations: ['sender', 'receiver'],
      order: { createdAt: 'ASC' },
    });
  }

  // Kullanıcı ile olan tüm mesaj geçmişi (WhatsApp style)
  async getChatWithUser(
    currentUserId: string,
    otherUserId: string,
  ): Promise<Message[]> {
    return this.messagesRepository.find({
      where: [
        {
          sender: { id: currentUserId },
          receiver: { id: otherUserId },
          tradeOfferId: IsNull(),
          isDeleted: false,
        },
        {
          sender: { id: otherUserId },
          receiver: { id: currentUserId },
          tradeOfferId: IsNull(),
          isDeleted: false,
        },
      ],
      relations: ['sender', 'receiver', 'item'],
      order: { createdAt: 'ASC' },
    });
  }

  // Direkt mesaj (İlan bağımsız)
  async sendDirectMessage(
    senderId: string,
    receiverId: string,
    content: string,
  ): Promise<Message> {
    const message = this.messagesRepository.create({
      item: null,
      sender: { id: senderId },
      receiver: { id: receiverId },
      content,
      isRead: false,
    });

    const savedMessage = await this.messagesRepository.save(message);

    const result = await this.messagesRepository.findOne({
      where: { id: savedMessage.id },
      relations: ['sender', 'receiver'],
    });

    if (!result) throw new Error('Message saved but could not be retrieved');

    if (result.receiver) {
      this.messagesGateway.notifyNewMessage(result.receiver.id, result);
    }

    return result;
  }

  // Tüm aktif konuşmalar (Kişi bazlı gruplama)
  async getMyConversations(userId: string) {
    try {
      const messages = await this.messagesRepository
        .createQueryBuilder('msg')
        .leftJoinAndSelect('msg.item', 'item')
        .leftJoinAndSelect('msg.sender', 'sender')
        .leftJoinAndSelect('msg.receiver', 'receiver')
        .where('sender.id = :userId OR receiver.id = :userId', { userId })
        .andWhere('msg.isTradeOffer = false')
        .andWhere('msg.tradeOfferId IS NULL')
        .andWhere('msg.isDeleted = :isDeleted', { isDeleted: false })
        .orderBy('msg.createdAt', 'DESC')
        .getMany();

      // Konuşmaları KİŞİ bazlı grupla
      const conversationMap = new Map();

      for (const msg of messages) {
        // Sistem mesajlarını atla
        if (!msg.sender) continue;

        const otherUser = msg.sender.id === userId ? msg.receiver : msg.sender;

        if (!otherUser) continue;

        // Benzersiz anahtar: Sadece Karşıdaki Kullanıcı ID
        const key = otherUser.id;

        if (!conversationMap.has(key)) {
          conversationMap.set(key, {
            conversationId: key, // Frontend için unique key (artık userId)
            itemId: msg.item ? msg.item.id : 'direct', // En son konuşulan ilan ID'si
            itemTitle: msg.item ? msg.item.title : 'Direkt Mesaj', // En son konuşulan ilan başlığı
            itemImageUrl: msg.item ? msg.item.imageUrl : null,
            lastMessage: msg.content,
            lastMessageAt: msg.createdAt,
            unreadCount: 0,
            otherUser: {
              id: otherUser.id,
              fullName: otherUser.fullName,
              email: otherUser.email,
            },
          });
        }

        // Okunmamış mesaj sayısını hesapla
        // Bu kişiyle olan TÜM okunmamış mesajları say
        if (msg.receiver && msg.receiver.id === userId && !msg.isRead) {
          const conv = conversationMap.get(key);
          conv.unreadCount += 1;
        }
      }

      return Array.from(conversationMap.values());
    } catch (error) {
      console.error('Error in getMyConversations:', error);
      throw error;
    }
  }

  // Yeni: Sadece Takas Teklifleri
  async getMyTradeOffers(userId: string) {
    try {
      const messages = await this.messagesRepository
        .createQueryBuilder('msg')
        .leftJoinAndSelect('msg.item', 'item')
        .leftJoinAndSelect('msg.sender', 'sender')
        .leftJoinAndSelect('msg.receiver', 'receiver')
        .where('(sender.id = :userId OR receiver.id = :userId)', { userId })
        .andWhere('msg.isTradeOffer = :isTradeOffer', { isTradeOffer: true })
        .andWhere('msg.isDeleted = :isDeleted', { isDeleted: false })
        .orderBy('msg.createdAt', 'DESC')
        .getMany();

      // Mümkün olan asıl Offered Item bilgilerini zenginleştirelim (Frontend'e kolaylık)
      const enhancedMessages = await Promise.all(
        messages.map(async (msg) => {
          let offeredItemData: any = null;
          if (msg.tradeOfferedItemId) {
            const offeredItem = await this.itemsRepository.findOne({
              where: { id: msg.tradeOfferedItemId },
              relations: ['owner'],
            });
            if (offeredItem) {
              offeredItemData = {
                id: offeredItem.id,
                title: offeredItem.title,
                imageUrl:
                  offeredItem.imageUrl ||
                  (offeredItem.images && offeredItem.images[0]) ||
                  null,
              };
            }
          }
          return {
            ...msg,
            photoUrl:
              msg.tradeMediaUrls?.[0] ||
              msg.tradeMediaUrl ||
              offeredItemData?.imageUrl ||
              null,
            photos:
              msg.tradeMediaUrls ||
              (msg.tradeMediaUrl ? [msg.tradeMediaUrl] : []),
            offeredItem: offeredItemData,
            otherUser: msg.sender?.id === userId ? msg.receiver : msg.sender,
          };
        }),
      );

      console.log(
        'getMyTradeOffers photoUrl kontrolü:',
        enhancedMessages.map((m) => ({
          id: m.id,
          tradeMediaUrl: m.tradeMediaUrl,
          photoUrl: m.photoUrl,
        })),
      );

      return enhancedMessages;
    } catch (error) {
      console.error('Error in getMyTradeOffers:', error);
      throw error;
    }
  }

  // Tek takas teklifi getir
  async getTradeOffer(tradeOfferId: string, userId: string): Promise<any> {
    const offer = await this.messagesRepository.findOne({
      where: { id: tradeOfferId, isTradeOffer: true, isDeleted: false },
      relations: ['sender', 'receiver', 'item'],
    });
    if (!offer) throw new NotFoundException('Takas teklifi bulunamadı.');
    if (offer.sender?.id !== userId && offer.receiver?.id !== userId) {
      throw new ForbiddenException('Bu takasa erişim izniniz yok.');
    }

    let offeredItemData: any = null;
    if (offer.tradeOfferedItemId) {
      const offeredItem = await this.itemsRepository.findOne({
        where: { id: offer.tradeOfferedItemId },
        relations: ['owner'],
      });
      if (offeredItem) {
        offeredItemData = {
          id: offeredItem.id,
          title: offeredItem.title,
          imageUrl:
            offeredItem.imageUrl ||
            (offeredItem.images && offeredItem.images[0]) ||
            null,
        };
      }
    }

    return {
      ...offer,
      photoUrl:
        offer.tradeMediaUrls?.[0] ||
        offer.tradeMediaUrl ||
        offeredItemData?.imageUrl ||
        null,
      photos:
        offer.tradeMediaUrls ||
        (offer.tradeMediaUrl ? [offer.tradeMediaUrl] : []),
      offeredItem: offeredItemData,
    };
  }

  // Takasa özel mesajları getir
  async getTradeMessages(
    tradeOfferId: string,
    userId: string,
  ): Promise<Message[]> {
    const offer = await this.messagesRepository.findOne({
      where: { id: tradeOfferId, isTradeOffer: true },
      relations: ['sender', 'receiver'],
    });
    if (!offer) throw new NotFoundException('Takas teklifi bulunamadı.');
    if (offer.sender?.id !== userId && offer.receiver?.id !== userId) {
      throw new ForbiddenException('Bu takasa erişim izniniz yok.');
    }

    return this.messagesRepository.find({
      where: { tradeOfferId, isDeleted: false },
      relations: ['sender', 'receiver', 'item'],
      order: { createdAt: 'ASC' },
    });
  }

  // Tek mesajı sil (soft-delete)
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messagesRepository.findOne({
      where: { id: messageId },
      relations: ['sender', 'receiver'],
    });
    if (!message) throw new NotFoundException('Mesaj bulunamadı.');
    if (message.sender?.id !== userId)
      throw new ForbiddenException(
        'Sadece kendi mesajlarınızı silebilirsiniz.',
      );

    await this.messagesRepository.update(messageId, { isDeleted: true });

    // Karşı tarafa anlık bildir (ekrandan kaldırsın)
    const otherId = message.receiver?.id;
    if (otherId) {
      this.messagesGateway.notifyDeleteMessage(otherId, messageId);
    }
  }

  // Takasa özel mesaj gönder
  async sendTradeMessage(
    tradeOfferId: string,
    senderId: string,
    content: string,
  ): Promise<Message> {
    const offer = await this.messagesRepository.findOne({
      where: { id: tradeOfferId, isTradeOffer: true },
      relations: ['sender', 'receiver', 'item'],
    });
    if (!offer) throw new NotFoundException('Takas teklifi bulunamadı.');
    if (offer.sender?.id !== senderId && offer.receiver?.id !== senderId) {
      throw new ForbiddenException('Bu takasa erişim izniniz yok.');
    }

    const receiverId =
      offer.sender?.id === senderId ? offer.receiver?.id : offer.sender?.id;

    if (!receiverId) throw new BadRequestException('Alıcı bulunamadı.');

    const message = this.messagesRepository.create({
      item: offer.item ? { id: offer.item.id } : null,
      sender: { id: senderId },
      receiver: { id: receiverId },
      content,
      isRead: false,
      isTradeOffer: false,
      tradeOfferId,
    });

    const saved = await this.messagesRepository.save(message);
    const result = await this.messagesRepository.findOne({
      where: { id: saved.id },
      relations: ['sender', 'receiver', 'item'],
    });

    if (result?.receiver) {
      this.messagesGateway.notifyNewMessage(result.receiver.id, {
        ...result,
        tradeOfferId,
      });
    }

    return result!;
  }

  // Yeni: Toplam okunmamış mesaj sayısı (sistem mesajlarını hariç tut)
  async getUnreadTotal(userId: string): Promise<{ totalUnread: number }> {
    const count = await this.messagesRepository.count({
      where: {
        receiver: { id: userId },
        sender: Not(IsNull()),
        isTradeOffer: false,
        tradeOfferId: IsNull(),
        isDeleted: false,
        isRead: false,
      },
    });
    return { totalUnread: count };
  }

  // Yeni: Bir konuşmayı okundu olarak işaretle
  async markAsRead(itemId: string, userId: string): Promise<void> {
    // Bu ilana ait ve alıcının ben olduğu tüm mesajları güncelle
    await this.messagesRepository.update(
      {
        item: { id: itemId },
        receiver: { id: userId },
        isRead: false,
        tradeOfferId: IsNull(),
      },
      { isRead: true },
    );
  }

  // Kişi bazlı konuşmayı okundu olarak işaretle
  async markAsReadByChat(userId: string, otherUserId: string): Promise<void> {
    await this.messagesRepository.update(
      {
        sender: { id: otherUserId },
        receiver: { id: userId },
        isRead: false,
        tradeOfferId: IsNull(),
      },
      { isRead: true },
    );
  }

  // Konuşmayı sil (kullanıcının bu ilandaki tüm mesajlarını siler)
  async deleteConversation(
    itemId: string,
    userId: string,
  ): Promise<{ deleted: number }> {
    // Karşı tarafı bulmak için silmeden önce bir mesaja bak
    const sample = await this.messagesRepository.findOne({
      where: [
        { item: { id: itemId }, sender: { id: userId } },
        { item: { id: itemId }, receiver: { id: userId } },
      ],
      relations: ['sender', 'receiver'],
    });
    const otherUserId =
      sample?.sender?.id === userId ? sample?.receiver?.id : sample?.sender?.id;

    const result = await this.messagesRepository
      .createQueryBuilder()
      .delete()
      .from(Message)
      .where(
        '"itemId" = :itemId AND "tradeOfferId" IS NULL AND ("senderId" = :userId OR "receiverId" = :userId)',
        { itemId, userId },
      )
      .execute();

    // Karşı tarafı gerçek zamanlı bildir
    if (otherUserId) {
      this.messagesGateway.notifyConversationDeleted(otherUserId, userId);
    }

    return { deleted: result.affected || 0 };
  }

  // Kişi bazlı konuşmayı sil
  async deleteChatConversation(
    userId: string,
    otherUserId: string,
  ): Promise<{ deleted: number }> {
    const result = await this.messagesRepository
      .createQueryBuilder()
      .delete()
      .from(Message)
      .where(
        '"tradeOfferId" IS NULL AND (("senderId" = :userId AND "receiverId" = :otherUserId) OR ("senderId" = :otherUserId AND "receiverId" = :userId))',
        { userId, otherUserId },
      )
      .execute();

    // Karşı tarafı gerçek zamanlı bildir
    this.messagesGateway.notifyConversationDeleted(otherUserId, userId);

    return { deleted: result.affected || 0 };
  }

  // Herkese Açık Takas Teklifleri
  async getPublicTradeOffers(itemId: string): Promise<any[]> {
    const offers = await this.messagesRepository.find({
      where: {
        item: { id: itemId },
        isTradeOffer: true,
        isDeleted: false,
      },
      relations: ['sender'], // Only include sender details for public view
      order: { createdAt: 'DESC' },
    });

    const offeredItemIds = offers
      .map((offer) => offer.tradeOfferedItemId)
      .filter((id) => id); // Sadece ID'si olanları al (manual metin tekliflerini atla)

    let itemsMap = new Map<string, Partial<Item>>();

    if (offeredItemIds.length > 0) {
      const items = await this.itemsRepository.find({
        where: { id: In(offeredItemIds) },
        select: ['id', 'title', 'imageUrl', 'images'], // Sadece gizlilik açısından sıkıntısız verileri çek
      });

      items.forEach((item) => itemsMap.set(item.id, item));
    }

    // Orijinal teklif öğelerine `offeredItem` bilgisini dışarı sızmayacak/temizlenmiş şekliyle iliştir
    return offers.map((offer) => {
      let offeredItem: Partial<Item> | null = null;
      if (offer.tradeOfferedItemId && itemsMap.has(offer.tradeOfferedItemId)) {
        offeredItem = itemsMap.get(offer.tradeOfferedItemId) || null;
      }
      return {
        ...offer,
        photoUrl:
          offer.tradeMediaUrls?.[0] ||
          offer.tradeMediaUrl ||
          (offeredItem?.images && offeredItem.images[0]) ||
          offeredItem?.imageUrl ||
          null,
        photos:
          offer.tradeMediaUrls ||
          (offer.tradeMediaUrl ? [offer.tradeMediaUrl] : []),
        offeredItem, // Eğer fiziksel eşya teklif edildiyse bu dolacak, değilse null
      };
    });
  }
}
