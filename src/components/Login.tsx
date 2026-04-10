import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { LogIn, UserPlus, Mail, Lock, User, School } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();
      
      let loginEmail = trimmedEmail;
      let loginPassword = trimmedPassword;
      
      // Check if input is a 4-digit student ID
      if (/^\d{4}$/.test(trimmedEmail)) {
        loginEmail = `${trimmedEmail}@student.school`;
      }

      const isAdminEmail = trimmedEmail === 'admin' || 
                           trimmedEmail === 'kanthong.03439@gmail.com' ||
                           trimmedEmail === 'kanthong.8426@gmail.com';

      if (isAdminEmail) {
        // Map 'admin' username to the new primary admin email
        loginEmail = trimmedEmail === 'admin' ? 'kanthong.8426@gmail.com' : trimmedEmail;
      }

      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      } catch (err: any) {
        // Handle admin bootstrap if login fails (user not found)
        if (isAdminEmail && err.code === 'auth/invalid-credential') {
          try {
            // Try to create the user if they don't exist
            userCredential = await createUserWithEmailAndPassword(auth, loginEmail, loginPassword);
            await updateProfile(userCredential.user, { displayName: 'Admin' });
          } catch (createErr: any) {
            // If user already exists but password was wrong, we get 'auth/email-already-in-use'
            if (createErr.code === 'auth/email-already-in-use') {
              setError('⚠️ รหัสผ่านไม่ถูกต้องสำหรับบัญชีผู้ดูแลระบบนี้');
              setLoading(false);
              return;
            }
            throw err;
          }
        } else {
          throw err;
        }
      }

      if (!userCredential) throw new Error('Login failed');

      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (!userDoc.exists()) {
        if (isAdminEmail) {
          // Bootstrap admin if document is missing
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            uid: userCredential.user.uid,
            email: loginEmail,
            displayName: 'Admin',
            role: 'admin',
            isApproved: true,
            createdAt: new Date().toISOString()
          });
        } else {
          // If user exists in Auth but not in Firestore (deleted by admin but Auth deletion failed)
          setError('⚠️ บัญชีของคุณถูกลบออกจากระบบแล้ว ไม่สามารถเข้าสู่ระบบด้วยบัญชีนี้ได้อีก กรุณาสมัครสมาชิกใหม่');
          await auth.signOut();
          setLoading(false);
          return;
        }
      } else {
        const userData = userDoc.data();
        
        // Ensure admin status for designated emails
        if (isAdminEmail && userData.role !== 'admin') {
          await updateDoc(doc(db, 'users', userCredential.user.uid), { 
            role: 'admin', 
            isApproved: true 
          });
        }
        
        // Block non-approved users
        if (userData.role !== 'admin' && !userData.isApproved) {
          setError('⚠️ บัญชีของคุณยังไม่ได้รับการอนุมัติจากผู้ดูแลระบบ กรุณาติดต่อผู้ดูแลระบบเพื่อแจ้งความประสงค์ในการเข้าใช้งาน');
          await auth.signOut();
          setLoading(false);
          return;
        }
      }
      navigate('/');
    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.code === 'auth/invalid-credential') {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง (หากยังไม่มีบัญชี กรุณาลงทะเบียนใหม่)');
      } else {
        setError(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('กรุณากรอกอีเมลเพื่อรีเซ็ตรหัสผ่าน');
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage('ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลของคุณแล้ว กรุณาตรวจสอบกล่องจดหมาย');
      setShowResetForm(false);
    } catch (err: any) {
      console.error("Reset Error:", err);
      if (err.code === 'auth/user-not-found') {
        setError('ไม่พบอีเมลนี้ในระบบ');
      } else {
        setError('ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้ กรุณาตรวจสอบอีเมลอีกครั้ง');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Background Image with Blur */}
      <img 
        src="https://img1.pic.in.th/images/-1b9f5f48995a38121.jpg"
        alt="School Background"
        className="absolute inset-0 z-0 w-full h-full object-cover"
        style={{
          filter: 'blur(5px)',
          transform: 'scale(1.1)' // Prevent white edges from blur
        }}
        referrerPolicy="no-referrer"
      />
      {/* Overlay to ensure readability */}
      <div className="absolute inset-0 z-0 bg-blue-900/50" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative z-10"
      >
        <div className="p-8 text-center bg-slate-50 border-b border-slate-100">
          <img 
            src="https://img2.pic.in.th/431bc33de9bf7638e76042de58f2757f.png" 
            alt="Logo" 
            className="w-20 h-20 mx-auto mb-4 object-contain"
            referrerPolicy="no-referrer"
          />
          <h1 className="text-2xl font-bold text-slate-800">
            {showResetForm ? 'รีเซ็ตรหัสผ่าน' : 'ระบบงานธุรการชั้นเรียน'}
          </h1>
          <p className="text-slate-500 mt-1">
            {showResetForm ? 'กรุณากรอกอีเมลที่ลงทะเบียนไว้' : 'โรงเรียนบ้านแม่ตาวแพะ | Banmaetaophae School'}
          </p>
        </div>

        <form onSubmit={showResetForm ? handleResetPassword : handleLogin} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-green-50 text-green-600 p-3 rounded-xl text-sm font-medium border border-green-100">
              {message}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">
              {showResetForm ? 'อีเมล' : 'อีเมล / เลขประจำตัวนักเรียน'}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder={showResetForm ? "example@email.com" : "อีเมล หรือ เลขประจำตัว 4 หลัก"}
                required
              />
            </div>
          </div>

          {!showResetForm && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-slate-700">รหัสผ่าน</label>
                <button 
                  type="button"
                  onClick={() => {
                    setShowResetForm(true);
                    setError('');
                    setMessage('');
                  }}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  ลืมรหัสผ่าน?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (showResetForm ? 'กำลังส่ง...' : 'กำลังเข้าสู่ระบบ...') : (
              <>
                {showResetForm ? <Mail size={20} /> : <LogIn size={20} />}
                {showResetForm ? 'ส่งลิงก์รีเซ็ตรหัสผ่าน' : 'เข้าสู่ระบบ'}
              </>
            )}
          </button>

          <div className="text-center space-y-4">
            {showResetForm ? (
              <button 
                type="button"
                onClick={() => {
                  setShowResetForm(false);
                  setError('');
                  setMessage('');
                }}
                className="text-sm text-slate-500 hover:text-blue-600 font-medium"
              >
                กลับไปหน้าเข้าสู่ระบบ
              </button>
            ) : (
              <p className="text-sm text-slate-500">
                ยังไม่มีบัญชี? <Link to="/register" className="text-blue-600 font-bold hover:underline">ลงทะเบียนใหม่</Link>
              </p>
            )}
            <div className="pt-4 border-t border-slate-100 text-[10px] text-slate-400 uppercase tracking-widest">
              &copy; Copyright {new Date().getFullYear() > 2026 ? `2026 - ${new Date().getFullYear()}` : '2026'} Developed by KruKan
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
