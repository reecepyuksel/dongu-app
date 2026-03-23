import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import {
  Item,
  ItemStatus,
  DeliveryStatus,
} from '../items/entities/item.entity';
import { Giveaway } from '../giveaways/entities/giveaway.entity';
import { Message, TradeStatus } from '../messages/entities/message.entity';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Item)
    private itemsRepository: Repository<Item>,
    @InjectRepository(Giveaway)
    private giveawaysRepository: Repository<Giveaway>,
    @InjectRepository(Message)
    private messagesRepository: Repository<Message>,
  ) {}

  async getSuccessfulTradesCount(userId: string): Promise<number> {
    return this.messagesRepository.count({
      where: [
        {
          sender: { id: userId },
          isTradeOffer: true,
          tradeStatus: TradeStatus.ACCEPTED,
          isDeleted: false,
        },
        {
          receiver: { id: userId },
          isTradeOffer: true,
          tradeStatus: TradeStatus.ACCEPTED,
          isDeleted: false,
        },
      ],
    });
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { email, password, fullName } = createUserDto;

    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = this.usersRepository.create({
      email,
      password: hashedPassword,
      fullName,
    });

    return this.usersRepository.save(user);
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findOne(id: string): Promise<User | null> {
    try {
      return await this.usersRepository.findOne({ where: { id } });
    } catch {
      return null;
    }
  }

  // Kullanıcının paylaştığı eşyalar
  async findUserItems(userId: string): Promise<Item[]> {
    return this.itemsRepository.find({
      where: { owner: { id: userId } },
      relations: ['winner'],
      order: { createdAt: 'DESC' },
    });
  }

  // Kullanıcının katıldığı çekilişler
  async findUserApplications(userId: string): Promise<Giveaway[]> {
    return this.giveawaysRepository.find({
      where: { applicant: { id: userId } },
      relations: ['item', 'item.owner', 'item.winner'],
      order: { appliedAt: 'DESC' },
    });
  }

  // Karma puanı ve rank hesapla
  async getKarmaScore(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    const karmaPoint = user?.karmaPoint || 0;

    // Bağışlanan eşyalar (GIVEN_AWAY)
    const donatedItems = await this.itemsRepository.count({
      where: { owner: { id: userId }, status: ItemStatus.GIVEN_AWAY },
    });

    // Katılınan çekilişler
    const participations = await this.giveawaysRepository.count({
      where: { applicant: { id: userId } },
    });

    // Teslim edilen eşyalar (DELIVERED)
    const deliveredItems = await this.itemsRepository.count({
      where: {
        owner: { id: userId },
        deliveryStatus: DeliveryStatus.DELIVERED,
      },
    });

    const successfulTradesCount = await this.getSuccessfulTradesCount(userId);

    // Rank belirle (karmaPoint üzerinden)
    let badge = {
      name: 'Yeni Paylaşımcı',
      emoji: '🥉',
      level: 1,
      color: 'bronze',
    };
    if (karmaPoint > 2000)
      badge = { name: 'Döngü Ustası', emoji: '💎', level: 4, color: 'emerald' };
    else if (karmaPoint >= 751)
      badge = { name: 'İyilik Elçisi', emoji: '🥇', level: 3, color: 'gold' };
    else if (karmaPoint >= 251)
      badge = {
        name: 'İyilik Yolcusu',
        emoji: '🥈',
        level: 2,
        color: 'silver',
      };

    // Sonraki seviye hesapla
    let nextRankAt: number | null = 251;
    let nextRankName: string | null = 'İyilik Yolcusu';
    if (karmaPoint >= 2000) {
      nextRankAt = null; // Max seviye
      nextRankName = null;
    } else if (karmaPoint >= 751) {
      nextRankAt = 2001;
      nextRankName = 'Döngü Ustası';
    } else if (karmaPoint >= 251) {
      nextRankAt = 751;
      nextRankName = 'İyilik Elçisi';
    }

    return {
      score: karmaPoint,
      badge,
      nextRankAt,
      nextRankName,
      pointsToNext: nextRankAt ? nextRankAt - karmaPoint : 0,
      stats: {
        donatedItems,
        participations,
        deliveredItems,
        successfulTradesCount,
      },
    };
  }

  // Herkesin görebildiği genel profil
  async getPublicProfile(userId: string) {
    try {
      const user = await this.usersRepository.findOne({
        where: { id: userId },
      });
      if (!user) return null;

      const activeItems = await this.itemsRepository.find({
        where: { owner: { id: userId }, status: ItemStatus.AVAILABLE },
        order: { createdAt: 'DESC' },
      });

      const completedLoops = await this.itemsRepository.count({
        where: { owner: { id: userId }, status: ItemStatus.GIVEN_AWAY },
      });

      const receivedItems = await this.itemsRepository.count({
        where: { winner: { id: userId }, isConfirmed: true },
      });

      const promisedItemsCount = completedLoops; // alias for clarity
      const confirmedDeliveries = await this.itemsRepository.count({
        where: {
          owner: { id: userId },
          status: ItemStatus.GIVEN_AWAY,
          isConfirmed: true,
        },
      });

      // Tamamlama oranı: Başlatılan döngülerden yüzde kaçı Onaylandı?
      const completionRate =
        promisedItemsCount > 0
          ? Math.round((confirmedDeliveries / promisedItemsCount) * 100)
          : 0; // Eğer hiç söz vermediyse %0 kalsın, ipucu çıksın

      const karmaStats = await this.getKarmaScore(userId);
      const successfulTradesCount = await this.getSuccessfulTradesCount(userId);

      return {
        id: user.id,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        karmaPoint: user.karmaPoint,
        badges: user.badges,
        createdAt: user.createdAt,
        activeItems,
        completedLoops,
        receivedItems,
        completionRate,
        karmaStats,
        successfulTradesCount,
      };
    } catch (error) {
      return null;
    }
  }

  // Kullanıcının başarıyla bağışladığı eşyalar
  async getDonatedItems(userId: string) {
    return this.itemsRepository.find({
      where: { owner: { id: userId }, status: ItemStatus.GIVEN_AWAY },
      select: [
        'id',
        'title',
        'imageUrl',
        'createdAt',
        'isConfirmed',
        'proofImage',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  // Kullanıcının kazandığı (ve onayladığı) eşyalar
  async getReceivedItems(userId: string) {
    return this.itemsRepository.find({
      where: { winner: { id: userId }, isConfirmed: true },
      select: [
        'id',
        'title',
        'imageUrl',
        'createdAt',
        'isConfirmed',
        'proofImage',
      ],
      order: { createdAt: 'DESC' },
    });
  }
}
