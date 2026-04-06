import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { LogIn, UserPlus, Mail, Lock, User, School } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();
      
      let loginEmail = trimmedEmail;
      let loginPassword = trimmedPassword;
      
      const isAdminCredentials = (trimmedEmail === 'admin' && trimmedPassword === 'kan0988034275') || 
                                (trimmedEmail === 'kanthong.03439@gmail.com' && trimmedPassword === 'kan0988034275') ||
                                (trimmedEmail === 'kanthong.8426@gmail.com' && trimmedPassword === 'kan0988034275');

      if (isAdminCredentials) {
        // Map 'admin' username to the new primary admin email
        loginEmail = trimmedEmail === 'admin' ? 'kanthong.8426@gmail.com' : trimmedEmail;
        loginPassword = trimmedPassword;
      }

      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      } catch (err: any) {
        // Handle admin bootstrap if login fails
        if (isAdminCredentials) {
          try {
            // Try to create the user if they don't exist
            userCredential = await createUserWithEmailAndPassword(auth, loginEmail, loginPassword);
            await updateProfile(userCredential.user, { displayName: 'Admin' });
          } catch (createErr: any) {
            // If user already exists but password was wrong, we get 'auth/email-already-in-use'
            // but since we are in the catch block of signIn, it means the password was indeed wrong
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
        if (isAdminCredentials) {
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
          // RE-REGISTRATION LOGIC: 
          // If user exists in Auth but not in Firestore (deleted by admin)
          // Re-create their profile and set to pending approval
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            uid: userCredential.user.uid,
            email: loginEmail,
            displayName: userCredential.user.displayName || 'User',
            role: 'teacher',
            isApproved: false,
            createdAt: new Date().toISOString(),
            reRegisteredAt: new Date().toISOString()
          });
          
          setError('⚠️ บัญชีของคุณถูกรีเซ็ตข้อมูลใหม่ กรุณารอการอนุมัติจากผู้ดูแลระบบอีกครั้งเพื่อเข้าใช้งาน');
          await auth.signOut();
          setLoading(false);
          return;
        }
      } else {
        const userData = userDoc.data();
        
        // Ensure admin status for designated emails
        if (isAdminCredentials && userData.role !== 'admin') {
          await updateDoc(doc(db, 'users', userCredential.user.uid), { 
            role: 'admin', 
            isApproved: true 
          });
        }
        
        // Block non-approved users
        if (userData.role !== 'admin' && !userData.isApproved) {
          setError('⚠️ บัญชีของคุณยังไม่ได้รับการอนุมัติจากผู้ดูแลระบบ คุณจะไม่สามารถเข้าใช้งานได้จนกว่าจะได้รับการตรวจสอบสิทธิ์ กรุณาติดต่อผู้ดูแลระบบเพื่อแจ้งความประสงค์ในการเข้าใช้งาน');
          await auth.signOut();
          setLoading(false);
          return;
        }
      }
      navigate('/');
    } catch (err: any) {
      console.error("Login Error:", err);
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-8 text-center bg-slate-50 border-b border-slate-100">
          <img 
            src="https://img2.pic.in.th/431bc33de9bf7638e76042de58f2757f.png" 
            alt="Logo" 
            className="w-20 h-20 mx-auto mb-4 object-contain"
            referrerPolicy="no-referrer"
          />
          <h1 className="text-2xl font-bold text-slate-800">ระบบงานธุรการชั้นเรียน</h1>
          <p className="text-slate-500 mt-1">โรงเรียนบ้านแม่ตาวแพะ | Banmaetaophae School</p>
        </div>

        <form onSubmit={handleLogin} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">อีเมล / ชื่อผู้ใช้</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="example@email.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">รหัสผ่าน</label>
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

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : (
              <>
                <LogIn size={20} />
                เข้าสู่ระบบ
              </>
            )}
          </button>

          <div className="text-center space-y-4">
            <p className="text-sm text-slate-500">
              ยังไม่มีบัญชี? <Link to="/register" className="text-blue-600 font-bold hover:underline">ลงทะเบียนใหม่</Link>
            </p>
            <div className="pt-4 border-t border-slate-100 text-[10px] text-slate-400 uppercase tracking-widest">
              Developed by KruKan
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
