import { readFile, writeFile } from 'fs/promises';
import { parse, stringify } from 'csv/sync';

async function mergeRQResults() {
    const rq1Content = await readFile('rq1_output.csv', 'utf-8');
    const rq2Content = await readFile('success_cloc_stats.csv', 'utf-8');
    const rq3Content = await readFile('rq3_output.csv', 'utf-8');
    
    const rq1Data = parse(rq1Content, { columns: true });
    const rq2Data = parse(rq2Content, { columns: true });
    const rq3Data = parse(rq3Content, { columns: true });
    
    const rq1Map = new Map(rq1Data.map(row => [row.repo, row]));
    const rq2Map = new Map(rq2Data.map(row => [row.repo, row]));
    const rq3Map = new Map(rq3Data.map(row => [row.repo, row]));
    
    const allRepos = new Set([
        ...rq1Data.map(r => r.repo),
        ...rq2Data.map(r => r.repo),
        ...rq3Data.map(r => r.repo)
    ]);
    
    const results = [];
    
    for (const repo of allRepos) {
        const rq1 = rq1Map.get(repo) || {};
        const rq2 = rq2Map.get(repo) || {};
        const rq3 = rq3Map.get(repo) || {};
        
        const groundTruthDeps = parseInt(rq1.groundTruthNumberOfTransitiveDeps) || 0;
        const ourSolutionDeps = parseInt(rq1.ourSolutionTransitiveDeps) || 0;
        const baselineLines = parseInt(rq2.baselineLines) || 0;
        const slicejsLines = parseInt(rq2.slicejsLines) || 0;
        const groundTruthLOC = parseInt(rq3.groundTruthLinesOfCode) || 0;
        const ourSolutionLOC = parseInt(rq3.ourSolutionLinesOfCode) || 0;
        
        const TDR = groundTruthDeps - ourSolutionDeps;
        
        let DSLOCR = null;
        if (groundTruthLOC > 0 && ourSolutionLOC >= 0) {
            DSLOCR = ((groundTruthLOC - ourSolutionLOC) / groundTruthLOC * 100).toFixed(2);
        }
        
        let PDSLOCR = null;
        if (baselineLines > 0 && slicejsLines > 0) {
            PDSLOCR = ((baselineLines - slicejsLines) / baselineLines * 100).toFixed(2);
        }
        
        results.push({
            repo,
            rq1_groundTruthNumberOfTransitiveDeps: rq1.groundTruthNumberOfTransitiveDeps || '',
            rq1_webpackTransitiveDeps: rq1.webpackTransitiveDeps || '',
            rq1_ourSolutionTransitiveDeps: rq1.ourSolutionTransitiveDeps || '',
            rq2_baselineLines: rq2.baselineLines || '',
            rq2_webpackLines: rq2.webpackLines || '',
            rq2_slicejsLines: rq2.slicejsLines || '',
            rq3_groundTruthLinesOfCode: rq3.groundTruthLinesOfCode || '',
            rq3_webpackLinesOfCode: rq3.webpackLinesOfCode || '',
            rq3_ourSolutionLinesOfCode: rq3.ourSolutionLinesOfCode || '',
            TDR: TDR !== 0 ? TDR : '',
            DSLOCR: DSLOCR !== null ? DSLOCR : '',
            PDSLOCR: PDSLOCR !== null ? PDSLOCR : ''
        });
    }
    
    results.sort((a, b) => a.repo.localeCompare(b.repo));
    
    const csvContent = stringify(results, {
        header: true,
        columns: [
            'repo',
            'rq1_groundTruthNumberOfTransitiveDeps',
            'rq1_webpackTransitiveDeps',
            'rq1_ourSolutionTransitiveDeps',
            'rq2_baselineLines',
            'rq2_webpackLines',
            'rq2_slicejsLines',
            'rq3_groundTruthLinesOfCode',
            'rq3_webpackLinesOfCode',
            'rq3_ourSolutionLinesOfCode',
            'TDR',
            'DSLOCR',
            'PDSLOCR'
        ]
    });
    
    await writeFile('rq_all_hybrid.csv', csvContent);
    console.log(`Generated rq_all_hybrid.csv with ${results.length} repos`);
}

mergeRQResults().catch(console.error);
