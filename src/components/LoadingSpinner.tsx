import React from 'react';
import { Shield } from 'lucide-react';

export default function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="text-center">
        <div className="relative">
          <Shield className="h-16 w-16 text-blue-400 mx-auto animate-pulse" />
          <div className="absolute inset-0 h-16 w-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
        <h2 className="mt-4 text-xl font-semibold text-white">Loading SecureChat...</h2>
        <p className="mt-2 text-gray-400">Establishing secure connection</p>
      </div>
    </div>
  );
}