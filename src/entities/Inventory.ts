import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Product } from './Product';

@Entity('inventories')
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column('int', { default: 0 })
  quantity!: number;

  @Column('int', { default: 0 })
  reservedQuantity!: number;

  @Column('int', { default: 5 })
  lowStockThreshold!: number;

  @OneToOne(() => Product, (product) => product.inventory, { onDelete: 'CASCADE' })
  @JoinColumn()
  product!: Product;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
