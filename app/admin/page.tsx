'use client';

import { useEffect, useState } from 'react';
// 파일 위치에 맞춰 경로를 자동 수정했습니다.
import { supabase } from '../../src/lib/supabase'; 

export default function AdminPage() {
  const [allEntries, setAllEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ [key: number]: number }>({});
  const [inputVal, setInputVal] = useState("");

  useEffect(() => {
    const fetchAllData = async () => {
      const { data, error } = await supabase
        .from('lucky_draws')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAllEntries(data);
        const counts: { [key: number]: number } = {};
        data.forEach(entry => {
          entry.selected_numbers.forEach((num: number) => {
            counts[num] = (counts[num] || 0) + 1;
          });
        });
        setStats(counts);
      }
      setLoading(false);
    };

    fetchAllData();
  }, []);

  const saveWinningNumbers = async () => {
    // 1. 입력값 정리
    const nums = inputVal.split(',')
      .map(n => parseInt(n.trim()))
      .filter(n => !isNaN(n) && n >= 1 && n <= 28);
    
    if (nums.length !== 5) {
      alert("1~28 사이의 숫자 5개를 쉼표(,)로 구분해서 입력해주세요.");
      return;
    }

    // 2. 한국 시간 기준 오늘 날짜 생성 (날짜 불일치 방지)
    const now = new Date();
    const kstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)).toISOString().split('T')[0];

    // 3. 데이터베이스에 저장 (Upsert: 없으면 생성, 있으면 업데이트)
    const { data, error } = await supabase
      .from('winning_numbers')
      .upsert(
        { 
          draw_date: kstDate, 
          numbers: nums 
        },
        { onConflict: 'draw_date' } // draw_date가 겹치면 업데이트 실행
      )
      .select();

    if (error) {
      console.error("저장 실패:", error.message);
      alert("저장 실패: " + error.message);
    } else {
      alert(`성공! 오늘(${kstDate})의 당첨 번호가 ${nums.join(', ')}로 업데이트되었습니다.`);
      setInputVal(""); // 입력창 비우기
      
      // 메인 페이지 등에 즉시 반영되도록 페이지 새로고침 (선택 사항)
      window.location.reload(); 
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0b1120] text-white flex items-center justify-center font-bold">데이터 분석 중...</div>;

  return (
    <main className="min-h-screen bg-[#0b1120] text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-black mb-8 border-l-4 border-yellow-500 pl-4 uppercase tracking-tighter">Admin Dashboard</h1>

        {/* 1. 당첨 번호 설정 섹션 */}
        <div className="bg-slate-900 border border-yellow-500/30 p-6 rounded-2xl mb-10 shadow-lg">
          <h2 className="text-lg font-bold mb-4 text-yellow-500 italic">Set Today's Winning Numbers</h2>
          <div className="flex flex-col md:flex-row gap-4">
            <input 
              type="text" 
              placeholder="예: 1, 5, 12, 22, 28" 
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 transition-all"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
            />
            <button 
              onClick={saveWinningNumbers}
              className="bg-yellow-500 text-slate-900 px-8 py-3 rounded-xl font-black hover:bg-yellow-400 transition-all active:scale-95"
            >
              번호 확정 및 배포
            </button>
          </div>
          <p className="text-slate-500 text-[11px] mt-3 font-medium opacity-80">* 입력한 번호가 메인 페이지 상단 황금 공에 즉시 반영됩니다.</p>
        </div>

        {/* 2. 요약 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <p className="text-slate-400 text-xs mb-1 uppercase font-bold tracking-widest">Total Entries</p>
            <p className="text-4xl font-black text-yellow-500">{allEntries.length}<span className="text-sm ml-1 opacity-50">회</span></p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <p className="text-slate-400 text-xs mb-1 uppercase font-bold tracking-widest">Most Popular</p>
            <p className="text-4xl font-black text-blue-400">
              {Object.entries(stats).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <p className="text-slate-400 text-xs mb-1 uppercase font-bold tracking-widest">Active Users</p>
            <p className="text-4xl font-black text-green-400">{allEntries.length}<span className="text-sm ml-1 opacity-50">명</span></p>
          </div>
        </div>

        {/* 3. 전체 응모 리스트 테이블 */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-xl font-bold text-slate-200">Recent Entry Logs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800/50 text-slate-400 text-[10px] uppercase tracking-widest">
                  <th className="p-5 font-bold">Entry ID</th>
                  <th className="p-5 font-bold">Selected Numbers</th>
                  <th className="p-5 font-bold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {allEntries.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-800 hover:bg-slate-800/30 transition-all">
                    <td className="p-5 font-mono text-slate-500 text-[10px]">{entry.id.slice(0, 8)}...</td>
                    <td className="p-5">
                      <div className="flex gap-1">
                        {entry.selected_numbers.map((n: number) => (
                          <span key={n} className="w-7 h-7 flex items-center justify-center bg-slate-800 rounded-full text-yellow-500 text-[11px] font-bold border border-slate-700 shadow-sm">
                            {n}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-5 text-slate-400 text-xs font-medium">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}