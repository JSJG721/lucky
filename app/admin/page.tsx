'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';

export default function AdminPage() {
  const [numbers, setNumbers] = useState<number[]>([1, 2, 3, 4, 5]);
  const [isAutoDraw, setIsAutoDraw] = useState(true);
  const [loading, setLoading] = useState(false);
  
  // 통계 데이터 상태
  const [stats, setStats] = useState<{ number: number; count: number }[]>([]);
  const [recentDraws, setRecentDraws] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // 1. 추첨 방식 설정 불러오기
    const { data: settings } = await supabase
      .from('app_settings')
      .select('is_auto_draw')
      .eq('id', 'draw_setting')
      .single();
    if (settings) setIsAutoDraw(settings.is_auto_draw);

    // 2. 현재 당첨 번호 불러오기
    const { data: winNums } = await supabase
      .from('winning_numbers')
      .select('numbers')
      .order('draw_date', { ascending: false })
      .limit(1)
      .single();
    if (winNums) setNumbers(winNums.numbers);

    // 3. 유저 응모 통계 및 최근 내역 불러오기
    const { data: allDraws } = await supabase
      .from('lucky_draws')
      .select('*')
      .order('created_at', { ascending: false });

    if (allDraws) {
      setRecentDraws(allDraws.slice(0, 10)); // 최근 10건만
      
      // 인기 번호 계산
      const counts: { [key: number]: number } = {};
      allDraws.forEach(draw => {
        draw.numbers.forEach((n: number) => {
          counts[n] = (counts[n] || 0) + 1;
        });
      });
      const sortedStats = Object.entries(counts)
        .map(([num, count]) => ({ number: Number(num), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // 상위 5개
      setStats(sortedStats);
    }
  };

  const toggleDrawMode = async (mode: boolean) => {
    const { error } = await supabase
      .from('app_settings')
      .update({ is_auto_draw: mode })
      .eq('id', 'draw_setting');
    if (!error) {
      setIsAutoDraw(mode);
      alert(`추첨 방식이 ${mode ? '자동' : '수동'}으로 변경되었습니다.`);
    }
  };

  const handleSaveNumbers = async () => {
    setLoading(true);
    const now = new Date();
    const kstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)).toISOString().split('T')[0];
    const { error } = await supabase.from('winning_numbers').upsert({ draw_date: kstDate, numbers });
    if (!error) alert('저장되었습니다!');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* 왼쪽: 설정 및 입력 */}
        <div className="space-y-8">
          <h1 className="text-3xl font-bold text-yellow-500">Admin Control</h1>
          
          <section className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-lg font-bold mb-4">추첨 방식</h2>
            <div className="flex gap-2">
              <button onClick={() => toggleDrawMode(true)} className={`flex-1 py-3 rounded-xl font-bold ${isAutoDraw ? 'bg-yellow-500 text-black' : 'bg-slate-800 text-slate-500'}`}>자동</button>
              <button onClick={() => toggleDrawMode(false)} className={`flex-1 py-3 rounded-xl font-bold ${!isAutoDraw ? 'bg-yellow-500 text-black' : 'bg-slate-800 text-slate-500'}`}>수동</button>
            </div>
          </section>

          <section className={`bg-slate-900 p-6 rounded-2xl border border-slate-800 ${isAutoDraw ? 'opacity-50 pointer-events-none' : ''}`}>
            <h2 className="text-lg font-bold mb-4 text-slate-300">당첨 번호 직접 입력</h2>
            <div className="flex justify-between mb-6">
              {numbers.map((num, i) => (
                <input key={i} type="number" value={num} onChange={(e) => {
                  const newNums = [...numbers];
                  newNums[i] = parseInt(e.target.value) || 0;
                  setNumbers(newNums);
                }} className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-full text-center font-bold focus:border-yellow-500 outline-none" />
              ))}
            </div>
            <button onClick={handleSaveNumbers} disabled={isAutoDraw} className="w-full py-3 bg-yellow-500 text-black rounded-xl font-bold">번호 확정 저장</button>
          </section>
        </div>

        {/* 오른쪽: 데이터 통계 */}
        <div className="space-y-8">
          <section className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-lg font-bold mb-4 text-yellow-500">인기 있는 번호 TOP 5</h2>
            <div className="space-y-3">
              {stats.map((s, i) => (
                <div key={i} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-xl">
                  <span className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold">{s.number}</span>
                  <span className="text-slate-400">{s.count}회 선택됨</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-lg font-bold mb-4 text-slate-300">최근 유저 응모 현황</h2>
            <div className="space-y-2">
              {recentDraws.map((d, i) => (
                <div key={i} className="text-xs flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-500">{new Date(d.created_at).toLocaleTimeString()}</span>
                  <span className="font-mono text-yellow-500/80">{d.numbers.join(', ')}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

      </div>
    </div>
  );
}