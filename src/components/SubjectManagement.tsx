import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, getDocs, where, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { Subject } from '../types';
import { Plus, Search, Trash2, Edit2, BookOpen, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

export default function SubjectManagement() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSubject, setCurrentSubject] = useState<Partial<Subject>>({});

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      const q = query(collection(db, 'subjects'), where('teacherId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const subjectList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
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

      if (currentSubject.id) {
        await updateDoc(doc(db, 'subjects', currentSubject.id), {
          ...currentSubject,
          teacherId: user.uid
        });
      } else {
        await addDoc(collection(db, 'subjects'), {
          ...currentSubject,
          teacherId: user.uid
        });
      }
      setIsModalOpen(false);
      fetchSubjects();
    } catch (error) {
      handleFirestoreError(error, currentSubject.id ? OperationType.UPDATE : OperationType.CREATE, 'subjects');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายวิชานี้?')) return;
    try {
      await deleteDoc(doc(db, 'subjects', id));
      fetchSubjects();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `subjects/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">จัดการรายวิชา</h2>
          <p className="text-sm text-slate-500">เพิ่มและแก้ไขรายวิชาที่คุณรับผิดชอบ</p>
        </div>
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
                <BookOpen size={24} />
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button 
                  onClick={() => { setCurrentSubject(subject); setIsModalOpen(true); }}
                  className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-all"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => handleDelete(subject.id)}
                  className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">{subject.name}</h3>
            <p className="text-sm text-slate-500 mb-4">รหัสวิชา: {subject.code}</p>
            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">
                ชั้น {subject.classId}
              </span>
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
