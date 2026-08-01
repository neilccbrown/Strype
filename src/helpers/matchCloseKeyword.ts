interface EditDistanceWeights {
    insertion?: number;
    deletion?: number;
    substitution?: number;
    transposition?: number;
}

function weightedEditDistance(
    a: string,
    b: string,
    weights: EditDistanceWeights = {}
): number {
    const insertion = weights.insertion ?? 1;
    const deletion = weights.deletion ?? 1;
    const substitution = weights.substitution ?? 1;
    const transposition = weights.transposition ?? 1;

    const m = a.length;
    const n = b.length;

    const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

    dp[0][0] = 0;

    for (let i = 1; i <= m; i++) {
        dp[i][0] = dp[i - 1][0] + deletion;
    }

    for (let j = 1; j <= n; j++) {
        dp[0][j] = dp[0][j - 1] + insertion;
    }

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : substitution;

            let best = Math.min(
                dp[i - 1][j] + deletion,       // delete
                dp[i][j - 1] + insertion,      // insert
                dp[i - 1][j - 1] + cost        // substitute/match
            );

            // transpose adjacent characters
            if (
                i > 1 &&
                j > 1 &&
                a[i - 1] === b[j - 2] &&
                a[i - 2] === b[j - 1]
            ) {
                best = Math.min(
                    best,
                    dp[i - 2][j - 2] + transposition
                );
            }

            dp[i][j] = best;
        }
    }

    return dp[m][n];
}

const DISTANCES = {
    insertion: 1,
    deletion: 1,
    substitution: 1,
    transposition: 0.25,
};

export function findNearCandidate(userInput: string, options: string[]) : string | undefined {
    const withDistances = options.map((option) => ({option: option, distance: weightedEditDistance(userInput, option, DISTANCES)}));
    
    return withDistances
        .filter((o) => o.distance <= 1.5)
        .sort((a, b) => a.distance - b.distance)
        .map((o) => o.option)
        .at(0);
}
