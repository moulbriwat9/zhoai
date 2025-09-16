import React, { useState, useEffect } from 'react';
import { monitoringApi, userApi } from '../services/api';
import { 
  Activity, 
  Users, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  Server,
  Database,
  Wifi
} from 'lucide-react';

interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: 'healthy' | 'unhealthy';
    mongodb: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy';
    api: 'healthy' | 'unhealthy';
  };
  uptime: number;
  timestamp: string;
}

interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    free: number;
  };
  uptime: number;
  activeConnections: number;
  requestsPerMinute: number;
  errorRate: number;
  responseTime: number;
}

export default function AdminDashboard() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [accessLogs, setAccessLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const [health, metrics, usersData, logs] = await Promise.all([
        monitoringApi.getHealthStatus(),
        monitoringApi.getSystemMetrics(),
        userApi.getAllUsers(1, 10),
        monitoringApi.getAccessLogs(1, 20)
      ]);

      setHealthStatus(health);
      setSystemMetrics(metrics);
      setUsers(usersData.users);
      setAccessLogs(logs.logs);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-400" />;
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-400" />;
      default:
        return <XCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'degraded':
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'unhealthy':
        return 'text-red-400 bg-red-400/10 border-red-400/20';
      default:
        return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">System Dashboard</h1>
          <p className="text-gray-400">Monitor system health, performance, and security</p>
        </div>

        {/* System Health Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className={`p-6 rounded-lg border ${getStatusColor(healthStatus?.overall || 'unhealthy')}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Overall Health</p>
                <p className="text-2xl font-bold capitalize">{healthStatus?.overall}</p>
              </div>
              {getStatusIcon(healthStatus?.overall || 'unhealthy')}
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Uptime</p>
                <p className="text-2xl font-bold text-white">
                  {systemMetrics ? formatUptime(systemMetrics.uptime) : '0d 0h 0m'}
                </p>
              </div>
              <Activity className="h-8 w-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Requests/Min</p>
                <p className="text-2xl font-bold text-white">{systemMetrics?.requestsPerMinute || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-400" />
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Error Rate</p>
                <p className="text-2xl font-bold text-white">{systemMetrics?.errorRate.toFixed(2) || 0}%</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-400" />
            </div>
          </div>
        </div>

        {/* Services Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Server className="h-5 w-5 mr-2" />
              Service Status
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Database className="h-4 w-4 mr-2 text-gray-400" />
                  <span className="text-gray-300">PostgreSQL</span>
                </div>
                {getStatusIcon(healthStatus?.services.database || 'unhealthy')}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Database className="h-4 w-4 mr-2 text-gray-400" />
                  <span className="text-gray-300">MongoDB</span>
                </div>
                {getStatusIcon(healthStatus?.services.mongodb || 'unhealthy')}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Wifi className="h-4 w-4 mr-2 text-gray-400" />
                  <span className="text-gray-300">Redis</span>
                </div>
                {getStatusIcon(healthStatus?.services.redis || 'unhealthy')}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Server className="h-4 w-4 mr-2 text-gray-400" />
                  <span className="text-gray-300">API Server</span>
                </div>
                {getStatusIcon(healthStatus?.services.api || 'unhealthy')}
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              System Metrics
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Memory Usage</span>
                <span className="text-white">
                  {systemMetrics ? formatBytes(systemMetrics.memory.used) : '0 MB'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Response Time</span>
                <span className="text-white">{systemMetrics?.responseTime.toFixed(2) || 0}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Active Connections</span>
                <span className="text-white">{systemMetrics?.activeConnections || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Users and Access Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Recent Users
            </h3>
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {user.display_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                    </div>
                    <div className="ml-3">
                      <p className="text-white text-sm">{user.display_name || user.email}</p>
                      <p className="text-gray-400 text-xs">{user.role}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              Access Logs
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {accessLogs.map((log) => (
                <div key={log.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">{log.endpoint}</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      log.status_code < 400 ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'
                    }`}>
                      {log.status_code}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{log.ip_address}</span>
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}