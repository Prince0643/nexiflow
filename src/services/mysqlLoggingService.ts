import { isValid } from 'date-fns';

export interface SystemLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  userId?: string;
  userName?: string;
  action: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

class MySQLLoggingService {
  // Create a new log entry
  async log(level: SystemLog['level'], message: string, action: string, details?: any, userId?: string, userName?: string): Promise<void> {
    try {
      // Make API call to backend to log the event
      await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level,
          message,
          action,
          details,
          userId: userId || null,
          userName: userName || null,
          ipAddress: this.getClientIP(),
          userAgent: navigator.userAgent
        }),
      });
    } catch (error) {
      console.error('Failed to log system event:', error);
    }
  }

  // Log info events
  async logInfo(message: string, action: string, details?: any, userId?: string, userName?: string): Promise<void> {
    await this.log('info', message, action, details, userId, userName);
  }

  // Log warning events
  async logWarning(message: string, action: string, details?: any, userId?: string, userName?: string): Promise<void> {
    await this.log('warning', message, action, details, userId, userName);
  }

  // Log error events
  async logError(message: string, action: string, details?: any, userId?: string, userName?: string): Promise<void> {
    await this.log('error', message, action, details, userId, userName);
  }

  // Log success events
  async logSuccess(message: string, action: string, details?: any, userId?: string, userName?: string): Promise<void> {
    await this.log('success', message, action, details, userId, userName);
  }

  // Get recent logs with optional date range
  async getRecentLogs(limit: number = 100, startDate?: Date, endDate?: Date): Promise<SystemLog[]> {
    try {
      // Make API call to backend to get logs
      const response = await fetch(`/api/logs/recent?limit=${limit}${startDate ? `&startDate=${startDate.toISOString()}` : ''}${endDate ? `&endDate=${endDate.toISOString()}` : ''}`);
      const data = await response.json();
      
      if (data.success) {
        return data.logs.map((log: any) => ({
          ...log,
          timestamp: isValid(new Date(log.timestamp)) ? new Date(log.timestamp) : new Date(),
          details: log.details ? JSON.parse(log.details) : null
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      // Return empty array instead of throwing error to prevent UI crashes
      return [];
    }
  }

  // Get logs by level
  async getLogsByLevel(level: SystemLog['level'], limit: number = 100): Promise<SystemLog[]> {
    try {
      // Make API call to backend to get logs by level
      const response = await fetch(`/api/logs/level/${level}?limit=${limit}`);
      const data = await response.json();
      
      if (data.success) {
        return data.logs.map((log: any) => ({
          ...log,
          timestamp: isValid(new Date(log.timestamp)) ? new Date(log.timestamp) : new Date(),
          details: log.details ? JSON.parse(log.details) : null
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Failed to fetch logs by level:', error);
      return [];
    }
  }

  // Get logs by user with optional date range
  async getLogsByUser(userId: string, limit: number = 100, startDate?: Date, endDate?: Date): Promise<SystemLog[]> {
    try {
      // Make API call to backend to get logs by user
      const response = await fetch(`/api/logs/user/${userId}?limit=${limit}${startDate ? `&startDate=${startDate.toISOString()}` : ''}${endDate ? `&endDate=${endDate.toISOString()}` : ''}`);
      const data = await response.json();
      
      if (data.success) {
        return data.logs.map((log: any) => ({
          ...log,
          timestamp: isValid(new Date(log.timestamp)) ? new Date(log.timestamp) : new Date(),
          details: log.details ? JSON.parse(log.details) : null
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Failed to fetch logs by user:', error);
      return [];
    }
  }

  // Get logs by action type with optional date range and level filtering
  async getLogsByAction(action: string, limit: number = 100, level?: SystemLog['level'], startDate?: Date, endDate?: Date): Promise<SystemLog[]> {
    try {
      // Make API call to backend to get logs by action
      const response = await fetch(`/api/logs/action/${action}?limit=${limit}${level ? `&level=${level}` : ''}${startDate ? `&startDate=${startDate.toISOString()}` : ''}${endDate ? `&endDate=${endDate.toISOString()}` : ''}`);
      const data = await response.json();
      
      if (data.success) {
        return data.logs.map((log: any) => ({
          ...log,
          timestamp: isValid(new Date(log.timestamp)) ? new Date(log.timestamp) : new Date(),
          details: log.details ? JSON.parse(log.details) : null
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Failed to fetch logs by action:', error);
      return [];
    }
  }

  // Clear all logs
  async clearAllLogs(): Promise<void> {
    try {
      // Make API call to backend to clear all logs
      const response = await fetch('/api/logs/clear', {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to clear logs');
      }
      
      // Log the clearing action
      await this.log('info', 'All logs cleared by admin', 'CLEAR_LOGS', null, undefined, 'System');
    } catch (error) {
      console.error('Failed to clear logs:', error);
      throw error;
    }
  }

  // Get client IP (simplified - in production you'd get this from server)
  private getClientIP(): string {
    // This is a simplified version - in production you'd get the real IP
    return '127.0.0.1';
  }

  // Log user authentication events
  async logAuthEvent(event: 'login' | 'logout' | 'signup' | 'password_reset', userId: string, userName: string, success: boolean, details?: any): Promise<void> {
    const level = success ? 'success' : 'error';
    const message = success 
      ? `User ${event} successful` 
      : `User ${event} failed`;
    
    await this.log(level, message, `AUTH_${event.toUpperCase()}`, details, userId, userName);
  }

  // Log database operations
  async logDatabaseEvent(operation: 'create' | 'read' | 'update' | 'delete', collection: string, recordId: string, userId: string, userName: string, success: boolean, details?: any): Promise<void> {
    const level = success ? 'info' : 'error';
    const message = success 
      ? `${operation} operation on ${collection} successful` 
      : `${operation} operation on ${collection} failed`;
    
    await this.log(level, message, `DB_${operation.toUpperCase()}`, { collection, recordId, ...details }, userId, userName);
  }

  // Log system events
  async logSystemEvent(event: 'backup' | 'restore' | 'maintenance' | 'error', message: string, details?: any, userId?: string, userName?: string): Promise<void> {
    const level = event === 'error' ? 'error' : 'info';
    await this.log(level, message, `SYSTEM_${event.toUpperCase()}`, details, userId, userName);
  }

  // Log user actions
  async logUserAction(action: string, message: string, userId: string, userName: string, details?: any): Promise<void> {
    await this.log('info', message, `USER_${action.toUpperCase()}`, details, userId, userName);
  }
}

export const mysqlLoggingService = new MySQLLoggingService();