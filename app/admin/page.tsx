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
    try {
      // 1. 추첨 방식 설정 가져오기
      const { data: settings } = await supabase.from('app_settings').select('is_auto_draw').eq('id', 'draw_setting').maybeSingle();
      if (settings) setIsAutoDraw(settings.is_auto_draw);

      // 2. 현재 당첨 번호 가져오기
      const { data: winNums } = await supabase.from('winning_numbers').select('numbers').order('draw_date', { ascending: false }).limit(1).maybeSingle();
      if (winNums) setNumbers(winNums.numbers);

      // 3. 응모 현황 및 통계 계산 (핵심 수정: selected_numbers 사용)
      const { data: allDraws } = await supabase.from('lucky_draws').select('*').order('created_at', { ascending: false });
      
      if (allDraws && allDraws.length > 0) {
        setRecentDraws(allDraws.slice(0, 10)); // 최근 10개 표시
        
        const counts: { [key: number]: number } = {};
        allDraws.forEach(draw => {
          // 데이터베이스 컬럼명인 selected_numbers를 참조합니다.
          const nums = draw.selected_numbers; 
          if (nums && Array.isArray(nums)) {
            nums.forEach((n: number) => { 
              counts[n] = (counts[n] || 0) + 1; 
            });
          }
        });

        const sortedStats = Object.entries(counts)
          .map(([num, count]) => ({ number: Number(num), count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5); // 상위 5개 추출
        
        setStats(sortedStats);
      }
    } catch (err) {
      console.error("데이터 로딩 에러:", err);
    }
  };

  const toggleDrawMode = async (mode: boolean) => {
    setIsAutoDraw(mode);
    await supabase.from('app_settings').upsert({ id: 'draw_setting', is_auto_draw: mode });
    alert(`추첨 방식이 ${mode ? '자동' : '수동'}으로 변경되었습니다.`);
  };

  const handleSaveNumbers = async () => {
    setLoading(true);
    const kstDate = new Date(new Date().getTime() + (9 * 60 * 60 * 1000)).toISOString().split('T')[0];
    await supabase.from('winning_numbers').upsert({ draw_date: kstDate, numbers });
    alert('저장되었습니다!');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <h1 className="text-3xl font-black text-yellow-500 italic">ADMIN DASHBOARD</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
              <h2 className="text-sm font-bold text-slate-400 mb-4 tracking-widest uppercase">Draw Mode</h2>
              <div className="flex gap-3">
                <button onClick={() => toggleDrawMode(true)} className={`flex-1 py-4 rounded-2xl font-bold transition-all ${isAutoDraw ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-slate-800 text-slate-500'}`}>AUTO</button>
                <button onClick={() => toggleDrawMode(false)} className={`flex-1 py-4 rounded-2xl font-bold transition-all ${!isAutoDraw ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-slate-800 text-slate-500'}`}>MANUAL</button>
              </div>
            </div>

            <div className={`bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl transition-all ${isAutoDraw ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
              <h2 className="text-sm font-bold text-slate-400 mb-6 tracking-widest uppercase">Manual Input</h2>
              <div className="flex justify-between mb-8">
                {numbers.map((num, i) => (
                  <input key={i} type="number" value={num} onChange={(e) => {
                    const newNums = [...numbers];
                    newNums[i] = parseInt(e.target.value) || 0;
                    setNumbers(newNums);
                  }} className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-full text-center font-black text-yellow-500 text-xl focus:border-yellow-500 outline-none shadow-inner" />
                ))}
              </div>
              <button onClick={handleSaveNumbers} disabled={loading} className="w-full py-4 bg-white text-black rounded-2xl font-black hover:bg-yellow-500 transition-colors">SAVE NUMBERS</button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
              <h2 className="text-sm font-bold text-yellow-500 mb-4 tracking-widest uppercase">Popular Numbers</h2>
              <div className="grid grid-cols-1 gap-2">
                {stats.length > 0 ? stats.map((s, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-800/50">
                    <span className="w-8 h-8 rounded-full bg-yellow-500 text-black flex items-center justify-center font-black text-sm">{s.number}</span>
                    <span className="text-slate-400 font-bold">{s.count} times</span>
                  </div>
                )) : <p className="text-slate-600 text-sm py-4">No data yet</p>}
              </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
              <h2 className="text-sm font-bold text-slate-400 mb-4 tracking-widest uppercase">Recent Activity</h2>
              <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                {recentDraws.length > 0 ? recentDraws.map((d, i) => (
                  <div key={i} className="flex justify-between items-center py-3 border-b border-slate-800 last:border-0">
                    <span className="text-[11px] text-slate-500 font-mono">{new Date(d.created_at).toLocaleTimeString()}</span>
                    <div className="flex gap-1">
                      {/* 여기도 selected_numbers를 사용하여 번호를 출력합니다. */}
                      {d.selected_numbers?.map((num: number, idx: number) => (
                        <span key={idx} className="text-yellow-500 font-black text-xs px-1">{num}</span>
                      ))}
                    </div>
                  </div>
                )) : <p className="text-slate-600 text-sm">No activity yet</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}