import { NextResponse } from 'next/server';
import { supabase } from '@/src/lib/supabase';

export async function GET() {
  try {
    // 1. 관리자가 설정한 추첨 방식 확인 (자동/수동)
    const { data: settings } = await supabase
      .from('app_settings')
      .select('is_auto_draw')
      .eq('id', 'draw_setting')
      .single();

    // 수동 모드라면 자동 추첨을 진행하지 않고 종료
    if (settings && !settings.is_auto_draw) {
      return NextResponse.json({ message: "현재 수동 추첨 모드입니다." });
    }

    // 2. 한국 시간(KST) 기준 오늘 날짜 구하기
    const now = new Date();
    const kstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)).toISOString().split('T')[0];

    // 3. 오늘 이미 추첨이 완료되었는지 확인
    const { data: existing } = await supabase
      .from('winning_numbers')
      .select('*')
      .eq('draw_date', kstDate)
      .single();

    if (existing) {
      return NextResponse.json({ message: "오늘 추첨이 이미 완료되었습니다.", numbers: existing.numbers });
    }

    // 4. 새로운 랜덤 번호 5개 생성 (1~28)
    const newNumbers: number[] = [];
    while (newNumbers.length < 5) {
      const n = Math.floor(Math.random() * 28) + 1;
      if (!newNumbers.includes(n)) newNumbers.push(n);
    }
    newNumbers.sort((a, b) => a - b);

    // 5. DB에 새로운 당첨 번호 저장
    const { error: insertError } = await supabase
      .from('winning_numbers')
      .insert([{ draw_date: kstDate, numbers: newNumbers }]);

    if (insertError) throw insertError;

    return NextResponse.json({ 
      message: "자동 추첨이 성공적으로 완료되었습니다!", 
      date: kstDate, 
      numbers: newNumbers 
    });

  } catch (error: any) {
    console.error("추첨 중 에러 발생:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}