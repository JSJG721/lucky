'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';

export default function Home() {
  const [history, setHistory] = useState<any[]>([]);
  const [winningNumbers, setWinningNumbers] = useState<number[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // 1. 당첨 번호 가져오기
    const { data: winData } = await supabase
      .from('winning_numbers')
      .select('*')
      .order('draw_date', { ascending: false })
      .limit(1)
      .single();
    if (winData) setWinningNumbers(winData.numbers);

    // 2. 내 응모 내역 가져오기
    const { data: drawData } = await supabase
      .from('lucky_draws')
      .select('*')
      .order('created_at', { ascending: false });
    if (drawData) setHistory(drawData);
  };

  // 응모 내역을 날짜별로 그룹화하는 로직
  const groupedHistory = history.reduce((groups: any, record: any) => {
    const date = new Date(record.created_at).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(record);
    return groups;
  }, {});

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 pb-24">
      <div className="max-w-md mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl font-black italic tracking-tighter text-yellow-500 mb-2">LUCKY DRAW</h1>
          <p className="text-slate-500 text-sm font-medium">매일 밤 9시, 당신의 행운을 확인하세요</p>
        </header>

        {/* 오늘 당첨 번호 섹션 */}
        <section className="bg-slate-900 rounded-3xl p-6 mb-10 border border-slate-800 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Winning Numbers</span>
            <span className="bg-yellow-500/10 text-yellow-500 text-[10px] px-2 py-1 rounded-full font-bold">LIVE</span>
          </div>
          <div className="flex justify-around items-center">
            {winningNumbers.length > 0 ? (
              winningNumbers.map((num, i) => (
                <div key={i} className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 flex items-center justify-center text-slate-950 text-xl font-black shadow-lg shadow-yellow-500/20">
                  {num}
                </div>
              ))
            ) : (
              <p className="text-slate-500">추첨 준비 중...</p>
            )}
          </div>
        </section>

        {/* 날짜별 응모 내역 섹션 */}
        <section className="space-y-10">
          <h3 className="text-lg font-bold px-1">My History</h3>
          
          {Object.keys(groupedHistory).length > 0 ? (
            Object.keys(groupedHistory).map((date) => (
              <div key={date} className="relative">
                {/* 날짜 구분선 */}
                <div className="flex items-center mb-4">
                  <div className="h-[1px] flex-1 bg-slate-800"></div>
                  <span className="px-3 text-[11px] font-bold text-slate-500 uppercase tracking-tighter">{date}</span>
                  <div className="h-[1px] flex-1 bg-slate-800"></div>
                </div>

                <div className="space-y-3">
                  {groupedHistory[date].map((record: any, i: number) => (
                    <div key={i} className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-4 flex justify-between items-center">
                      <div className="flex gap-2">
                        {record.numbers.map((n: number, j: number) => (
                          <span key={j} className={`text-sm font-bold ${winningNumbers.includes(n) ? 'text-yellow-500' : 'text-slate-400'}`}>
                            {n}
                          </span>
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-600 font-mono">
                        {new Date(record.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 bg-slate-900/30 rounded-3xl border border-dashed border-slate-800">
              <p className="text-slate-600 text-sm">아직 응모 내역이 없습니다.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}