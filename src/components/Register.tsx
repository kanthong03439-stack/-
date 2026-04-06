import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { UserPlus, Mail, Lock, User, School, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'teacher' | 'student'>('teacher');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [success, setSuccess] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      let userCredential;
      try {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          // If email exists, try to sign in to see if it's a deleted user returning
          try {
            userCredential = await signInWithEmailAndPassword(auth, email, password);
            const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
            
            if (!userDoc.exists()) {
              // User exists in Auth but not in Firestore (deleted by admin)
              // We can "re-register" them now
              await setDoc(doc(db, 'users', userCredential.user.uid), {
                uid: userCredential.user.uid,
                email,
                displayName,
                role: 'teacher',
                isApproved: false,
                createdAt: new Date().toISOString(),
                reRegisteredAt: new Date().toISOString()
              });
              setSuccess('พบข้อมูลเดิมของคุณในระบบ ระบบได้ทำการกู้คืนโปรไฟล์และส่งคำขออนุมัติใหม่เรียบร้อยแล้ว กรุณารอการตรวจสอบจากผู้ดูแลระบบ');
              setTimeout(() => navigate('/login'), 4000);
              return;
            } else {
              setError('⚠️ อีเมลนี้ถูกใช้งานแล้วในระบบและยังมีบัญชีที่ใช้งานได้อยู่ กรุณาเข้าสู่ระบบด้วยบัญชีเดิม');
              await auth.signOut();
              setLoading(false);
              return;
            }
          } catch (signInErr: any) {
            // If sign in fails, it's either a wrong password or a real conflict
            setError('⚠️ อีเมลนี้ถูกใช้งานแล้วในระบบ หากคุณต้องการลงทะเบียนใหม่ด้วยอีเมลเดิม กรุณาใช้รหัสผ่านเดิมที่เคยลงทะเบียนไว้');
            setLoading(false);
            return;
          }
        }
        throw err;
      }

      await updateProfile(userCredential.user, { displayName });

      const isAdminEmail = email === 'kanthong.03439@gmail.com' || email === 'kanthong.8426@gmail.com';

      // Create user profile in Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email,
        displayName,
        role: isAdminEmail ? 'admin' : role,
        isApproved: isAdminEmail, // Auto-approve admin
        createdAt: new Date().toISOString()
      });

      if (isAdminEmail) {
        setSuccess('ลงทะเบียนผู้ดูแลระบบสำเร็จ! คุณสามารถเข้าใช้งานได้ทันที');
      } else {
        setSuccess('ลงทะเบียนสำเร็จ! กรุณารอการอนุมัติจากผู้ดูแลระบบก่อนเข้าใช้งาน');
      }
      
      // Delay navigation to show success message
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      console.error("Registration Error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError('⚠️ อีเมลนี้มีอยู่ในระบบแล้ว หากคุณเคยถูกลบข้อมูล กรุณาไปที่หน้าเข้าสู่ระบบเพื่อขอกลับมาใช้งานใหม่ด้วยรหัสผ่านเดิม');
      } else if (err.code === 'auth/weak-password') {
        setError('⚠️ รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      } else if (err.code === 'auth/invalid-email') {
        setError('⚠️ รูปแบบอีเมลไม่ถูกต้อง');
      } else {
        setError(err.message || 'เกิดข้อผิดพลาดในการลงทะเบียน');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-6 text-center bg-slate-50 border-b border-slate-100 relative">
          <Link to="/login" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-all">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-slate-800">ลงทะเบียนผู้ใช้งานใหม่</h1>
        </div>

        <form onSubmit={handleRegister} className="p-8 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 text-green-600 p-3 rounded-xl text-sm font-medium border border-green-100">
              {success}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">ชื่อ-นามสกุล</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="ชื่อ-นามสกุล"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">อีเมล</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="example@email.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">รหัสผ่าน</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">บทบาท</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('teacher')}
                className={cn(
                  "py-2.5 rounded-xl border-2 transition-all font-medium",
                  role === 'teacher' ? "border-blue-600 bg-blue-50 text-blue-600" : "border-slate-100 text-slate-500"
                )}
              >
                ครูผู้สอน
              </button>
              <button
                type="button"
                onClick={() => setRole('student')}
                className={cn(
                  "py-2.5 rounded-xl border-2 transition-all font-medium",
                  role === 'student' ? "border-blue-600 bg-blue-50 text-blue-600" : "border-slate-100 text-slate-500"
                )}
              >
                นักเรียน
              </button>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'กำลังลงทะเบียน...' : (
              <>
                <UserPlus size={20} />
                ลงทะเบียน
              </>
            )}
          </button>

          <div className="text-center pt-2">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest">
              Developed by KruKan
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
