import nodemailer from 'nodemailer';
import axios from 'axios';
import { config } from '../config/environment';
import { MonitoringService } from './monitoring-service';
import { logger } from '../utils/logger';

export interface Alert {
  type: 'health' | 'performance' | 'security';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  details?: any;
}

export class NotificationService {
  private static transporter = nodemailer.createTransporter({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: false,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.password
    }
  });

  static async sendAlert(alert: Alert) {
    try {
      const subject = `[${alert.severity.toUpperCase()}] ${alert.message}`;
      const text = `
Alert Details:
Type: ${alert.type}
Severity: ${alert.severity}
Message: ${alert.message}
Time: ${new Date().toISOString()}

${alert.details ? `Details: ${JSON.stringify(alert.details, null, 2)}` : ''}
      `;

      // Send email notification
      if (config.monitoring.alertEmail) {
        await this.transporter.sendMail({
          from: config.smtp.user,
          to: config.monitoring.alertEmail,
          subject,
          text
        });
      }

      // Send Slack notification
      if (config.monitoring.slackWebhook) {
        await this.sendSlackNotification(alert);
      }

      logger.info(`Alert sent: ${alert.message}`);
    } catch (error) {
      logger.error('Failed to send alert:', error);
    }
  }

  static async sendDailyReport() {
    try {
      const healthStatus = await MonitoringService.getHealthStatus();
      const metrics = await MonitoringService.getSystemMetrics();
      const performance = await MonitoringService.getPerformanceMetrics('24h');

      const subject = `Daily Health Report - ${new Date().toLocaleDateString()}`;
      const html = `
        <h2>Daily System Health Report</h2>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        
        <h3>System Health</h3>
        <p><strong>Overall Status:</strong> ${healthStatus.overall}</p>
        <ul>
          <li>Database: ${healthStatus.services.database}</li>
          <li>MongoDB: ${healthStatus.services.mongodb}</li>
          <li>Redis: ${healthStatus.services.redis}</li>
          <li>API: ${healthStatus.services.api}</li>
        </ul>

        <h3>System Metrics</h3>
        <ul>
          <li>Uptime: ${Math.floor(metrics.uptime / 3600)} hours</li>
          <li>Memory Usage: ${Math.round(metrics.memory.used / 1024 / 1024)} MB</li>
          <li>Requests/Minute: ${metrics.requestsPerMinute}</li>
          <li>Error Rate: ${metrics.errorRate.toFixed(2)}%</li>
          <li>Avg Response Time: ${metrics.responseTime.toFixed(2)}ms</li>
        </ul>

        <h3>Performance Summary</h3>
        <p>Total requests in last 24h: ${performance.reduce((sum: number, p: any) => sum + p.requests, 0)}</p>
        <p>Average response time: ${(performance.reduce((sum: number, p: any) => sum + p.avg_response_time, 0) / performance.length).toFixed(2)}ms</p>
      `;

      if (config.monitoring.alertEmail) {
        await this.transporter.sendMail({
          from: config.smtp.user,
          to: config.monitoring.alertEmail,
          subject,
          html
        });
      }

      logger.info('Daily report sent successfully');
    } catch (error) {
      logger.error('Failed to send daily report:', error);
    }
  }

  private static async sendSlackNotification(alert: Alert) {
    try {
      const color = alert.severity === 'critical' ? 'danger' : 
                   alert.severity === 'warning' ? 'warning' : 'good';

      await axios.post(config.monitoring.slackWebhook, {
        attachments: [{
          color,
          title: `${alert.severity.toUpperCase()}: ${alert.message}`,
          fields: [
            { title: 'Type', value: alert.type, short: true },
            { title: 'Time', value: new Date().toISOString(), short: true }
          ],
          text: alert.details ? `\`\`\`${JSON.stringify(alert.details, null, 2)}\`\`\`` : ''
        }]
      });
    } catch (error) {
      logger.error('Failed to send Slack notification:', error);
    }
  }
}