import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { User, Mail, Shield, Save, Briefcase, Signature } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [designation, setDesignation] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const user = auth.currentUser;
    if (user) {
      const docSnap = await getDoc(doc(db, 'users', user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setProfile(data);
        setDesignation(data.designation || '');
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        designation: designation
      });
      alert('บันทึกข้อมูลส่วนตัวสำเร็จ!');
      fetchProfile();
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-slate-400">กำลังโหลด...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-8">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center">
            <User size={48} />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-800">{profile?.displayName}</h2>
            <div className="flex items-center gap-2 text-slate-500">
              <Mail size={16} />
              <span className="text-sm">{profile?.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase",
                profile?.role === 'admin' ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"
              )}>
                {profile?.role}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-6 pt-6 border-t border-slate-100">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Briefcase size={16} className="text-blue-600" />
              ตำแหน่ง / หน้าที่
            </label>
            <input 
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="เช่น ครูประจำชั้น ป.3/1, ครูวิชาคณิตศาสตร์"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
            <p className="text-xs text-slate-400">ตำแหน่งนี้จะปรากฏในรายงานต่างๆ เช่น บันทึกการเยี่ยมบ้าน</p>
          </div>

          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save size={20} />
            {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลส่วนตัว'}
          </button>
        </div>
      </div>
    </div>
  );
}
