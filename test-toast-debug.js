const { useToast } = require('./src/hooks/useToast');

// Simulate creating multiple toasts
const container = document.createElement('div');
container.className = 'toast-container toast-container-top-right';
document.body.appendChild(container);

// Get the hook functions
const hook = useToast();

// Create multiple toasts
hook.toastSuccess('First');
hook.toastError('Second');
hook.toastInfo('Third');

// Check the toasts
const toasts = document.querySelectorAll('.toast');
console.log('Number of toasts:', toasts.length);
toasts.forEach((toast, i) => {
  console.log(`Toast ${i}: top = ${toast.style.top}, transform = ${toast.style.transform}`);
});
