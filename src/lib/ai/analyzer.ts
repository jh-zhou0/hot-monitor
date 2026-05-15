import { RawSearchResult, AIAnalysisResult } from '@/types';
import { chatCompletion } from './openrouter';
import { HOTSPOT_ANALYSIS_PROMPT, buildAnalysisUserPrompt } from './prompts';

export async function analyzeHotspots(results: RawSearchResult[]): Promise<AIAnalysisResult[]> {
  if (results.length === 0) return [];

  const batchSize = 5;
  const allAnalysis: AIAnalysisResult[] = [];

  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);
    const batchAnalysis = await analyzeBatch(batch);
    allAnalysis.push(...batchAnalysis);
  }

  return allAnalysis;
}

async function analyzeBatch(results: RawSearchResult[]): Promise<AIAnalysisResult[]> {
  try {
    const userPrompt = buildAnalysisUserPrompt(results);
    const response = await chatCompletion([
      { role: 'system', content: HOTSPOT_ANALYSIS_PROMPT },
      { role: 'user', content: userPrompt },
    ], { temperature: 0.2, maxTokens: 2000 });

    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return (parsed.results || []).map((r: { is_genuine: boolean; score: number; summary: string; analysis: string }) => ({
      is_genuine: r.is_genuine,
      score: Math.min(100, Math.max(0, r.score)),
      summary: r.summary,
      analysis: r.analysis,
    }));
  } catch (e) {
    console.error('[analyzer] AI analysis failed:', e);
    return results.map(() => ({
      is_genuine: false,
      score: 0,
      summary: 'AI分析失败',
      analysis: '无法完成分析',
    }));
  }
}
