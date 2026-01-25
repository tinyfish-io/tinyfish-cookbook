import { NextRequest, NextResponse } from 'next/server';
import { generateBugReport } from '@/lib/ai-client';
import type { TestCase, TestResult } from '@/types';

interface GenerateReportRequest {
  failedTest: TestResult;
  testCase: TestCase;
  projectUrl: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateReportRequest = await request.json();
    const { failedTest, testCase, projectUrl } = body;

    if (!failedTest || !testCase || !projectUrl) {
      return NextResponse.json(
        { error: 'failedTest, testCase, and projectUrl are required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY not configured' },
        { status: 500 }
      );
    }

    const report = await generateBugReport(
      {
        title: testCase.title,
        description: testCase.description,
        expectedOutcome: testCase.expectedOutcome,
      },
      {
        error: failedTest.error,
        extractedData: failedTest.extractedData,
      },
      projectUrl
    );

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating bug report:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate bug report' },
      { status: 500 }
    );
  }
}
