import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Item,
  ItemStatus,
  DeliveryStatus,
  ShareType,
} from './entities/item.entity';
import { CreateItemDto } from './dto/create-item.dto';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Message } from '../messages/entities/message.entity';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private itemsRepository: Repository<Item>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private notificationsService: NotificationsService,
  ) {}

  async create(
    createItemDto: CreateItemDto,
    userId: string,
    images: string[] = [],
  ): Promise<Item> {
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
      tradePreferences: createItemDto.tradePreferences,
      deliveryMethods: [selectedDeliveryMethod],
      imageUrl:
        images.length > 0
          ? images[0]
          : 'https://via.placeholder.com/600x400?text=Resim+Yok',
      images: images,
      status: ItemStatus.AVAILABLE,
      owner: { id: userId } as User,
      drawDate: createItemDto.drawDate
        ? new Date(createItemDto.drawDate)
        : undefined,
    } as Partial<Item>) as Item;
    const savedItem = await this.itemsRepository.save(item);

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
  ): Promise<Item[]> {
    const query = this.itemsRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.owner', 'owner')
      .where('item.status = :status', { status: ItemStatus.AVAILABLE });

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

    return query
      .orderBy('item.createdAt', 'DESC')
      .loadRelationCountAndMap('item.applicationsCount', 'item.applications')
      .getMany();
  }

  async findOne(id: string): Promise<Item> {
    const item = await this.itemsRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.owner', 'owner')
      .leftJoinAndSelect('item.winner', 'winner')
      .loadRelationCountAndMap('item.applicationsCount', 'item.applications')
      .where('item.id = :id', { id })
      .getOne();

    if (!item) {
      throw new NotFoundException(`Bu eşya kaydına (${id}) ulaşılamadı.`);
    }

    // Map applicationsCount to applications array length simulation for frontend compatibility if needed
    // Or better, attach a property. We attached 'applicationsCount'.
    // Frontend expects applications.length.
    // Let's manually mock applications array with empty objects if we want to preserve length check,
    // or update frontend to use applicationsCount.
    // For minimal frontend change, I'll update frontend to check applicationsCount ?? applications?.length

    return item;
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

    // Karma puanlarını dağıt (+150 Bağışçı, +20 Alıcı veya +100 her ikisine)
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

    return this.itemsRepository.save(item);
  }
}
