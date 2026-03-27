import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Item,
  ItemStatus,
  DeliveryStatus,
  ShareType,
  ItemPostType,
} from './entities/item.entity';
import { CreateItemDto } from './dto/create-item.dto';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Message } from '../messages/entities/message.entity';
import { Community } from '../communities/entities/community.entity';
import { CommunityMember } from '../communities/entities/community-member.entity';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private itemsRepository: Repository<Item>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Community)
    private communitiesRepository: Repository<Community>,
    @InjectRepository(CommunityMember)
    private communityMembersRepository: Repository<CommunityMember>,
    private notificationsService: NotificationsService,
  ) {}

  private sanitizePublicUser(user?: User | null) {
    if (!user) return null;
    return {
      id: user.id,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      karmaPoint: user.karmaPoint,
      badges: user.badges,
      trustScore: user.trustScore,
      isVerifiedAccount: Boolean(user.isEmailVerified && user.isPhoneVerified),
      city: user.city,
      district: user.district,
    };
  }

  private sanitizePublicItem(item: Item) {
    const raw = item as any;
    return {
      ...raw,
      owner: this.sanitizePublicUser(raw.owner),
      winner: this.sanitizePublicUser(raw.winner),
      community: raw.community
        ? {
            id: raw.community.id,
            name: raw.community.name,
            image: raw.community.image,
            type: raw.community.type,
            isVerified: raw.community.is_verified,
          }
        : null,
    };
  }

  async create(
    createItemDto: CreateItemDto,
    userId: string,
    images: string[] = [],
  ): Promise<Item> {
    let community: Community | null = null;

    if (createItemDto.communityId) {
      community = await this.communitiesRepository.findOne({
        where: { id: createItemDto.communityId },
      });

      if (!community) {
        throw new NotFoundException('Seçilen topluluk bulunamadı.');
      }

      const membership = await this.communityMembersRepository.findOne({
        where: {
          community: { id: createItemDto.communityId },
          user: { id: userId },
        },
      });

      if (!membership) {
        throw new ForbiddenException(
          'Yalnızca üyesi olduğunuz topluluklarda paylaşım yapabilirsiniz.',
        );
      }
    }

    let methods: string[] = [];
    const rawMethods = createItemDto.deliveryMethods;

    if (rawMethods) {
      if (Array.isArray(rawMethods)) {
        methods = rawMethods;
      } else if (typeof rawMethods === 'string') {
        try {
          methods = JSON.parse(rawMethods);
          if (!Array.isArray(methods)) methods = [rawMethods];
        } catch {
          methods = rawMethods.split(',').map((m) => m.trim());
        }
      }
    }

    const methodAliasMap: Record<string, string> = {
      shipping_buyer: 'shipping',
      shipping_seller: 'shipping',
    };
    const allowedMethods = new Set(['pickup', 'shipping', 'mutual_agreement']);
    const normalizedMethods = methods
      .map((method) => methodAliasMap[method] || method)
      .filter((method) => allowedMethods.has(method));
    const selectedDeliveryMethod =
      normalizedMethods.length > 0 ? normalizedMethods[0] : 'mutual_agreement';

    const item = this.itemsRepository.create({
      title: createItemDto.title,
      description: createItemDto.description,
      city: createItemDto.city,
      district: createItemDto.district,
      neighborhood: createItemDto.neighborhood,
      category: createItemDto.category || 'Diğer',
      selectionType: createItemDto.selectionType,
      shareType: createItemDto.shareType,
      postType: createItemDto.postType || ItemPostType.OFFERING,
      tradePreferences: createItemDto.tradePreferences,
      deliveryMethods: [selectedDeliveryMethod],
      imageUrl:
        images.length > 0
          ? images[0]
          : createItemDto.postType === ItemPostType.REQUESTING
            ? null
            : 'https://via.placeholder.com/600x400?text=Resim+Yok',
      images: images,
      status: ItemStatus.AVAILABLE,
      owner: { id: userId } as User,
      community: community ?? undefined,
      drawDate: createItemDto.drawDate
        ? new Date(createItemDto.drawDate)
        : undefined,
      expiresAt:
        createItemDto.postType === ItemPostType.REQUESTING
          ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
          : undefined,
    } as Partial<Item>) as Item;
    const savedItem = await this.itemsRepository.save(item);

    const scopeCommunityId = community?.id ?? null;

    // --- Smart Matchmaking Logic Start ---
    if (savedItem.postType === ItemPostType.REQUESTING) {
      // Find matching OFFERING in the same visibility scope
      const matchQuery = this.itemsRepository
        .createQueryBuilder('item')
        .leftJoinAndSelect('item.owner', 'owner')
        .leftJoinAndSelect('item.community', 'community')
        .where('item.postType = :postType', {
          postType: ItemPostType.OFFERING,
        })
        .andWhere('item.category = :category', { category: savedItem.category })
        .andWhere('item.status = :status', { status: ItemStatus.AVAILABLE })
        .orderBy('item.createdAt', 'DESC');

      if (scopeCommunityId) {
        matchQuery.andWhere('community.id = :communityId', {
          communityId: scopeCommunityId,
        });
      } else {
        matchQuery.andWhere('community.id IS NULL');
      }

      const match = await matchQuery.getOne();
      if (match && match.owner && match.owner.id !== userId) {
        await this.notificationsService.createNotification(
          userId,
          '🔔 Aradığın ürün bulundu!',
          `Platformda '${match.title}' adlı bir ilan mevcut. Hemen incelemek ister misin?`,
          NotificationType.INFO,
          match.id,
        );
        await this.notificationsService.createNotification(
          match.owner.id,
          '🔔 Senin eşyanı arayan biri var!',
          `Biri '${savedItem.category}' kategorisinde eşya arıyor. Belki eşyanı ona verebilirsin!`,
          NotificationType.INFO,
          savedItem.id,
        );
      }
    } else if (savedItem.postType === ItemPostType.OFFERING) {
      // Find matching REQUESTING in the same visibility scope
      const matchQuery = this.itemsRepository
        .createQueryBuilder('item')
        .leftJoinAndSelect('item.owner', 'owner')
        .leftJoinAndSelect('item.community', 'community')
        .where('item.postType = :postType', {
          postType: ItemPostType.REQUESTING,
        })
        .andWhere('item.category = :category', { category: savedItem.category })
        .andWhere('item.status = :status', { status: ItemStatus.AVAILABLE })
        .orderBy('item.createdAt', 'DESC');

      if (scopeCommunityId) {
        matchQuery.andWhere('community.id = :communityId', {
          communityId: scopeCommunityId,
        });
      } else {
        matchQuery.andWhere('community.id IS NULL');
      }

      const match = await matchQuery.getOne();
      if (match && match.owner && match.owner.id !== userId) {
        await this.notificationsService.createNotification(
          match.owner.id,
          '🔔 Aradığın ürün bulundu!',
          `Platformda '${savedItem.title}' eklendi. Aradığın ürün olabilir, hemen incelemek ister misin?`,
          NotificationType.INFO,
          savedItem.id,
        );
      }
    }
    // --- Smart Matchmaking Logic End ---

    // İlan oluşturma puanı: +50
    const owner = await this.usersRepository.findOne({ where: { id: userId } });
    if (owner) {
      owner.karmaPoint = (owner.karmaPoint || 0) + 50;
      await this.usersRepository.save(owner);
    }

    return savedItem;
  }

  async findAll(
    city?: string,
    district?: string,
    shareType?: string,
    postType?: string,
    userId?: string,
  ): Promise<any[]> {
    const query = this.itemsRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.owner', 'owner')
      .leftJoinAndSelect('item.community', 'community')
      .where('item.status = :status', { status: ItemStatus.AVAILABLE })
      .andWhere('community.id IS NULL');

    if (postType && postType !== 'all') {
      query.andWhere('item.postType = :postType', { postType });
    }

    if (shareType && shareType !== 'all') {
      query.andWhere('item.shareType = :shareType', { shareType });
    }

    if (city) {
      const citiesArray = city
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      if (citiesArray.length > 0) {
        query.andWhere('item.city IN (:...citiesArray)', { citiesArray });
      }
    }
    if (district) {
      const districtsArray = district
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
      if (districtsArray.length > 0) {
        query.andWhere('item.district IN (:...districtsArray)', {
          districtsArray,
        });
      }
    }

    const items = await query
      .orderBy('item.createdAt', 'DESC')
      .loadRelationCountAndMap('item.applicationsCount', 'item.applications')
      .getMany();

    return items.map((item) => this.sanitizePublicItem(item));
  }

  async findOne(id: string, userId?: string): Promise<any> {
    const item = await this.itemsRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.owner', 'owner')
      .leftJoinAndSelect('item.winner', 'winner')
      .leftJoinAndSelect('item.community', 'community')
      .loadRelationCountAndMap('item.applicationsCount', 'item.applications')
      .where('item.id = :id', { id })
      .getOne();

    if (!item) {
      throw new NotFoundException(`Bu eşya kaydına (${id}) ulaşılamadı.`);
    }

    if (item.community) {
      if (!userId) {
        throw new ForbiddenException(
          'Bu ilan yalnızca ilgili topluluğun üyelerine açıktır.',
        );
      }

      const membership = await this.communityMembersRepository.findOne({
        where: {
          community: { id: item.community.id },
          user: { id: userId },
        },
      });

      if (!membership) {
        throw new ForbiddenException(
          'Bu ilan yalnızca ilgili topluluğun üyelerine açıktır.',
        );
      }
    }

    return this.sanitizePublicItem(item);
  }

  // Teslimat durumu güncelle
  async updateDeliveryStatus(
    itemId: string,
    status: DeliveryStatus,
    userId: string,
  ): Promise<Item> {
    const item = await this.itemsRepository.findOne({
      where: { id: itemId },
      relations: ['owner', 'winner'],
    });

    if (!item) throw new NotFoundException('İlan bulunamadı.');
    if (item.status !== ItemStatus.GIVEN_AWAY) {
      throw new BadRequestException('Bu ilan henüz tamamlanmamış.');
    }

    // Yetki kontrolü
    if (status === DeliveryStatus.SHIPPED) {
      if (item.owner.id !== userId) {
        throw new BadRequestException(
          'Yalnızca ilan sahibi kargo durumunu güncelleyebilir.',
        );
      }
    } else if (status === DeliveryStatus.DELIVERED) {
      if (!item.winner || item.winner.id !== userId) {
        throw new BadRequestException(
          'Yalnızca yeni sahibi teslimat durumunu güncelleyebilir.',
        );
      }
    }

    item.deliveryStatus = status;

    // Kazanan kişiye "Teslim ettiğini söylüyor, teslim aldınız mı?" bildirimi gönder
    if (status === DeliveryStatus.SHIPPED && item.winner) {
      await this.notificationsService.createNotification(
        item.winner.id,
        '📦 Teslimat Bildirimi',
        `İlan sahibi "${item.title}" eşyasını teslimat sürecine dahil ettiğini söylüyor, teslim aldınız mı?`,
        NotificationType.INFO,
        item.id,
      );
    }

    return this.itemsRepository.save(item);
  }

  // Teslimatı Onayla ve Mutlu Son Kanıtı Ekle
  async confirmDelivery(
    itemId: string,
    userId: string,
    proofImageUrl?: string,
  ): Promise<Item> {
    const item = await this.itemsRepository.findOne({
      where: { id: itemId },
      relations: ['owner', 'winner'],
    });

    if (!item) throw new NotFoundException('İlan bulunamadı.');
    if (item.status !== ItemStatus.GIVEN_AWAY) {
      throw new BadRequestException('Bu eşya henüz döngüden çıkmamış.');
    }

    if (!item.winner || item.winner.id !== userId) {
      throw new BadRequestException(
        'Sadece bu döngünün yeni sahibi eşyayı onaylayabilir.',
      );
    }

    if (item.isConfirmed) {
      throw new BadRequestException(
        'Bu eşya zaten teslim alınmış ve onaylanmış.',
      );
    }

    // Onayla
    item.isConfirmed = true;

    // Varsa kanıt fotoğrafını kaydet
    if (proofImageUrl) {
      item.proofImage = proofImageUrl;
    }

    // "Var Mı?" (Request) ilanının giderilmesi
    if (item.postType === 'REQUESTING') {
      if (item.winner) {
        item.winner.karmaPoint = (item.winner.karmaPoint || 0) + 200;
        item.winner.resolvedRequestsCount =
          (item.winner.resolvedRequestsCount || 0) + 1;
        await this.usersRepository.save(item.winner);

        await this.notificationsService.createNotification(
          item.winner.id,
          '🌟 İhtiyaç Giderildi!',
          'Harikasın! Bir ihtiyacı giderdiğin için 200 İyilik Puanı kazandın! 🚀',
          NotificationType.SUCCESS,
          item.id,
        );
      }
      if (item.owner) {
        item.owner.karmaPoint = (item.owner.karmaPoint || 0) + 20;
        await this.usersRepository.save(item.owner);

        await this.notificationsService.createNotification(
          item.owner.id,
          '🎉 İhtiyacın Karşılandı!',
          `${item.winner?.fullName || 'Bir Döngü üyesi'} talebini yerine getirdi ve eşyayı teslim aldın. Döngü tamamlandı! +20 İyilik Puanı eklendi.`,
          NotificationType.SUCCESS,
          item.id,
        );
      }
    } else {
      // Normal Karma Puanı dağıtımı (+150 Bağışçı, +20 Alıcı veya +100 her ikisine)
      if (item.shareType === ShareType.TRADE) {
        if (item.owner) {
          item.owner.karmaPoint = (item.owner.karmaPoint || 0) + 100;
          await this.usersRepository.save(item.owner);

          await this.notificationsService.createNotification(
            item.owner.id,
            '🎉 Takas Teslimatı Onaylandı!',
            `${item.winner.fullName} eşyayı teslim aldığını onayladı. Mutlu son! +100 İyilik Puanı kazandınız!`,
            NotificationType.SUCCESS,
            item.id,
          );
        }

        item.winner.karmaPoint = (item.winner.karmaPoint || 0) + 100;
        await this.usersRepository.save(item.winner);
      } else {
        if (item.owner) {
          item.owner.karmaPoint = (item.owner.karmaPoint || 0) + 150;
          await this.usersRepository.save(item.owner);

          await this.notificationsService.createNotification(
            item.owner.id,
            '🎉 Teslimat Onaylandı!',
            `${item.winner.fullName} paylaştığınız eşyayı (${item.title}) teslim aldığını doğruladı. Döngü tamamlandı! +150 İyilik Puanı heybenize eklendi! ✨`,
            NotificationType.SUCCESS,
            item.id,
          );
        }

        item.winner.karmaPoint = (item.winner.karmaPoint || 0) + 20;
        await this.usersRepository.save(item.winner);
      }
    }

    return this.itemsRepository.save(item);
  }
}
