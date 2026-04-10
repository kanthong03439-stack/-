import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, getDocs, where, addDoc, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { Subject, UserProfile } from '../types';
import { Plus, Search, Trash2, Edit2, BookOpen, XCircle, Calculator, Palette, Music, Dumbbell, Microscope, Languages, History, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useAcademicYear } from '../contexts/AcademicYearContext';

const iconOptions = [
  { name: 'BookOpen', icon: BookOpen },
  { name: 'Calculator', icon: Calculator },
  { name: 'Palette', icon: Palette },
  { name: 'Music', icon: Music },
  { name: 'Dumbbell', icon: Dumbbell },
  { name: 'Microscope', icon: Microscope },
  { name: 'Languages', icon: Languages },
  { name: 'History', icon: History },
  { name: 'Globe', icon: Globe },
];

const getIcon = (name: string) => {
  const option = iconOptions.find(o => o.name === name);
  return option ? option.icon : BookOpen;
};

export default function SubjectManagement() {
  const { selectedYear } = useAcademicYear();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSubject, setCurrentSubject] = useState<Partial<Subject>>({});

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (auth.currentUser) {
        const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (docSnap.exists()) {
          setUserProfile(docSnap.data() as UserProfile);
        }
      }
    };
    fetchProfile();
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const profile = userDoc.data() as UserProfile;
      setUserProfile(profile);

      let q;
      if (profile.role === 'student') {
        // Fetch subjects for student's class
        const studentDoc = await getDoc(doc(db, 'students', profile.studentId || ''));
        const studentData = studentDoc.data() as any;
        const classId = studentData?.yearClasses?.[selectedYear] || studentData?.classId;
        
        q = query(
          collection(db, 'subjects'),
          where('classId', '==', classId),
          where('academicYear', '==', selectedYear)
        );
      } else {
        // Fetch subjects for teacher
        q = query(
          collection(db, 'subjects'), 
          where('teacherId', '==', user.uid),
          where('academicYear', '==', selectedYear)
        );
      }
      
      const querySnapshot = await getDocs(q);
      const subjectList = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Subject));
      setSubjects(subjectList);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'subjects');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = auth.currentUser;
      if (!user) return;

      const subjectData = {
        ...currentSubject,
        teacherId: user.uid,
        academicYear: selectedYear
      };

      if (currentSubject.id) {
        await updateDoc(doc(db, 'subjects', currentSubject.id), subjectData);
        setNotification({ message: 'แก้ไขรายวิชาสำเร็จ', type: 'success' });
      } else {
        await addDoc(collection(db, 'subjects'), subjectData);
        setNotification({ message: 'เพิ่มรายวิชาสำเร็จ', type: 'success' });
      }
      setIsModalOpen(false);
      fetchSubjects();
    } catch (error) {
      handleFirestoreError(error, currentSubject.id ? OperationType.UPDATE : OperationType.CREATE, 'subjects');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'subjects', id));
      setNotification({ message: 'ลบรายวิชาสำเร็จ', type: 'success' });
      fetchSubjects();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `subjects/${id}`);
    }
    setDeleteConfirm({ isOpen: false, id: null });
  };

  return (
    <div className="space-y-6">
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm.isOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">ยืนยันการลบ</h3>
              <p className="text-slate-500 mb-6">คุณแน่ใจหรือไม่ว่าต้องการลบรายวิชานี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirm({ isOpen: false, id: null })}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={() => deleteConfirm.id && handleDelete(deleteConfirm.id)}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-100 transition-all"
                >
                  ลบข้อมูล
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              "fixed bottom-8 right-8 px-6 py-4 rounded-2xl shadow-2xl z-[70] flex items-center gap-3 border",
              notification.type === 'success' ? "bg-white border-green-100 text-green-600" : "bg-white border-red-100 text-red-600"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              notification.type === 'success' ? "bg-green-50" : "bg-red-50"
            )}>
              {notification.type === 'success' ? <Plus size={18} /> : <XCircle size={18} />}
            </div>
            <span className="font-bold text-slate-800">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">จัดการรายวิชา</h2>
          <p className="text-sm text-slate-500">เพิ่มและแก้ไขรายวิชาที่คุณรับผิดชอบ</p>
        </div>
        {userProfile?.role !== 'student' && (
          <button 
            onClick={() => { 
              setCurrentSubject({ name: '', code: '', classId: 'ป.1/1' }); 
              setIsModalOpen(true); 
            }}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            <Plus size={18} />
            <span className="text-sm font-bold">เพิ่มรายวิชา</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">กำลังโหลดข้อมูล...</div>
        ) : subjects.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400">ยังไม่มีข้อมูลรายวิชา</div>
        ) : subjects.map((subject) => (
          <div key={subject.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                {(() => {
                  const Icon = getIcon(subject.iconName || 'BookOpen');
                  return <Icon size={24} />;
                })()}
              </div>
              {userProfile?.role !== 'student' && (
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={() => { setCurrentSubject(subject); setIsModalOpen(true); }}
                    className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-all"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => setDeleteConfirm({ isOpen: true, id: subject.id || null })}
                    className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">{subject.name}</h3>
            <p className="text-sm text-slate-500 mb-4">รหัสวิชา: {subject.code}</p>
            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">
                ชั้น {subject.classId}
              </span>
              {subject.dayOfWeek && (
                <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold">
                  {subject.dayOfWeek} คาบที่ {subject.period} {subject.timeRange && `(${subject.timeRange})`}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-lg font-bold text-slate-800">
                  {currentSubject.id ? 'แก้ไขรายวิชา' : 'เพิ่มรายวิชาใหม่'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <XCircle size={24} />
                </button>
              </div>
              <form onSubmit={handleSaveSubject} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">ชื่อวิชา</label>
                  <input 
                    required
                    type="text"
                    value={currentSubject.name || ''}
                    onChange={e => setCurrentSubject({...currentSubject, name: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="เช่น คณิตศาสตร์"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">รหัสวิชา</label>
                  <input 
                    required
                    type="text"
                    value={currentSubject.code || ''}
                    onChange={e => setCurrentSubject({...currentSubject, code: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="เช่น ค13101"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">ชั้นเรียน</label>
                  <select 
                    value={currentSubject.classId || 'ป.1/1'}
                    onChange={e => setCurrentSubject({...currentSubject, classId: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {['ป.1/1', 'ป.2/1', 'ป.3/1', 'ป.4/1', 'ป.5/1', 'ป.6/1'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">วัน</label>
                    <select 
                      value={currentSubject.dayOfWeek || 'วันจันทร์'}
                      onChange={e => setCurrentSubject({...currentSubject, dayOfWeek: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {['วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์'].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">คาบที่ (เช่น 1-2)</label>
                    <input 
                      type="text"
                      value={currentSubject.period || ''}
                      onChange={e => setCurrentSubject({...currentSubject, period: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="เช่น 1-2"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">ช่วงเวลา (เช่น 08:30-10:30)</label>
                  <input 
                    type="text"
                    value={currentSubject.timeRange || ''}
                    onChange={e => setCurrentSubject({...currentSubject, timeRange: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="เช่น 08:30-10:30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">ไอคอนรายวิชา</label>
                  <div className="grid grid-cols-5 gap-2">
                    {iconOptions.map(opt => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.name}
                          type="button"
                          onClick={() => setCurrentSubject({...currentSubject, iconName: opt.name})}
                          className={cn(
                            "p-2 rounded-xl border-2 flex items-center justify-center transition-all",
                            currentSubject.iconName === opt.name ? "border-blue-600 bg-blue-50 text-blue-600" : "border-slate-100 text-slate-400 hover:border-slate-200"
                          )}
                        >
                          <Icon size={20} />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                  >
                    บันทึกข้อมูล
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
