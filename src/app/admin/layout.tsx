// src/app/admin/layout.tsx
import NavLayout from '../nav-layout';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NavLayout>
      {children}
    </NavLayout>
  );
}