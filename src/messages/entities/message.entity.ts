import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Item } from '../../items/entities/item.entity';

export enum TradeStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

@Entity()
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Item, { nullable: true, onDelete: 'CASCADE' })
  item: Item | null;

  @ManyToOne(() => User, { nullable: true })
  sender: User | null;

  @ManyToOne(() => User)
  receiver: User;

  @Column('text')
  content: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ default: false })
  isTradeOffer: boolean;

  @Column({ type: 'varchar', nullable: true })
  tradeOfferedItemId: string | null;

  @Column({ type: 'enum', enum: TradeStatus, nullable: true })
  tradeStatus: TradeStatus;

  @Column({ type: 'varchar', nullable: true })
  tradeMediaUrl: string | null;

  @Column({ type: 'simple-json', nullable: true })
  tradeMediaUrls: string[] | null;

  @Column({ type: 'varchar', nullable: true })
  tradeVideoUrl: string | null;

  // If set, this message belongs to a trade-specific chat thread (not general chat)
  @Column({ type: 'varchar', nullable: true })
  tradeOfferId: string | null;

  // Soft-delete flag — silindi işaretlenen mesajlar sorgulara dahil edilmez
  @Column({ default: false })
  isDeleted: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
