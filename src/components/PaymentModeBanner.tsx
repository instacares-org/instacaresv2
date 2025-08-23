"use client";

import { ExclamationTriangleIcon, BeakerIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { getCurrentConfig, getPaymentModeWarning } from '@/lib/payment-modes';

export default function PaymentModeBanner() {
  const config = getCurrentConfig();
  const warning = getPaymentModeWarning();
  
  if (!warning) return null;
  
  const getIcon = () => {
    switch (config.color) {
      case 'yellow':
        return <ExclamationTriangleIcon className="h-5 w-5" />;
      case 'blue':
        return <BeakerIcon className="h-5 w-5" />;
      case 'green':
        return <CheckCircleIcon className="h-5 w-5" />;
      default:
        return <ExclamationTriangleIcon className="h-5 w-5" />;
    }
  };
  
  const getBgColor = () => {
    switch (config.color) {
      case 'yellow':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'blue':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'green':
        return 'bg-green-50 border-green-200 text-green-800';
      default:
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
    }
  };
  
  return (
    <div className={`border rounded-lg p-4 mb-6 ${getBgColor()}`}>
      <div className="flex items-center">
        {getIcon()}
        <div className="ml-3">
          <p className="text-sm font-medium">
            {config.name} Active
          </p>
          <p className="text-sm mt-1">
            {warning}
          </p>
        </div>
      </div>
    </div>
  );
}