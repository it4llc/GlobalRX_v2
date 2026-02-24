import { useState, useCallback } from 'react';
import { ServiceItem, AvailableService } from '../types';

/**
 * Custom hook for managing service cart functionality
 * Extracted from the large order form component
 */
export function useServiceCart(initialItems: ServiceItem[] = []) {
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>(initialItems);
  const [itemCounter, setItemCounter] = useState(0);

  /**
   * Add a service+location combination to cart
   * Supports duplicate service+location pairs with unique IDs
   */
  const addServiceToCart = useCallback((
    service: AvailableService,
    locationId: string,
    locationName: string
  ) => {
    const itemId = `${service.id}-${locationId}-${Date.now()}-${itemCounter}`;

    const newItem: ServiceItem = {
      serviceId: service.id,
      serviceName: service.name,
      locationId: locationId,
      locationName: locationName,
      itemId: itemId,
    };

    setItemCounter(prev => prev + 1);
    setServiceItems(prev => [...prev, newItem]);
    return newItem;
  }, [itemCounter]);

  /**
   * Remove a service item from cart by item ID
   */
  const removeServiceFromCart = useCallback((itemId: string) => {
    setServiceItems(prev => prev.filter(item => item.itemId !== itemId));
  }, []);

  /**
   * Clear all items from cart
   */
  const clearCart = useCallback(() => {
    setServiceItems([]);
  }, []);

  /**
   * Update the entire cart (useful for loading existing order data)
   */
  const setCart = useCallback((items: ServiceItem[]) => {
    setServiceItems(items);
  }, []);

  /**
   * Check if a specific service+location combination exists in cart
   */
  const hasServiceLocation = useCallback((serviceId: string, locationId: string) => {
    return serviceItems.some(item =>
      item.serviceId === serviceId && item.locationId === locationId
    );
  }, [serviceItems]);

  /**
   * Get count of items for a specific service+location combination
   */
  const getServiceLocationCount = useCallback((serviceId: string, locationId: string) => {
    return serviceItems.filter(item =>
      item.serviceId === serviceId && item.locationId === locationId
    ).length;
  }, [serviceItems]);

  /**
   * Get all unique services in cart
   */
  const getUniqueServices = useCallback(() => {
    const serviceMap = new Map<string, AvailableService>();

    serviceItems.forEach(item => {
      if (!serviceMap.has(item.serviceId)) {
        serviceMap.set(item.serviceId, {
          id: item.serviceId,
          name: item.serviceName,
          category: '' // Not stored in ServiceItem, would need to fetch separately
        });
      }
    });

    return Array.from(serviceMap.values());
  }, [serviceItems]);

  /**
   * Get all unique locations for a specific service
   */
  const getLocationsForService = useCallback((serviceId: string) => {
    const locationMap = new Map<string, { id: string; name: string }>();

    serviceItems
      .filter(item => item.serviceId === serviceId)
      .forEach(item => {
        if (!locationMap.has(item.locationId)) {
          locationMap.set(item.locationId, {
            id: item.locationId,
            name: item.locationName
          });
        }
      });

    return Array.from(locationMap.values());
  }, [serviceItems]);

  return {
    serviceItems,
    addServiceToCart,
    removeServiceFromCart,
    clearCart,
    setCart,
    hasServiceLocation,
    getServiceLocationCount,
    getUniqueServices,
    getLocationsForService,
    itemCount: serviceItems.length
  };
}