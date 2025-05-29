// src/components/modules/global-config/tabs/locations-tab.tsx
"use client";

import { useState, useEffect } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { ActionDropdown } from "@/components/ui/action-dropdown";
import { useAuth } from "@/contexts/AuthContext";

// Define the Location type
type Location = {
  id: string;
  countryName: string;
  twoLetter: string;
  threeLetter: string;
  numeric: string;
  subregionI: string | null;
  subregionII: string | null;
  subregionIII: string | null;
};

// Form validation schema
const locationSchema = z.object({
  countryName: z.string().min(1, "Country name is required"),
  twoLetter: z.string().length(2, "Two letter code must be exactly 2 characters"),
  threeLetter: z.string().length(3, "Three letter code must be exactly 3 characters"),
  numeric: z.string().min(1, "Numeric code is required"),
  subregionI: z.string().optional(),
  subregionII: z.string().optional(),
  subregionIII: z.string().optional(),
});

type LocationFormValues = z.infer<typeof locationSchema>;

export function LocationsTab() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const { fetchWithAuth } = useAuth();

  // Initialize react-hook-form
  const { 
    register, 
    handleSubmit, 
    reset, 
    formState: { errors } 
  } = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
  });

  // Load locations when component mounts
  useEffect(() => {
    async function fetchLocations() {
      try {
        setIsLoading(true);
        console.log("Fetching locations...");
        
        const response = await fetchWithAuth("/api/locations");
        if (!response.ok) {
          throw new Error(`Failed to fetch locations: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        console.log(`Retrieved ${data.length} locations successfully`);
        setLocations(data);
      } catch (error) {
        console.error("Error fetching locations:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLocations();
  }, [fetchWithAuth]);

  // Handle form submission
  const onSubmit = async (data: LocationFormValues) => {
    try {
      let response;
      
      if (isEditing && currentLocation) {
        // Update existing location
        response = await fetchWithAuth(`/api/locations/${currentLocation.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });
      } else {
        // Create new location
        response = await fetchWithAuth("/api/locations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });
      }

      if (!response.ok) {
        throw new Error(`Failed to save location: ${response.status} ${response.statusText}`);
      }

      // Refresh locations
      const updatedResponse = await fetchWithAuth("/api/locations");
      if (updatedResponse.ok) {
        const updatedData = await updatedResponse.json();
        setLocations(updatedData);
      }

      // Reset form and editing state
      reset();
      setIsEditing(false);
      setCurrentLocation(null);
    } catch (error) {
      console.error("Error saving location:", error);
    }
  };

  // Handle edit button click
  const handleEdit = (location: Location) => {
    setIsEditing(true);
    setCurrentLocation(location);
    reset({
      countryName: location.countryName,
      twoLetter: location.twoLetter,
      threeLetter: location.threeLetter,
      numeric: location.numeric,
      subregionI: location.subregionI || "",
      subregionII: location.subregionII || "",
      subregionIII: location.subregionIII || "",
    });
  };

  // Handle delete button click
  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this location?")) {
      try {
        const response = await fetchWithAuth(`/api/locations/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error(`Failed to delete location: ${response.status} ${response.statusText}`);
        }

        // Remove the deleted location from state
        setLocations(locations.filter(location => location.id !== id));
      } catch (error) {
        console.error("Error deleting location:", error);
      }
    }
  };

  // Cancel editing
  const handleCancel = () => {
    setIsEditing(false);
    setCurrentLocation(null);
    reset();
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Locations</h2>
      
      {/* Location Form */}
      <Card className="p-6 mb-8">
        <h3 className="text-lg font-medium mb-4">
          {isEditing ? "Edit Location" : "Add Location"}
        </h3>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Country Name*
              </label>
              <Input
                {...register("countryName")}
                placeholder="Country Name"
                className={errors.countryName ? "border-red-500" : ""}
              />
              {errors.countryName && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.countryName.message}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Two Letter Code*
              </label>
              <Input
                {...register("twoLetter")}
                placeholder="US"
                maxLength={2}
                className={errors.twoLetter ? "border-red-500" : ""}
              />
              {errors.twoLetter && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.twoLetter.message}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Three Letter Code*
              </label>
              <Input
                {...register("threeLetter")}
                placeholder="USA"
                maxLength={3}
                className={errors.threeLetter ? "border-red-500" : ""}
              />
              {errors.threeLetter && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.threeLetter.message}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Numeric Code*
              </label>
              <Input
                {...register("numeric")}
                placeholder="840"
                className={errors.numeric ? "border-red-500" : ""}
              />
              {errors.numeric && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.numeric.message}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Subregion I
              </label>
              <Input
                {...register("subregionI")}
                placeholder="State/Province"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Subregion II
              </label>
              <Input
                {...register("subregionII")}
                placeholder="County"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Subregion III
              </label>
              <Input
                {...register("subregionIII")}
                placeholder="City"
              />
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Button type="submit">
              {isEditing ? "Update Location" : "Add Location"}
            </Button>
            {isEditing && (
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>
      
      {/* Locations Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Country Name</TableHead>
            <TableHead>2-Letter</TableHead>
            <TableHead>3-Letter</TableHead>
            <TableHead>Numeric</TableHead>
            <TableHead>Subregion I</TableHead>
            <TableHead>Subregion II</TableHead>
            <TableHead>Subregion III</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-4">
                Loading locations...
              </TableCell>
            </TableRow>
          ) : locations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-4">
                No locations found. Add a location using the form above.
              </TableCell>
            </TableRow>
          ) : (
            locations.map((location) => {
              // Define actions for this location
              const actionOptions = [
                {
                  label: "Edit",
                  onClick: () => handleEdit(location),
                  color: "rgb(37, 99, 235)" // Blue color
                },
                {
                  label: "Delete",
                  onClick: () => handleDelete(location.id),
                  color: "rgb(220, 38, 38)" // Red color
                }
              ];
              
              return (
                <TableRow key={location.id}>
                  <TableCell>{location.countryName}</TableCell>
                  <TableCell>{location.twoLetter}</TableCell>
                  <TableCell>{location.threeLetter}</TableCell>
                  <TableCell>{location.numeric}</TableCell>
                  <TableCell>{location.subregionI || "-"}</TableCell>
                  <TableCell>{location.subregionII || "-"}</TableCell>
                  <TableCell>{location.subregionIII || "-"}</TableCell>
                  <TableCell className="text-sm font-medium text-center">
                    <ActionDropdown options={actionOptions} />
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}