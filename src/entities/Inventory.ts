import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Product } from './Product';

@Entity('inventories')
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ default: 0 })
  quantity!: number;

  @OneToOne(() => Product, (product) => product.inventory)
  @JoinColumn()
  product!: Product;
}
