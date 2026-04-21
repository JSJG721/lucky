'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';

export default function AdminPage() {
  const [numbers, setNumbers] = useState<number[]>([1, 2, 3, 4, 5]);
  const [isAutoDraw, setIsAutoDraw] = useState(true);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ number: number; count: number }[]>([]);
  const [recentDraws, setRecentDraws] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // ... 기존 fetchData 로직 (동일) ...
  };

  // [핵심 추가] 랜덤 당첨 번호 생성 함수
  const generateRandomWinningNumbers = () => {
    const randomNums: number[] = [];
    while (randomNums.length < 5) {
      const n = Math.floor(Math.random() * 28) + 1;
      if (!randomNums.includes(n)) randomNums.push(n);
    }
    setNumbers(randomNums.sort((a, b) => a - b));
  };

  const handleSaveNumbers = async () => {
    setLoading(true);
    // 한국 시간 기준으로 오늘 날짜 구하기
    const kstDate = new Date(new Date().getTime() + (9 * 60 * 60 * 1000)).toISOString().split('T')[0];
    
    const { error } = await supabase.from('winning_numbers').upsert({ 
      draw_date: kstDate, 
      numbers: numbers 
    });

    if (error) {
      alert('저장 실패: ' + error.message);
    } else {
      alert(`${kstDate} 당첨 번호가 저장되었습니다!`);
      fetchData();
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <h1 className="text-3xl font-black text-yellow-500 italic uppercase tracking-tighter">Admin Control</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            {/* 당첨 번호 생성 및 저장 섹션 */}
            <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
              <h2 className="text-xs font-bold text-slate-500 mb-8 tracking-[0.2em] uppercase">Winning Number Control</h2>
              
              <div className="flex justify-between mb-10 gap-2">
                {numbers.map((num, i) => (
                  <div key={i} className="w-12 h-12 bg-slate-950 border border-yellow-500/20 rounded-2xl flex items-center justify-center font-black text-yellow-500 text-xl shadow-inner">
                    {num}
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <button 
                  onClick={generateRandomWinningNumbers}
                  className="w-full py-4 bg-slate-800 text-yellow-500 rounded-2xl font-black hover:bg-slate-700 transition-all active:scale-95"
                >
                  GENERATE RANDOM NUMBERS
                </button>
                <button 
                  onClick={handleSaveNumbers}
                  disabled={loading}
                  className="w-full py-4 bg-yellow-500 text-black rounded-2xl font-black hover:bg-yellow-400 transition-all active:scale-95 disabled:bg-slate-700"
                >
                  {loading ? 'SAVING...' : 'PUBLISH RESULTS'}
                </button>
              </div>
            </div>

            {/* 나머지 통계 섹션 (기존과 동일) */}
            {/* ... */}
          </div>
        </div>
      </div>
    </div>
  );
}