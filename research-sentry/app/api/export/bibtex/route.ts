import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const { papers } = await req.json();
    const bib = papers.map((p: any, i: number) => {
        const key = 'paper' + i;
        return '@article{' + key + ',\n  title={' + p.title + '},\n  author={' + (p.authors?.join(' and ') || '') + '},\n  year={' + (p.publishedDate || '') + '},\n  url={' + p.url + '}\n}';
    }).join('\n\n');
    return new NextResponse(bib, {
        headers: { 'Content-Type': 'application/x-bibtex', 'Content-Disposition': 'attachment; filename=papers.bib' }
    });
}
