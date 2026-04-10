import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { User, Mail, Shield, Save, Briefcase, Signature, Check, X as XIcon, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import Cropper from 'react-easy-crop';
import toast from 'react-hot-toast';

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [designation, setDesignation] = useState('');
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

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
        setDisplayName(data.displayName || '');
        setDesignation(data.designation || '');
        setProfilePic(data.signatureUrl || null);
      }
    }
    setLoading(false);
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: any) => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    
    // Scale down if too large (max 500x500)
    const maxSize = 500;
    let width = pixelCrop.width;
    let height = pixelCrop.height;
    
    if (width > maxSize || height > maxSize) {
      const ratio = Math.min(maxSize / width, maxSize / height);
      width = width * ratio;
      height = height * ratio;
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      width,
      height
    );
    return canvas.toDataURL('image/jpeg', 0.7);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToCrop(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropSave = async () => {
    if (imageToCrop && croppedAreaPixels) {
      try {
        const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);
        setProfilePic(croppedImage);
      } catch (e) {
        console.error("Error cropping image:", e);
        toast.error("เกิดข้อผิดพลาดในการตัดรูปภาพ");
      } finally {
        setImageToCrop(null);
      }
    }
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user || !profile) return;

    setSaving(true);
    try {
      const updateData: any = {
        signatureUrl: profilePic
      };
      
      if (profile.role !== 'student') {
        updateData.displayName = displayName;
        updateData.designation = designation;
      }

      await updateDoc(doc(db, 'users', user.uid), updateData);
      toast.success('บันทึกข้อมูลแล้ว');
      fetchProfile();
    } catch (err) {
      console.error(err);
      toast.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-slate-400">กำลังโหลด...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {imageToCrop && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white p-4 rounded-3xl w-full max-w-lg space-y-4">
            <div className="relative h-64">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setImageToCrop(null)} className="flex-1 py-2 bg-slate-100 rounded-lg flex items-center justify-center gap-2"><XIcon size={16} /> ยกเลิก</button>
              <button onClick={handleCropSave} className="flex-1 py-2 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2"><Check size={16} /> ตกลง</button>
            </div>
          </div>
        </div>
      )}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-8">
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-24 h-24">
              <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center overflow-hidden">
                {profilePic ? (
                  <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User size={48} />
                )}
              </div>
              <label className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-sm cursor-pointer border border-slate-100 hover:bg-slate-50">
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <Signature size={16} className="text-slate-600" />
              </label>
            </div>
            {profilePic && (
              <button 
                onClick={() => setProfilePic(null)}
                className="flex items-center gap-1 px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold hover:bg-red-100 transition-all"
              >
                <Trash2 size={12} />
                ลบรูปโปรไฟล์
              </button>
            )}
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
              <User size={16} className="text-blue-600" />
              ชื่อ-นามสกุล
            </label>
            <input 
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="กรอกชื่อ-นามสกุลของคุณ"
              readOnly={profile?.role === 'student'}
              className={cn(
                "w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all",
                profile?.role === 'student' && "opacity-50 cursor-not-allowed"
              )}
            />
          </div>

          {profile?.role !== 'student' && (
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
          )}

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
