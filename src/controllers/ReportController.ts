import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/ReportService';

const reportService = new ReportService();

export class ReportController {
  async getSalesReport(req: Request, res: Response, next: NextFunction) {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const report = await reportService.getSalesReport(startDate, endDate);
      res.status(200).json(report);
    } catch (error) {
      next(error);
    }
  }

  async getTopProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;
      const topProducts = await reportService.getTopSellingProducts(limit);
      res.status(200).json(topProducts);
    } catch (error) {
      next(error);
    }
  }

  async getCategoryPerformance(req: Request, res: Response, next: NextFunction) {
    try {
      const performance = await reportService.getCategoryPerformance();
      res.status(200).json(performance);
    } catch (error) {
      next(error);
    }
  }
}
