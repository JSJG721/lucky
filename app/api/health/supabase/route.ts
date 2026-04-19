import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Supabase 프로젝트 URL·anon 키가 유효한지 확인합니다.
 * 테이블이 없어도 Auth API로 연결 여부를 검사합니다.
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.auth.getSession();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Supabase 연결에 성공했습니다.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
