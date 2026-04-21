'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';

export default function Home() {
  const [history, setHistory] = useState<any[]>([]);
  const [winningNumbers, setWinningNumbers] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // 1. 당첨 번호 가져오기 (없을 수도 있으므로 maybeSingle 사용)
      const { data: winData } = await supabase
        .from('winning_numbers')
        .select('*')
        .order('draw_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (winData && winData.numbers) {
        setWinningNumbers(winData.numbers);
      }

      // 2. 내 응모 내역 가져오기
      const { data: drawData } = await supabase
        .from('lucky_draws')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (drawData) {
        setHistory(drawData);
      }
    } catch (error) {
      console.error("데이터 로딩 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  // 응모 내역 날짜별 그룹화 (데이터가 있을 때만 실행)
  const groupedHistory = history.reduce((groups: any, record: any) => {
    if (!record.created_at) return groups;
    const date = new Date(record.created_at).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(record);
    return groups;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-yellow-500 font-bold animate-pulse">행운을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 pb-24">
      <div className="max-w-md mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl font-black italic tracking-tighter text-yellow-500 mb-2">LUCKY DRAW</h1>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">Daily Luck & Fortune</p>
        </header>

        {/* 당첨 번호 섹션 */}
        <section className="bg-slate-900 rounded-3xl p-6 mb-10 border border-slate-800 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Winning Numbers</span>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></div>
              <span className="text-red-500 text-[10px] font-bold">LIVE</span>
            </div>
          </div>
          <div className="flex justify-around items-center">
            {winningNumbers.length > 0 ? (
              winningNumbers.map((num, i) => (
                <div key={i} className="w-11 h-11 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 flex items-center justify-center text-slate-950 text-lg font-black shadow-lg shadow-yellow-500/20">
                  {num}
                </div>
              ))
            ) : (
              <p className="text-slate-600 text-sm italic">추첨 데이터가 없습니다.</p>
            )}
          </div>
        </section>

        {/* 응모 내역 섹션 */}
        <section className="space-y-8">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest px-1">My History</h3>
          
          {Object.keys(groupedHistory).length > 0 ? (
            Object.keys(groupedHistory).map((date) => (
              <div key={date} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap">{date}</span>
                  <div className="h-[1px] w-full bg-slate-900"></div>
                </div>

                <div className="grid gap-2">
                  {groupedHistory[date].map((record: any, i: number) => (
                    <div key={i} className="bg-slate-900/40 border border-slate-800/50 rounded-2xl p-4 flex justify-between items-center">
                      <div className="flex gap-2">
                        {record.numbers?.map((n: number, j: number) => (
                          <span key={j} className={`text-sm font-black ${winningNumbers.includes(n) ? 'text-yellow-500' : 'text-slate-500'}`}>
                            {n}
                          </span>
                        ))}
                      </div>
                      <span className="text-[9px] text-slate-700 font-mono">
                        {new Date(record.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-16 bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
              <p className="text-slate-700 text-xs">아직 응모한 내역이 없습니다.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}