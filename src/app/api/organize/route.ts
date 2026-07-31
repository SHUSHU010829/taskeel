import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

// Tool the model must call — guarantees structured output.
const TASK_TOOL = {
  name: 'emit_tasks',
  description: '輸出整理後的任務清單（主任務 + 子任務）',
  input_schema: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        description: '整理後的主任務清單',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '簡潔的任務標題（繁體中文）' },
            description: {
              type: 'string',
              description: '任務說明，可用 Markdown；沒有就空字串',
            },
            category: {
              type: 'string',
              description: '從提供的分類清單擇一，否則空字串',
            },
            project: {
              type: 'string',
              description: '從提供的專案清單擇一（判斷這個任務屬於哪個專案），無法判斷則空字串',
            },
            priority: {
              type: 'integer',
              description: '0 無 1 低 2 中 3 高 4 緊急',
              minimum: 0,
              maximum: 4,
            },
            subtasks: {
              type: 'array',
              description: '子任務（只有確實可拆時才有）',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                },
                required: ['title'],
              },
            },
          },
          required: ['title'],
        },
      },
    },
    required: ['tasks'],
  },
} as const;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: '尚未設定 ANTHROPIC_API_KEY，請在環境變數加入後重新部署。' },
      { status: 400 }
    );
  }

  let body: { text?: string; categories?: string[]; projects?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 });
  }
  const text = (body.text ?? '').trim();
  if (!text) return NextResponse.json({ error: '請提供要整理的說明文字' }, { status: 400 });

  const cats = (body.categories ?? []).filter(Boolean);
  const projs = (body.projects ?? []).filter(Boolean);
  const system = `你是一個開發任務整理助手。使用者會給你一段開發相關的說明（可能很長、口語、凌亂）。請把它整理成結構化的任務清單：
- 找出「主任務」，每個主任務在確實可拆時再拆成子任務；不要過度拆解。
- 每個任務給簡潔的標題（繁體中文）與必要的說明（description，可用 Markdown，沒有就空字串）。
- 若有提供分類清單，為每個主任務挑一個最合適的分類名稱（必須是清單其中之一，否則空字串）。可用分類：${cats.length ? cats.join('、') : '（無）'}。
- 若有提供專案清單，判斷每個主任務屬於哪個專案，挑一個最合適的專案名稱（必須是清單其中之一，否則空字串）。可用專案：${projs.length ? projs.join('、') : '（無）'}。
- priority：0 無、1 低、2 中、3 高、4 緊急；不確定填 0。
- 保持忠於原文，不要臆造需求。務必透過 emit_tasks 工具輸出。`;

  let resp: Response;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system,
        tools: [TASK_TOOL],
        tool_choice: { type: 'tool', name: 'emit_tasks' },
        messages: [{ role: 'user', content: text }],
      }),
    });
  } catch (e) {
    return NextResponse.json({ error: `無法連線到 Claude API：${String(e)}` }, { status: 502 });
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    return NextResponse.json(
      { error: `Claude API 錯誤（${resp.status}）：${errText.slice(0, 400)}` },
      { status: 502 }
    );
  }

  const data = await resp.json();
  const toolUse = (data.content ?? []).find((c: { type: string }) => c.type === 'tool_use');
  if (!toolUse?.input?.tasks) {
    return NextResponse.json({ error: 'Claude 未回傳結構化結果，請再試一次。' }, { status: 502 });
  }
  return NextResponse.json({ tasks: toolUse.input.tasks });
}
