'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FolderOpen, Settings, Shield, Menu } from 'lucide-react';

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navItems = [
    { href: '/dashboard', icon: FolderOpen, label: 'Projets' },
    { href: '/dashboard/general', icon: Settings, label: 'Compte' },
    { href: '/dashboard/security', icon: Shield, label: 'Sécurité' },
  ];

  // Active si le pathname correspond exactement ou commence par le href (sauf /dashboard exact)
  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname.startsWith('/dashboard/projects');
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-56px)] max-w-7xl mx-auto w-full">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between bg-surface border-b border-border p-4">
        <span className="font-medium text-foreground text-sm">Menu</span>
        <Button
          className="-mr-3"
          variant="ghost"
          size="sm"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Ouvrir le menu</span>
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden h-full">
        {/* Sidebar */}
        <aside
          className={`w-56 bg-background border-r border-border lg:block ${
            isSidebarOpen ? 'block' : 'hidden'
          } lg:relative absolute inset-y-0 left-0 z-40 transition-transform duration-200`}
        >
          <nav className="h-full overflow-y-auto p-3 space-y-0.5">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} passHref>
                <Button
                  variant="ghost"
                  className={`w-full justify-start gap-2.5 text-sm font-normal h-9 ${
                    isActive(item.href)
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
