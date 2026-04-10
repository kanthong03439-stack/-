import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, where, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { sendApprovalEmail } from '../services/emailService';
import { UserProfile } from '../types';
import { Shield, UserCheck, UserX, Trash2, Search, Filter, CheckCircle2, XCircle, AlertTriangle, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

export default function AdminPanel() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<{ uid: string; status: 'sending' | 'success' | 'error' } | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList = snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile));
      setUsers(userList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleApprove = async (uid: string, status: boolean, userEmail: string, userName: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { isApproved: status });
      
      // Send email if approved
      if (status) {
        setEmailStatus({ uid, status: 'sending' });
        try {
          await sendApprovalEmail(userEmail, userName);
          setEmailStatus({ uid, status: 'success' });
          setTimeout(() => setEmailStatus(null), 3000);
        } catch (emailErr) {
          console.error('Email sending failed:', emailErr);
          setEmailStatus({ uid, status: 'error' });
          setTimeout(() => setEmailStatus(null), 5000);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleDelete = async (uid: string) => {
    try {
      // 1. Delete user profile from Firestore
      await deleteDoc(doc(db, 'users', uid));

      // 2. Delete user from Firebase Auth via backend API
      try {
        const response = await fetch(`/api/users/${uid}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          console.warn('Failed to delete user from Firebase Auth. They may need to be deleted manually.');
        }
      } catch (apiErr) {
        console.error('API error when deleting user:', apiErr);
      }

      // 3. Deep delete teacher data
      const collectionsToClean = [
        { name: 'teacher_links', field: 'userId' },
        { name: 'calendar_events', field: 'userId' },
        { name: 'attendance', field: 'teacherId' },
        { name: 'milkBrushing', field: 'teacherId' },
        { name: 'healthRecords', field: 'teacherId' },
        { name: 'savings', field: 'teacherId' },
        { name: 'grades', field: 'teacherId' },
        { name: 'students', field: 'teacherId' },
        { name: 'subjects', field: 'teacherId' }
      ];

      for (const col of collectionsToClean) {
        const q = query(collection(db, col.name), where(col.field, '==', uid));
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, col.name, d.id)));
        await Promise.all(deletePromises);
      }

      setConfirmDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
  };

  const filteredUsers = users.filter(u => 
    `${u.displayName} ${u.email} ${u.studentId || ''}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="ค้นหาชื่อ, อีเมล หรือเลขประจำตัว..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-blue-600" />
            <h3 className="font-bold text-slate-800">จัดการผู้ใช้งานและสิทธิ์การเข้าถึง</h3>
          </div>
          {users.filter(u => !u.isApproved).length > 0 && (
            <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-amber-200">
              <AlertTriangle size={14} />
              รอการอนุมัติ {users.filter(u => !u.isApproved).length} คน
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">ผู้ใช้งาน</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">บทบาท</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">สถานะการอนุมัติ</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">กำลังโหลด...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">ไม่พบข้อมูลผู้ใช้งาน</td></tr>
              ) : filteredUsers.map((user) => (
                <tr key={user.uid} className="hover:bg-slate-50 transition-all group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800">{user.displayName}</span>
                      {user.role === 'student' ? (
                        <span className="text-xs text-blue-600 font-medium">ID: {user.studentId}</span>
                      ) : (
                        <span className="text-xs text-slate-400">{user.email}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase",
                      user.role === 'admin' ? "bg-purple-50 text-purple-600" :
                      user.role === 'teacher' ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"
                    )}>
                      {user.role === 'student' ? 'นักเรียน' : user.role === 'teacher' ? 'ครู' : 'ผู้ดูแล'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {user.isApproved ? (
                      <div className="flex items-center gap-1.5 text-green-600">
                        <CheckCircle2 size={16} />
                        <span className="text-xs font-bold">อนุมัติแล้ว</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-amber-500">
                        <XCircle size={16} />
                        <span className="text-xs font-bold">รอการอนุมัติ</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {user.role !== 'admin' && (
                        <>
                          <div className="flex flex-col items-end gap-1">
                            <button 
                              onClick={() => handleApprove(user.uid, !user.isApproved, user.email, user.displayName)}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                                user.isApproved ? "bg-amber-50 text-amber-600 hover:bg-amber-100" : "bg-green-50 text-green-600 hover:bg-green-100"
                              )}
                            >
                              {user.isApproved ? 'ยกเลิกอนุมัติ' : 'อนุมัติการใช้งาน'}
                            </button>
                            {emailStatus?.uid === user.uid && user.role !== 'student' && (
                              <span className={cn(
                                "text-[10px] font-medium flex items-center gap-1",
                                emailStatus.status === 'sending' ? "text-blue-500" :
                                emailStatus.status === 'success' ? "text-green-500" : "text-red-500"
                              )}>
                                <Mail size={10} />
                                {emailStatus.status === 'sending' ? 'กำลังส่งอีเมล...' :
                                 emailStatus.status === 'success' ? 'ส่งอีเมลสำเร็จ' : 'ส่งอีเมลล้มเหลว'}
                              </span>
                            )}
                          </div>
                          <button 
                            onClick={() => setConfirmDelete(user.uid)}
                            className="p-2 hover:bg-red-50 text-red-600 rounded-xl transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center space-y-6"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800">ยืนยันการลบผู้ใช้งาน</h3>
                <p className="text-slate-500 text-sm">
                  คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้งานนี้? ผู้ใช้จะถูกบังคับออกจากระบบและต้องลงทะเบียนใหม่เพื่อขออนุมัติอีกครั้ง
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete)}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                >
                  ยืนยันการลบ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
