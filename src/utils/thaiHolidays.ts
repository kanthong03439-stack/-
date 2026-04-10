
export interface Holiday {
  date: string;
  name: string;
  isPublicHoliday: boolean;
  description?: string;
}

export const getHolidayDescription = (name: string): string => {
  const descriptions: Record<string, string> = {
    'วันขึ้นปีใหม่': 'วันเริ่มต้นปีปฏิทินใหม่ เป็นวันหยุดพักผ่อนและเฉลิมฉลองทั่วโลก',
    'วันจักรี': 'วันระลึกถึงพระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลกมหาราช ปฐมกษัตริย์แห่งราชวงศ์จักรี',
    'วันสงกรานต์': 'วันขึ้นปีใหม่ไทย ประเพณีรดน้ำดำหัวผู้ใหญ่ และการเล่นน้ำคลายร้อน',
    'วันแรงงานแห่งชาติ': 'วันหยุดเพื่อระลึกถึงความสำคัญของผู้ใช้แรงงาน',
    'วันฉัตรมงคล': 'วันรำลึกถึงพระราชพิธีบรมราชาภิเษกเป็นพระมหากษัตริย์แห่งราชวงศ์จักรี',
    'วันมาฆบูชา': 'วันสำคัญทางศาสนาพุทธ รำลึกถึงเหตุการณ์จาตุรงคสันนิบาต',
    'วันวิสาขบูชา': 'วันคล้ายวันประสูติ ตรัสรู้ และปรินิพพานของพระพุทธเจ้า',
    'วันอาสาฬหบูชา': 'วันระลึกถึงวันที่พระพุทธเจ้าทรงแสดงธรรมเทศนาครั้งแรก',
    'วันเข้าพรรษา': 'วันเริ่มต้นการจำพรรษาของพระสงฆ์ตลอดฤดูฝน 3 เดือน',
    'วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าฯ พระบรมราชินี': 'วันคล้ายวันพระราชสมภพ สมเด็จพระนางเจ้าสุทิดา พัชรสุธาพิมลลักษณ พระบรมราชินี',
    'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระวชิรเกล้าเจ้าอยู่หัว': 'วันคล้ายวันพระราชสมภพ พระบาทสมเด็จพระเจ้าอยู่หัว รัชกาลที่ 10',
    'วันแม่แห่งชาติ': 'วันคล้ายวันพระราชสมภพ สมเด็จพระนางเจ้าสิริกิติ์ พระบรมราชินีนาถ พระบรมราชชนนีพันปีหลวง',
    'วันปิยมหาราช': 'วันคล้ายวันสวรรคต พระบาทสมเด็จพระจุลจอมเกล้าเจ้าอยู่หัว รัชกาลที่ 5',
    'วันพ่อแห่งชาติ': 'วันคล้ายวันพระราชสมภพ พระบาทสมเด็จพระบรมชนกาธิเบศร มหาภูมิพลอดุลยเดชมหาราช บรมนาถบพิตร',
    'วันรัฐธรรมนูญ': 'วันระลึกถึงวันที่พระบาทสมเด็จพระปกเกล้าเจ้าอยู่หัวพระราชทานรัฐธรรมนูญฉบับแรก',
    'วันสิ้นปี': 'วันสุดท้ายของปีปฏิทิน ก่อนเริ่มต้นปีใหม่',
  };
  return descriptions[name] || 'วันสำคัญตามประกาศของทางราชการ';
};

export const getThaiHolidays = (year: number): Holiday[] => {
  const holidays: Holiday[] = [
    // Fixed dates
    { date: `${year}-01-01`, name: 'วันขึ้นปีใหม่', isPublicHoliday: true },
    { date: `${year}-04-06`, name: 'วันจักรี', isPublicHoliday: true },
    { date: `${year}-04-13`, name: 'วันสงกรานต์', isPublicHoliday: true },
    { date: `${year}-04-14`, name: 'วันสงกรานต์', isPublicHoliday: true },
    { date: `${year}-04-15`, name: 'วันสงกรานต์', isPublicHoliday: true },
    { date: `${year}-05-01`, name: 'วันแรงงานแห่งชาติ', isPublicHoliday: true },
    { date: `${year}-05-04`, name: 'วันฉัตรมงคล', isPublicHoliday: true },
    { date: `${year}-06-03`, name: 'วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าฯ พระบรมราชินี', isPublicHoliday: true },
    { date: `${year}-07-28`, name: 'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระวชิรเกล้าเจ้าอยู่หัว', isPublicHoliday: true },
    { date: `${year}-08-12`, name: 'วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าสิริกิติ์ พระบรมราชินีนาถ พระบรมราชชนนีพันปีหลวง / วันแม่แห่งชาติ', isPublicHoliday: true },
    { date: `${year}-10-13`, name: 'วันคล้ายวันสวรรคต พระบาทสมเด็จพระบรมชนกาธิเบศร มหาภูมิพลอดุลยเดชมหาราช บรมนาถบพิตร', isPublicHoliday: true },
    { date: `${year}-10-23`, name: 'วันปิยมหาราช', isPublicHoliday: true },
    { date: `${year}-12-05`, name: 'วันคล้ายวันพระบรมราชสมภพ พระบาทสมเด็จพระบรมชนกาธิเบศร มหาภูมิพลอดุลยเดชมหาราช บรมนาถบพิตร / วันพ่อแห่งชาติ', isPublicHoliday: true },
    { date: `${year}-12-10`, name: 'วันรัฐธรรมนูญ', isPublicHoliday: true },
    { date: `${year}-12-31`, name: 'วันสิ้นปี', isPublicHoliday: true },
  ];

  // Lunar-based holidays (Hardcoded for 2024-2026 for accuracy)
  if (year === 2024) {
    holidays.push(
      { date: '2024-02-24', name: 'วันมาฆบูชา', isPublicHoliday: true },
      { date: '2024-05-22', name: 'วันวิสาขบูชา', isPublicHoliday: true },
      { date: '2024-07-20', name: 'วันอาสาฬหบูชา', isPublicHoliday: true },
      { date: '2024-07-21', name: 'วันเข้าพรรษา', isPublicHoliday: true }
    );
  } else if (year === 2025) {
    holidays.push(
      { date: '2025-02-12', name: 'วันมาฆบูชา', isPublicHoliday: true },
      { date: '2025-05-11', name: 'วันวิสาขบูชา', isPublicHoliday: true },
      { date: '2025-07-10', name: 'วันอาสาฬหบูชา', isPublicHoliday: true },
      { date: '2025-07-11', name: 'วันเข้าพรรษา', isPublicHoliday: true }
    );
  } else if (year === 2026) {
    holidays.push(
      { date: '2026-03-03', name: 'วันมาฆบูชา', isPublicHoliday: true },
      { date: '2026-05-31', name: 'วันวิสาขบูชา', isPublicHoliday: true },
      { date: '2026-07-29', name: 'วันอาสาฬหบูชา', isPublicHoliday: true },
      { date: '2026-07-30', name: 'วันเข้าพรรษา', isPublicHoliday: true }
    );
  }

  return holidays;
};

export const getTeacherSalaryDate = (year: number, month: number): string => {
  // Pattern for Teacher Salary in Thailand (1st round/Standard):
  // 3 business days before the last business day of the month.
  // This matches the user's provided dates for 2569 (2026):
  // Jan 27, Feb 24, Mar 26
  
  const holidays = getThaiHolidays(year);
  const holidayDates = new Set(holidays.map(h => h.date));

  const isBusinessDay = (d: Date) => {
    const dayOfWeek = d.getDay();
    const dateStr = d.toISOString().split('T')[0];
    return dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr);
  };

  // 1. Find the last business day of the month
  const lastDay = new Date(year, month + 1, 0);
  let lastBizDayDate = lastDay.getDate();
  while (lastBizDayDate > 0) {
    const d = new Date(year, month, lastBizDayDate);
    if (isBusinessDay(d)) break;
    lastBizDayDate--;
  }

  // 2. Count back 3 business days starting from the day BEFORE the last business day
  let date = lastBizDayDate - 1;
  let businessDaysFound = 0;
  
  while (businessDaysFound < 3 && date > 0) {
    const current = new Date(year, month, date);
    if (isBusinessDay(current)) {
      businessDaysFound++;
    }
    if (businessDaysFound < 3) date--;
  }
  
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
};

export const fetchRealTimeThaiHolidays = async (year: number): Promise<Holiday[]> => {
  try {
    const response = await fetch(`/api/holidays/${year}`);
    if (!response.ok) throw new Error('Failed to fetch real-time holidays');
    const apiHolidays = await response.json();
    
    // Merge local high-quality names with API data
    const localHolidays = getThaiHolidays(year);
    const mergedHolidays = [...localHolidays];

    apiHolidays.forEach((apiH: Holiday) => {
      const exists = mergedHolidays.find(h => h.date === apiH.date);
      if (!exists) {
        mergedHolidays.push(apiH);
      }
    });

    return mergedHolidays.sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Falling back to local holiday list:', error);
    return getThaiHolidays(year);
  }
};
