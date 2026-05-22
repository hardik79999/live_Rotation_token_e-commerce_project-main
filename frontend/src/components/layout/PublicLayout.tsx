import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { BottomNav } from './BottomNav';

export function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <main className="flex-1 overflow-x-hidden has-bottom-nav">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
