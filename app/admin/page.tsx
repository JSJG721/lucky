'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';

export default function AdminPage() {
  const [numbers, setNumbers] = useState<number[]>([1, 2, 3, 4, 5]);
  const [isAutoDraw, setIsAutoDraw] = useState(true);
  const [loading, setLoading] = useState(false);

  // 1. 초기 데이터(설정 및 현재 번호) 불러오기
  useEffect(() => {
    const fetchData = async () => {
      // 추첨 방식 설정 불러오기
      const { data: settings } = await supabase
        .from('app_settings')
        .select('is_auto_draw')
        .eq('id', 'draw_setting')
        .single();
      if (settings) setIsAutoDraw(settings.is_auto_draw);

      // 현재 저장된 당첨 번호 불러오기 (가장 최근 것)
      const { data: winNums } = await supabase
        .from('winning_numbers')
        .select('numbers')
        .order('draw_date', { ascending: false })
        .limit(1)
        .single();
      if (winNums) setNumbers(winNums.numbers);
    };
    fetchData();
  }, []);

  // 2. 추첨 방식 변경 함수
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

  // 3. 수동으로 번호 저장하는 함수
  const handleSaveNumbers = async () => {
    setLoading(true);
    const now = new Date();
    const kstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)).toISOString().split('T')[0];

    const { error } = await supabase
      .from('winning_numbers')
      .upsert({ draw_date: kstDate, numbers });

    if (error) {
      alert('저장 실패: ' + error.message);
    } else {
      alert('오늘의 당첨 번호가 수동으로 저장되었습니다!');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center text-yellow-500">관리자 시스템</h1>

        {/* --- 추첨 방식 설정 --- */}
        <div className="bg-slate-900 p-6 rounded-2xl mb-8 border border-slate-800">
          <h2 className="text-xl font-semibold mb-4">추첨 방식 설정</h2>
          <div className="flex gap-4">
            <button 
              onClick={() => toggleDrawMode(true)}
              className={`flex-1 py-4 rounded-xl font-bold transition ${isAutoDraw ? 'bg-yellow-500 text-black' : 'bg-slate-800 text-slate-500'}`}
            >
              자동 추첨 (밤 9시)
            </button>
            <button 
              onClick={() => toggleDrawMode(false)}
              className={`flex-1 py-4 rounded-xl font-bold transition ${!isAutoDraw ? 'bg-yellow-500 text-black' : 'bg-slate-800 text-slate-500'}`}
            >
              수동 추첨 (직접 입력)
            </button>
          </div>
        </div>

        {/* --- 번호 입력 UI (수동 모드일 때만 활성화) --- */}
        <div className={`bg-slate-900 p-6 rounded-2xl border border-slate-800 transition-opacity ${isAutoDraw ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          <h2 className="text-xl font-semibold mb-4">
            {isAutoDraw ? "자동 추첨 모드 활성 중" : "당첨 번호 직접 입력"}
          </h2>
          
          <div className="flex justify-between mb-8">
            {numbers.map((num, i) => (
              <input
                key={i}
                type="number"
                value={num}
                onChange={(e) => {
                  const newNums = [...numbers];
                  newNums[i] = parseInt(e.target.value) || 0;
                  setNumbers(newNums);
                }}
                className="w-12 h-12 bg-slate-800 border border-slate-700 rounded-full text-center text-xl font-bold focus:border-yellow-500 outline-none"
              />
            ))}
          </div>

          <button
            onClick={handleSaveNumbers}
            disabled={loading || isAutoDraw}
            className="w-full py-4 bg-yellow-500 text-black rounded-xl font-bold hover:bg-yellow-400 disabled:bg-slate-700 disabled:text-slate-500"
          >
            {loading ? "저장 중..." : "당첨 번호 확정 저장"}
          </button>
          
          {isAutoDraw && (
            <p className="text-center text-slate-500 mt-4 text-sm">
              * 자동 모드에서는 번호를 직접 수정할 수 없습니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}