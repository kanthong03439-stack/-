import React, { createContext, useContext, useState, useEffect } from 'react';

interface AcademicYearContextType {
  selectedYear: string;
  selectedTerm: string;
  setSelectedYear: (year: string) => void;
  setSelectedTerm: (term: string) => void;
}

const AcademicYearContext = createContext<AcademicYearContextType | undefined>(undefined);

export function AcademicYearProvider({ children }: { children: React.ReactNode }) {
  const [selectedYear, setSelectedYear] = useState(() => {
    return localStorage.getItem('selectedYear') || '2568';
  });
  const [selectedTerm, setSelectedTerm] = useState(() => {
    return localStorage.getItem('selectedTerm') || '2';
  });

  useEffect(() => {
    localStorage.setItem('selectedYear', selectedYear);
  }, [selectedYear]);

  useEffect(() => {
    localStorage.setItem('selectedTerm', selectedTerm);
  }, [selectedTerm]);

  return (
    <AcademicYearContext.Provider value={{ selectedYear, selectedTerm, setSelectedYear, setSelectedTerm }}>
      {children}
    </AcademicYearContext.Provider>
  );
}

export function useAcademicYear() {
  const context = useContext(AcademicYearContext);
  if (context === undefined) {
    throw new Error('useAcademicYear must be used within an AcademicYearProvider');
  }
  return context;
}
