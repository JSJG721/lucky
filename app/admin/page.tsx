'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';

export default function AdminPage() {
  const [numbers, setNumbers] = useState<number[]>([]);
  const [isAutoDraw, setIsAutoDraw] = useState(true);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ number: number; count: number }[]>([]);
  const [allDraws, setAllDraws] = useState<any[]>([]);
  const [winningHistory, setWinningHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: settings } = await supabase.from('app_settings').select('is_auto_draw').eq('id', 'draw_setting').maybeSingle();
      if (settings) setIsAutoDraw(settings.is_auto_draw);

      const { data: wins } = await supabase.from('winning_numbers').select('*').order('draw_date', { ascending: false });
      if (wins && wins.length > 0) {
        setNumbers(wins[0].numbers);
        setWinningHistory(wins);
      }

      const { data: draws } = await supabase.from('lucky_draws').select('*').order('created_at', { ascending: false });
      if (draws) {
        setAllDraws(draws);
        const counts: { [key: number]: number } = {};
        draws.forEach(draw => {
          draw.selected_numbers?.forEach((n: number) => { counts[n] = (counts[n] || 0) + 1; });
        });
        const sortedStats = Object.entries(counts).map(([num, count]) => ({ number: Number(num), count })).sort((a, b) => b.count - a.count).slice(0, 5);
        setStats(sortedStats);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  // [핵심 추가] 번호를 직접 클릭해서 선택하는 로직
  const toggleSelectNumber = (n: number) => {
    if (numbers.includes(n)) {
      setNumbers(numbers.filter(num => num !== n).sort((a, b) => a - b));
    } else {
      if (numbers.length >= 5) {
        alert("당첨 번호는 5개까지만 선택 가능합니다.");
        return;
      }
      setNumbers([...numbers, n].sort((a, b) => a - b));
    }
  };

  const toggleDrawMode = async (mode: boolean) => {
    setIsAutoDraw(mode);
    await supabase.from('app_settings').upsert({ id: 'draw_setting', is_auto_draw: mode });
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
    if (numbers.length !== 5) return alert("당첨 번호 5개를 모두 완성해주세요.");
    setLoading(true);
    const kstDate = new Date(new Date().getTime() + (9 * 60 * 60 * 1000)).toISOString().split('T')[0];
    const { error } = await supabase.from('winning_numbers').upsert({ draw_date: kstDate, numbers });
    if (!error) {
      alert(`${kstDate} 당첨 번호가 발행되었습니다!`);
      fetchData();
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans pb-20">
      <div className="max-w-7xl mx-auto space-y-8">
        <h1 className="text-3xl font-black text-yellow-500 italic uppercase tracking-tighter">Admin Dashboard</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* 좌측 컨트롤 영역 */}
          <div className="lg:col-span-4 space-y-6">
            <section className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
              <h2 className="text-[10px] font-black text-slate-500 mb-4 tracking-widest uppercase">Draw Method</h2>
              <div className="flex gap-2 p-1 bg-slate-950 rounded-2xl">
                <button onClick={() => toggleDrawMode(true)} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${isAutoDraw ? 'bg-yellow-500 text-black' : 'text-slate-500'}`}>AUTO</button>
                <button onClick={() => toggleDrawMode(false)} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${!isAutoDraw ? 'bg-yellow-500 text-black' : 'text-slate-500'}`}>MANUAL</button>
              </div>
            </section>

            <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
              <h2 className="text-[10px] font-black text-slate-500 mb-6 tracking-widest uppercase text-center">Selected Winning Numbers</h2>
              <div className="flex justify-center mb-8 gap-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-10 h-10 bg-slate-950 border border-yellow-500/20 rounded-xl flex items-center justify-center font-black text-yellow-500">
                    {numbers[i] || ''}
                  </div>
                ))}
              </div>

              {/* [수정] 직접 번호 선택판 추가 */}
              <div className="grid grid-cols-7 gap-1.5 mb-8">
                {Array.from({ length: 28 }, (_, i) => i + 1).map(n => (
                  <button 
                    key={n} 
                    onClick={() => toggleSelectNumber(n)}
                    className={`aspect-square rounded-lg text-[10px] font-bold border transition-all ${numbers.includes(n) ? 'bg-yellow-500 border-yellow-500 text-black' : 'bg-slate-950 border-slate-800 text-slate-600'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <button onClick={generateRandomWinningNumbers} className="w-full py-4 bg-slate-800 text-yellow-500 rounded-2xl font-black text-xs">RANDOMIZE</button>
                <button onClick={handleSaveNumbers} disabled={loading || numbers.length !== 5} className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs disabled:bg-slate-700">PUBLISH RESULTS</button>
              </div>
            </section>
          </div>

          {/* 우측 데이터 영역 */}
          <div className="lg:col-span-8 space-y-6">
            <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-xl">
              <h2 className="text-[10px] font-black text-slate-400 mb-6 tracking-widest uppercase">Winning History</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                {winningHistory.map((win, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50">
                    <span className="text-[10px] font-mono text-slate-500">{win.draw_date}</span>
                    <div className="flex gap-1.5">{win.numbers.map((n: any, idx: any) => (<span key={idx} className="text-yellow-500 font-black text-xs">{n}</span>))}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-xl flex flex-col h-[500px]">
              <h2 className="text-[10px] font-black text-slate-400 mb-6 tracking-widest uppercase">All User Entries ({allDraws.length})</h2>
              <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-slate-900 border-b border-slate-800">
                    <tr className="text-[9px] text-slate-500 font-black uppercase tracking-wider">
                      <th className="pb-4">User ID</th>
                      <th className="pb-4">Selected</th>
                      <th className="pb-4 text-right">Date/Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/30">
                    {allDraws.map((d, i) => (
                      <tr key={i} className="hover:bg-slate-800/20">
                        <td className="py-4 text-[10px] font-mono text-slate-500 truncate max-w-[120px]">{d.user_id}</td>
                        <td className="py-4"><div className="flex gap-1">{d.selected_numbers?.map((n: any, idx: any) => (<span key={idx} className="text-yellow-500 font-black text-[11px]">{n}</span>))}</div></td>
                        <td className="py-4 text-right text-[10px] text-slate-600 font-mono">{new Date(d.created_at).toLocaleString('ko-KR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

        </div>
      </div>
    </div>
  );
}