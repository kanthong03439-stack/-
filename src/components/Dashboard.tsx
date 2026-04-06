import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, where, count } from 'firebase/firestore';
import { 
  Users, 
  CalendarCheck, 
  GraduationCap, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { ChevronRight, PiggyBank } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    attendanceRate: 0,
    averageGrade: 0,
    totalSavings: 0
  });

  const [attendanceData, setAttendanceData] = useState([
    { name: 'จันทร์', มาเรียน: 45, ขาด: 2, สาย: 3 },
    { name: 'อังคาร', มาเรียน: 48, ขาด: 1, สาย: 1 },
    { name: 'พุธ', มาเรียน: 42, ขาด: 5, สาย: 3 },
    { name: 'พฤหัสบดี', มาเรียน: 47, ขาด: 2, สาย: 1 },
    { name: 'ศุกร์', มาเรียน: 46, ขาด: 3, สาย: 1 },
  ]);

  const [genderData, setGenderData] = useState([
    { name: 'ชาย', value: 25 },
    { name: 'หญิง', value: 25 },
  ]);

  useEffect(() => {
    const fetchStats = async () => {
      // In a real app, we would fetch from Firestore
      // For now, using mock data for the dashboard overview
      setStats({
        totalStudents: 50,
        attendanceRate: 94.5,
        averageGrade: 3.42,
        totalSavings: 12500
      });
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="นักเรียนทั้งหมด" 
          value={stats.totalStudents} 
          unit="คน" 
          icon={Users} 
          color="blue"
          trend="+2%"
        />
        <StatCard 
          title="อัตราการมาเรียน" 
          value={stats.attendanceRate} 
          unit="%" 
          icon={CalendarCheck} 
          color="green"
          trend="+0.5%"
        />
        <StatCard 
          title="เกรดเฉลี่ยรวม" 
          value={stats.averageGrade} 
          unit="" 
          icon={GraduationCap} 
          color="amber"
          trend="+0.1"
        />
        <StatCard 
          title="เงินออมสะสม" 
          value={stats.totalSavings.toLocaleString()} 
          unit="บาท" 
          icon={TrendingUp} 
          color="indigo"
          trend="+1,200"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800">สถิติการมาเรียนสัปดาห์นี้</h3>
            <select className="bg-slate-50 border-none text-sm rounded-lg px-3 py-1 text-slate-500 outline-none">
              <option>สัปดาห์นี้</option>
              <option>สัปดาห์ที่แล้ว</option>
            </select>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  cursor={{fill: '#f8fafc'}}
                />
                <Bar dataKey="มาเรียน" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="สาย" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="ขาด" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gender Distribution */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-6">สัดส่วนนักเรียน</h3>
          <div className="h-64 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {genderData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-slate-800">50</span>
              <span className="text-xs text-slate-400">คน</span>
            </div>
          </div>
          <div className="space-y-3 mt-4">
            {genderData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[index]}}></div>
                  <span className="text-sm text-slate-600">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-800">{item.value} คน</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-6">กิจกรรมล่าสุด</h3>
        <div className="space-y-4">
          {[
            { title: 'เช็คชื่อนักเรียน ป.3/1', time: '10 นาทีที่แล้ว', user: 'ครูกานต์', type: 'attendance' },
            { title: 'บันทึกคะแนนวิชาคณิตศาสตร์', time: '45 นาทีที่แล้ว', user: 'ครูสมชาย', type: 'grade' },
            { title: 'บันทึกการออมทรัพย์', time: '2 ชั่วโมงที่แล้ว', user: 'ครูสมหญิง', type: 'saving' },
            { title: 'ลงทะเบียนนักเรียนใหม่ 5 คน', time: 'เมื่อวานนี้', user: 'Admin', type: 'student' },
          ].map((activity, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  activity.type === 'attendance' ? "bg-blue-100 text-blue-600" :
                  activity.type === 'grade' ? "bg-amber-100 text-amber-600" :
                  activity.type === 'saving' ? "bg-green-100 text-green-600" : "bg-purple-100 text-purple-600"
                )}>
                  {activity.type === 'attendance' ? <CalendarCheck size={20} /> :
                   activity.type === 'grade' ? <GraduationCap size={20} /> :
                   activity.type === 'saving' ? <PiggyBank size={20} /> : <Users size={20} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{activity.title}</p>
                  <p className="text-xs text-slate-500">{activity.user} • {activity.time}</p>
                </div>
              </div>
              <button className="text-slate-400 hover:text-blue-600 transition-all">
                <ChevronRight size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, unit, icon: Icon, color, trend }: any) {
  const colorClasses: any = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600",
    indigo: "bg-indigo-50 text-indigo-600",
  };

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-3 rounded-2xl", colorClasses[color])}>
          <Icon size={24} />
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold",
            trend.startsWith('+') ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
          )}>
            {trend.startsWith('+') ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trend}
          </div>
        )}
      </div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <div className="flex items-baseline gap-1 mt-1">
        <h2 className="text-3xl font-bold text-slate-800">{value}</h2>
        <span className="text-sm text-slate-400 font-medium">{unit}</span>
      </div>
    </motion.div>
  );
}
