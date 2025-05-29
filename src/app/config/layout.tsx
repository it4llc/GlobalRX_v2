// src/app/config/layout.tsx
import NavLayout from '../nav-layout';

export default function ConfigLayout({
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