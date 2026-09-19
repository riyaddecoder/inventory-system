import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('idempotency_keys')
export class IdempotencyKey {
  @PrimaryColumn()
  key!: string;

  @Column('jsonb')
  responseBody!: any;

  @Column()
  statusCode!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
