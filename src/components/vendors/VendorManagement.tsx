// /GlobalRX_v2/src/components/vendors/VendorManagement.tsx
"use client";

import { useState, useEffect } from "react";
import { useVendorManagement } from "@/hooks/useVendorManagement";
import { VendorForm } from "@/components/vendors/VendorForm";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash, CheckCircle, XCircle } from "lucide-react";
import type { VendorOrganization } from "@/lib/schemas/vendorSchemas";

export function VendorManagement() {
  const { vendors, loading, error, fetchVendors, deleteVendor } = useVendorManagement();
  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorOrganization | null>(null);

  useEffect(() => {
    fetchVendors();
  }, []);

  const handleEdit = (vendor: VendorOrganization) => {
    setEditingVendor(vendor);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this vendor?")) {
      await deleteVendor(id);
      fetchVendors();
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingVendor(null);
    fetchVendors();
  };

  if (loading) return <div>Loading vendors...</div>;
  if (error) return <div className="text-red-600">Error: {error}</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Vendor Management</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Vendor
        </Button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 border rounded-lg">
          <VendorForm
            mode={editingVendor ? 'edit' : 'create'}
            vendor={editingVendor}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setShowForm(false);
              setEditingVendor(null);
            }}
          />
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Primary
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {vendors.map((vendor) => (
              <tr key={vendor.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {vendor.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {vendor.contactEmail}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {vendor.isActive ? (
                    <span className="flex items-center text-green-600">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center text-gray-400">
                      <XCircle className="w-4 h-4 mr-1" />
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {vendor.isPrimary && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Primary
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleEdit(vendor)}
                    className="text-indigo-600 hover:text-indigo-900 mr-3"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(vendor.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}