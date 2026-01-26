'use client';

import { useSession } from 'next-auth/react';
import { useState } from 'react';

export default function NewOrderPage() {
  const { data: session } = useSession();
  const [step, setStep] = useState(1);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow px-6 py-4">
        <h2 className="text-2xl font-bold text-gray-900">Create New Order</h2>
        <p className="mt-1 text-sm text-gray-600">
          Follow the steps below to place a new order
        </p>
      </div>

      {/* Steps Indicator */}
      <div className="bg-white rounded-lg shadow px-6 py-4">
        <div className="flex items-center justify-between">
          <div className={`flex items-center ${step >= 1 ? 'text-brand-blue' : 'text-gray-400'}`}>
            <div className={`rounded-full h-8 w-8 flex items-center justify-center border-2 ${step >= 1 ? 'border-brand-blue bg-brand-blue text-white' : 'border-gray-300'}`}>
              1
            </div>
            <span className="ml-2 text-sm font-medium">Subject Information</span>
          </div>
          <div className={`flex items-center ${step >= 2 ? 'text-brand-blue' : 'text-gray-400'}`}>
            <div className={`rounded-full h-8 w-8 flex items-center justify-center border-2 ${step >= 2 ? 'border-brand-blue bg-brand-blue text-white' : 'border-gray-300'}`}>
              2
            </div>
            <span className="ml-2 text-sm font-medium">Select Services</span>
          </div>
          <div className={`flex items-center ${step >= 3 ? 'text-brand-blue' : 'text-gray-400'}`}>
            <div className={`rounded-full h-8 w-8 flex items-center justify-center border-2 ${step >= 3 ? 'border-brand-blue bg-brand-blue text-white' : 'border-gray-300'}`}>
              3
            </div>
            <span className="ml-2 text-sm font-medium">Requirements</span>
          </div>
          <div className={`flex items-center ${step >= 4 ? 'text-brand-blue' : 'text-gray-400'}`}>
            <div className={`rounded-full h-8 w-8 flex items-center justify-center border-2 ${step >= 4 ? 'border-brand-blue bg-brand-blue text-white' : 'border-gray-300'}`}>
              4
            </div>
            <span className="ml-2 text-sm font-medium">Review & Submit</span>
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {step === 1 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Subject Information
            </h3>
            <p className="text-gray-600">
              Enter information about the person this order is for.
            </p>
            {/* Form fields will be added here */}
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Select Services
            </h3>
            <p className="text-gray-600">
              Choose the services you need for this order.
            </p>
            {/* Service selection will be added here */}
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Requirements
            </h3>
            <p className="text-gray-600">
              Provide the required information and documents.
            </p>
            {/* Dynamic requirements form will be added here */}
          </div>
        )}

        {step === 4 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Review & Submit
            </h3>
            <p className="text-gray-600">
              Review your order before submitting.
            </p>
            {/* Order review will be added here */}
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="inline-flex items-center rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <button
            onClick={() => setStep(Math.min(4, step + 1))}
            className="inline-flex items-center rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            {step === 4 ? 'Submit Order' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}