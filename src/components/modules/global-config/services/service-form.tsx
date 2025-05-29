'use client';
// src/components/modules/global-config/services/service-form.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StandardDropdown } from '@/components/ui/standard-dropdown';

interface Service {
  id: string;
  name: string;
  category: string;
  description: string | null;
  functionalityType: string;
}

interface ServiceFormProps {
  service: Service | null;
  categories: string[];
  functionalityTypes: string[];
  onSubmit: (formData: any) => void;
  onCancel: () => void;
}

export function ServiceForm({
  service,
  categories,
  functionalityTypes,
  onSubmit,
  onCancel,
}: ServiceFormProps) {
  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [description, setDescription] = useState('');
  const [functionalityType, setFunctionalityType] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);

  // Initialize form with service data if editing
  useEffect(() => {
    if (service) {
      setName(service.name);
      setCategory(service.category);
      setDescription(service.description || '');
      setFunctionalityType(service.functionalityType);
    } else {
      // Default values for new service
      setName('');
      setCategory('');
      setNewCategory('');
      setDescription('');
      // Set a default functionality type from the available types
      setFunctionalityType(functionalityTypes.length > 0 ? functionalityTypes[0] : 'verification');
    }
  }, [service, functionalityTypes]);

  // Validate form fields
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!name.trim()) {
      newErrors.name = 'Service name is required';
    }
    
    if (!showNewCategoryInput && !category) {
      newErrors.category = 'Please select or create a category';
    }
    
    if (showNewCategoryInput && !newCategory.trim()) {
      newErrors.newCategory = 'Category name is required';
    }
    
    if (!functionalityType) {
      newErrors.functionalityType = 'Functionality type is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    const formData = {
      name,
      category: showNewCategoryInput ? newCategory.trim() : category,
      description: description.trim() || null,
      functionalityType,
    };
    
    onSubmit(formData);
  };

  // Toggle between selecting existing category and creating new one
  const toggleNewCategory = () => {
    setShowNewCategoryInput(!showNewCategoryInput);
    if (showNewCategoryInput) {
      setCategory('');
    } else {
      setNewCategory('');
    }
  };

  // Format options for category dropdown
  const categoryOptions = categories.map(cat => ({
    id: cat,
    value: cat,
    label: cat
  }));

  // Format options for functionality type dropdown
  const functionalityTypeOptions = functionalityTypes.map(type => ({
    id: type,
    value: type,
    label: type.charAt(0).toUpperCase() + type.slice(1)
  }));

  return (
    <form onSubmit={handleSubmit}>
      <table className="form-table w-full">
        <tbody>
          {/* Service Name */}
          <tr>
            <td className="form-label">
              <Label htmlFor="name" className="text-sm font-medium">
                Service Name <span className="text-red-500">*</span>
              </Label>
            </td>
            <td className="form-input">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="form-error">{errors.name}</p>}
            </td>
            <td className="form-info">
              <span className="form-required">Required</span>
            </td>
          </tr>

          {/* Category */}
          <tr>
            <td className="form-label">
              <Label htmlFor={showNewCategoryInput ? "newCategory" : "category"} className="text-sm font-medium">
                Category <span className="text-red-500">*</span>
              </Label>
            </td>
            <td className="form-input">
              {showNewCategoryInput ? (
                <Input
                  id="newCategory"
                  placeholder="Enter new category name"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className={errors.newCategory ? 'border-red-500' : ''}
                />
              ) : (
                <StandardDropdown
                  id="category"
                  options={categoryOptions}
                  value={category}
                  onChange={setCategory}
                  placeholder="Select a category"
                  error={errors.category}
                />
              )}
              {errors.category && !showNewCategoryInput && <p className="form-error">{errors.category}</p>}
              {errors.newCategory && showNewCategoryInput && <p className="form-error">{errors.newCategory}</p>}
            </td>
            <td className="form-info">
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={toggleNewCategory}
                className="text-xs text-blue-500 p-0 h-auto"
              >
                {showNewCategoryInput ? 'Use Existing' : 'Create New'}
              </Button>
            </td>
          </tr>

          {/* Functionality Type */}
          <tr>
            <td className="form-label">
              <Label htmlFor="functionalityType" className="text-sm font-medium">
                Functionality Type <span className="text-red-500">*</span>
              </Label>
            </td>
            <td className="form-input">
              <StandardDropdown
                id="functionalityType"
                options={functionalityTypeOptions}
                value={functionalityType}
                onChange={setFunctionalityType}
                placeholder="Select functionality type"
                error={errors.functionalityType}
              />
            </td>
            <td className="form-info">
              <span className="form-required">Required</span>
            </td>
          </tr>

          {/* Description */}
          <tr>
            <td className="form-label-top">
              <Label htmlFor="description" className="text-sm font-medium">
                Description
              </Label>
            </td>
            <td className="form-input-top">
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </td>
            <td className="form-info">
              <span className="form-optional">Optional</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Form Actions */}
      <div className="flex justify-end space-x-2 pt-4 mt-4 border-t border-gray-200">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {service ? 'Update Service' : 'Create Service'}
        </Button>
      </div>
    </form>
  );
}