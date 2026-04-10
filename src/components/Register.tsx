import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { UserPlus, Mail, Lock, User, School, ArrowLeft, Hash } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [studentId, setStudentId] = useState('');
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
      let finalEmail = email;
      
      let displayNameToUse = displayName;
      
      // Student Validation against Master Data
      if (role === 'student') {
        if (!studentId) {
          setError('⚠️ กรุณากรอกเลขประจำตัวนักเรียน');
          setLoading(false);
          return;
        }

        if (!/^\d{4}$/.test(studentId)) {
          setError('⚠️ เลขประจำตัวนักเรียนต้องเป็นตัวเลข 4 หลัก');
          setLoading(false);
          return;
        }

        const masterQuery = query(
          collection(db, 'students'),
          where('studentId', '==', studentId)
        );
        const masterSnap = await getDocs(masterQuery);

        if (masterSnap.empty) {
          setError('⚠️ ไม่พบข้อมูลนักเรียนในฐานข้อมูล กรุณาตรวจสอบเลขประจำตัวอีกครั้ง');
          setLoading(false);
          return;
        }

        const studentData = masterSnap.docs[0].data();
        displayNameToUse = `${studentData.prefix || ''}${studentData.firstName} ${studentData.lastName}`;

        // Generate dummy email for student
        finalEmail = `${studentId}@student.school`;
        
        // Use auto-linked name
        setDisplayName(displayNameToUse);
      }

      let userCredential;
      try {
        userCredential = await createUserWithEmailAndPassword(auth, finalEmail, password);
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          setError(role === 'student' ? '⚠️ เลขประจำตัวนี้ถูกลงทะเบียนแล้ว' : '⚠️ อีเมลนี้มีอยู่ในระบบแล้ว ไม่สามารถลงทะเบียนซ้ำได้');
          setLoading(false);
          return;
        }
        throw err;
      }

      await updateProfile(userCredential.user, { displayName: displayNameToUse });

      const isAdminEmail = finalEmail === 'kanthong.03439@gmail.com' || finalEmail === 'kanthong.8426@gmail.com';

      // Create user profile in Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: finalEmail,
        displayName: displayNameToUse,
        role: isAdminEmail ? 'admin' : role,
        studentId: role === 'student' ? studentId : null,
        isApproved: isAdminEmail, // Only auto-approve admins. Students and Teachers need approval.
        createdAt: new Date().toISOString()
      });

      if (isAdminEmail) {
        setSuccess('ลงทะเบียนผู้ดูแลระบบสำเร็จ! คุณสามารถเข้าใช้งานได้ทันที');
      } else {
        setSuccess('ลงทะเบียนสำเร็จ! กรุณารอการอนุมัติจากผู้ดูแลระบบก่อนเข้าสู่ระบบ');
      }
      
      // Delay navigation to show success message
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      console.error("Registration Error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError(role === 'student' ? '⚠️ เลขประจำตัวนี้ถูกลงทะเบียนแล้ว' : '⚠️ อีเมลนี้มีอยู่ในระบบแล้ว');
      } else if (err.code === 'auth/weak-password') {
        setError('⚠️ รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      } else if (err.code === 'auth/invalid-email') {
        setError('⚠️ รูปแบบข้อมูลไม่ถูกต้อง');
      } else {
        setError(err.message || 'เกิดข้อผิดพลาดในการลงทะเบียน');
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative z-10"
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
            <label className="text-sm font-semibold text-slate-700">บทบาทการใช้งาน</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setRole('teacher'); setDisplayName(''); }}
                className={cn(
                  "py-2.5 rounded-xl border-2 transition-all font-medium",
                  role === 'teacher' ? "border-blue-600 bg-blue-50 text-blue-600" : "border-slate-100 text-slate-500"
                )}
              >
                ครูผู้สอน
              </button>
              <button
                type="button"
                onClick={() => { setRole('student'); setDisplayName(''); }}
                className={cn(
                  "py-2.5 rounded-xl border-2 transition-all font-medium",
                  role === 'student' ? "border-blue-600 bg-blue-50 text-blue-600" : "border-slate-100 text-slate-500"
                )}
              >
                นักเรียน
              </button>
            </div>
          </div>

          {role === 'teacher' && (
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
          )}

          {role === 'student' ? (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-1.5"
            >
              <label className="text-sm font-semibold text-slate-700">เลขประจำตัวนักเรียน</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="เลขประจำตัว 4 หลัก"
                  maxLength={4}
                  required
                />
              </div>
            </motion.div>
          ) : (
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
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">กำหนดรหัสผ่าน</label>
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
              &copy; Copyright {new Date().getFullYear() > 2026 ? `2026 - ${new Date().getFullYear()}` : '2026'} Developed by KruKan
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
