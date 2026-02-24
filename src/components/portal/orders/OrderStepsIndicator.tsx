'use client';

interface OrderStepsIndicatorProps {
  currentStep: number;
  isStepComplete: (step: number) => boolean;
  isStepIncomplete: (step: number) => boolean;
  isStepStarted: (step: number) => boolean;
}

export function OrderStepsIndicator({
  currentStep,
  isStepComplete,
  isStepIncomplete,
  isStepStarted
}: OrderStepsIndicatorProps) {
  const stepLabels = [
    'Services & Locations',
    'Subject Information',
    'Search Details',
    'Documents & Review'
  ];

  return (
    <div className="bg-white rounded-lg shadow px-6 py-4">
      <div className="flex items-center justify-between">
        {[1, 2, 3, 4].map((stepNum) => {
          const isComplete = isStepComplete(stepNum);
          const isIncomplete = isStepIncomplete(stepNum);
          const hasBeenStarted = isStepStarted(stepNum);
          const isCurrent = currentStep === stepNum;

          // Determine the status color and style
          let statusColor = 'text-gray-500'; // Not started (default)
          let circleColor = 'border-gray-300 text-gray-500'; // Not started (default)

          if (!hasBeenStarted) {
            // Step not reached yet - keep gray/neutral
            statusColor = 'text-gray-500';
            circleColor = 'border-gray-300 text-gray-500';
          } else if (isComplete) {
            // Step completed successfully
            statusColor = 'text-green-600';
            circleColor = 'border-green-600 bg-green-600 text-white';
          } else if (isCurrent) {
            // Currently active step
            if (!isComplete) {
              // Current step but incomplete - show red
              statusColor = 'text-red-600';
              circleColor = 'border-red-600 bg-red-600 text-white';
            } else {
              // Current step and complete - show green
              statusColor = 'text-green-600';
              circleColor = 'border-green-600 bg-green-600 text-white';
            }
          } else if (hasBeenStarted && !isComplete) {
            // Past step that's incomplete - show red
            statusColor = 'text-red-600';
            circleColor = 'border-red-600 bg-red-600 text-white';
          }

          return (
            <div key={stepNum} className={`flex items-center ${statusColor}`}>
              <div className={`rounded-full h-8 w-8 flex items-center justify-center border-2 ${circleColor}`}>
                {isComplete && stepNum < currentStep ? '✓' : stepNum}
              </div>
              <span className="ml-2 text-sm font-medium">{stepLabels[stepNum - 1]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}