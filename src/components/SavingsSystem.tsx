import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, where, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { Student, Saving } from '../types';
import { PiggyBank, Plus, TrendingUp, TrendingDown, History as LucideHistory, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

export default function SavingsSystem() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('ป.3/1');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [type, setType] = useState<'deposit' | 'withdraw'>('deposit');
  const [records, setRecords] = useState<Saving[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchStudents();
    fetchRecords();
  }, []);

  const fetchStudents = async () => {
    try {
      const q = query(collection(db, 'students'));
      const querySnapshot = await getDocs(q);
      setStudents(querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Student)));
    } catch (error) {
      console.error("Error fetching students: ", error);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesClass = selectedClass === 'ทั้งหมด' || s.classId === selectedClass;
    const matchesSearch = `${s.firstName} ${s.lastName} ${s.studentId}`.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesClass && matchesSearch;
  });

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'savings'), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);
      setRecords(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Saving)));
    } catch (error) {
      console.error("Error fetching records: ", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || amount <= 0) return;
    
    setSaving(true);
    try {
      await addDoc(collection(db, 'savings'), {
        studentId: selectedStudent,
        amount,
        type,
        date: new Date().toISOString(),
        createdAt: serverTimestamp()
      });
      setAmount(0);
      fetchRecords();
      alert('บันทึกรายการสำเร็จ!');
    } catch (error) {
      console.error("Error saving transaction: ", error);
    } finally {
      setSaving(false);
    }
  };

  const getStudentName = (id: string) => {
    const s = students.find(s => s.id === id);
    return s ? `${s.firstName} ${s.lastName}` : 'ไม่ทราบชื่อ';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Transaction Form */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-6 text-blue-600">
            <PiggyBank size={24} />
            <h3 className="font-bold text-slate-800">บันทึกการออม</h3>
          </div>
          <form onSubmit={handleTransaction} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Filter size={14} className="text-blue-600" />
                  ชั้นเรียน
                </label>
                <select 
                  value={selectedClass}
                  onChange={(e) => {
                    setSelectedClass(e.target.value);
                    setSelectedStudent('');
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                >
                  <option value="ทั้งหมด">ทั้งหมด</option>
                  {['ป.1/1', 'ป.2/1', 'ป.3/1', 'ป.4/1', 'ป.5/1', 'ป.6/1'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Search size={14} className="text-blue-600" />
                  ค้นหาชื่อ
                </label>
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ชื่อ/รหัส..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">เลือกนักเรียน</label>
              <select 
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                required
              >
                <option value="">-- เลือกนักเรียน --</option>
                {filteredStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.studentId} - {s.firstName} {s.lastName}</option>
                ))}
              </select>
              {filteredStudents.length === 0 && searchQuery && (
                <p className="text-xs text-red-500 mt-1">ไม่พบนักเรียนที่ค้นหา</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">ประเภท</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType('deposit')}
                  className={cn(
                    "py-2.5 rounded-xl border-2 transition-all font-bold flex items-center justify-center gap-2",
                    type === 'deposit' ? "border-green-600 bg-green-50 text-green-600" : "border-slate-100 text-slate-400"
                  )}
                >
                  <TrendingUp size={18} />
                  ฝากเงิน
                </button>
                <button
                  type="button"
                  onClick={() => setType('withdraw')}
                  className={cn(
                    "py-2.5 rounded-xl border-2 transition-all font-bold flex items-center justify-center gap-2",
                    type === 'withdraw' ? "border-red-600 bg-red-50 text-red-600" : "border-slate-100 text-slate-400"
                  )}
                >
                  <TrendingDown size={18} />
                  ถอนเงิน
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">จำนวนเงิน (บาท)</label>
              <input 
                type="number"
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-xl text-center"
                placeholder="0.00"
                required
              />
            </div>
            <button 
              type="submit"
              disabled={saving}
              className={cn(
                "w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50",
                type === 'deposit' ? "bg-green-600 hover:bg-green-700 shadow-green-100" : "bg-red-600 hover:bg-red-700 shadow-red-100"
              )}
            >
              <Plus size={20} />
              {saving ? 'กำลังบันทึก...' : 'ยืนยันรายการ'}
            </button>
          </form>
        </div>
      </div>

      {/* History Table */}
      <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-6 text-slate-800">
          <LucideHistory size={24} className="text-blue-600" />
          <h3 className="font-bold">ประวัติการทำรายการ</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">วันที่</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">นักเรียน</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">ประเภท</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">กำลังโหลด...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">ไม่พบประวัติการทำรายการ</td></tr>
              ) : records.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50 transition-all">
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {format(new Date(record.date), 'dd MMM yy', { locale: th })}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-slate-800">{getStudentName(record.studentId)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase",
                      record.type === 'deposit' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                    )}>
                      {record.type === 'deposit' ? 'ฝาก' : 'ถอน'}
                    </span>
                  </td>
                  <td className={cn(
                    "px-6 py-4 text-sm font-bold text-right",
                    record.type === 'deposit' ? "text-green-600" : "text-red-600"
                  )}>
                    {record.type === 'deposit' ? '+' : '-'}{record.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
