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
  ChevronRight,
  FolderOpen,
  User,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const sidebarItems = [
  { name: 'แดชบอร์ด', icon: LayoutDashboard, path: '/' },
  { name: 'ข้อมูลนักเรียน', icon: Users, path: '/students', teacherOnly: true },
  { name: 'รายวิชาที่เรียน', icon: BookOpen, path: '/subjects' },
  { name: 'เช็คชื่อ/เวลาเรียน', icon: CalendarCheck, path: '/attendance' },
  { name: 'บันทึกดื่มนม/แปรงฟัน', icon: Milk, path: '/milk', teacherOnly: true },
  { name: 'คะแนน/ผลการเรียน', icon: GraduationCap, path: '/grades' },
  { name: 'น้ำหนัก/ส่วนสูง', icon: Scale, path: '/health', teacherOnly: true },
  { name: 'บันทึกการออมทรัพย์', icon: PiggyBank, path: '/savings', teacherOnly: true },
  { name: 'บันทึกการเยี่ยมบ้าน', icon: Home, path: '/home-visit', teacherOnly: true },
  { name: 'ใบรับรอง/วุฒิบัตร', icon: FileText, path: '/certificates', teacherOnly: true },
  { name: 'เอกสารครู', icon: FolderOpen, path: '/teacher-documents', teacherOnly: true },
  { name: 'เว็บไซต์สำหรับครู', icon: ExternalLink, path: '/teacher-handbook', teacherOnly: true },
  { name: 'ปฏิทินงาน', icon: CalendarCheck, path: '/calendar', teacherOnly: true },
  { name: 'AI ผู้ช่วยครู', icon: Sparkles, path: '/ai-assistant', teacherOnly: true },
  { name: 'จัดการผู้ใช้งาน', icon: Settings, path: '/admin', adminOnly: true },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [unapprovedCount, setUnapprovedCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      const q = query(collection(db, 'users'), where('isApproved', '==', false));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setUnapprovedCount(snapshot.size);
      }, (error) => {
        console.error("Error listening to unapproved users:", error);
      });
      return () => unsubscribe();
    }
  }, [userProfile]);

  const filteredSidebarItems = sidebarItems.filter(item => {
    if (item.adminOnly && userProfile?.role !== 'admin') return false;
    if (item.teacherOnly && userProfile?.role === 'student') return false;
    
    // Hide specific tabs for students
    if (userProfile?.role === 'student') {
      if (['/subjects', '/attendance', '/grades'].includes(item.path)) {
        return false;
      }
    }
    
    return true;
  }).map(item => {
    return item;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatThaiDateTime = (date: Date) => {
    const thaiDays = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
    const thaiMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const dayOfWeek = thaiDays[date.getDay()];
    const day = date.getDate();
    const month = thaiMonths[date.getMonth()];
    const year = date.getFullYear() + 543;
    const time = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${dayOfWeek} ที่ ${day} ${month} ${year} | ${time} น.`;
  };

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
          {filteredSidebarItems.map((item) => {
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
                {item.path === '/admin' && unapprovedCount > 0 && (
                  <span className={cn(
                    "ml-auto flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full",
                    isSidebarOpen ? "w-5 h-5" : "w-2 h-2 absolute top-2 right-2"
                  )}>
                    {isSidebarOpen ? unapprovedCount : ''}
                  </span>
                )}
                {isActive && isSidebarOpen && <ChevronRight size={16} className="ml-auto" />}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <h1 className="text-xl font-bold text-slate-800">
            {sidebarItems.find(i => i.path === location.pathname)?.name || 'แดชบอร์ด'}
          </h1>
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden md:flex items-center text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100 shadow-sm">
              <span className="text-sm font-medium tracking-wide">{formatThaiDateTime(currentTime)}</span>
            </div>
            <div className="flex items-center gap-4 md:border-l md:border-slate-200 md:pl-6 relative">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-800">{userProfile?.displayName || 'ผู้ใช้งาน'}</p>
                <p className="text-xs text-slate-500 capitalize">{userProfile?.role || 'บทบาท'}</p>
              </div>
              
              <div 
                className="relative"
                onMouseEnter={() => setIsProfileOpen(true)}
                onMouseLeave={() => setIsProfileOpen(false)}
              >
                <button 
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border-2 border-white shadow-sm hover:ring-2 hover:ring-blue-500 transition-all overflow-hidden"
                >
                  {userProfile?.signatureUrl ? (
                    <img src={userProfile.signatureUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    userProfile?.displayName?.charAt(0) || 'U'
                  )}
                </button>

                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-[100] overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-slate-50 md:hidden">
                        <p className="text-sm font-bold text-slate-800">{userProfile?.displayName || 'ผู้ใช้งาน'}</p>
                        <p className="text-xs text-slate-500 capitalize">{userProfile?.role || 'บทบาท'}</p>
                      </div>
                      
                      <Link 
                        to="/profile"
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-all"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                          <User size={18} />
                        </div>
                        <span className="font-medium">แก้ไขข้อมูลส่วนตัว</span>
                      </Link>
                      
                      <button 
                        onClick={() => {
                          setIsProfileOpen(false);
                          handleLogout();
                        }}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-all w-full text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
                          <LogOut size={18} />
                        </div>
                        <span className="font-medium">ออกจากระบบ</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
          &copy; Copyright {new Date().getFullYear() > 2026 ? `2026 - ${new Date().getFullYear()}` : '2026'} Developed by KruKan | โรงเรียนบ้านแม่ตาวแพะ | เวอร์ชั่นล่าสุด (v1.0.1)
        </footer>
      </main>
    </div>
  );
}
