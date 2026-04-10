import React, { useState, useEffect, lazy, Suspense } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate 
} from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { UserProfile } from './types';
import { AcademicYearProvider } from './contexts/AcademicYearContext';

// Lazy load components
const Login = lazy(() => import('./components/Login'));
const Register = lazy(() => import('./components/Register'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const StudentManagement = lazy(() => import('./components/StudentManagement'));
const SubjectManagement = lazy(() => import('./components/SubjectManagement'));
const AttendanceSystem = lazy(() => import('./components/AttendanceSystem'));
const GradeSystem = lazy(() => import('./components/GradeSystem'));
const MilkBrushingSystem = lazy(() => import('./components/MilkBrushingSystem'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const HealthSystem = lazy(() => import('./components/HealthSystem'));
const SavingsSystem = lazy(() => import('./components/SavingsSystem'));
const HomeVisitSystem = lazy(() => import('./components/HomeVisitSystem'));
const CertificateSystem = lazy(() => import('./components/CertificateSystem'));
const TeacherDocuments = lazy(() => import('./components/TeacherDocuments'));
const TeacherHandbook = lazy(() => import('./components/TeacherHandbook'));
const TeacherCalendar = lazy(() => import('./components/TeacherCalendar'));
const AIAssistant = lazy(() => import('./components/AIAssistant'));
const Profile = lazy(() => import('./components/Profile'));

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="flex flex-col items-center gap-4">
      <img 
        src="https://img2.pic.in.th/431bc33de9bf7638e76042de58f2757f.png" 
        alt="Logo" 
        className="w-20 h-20 animate-pulse object-contain"
        referrerPolicy="no-referrer"
      />
      <p className="text-slate-400 font-medium animate-pulse">กำลังโหลดระบบ...</p>
    </div>
  </div>
);

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user);
      if (user) {
        const docSnap = await getDoc(doc(db, 'users', user.uid));
        if (docSnap.exists()) {
          const profileData = docSnap.data() as UserProfile;
          if (!profileData.isApproved && profileData.role !== 'admin') {
            await signOut(auth);
            setProfile(null);
          } else {
            setProfile(profileData);
          }
        } else {
          // Profile deleted by admin - force sign out
          await signOut(auth);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <AcademicYearProvider>
      <Router>
        <Toaster position="top-center" />
        <Layout>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
              <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
              
              <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" />} />
              <Route path="/students" element={user ? <StudentManagement /> : <Navigate to="/login" />} />
              <Route path="/subjects" element={user ? <SubjectManagement /> : <Navigate to="/login" />} />
              <Route path="/attendance" element={user ? <AttendanceSystem /> : <Navigate to="/login" />} />
              <Route path="/grades" element={user ? <GradeSystem /> : <Navigate to="/login" />} />
              <Route path="/milk" element={user ? <MilkBrushingSystem /> : <Navigate to="/login" />} />
              <Route path="/brushing" element={user ? <MilkBrushingSystem /> : <Navigate to="/login" />} />
              <Route path="/health" element={user ? <HealthSystem /> : <Navigate to="/login" />} />
              <Route path="/savings" element={user ? <SavingsSystem /> : <Navigate to="/login" />} />
              <Route path="/home-visit" element={user ? <HomeVisitSystem /> : <Navigate to="/login" />} />
              <Route path="/certificates" element={user ? <CertificateSystem /> : <Navigate to="/login" />} />
              <Route path="/teacher-documents" element={user ? <TeacherDocuments /> : <Navigate to="/login" />} />
              <Route path="/teacher-handbook" element={user ? <TeacherHandbook /> : <Navigate to="/login" />} />
              <Route path="/calendar" element={user ? <TeacherCalendar /> : <Navigate to="/login" />} />
              <Route path="/ai-assistant" element={user ? <AIAssistant /> : <Navigate to="/login" />} />
              <Route path="/profile" element={user ? <Profile /> : <Navigate to="/login" />} />
              <Route path="/admin" element={user && profile?.role === 'admin' ? <AdminPanel /> : <Navigate to="/" />} />
              
              {/* Fallback for other routes */}
              <Route path="*" element={<div className="p-12 text-center text-slate-400">ฟีเจอร์นี้กำลังอยู่ระหว่างการพัฒนา...</div>} />
            </Routes>
          </Suspense>
        </Layout>
      </Router>
    </AcademicYearProvider>
  );
}
