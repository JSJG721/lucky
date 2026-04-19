'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/src/lib/supabase'; 

export default function Home() {
  const [drawResult, setDrawResult] = useState<{ draw_date: string; numbers: number[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState("");

  // 1. 데이터 로드 로직 (한국 시간 기준)
  const fetchData = async () => {
    try {
      const now = new Date();
      const kstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)).toISOString().split('T')[0];

      // 당첨 번호 가져오기
      const { data: winData } = await supabase
        .from('winning_numbers')
        .select('numbers, draw_date')
        .eq('draw_date', kstDate)
        .single();

      if (winData) {
        setDrawResult({ draw_date: winData.draw_date, numbers: winData.numbers });
      } else {
        const { data: lastData } = await supabase
          .from('winning_numbers')
          .select('numbers, draw_date')
          .order('draw_date', { ascending: false })
          .limit(1)
          .single();
        if (lastData) setDrawResult({ draw_date: lastData.draw_date, numbers: lastData.numbers });
      }

      // 내 응모 내역 가져오기
      const { data: histData } = await supabase
        .from('lucky_draws')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      if (histData) setHistory(histData);
    } catch (err) {
      console.error("데이터 로드 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => {
      const now = new Date();
      const target = new Date();
      target.setHours(21, 0, 0, 0);
      if (now > target) target.setDate(target.getDate() + 1);
      const diff = target.getTime() - now.getTime();
      const h = String(Math.floor((diff / (1000 * 60 * 60)) % 24)).padStart(2, '0');
      const m = String(Math.floor((diff / (1000 * 60)) % 60)).padStart(2, '0');
      const s = String(Math.floor((diff / 1000) % 60)).padStart(2, '0');
      setTimeLeft(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleNumber = (num: number) => {
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== num));
    } else if (selectedNumbers.length < 5) {
      setSelectedNumbers([...selectedNumbers, num].sort((a, b) => a - b));
    }
  };

  const generateLuckyNumbers = () => {
    const lucky: number[] = [];
    while (lucky.length < 5) {
      const num = Math.floor(Math.random() * 28) + 1;
      if (!lucky.includes(num)) lucky.push(num);
    }
    setSelectedNumbers(lucky.sort((a, b) => a - b));
  };

  const handleSubmit = async () => {
    if (selectedNumbers.length !== 5) return;
    const { data, error } = await supabase
      .from('lucky_draws')
      .insert([{ selected_numbers: selectedNumbers }])
      .select();

    if (!error && data) {
      alert(`🎉 응모 완료!`);
      setHistory([data[0], ...history]);
      setSelectedNumbers([]);
    }
  };

  const checkWinStatus = (selected: number[], winning: number[]) => {
    if (!winning || winning.length === 0) return null;
    const matchedCount = selected.filter(n => winning.includes(n)).length;
    if (matchedCount === 5) return { text: "1등 당첨!", color: "text-red-500", bg: "bg-red-500/10" };
    if (matchedCount === 4) return { text: "2등 당첨", color: "text-orange-500", bg: "bg-orange-500/10" };
    if (matchedCount === 3) return { text: "3등 당첨", color: "text-yellow-500", bg: "bg-yellow-500/10" };
    return { text: `${matchedCount}개 일치`, color: "text-slate-500", bg: "bg-slate-800/50" };
  };

  return (
    <main className="min-h-screen bg-[#0b1120] text-white flex flex-col items-center p-4 md:p-6 font-sans overflow-x-hidden">
      
      {/* 당첨 번호 섹션 */}
      <div className="w-full max-w-xl bg-slate-900/60 border border-slate-800 rounded-[2rem] p-5 md:p-6 mt-2 mb-8 text-center shadow-xl">
        <p className="text-slate-400 text-[10px] md:text-xs mb-4 font-bold tracking-widest uppercase opacity-80">Today's Winning Numbers</p>
        <div className="flex justify-center gap-2 md:gap-4 mb-2">
          {loading ? (
            <div className="h-11 md:h-16 flex items-center text-slate-500">Loading...</div>
          ) : (
            drawResult?.numbers.map((num, idx) => (
              <div key={idx} className="w-11 h-11 md:w-16 md:h-16 flex items-center justify-center rounded-full bg-gradient-to-br from-yellow-100 via-yellow-400 to-yellow-600 text-slate-900 font-black text-lg md:text-2xl shadow-lg border-t-2 border-white/40 animate-bounce" style={{ animationDelay: `${idx * 0.15}s` }}>
                {num}
              </div>
            ))
          )}
        </div>
        <p className="text-slate-500 font-bold text-[10px] md:text-xs mt-3 font-mono">{drawResult?.draw_date || 'AWAITING'}</p>
      </div>

      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-5xl font-black mb-3 uppercase tracking-tighter">Premium Draw</h1>
          <div className="inline-block bg-slate-900/80 border border-slate-800 rounded-full px-6 py-2">
            <p className="text-yellow-500 text-xl md:text-2xl font-black font-mono tracking-widest">{timeLeft || "00:00:00"}</p>
          </div>
        </div>

        <div className="flex justify-between items-end mb-4 px-1">
          <div>
            <p className="text-slate-500 text-[10px] mb-1 font-bold uppercase tracking-widest">My Selection</p>
            <p className="text-yellow-400 font-black text-2xl md:text-3xl tracking-tighter h-9">
              {selectedNumbers.length > 0 ? selectedNumbers.join(' · ') : '— — — — —'}
            </p>
          </div>
          <button onClick={generateLuckyNumbers} className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-[11px] font-bold active:scale-95 transition-all shadow-lg">✨ AUTO</button>
        </div>

        {/* 번호판 */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 md:gap-3 mb-8 w-full">
          {Array.from({ length: 28 }, (_, i) => i + 1).map(num => (
            <button
              key={num}
              onClick={() => toggleNumber(num)}
              className={`h-16 sm:h-14 rounded-2xl text-base md:text-sm font-bold transition-all border ${
                selectedNumbers.includes(num)
                  ? 'bg-yellow-500 text-slate-900 border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.4)]'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 active:bg-slate-800'
              }`}
            >
              {num}
            </button>
          ))}
        </div>

        <button 
          onClick={handleSubmit}
          disabled={selectedNumbers.length < 5}
          className="w-full py-5 rounded-[1.5rem] font-black text-xl transition-all mb-12 disabled:bg-slate-800 disabled:text-slate-600 enabled:bg-gradient-to-b enabled:from-[#e2c99d] enabled:to-[#b89b6a] enabled:text-[#2d2412] active:scale-[0.97]"
        >
          {selectedNumbers.length === 5 ? 'CONFIRM DRAW' : 'SELECT 5 NUMBERS'}
        </button>

        {/* 내 기록 섹션 */}
        <div className="w-full bg-slate-900/30 border border-slate-800/50 rounded-[2rem] p-5 md:p-6 mb-10">
          <h3 className="text-slate-400 font-bold text-[10px] mb-6 uppercase tracking-[0.2em] text-center">Recent Records</h3>
          <div className="space-y-4">
            {history.map((record, i) => {
              const status = checkWinStatus(record.selected_numbers, drawResult?.numbers || []);
              return (
                <div key={i} className="flex flex-col gap-3 bg-slate-800/20 p-4 rounded-2xl border border-slate-800/40">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 text-[10px] font-mono">{new Date(record.created_at).toLocaleDateString()}</span>
                    <span className={`px-2 py-1 rounded-md border ${status?.bg} ${status?.color} border-current text-[10px] font-black`}>
                      {status?.text}
                    </span>
                  </div>
                  <div className="flex gap-2 justify-center">
                    {record.selected_numbers.map((n: number, idx: number) => (
                      <span key={idx} className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-xs border ${
                        drawResult?.numbers.includes(n) ? 'bg-yellow-500 text-slate-900 border-white' : 'bg-slate-900 text-slate-500 border-slate-700'
                      }`}>
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}} />
    </main>
  );
}