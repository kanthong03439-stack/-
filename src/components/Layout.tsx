import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen,
  CalendarCheck, 
  Milk, 
  Smile, 
  GraduationCap, 
  Scale, 
  PiggyBank, 
  Home, 
  FileText, 
  Settings, 
  LogOut,
  Menu,
  X,
  ChevronRight
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const sidebarItems = [
  { name: 'แดชบอร์ด', icon: LayoutDashboard, path: '/' },
  { name: 'ข้อมูลนักเรียน', icon: Users, path: '/students' },
  { name: 'รายวิชาที่สอน', icon: BookOpen, path: '/subjects' },
  { name: 'เช็คชื่อ/เวลาเรียน', icon: CalendarCheck, path: '/attendance' },
  { name: 'บันทึกการดื่มนม', icon: Milk, path: '/milk' },
  { name: 'บันทึกการแปรงฟัน', icon: Smile, path: '/brushing' },
  { name: 'คะแนน/ผลการเรียน', icon: GraduationCap, path: '/grades' },
  { name: 'น้ำหนัก/ส่วนสูง', icon: Scale, path: '/health' },
  { name: 'บันทึกการออมทรัพย์', icon: PiggyBank, path: '/savings' },
  { name: 'บันทึกการเยี่ยมบ้าน', icon: Home, path: '/home-visit' },
  { name: 'ใบรับรอง/วุฒิบัตร', icon: FileText, path: '/certificates' },
  { name: 'ข้อมูลส่วนตัว', icon: Settings, path: '/profile' },
  { name: 'จัดการผู้ใช้งาน', icon: Settings, path: '/admin', adminOnly: true },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserProfile(docSnap.data() as UserProfile);
        }
      } else {
        setUserProfile(null);
        if (location.pathname !== '/login' && location.pathname !== '/register') {
          navigate('/login');
        }
      }
    });
    return () => unsubscribe();
  }, [navigate, location.pathname]);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  if (location.pathname === '/login' || location.pathname === '/register') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-white border-r border-slate-200 transition-all duration-300 ease-in-out flex flex-col z-50",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className={cn("flex items-center gap-3 overflow-hidden transition-all", isSidebarOpen ? "opacity-100" : "opacity-0 w-0")}>
            <img 
              src="https://img2.pic.in.th/431bc33de9bf7638e76042de58f2757f.png" 
              alt="Logo" 
              className="w-10 h-10 object-contain"
              referrerPolicy="no-referrer"
            />
            <span className="font-bold text-slate-800 whitespace-nowrap">ระบบงานธุรการ</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {sidebarItems.map((item) => {
            if (item.adminOnly && userProfile?.role !== 'admin') return null;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl transition-all group",
                  isActive 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <item.icon size={22} className={cn(isActive ? "text-white" : "text-slate-400 group-hover:text-blue-600")} />
                {isSidebarOpen && <span className="font-medium whitespace-nowrap">{item.name}</span>}
                {isActive && isSidebarOpen && <ChevronRight size={16} className="ml-auto" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 p-3 w-full rounded-xl text-red-600 hover:bg-red-50 transition-all",
              !isSidebarOpen && "justify-center"
            )}
          >
            <LogOut size={22} />
            {isSidebarOpen && <span className="font-medium">ออกจากระบบ</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <h1 className="text-xl font-bold text-slate-800">
            {sidebarItems.find(i => i.path === location.pathname)?.name || 'แดชบอร์ด'}
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-800">{userProfile?.displayName || 'ผู้ใช้งาน'}</p>
              <p className="text-xs text-slate-500 capitalize">{userProfile?.role || 'บทบาท'}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border-2 border-white shadow-sm">
              {userProfile?.displayName?.charAt(0) || 'U'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="h-10 bg-white border-t border-slate-200 flex items-center justify-center text-xs text-slate-400 shrink-0">
          Developed by KruKan | โรงเรียนบ้านแม่ตาวแพะ
        </footer>
      </main>
    </div>
  );
}
