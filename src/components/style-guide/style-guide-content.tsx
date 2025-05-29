// src/components/style-guide/style-guide-content.tsx
'use client';

import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ColorCard } from "./color-card";

export function StyleGuideContent() {
  return (
    <Tabs defaultValue="colors">
      <TabsList className="grid w-full grid-cols-5 mb-8">
        <TabsTrigger value="colors">Colors</TabsTrigger>
        <TabsTrigger value="typography">Typography</TabsTrigger>
        <TabsTrigger value="components">Components</TabsTrigger>
        <TabsTrigger value="forms">Forms</TabsTrigger>
        <TabsTrigger value="tables">Tables</TabsTrigger>
      </TabsList>

      {/* Colors Section */}
      <TabsContent value="colors" className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">Color Palette</h2>
          <p className="text-gray-600 mb-6">
            Click on any color to copy its HEX value to clipboard. The GlobalRx application uses a consistent color palette to ensure visual harmony across all interfaces.
          </p>
          
          {/* Primary Colors */}
          <div className="space-y-6">
            <h3 className="text-lg font-medium border-b pb-2">Primary Colors</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ColorCard name="Primary" hex="#3b82f6" bg="bg-blue-500" text="text-white" />
              <ColorCard name="Primary Dark" hex="#2563eb" bg="bg-blue-600" text="text-white" />
              <ColorCard name="Primary Darker" hex="#1d4ed8" bg="bg-blue-700" text="text-white" />
            </div>
          </div>
          
          {/* Neutral Colors */}
          <div className="space-y-6 pt-10">
            <h3 className="text-lg font-medium border-b pb-2">Neutral Colors</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <ColorCard name="Black" hex="#020617" bg="bg-slate-950" text="text-white" />
              <ColorCard name="Dark Gray" hex="#1e293b" bg="bg-slate-800" text="text-white" />
              <ColorCard name="Gray" hex="#64748b" bg="bg-slate-500" text="text-white" />
              <ColorCard name="Light Gray" hex="#cbd5e1" bg="bg-slate-300" text="text-slate-900" />
              <ColorCard name="White" hex="#f8fafc" bg="bg-slate-50" text="text-slate-900" border="border border-slate-200" />
            </div>
          </div>
          
          {/* Status Colors */}
          <div className="space-y-6 pt-10">
            <h3 className="text-lg font-medium border-b pb-2">Status Colors</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <ColorCard name="Success" hex="#16a34a" bg="bg-green-600" text="text-white" />
              <ColorCard name="Warning" hex="#ca8a04" bg="bg-yellow-600" text="text-white" />
              <ColorCard name="Error" hex="#dc2626" bg="bg-red-600" text="text-white" />
              <ColorCard name="Info" hex="#0284c7" bg="bg-sky-600" text="text-white" />
            </div>
          </div>
          
          {/* Extended Blues */}
          <div className="space-y-6 pt-10">
            <h3 className="text-lg font-medium border-b pb-2">Blue Shades</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <ColorCard name="Blue 100" hex="#dbeafe" bg="bg-blue-100" text="text-slate-900" />
              <ColorCard name="Blue 200" hex="#bfdbfe" bg="bg-blue-200" text="text-slate-900" />
              <ColorCard name="Blue 300" hex="#93c5fd" bg="bg-blue-300" text="text-slate-900" />
              <ColorCard name="Blue 400" hex="#60a5fa" bg="bg-blue-400" text="text-white" />
              <ColorCard name="Blue 500" hex="#3b82f6" bg="bg-blue-500" text="text-white" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mt-6">
              <ColorCard name="Blue 600" hex="#2563eb" bg="bg-blue-600" text="text-white" />
              <ColorCard name="Blue 700" hex="#1d4ed8" bg="bg-blue-700" text="text-white" />
              <ColorCard name="Blue 800" hex="#1e40af" bg="bg-blue-800" text="text-white" />
              <ColorCard name="Blue 900" hex="#1e3a8a" bg="bg-blue-900" text="text-white" />
              <ColorCard name="Blue 950" hex="#172554" bg="bg-blue-950" text="text-white" />
            </div>
          </div>

          {/* Gray Shades */}
          <div className="space-y-6 pt-10">
            <h3 className="text-lg font-medium border-b pb-2">Gray Shades</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <ColorCard name="Slate 100" hex="#f1f5f9" bg="bg-slate-100" text="text-slate-900" />
              <ColorCard name="Slate 200" hex="#e2e8f0" bg="bg-slate-200" text="text-slate-900" />
              <ColorCard name="Slate 300" hex="#cbd5e1" bg="bg-slate-300" text="text-slate-900" />
              <ColorCard name="Slate 400" hex="#94a3b8" bg="bg-slate-400" text="text-white" />
              <ColorCard name="Slate 500" hex="#64748b" bg="bg-slate-500" text="text-white" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mt-6">
              <ColorCard name="Slate 600" hex="#475569" bg="bg-slate-600" text="text-white" />
              <ColorCard name="Slate 700" hex="#334155" bg="bg-slate-700" text="text-white" />
              <ColorCard name="Slate 800" hex="#1e293b" bg="bg-slate-800" text="text-white" />
              <ColorCard name="Slate 900" hex="#0f172a" bg="bg-slate-900" text="text-white" />
              <ColorCard name="Slate 950" hex="#020617" bg="bg-slate-950" text="text-white" />
            </div>
          </div>
        </section>
      </TabsContent>

      {/* Typography Section */}
      <TabsContent value="typography" className="space-y-6">
        <h2 className="text-2xl font-semibold mb-4">Typography</h2>
        
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Heading 1</h1>
            <p className="text-gray-500">Font size: 2.25rem (36px), Font weight: 700</p>
          </div>
          
          <div>
            <h2 className="text-3xl font-bold mb-2">Heading 2</h2>
            <p className="text-gray-500">Font size: 1.875rem (30px), Font weight: 700</p>
          </div>
          
          <div>
            <h3 className="text-2xl font-semibold mb-2">Heading 3</h3>
            <p className="text-gray-500">Font size: 1.5rem (24px), Font weight: 600</p>
          </div>
          
          <div>
            <h4 className="text-xl font-semibold mb-2">Heading 4</h4>
            <p className="text-gray-500">Font size: 1.25rem (20px), Font weight: 600</p>
          </div>
          
          <div>
            <h5 className="text-lg font-medium mb-2">Heading 5</h5>
            <p className="text-gray-500">Font size: 1.125rem (18px), Font weight: 500</p>
          </div>
          
          <div>
            <p className="text-base mb-2">Body Text (Regular)</p>
            <p className="text-gray-500">Font size: 1rem (16px), Font weight: 400</p>
          </div>
          
          <div>
            <p className="text-sm mb-2">Small Text</p>
            <p className="text-gray-500">Font size: 0.875rem (14px), Font weight: 400</p>
          </div>
          
          <div>
            <p className="text-xs mb-2">Extra Small Text</p>
            <p className="text-gray-500">Font size: 0.75rem (12px), Font weight: 400</p>
          </div>
        </div>
      </TabsContent>

      {/* Components Section */}
      <TabsContent value="components" className="space-y-6">
        <h2 className="text-2xl font-semibold mb-4">Components</h2>
        
        {/* Buttons */}
        <section className="space-y-4">
          <h3 className="text-lg font-medium">Buttons</h3>
          <div className="flex flex-wrap gap-4">
            <Button variant="default">Primary Button</Button>
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="outline">Outline Button</Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="link">Link Button</Button>
            <Button variant="destructive">Destructive Button</Button>
          </div>
          
          <h4 className="text-md font-medium mt-6">Button Sizes</h4>
          <div className="flex flex-wrap gap-4 items-center">
            <Button size="sm">Small Button</Button>
            <Button size="default">Default Button</Button>
            <Button size="lg">Large Button</Button>
          </div>
          
          <h4 className="text-md font-medium mt-6">Button States</h4>
          <div className="flex flex-wrap gap-4">
            <Button>Default</Button>
            <Button disabled>Disabled</Button>
            <Button variant="outline" className="bg-slate-100">Hover (Simulated)</Button>
            <Button className="ring-2 ring-black ring-offset-2">Focus (Simulated)</Button>
          </div>
        </section>
        
        {/* Cards */}
        <section className="space-y-4 pt-8">
          <h3 className="text-lg font-medium">Cards</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Card Title</CardTitle>
                <CardDescription>Card description text goes here</CardDescription>
              </CardHeader>
              <CardContent>
                <p>This is the main content of the card. It can contain any elements.</p>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="ghost">Cancel</Button>
                <Button>Submit</Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Simple Card</CardTitle>
              </CardHeader>
              <CardContent>
                <p>A minimal card with just content and no footer actions.</p>
              </CardContent>
            </Card>
          </div>
        </section>
        
        {/* Dialog */}
        <section className="space-y-4 pt-8">
          <h3 className="text-lg font-medium">Dialog</h3>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button>Open Dialog</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your account
                  and remove your data from our servers.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction>Continue</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </TabsContent>

      {/* Forms Section */}
      <TabsContent value="forms" className="space-y-6">
        <h2 className="text-2xl font-semibold mb-4">Form Elements</h2>
        
        {/* Text Input */}
        <section className="space-y-4">
          <h3 className="text-lg font-medium">Text Inputs</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="default-input">Default Input</Label>
              <Input id="default-input" placeholder="Enter some text" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="disabled-input">Disabled Input</Label>
              <Input id="disabled-input" placeholder="Disabled input" disabled />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="with-icon" className="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                Input with Icon
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                </div>
                <Input id="with-icon" className="pl-10" placeholder="Message" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="error-input">Input with Error</Label>
              <Input id="error-input" placeholder="Error state" className="border-red-500 focus-visible:ring-red-500" />
              <p className="text-sm text-red-500">This field is required</p>
            </div>
          </div>
        </section>
        
        {/* Select Dropdown */}
        <section className="space-y-4 pt-8">
          <h3 className="text-lg font-medium">Dropdown Select</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="country-select">Select a Country</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="us">United States</SelectItem>
                  <SelectItem value="ca">Canada</SelectItem>
                  <SelectItem value="mx">Mexico</SelectItem>
                  <SelectItem value="uk">United Kingdom</SelectItem>
                  <SelectItem value="fr">France</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="disabled-select">Disabled Select</Label>
              <Select disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Disabled select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="option">Option</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>
        
        {/* Checkbox */}
        <section className="space-y-4 pt-8">
          <h3 className="text-lg font-medium">Checkboxes</h3>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="terms" />
              <Label htmlFor="terms">Accept terms and conditions</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox id="disabled-checkbox" disabled />
              <Label htmlFor="disabled-checkbox" className="text-gray-400">Disabled checkbox</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox id="checked-checkbox" defaultChecked />
              <Label htmlFor="checked-checkbox">Checked by default</Label>
            </div>
          </div>
        </section>
      </TabsContent>

      {/* Tables Section */}
      <TabsContent value="tables" className="space-y-6">
        <h2 className="text-2xl font-semibold mb-4">Tables</h2>
        
        <section>
          <h3 className="text-lg font-medium mb-4">Standard Table</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">001</TableCell>
                  <TableCell>John Doe</TableCell>
                  <TableCell>john.doe@example.com</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Edit</Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">002</TableCell>
                  <TableCell>Jane Smith</TableCell>
                  <TableCell>jane.smith@example.com</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Edit</Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">003</TableCell>
                  <TableCell>Bob Johnson</TableCell>
                  <TableCell>bob.johnson@example.com</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Edit</Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>
        
        <section className="pt-8">
          <h3 className="text-lg font-medium mb-4">Compact Table</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Code</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">US</TableCell>
                  <TableCell>United States</TableCell>
                  <TableCell>North America</TableCell>
                  <TableCell className="text-right">
                    <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">Active</span>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">CA</TableCell>
                  <TableCell>Canada</TableCell>
                  <TableCell>North America</TableCell>
                  <TableCell className="text-right">
                    <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">Active</span>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">UK</TableCell>
                  <TableCell>United Kingdom</TableCell>
                  <TableCell>Europe</TableCell>
                  <TableCell className="text-right">
                    <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">Pending</span>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">DE</TableCell>
                  <TableCell>Germany</TableCell>
                  <TableCell>Europe</TableCell>
                  <TableCell className="text-right">
                    <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">Inactive</span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>
      </TabsContent>
    </Tabs>
  );
}