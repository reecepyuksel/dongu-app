import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Giveaway } from '../../giveaways/entities/giveaway.entity';
import { Favorite } from '../../favorites/favorite.entity';

export enum ItemStatus {
  AVAILABLE = 'AVAILABLE',
  DRAW_PENDING = 'DRAW_PENDING',
  GIVEN_AWAY = 'GIVEN_AWAY',
  IN_TRADE = 'IN_TRADE',
}

export enum DeliveryStatus {
  PENDING = 'PENDING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
}

export enum ItemSelectionType {
  LOTTERY = 'lottery',
  MANUAL = 'manual',
}

export enum ShareType {
  FREE = 'donation',
  TRADE = 'exchange',
}

@Entity()
export class Item {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  district: string;

  @Column({ nullable: true })
  neighborhood: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column('text', { array: true, default: [] })
  images: string[];

  @Column({ nullable: true }) // Kategori ekledik, eski veriler için nullable
  category: string;

  @Column({ type: 'enum', enum: ItemStatus, default: ItemStatus.AVAILABLE })
  status: ItemStatus;

  @Column({ type: 'enum', enum: DeliveryStatus, nullable: true })
  deliveryStatus: DeliveryStatus;

  @Column({
    type: 'enum',
    enum: ItemSelectionType,
    default: ItemSelectionType.LOTTERY,
  })
  selectionType: ItemSelectionType;

  @Column({ type: 'enum', enum: ShareType, default: ShareType.FREE })
  shareType: ShareType;

  @Column({ type: 'text', nullable: true })
  tradePreferences: string;

  @ManyToOne(() => User, (user) => user.items)
  owner: User;

  @ManyToOne(() => User, { nullable: true })
  winner: User;

  @Column({ default: false })
  isConfirmed: boolean;

  @Column({ nullable: true })
  proofImage: string;

  @OneToMany(() => Giveaway, (giveaway) => giveaway.item)
  applications: Giveaway[];

  @OneToMany(() => Favorite, (favorite) => favorite.item)
  favorites: Favorite[];

  @Column({ type: 'timestamptz', nullable: true })
  drawDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'simple-array', nullable: true })
  deliveryMethods: string[];
}

export enum DeliveryMethod {
  PICKUP = 'pickup',
  SHIPPING_BUYER = 'shipping_buyer',
  SHIPPING_SELLER = 'shipping_seller',
  HAND_DELIVERY = 'hand_delivery',
  MUTUAL_AGREEMENT = 'mutual_agreement',
}
