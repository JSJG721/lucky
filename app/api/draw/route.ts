import { NextResponse } from 'next/server';
import { supabase } from '@/src/lib/supabase'; 

export async function GET() {
  try {
    const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD 형식

    // 1. 오늘 이미 추첨했는지 확인
    const { data: existing } = await supabase
      .from('draw_results')
      .select('*')
      .eq('draw_date', today)
      .single();

    if (existing) {
      return NextResponse.json({ message: "이미 추첨 완료", drawResult: existing });
    }

    // 2. 번호 생성
    const numbers: number[] = [];
    while (numbers.length < 5) {
      const num = Math.floor(Math.random() * 28) + 1;
      if (!numbers.includes(num)) numbers.push(num);
    }
    numbers.sort((a, b) => a - b);

    // 3. 저장
    const { data, error } = await supabase
      .from('draw_results')
      .insert([{ draw_date: today, numbers: numbers }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ message: "추첨 성공!", drawResult: data });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}