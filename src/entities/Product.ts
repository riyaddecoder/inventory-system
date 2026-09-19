import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Category } from './Category';
import { Inventory } from './Inventory';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column('varchar')
  name!: string;

  @Column('text')
  description!: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price!: number;

  @Index()
  @ManyToOne(() => Category, (category) => category.products, { onDelete: 'SET NULL', nullable: true })
  category!: Category;

  @OneToOne(() => Inventory, (inventory) => inventory.product)
  inventory!: Inventory;

  @Index()
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
