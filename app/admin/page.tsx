'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';

export default function AdminPage() {
  const [numbers, setNumbers] = useState<number[]>([1, 2, 3, 4, 5]);
  const [isAutoDraw, setIsAutoDraw] = useState(true);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ number: number; count: number }[]>([]);
  const [allDraws, setAllDraws] = useState<any[]>([]); // 모든 내역 저장용

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: settings } = await supabase.from('app_settings').select('is_auto_draw').eq('id', 'draw_setting').maybeSingle();
      if (settings) setIsAutoDraw(settings.is_auto_draw);

      const { data: winNums } = await supabase.from('winning_numbers').select('numbers').order('draw_date', { ascending: false }).limit(1).maybeSingle();
      if (winNums) setNumbers(winNums.numbers);

      // [수정] 모든 응모 내역 가져오기
      const { data: draws, error } = await supabase
        .from('lucky_draws')
        .select('*') // 나중에 유저 이메일 연동을 위해선 Supabase Auth 설정을 확인해야 합니다.
        .order('created_at', { ascending: false });
      
      if (draws) {
        setAllDraws(draws);

        // 통계 계산
        const counts: { [key: number]: number } = {};
        draws.forEach(draw => {
          const nums = draw.selected_numbers; 
          if (nums && Array.isArray(nums)) {
            nums.forEach((n: number) => { counts[n] = (counts[n] || 0) + 1; });
          }
        });

        const sortedStats = Object.entries(counts)
          .map(([num, count]) => ({ number: Number(num), count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        
        setStats(sortedStats);
      }
    } catch (err) {
      console.error("데이터 로딩 에러:", err);
    }
  };

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
    const kstDate = new Date(new Date().getTime() + (9 * 60 * 60 * 1000)).toISOString().split('T')[0];
    await supabase.from('winning_numbers').upsert({ draw_date: kstDate, numbers });
    alert('발행되었습니다!');
    fetchData();
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans pb-20">
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-3xl font-black text-yellow-500 italic uppercase tracking-tighter">Admin Dashboard</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 왼쪽: 컨트롤 섹션 */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
              <h2 className="text-xs font-bold text-slate-500 mb-8 tracking-[0.2em] uppercase">Control</h2>
              <div className="flex justify-between mb-10 gap-2">
                {numbers.map((num, i) => (
                  <div key={i} className="w-10 h-10 bg-slate-950 border border-yellow-500/20 rounded-xl flex items-center justify-center font-black text-yellow-500 text-lg shadow-inner">{num}</div>
                ))}
              </div>
              <div className="space-y-3">
                <button onClick={generateRandomWinningNumbers} className="w-full py-4 bg-slate-800 text-yellow-500 rounded-2xl font-black hover:bg-slate-700 transition-all">GENERATE RANDOM</button>
                <button onClick={handleSaveNumbers} disabled={loading} className="w-full py-4 bg-white text-black rounded-2xl font-black hover:bg-yellow-500 transition-all">{loading ? 'SAVING...' : 'PUBLISH RESULTS'}</button>
              </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
              <h2 className="text-xs font-bold text-yellow-500 mb-4 tracking-widest uppercase">Popular Numbers</h2>
              <div className="grid grid-cols-1 gap-2">
                {stats.map((s, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-800/50">
                    <span className="w-8 h-8 rounded-full bg-yellow-500 text-black flex items-center justify-center font-black text-sm">{s.number}</span>
                    <span className="text-slate-400 font-bold">{s.count} times</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 오른쪽: 모든 사용자 응모 내역 (전체 내역) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-xl overflow-hidden h-full flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xs font-bold text-slate-400 tracking-widest uppercase">All User Entries ({allDraws.length})</h2>
                <button onClick={fetchData} className="text-[10px] text-yellow-500 font-bold border border-yellow-500/30 px-3 py-1 rounded-full">REFRESH</button>
              </div>
              
              <div className="overflow-y-auto pr-2 custom-scrollbar flex-1" style={{ maxHeight: '600px' }}>
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-slate-900 z-10 border-b border-slate-800">
                    <tr className="text-[10px] text-slate-500 font-black uppercase tracking-wider">
                      <th className="pb-4 pt-2">User ID (UUID)</th>
                      <th className="pb-4 pt-2">Selected Numbers</th>
                      <th className="pb-4 pt-2 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {allDraws.map((d, i) => (
                      <tr key={i} className="group hover:bg-slate-800/30 transition-colors">
                        <td className="py-4 text-[11px] font-mono text-slate-400 truncate max-w-[150px]">
                          {/* user_id를 표시합니다 (로그인 시 저장된 UUID) */}
                          {d.user_id || 'Guest'}
                        </td>
                        <td className="py-4">
                          <div className="flex gap-1.5">
                            {d.selected_numbers?.map((num: number, idx: number) => (
                              <span key={idx} className="text-yellow-500 font-black text-xs">{num}</span>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 text-right text-[10px] text-slate-600 font-mono">
                          {new Date(d.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}