import { AppDataSource } from '../config/database';
import { Order, OrderStatus } from '../entities/Order';
import { OrderItem } from '../entities/OrderItem';

export class ReportService {
  private orderRepository = AppDataSource.getRepository(Order);
  private orderItemRepository = AppDataSource.getRepository(OrderItem);

  async getSalesReport(startDate?: string, endDate?: string) {
    const qb = this.orderRepository.createQueryBuilder('order');

    if (startDate) {
      qb.andWhere('order.createdAt >= :startDate', { startDate: new Date(startDate) });
    }
    if (endDate) {
      qb.andWhere('order.createdAt <= :endDate', { endDate: new Date(endDate) });
    }

    const allOrders = await qb.getMany();

    const nonCancelledOrders = allOrders.filter(o => o.status !== OrderStatus.CANCELLED);
    const totalRevenue = nonCancelledOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const totalOrders = allOrders.length;
    const completedOrders = nonCancelledOrders.length;
    const averageOrderValue = completedOrders > 0 ? parseFloat((totalRevenue / completedOrders).toFixed(2)) : 0;

    const statusCounts: Record<string, { count: number; totalAmount: number }> = {};
    for (const order of allOrders) {
      if (!statusCounts[order.status]) {
        statusCounts[order.status] = { count: 0, totalAmount: 0 };
      }
      statusCounts[order.status].count += 1;
      statusCounts[order.status].totalAmount += Number(order.totalAmount);
    }

    return {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalOrders,
      completedOrders,
      cancelledOrders: totalOrders - completedOrders,
      averageOrderValue,
      statusBreakdown: statusCounts,
      period: {
        startDate: startDate || null,
        endDate: endDate || null
      }
    };
  }

  async getTopSellingProducts(limit: number = 5) {
    const safeLimit = Math.max(1, Math.min(50, limit));

    const result = await this.orderItemRepository.createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .innerJoin('item.product', 'product')
      .where('order.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .select('product.id', 'productId')
      .addSelect('product.name', 'productName')
      .addSelect('COALESCE(SUM(item.quantity), 0)', 'totalQuantitySold')
      .addSelect('COALESCE(SUM(item.quantity * item.price), 0)', 'totalRevenue')
      .groupBy('product.id')
      .addGroupBy('product.name')
      .orderBy('SUM(item.quantity)', 'DESC')
      .limit(safeLimit)
      .getRawMany();

    return result.map(r => ({
      productId: r.productId,
      productName: r.productName,
      totalQuantitySold: parseInt(r.totalQuantitySold || '0', 10),
      totalRevenue: parseFloat(parseFloat(r.totalRevenue || '0').toFixed(2))
    }));
  }

  async getCategoryPerformance() {
    const result = await this.orderItemRepository.createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .innerJoin('item.product', 'product')
      .leftJoin('product.category', 'category')
      .where('order.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .select('category.id', 'categoryId')
      .addSelect('COALESCE(category.name, \'Uncategorized\')', 'categoryName')
      .addSelect('COALESCE(SUM(item.quantity), 0)', 'totalUnitsSold')
      .addSelect('COALESCE(SUM(item.quantity * item.price), 0)', 'totalRevenue')
      .groupBy('category.id')
      .addGroupBy('category.name')
      .orderBy('SUM(item.quantity * item.price)', 'DESC')
      .getRawMany();

    return result.map(r => ({
      categoryId: r.categoryId || 'none',
      categoryName: r.categoryName || 'Uncategorized',
      totalUnitsSold: parseInt(r.totalUnitsSold || '0', 10),
      totalRevenue: parseFloat(parseFloat(r.totalRevenue || '0').toFixed(2))
    }));
  }
}
