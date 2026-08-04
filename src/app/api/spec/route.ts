import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

const PRIORITY_LABELS = ['無', '低', '中', '高', '緊急'];

interface SpecTask {
  title?: string;
  description?: string;
  category?: string;
  projects?: string[];
  priority?: number;
  parent?: string;
  subtasks?: { title?: string; description?: string }[];
}

// Turn a set of selected tasks into a single development-requirements brief that
// can be handed to an AI coding agent (e.g. Claude Code).
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

  let body: { tasks?: SpecTask[]; note?: string; detail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 });
  }
  const tasks = (body.tasks ?? []).filter((t) => t.title);
  if (tasks.length === 0) {
    return NextResponse.json({ error: '沒有可統整的任務' }, { status: 400 });
  }

  const detail =
    body.detail === 'concise' || body.detail === 'detailed' ? body.detail : 'standard';
  const detailInstruction = {
    concise:
      '詳細程度：精簡。只輸出「## 需求項目」的逐項條列（每項一句話寫清楚：要做什麼、完成判定），省略其他章節與贅字。',
    standard:
      '詳細程度：標準。包含「## 概述」「## 需求項目」（每項含目的與驗收重點）「## 涉及專案與模組」「## 實作注意事項」「## 建議執行順序」。',
    detailed:
      '詳細程度：完整。在標準結構之外，額外補上：「## 技術方案建議」、可能的資料結構／欄位、必要的 API 介面草稿、以及邊界情況與錯誤處理。',
  }[detail];

  const listing = tasks
    .map((t, i) => {
      let s = `${i + 1}. ${t.title}`;
      const meta: string[] = [];
      if (t.parent) meta.push(`主任務：${t.parent}`);
      if (t.projects?.length) meta.push(`專案：${t.projects.join('、')}`);
      if (t.category) meta.push(`分類：${t.category}`);
      if (t.priority) meta.push(`優先度：${PRIORITY_LABELS[t.priority] ?? t.priority}`);
      if (meta.length) s += `（${meta.join('｜')}）`;
      if (t.description?.trim()) {
        s += `\n   說明：${t.description.trim().replace(/\n/g, '\n   ')}`;
      }
      if (t.subtasks?.length) {
        s +=
          '\n' +
          t.subtasks
            .filter((st) => st.title)
            .map((st) => `   - ${st.title}${st.description?.trim() ? `：${st.description.trim()}` : ''}`)
            .join('\n');
      }
      return s;
    })
    .join('\n\n');

  const system = `你是一位資深軟體工程師與技術文件撰寫者。使用者會提供一組開發任務（可能含主任務、子任務、所屬專案、分類、優先度與說明），這些任務通常零散、口語。請把它們統整成「一份可直接交給 AI 程式開發代理（例如 Claude Code）執行的開發需求說明」。要求：
- 使用繁體中文、Markdown 格式。
- 結構清楚，建議包含：「## 概述」「## 需求項目」（逐項，每項寫清楚：要做什麼、目的、完成判定／驗收重點）「## 涉及專案與模組」「## 實作注意事項」「## 建議執行順序」。
- 把零散的任務整理成連貫、明確、可執行的敘述；可補齊必要的脈絡，但不要臆造原文沒有的需求。
- 若任務之間有相依或先後順序，明確標示。
- 直接輸出這份說明本身，不要加開場白、不要說「以下是」之類的客套。
- ${detailInstruction}`;

  const userText =
    `以下是要統整成開發需求說明的任務：\n\n${listing}` +
    (body.note?.trim() ? `\n\n補充說明：${body.note.trim()}` : '');

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
        messages: [{ role: 'user', content: userText }],
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
  const spec = (data.content ?? [])
    .filter((c: { type: string }) => c.type === 'text')
    .map((c: { text: string }) => c.text)
    .join('')
    .trim();
  if (!spec) {
    return NextResponse.json({ error: 'Claude 未回傳內容，請再試一次。' }, { status: 502 });
  }
  return NextResponse.json({ spec });
}
