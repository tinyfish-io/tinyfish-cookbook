import OpenAI from 'openai';
import { ResearchPaper } from './types';

// Mock database for tracked papers in this demo
// In a real app, this would be a database model
export interface TrackedPaper {
    id: string; // Paper ID
    paperTitle: string;
    originalCitationCount: number;
    currentCitationCount: number;
    velocity: number; // Citations per month
    lastChecked: number;
    trend: 'up' | 'stable' | 'down';
    impactProjections: {
        nextYear: number;
        fiveYear: number;
    };
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function analyzeCitationTrend(paper: ResearchPaper): Promise<TrackedPaper> {
    // Simulating citation analysis with AI since we don't have historical data access in this demo
    const prompt = `Analyze the potential citation impact of this research paper:
  Title: "${paper.title}"
  Current Citations: ${paper.citations || 0}
  Published: ${paper.publishedDate}
  Source: ${paper.source}
  
  Estimate the "Citation Velocity" (citations/month) and predict impact.
  Return JSON:
  {
    "velocity": number,
    "trend": "up" | "stable" | "down",
    "impactProjections": { "nextYear": number, "fiveYear": number }
  }
  `;

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
    });

    const analysis = JSON.parse(response.choices[0].message.content!);

    return {
        id: paper.id,
        paperTitle: paper.title,
        originalCitationCount: paper.citations || 0,
        currentCitationCount: paper.citations || 0, // In real app, this updates
        lastChecked: Date.now(),
        velocity: analysis.velocity,
        trend: analysis.trend,
        impactProjections: analysis.impactProjections
    };
}
