'use client';

import Link from 'next/link';
import { useState, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { signOut } from '@/app/(login)/actions';
import { useRouter } from 'next/navigation';
import { User as UserType } from '@/lib/db/schema';
import useSWR, { mutate } from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function UserMenu() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: user } = useSWR<UserType>('/api/user', fetcher);
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    mutate('/api/user');
    router.push('/sign-in');
  }

  if (!user) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/sign-in">Connexion</Link>
      </Button>
    );
  }

  const initials = (user.name || user.email || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Menu utilisateur"
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
        >
          <Avatar className="cursor-pointer size-8 bg-muted">
            <AvatarFallback className="text-xs font-medium text-muted-foreground bg-muted">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5 border-b border-border mb-1">
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/dashboard/general" className="flex items-center">
            <User className="mr-2 h-4 w-4" />
            <span>Mon compte</span>
          </Link>
        </DropdownMenuItem>
        <form action={handleSignOut} className="w-full">
          <button type="submit" className="w-full">
            <DropdownMenuItem className="w-full cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Se déconnecter</span>
            </DropdownMenuItem>
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Header() {
  return (
    <header className="h-14 border-b border-border bg-surface flex items-center">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <Link
          href="/dashboard"
          className="text-lg font-semibold tracking-tight text-foreground hover:text-muted-foreground transition-colors"
        >
          Soleo
        </Link>
        <div className="flex items-center">
          <Suspense fallback={<div className="h-8 w-8 rounded-full bg-muted animate-pulse" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col min-h-screen bg-background">
      <Header />
      {children}
    </section>
  );
}
