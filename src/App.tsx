import React, { useState, useEffect } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate 
} from 'react-router-dom';
import Layout from './components/Layout';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import StudentManagement from './components/StudentManagement';
import SubjectManagement from './components/SubjectManagement';
import AttendanceSystem from './components/AttendanceSystem';
import GradeSystem from './components/GradeSystem';
import MilkBrushingSystem from './components/MilkBrushingSystem';
import AdminPanel from './components/AdminPanel';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from './types';

import HealthSystem from './components/HealthSystem';
import SavingsSystem from './components/SavingsSystem';
import HomeVisitSystem from './components/HomeVisitSystem';
import CertificateSystem from './components/CertificateSystem';
import Profile from './components/Profile';

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
          setProfile(docSnap.data() as UserProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
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
  }

  return (
    <Router>
      <Layout>
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
          <Route path="/profile" element={user ? <Profile /> : <Navigate to="/login" />} />
          <Route path="/admin" element={user && profile?.role === 'admin' ? <AdminPanel /> : <Navigate to="/" />} />
          
          {/* Fallback for other routes */}
          <Route path="*" element={<div className="p-12 text-center text-slate-400">ฟีเจอร์นี้กำลังอยู่ระหว่างการพัฒนา...</div>} />
        </Routes>
      </Layout>
    </Router>
  );
}
