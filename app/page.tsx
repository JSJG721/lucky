'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';

export default function Home() {
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [winningNumbers, setWinningNumbers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // 1. 당첨 번호 가져오기
    const { data: winData } = await supabase.from('winning_numbers').select('*').order('draw_date', { ascending: false }).limit(1).maybeSingle();
    if (winData) setWinningNumbers(winData.numbers);

    // 2. 응모 내역 가져오기
    const { data: drawData } = await supabase.from('lucky_draws').select('*').order('created_at', { ascending: false });
    if (drawData) setHistory(drawData);
  };

  // 번호 선택 로직
  const toggleNumber = (n: number) => {
    if (selectedNumbers.includes(n)) {
      setSelectedNumbers(selectedNumbers.filter(num => num !== n));
    } else if (selectedNumbers.length < 5) {
      setSelectedNumbers([...selectedNumbers, n].sort((a, b) => a - b));
    }
  };

  // 응모하기 버튼 클릭
  const handleSubmit = async () => {
    if (selectedNumbers.length !== 5) return alert('5개 번호를 선택해주세요!');
    setLoading(true);
    const { error } = await supabase.from('lucky_draws').insert([{ numbers: selectedNumbers }]);
    if (!error) {
      alert('응모 완료!');
      setSelectedNumbers([]);
      fetchData();
    }
    setLoading(false);
  };

  // 날짜별 그룹화 로직
  const groupedHistory = history.reduce((groups: any, record: any) => {
    const date = new Date(record.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    if (!groups[date]) groups[date] = [];
    groups[date].push(record);
    return groups;
  }, {});

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white p-6 pb-24 font-sans">
      <div className="max-w-md mx-auto space-y-10">
        
        {/* 헤더 */}
        <header className="text-center">
          <h1 className="text-4xl font-black italic text-yellow-500 tracking-tighter">LUCKY DRAW</h1>
          <p className="text-slate-500 text-[10px] tracking-[0.2em] uppercase mt-2">Daily Luck & Fortune</p>
        </header>

        {/* 오늘 당첨 번호 */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-6 text-center">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-4">Winning Numbers</span>
          <div className="flex justify-center gap-3">
            {winningNumbers.length > 0 ? winningNumbers.map((n, i) => (
              <div key={i} className="w-10 h-10 rounded-full bg-yellow-500 text-black flex items-center justify-center font-black shadow-lg shadow-yellow-500/20">{n}</div>
            )) : <p className="text-slate-600 text-sm italic">대기 중...</p>}
          </div>
        </section>

        {/* 번호 선택 판 */}
        <section>
          <div className="grid grid-cols-7 gap-2 mb-6">
            {Array.from({ length: 28 }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => toggleNumber(n)}
                className={`aspect-square rounded-xl text-sm font-bold transition-all ${
                  selectedNumbers.includes(n) ? 'bg-yellow-500 text-black scale-95' : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >{n}</button>
            ))}
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading || selectedNumbers.length !== 5}
            className="w-full py-4 bg-white text-black rounded-2xl font-black tracking-widest disabled:bg-slate-800 disabled:text-slate-600 transition-all active:scale-95"
          >
            {loading ? 'SENDING...' : `SELECT ${selectedNumbers.length}/5 & DRAW`}
          </button>
        </section>

        {/* 내 기록 (날짜별) */}
        <section className="space-y-6">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">My History</h2>
          {Object.keys(groupedHistory).map(date => (
            <div key={date} className="space-y-3">
              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-700">
                <span className="whitespace-nowrap">{date}</span>
                <div className="h-px w-full bg-slate-900"></div>
              </div>
              <div className="space-y-2">
                {groupedHistory[date].map((record: any, i: number) => (
                  <div key={i} className="bg-slate-900/30 border border-slate-800/50 rounded-2xl p-4 flex justify-between items-center">
                    <div className="flex gap-2">
                      {record.numbers?.map((n: number, j: number) => (
                        <span key={j} className={`text-sm font-black ${winningNumbers.includes(n) ? 'text-yellow-500' : 'text-slate-600'}`}>{n}</span>
                      ))}
                    </div>
                    <span className="text-[9px] text-slate-700 font-mono">{new Date(record.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

      </div>
    </div>
  );
}