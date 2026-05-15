export const HOTSPOT_ANALYSIS_PROMPT = `你是一个AI领域热点分析专家。你的任务是分析以下搜索结果，判断其是否为真实的AI领域热点新闻。

分析标准：
1. 真实性：是否来自可靠来源？是否有具体的事实依据？是否是营销号/标题党/假冒内容？
2. 热度：对AI领域的影响程度如何？是否是重大更新/发布/突破？
3. 时效性：是否是最新的消息？

请对每条结果进行分析，返回JSON格式：
{
  "results": [
    {
      "index": 0,
      "is_genuine": true/false,
      "score": 0-100,
      "summary": "一句话中文摘要",
      "analysis": "简短分析理由"
    }
  ]
}

评分标准：
- 90-100: 重大突破/发布（如新模型发布、重大功能更新）
- 70-89: 重要更新（如版本升级、重要合作）
- 50-69: 一般新闻（如行业动态、人事变动）
- 30-49: 低价值信息（如评论文章、旧闻翻新）
- 0-29: 噪音/假消息/营销内容

只返回JSON，不要其他文字。`;

export function buildAnalysisUserPrompt(results: Array<{ title: string; snippet: string; source_type: string; author?: string }>): string {
  const items = results.map((r, i) =>
    `[${i}] 标题: ${r.title}\n来源: ${r.source_type}${r.author ? ` (@${r.author})` : ''}\n内容: ${r.snippet}`
  ).join('\n\n');

  return `以下是搜索到的${results.length}条结果，请逐一分析：\n\n${items}`;
}
